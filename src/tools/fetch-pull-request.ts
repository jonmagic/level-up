// Tool for fetching detailed information about a GitHub pull request
// Uses GitHub's GraphQL API to fetch PR data including comments, and reviews

import { createTool } from '@inngest/agent-kit'
import { z } from 'zod'
import { executeQuery, GitHubResponse } from '../services/github.js'
import { PullRequestContribution } from '../types/contributions.js'
import { logger } from '../services/logger.js'
import { AnalysisCacheService } from '../services/analysis-cache.js'
import { octokit } from '../services/github.js'
import { ConversationCacheService } from '../services/conversation-cache.js'

// Schema for validating fetch pull request parameters
const FetchPullRequestSchema = z.object({
  owner: z.string().describe('Owner of the repository'),
  repo: z.string().describe('Name of the repository'),
  number: z.number().describe('Pull request number'),
  updatedAt: z.string().describe('Last updated timestamp from search results')
})

export type FetchPullRequestInput = z.infer<typeof FetchPullRequestSchema>

interface PullRequestResponse extends GitHubResponse {
  repository: {
    pullRequest: {
      title: string
      author: {
        login: string
      }
      body: string
      url: string
      updatedAt: string
      createdAt: string
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
    const { owner, repo, number, updatedAt } = params

    // Check cache first
    const cache = ConversationCacheService.getInstance()
    const cached = await cache.get<PullRequestContribution>(owner, repo, 'pull', number, updatedAt)
    if (cached) {
      logger.debug('Cache hit for pull request:', { owner, repo, number, updatedAt })
      return cached.data
    }
    logger.debug('Cache miss for pull request:', { owner, repo, number, updatedAt })

    // Clear analysis cache since we're fetching fresh data
    const analysisCache = AnalysisCacheService.getInstance()
    await analysisCache.clearContribution(owner, repo, 'pull', number)
    logger.debug('Cleared analysis cache for pull request:', { owner, repo, number })

    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            title
            author {
              login
            }
            body
            url
            updatedAt
            createdAt
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

    // Fetch commits using REST API
    const commitsResponse = await octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: number,
      per_page: 100
    })

    const commits = await Promise.all(commitsResponse.data.map(async (commit) => {
      // Get the diff for each commit
      const diffResponse = await octokit.repos.getCommit({
        owner,
        repo,
        ref: commit.sha
      })

      return {
        message: commit.commit.message,
        oid: commit.sha,
        author: commit.author?.login || commit.commit.author?.name || 'unknown',
        createdAt: commit.commit.author?.date || commit.commit.committer?.date || new Date().toISOString(),
        changedFiles: diffResponse.data.files?.map(file => ({
          path: file.filename,
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch
        })) || []
      }
    }))

    const contribution: PullRequestContribution = {
      type: 'pull_request',
      title: pr.title,
      author: pr.author.login,
      body: pr.body,
      url: pr.url,
      updatedAt: pr.updatedAt,
      createdAt: pr.createdAt,
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
      commits,
      repository: {
        owner,
        name: repo
      },
      number
    }

    // Cache the result
    await cache.set(owner, repo, 'pull', number, contribution)
    logger.debug('Cached pull request data:', { owner, repo, number, updatedAt })

    return contribution
  }
})
