import { z } from 'zod'
import { graphqlWithAuth } from '../services/github.js'

const SearchIssuesSchema = z.object({
  author: z.string().describe('GitHub username of the author'),
  since: z.string().describe('ISO date string for start of search range'),
  until: z.string().describe('ISO date string for end of search range')
})

export type SearchIssuesInput = z.infer<typeof SearchIssuesSchema>

interface GitHubIssue {
  title: string
  url: string
  createdAt: string
}

interface GitHubSearchResponse {
  search: {
    nodes: GitHubIssue[]
  }
}

export interface SearchIssuesResult {
  issues: Array<{
    title: string
    url: string
    created_at: string
  }>
  summary: string
}

export const searchIssues = {
  name: 'search_issues',
  description: 'Search for GitHub issues created by a specific author within a date range',
  parameters: SearchIssuesSchema,
  handler: async (params: SearchIssuesInput): Promise<SearchIssuesResult> => {
    const { author, since, until } = params

    const query = `
      query($searchQuery: String!) {
        search(query: $searchQuery, type: ISSUE, first: 100) {
          nodes {
            ... on Issue {
              title
              url
              createdAt
            }
          }
        }
      }
    `

    const searchQuery = `org:open-truss author:${author} created:${since}..${until} type:issue`
    console.log('\nGraphQL Query:', query)
    console.log('Search Query:', searchQuery)

    const response = await graphqlWithAuth<GitHubSearchResponse>(query, { searchQuery })
    console.log('\nRaw GraphQL Response:', JSON.stringify(response, null, 2))

    const issues = response.search.nodes.map((issue: GitHubIssue) => ({
      title: issue.title,
      url: issue.url,
      created_at: issue.createdAt
    }))

    return {
      issues,
      summary: `Found ${issues.length} issues created by ${author} between ${since} and ${until}.`
    }
  }
}
