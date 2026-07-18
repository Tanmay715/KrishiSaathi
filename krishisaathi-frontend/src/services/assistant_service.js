import api_client from './api_client';

export async function getAssistantThread() {
  const response = await api_client.get('/assistant/thread');
  return response.data;
}

export async function sendAssistantMessage(message, { farm_id = null, plot_id = null } = {}) {
  const response = await api_client.post('/assistant/chat', {
    message,
    farm_id: farm_id || undefined,
    plot_id: plot_id || undefined,
  });
  return response.data;
}
