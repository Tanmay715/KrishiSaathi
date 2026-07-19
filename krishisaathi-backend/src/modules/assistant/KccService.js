const redis = require('../../config/redis');
const { detectCropsFromText } = require('./kcc_crop_map');

const CACHE_TTL_SECONDS = 1800;
const CACHE_VERSION = 'v7';
const DEFAULT_RESOURCE_ID = 'cef25fe2-9231-4128-8aec-2c948fedd43f';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'what', 'when', 'how', 'should', 'about', 'crop',
  'crops', 'please', 'farmer', 'asked', 'query', 'information', 'regarding',
  'इस', 'की', 'के', 'में', 'है', 'क्या', 'कर', 'को', 'से',
]);

const INTENT_RULES = [
  {
    id: 'plant_protection',
    query_types: ['Plant Protection'],
    match: ['pest', 'insect', 'keeda', 'keede', 'कीड', 'disease', 'spots', 'yellow',
      'peele', 'पीले', 'wilt', 'fungus', 'blight', 'rot', 'leaf', 'पत्ती',
      'रोग', 'bimari', 'termite', 'ipm'],
    content: ['pest', 'insect', 'disease', 'blight', 'rot', 'wilt', 'leaf',
      'protection', 'fung', 'termite', 'mildew', 'ipm'],
  },
  {
    id: 'nutrient',
    query_types: ['Nutrient Management', 'Fertilizer Use and Availability'],
    match: ['fertilizer', 'fertiliser', 'nutrient', 'urea', 'dap', 'npk', 'खाद',
      'potash', 'nitrogen', 'deficiency', 'खत'],
    content: ['fertilizer', 'fertiliser', 'nutrient', 'urea', 'dap', 'npk', 'potash',
      'nitrogen', 'खत', 'dosage', 'dose'],
  },
  {
    id: 'water',
    query_types: ['Water Management'],
    match: ['irrigat', 'water', 'pani', 'पानी', 'सिंचाई', 'moisture'],
    content: ['irrigation', 'irrigate', 'water', 'moisture', 'flood', 'drip'],
  },
  {
    id: 'weather',
    query_types: ['Weather', 'Sowing Time and Weather'],
    match: ['weather', 'rain', 'baarish', 'बारिश', 'temperature', 'mausam', 'मौसम'],
    content: ['weather', 'rain', 'rainfall', 'temperature', 'forecast'],
  },
  {
    id: 'harvest',
    query_types: ['Harvesting', 'Cultural Practices'],
    match: ['harvest', 'कटाई', 'katai', 'pluck', 'picking'],
    content: ['harvest', 'harvesting', 'maturity', 'picking'],
  },
  {
    id: 'variety',
    query_types: ['Varieties'],
    match: ['variety', 'varieties', 'seed', 'बीज', 'beej', 'hybrid'],
    content: ['variety', 'varieties', 'seed', 'hybrid'],
  },
];

class KccService {
  async searchRecommendations({
    message,
    state = null,
    district = null,
    preferred_crops = [],
  } = {}) {
    const api_key = process.env.DATA_GOV_API_KEY;
    if (!api_key) {
      return null;
    }

    const message_crops = detectCropsFromText(message, []);
    const intent = this.#detectIntent(message);
    // Prefer crops named in the question. Fall back to farm crops only when intent is clear.
    const crops = message_crops.length
      ? message_crops
      : (intent ? detectCropsFromText(message, preferred_crops) : []);
    const state_name = this.#normalizePlace(state);
    const district_name = this.#normalizePlace(district);

    if ((!state_name && !crops.length) || (!crops.length && !intent)) {
      return null;
    }

    const cache_key = [
      CACHE_VERSION,
      'kcc',
      state_name || 'any',
      district_name || 'any',
      crops.join(',') || 'any',
      intent?.id || 'any',
      this.#hashText(message),
    ].join(':');

    const cached = await this.#readCache(cache_key);
    if (cached) {
      return cached;
    }

    try {
      const records = await this.#fetchCandidates({
        state_name,
        district_name,
        crops,
        intent,
      });
      const ranked = this.#rankRecords(records, message, crops, intent)
        .filter((item) => this.#isRelevant(item, message, crops, intent))
        .slice(0, 2)
        .map(({ score: _score, content_hits: _hits, ...item }) => item);

      if (!ranked.length) {
        return null;
      }

      const payload = {
        source: 'kcc',
        source_label: 'Kisan Call Centre (data.gov.in)',
        items: ranked,
      };

      await this.#writeCache(cache_key, payload);
      return payload;
    } catch (error) {
      console.warn('[kcc] search failed:', error.message);
      return null;
    }
  }

  async #fetchCandidates({ state_name, district_name, crops, intent }) {
    const years = [
      String(new Date().getFullYear()),
      String(new Date().getFullYear() - 1),
    ];
    const crop_list = crops.length ? crops : [null];
    const attempts = [];

    years.forEach((year) => {
      crop_list.forEach((crop) => {
        if (intent?.query_types?.[0] && crop) {
          attempts.push({
            Crop: crop,
            QueryType: intent.query_types[0],
            year,
          });
        }
        if (intent?.query_types?.[0] && state_name && crop) {
          attempts.push({
            StateName: state_name,
            Crop: crop,
            QueryType: intent.query_types[0],
            year,
          });
        }
        if (state_name && crop) {
          attempts.push({ StateName: state_name, Crop: crop, year });
        }
        if (crop) {
          attempts.push({ Crop: crop, year });
        }
      });
    });

    const collected = [];
    const seen = new Set();

    for (const filters of attempts.slice(0, 8)) {
      const rows = await this.#queryDataGov(filters, 40);
      rows.forEach((row) => {
        const key = String(row.KCCCallID || `${row.QueryText}-${row.CreatedOn}`);
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        collected.push(row);
      });

      if (collected.length >= 50) {
        break;
      }
    }

    return collected;
  }

  async #queryDataGov(filters, limit = 20) {
    const resource_id = process.env.DATA_GOV_KCC_RESOURCE_ID || DEFAULT_RESOURCE_ID;
    const url = new URL(`https://api.data.gov.in/resource/${resource_id}`);
    url.searchParams.set('api-key', process.env.DATA_GOV_API_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort[CreatedOn]', 'desc');

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(`filters[${key}]`, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`data.gov.in HTTP ${response.status}`);
    }

    const body = await response.json();
    return Array.isArray(body.records) ? body.records : [];
  }

  #rankRecords(records, message, crops, intent) {
    const crop_tokens = new Set(
      crops.map((crop) => String(crop).toLowerCase()).flatMap((crop) => crop.split(/[^a-z0-9\u0900-\u097f]+/i)),
    );
    const tokens = this.#tokenize(message).filter((token) => !crop_tokens.has(token));
    const synonyms = this.#expandSynonyms(message, intent);

    return records
      .map((row) => {
        const answer = String(row.KccAns || '').trim();
        const query = String(row.QueryText || '').trim();
        if (!this.#looksLikeAdvice(query, answer)) {
          return null;
        }

        const query_type = String(row.QueryType || '').trim();
        const crop_name = String(row.Crop || '').trim();
        const created = String(row.CreatedOn || '').slice(0, 10);
        const text_blob = `${query} ${answer}`.toLowerCase();

        let score = 0;
        let content_hits = 0;

        tokens.forEach((token) => {
          if (text_blob.includes(token)) {
            score += 4;
            content_hits += 1;
          }
        });

        synonyms.forEach((token) => {
          if (text_blob.includes(token)) {
            score += 3;
            content_hits += 1;
          }
        });

        if (intent) {
          const type_match = intent.query_types.some((type_name) => (
            query_type.toLowerCase().includes(type_name.toLowerCase())
          ));
          const content_match = intent.content.some((word) => text_blob.includes(word));

          if (type_match || content_match) {
            score += 10;
          } else {
            score -= 12;
          }
        }

        if (crops.some((crop) => crop_name.toLowerCase() === crop.toLowerCase())) {
          score += 6;
        } else if (crops.length) {
          const row_crop = crop_name.toLowerCase();
          const loose = crops.some((crop) => {
            const target = crop.toLowerCase();
            if (target === 'potato' && row_crop.includes('sweet')) {
              return false;
            }
            return row_crop.includes(target);
          });
          score += loose ? 0 : -10;
        }

        if (created >= '2025-01-01') {
          score += 6;
        } else if (created >= '2024-01-01') {
          score += 3;
        } else if (created < '2023-01-01') {
          score -= 10;
        }

        return {
          score,
          content_hits,
          query,
          answer: answer.slice(0, 700),
          crop: crop_name || null,
          query_type: query_type || null,
          district: row.DistrictName || null,
          state: row.StateName || null,
          as_of: created || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.content_hits - a.content_hits
        || String(b.as_of).localeCompare(String(a.as_of)));
  }

  #isRelevant(item, message, crops, intent) {
    if (!item || item.score < 14) {
      return false;
    }

    const blob = `${item.query} ${item.answer}`.toLowerCase();

    // Must share real question words with the KCC text — crop/date alone is not enough.
    const type_aligned = Boolean(
      intent?.query_types?.some((type_name) => (
        String(item.query_type || '').toLowerCase().includes(type_name.toLowerCase())
      )),
    );
    if (item.content_hits < 1) {
      return false;
    }
    if (item.content_hits < 2 && !type_aligned && !this.#hasStrongIntentMatch(item, intent)) {
      return false;
    }

    if (intent?.id === 'water') {
      const query_ok = /(irrigat|water management|moisture|सिंचाई|जल)/i.test(item.query);
      const false_friend = /(blight|pest|disease|weed|insect|fung)/i.test(item.query);
      if (!query_ok || false_friend) {
        return false;
      }
    }

    if (intent?.id === 'plant_protection') {
      const protection_ok = /(pest|insect|disease|blight|rot|wilt|leaf|fung|termite|mildew|ipid|केड़ा|रोग)/i
        .test(blob);
      if (!protection_ok) {
        return false;
      }
    }

    if (intent?.id === 'nutrient') {
      const nutrient_ok = /(fertiliz|nutrient|urea|dap|npk|potash|nitrogen|खत|dose|dosage)/i
        .test(blob);
      if (!nutrient_ok) {
        return false;
      }
    }

    if (crops.length) {
      const row_crop = String(item.crop || '').toLowerCase();
      const crop_ok = crops.some((crop) => {
        const target = crop.toLowerCase();
        if (target === 'potato' && row_crop.includes('sweet')) {
          return false;
        }
        return row_crop === target || row_crop.includes(target);
      });
      if (!crop_ok || this.#mentionsOtherCrop(item.query, crops)) {
        return false;
      }
    }

    if (intent?.id === 'plant_protection') {
      const leaf_question = /(yellow|spot|leaf|blight|पत्ती|पीले|धब्ब)/i.test(message);
      if (leaf_question && /storage pest|market price|weed control/i.test(item.query)) {
        return false;
      }
    }

    return true;
  }

  #mentionsOtherCrop(query, crops) {
    const blob = String(query || '').toLowerCase();
    const others = [
      'tomato', 'onion', 'wheat', 'paddy', 'rice', 'cotton', 'maize', 'banana',
      'chilli', 'chili', 'brinjal', 'cabbage', 'cauliflower', 'sweet potato',
    ];
    const allowed = crops.map((crop) => String(crop).toLowerCase());

    return others.some((other) => {
      if (!blob.includes(other)) {
        return false;
      }
      return !allowed.some((crop) => crop.includes(other) || other.includes(crop.split(' ')[0]));
    });
  }

  #hasStrongIntentMatch(item, intent) {
    if (!intent) {
      return false;
    }
    const blob = `${item.query} ${item.answer} ${item.query_type}`.toLowerCase();
    const content_match = intent.content.filter((word) => blob.includes(word)).length >= 2;
    const type_match = intent.query_types.some((type_name) => (
      String(item.query_type || '').toLowerCase().includes(type_name.toLowerCase())
    ));
    return content_match && type_match;
  }

  #looksLikeAdvice(query, answer) {
    if (!answer || answer.length < 20) {
      return false;
    }

    if (/^explained\.?$/i.test(answer) || /^refered to kvk$/i.test(answer)) {
      return false;
    }

    if (/farmer asked query on weather/i.test(query)) {
      return false;
    }

    if (/giving information regarding kisan call centre/i.test(query)) {
      return false;
    }

    if (/complaint|complaints|फरિયાદ|शिकायत/i.test(`${query} ${answer}`)) {
      return false;
    }

    if (/market price|mandi (rate|price|भाव)|मंडी भाव/i.test(query)) {
      return false;
    }

    if (/organic farming of potatoes/i.test(query)) {
      return false;
    }

    if (/1800\s*180\s*1551/i.test(answer) && answer.length < 120) {
      return false;
    }

    return true;
  }

  #detectIntent(message) {
    const text = String(message || '').toLowerCase();
    for (const rule of INTENT_RULES) {
      if (rule.match.some((token) => text.includes(token))) {
        return rule;
      }
    }
    return null;
  }

  #expandSynonyms(message, intent) {
    const text = String(message || '').toLowerCase();
    const extra = [];

    if (intent?.content) {
      extra.push(...intent.content);
    }
    if (/yellow|पीले|peele|spot|धब्ब/.test(text)) {
      extra.push('blight', 'leaf', 'disease', 'yellow');
    }
    if (/keed|कीड|pest|insect/.test(text)) {
      extra.push('pest', 'insect', 'disease');
    }
    if (/fertiliz|खाद|खत|urea|npk/.test(text)) {
      extra.push('fertilizer', 'nutrient', 'urea', 'dose');
    }
    if (/irrig|सिंचाई/.test(text)) {
      extra.push('irrigation', 'irrigate', 'moisture');
    }

    return [...new Set(extra)];
  }

  #tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9\u0900-\u097f]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
      .slice(0, 16);
  }

  #normalizePlace(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) {
      return null;
    }

    const aliases = {
      KERALAM: 'KERALA',
      'NCT OF DELHI': 'DELHI',
      ORISSA: 'ODISHA',
    };

    return aliases[text] || text;
  }

  #hashText(text) {
    const raw = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(index);
      hash |= 0;
    }
    return String(hash);
  }

  async #readCache(key) {
    try {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  async #writeCache(key, value) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch (_error) {
      // ignore cache write failures
    }
  }
}

module.exports = new KccService();
