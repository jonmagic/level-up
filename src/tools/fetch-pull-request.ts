// Tool for fetching detailed information about a GitHub pull request
// Uses GitHub's GraphQL API to fetch PR data including comments, and reviews

import { createTool } from '@inngest/agent-kit'
import { z } from 'zod'
import { executeQuery, GitHubResponse } from '../services/github.js'
import { PullRequestContribution } from '../types/contributions.js'
import { logger } from '../services/logger.js'

// Schema for validating fetch pull request parameters
const FetchPullRequestSchema = z.object({
  owner: z.string().describe('Owner of the repository'),
  repo: z.string().describe('Name of the repository'),
  number: z.number().describe('Pull request number')
})

export type FetchPullRequestInput = z.infer<typeof FetchPullRequestSchema>

interface PullRequestResponse extends GitHubResponse {
  repository: {
    pullRequest: {
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
      reviews: {
        nodes: Array<{
          body: string
          author: {
            login: string
          } | null
          createdAt: string
          state: string
        }>
      }
    }
  }
}

export const fetchPullRequest = createTool({
  name: 'fetch_pull_request',
  description: 'Fetch detailed information about a GitHub Pull Request',
  parameters: FetchPullRequestSchema,
  handler: async (params: FetchPullRequestInput): Promise<PullRequestContribution> => {
    const { owner, repo, number } = params

    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            title
            body
            url
            updatedAt
            state
            comments(first: 100) {
              nodes {
                body
                author {
                  login
                }
                createdAt
              }
            }
            reviews(first: 100) {
              nodes {
                body
                author {
                  login
                }
                state
                createdAt
                comments(first: 100) {
                  nodes {
                    body
                    path
                    line
                  }
                }
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

    logger.debug('Fetching pull request:', { owner, repo, number })

    const result = await executeQuery<PullRequestResponse>(query, {
      owner,
      repo,
      number
    })

    const pr = result.repository.pullRequest
    if (!pr) {
      logger.error('Pull request not found:', { owner, repo, number })
      throw new Error(`Could not find pull request ${owner}/${repo}#${number}`)
    }

    logger.debug('Pull request found:', {
      title: pr.title,
      state: pr.state,
      comments: pr.comments.nodes.length,
      reviews: pr.reviews.nodes.length
    })

    const contribution: PullRequestContribution = {
      type: 'pull',
      title: pr.title,
      body: pr.body,
      url: pr.url,
      updatedAt: pr.updatedAt,
      state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
      comments: pr.comments.nodes.map((node: { body: string; author: { login: string } | null; createdAt: string }) => ({
        body: node.body,
        author: node.author?.login || 'unknown',
        createdAt: node.createdAt
      })),
      reviews: pr.reviews.nodes.map((node: { body: string; author: { login: string } | null; createdAt: string; state: string }) => ({
        body: node.body,
        author: node.author?.login || 'unknown',
        createdAt: node.createdAt,
        state: node.state,
        comments: []
      })),
      files: [],
      repository: {
        owner,
        name: repo
      },
      number
    }

    return contribution
  }
})
