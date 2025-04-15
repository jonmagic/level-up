// Tool for searching GitHub contributions (issues, pull requests, and discussions)
// Uses GitHub's GraphQL API to fetch contribution data within a specified date range

import { createTool } from '@inngest/agent-kit'
import { z } from 'zod'
import { graphqlWithAuth } from '../services/github.js'
import { logger } from '../services/logger.js'

// Schema for validating search contribution parameters
// Defines the required fields and their types for contribution searches
const SearchContributionsSchema = z.object({
  author: z.string().describe('GitHub username of the author'),
  since: z.string().describe('ISO date string for start of search range'),
  until: z.string().describe('ISO date string for end of search range'),
  organization: z.string().describe('GitHub organization to search within')
})

// Type definition for search contribution input parameters
export type SearchContributionsInput = z.infer<typeof SearchContributionsSchema>

// Interface for GitHub search response
// Defines the structure of the response from GitHub's GraphQL API
interface GitHubSearchResponse {
  search: {
    nodes: Array<{
      title: string
      url: string
      createdAt: string
      __typename: string
    }>
  }
}

// Interface for search contributions result
// Defines the structure of the result returned by the tool
export interface SearchContributionsResult {
  issues: Array<{
    title: string
    url: string
    created_at: string
  }>
  pull_requests: Array<{
    title: string
    url: string
    created_at: string
  }>
  discussions: Array<{
    title: string
    url: string
    created_at: string
  }>
  summary: string
}

// Main search contributions tool implementation
// Handles searching for GitHub contributions using GraphQL queries
export const searchContributions = createTool({
  name: 'search_contributions',
  description: 'Search for GitHub issues, pull requests, and discussions created by a specific author within a date range',
  parameters: SearchContributionsSchema,
  handler: async ({ author, since, until, organization }, { step }) => {
    logger.debug('\nSearch Contributions Tool - Starting with parameters:', { author, since, until, organization })

    // GraphQL query for searching issues and pull requests
    // Uses fragments to handle both types in a single query
    const issueQuery = `
      query($searchQuery: String!) {
        search(query: $searchQuery, type: ISSUE, first: 100) {
          nodes {
            ... on Issue {
              title
              url
              createdAt
              __typename
            }
            ... on PullRequest {
              title
              url
              createdAt
              __typename
            }
          }
        }
      }
    `

    // GraphQL query for searching discussions
    const discussionQuery = `
      query($searchQuery: String!) {
        search(query: $searchQuery, type: DISCUSSION, first: 100) {
          nodes {
            ... on Discussion {
              title
              url
              createdAt
              __typename
            }
          }
        }
      }
    `

    // Construct the search query string
    const searchQuery = `org:${organization} author:${author} created:${since}..${until}`
    logger.debug('\nSearch Query:', searchQuery)

    // Execute both queries in parallel for better performance
    const [issueResponse, discussionResponse] = await Promise.all([
      graphqlWithAuth<GitHubSearchResponse>(issueQuery, { searchQuery }),
      graphqlWithAuth<GitHubSearchResponse>(discussionQuery, { searchQuery })
    ])

    logger.debug('\nRaw GraphQL Responses:', JSON.stringify({
      issues: issueResponse,
      discussions: discussionResponse
    }, null, 2))

    // Process and format the results
    const issues = issueResponse.search.nodes
      .filter(node => node.__typename === 'Issue')
      .map(node => ({
        title: node.title,
        url: node.url,
        created_at: node.createdAt
      }))

    const pull_requests = issueResponse.search.nodes
      .filter(node => node.__typename === 'PullRequest')
      .map(node => ({
        title: node.title,
        url: node.url,
        created_at: node.createdAt
      }))

    const discussions = discussionResponse.search.nodes
      .map(node => ({
        title: node.title,
        url: node.url,
        created_at: node.createdAt
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
