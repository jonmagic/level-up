import { z } from 'zod'
import { graphqlWithAuth } from '../services/github.js'

const SearchContributionsSchema = z.object({
  author: z.string().describe('GitHub username of the author'),
  since: z.string().describe('ISO date string for start of search range'),
  until: z.string().describe('ISO date string for end of search range')
})

export type SearchContributionsInput = z.infer<typeof SearchContributionsSchema>

interface GitHubContribution {
  title: string
  url: string
  createdAt: string
  __typename: string
}

interface GitHubSearchResponse {
  search: {
    nodes: GitHubContribution[]
  }
}

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

export const searchContributions = {
  name: 'search_contributions',
  description: 'Search for GitHub issues, pull requests, and discussions created by a specific author within a date range',
  parameters: SearchContributionsSchema,
  handler: async (params: SearchContributionsInput): Promise<SearchContributionsResult> => {
    const { author, since, until } = params

    // First query for issues and pull requests
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

    // Second query for discussions
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

    const searchQuery = `org:open-truss author:${author} created:${since}..${until}`
    console.log('\nSearch Query:', searchQuery)

    // Run both queries in parallel
    const [issueResponse, discussionResponse] = await Promise.all([
      graphqlWithAuth<GitHubSearchResponse>(issueQuery, { searchQuery }),
      graphqlWithAuth<GitHubSearchResponse>(discussionQuery, { searchQuery })
    ])

    console.log('\nRaw GraphQL Responses:', JSON.stringify({
      issues: issueResponse,
      discussions: discussionResponse
    }, null, 2))

    // Filter issues and pull requests from the ISSUE search
    const issues = issueResponse.search.nodes
      .filter(node => node.__typename === 'Issue')
      .map(issue => ({
        title: issue.title,
        url: issue.url,
        created_at: issue.createdAt
      }))

    const pullRequests = issueResponse.search.nodes
      .filter(node => node.__typename === 'PullRequest')
      .map(pr => ({
        title: pr.title,
        url: pr.url,
        created_at: pr.createdAt
      }))

    // Get discussions from the DISCUSSION search
    const discussions = discussionResponse.search.nodes
      .map(discussion => ({
        title: discussion.title,
        url: discussion.url,
        created_at: discussion.createdAt
      }))

    return {
      issues,
      pull_requests: pullRequests,
      discussions,
      summary: `Found ${issues.length} issues, ${pullRequests.length} pull requests, and ${discussions.length} discussions created by ${author} between ${since} and ${until}.`
    }
  }
}
