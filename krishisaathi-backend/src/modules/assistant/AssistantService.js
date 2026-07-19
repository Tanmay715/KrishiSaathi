const { v4: uuidv4 } = require('uuid');
const { getOpenAiClient, getOpenAiModel } = require('../../lib/openai_client');
const { assertRateLimit } = require('../../utils/rate_limit');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const { detectMessageLanguage } = require('../../utils/detect_message_language');
const WeatherService = require('../weather/WeatherService');
const KccService = require('./KccService');

const MAX_HISTORY_MESSAGES = 20;

class AssistantService {
  async getThread(user_id) {
    const thread = await this.#getOrCreateThread(user_id);
    const messages = await db('assistant_messages')
      .where({ thread_id: thread.id })
      .whereIn('role', ['user', 'assistant'])
      .orderBy('created_at', 'asc');

    return {
      thread,
      messages: messages.map((message) => this.#formatMessage(message)),
    };
  }

  async chat(user_id, message, scope = {}) {
    await assertRateLimit({
      key: `assistant_chat:${user_id}`,
      limit: 20,
      window_seconds: 3600,
      message: 'Assistant chat limit reached. Try again later.',
    });

    const trimmed = String(message || '').trim();

    if (!trimmed) {
      throw ApiError.badRequest('Message is required');
    }

    const thread = await this.#getOrCreateThread(user_id);
    const user = await db('users').where({ id: user_id }).first();
    const context_payload = await this.#buildFarmContext(user_id, user, scope);
    const government = await this.#lookupGovernmentAdvice(trimmed, context_payload, user);

    await this.#saveMessage(thread.id, 'user', trimmed);

    const history = await db('assistant_messages')
      .where({ thread_id: thread.id })
      .whereIn('role', ['user', 'assistant'])
      .orderBy('created_at', 'asc')
      .limit(MAX_HISTORY_MESSAGES);

    const openai = getOpenAiClient();
    const message_language = detectMessageLanguage(trimmed);
    const reply_language = message_language === 'hi' ? 'Hindi' : 'English';
    const farm_context = JSON.stringify(context_payload);

    let completion;

    try {
      completion = await openai.chat.completions.create({
        model: getOpenAiModel(),
        messages: [
          {
            role: 'system',
            content: this.#systemPrompt(reply_language, farm_context, government),
          },
          ...history.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        ],
        temperature: 0.4,
      });
    } catch (error) {
      console.error('[assistant] OpenAI error:', error.message);
      throw ApiError.serviceUnavailable('Farm Assistant could not reach OpenAI. Try again shortly.');
    }

    const reply = completion.choices?.[0]?.message?.content?.trim()
      || 'Sorry, I could not generate a response. Please try again.';

    const metadata = government
      ? { government_recommendation: government }
      : null;

    const assistant_message = await this.#saveMessage(thread.id, 'assistant', reply, metadata);
    await db('assistant_threads').where({ id: thread.id }).update({ updated_at: db.fn.now() });

    return { thread_id: thread.id, message: this.#formatMessage(assistant_message) };
  }

  async #lookupGovernmentAdvice(message, context_payload, user) {
    const preferred_crops = (context_payload.active_crops || [])
      .map((crop) => crop.crop_name)
      .filter(Boolean);

    const farm = (context_payload.farms || [])[0] || null;
    const state = farm?.state || this.#stateFromCode(user?.state_code) || null;
    const district = farm?.district || user?.district || null;

    try {
      return await KccService.searchRecommendations({
        message,
        state,
        district,
        preferred_crops,
      });
    } catch (error) {
      console.warn('[assistant] KCC lookup failed:', error.message);
      return null;
    }
  }

  #stateFromCode(state_code) {
    if (!state_code) {
      return null;
    }

    try {
      const { resolveStateName } = require('../../utils/location_names');
      return resolveStateName(state_code, 'en');
    } catch (_error) {
      return null;
    }
  }

  #systemPrompt(reply_language, context, government) {
    const language_rules = reply_language === 'Hindi'
      ? [
        'The user is writing in Hindi or Romanized Hindi (Hinglish — Hindi words typed in English letters).',
        'Reply in Hindi using Devanagari script (हिंदी).',
        'Example: if user asks "gehu ki fasal mein keede lag gaye kya kare", reply fully in Devanagari Hindi.',
      ]
      : [
        'Reply in English.',
        'If the user switches to Hindi or Romanized Hindi in a later message, reply in Devanagari Hindi.',
      ];

    const gov_block = government?.items?.length
      ? [
        '',
        'Official Kisan Call Centre (KCC) excerpts for this question are shown separately as "Government Recommendation".',
        'Use them as supporting guidance. Do not invent that you called KCC.',
        'If an excerpt looks outdated or mismatched, say farmers should reconfirm with local agri officer / Krishibhavan / KVK.',
        'Keep your own advice practical and complementary — do not paste the full KCC text again.',
        'KCC excerpts JSON:',
        JSON.stringify(government),
      ]
      : [
        '',
        'No matching Kisan Call Centre excerpt was found for this turn.',
      ];

    return [
      'You are KrishiSaathi Farm Assistant, a practical helper for Indian farmers.',
      'Always match the language of the user\'s latest message.',
      ...language_rules,
      'Give concise, actionable advice on crops, pests, irrigation, fertilizer, and farm costs.',
      'Use the farmer context JSON below as ground truth. Prefer answering from it.',
      'If the user asks about irrigation, stages, weather, or spend, cite their actual farm data.',
      'If required data is missing, clearly say what is missing instead of inventing numbers.',
      'Never prescribe a specific pesticide brand as certain. Suggest confirming with a local agri officer or KVK.',
      'If unsure about treatment, say so clearly.',
      ...gov_block,
      '',
      'Farmer context:',
      context,
    ].join('\n');
  }

  async #buildFarmContext(user_id, user, scope = {}) {
    let farms_query = db('farms').where({ user_id, is_active: true }).orderBy('created_at', 'desc');

    if (scope.farm_id) {
      farms_query = farms_query.andWhere({ id: scope.farm_id });
    }

    const farms = await farms_query.limit(5);
    const farm_ids = farms.map((farm) => farm.id);

    let active_crops = [];
    let recent_expenses = [];
    let recent_incomes = [];
    let weather = null;
    let focused_plot = null;

    if (farm_ids.length > 0) {
      let crops_query = db('crop_cycles')
        .join('plots', 'crop_cycles.plot_id', 'plots.id')
        .whereIn('plots.farm_id', farm_ids)
        .whereIn('crop_cycles.status', ['planned', 'active'])
        .select(
          'crop_cycles.id as crop_cycle_id',
          'crop_cycles.crop_name',
          'crop_cycles.season_type',
          'crop_cycles.status',
          'crop_cycles.sowing_date',
          'crop_cycles.expected_harvest_date',
          'crop_cycles.lifecycle_stages',
          'plots.id as plot_id',
          'plots.name as plot_name',
          'plots.farm_id',
          'plots.area as plot_area',
        )
        .limit(10);

      if (scope.plot_id) {
        crops_query = crops_query.andWhere('plots.id', scope.plot_id);
        focused_plot = await db('plots')
          .where({ id: scope.plot_id })
          .whereIn('farm_id', farm_ids)
          .first();
      }

      active_crops = await crops_query;
      active_crops = active_crops.map((crop) => {
        const stages = this.#parseJson(crop.lifecycle_stages) || [];
        const current_stage = stages.find((stage) => !stage.completed)?.name || null;

        return {
          ...crop,
          lifecycle_stages: stages,
          current_stage,
        };
      });

      recent_expenses = await db('farm_expenses')
        .where({ user_id })
        .whereIn('farm_id', farm_ids)
        .modify((builder) => {
          if (scope.plot_id) {
            builder.andWhere({ plot_id: scope.plot_id });
          }
        })
        .orderBy('expense_date', 'desc')
        .limit(8)
        .select('title', 'category', 'amount', 'expense_date', 'farm_id', 'plot_id', 'crop_cycle_id');

      recent_incomes = await db('farm_incomes')
        .where({ user_id })
        .whereIn('farm_id', farm_ids)
        .modify((builder) => {
          if (scope.plot_id) {
            builder.andWhere({ plot_id: scope.plot_id });
          }
        })
        .orderBy('income_date', 'desc')
        .limit(5)
        .select('title', 'category', 'amount', 'income_date', 'farm_id', 'plot_id', 'crop_cycle_id');

      const weather_farm_id = scope.farm_id || farm_ids[0];

      try {
        weather = await WeatherService.getWeatherForUser(user_id, weather_farm_id);
      } catch (error) {
        console.warn('[assistant] weather context failed:', error.message);
      }
    }

    return {
      name: user?.name || null,
      preferred_language: user?.preferred_language || 'en',
      preferred_land_unit: user?.preferred_land_unit || 'acre',
      profile: {
        state_code: user?.state_code || null,
        district: user?.district || null,
      },
      scope: {
        farm_id: scope.farm_id || null,
        plot_id: scope.plot_id || null,
        focused_plot: focused_plot
          ? { id: focused_plot.id, name: focused_plot.name, area: focused_plot.area }
          : null,
      },
      farms: farms.map((farm) => ({
        id: farm.id,
        name: farm.name,
        state: farm.state,
        district: farm.district,
        village: farm.village,
        total_area: farm.total_area,
      })),
      active_crops,
      recent_expenses,
      recent_incomes,
      weather: weather
        ? {
          location: weather.location,
          current: weather.current,
          advisory: weather.advisory,
          forecast: weather.forecast?.slice?.(0, 3) || weather.forecast,
        }
        : null,
    };
  }

  #parseJson(value) {
    if (!value) {
      return null;
    }

    if (typeof value === 'object') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  #formatMessage(message) {
    return {
      ...message,
      metadata: this.#parseJson(message.metadata),
    };
  }

  async #getOrCreateThread(user_id) {
    let thread = await db('assistant_threads')
      .where({ user_id })
      .orderBy('updated_at', 'desc')
      .first();

    if (thread) {
      return thread;
    }

    const thread_id = uuidv4();
    await db('assistant_threads').insert({
      id: thread_id,
      user_id,
      title: 'Farm Assistant',
    });

    return db('assistant_threads').where({ id: thread_id }).first();
  }

  async #saveMessage(thread_id, role, content, metadata = null) {
    const message_id = uuidv4();
    await db('assistant_messages').insert({
      id: message_id,
      thread_id,
      role,
      content,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    return db('assistant_messages').where({ id: message_id }).first();
  }
}

module.exports = new AssistantService();
