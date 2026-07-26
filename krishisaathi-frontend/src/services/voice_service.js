import api_client from './api_client';

export async function interpretVoiceCommand(payload) {
  const response = await api_client.post('/voice/command', payload);
  return response.data;
}

export async function getCompanionOpen({ farm_id } = {}) {
  const response = await api_client.get('/voice/companion-open', {
    params: farm_id ? { farm_id } : undefined,
  });
  return response.data;
}
