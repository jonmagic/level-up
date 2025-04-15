// Tool for searching GitHub contributions (issues, pull requests, and discussions)
// Uses GitHub's GraphQL API to fetch contribution data within a specified date range

import { z } from 'zod'
import { graphqlWithAuth } from '../services/github.js'

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

// Base interface for GitHub contribution items
// Represents common fields across issues, pull requests, and discussions
interface GitHubContribution {
  title: string
  url: string
  createdAt: string
  __typename: string
}

// Interface for GitHub GraphQL search response
// Wraps the search results in a nodes array
interface GitHubSearchResponse {
  search: {
    nodes: GitHubContribution[]
  }
}

// Interface for the complete search results
// Contains separate arrays for issues, pull requests, and discussions
// Includes a summary of the search results
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
export const searchContributions = {
  name: 'search_contributions',
  description: 'Search for GitHub issues, pull requests, and discussions created by a specific author within a date range',
  parameters: SearchContributionsSchema,
  handler: async (params: SearchContributionsInput): Promise<SearchContributionsResult> => {
    const { author, since, until } = params

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
    const searchQuery = `org:${params.organization} author:${author} created:${since}..${until}`
    console.log('\nSearch Query:', searchQuery)

    // Execute both queries in parallel for better performance
    const [issueResponse, discussionResponse] = await Promise.all([
      graphqlWithAuth<GitHubSearchResponse>(issueQuery, { searchQuery }),
      graphqlWithAuth<GitHubSearchResponse>(discussionQuery, { searchQuery })
    ])

    console.log('\nRaw GraphQL Responses:', JSON.stringify({
      issues: issueResponse,
      discussions: discussionResponse
    }, null, 2))

    // Process and filter issues from the search results
    const issues = issueResponse.search.nodes
      .filter(node => node.__typename === 'Issue')
      .map(issue => ({
        title: issue.title,
        url: issue.url,
        created_at: issue.createdAt
      }))

    // Process and filter pull requests from the search results
    const pullRequests = issueResponse.search.nodes
      .filter(node => node.__typename === 'PullRequest')
      .map(pr => ({
        title: pr.title,
        url: pr.url,
        created_at: pr.createdAt
      }))

    // Process discussions from the search results
    const discussions = discussionResponse.search.nodes
      .map(discussion => ({
        title: discussion.title,
        url: discussion.url,
        created_at: discussion.createdAt
      }))

    // Return the processed results with a summary
    return {
      issues,
      pull_requests: pullRequests,
      discussions,
      summary: `Found ${issues.length} issues, ${pullRequests.length} pull requests, and ${discussions.length} discussions created by ${author} between ${since} and ${until}.`
    }
  }
}
