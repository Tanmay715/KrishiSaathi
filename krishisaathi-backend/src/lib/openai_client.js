const OpenAI = require('openai');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

let client = null;

function getOpenAiClient() {
  if (!env.openai_api_key) {
    throw ApiError.serviceUnavailable(
      'OpenAI is not configured. Add OPENAI_API_KEY to the backend .env file.',
    );
  }

  if (!client) {
    client = new OpenAI({ apiKey: env.openai_api_key });
  }

  return client;
}

function getOpenAiModel() {
  return env.openai_model || 'gpt-4o-mini';
}

module.exports = {
  getOpenAiClient,
  getOpenAiModel,
};
