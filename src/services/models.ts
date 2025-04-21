// AI Model Configuration Service
// This module provides centralized configuration and instantiation of AI models
// for use throughout the application. It supports both OpenAI and Azure OpenAI
// endpoints, with environment-based configuration for flexibility.

import { openai } from '@inngest/agent-kit'
import { env } from '../config.js'

// OpenAI model configuration
// Creates a standard OpenAI client with API key and model selection
// from environment variables. Used for direct OpenAI API access.
export const openaiModel = openai({
  apiKey: env.openai.apiKey,
  model: env.openai.model
})

// Azure OpenAI model configuration
// Creates an Azure-specific OpenAI client with additional configuration
// for Azure's deployment and endpoint requirements. This is the preferred
// configuration for production environments.
// export const azureOpenaiModel = azureOpenai({
//   apiKey: env.azureOpenai.apiKey,
//   model: env.azureOpenai.model,
//   endpoint: env.azureOpenai.endpoint,
//   deployment: env.azureOpenai.deployment,
//   apiVersion: env.azureOpenai.apiVersion,
// })

// Default model export
// Azure OpenAI is set as the default model for the application
// This can be changed based on environment or requirements
export const defaultModel = openaiModel
