import api_client from './api_client';

export async function interpretVoiceCommand(payload) {
  const response = await api_client.post('/voice/command', payload);
  return response.data;
}
