import { createAgent } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { searchContributions } from '../tools/search-contributions.js'

export const searchAgent = createAgent({
  name: 'github-search',
  system: `You are a GitHub data searching assistant.
Your task is to fetch issues, pull requests, and discussions using the search_contributions tool when provided with an organization, author, and time range.`,
  model: defaultModel,
  tools: [searchContributions]
})
