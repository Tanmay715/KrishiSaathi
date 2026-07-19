const redis = require('../../config/redis');
const db = require('../../db/connection');
const ApiError = require('../../utils/ApiError');
const {
  buildLocationParts,
  hasDevanagari,
  normalizeDistrictName,
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
    const payload = this.#formatPayload(farm, coords, forecast);

    try {
      await redis.set(cache_key, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn('[weather] cache write failed:', error.message);
    }

    return payload;
  }

  async clearUserCache(user_id) {
    try {
      const keys = await redis.keys(`weather:${user_id}:*`);
      if (keys.length) {
        await redis.del(...keys);
      }
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
    const profile_district = user?.district?.trim() || '';
    const farm_district = farm?.district?.trim() || '';
    const farm_state = farm?.state?.trim() || '';

    return {
      district: profile_district || farm_district,
      state: farm_state,
      state_code: user?.state_code || '',
      source: profile_district ? 'profile' : (farm_district || farm_state ? 'farm' : 'fallback'),
    };
  }

  #cacheKey(user_id, farm, location) {
    const district = normalizeDistrictName(location.district || 'none').toLowerCase().replace(/\s+/g, '_');
    const state = String(location.state || location.state_code || 'none').toLowerCase().replace(/\s+/g, '_');
    return `weather:${user_id}:${farm?.id || 'profile'}:${district}:${state}`;
  }

  #buildSearchNames(location) {
    const parts = buildLocationParts(location);
    const district = parts[0] || '';
    const names = [];

    if (district) {
      names.push(district);
    }

    if (parts.length >= 2) {
      names.push(`${parts[0]}, ${parts[1]}`);
    }

    return [...new Set(names.filter(Boolean))];
  }

  async #geocode(location) {
    const search_names = this.#buildSearchNames(location);
    const preferred_state = buildLocationParts(location)[1] || '';

    for (const name of search_names) {
      const languages = hasDevanagari(name) ? ['hi', 'en'] : ['en', 'hi'];

      for (const language of languages) {
        const place = await this.#geocodeOnce(name, language, preferred_state);
        if (place) {
          return place;
        }
      }
    }

    if (preferred_state) {
      const state_place = await this.#geocodeOnce(preferred_state, 'en', preferred_state);
      if (state_place) {
        return state_place;
      }
    }

    return { latitude: 28.6139, longitude: 77.209, name: 'Delhi', admin1: 'Delhi', unresolved: true };
  }

  async #geocodeOnce(name, language, preferred_state = '') {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    url.searchParams.set('count', '5');
    url.searchParams.set('language', language);
    url.searchParams.set('countryCode', 'IN');
    url.searchParams.set('format', 'json');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const results = data.results || [];
      if (!results.length) {
        return null;
      }

      const matched = preferred_state
        ? results.find((item) => {
          const admin = String(item.admin1 || '').toLowerCase();
          return admin.includes(preferred_state.toLowerCase())
            || preferred_state.toLowerCase().includes(admin);
        })
        : null;

      const place = matched || results[0];
      return {
        latitude: place.latitude,
        longitude: place.longitude,
        name: place.name,
        admin1: place.admin1 || null,
      };
    } catch (error) {
      console.warn('[weather] geocode failed:', error.message);
      return null;
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

  #formatPayload(farm, coords, forecast) {
    const current_code = forecast.current?.weather_code ?? 0;
    const rain_chance = forecast.daily?.precipitation_probability_max?.[0] ?? 0;
    const condition = WEATHER_CODE_MAP[current_code] || 'Unknown';

    const days = (forecast.daily?.time || []).map((date, index) => ({
      date,
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
        latitude: coords.latitude,
        longitude: coords.longitude,
        unresolved: Boolean(coords.unresolved),
      },
      current: {
        temperature_c: forecast.current?.temperature_2m ?? null,
        humidity: forecast.current?.relative_humidity_2m ?? null,
        condition,
        precipitation_mm: forecast.current?.precipitation ?? 0,
        rain_chance,
      },
      advisory: this.#buildAdvisory(condition, rain_chance),
      forecast: days,
    };
  }

  #buildAdvisory(condition, rain_chance) {
    const lower = String(condition).toLowerCase();

    if (rain_chance >= 60 || lower.includes('rain') || lower.includes('shower') || lower.includes('thunder')) {
      return 'Rain likely — delay spraying and plan drainage.';
    }

    if (lower.includes('clear') || lower.includes('mostly clear')) {
      return 'Clear skies — good window for field work and irrigation checks.';
    }

    if (lower.includes('fog')) {
      return 'Foggy conditions — be careful with morning spraying and travel.';
    }

    return 'Monitor the forecast and adjust irrigation if rain is expected.';
  }
}

module.exports = new WeatherService();
