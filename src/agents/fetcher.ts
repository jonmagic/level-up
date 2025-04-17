// GitHub Contribution Fetcher Agent
// An AI agent specialized in fetching detailed GitHub contribution data
// Uses the appropriate fetch-* tool based on the contribution type

import { createAgent, TextMessage } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { logger } from '../services/logger.js'
import { fetchIssue } from '../tools/fetch-issue.js'
import { fetchPullRequest } from '../tools/fetch-pull-request.js'
import { fetchDiscussion } from '../tools/fetch-discussion.js'

// Type for a fetched contribution
interface FetchedContribution {
  url: string
  title: string
  body: string
  state: string
  createdAt: string
  updatedAt: string
  author: string
  comments: Array<{
    author: string
    body: string
    createdAt: string
    updatedAt: string
  }>
  reactions: Array<{
    content: string
    count: number
  }>
}

// Type for the network state
interface NetworkState {
  contributions?: Record<string, { url: string; updatedAt: string }>
  currentContributionIndex?: number
  fetchedContributions?: Record<string, FetchedContribution>
  currentContributionUrl?: string
}

// Creates a helpful agent that can fetch GitHub contributions
export const fetcherAgent = createAgent({
  name: 'github-fetcher',
  system: `You are a GitHub contribution fetcher assistant.
Your ONLY task is to fetch detailed information about GitHub contributions (issues, pull requests, and discussions).

IMPORTANT: You must ALWAYS use one of the available tools to fetch the contribution data.
DO NOT provide analysis or feedback - that is handled by a different agent.
DO NOT return the data directly in your response - use the tools to fetch it.

Given a contribution URL and timestamp, you will:
1. Determine the contribution type (issue, pull request, or discussion)
2. Use the appropriate fetch-* tool to get detailed information
3. Let the tool return the data - do not return it yourself

The contribution URL will be in the format:
https://github.com/{owner}/{repo}/{type}/{number}

You MUST use one of these tools:
- fetch_issue for issues
- fetch_pull_request for pull requests
- fetch_discussion for discussions

Extract the owner, repo, type, and number from the URL and use them in the appropriate tool call.

Example tool call for an issue:
{
  "owner": "open-truss",
  "repo": "open-truss",
  "number": 140,
  "updatedAt": "2024-03-21T21:40:39Z"
}

Example tool call for a pull request:
{
  "owner": "open-truss",
  "repo": "open-truss",
  "number": 137,
  "updatedAt": "2024-03-13T04:22:54Z"
}

CRITICAL INSTRUCTIONS:
1. You MUST make a tool call for EVERY request
2. You MUST NOT return any text response without making a tool call first
3. You MUST include the updatedAt timestamp in EVERY tool call
4. You MUST extract the owner, repo, and number from the URL
5. You MUST use the correct tool based on the contribution type

DO NOT:
- Provide analysis or feedback
- Return text responses with the data
- Skip using the tools
- Modify the data structure
- Omit the updatedAt timestamp
- Return the data directly in your response
- Return any text without making a tool call first`,
  model: defaultModel,
  tools: [fetchIssue, fetchPullRequest, fetchDiscussion],
  lifecycle: {
    onStart: ({ prompt, history = [], network }) => {
      logger.debug('\nFetcher Agent - Starting with prompt:', {
        messageType: prompt[0]?.type,
        role: prompt[0]?.role,
        content: prompt[0]?.type === 'text' ? prompt[0].content : undefined
      })

      // Get the current contribution URL from network state
      const state = network?.state?.data as NetworkState
      if (!state) {
        logger.error('No network state available')
        return { prompt, history, stop: false }
      }

      if (!state.currentContributionUrl) {
        logger.error('No current contribution URL in state')
        return { prompt, history, stop: false }
      }

      // Get the contribution from the state to access its updatedAt timestamp
      const contribution = state.contributions?.[state.currentContributionUrl]
      if (!contribution) {
        logger.error('No contribution found for URL:', state.currentContributionUrl)
        return { prompt, history, stop: false }
      }

      // Create a new prompt with the contribution URL and timestamp
      const fetchPrompt: TextMessage[] = [{
        type: 'text',
        role: 'user',
        content: `Use the appropriate tool to fetch the contribution at ${state.currentContributionUrl} with updatedAt ${contribution.updatedAt}. Do not return the data directly.`
      }]

      logger.debug('Fetcher Agent - Fetching contribution:', {
        url: state.currentContributionUrl,
        updatedAt: contribution.updatedAt
      })

      return { prompt: fetchPrompt, history, stop: false }
    },
    onResponse: ({ result }) => {
      const { output, toolCalls } = result
      logger.debug('\nFetcher Agent - Model Response:', {
        outputLength: output.length,
        toolCallsCount: toolCalls.length,
        lastMessageType: output[output.length - 1]?.type,
        toolCalls: toolCalls.map(call => ({
          type: call.type,
          content: call.content
        }))
      })
      return result
    },
    onFinish: ({ result, network }) => {
      logger.debug('\nFetcher Agent - Final Result:', {
        outputLength: result.output.length,
        toolCallsCount: result.toolCalls.length,
        createdAt: result.createdAt,
        lastMessage: result.output[result.output.length - 1]
      })

      // Update network state with the fetched contribution
      if (network?.state) {
        const state = network.state.data as NetworkState
        if (state.currentContributionUrl) {
          if (!state.fetchedContributions) {
            state.fetchedContributions = {}
          }

          // Get the contribution data from either a tool call or direct response
          const lastMessage = result.output[result.output.length - 1]
          let contributionData: FetchedContribution | undefined

          if (lastMessage?.type === 'tool_call' && lastMessage.tools?.[0]) {
            // Handle tool call response
            const toolCall = lastMessage.tools[0]
            if (toolCall.input && typeof toolCall.input === 'object') {
              contributionData = toolCall.input as unknown as FetchedContribution
            }
          } else if (lastMessage?.type === 'text' && lastMessage.content) {
            // Handle direct data response
            try {
              // Extract the JSON data from the text response
              const content = lastMessage.content as string
              const jsonMatch = content.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                contributionData = JSON.parse(jsonMatch[0]) as FetchedContribution
              }
            } catch (error) {
              logger.error('Failed to parse contribution data from text response:', error)
            }
          }

          if (contributionData) {
            state.fetchedContributions[state.currentContributionUrl] = contributionData
            logger.debug('Updated network state with fetched contribution:', {
              url: state.currentContributionUrl,
              dataKeys: Object.keys(contributionData)
            })
          } else {
            logger.error('No valid contribution data found in response')
          }
        } else {
          logger.error('No current contribution URL in state')
        }
      }

      return result
    }
  }
})
