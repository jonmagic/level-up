// GitHub Search Agent
// A friendly assistant that helps find GitHub contributions
// Can search for issues, pull requests, and discussions

import { createAgent } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { searchContributions } from '../tools/search-contributions.js'
import { logger } from '../services/logger.js'

// Creates a helpful agent that can search GitHub contributions
export const searchAgent = createAgent({
  name: 'github-search',
  system: `You're a helpful assistant that finds GitHub contributions.
I can help you find issues, pull requests, and discussions from GitHub.

To search, I'll need:
- The organization name
- The author's username
- A time range to search within
- Optionally, how many results you'd like to see

For example, you could ask me to:
"Find the last 3 contributions by username in open-truss from 2023"

I'll handle the details and get you the information you need.`,
  model: defaultModel,
  tools: [searchContributions],
  lifecycle: {
    onStart: ({ prompt, history = [] }) => {
      logger.debug('Starting search with:', prompt)
      return { prompt, history, stop: false }
    },
    onResponse: ({ result }) => {
      logger.debug('Search results:', JSON.stringify(result, null, 2))
      return result
    },
    onFinish: ({ result }) => {
      logger.debug('Final search results:', JSON.stringify(result, null, 2))
      return result
    }
  }
})
