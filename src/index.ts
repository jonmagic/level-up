import { config } from 'dotenv'
import { Octokit } from '@octokit/rest'
import { graphql } from '@octokit/graphql'
import { createAgent, openai } from '@inngest/agent-kit'
import { z } from 'zod'

// Load environment variables
config()

// Initialize clients
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`
  }
})

const defaultModel = openai({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4'
})

const SearchIssuesSchema = z.object({
  author: z.string().describe('GitHub username of the author'),
  since: z.string().describe('ISO date string for start of search range'),
  until: z.string().describe('ISO date string for end of search range')
})

type SearchIssuesInput = z.infer<typeof SearchIssuesSchema>

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

interface SearchIssuesResult {
  issues: Array<{
    title: string
    url: string
    created_at: string
  }>
  summary: string
}

// Define the search issues tool
const searchIssues = {
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

    const issues = response.search.nodes.map(issue => ({
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

// Create the fetcher agent
const fetcherAgent = createAgent({
  name: 'github-fetcher',
  system: `You are a GitHub data fetching assistant.
Your task is to fetch issues using the search_issues tool when provided with an author and time range.
Always use the exact parameters provided to you.`,
  model: defaultModel,
  tools: [searchIssues]
})

// Create the analyzer agent
const analyzerAgent = createAgent({
  name: 'issue-analyzer',
  system: `You are an expert at analyzing GitHub issue titles and providing constructive feedback.
When given a list of issue titles to analyze, provide a detailed analysis focusing on:

1. Clarity and Descriptiveness:
   - Are titles self-explanatory?
   - Do they clearly communicate the purpose/problem?
   - Are they specific enough?

2. Best Practices:
   - Proper length (not too long/short)
   - Use of prefixes/tags where appropriate
   - Proper capitalization
   - No unnecessary punctuation

3. Consistency:
   - Consistent naming patterns
   - Consistent use of prefixes/tags
   - Consistent formatting

For each category, provide:
- What's being done well
- Areas for improvement
- Specific examples from the provided issues
- Concrete suggestions for better alternatives

Be constructive and specific in your feedback, using actual examples to illustrate your points.`,
  model: defaultModel,
  tools: []
})

async function main() {
  console.log('Peer Feedback Application')

  const thirtyDaysAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Step 1: Fetch issues
  console.log('\nFetching Issues...')
  const fetchResult = await fetcherAgent.run(`Use the search_issues tool with these parameters:
- author: jonmagic
- since: ${thirtyDaysAgo}
- until: ${now}`)

  // Extract issues from fetch result
  let issues: Array<{ title: string; url: string }> = []
  for (const toolCall of fetchResult.toolCalls) {
    if (toolCall.role === 'tool_result' && toolCall.content) {
      try {
        const { data } = toolCall.content as { data: SearchIssuesResult }
        console.log('\n' + data.summary)
        issues = data.issues
        if (issues.length > 0) {
          console.log('\nFound Issues:')
          for (const issue of issues) {
            console.log(`- ${issue.title} (${issue.url})`)
          }
        }
      } catch (error) {
        console.error('Error processing tool result:', error)
        console.log('Raw tool result:', JSON.stringify(toolCall.content, null, 2))
      }
    }
  }

  if (issues.length === 0) {
    console.log('No issues found to analyze.')
    return
  }

  // Step 2: Analyze issues
  console.log('\nAnalyzing Issues...')
  const analysisResult = await analyzerAgent.run(`Please analyze these GitHub issue titles:

${issues.map(issue => `- ${issue.title}`).join('\n')}

Provide detailed feedback on their clarity, best practices, and consistency.`)

  console.log('\nAnalysis Results:')
  console.log('----------------')

  // Print analysis
  for (const message of analysisResult.output) {
    if (message.role === 'assistant' && 'content' in message && message.content) {
      console.log('\n' + message.content)
    }
  }
}

main().catch(console.error)
