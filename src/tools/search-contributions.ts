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

// Interface for search contributions result
// Defines the structure of the result returned by the tool
export interface SearchContributionsResult {
  issues: Array<{
    title: string
    url: string
    created_at: string
    updated_at: string
  }>
  pull_requests: Array<{
    title: string
    url: string
    created_at: string
    updated_at: string
  }>
  discussions: Array<{
    title: string
    url: string
    created_at: string
    updated_at: string
  }>
  summary: string
}

// Main search contributions tool implementation
// Handles searching for GitHub contributions using GraphQL queries
export const searchContributions = createTool({
  name: 'search_contributions',
  description: 'Search for GitHub issues, pull requests, and discussions created by a specific author within a date range',
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
    const searchQuery = `org:${organization} involves:${author} created:${since}..${until}`
    logger.debug('\nSearch Query:', searchQuery)

    // Function to fetch all pages of results for a given query
    async function fetchAllPages(query: string, type: 'ISSUE' | 'DISCUSSION') {
      const allNodes = []
      let hasNextPage = true
      let endCursor = null
      let pageCount = 0
      let totalFetched = 0

      while (hasNextPage && (!limit || totalFetched < limit)) {
        pageCount++
        logger.debug(`\nFetching page ${pageCount} for ${type} query...`)
        logger.debug(`Current cursor: ${endCursor || 'initial'}`)

        // Calculate how many items to fetch on this page
        const itemsToFetch = limit ? Math.min(100, limit - totalFetched) : 100

        const response: GitHubSearchResponse = await executeQuery<GitHubSearchResponse>(query, {
          searchQuery,
          first: itemsToFetch,
          after: endCursor
        })

        logger.debug('\nGitHub API Response:', JSON.stringify(response, null, 2))
        logger.debug('\nSearch Response:', JSON.stringify(response.search, null, 2))

        const nodesCount = response.search.nodes.length
        allNodes.push(...response.search.nodes)
        totalFetched += nodesCount
        hasNextPage = response.search.pageInfo.hasNextPage
        endCursor = response.search.pageInfo.endCursor

        logger.debug(`Fetched ${nodesCount} nodes on page ${pageCount}`)
        logger.debug(`Total fetched: ${totalFetched}`)
        logger.debug(`Has next page: ${hasNextPage}`)
        logger.debug(`Next cursor: ${endCursor || 'none'}`)

        // If we've reached the limit, stop fetching
        if (limit && totalFetched >= limit) {
          logger.debug(`Reached limit of ${limit}, stopping pagination`)
          break
        }
      }

      logger.debug(`\nCompleted fetching ${type} with ${pageCount} pages and ${allNodes.length} total nodes`)
      return allNodes
    }

    // Execute both queries in parallel for better performance
    const [issueNodes, discussionNodes] = await Promise.all([
      fetchAllPages(issueQuery, 'ISSUE'),
      fetchAllPages(discussionQuery, 'DISCUSSION')
    ])

    logger.debug('\nRaw GraphQL Responses:', JSON.stringify({
      issues: issueNodes,
      discussions: discussionNodes
    }, null, 2))

    // Process and format the results
    const issues = issueNodes
      .filter(node => node.__typename === 'Issue')
      .map(node => ({
        title: node.title,
        url: node.url,
        created_at: node.createdAt,
        updated_at: node.updatedAt
      }))

    const pull_requests = issueNodes
      .filter(node => node.__typename === 'PullRequest')
      .map(node => ({
        title: node.title,
        url: node.url,
        created_at: node.createdAt,
        updated_at: node.updatedAt
      }))

    const discussions = discussionNodes
      .map(node => ({
        title: node.title,
        url: node.url,
        created_at: node.createdAt,
        updated_at: node.updatedAt
      }))

    const result = {
      issues,
      pull_requests,
      discussions,
      summary: `Found ${issues.length} issues, ${pull_requests.length} pull requests, and ${discussions.length} discussions created by ${author} between ${since} and ${until}.`
    }

    logger.debug('\nSearch Contributions Tool - Final Result:', JSON.stringify(result, null, 2))
    return result
  }
})
