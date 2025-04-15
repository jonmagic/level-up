// GitHub Search Agent
// An AI agent specialized in searching and retrieving GitHub contribution data
// Uses the search_contributions tool to fetch issues, pull requests, and discussions

import { createAgent } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { searchContributions } from '../tools/search-contributions.js'
import { logger } from '../services/logger.js'

// Creates and exports a specialized agent for GitHub contribution searches
// The agent is configured with a specific system prompt and set of tools
export const searchAgent = createAgent({
  // Unique identifier for the agent
  name: 'github-search',
  // System prompt defining the agent's role and capabilities
  system: `You are a GitHub data searching assistant.
Your task is to fetch issues, pull requests, and discussions using the search_contributions tool when provided with an organization, author, and time range.`,
  // AI model to use for processing requests
  model: defaultModel,
  // Tools available to the agent for performing searches
  tools: [searchContributions],
  // Lifecycle hooks for debug logging
  lifecycle: {
    onStart: ({ prompt, history = [] }) => {
      logger.debug('\nSearch Agent - Starting with prompt:', prompt)
      return { prompt, history, stop: false }
    },
    onResponse: ({ result }) => {
      logger.debug('\nSearch Agent - Model Response:', JSON.stringify(result, null, 2))
      return result
    },
    onFinish: ({ result }) => {
      logger.debug('\nSearch Agent - Final Result:', JSON.stringify(result, null, 2))
      return result
    }
  }
})
