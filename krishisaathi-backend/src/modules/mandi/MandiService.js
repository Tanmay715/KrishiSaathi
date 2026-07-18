const redis = require('../../config/redis');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const { assertRateLimit } = require('../../utils/rate_limit');
const { resolveCommodity, listKnownCommodities } = require('./commodity_map');
const { getReferenceRate } = require('./reference_rates');

const CACHE_TTL_SECONDS = 3600;
const DATA_GOV_RESOURCE_ID = process.env.DATA_GOV_MANDI_RESOURCE_ID
  || '9ef84268-d588-465a-a308-a864a43d0070';

class MandiService {
  listCommodities() {
    return listKnownCommodities();
  }

  async getRates(user_id, query = {}) {
    await assertRateLimit({
      key: `mandi_rates:${user_id}`,
      limit: 30,
      window_seconds: 3600,
      message: 'Mandi rate lookup limit reached. Please try again later.',
    });

    const farm = await this.#resolveFarm(user_id, query.farm_id || null);
    const crop_name = query.crop || query.commodity || '';
    const commodity = resolveCommodity(crop_name);

    if (!commodity) {
      throw ApiError.badRequest('Crop or commodity is required');
    }

    const state = query.state || farm?.state || null;
    const district = query.district || farm?.district || null;
    const cache_key = `mandi:${commodity}:${state || 'all'}:${district || 'all'}`;

    let payload = await this.#readCache(cache_key);

    if (!payload) {
      payload = await this.#fetchLiveRates(commodity, state, district);

      if (!payload) {
        payload = this.#buildReferencePayload(commodity, state, district);
      }

      await this.#writeCache(cache_key, payload);
    }

    const expense_total = Number(query.expense_total || 0);
    const quantity = Number(query.quantity || 0);
    payload.break_even = this.#buildBreakEven(payload.summary, expense_total, quantity);
    payload.farm = farm
      ? { id: farm.id, name: farm.name, state: farm.state, district: farm.district }
      : null;
    payload.requested_crop = crop_name || commodity;

    return payload;
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
      const records = await this.#queryDataGov(commodity, state, district);
      const markets = this.#normalizeRecords(records);

      if (!markets.length) {
        return null;
      }

      return {
        commodity,
        unit: '₹/quintal',
        source: 'agmarknet',
        source_label: 'AGMARKNET (data.gov.in)',
        as_of: markets[0].date || new Date().toISOString().slice(0, 10),
        state,
        district,
        markets: markets.slice(0, 8),
        summary: this.#summarizeMarkets(markets),
        disclaimer_key: 'mandi.disclaimer',
      };
    } catch (error) {
      console.warn('[mandi] live fetch failed:', error.message);
      return null;
    }
  }

  async #queryDataGov(commodity, state, district) {
    const url = new URL(`https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}`);
    url.searchParams.set('api-key', process.env.DATA_GOV_API_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '40');
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
        const modal = Number(row.modal_price ?? row.modal ?? 0);
        const min = Number(row.min_price ?? row.min ?? modal);
        const max = Number(row.max_price ?? row.max ?? modal);

        if (!modal && !min && !max) {
          return null;
        }

        return {
          market: row.market || row.market_name || 'Market',
          district: row.district || row.district_name || null,
          state: row.state || row.state_name || null,
          variety: row.variety || null,
          min,
          max,
          modal: modal || Math.round((min + max) / 2),
          date: row.arrival_date || row.date || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.modal - a.modal);
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
