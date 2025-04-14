import { createAgent } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { searchIssues } from '../tools/search-issues.js'

export const fetcherAgent = createAgent({
  name: 'github-fetcher',
  system: `You are a GitHub data fetching assistant.
Your task is to fetch issues using the search_issues tool when provided with an author and time range.
Always use the exact parameters provided to you.`,
  model: defaultModel,
  tools: [searchIssues]
})
