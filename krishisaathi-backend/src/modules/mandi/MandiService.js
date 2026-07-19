const redis = require('../../config/redis');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const { assertRateLimit } = require('../../utils/rate_limit');
const { resolveStateName } = require('../../utils/location_names');
const { resolveCommodity, listKnownCommodities } = require('./commodity_map');
const { getReferenceRate } = require('./reference_rates');
const { getAgmarknetStateQueries } = require('./agmarknet_aliases');

const CACHE_TTL_SECONDS = 1800;
const CACHE_VERSION = 'v4';
const DATA_GOV_RESOURCE_ID = process.env.DATA_GOV_MANDI_RESOURCE_ID
  || '9ef84268-d588-465a-a308-a864a43d0070';

const DEFAULT_BOARD_CROPS = [
  'Potato', 'Wheat', 'Onion', 'Rice', 'Tomato', 'Mustard', 'Moong', 'Chana', 'Cotton',
];

class MandiService {
  listCommodities() {
    return listKnownCommodities();
  }

  async clearUserCaches() {
    // Cache keys are location+crop scoped (not user id). Version bump handles stale entries.
    return true;
  }

  async getRates(user_id, query = {}) {
    await assertRateLimit({
      key: `mandi_rates:${user_id}`,
      limit: 40,
      window_seconds: 3600,
      message: 'Mandi rate lookup limit reached. Please try again later.',
    });

    const location = await this.#resolveLocation(user_id, query);
    const crop_name = query.crop || query.commodity || '';
    const commodity = resolveCommodity(crop_name);

    if (!commodity) {
      throw ApiError.badRequest('Crop or commodity is required');
    }

    const payload = await this.#loadCommodityRates(
      commodity,
      location.state,
      location.district,
    );

    const expense_total = Number(query.expense_total || 0);
    const quantity = Number(query.quantity || 0);
    payload.break_even = this.#buildBreakEven(payload.summary, expense_total, quantity);
    payload.farm = location.farm;
    payload.place = location.place;
    payload.place_label = location.place_label;
    payload.requested_crop = crop_name || commodity;

    return payload;
  }

  async getBoard(user_id, query = {}) {
    await assertRateLimit({
      key: `mandi_board:${user_id}`,
      limit: 30,
      window_seconds: 3600,
      message: 'Mandi board lookup limit reached. Please try again later.',
    });

    const location = await this.#resolveLocation(user_id, query);
    const crops = this.#parseCropList(query.crops);

    const rows = [];
    for (const crop of crops) {
      const commodity = resolveCommodity(crop);
      if (!commodity) {
        continue;
      }

      try {
        const payload = await this.#loadCommodityRates(
          commodity,
          location.state,
          location.district,
        );
        const summary = payload.summary || {};
        rows.push({
          crop,
          commodity,
          unit: payload.unit,
          source: payload.source,
          source_label: payload.source_label,
          place_scope: payload.place_scope || null,
          as_of: payload.as_of,
          min: summary.min ?? null,
          modal: summary.modal_median ?? summary.modal_avg ?? null,
          max: summary.max ?? null,
          change_pct: payload.change_pct ?? null,
          trend: payload.trend?.points || [],
          markets: (payload.markets || []).slice(0, 8),
        });
      } catch (_error) {
        rows.push({
          crop,
          commodity,
          unit: '₹/quintal',
          source: 'unavailable',
          source_label: null,
          place_scope: null,
          as_of: null,
          min: null,
          modal: null,
          max: null,
          change_pct: null,
          trend: [],
          markets: [],
        });
      }
    }

    return {
      unit: '₹/quintal',
      farm: location.farm,
      place: location.place,
      place_label: location.place_label,
      crops: rows,
    };
  }

  #parseCropList(raw) {
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12);
    }

    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12);
    }

    return [...DEFAULT_BOARD_CROPS];
  }

  async #resolveLocation(user_id, query = {}) {
    const user = await db('users').where({ id: user_id, is_active: true }).first();
    const farm = await this.#resolveFarm(user_id, query.farm_id || null);

    const profile_state = resolveStateName(user?.state_code || '', 'en') || null;
    const profile_district = user?.district || null;
    const farm_state = farm?.state || null;
    const farm_district = farm?.district || null;

    const state = query.state || profile_state || farm_state || null;
    const district = query.district || profile_district || farm_district || null;
    const place_label = [district, state].filter(Boolean).join(', ') || null;

    return {
      state,
      district,
      place_label,
      place: { state, district, source: query.state || query.district
        ? 'query'
        : (profile_state || profile_district ? 'profile' : (farm ? 'farm' : null)) },
      farm: farm
        ? { id: farm.id, name: farm.name, state: farm.state, district: farm.district }
        : null,
    };
  }

  async #loadCommodityRates(commodity, state, district) {
    const cache_key = `${CACHE_VERSION}:mandi:${commodity}:${state || 'all'}:${district || 'all'}`;
    let payload = await this.#readCache(cache_key);

    if (!payload) {
      payload = await this.#fetchLiveRates(commodity, state, district);

      if (!payload) {
        // Only use India-wide reference when live API is not configured.
        // Never pretend a dummy rate is a district price when the API is live.
        if (!process.env.DATA_GOV_API_KEY) {
          payload = this.#buildReferencePayload(commodity, state, district);
        } else {
          payload = this.#buildUnavailablePayload(commodity, state, district);
        }
      }

      await this.#writeCache(cache_key, payload);
    }

    return { ...payload };
  }

  async #resolveFarm(user_id, farm_id) {
    if (farm_id) {
      const farm = await db('farms').where({ id: farm_id, user_id, is_active: true }).first();

      if (!farm) {
        throw ApiError.notFound('Farm not found');
      }

      return farm;
    }

    return db('farms').where({ user_id, is_active: true }).orderBy('created_at', 'desc').first();
  }

  async #readCache(cache_key) {
    try {
      const cached = await redis.get(cache_key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('[mandi] cache read failed:', error.message);
      return null;
    }
  }

  async #writeCache(cache_key, payload) {
    try {
      await redis.set(cache_key, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn('[mandi] cache write failed:', error.message);
    }
  }

  async #fetchLiveRates(commodity, state, district) {
    const api_key = process.env.DATA_GOV_API_KEY;

    if (!api_key) {
      return null;
    }

    try {
      const state_queries = getAgmarknetStateQueries(state);
      const attempts = [];

      if (state_queries.length && district) {
        state_queries.forEach((state_name) => {
          attempts.push({ state: state_name, district, place_scope: 'district' });
        });
      }

      if (state_queries.length) {
        state_queries.forEach((state_name) => {
          attempts.push({ state: state_name, district: null, place_scope: 'state' });
        });
      }

      // No location on profile/farm — do not invent nationwide rates as "your mandi".
      if (!attempts.length) {
        return null;
      }

      for (const attempt of attempts) {
        const records = await this.#queryDataGov(commodity, attempt.state, attempt.district);
        const markets = this.#normalizeRecords(records);

        if (!markets.length) {
          continue;
        }

        const trend = this.#buildTrend(markets);

        return {
          commodity,
          unit: '₹/quintal',
          source: 'agmarknet',
          source_label: 'AGMARKNET (data.gov.in)',
          place_scope: attempt.place_scope,
          as_of: markets[0].date || new Date().toISOString().slice(0, 10),
          state: attempt.state,
          district: attempt.district || district,
          markets: markets.slice(0, 8),
          summary: this.#summarizeMarkets(markets),
          trend,
          change_pct: trend.change_pct,
          disclaimer_key: attempt.place_scope === 'district'
            ? 'mandi.disclaimer'
            : 'mandi.disclaimer_state',
        };
      }

      return null;
    } catch (error) {
      console.warn('[mandi] live fetch failed:', error.message);
      return null;
    }
  }

  async #queryDataGov(commodity, state, district) {
    const url = new URL(`https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}`);
    url.searchParams.set('api-key', process.env.DATA_GOV_API_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '100');
    url.searchParams.set('filters[commodity]', commodity);

    if (state) {
      url.searchParams.set('filters[state]', state);
    }

    if (district) {
      url.searchParams.set('filters[district]', district);
    }

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

  #normalizeRecords(records) {
    return records
      .map((row) => {
        const modal = Number(
          row.modal_price ?? row['Modal Price'] ?? row.modal ?? 0,
        );
        const min = Number(
          row.min_price ?? row['Min Price'] ?? row.min ?? modal,
        );
        const max = Number(
          row.max_price ?? row['Max Price'] ?? row.max ?? modal,
        );

        if (!modal && !min && !max) {
          return null;
        }

        return {
          market: row.market || row.Market || row.market_name || 'Market',
          district: row.district || row.District || row.district_name || null,
          state: row.state || row.State || row.state_name || null,
          variety: row.variety || row.Variety || null,
          grade: row.grade || row.Grade || null,
          min,
          max,
          modal: modal || Math.round((min + max) / 2),
          date: this.#normalizeArrivalDate(
            row.arrival_date || row.Arrival_Date || row.date || null,
          ),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.modal - a.modal);
  }

  #normalizeArrivalDate(raw) {
    if (!raw) {
      return null;
    }

    const value = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }

    const matched = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (matched) {
      return `${matched[3]}-${matched[2].padStart(2, '0')}-${matched[1].padStart(2, '0')}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return null;
  }

  #median(values = []) {
    if (!values.length) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  #buildTrend(markets = []) {
    const by_date = new Map();

    markets.forEach((item) => {
      if (!item.date || !(item.modal > 0)) {
        return;
      }
      if (!by_date.has(item.date)) {
        by_date.set(item.date, []);
      }
      by_date.get(item.date).push(item.modal);
    });

    const points = [...by_date.entries()]
      .map(([date, values]) => ({ date, modal: this.#median(values) }))
      .filter((point) => point.modal != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    let change_pct = null;
    if (points.length >= 2) {
      const previous = points[points.length - 2].modal;
      const current = points[points.length - 1].modal;
      if (previous > 0) {
        change_pct = Math.round(((current - previous) / previous) * 1000) / 10;
      }
    }

    return { points, change_pct };
  }

  #summarizeMarkets(markets) {
    const modals = markets.map((item) => item.modal).filter((value) => value > 0);
    const mins = markets.map((item) => item.min).filter((value) => value > 0);
    const maxs = markets.map((item) => item.max).filter((value) => value > 0);

    if (!modals.length) {
      return null;
    }

    const sorted = [...modals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

    return {
      min: Math.min(...mins),
      max: Math.max(...maxs),
      modal_avg: Math.round(modals.reduce((sum, value) => sum + value, 0) / modals.length),
      modal_median: median,
      market_count: markets.length,
    };
  }

  #buildUnavailablePayload(commodity, state, district) {
    return {
      commodity,
      unit: '₹/quintal',
      source: 'unavailable',
      source_label: null,
      place_scope: district ? 'district' : (state ? 'state' : null),
      as_of: null,
      state,
      district,
      markets: [],
      summary: null,
      trend: { points: [], change_pct: null },
      change_pct: null,
      disclaimer_key: 'mandi.disclaimer_unavailable',
    };
  }

  #buildReferencePayload(commodity, state, district) {
    const rate = getReferenceRate(commodity);

    if (!rate) {
      throw ApiError.notFound(`No mandi rate found for ${commodity}`);
    }

    return {
      commodity,
      unit: '₹/quintal',
      source: 'reference',
      source_label: 'Reference estimate',
      place_scope: 'reference',
      as_of: new Date().toISOString().slice(0, 10),
      state,
      district,
      markets: [
        {
          market: district ? `${district} (indicative)` : 'India (indicative)',
          district,
          state,
          variety: null,
          min: rate.min,
          max: rate.max,
          modal: rate.modal,
          date: null,
        },
      ],
      summary: {
        min: rate.min,
        max: rate.max,
        modal_avg: rate.modal,
        modal_median: rate.modal,
        market_count: 1,
      },
      trend: { points: [], change_pct: null },
      change_pct: null,
      disclaimer_key: 'mandi.disclaimer_reference',
    };
  }

  #buildBreakEven(summary, expense_total, quantity) {
    if (!summary || !(expense_total > 0) || !(quantity > 0)) {
      return null;
    }

    const break_even_per_quintal = Math.round(expense_total / quantity);
    const modal = summary.modal_median || summary.modal_avg;
    const margin_per_quintal = modal - break_even_per_quintal;

    return {
      expense_total,
      quantity_quintal: quantity,
      break_even_per_quintal,
      modal_per_quintal: modal,
      margin_per_quintal,
      estimated_revenue: Math.round(modal * quantity),
      estimated_profit: Math.round(modal * quantity - expense_total),
    };
  }
}

module.exports = new MandiService();
