// Configuration module for the application
// Handles environment variables and application settings

import { config } from 'dotenv'

// Load environment variables from .env file
config()

// Application configuration object
// Contains all environment-specific settings and API keys
export const env = {
  // OpenAI API configuration
  openai: {
    // API key for OpenAI services
    apiKey: process.env.OPENAI_API_KEY!,
    // Model to use for AI operations. Do not go lower than o3-mini for accurate tool calls.
    model: 'gpt-4.1'
  },
  // GitHub API configuration
  github: {
    // Personal access token for GitHub API
    token: process.env.GITHUB_TOKEN!
  },
  // Debug mode flag
  debug: process.env.DEBUG === 'true'
}
