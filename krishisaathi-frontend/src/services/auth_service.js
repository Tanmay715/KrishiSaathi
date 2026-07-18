import api_client, { requestWithRetry } from './api_client';

export async function sendOtp(phone) {
  const response = await requestWithRetry(() => api_client.post('/auth/send-otp', { phone }));
  return response.data;
}

export async function verifyOtp(payload) {
  const response = await requestWithRetry(() => api_client.post('/auth/verify-otp', payload));
  return response.data;
}

export async function getProfile() {
  const response = await api_client.get('/users/me');
  return response.data;
}

export async function getProfileOverview() {
  const response = await api_client.get('/users/me/overview');
  return response.data;
}

export async function updateProfile(payload) {
  const response = await api_client.patch('/users/me', payload);
  return response.data;
}

export async function getFarms() {
  const response = await api_client.get('/farms');
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

export async function createPlot(farm_id, payload) {
  const response = await api_client.post(`/farms/${farm_id}/plots`, payload);
  return response.data;
}

export async function getActivity() {
  const response = await api_client.get('/activity');
  return response.data;
}
