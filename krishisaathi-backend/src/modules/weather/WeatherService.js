const redis = require('../../config/redis');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const {
  buildSearchQueries,
  cleanPlaceText,
  detectQueryLanguages,
  getStateMatchNames,
  pickBestGeocodeResult,
  resolveStateName,
} = require('../../utils/location_names');

const CACHE_TTL_SECONDS = 1800;
const WEATHER_CODE_MAP = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
};

class WeatherService {
  async getWeatherForUser(user_id, farm_id = null) {
    const farm = await this.#resolveFarm(user_id, farm_id);
    const user = await db('users').where({ id: user_id, is_active: true }).first();
    const location = this.#resolveLocation(farm, user);
    const cache_key = this.#cacheKey(user_id, farm, location);

    try {
      const cached = await redis.get(cache_key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('[weather] cache read failed:', error.message);
    }

    const coords = await this.#geocode(location);
    const forecast = await this.#fetchForecast(coords.latitude, coords.longitude);
    const local_names = await this.#localizedPlaceNames(coords);
    const payload = this.#formatPayload(farm, coords, forecast, local_names);

    try {
      await redis.set(cache_key, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn('[weather] cache write failed:', error.message);
    }

    return payload;
  }

  async clearUserCache(user_id) {
    try {
      if (redis.status !== 'ready' && typeof redis.connect === 'function') {
        await redis.connect().catch(() => null);
      }

      let cursor = '0';
      do {
        const [next_cursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          `weather:${user_id}:*`,
          'COUNT',
          100,
        );
        cursor = String(next_cursor);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      console.warn('[weather] cache clear failed:', error.message);
    }
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

  #resolveLocation(farm, user) {
    const profile_district = cleanPlaceText(user?.district);
    const farm_district = cleanPlaceText(farm?.district);
    const farm_state = cleanPlaceText(farm?.state);
    const profile_state = resolveStateName(user?.state_code, 'en');

    // Profile location wins when set, so changing district in Settings updates weather.
    const district = profile_district || farm_district;
    const state = profile_district
      ? (profile_state || farm_state)
      : (farm_state || profile_state);

    return {
      district,
      state,
      state_code: cleanPlaceText(user?.state_code),
      source: profile_district ? 'profile' : (farm_district || farm_state ? 'farm' : 'fallback'),
    };
  }

  #cacheKey(user_id, farm, location) {
    const district = cleanPlaceText(location.district || 'none').toLowerCase().replace(/\s+/g, '_');
    const state = cleanPlaceText(location.state || location.state_code || 'none').toLowerCase().replace(/\s+/g, '_');
    return `weather:${user_id}:${farm?.id || 'profile'}:${district}:${state}`;
  }

  async #geocode(location) {
    const queries = buildSearchQueries(location);
    const state_names = getStateMatchNames(location.state, location.state_code);
    const languages = detectQueryLanguages(location.district || location.state || '');

    for (const query of queries) {
      for (const language of languages) {
        const results = await this.#searchPlaces(query, language);
        const best = pickBestGeocodeResult(results, state_names);
        if (best) {
          return {
            latitude: best.latitude,
            longitude: best.longitude,
            name: best.name,
            admin1: best.admin1 || null,
            unresolved: false,
          };
        }
      }
    }

    // Last resort: state centroid only (never pretend a wrong city is correct when district was given)
    const state_en = resolveStateName(location.state || location.state_code, 'en');
    if (state_en) {
      const state_results = await this.#searchPlaces(state_en, 'en');
      const state_place = pickBestGeocodeResult(state_results, state_names);
      if (state_place) {
        return {
          latitude: state_place.latitude,
          longitude: state_place.longitude,
          name: state_place.name,
          admin1: state_place.admin1 || state_en,
          unresolved: Boolean(location.district),
        };
      }
    }

    return {
      latitude: 28.6139,
      longitude: 77.209,
      name: 'Delhi',
      admin1: 'Delhi',
      unresolved: true,
    };
  }

  async #searchPlaces(name, language) {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    url.searchParams.set('count', '10');
    url.searchParams.set('language', language);
    url.searchParams.set('countryCode', 'IN');
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.warn('[weather] geocode failed:', error.message);
      return [];
    }
  }

  async #fetchForecast(latitude, longitude) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,precipitation');
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
    url.searchParams.set('forecast_days', '3');
    url.searchParams.set('timezone', 'Asia/Kolkata');

    const response = await fetch(url);
    if (!response.ok) {
      throw ApiError.serviceUnavailable('Weather service unavailable');
    }

    return response.json();
  }

  /**
   * Open-Meteo can return Hindi place names, so the app can show a fully Hindi
   * location line. Failure here is non-fatal — the English name still ships.
   */
  async #localizedPlaceNames(coords) {
    if (!coords?.name) {
      return { name_hi: null, region_hi: null };
    }

    try {
      const results = await this.#searchPlaces(coords.name, 'hi');
      const match = results.find((place) => (
        Math.abs(place.latitude - coords.latitude) < 0.25
        && Math.abs(place.longitude - coords.longitude) < 0.25
      ));

      return {
        name_hi: match?.name || null,
        region_hi: match?.admin1 || null,
      };
    } catch (error) {
      console.warn('[weather] hindi place lookup failed:', error.message);
      return { name_hi: null, region_hi: null };
    }
  }

  #formatPayload(farm, coords, forecast, local_names = {}) {
    const current_code = forecast.current?.weather_code ?? 0;
    const rain_chance = forecast.daily?.precipitation_probability_max?.[0] ?? 0;
    const condition = WEATHER_CODE_MAP[current_code] || 'Unknown';

    const days = (forecast.daily?.time || []).map((date, index) => ({
      date,
      weather_code: forecast.daily.weather_code[index] ?? null,
      condition: WEATHER_CODE_MAP[forecast.daily.weather_code[index]] || 'Unknown',
      temp_max: forecast.daily.temperature_2m_max[index],
      temp_min: forecast.daily.temperature_2m_min[index],
      rain_chance: forecast.daily.precipitation_probability_max[index],
    }));

    return {
      farm_id: farm?.id || null,
      farm_name: farm?.name || null,
      location: {
        name: coords.name,
        region: coords.admin1,
        name_hi: local_names.name_hi || null,
        region_hi: local_names.region_hi || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        unresolved: Boolean(coords.unresolved),
      },
      current: {
        temperature_c: forecast.current?.temperature_2m ?? null,
        humidity: forecast.current?.relative_humidity_2m ?? null,
        weather_code: current_code,
        condition,
        precipitation_mm: forecast.current?.precipitation ?? 0,
        rain_chance,
      },
      advisory_key: this.#advisoryKey(condition, rain_chance),
      advisory: this.#buildAdvisory(condition, rain_chance),
      forecast: days,
    };
  }

  #advisoryKey(condition, rain_chance) {
    const lower = String(condition).toLowerCase();

    if (rain_chance >= 60 || lower.includes('rain') || lower.includes('shower') || lower.includes('thunder')) {
      return 'rain';
    }

    if (lower.includes('clear')) {
      return 'clear';
    }

    if (lower.includes('fog')) {
      return 'fog';
    }

    return 'default';
  }

  #buildAdvisory(condition, rain_chance) {
    const messages = {
      rain: 'Rain likely — delay spraying and plan drainage.',
      clear: 'Clear skies — good window for field work and irrigation checks.',
      fog: 'Foggy conditions — be careful with morning spraying and travel.',
      default: 'Monitor the forecast and adjust irrigation if rain is expected.',
    };

    return messages[this.#advisoryKey(condition, rain_chance)];
  }
}

module.exports = new WeatherService();
