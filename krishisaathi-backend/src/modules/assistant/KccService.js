const redis = require('../../config/redis');

const CACHE_TTL_SECONDS = 1800;
const CACHE_VERSION = 'v1';
const DEFAULT_RESOURCE_ID = 'cef25fe2-9231-4128-8aec-2c948fedd43f';
const { detectCropsFromText } = require('./kcc_crop_map');

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

    const crops = detectCropsFromText(message, preferred_crops);
    const state_name = this.#normalizePlace(state);
    const district_name = this.#normalizePlace(district);

    if (!state_name && !crops.length) {
      return null;
    }

    const cache_key = [
      CACHE_VERSION,
      'kcc',
      state_name || 'any',
      district_name || 'any',
      crops.join(',') || 'any',
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
      });
      const ranked = this.#rankRecords(records, message, crops).slice(0, 2);

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

  async #fetchCandidates({ state_name, district_name, crops }) {
    const year = String(new Date().getFullYear() - 1);
    const attempts = [];

    crops.forEach((crop) => {
      if (state_name && district_name) {
        attempts.push({ StateName: state_name, DistrictName: district_name, Crop: crop });
      }
      if (state_name) {
        attempts.push({ StateName: state_name, Crop: crop, year });
        attempts.push({ StateName: state_name, Crop: crop });
      }
      attempts.push({ Crop: crop, year });
    });

    if (state_name && district_name) {
      attempts.push({ StateName: state_name, DistrictName: district_name, year });
    }
    if (state_name) {
      attempts.push({ StateName: state_name, year });
    }

    const collected = [];
    const seen = new Set();

    for (const filters of attempts.slice(0, 6)) {
      const rows = await this.#queryDataGov(filters, 25);
      rows.forEach((row) => {
        const key = String(row.KCCCallID || `${row.QueryText}-${row.CreatedOn}`);
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        collected.push(row);
      });

      if (collected.length >= 20) {
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

  #rankRecords(records, message, crops) {
    const tokens = this.#tokenize(message);

    return records
      .map((row) => {
        const answer = String(row.KccAns || '').trim();
        const query = String(row.QueryText || '').trim();
        if (!answer || answer.length < 12) {
          return null;
        }

        const blob = `${query} ${answer} ${row.QueryType || ''} ${row.Crop || ''}`.toLowerCase();
        let score = 0;

        tokens.forEach((token) => {
          if (blob.includes(token)) {
            score += 2;
          }
        });

        if (crops.some((crop) => String(row.Crop || '').toLowerCase() === crop.toLowerCase())) {
          score += 6;
        } else if (crops.length) {
          const row_crop = String(row.Crop || '').toLowerCase();
          const loose = crops.some((crop) => {
            const target = crop.toLowerCase();
            if (target === 'potato' && row_crop.includes('sweet')) {
              return false;
            }
            return row_crop.includes(target);
          });
          score += loose ? 1 : -3;
        }

        const created = String(row.CreatedOn || '').slice(0, 10);
        if (created >= '2023-01-01') {
          score += 2;
        }
        if (created >= '2024-01-01') {
          score += 2;
        }

        return {
          score,
          query,
          answer: answer.slice(0, 700),
          crop: row.Crop || null,
          query_type: String(row.QueryType || '').trim() || null,
          district: row.DistrictName || null,
          state: row.StateName || null,
          as_of: created || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || String(b.as_of).localeCompare(String(a.as_of)))
      .map(({ score: _score, ...item }) => item);
  }

  #tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9\u0900-\u097f]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .slice(0, 12);
  }

  #normalizePlace(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) {
      return null;
    }

    const aliases = {
      KERALAM: 'KERALA',
      'NCT OF DELHI': 'DELHI',
      'ODISHA': 'ODISHA',
      ORISSA: 'ODISHA',
    };

    return aliases[text] || text;
  }

  #hashText(text) {
    const raw = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
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
