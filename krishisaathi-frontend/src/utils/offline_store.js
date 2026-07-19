const CACHE_KEYS = {
  dashboard: 'ks_cache_dashboard',
  farms: 'ks_cache_farms',
  farm_detail: 'ks_cache_farm_',
  plot_detail: 'ks_cache_plot_',
};

export function saveOfflineData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ saved_at: Date.now(), data }));
  } catch (error) {
    console.error(error);
  }
}

export function loadOfflineData(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed.data ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function saveFarmDetail(farm_id, data) {
  saveOfflineData(`${CACHE_KEYS.farm_detail}${farm_id}`, data);
}

export function loadFarmDetail(farm_id) {
  return loadOfflineData(`${CACHE_KEYS.farm_detail}${farm_id}`);
}

export function savePlotDetail(farm_id, plot_id, data) {
  saveOfflineData(`${CACHE_KEYS.plot_detail}${farm_id}_${plot_id}`, data);
}

export function loadPlotDetail(farm_id, plot_id) {
  return loadOfflineData(`${CACHE_KEYS.plot_detail}${farm_id}_${plot_id}`);
}

export function clearDashboardWeatherCache() {
  try {
    const cached = loadOfflineData(CACHE_KEYS.dashboard);
    if (!cached) {
      return;
    }
    saveOfflineData(CACHE_KEYS.dashboard, {
      ...cached,
      weather: null,
    });
  } catch (error) {
    console.error(error);
  }
}

export function markLocationUpdated() {
  try {
    sessionStorage.setItem('ks_location_updated_at', String(Date.now()));
  } catch (error) {
    console.error(error);
  }
}

export function consumeLocationUpdated() {
  try {
    const value = sessionStorage.getItem('ks_location_updated_at');
    if (!value) {
      return false;
    }
    sessionStorage.removeItem('ks_location_updated_at');
    return true;
  } catch (error) {
    return false;
  }
}

export { CACHE_KEYS };
