// GitHub Contribution Fetcher Agent
// An AI agent specialized in fetching detailed GitHub contribution data
// Uses the appropriate fetch-* tool based on the contribution type

import { createAgent } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { fetchIssue } from '../tools/fetch-issue.js'
import { fetchPullRequest } from '../tools/fetch-pull-request.js'
import { fetchDiscussion } from '../tools/fetch-discussion.js'
import { logger } from '../services/logger.js'

// Creates and exports a specialized agent for fetching GitHub contributions
export const fetcherAgent = createAgent({
  // Unique identifier for the agent
  name: 'github-fetcher',
  // System prompt defining the agent's role and capabilities
  system: `You are a GitHub contribution fetching assistant.
Your task is to fetch detailed information about issues, pull requests, and discussions.

Given a GitHub URL, you will:
1. Parse the URL to extract repository owner, name, and contribution number
2. Determine the type of contribution (issue, pull request, or discussion)
3. Use the appropriate fetch-* tool to get detailed information

The tool call should include:
- owner: The repository owner
- repo: The repository name
- number: The contribution number

You can handle these types of URLs:
- Issues: https://github.com/owner/repo/issues/123
- Pull Requests: https://github.com/owner/repo/pull/123
- Discussions: https://github.com/owner/repo/discussions/123`,
  // AI model to use for processing requests
  model: defaultModel,
  // Tools available to the agent for fetching contributions
  tools: [fetchPullRequest, fetchIssue, fetchDiscussion],
  // Lifecycle hooks for debug logging and retry logic
  lifecycle: {
    onStart: ({ prompt, history = [] }) => {
      logger.debug('\nFetcher Agent - Starting with prompt:', prompt)
      logger.debug('\nFetcher Agent - History:', JSON.stringify(history, null, 2))
      return { prompt, history, stop: false }
    },
    onResponse: ({ result }) => {
      logger.debug('\nFetcher Agent - Model Response:', JSON.stringify(result, null, 2))
      logger.debug('\nFetcher Agent - Tool Calls:', JSON.stringify(result.toolCalls, null, 2))
      return result
    },
    onFinish: ({ result }) => {
      logger.debug('\nFetcher Agent - Final Result:', JSON.stringify(result, null, 2))
      logger.debug('\nFetcher Agent - Tool Results:', JSON.stringify(result.toolCalls?.map(tc => tc.content), null, 2))

      // If no tool calls were made, log a warning
      if (!result.toolCalls || result.toolCalls.length === 0) {
        logger.warn('No tool calls detected in the response')
      }

      return result
    }
  }
})
