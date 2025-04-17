// GitHub Search Agent
// A friendly assistant that helps find GitHub contributions
// Can search for issues, pull requests, and discussions

import { createAgent } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { searchContributions } from '../tools/search-contributions.js'
import { logger } from '../services/logger.js'
import type { SearchContributionsResult } from '../tools/search-contributions.js'
import type { Message, StateData, TextMessage } from '@inngest/agent-kit'

// Type for a search result contribution
interface SearchContribution {
  url: string
  updatedAt: string
}

// Type for the network state
interface NetworkState extends StateData {
  organization: string
  user: string
  startDate: string
  endDate: string
  contributions?: Record<string, SearchContribution>
  searchLimit?: number
}

// Creates a helpful agent that can search for GitHub contributions
export const searchAgent = createAgent({
  name: 'github-search',
  system: `You are a GitHub contribution search assistant.
Your task is to search for GitHub contributions (issues, pull requests, and discussions) and return them in a structured format.

Given search parameters, you will:
1. Format the dates in YYYY-MM-DD format (e.g., 2024-03-20) for the GitHub search API
2. Use the search_contributions tool to find relevant contributions
3. Return the results in a structured format:
{
  "contributions": {
    "url": {
      "url": "string - the contribution URL",
      "updatedAt": "string - ISO timestamp of last update"
    }
  }
}`,
  model: defaultModel,
  tools: [searchContributions],
  lifecycle: {
    onStart: ({ prompt, history = [], network }) => {
      logger.debug('\nSearch Agent - Starting with prompt:', JSON.stringify(prompt, null, 2))

      // Get search parameters from network state
      const state = network?.state?.data as NetworkState
      if (!state) {
        logger.error('No network state available')
        return { prompt, history, stop: false }
      }

      // Create a new prompt with the search parameters
      const searchPrompt: TextMessage[] = [{
        type: 'text',
        role: 'user',
        content: `Search for contributions by user ${state.user} in organization ${state.organization} that were either created or updated between ${state.startDate} and ${state.endDate}. Include issues, pull requests, and discussions. Return up to 100 results.`
      }]

      logger.debug('Search Agent - Using search parameters:', {
        author: state.user,
        since: state.startDate,
        until: state.endDate,
        organization: state.organization,
        limit: 100
      })

      return { prompt: searchPrompt, history, stop: false }
    },
    onResponse: ({ result }) => {
      // Only log the essential parts of the response
      const { output, toolCalls } = result
      logger.debug('\nSearch Agent - Model Response:', JSON.stringify({ output, toolCalls }, null, 2))
      return result
    },
    onFinish: ({ result, network }) => {
      logger.debug('\nSearch Agent - Processing final result')

      // Extract contributions from tool results
      const contributions: Record<string, SearchContribution> = {}

      try {
        for (const toolCall of result.toolCalls) {
          if (toolCall.role === 'tool_result' && toolCall.content) {
            const { data } = toolCall.content as { data: SearchContributionsResult }
            if (!data) {
              logger.error('No data in tool result')
              continue
            }

            logger.debug(`Processing tool result with ${data.issues?.length || 0} issues, ${data.pull_requests?.length || 0} PRs, ${data.discussions?.length || 0} discussions`)

            // Process issues
            for (const issue of data.issues || []) {
              contributions[issue.url] = {
                url: issue.url,
                updatedAt: issue.updated_at
              }
            }

            // Process pull requests
            for (const pr of data.pull_requests || []) {
              contributions[pr.url] = {
                url: pr.url,
                updatedAt: pr.updated_at
              }
            }

            // Process discussions
            for (const discussion of data.discussions || []) {
              contributions[discussion.url] = {
                url: discussion.url,
                updatedAt: discussion.updated_at
              }
            }
          }
        }

        // Update network state with contributions
        if (network?.state) {
          network.state.data.contributions = contributions
          logger.debug('Updated network state with contributions:', {
            totalContributions: Object.keys(contributions).length,
            issuesCount: Object.values(contributions).filter(c => c.url.includes('/issues/')).length,
            prsCount: Object.values(contributions).filter(c => c.url.includes('/pull/')).length,
            discussionsCount: Object.values(contributions).filter(c => c.url.includes('/discussions/')).length
          })
        }
      } catch (error) {
        logger.error('Error processing tool result:', error as Error)
        // Set empty contributions on error
        if (network?.state) {
          network.state.data.contributions = {}
        }
      }

      return result
    }
  }
})
