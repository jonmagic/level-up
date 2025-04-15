// AI Model Configuration Service
// Configures and exports the default OpenAI model for use across the application
// Uses environment variables for API key and model selection

import { openai } from '@inngest/agent-kit'
import { env } from '../config.js'

// Creates and exports the default OpenAI model configuration
// Uses the API key and model specified in the environment configuration
export const defaultModel = openai({
  apiKey: env.openai.apiKey,
  model: env.openai.model
})
