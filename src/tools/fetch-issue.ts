// Tool for fetching detailed information about a GitHub issue
// Uses GitHub's GraphQL API to fetch issue data including comments and labels

import { createTool } from '@inngest/agent-kit'
import { z } from 'zod'
import { executeQuery, GitHubResponse } from '../services/github.js'
import { IssueContribution } from '../types/contributions.js'
import { logger } from '../services/logger.js'

// Schema for validating fetch issue parameters
const FetchIssueSchema = z.object({
  owner: z.string().describe('Owner of the repository'),
  repo: z.string().describe('Name of the repository'),
  number: z.number().describe('Issue number')
})

export type FetchIssueInput = z.infer<typeof FetchIssueSchema>

interface IssueResponse extends GitHubResponse {
  repository: {
    issue: {
      title: string
      body: string
      url: string
      updatedAt: string
      state: string
      labels: {
        nodes: Array<{
          name: string
        }>
      }
      comments: {
        nodes: Array<{
          body: string
          author: {
            login: string
          } | null
          createdAt: string
        }>
      }
    }
  }
}

export const fetchIssue = createTool({
  name: 'fetch_issue',
  description: 'Fetch detailed information about a GitHub Issue',
  parameters: FetchIssueSchema,
  handler: async (params: FetchIssueInput): Promise<IssueContribution> => {
    const { owner, repo, number } = params

    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            title
            body
            url
            updatedAt
            state
            labels(first: 100) {
              nodes {
                name
              }
            }
            comments(first: 100) {
              nodes {
                body
                author {
                  login
                }
                createdAt
              }
            }
          }
        }
        rateLimit {
          remaining
          resetAt
        }
      }
    `

    const result = await executeQuery<IssueResponse>(query, {
      owner,
      repo,
      number
    })

    const issue = result.repository.issue
    if (!issue) {
      logger.error('Issue not found:', { owner, repo, number })
      throw new Error(`Could not find issue ${owner}/${repo}#${number}`)
    }

    logger.debug('Issue found:', {
      title: issue.title,
      state: issue.state,
      labels: issue.labels.nodes.length,
      comments: issue.comments.nodes.length
    })

    const contribution: IssueContribution = {
      type: 'issue',
      title: issue.title,
      body: issue.body,
      url: issue.url,
      updatedAt: issue.updatedAt,
      state: issue.state.toLowerCase() as 'open' | 'closed',
      labels: issue.labels.nodes.map((node: { name: string }) => node.name),
      comments: issue.comments.nodes.map((node: { body: string; author: { login: string } | null; createdAt: string }) => ({
        body: node.body,
        author: node.author?.login || 'unknown',
        createdAt: node.createdAt
      })),
      repository: {
        owner,
        name: repo
      },
      number
    }

    return contribution
  }
})
