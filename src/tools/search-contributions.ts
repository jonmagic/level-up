// Tool for searching GitHub contributions (issues, pull requests, and discussions)
// Uses GitHub's GraphQL API to fetch contribution data within a specified date range

import { createTool } from '@inngest/agent-kit'
import { z } from 'zod'
import { executeQuery, GitHubResponse } from '../services/github.js'
import { logger } from '../services/logger.js'

// Schema for validating search contribution parameters
// Defines the required fields and their types for contribution searches
const SearchContributionsSchema = z.object({
  author: z.string().describe('GitHub username of the author'),
  since: z.string().describe('ISO date string for start of search range'),
  until: z.string().describe('ISO date string for end of search range'),
  organization: z.string().describe('GitHub organization to search within'),
  limit: z.number().describe('Maximum number of results to return')
})

// Type definition for search contribution input parameters
export type SearchContributionsInput = z.infer<typeof SearchContributionsSchema>

// Interface for GitHub search response
// Defines the structure of the response from GitHub's GraphQL API
interface GitHubSearchResponse extends GitHubResponse {
  search: {
    nodes: Array<{
      title: string
      url: string
      createdAt: string
      updatedAt: string
      __typename: string
    }>
    pageInfo: {
      hasNextPage: boolean
      endCursor: string | null
    }
  }
}

// Interface for a conversation
interface Conversation {
  title: string
  url: string
  created_at: string
  updated_at: string
  type: 'issue' | 'pull_request' | 'discussion'
  role: 'author' | 'reviewer' | 'contributor' | 'commenter'
}

// Interface for search contributions result
// Defines the structure of the result returned by the tool
export interface SearchContributionsResult {
  conversations: Conversation[]
  summary: string
}

// Main search contributions tool implementation
// Handles searching for GitHub contributions using GraphQL queries
export const searchContributions = createTool({
  name: 'search_contributions',
  description: 'Search for GitHub issues, pull requests, and discussions authored, commented on, or reviewed by a specific user within a date range',
  parameters: SearchContributionsSchema,
  handler: async ({ author, since, until, organization, limit }) => {
    // GraphQL query for searching issues and pull requests
    // Uses fragments to handle both types in a single query
    const issueQuery = `
      query($searchQuery: String!, $first: Int, $after: String) {
        search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
          nodes {
            ... on Issue {
              title
              url
              createdAt
              updatedAt
              __typename
            }
            ... on PullRequest {
              title
              url
              createdAt
              updatedAt
              __typename
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `

    // GraphQL query for searching discussions
    const discussionQuery = `
      query($searchQuery: String!, $first: Int, $after: String) {
        search(query: $searchQuery, type: DISCUSSION, first: $first, after: $after) {
          nodes {
            ... on Discussion {
              title
              url
              createdAt
              updatedAt
              __typename
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `

    // Construct the search query string
    const searchQuery = `org:${organization} author:${author} created:${since}..${until}`
    logger.debug('\nSearch Query:', searchQuery)

    // Function to fetch all pages of results for a given query
    async function fetchAllPages(query: string, searchQuery: string) {
      const allNodes = []
      let hasNextPage = true
      let endCursor = null
      let pageCount = 0
      let totalFetched = 0

      while (hasNextPage && (!limit || totalFetched < limit)) {
        pageCount++
        logger.debug(`\nFetching page ${pageCount}...`)
        logger.debug(`Current cursor: ${endCursor || 'initial'}`)

        const itemsToFetch = limit ? Math.min(100, limit - totalFetched) : 100

        const response: GitHubSearchResponse = await executeQuery<GitHubSearchResponse>(query, {
          searchQuery,
          first: itemsToFetch,
          after: endCursor
        })

        const nodesCount = response.search.nodes.length
        allNodes.push(...response.search.nodes)
        totalFetched += nodesCount
        hasNextPage = response.search.pageInfo.hasNextPage
        endCursor = response.search.pageInfo.endCursor

        if (limit && totalFetched >= limit) {
          break
        }
      }

      return allNodes
    }

    // Fetch authored items
    const authoredSearchQuery = `org:${organization} author:${author} created:${since}..${until}`
    const [rawAuthoredIssues, rawAuthoredDiscussions] = await Promise.all([
      fetchAllPages(issueQuery, authoredSearchQuery),
      fetchAllPages(discussionQuery, authoredSearchQuery)
    ])

    // Fetch commented items
    const commentedSearchQuery = `org:${organization} commenter:${author} created:${since}..${until}`
    const [rawCommentedIssues, rawCommentedDiscussions] = await Promise.all([
      fetchAllPages(issueQuery, commentedSearchQuery),
      fetchAllPages(discussionQuery, commentedSearchQuery)
    ])

    // Fetch reviewed PRs
    const reviewedSearchQuery = `org:${organization} reviewed-by:${author} created:${since}..${until}`
    const rawReviewedIssues = await fetchAllPages(issueQuery, reviewedSearchQuery)

    // Process and format the results
    const processNodes = (nodes: any[], type: string, role: 'author' | 'reviewer' | 'contributor' | 'commenter') => {
      const typeMap = {
        Issue: 'issue' as const,
        PullRequest: 'pull_request' as const,
        Discussion: 'discussion' as const
      }

      return nodes
        .filter(node => node.__typename === type)
        .map(node => ({
          title: node.title,
          url: node.url,
          created_at: node.createdAt,
          updated_at: node.updatedAt,
          type: typeMap[type as keyof typeof typeMap],
          role
        }))
    }

    // Create arrays of conversations with their roles
    const authoredIssues = processNodes(rawAuthoredIssues, 'Issue', 'author')
    const authoredPullRequests = processNodes(rawAuthoredIssues, 'PullRequest', 'author')
    const authoredDiscussions = processNodes(rawAuthoredDiscussions, 'Discussion', 'author')
    const commentedIssues = processNodes(rawCommentedIssues, 'Issue', 'commenter')
    const commentedPullRequests = processNodes(rawCommentedIssues, 'PullRequest', 'commenter')
    const commentedDiscussions = processNodes(rawCommentedDiscussions, 'Discussion', 'commenter')
    const reviewedPullRequests = processNodes(rawReviewedIssues, 'PullRequest', 'reviewer')

    // Combine all conversations
    const allConversations = [
      ...authoredIssues,
      ...authoredPullRequests,
      ...authoredDiscussions,
      ...commentedIssues,
      ...commentedPullRequests,
      ...commentedDiscussions,
      ...reviewedPullRequests
    ]

    // Create a map to store unique conversations by URL
    const uniqueConversations = new Map<string, Conversation>()

    // Merge conversations with the same URL, using role priority
    for (const conversation of allConversations) {
      const existing = uniqueConversations.get(conversation.url)
      if (existing) {
        // Determine the highest priority role
        const rolePriority = {
          author: 4,
          reviewer: 3,
          contributor: 2,
          commenter: 1
        }

        if (rolePriority[conversation.role] > rolePriority[existing.role]) {
          existing.role = conversation.role
        }
      } else {
        uniqueConversations.set(conversation.url, conversation)
      }
    }

    // Convert map back to array
    const conversations = Array.from(uniqueConversations.values())

    const result: SearchContributionsResult = {
      conversations,
      summary: `Found ${conversations.length} unique conversations by ${author} between ${since} and ${until}.`
    }

    logger.debug('\nSearch Contributions Tool - Final Result:', JSON.stringify(result, null, 2))
    return result
  }
})
