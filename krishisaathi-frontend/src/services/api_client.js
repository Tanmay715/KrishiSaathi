import axios from 'axios';

function resolveApiBaseUrl() {
  if (import.meta.env.PROD) {
    // Same-origin via Vercel proxy — avoids phone/network blocks to Railway.
    return '/api/v1';
  }

  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

const api_client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

api_client.interceptors.request.use((config) => {
  const token = localStorage.getItem('ks_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api_client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ks_token');
      localStorage.removeItem('ks_user');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export async function requestWithRetry(request_fn, retries = 2) {
  try {
    return await request_fn();
  } catch (error) {
    const is_network = !error.response;
    const is_timeout = error.code === 'ECONNABORTED';

    if (retries > 0 && (is_network || is_timeout)) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return requestWithRetry(request_fn, retries - 1);
    }

    throw error;
  }
}

export default api_client;
