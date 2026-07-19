import api_client from './api_client';

export async function getFarms() {
  const response = await api_client.get('/farms');
  return response.data;
}

export async function getQuickLogTargets() {
  const response = await api_client.get('/farms/quick-log/targets');
  return response.data;
}

export async function getFarm(farm_id) {
  const response = await api_client.get(`/farms/${farm_id}`);
  return response.data;
}

export async function createFarm(payload) {
  const response = await api_client.post('/farms', payload);
  return response.data;
}

export async function updateFarm(farm_id, payload) {
  const response = await api_client.patch(`/farms/${farm_id}`, payload);
  return response.data;
}

export async function deleteFarm(farm_id) {
  const response = await api_client.delete(`/farms/${farm_id}`);
  return response.data;
}

export async function createPlot(farm_id, payload) {
  const response = await api_client.post(`/farms/${farm_id}/plots`, payload);
  return response.data;
}

export async function updatePlot(farm_id, plot_id, payload) {
  const response = await api_client.patch(`/farms/${farm_id}/plots/${plot_id}`, payload);
  return response.data;
}

export async function deletePlot(farm_id, plot_id) {
  const response = await api_client.delete(`/farms/${farm_id}/plots/${plot_id}`);
  return response.data;
}

export async function getPlotDetail(farm_id, plot_id) {
  const response = await api_client.get(`/farms/${farm_id}/plots/${plot_id}/detail`);
  return response.data;
}

export async function getCropTemplates(language = 'en') {
  const response = await api_client.get('/crop-templates', { params: { language } });
  return response.data;
}

export async function createCropCycle(farm_id, plot_id, payload) {
  const response = await api_client.post(`/farms/${farm_id}/plots/${plot_id}/crop-cycles`, payload);
  return response.data;
}

export async function updateCropCycle(farm_id, plot_id, cycle_id, payload) {
  const response = await api_client.patch(
    `/farms/${farm_id}/plots/${plot_id}/crop-cycles/${cycle_id}`,
    payload,
  );
  return response.data;
}

export async function harvestCrop(farm_id, plot_id, cycle_id, payload = {}) {
  const response = await api_client.post(
    `/farms/${farm_id}/plots/${plot_id}/crop-cycles/${cycle_id}/harvest`,
    payload,
  );
  return response.data;
}

export async function deleteCropCycle(farm_id, plot_id, cycle_id) {
  const response = await api_client.delete(
    `/farms/${farm_id}/plots/${plot_id}/crop-cycles/${cycle_id}`,
  );
  return response.data;
}

export async function createExpense(farm_id, payload) {
  const response = await api_client.post(`/farms/${farm_id}/expenses`, payload);
  return response.data;
}

export async function parseExpenseTranscript(farm_id, payload) {
  const response = await api_client.post(`/farms/${farm_id}/expenses/parse`, payload);
  return response.data;
}

export async function deleteExpense(farm_id, expense_id) {
  const response = await api_client.delete(`/farms/${farm_id}/expenses/${expense_id}`);
  return response.data;
}

export async function updateExpense(farm_id, expense_id, payload) {
  const response = await api_client.patch(`/farms/${farm_id}/expenses/${expense_id}`, payload);
  return response.data;
}

export async function getExpenseSummary() {
  const response = await api_client.get('/expenses/summary');
  return response.data;
}

export async function createIncome(farm_id, payload) {
  const response = await api_client.post(`/farms/${farm_id}/incomes`, payload);
  return response.data;
}

export async function deleteIncome(farm_id, income_id) {
  const response = await api_client.delete(`/farms/${farm_id}/incomes/${income_id}`);
  return response.data;
}

export async function updateIncome(farm_id, income_id, payload) {
  const response = await api_client.patch(`/farms/${farm_id}/incomes/${income_id}`, payload);
  return response.data;
}

export async function getIncomeSummary() {
  const response = await api_client.get('/incomes/summary');
  return response.data;
}

export async function getPendingIncomeCrops() {
  const response = await api_client.get('/incomes/pending');
  return response.data;
}

export async function linkOrphanMoney() {
  const response = await api_client.post('/money/link-orphans');
  return response.data;
}

export async function getFarmSeasonFinance(farm_id, { season = 'all', year = 'all' } = {}) {
  const params = { season };
  if (year !== 'all') {
    params.year = year;
  }

  const response = await api_client.get(`/farms/${farm_id}/finance`, { params });
  return response.data;
}

export async function getWeather(farm_id) {
  const response = await api_client.get('/weather', {
    params: farm_id ? { farm_id } : undefined,
  });
  return response.data;
}

export async function getDiseaseScans(farm_id) {
  const response = await api_client.get(`/farms/${farm_id}/disease-scans`);
  return response.data;
}

export async function createDiseaseScan(farm_id, form_data) {
  const response = await api_client.post(`/farms/${farm_id}/disease-scans`, form_data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getReminders({ farm_id, status = 'pending' } = {}) {
  const response = await api_client.get('/reminders', {
    params: {
      status,
      ...(farm_id ? { farm_id } : {}),
    },
  });
  return response.data;
}

export async function createReminder(payload) {
  const response = await api_client.post('/reminders', payload);
  return response.data;
}

export async function updateReminder(reminder_id, payload) {
  const response = await api_client.patch(`/reminders/${reminder_id}`, payload);
  return response.data;
}

export async function generateReminders() {
  const response = await api_client.post('/reminders/generate');
  return response.data;
}

export async function getMandiRates({
  crop,
  commodity,
  farm_id,
  state,
  district,
  expense_total,
  quantity,
} = {}) {
  const response = await api_client.get('/mandi/rates', {
    params: {
      ...(crop ? { crop } : {}),
      ...(commodity ? { commodity } : {}),
      ...(farm_id ? { farm_id } : {}),
      ...(state ? { state } : {}),
      ...(district ? { district } : {}),
      ...(expense_total != null && expense_total !== '' ? { expense_total } : {}),
      ...(quantity != null && quantity !== '' ? { quantity } : {}),
    },
  });
  return response.data;
}

export async function getMandiBoard({ farm_id, state, district, crops } = {}) {
  const response = await api_client.get('/mandi/board', {
    params: {
      ...(farm_id ? { farm_id } : {}),
      ...(state ? { state } : {}),
      ...(district ? { district } : {}),
      ...(crops?.length ? { crops: crops.join(',') } : {}),
    },
  });
  return response.data;
}

export async function getMandiCommodities() {
  const response = await api_client.get('/mandi/commodities');
  return response.data;
}
