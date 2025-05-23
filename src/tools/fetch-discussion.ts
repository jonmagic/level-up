// Tool for fetching detailed information about a GitHub discussion
// Uses GitHub's GraphQL API to fetch discussion data including comments and answers

import { createTool } from '@inngest/agent-kit'
import { z } from 'zod'
import { executeQuery, GitHubResponse } from '../services/github.js'
import { DiscussionContribution } from '../types/contributions.js'
import { logger } from '../services/logger.js'
import { ConversationCacheService } from '../services/conversation-cache.js'
import { AnalysisCacheService } from '../services/analysis-cache.js'

// Schema for validating fetch discussion parameters
const FetchDiscussionSchema = z.object({
  owner: z.string().describe('Owner of the repository'),
  repo: z.string().describe('Name of the repository'),
  number: z.number().describe('Discussion number'),
  updatedAt: z.string().describe('Last updated timestamp from search results')
})

export type FetchDiscussionInput = z.infer<typeof FetchDiscussionSchema>

interface DiscussionResponse extends GitHubResponse {
  repository: {
    discussion: {
      title: string
      author: {
        login: string
      }
      body: string
      url: string
      updatedAt: string
      createdAt: string
      category: {
        name: string
      }
      isAnswered: boolean
      answer: {
        body: string
        author: {
          login: string
        } | null
        createdAt: string
        replies: {
          nodes: Array<{
            body: string
            author: {
              login: string
            } | null
            createdAt: string
          }>
        }
      } | null
      comments: {
        nodes: Array<{
          body: string
          author: {
            login: string
          } | null
          createdAt: string
        }>
      }
      labels: {
        nodes: Array<{
          name: string
        }>
      }
    }
  }
}

export const fetchDiscussion = createTool({
  name: 'fetch_discussion',
  description: 'Fetch detailed information about a GitHub Discussion',
  parameters: FetchDiscussionSchema,
  handler: async (params: FetchDiscussionInput): Promise<DiscussionContribution> => {
    const { owner, repo, number, updatedAt } = params

    // Check cache first
    const cache = ConversationCacheService.getInstance()
    const cached = await cache.get<DiscussionContribution>(owner, repo, 'discussions', number, updatedAt)
    if (cached) {
      logger.debug('Cache hit for discussion:', { owner, repo, number, updatedAt })
      return cached.data
    }
    logger.debug('Cache miss for discussion:', { owner, repo, number, updatedAt })

    // Clear analysis cache since we're fetching fresh data
    const analysisCache = AnalysisCacheService.getInstance()
    await analysisCache.clearContribution(owner, repo, 'discussions', number)
    logger.debug('Cleared analysis cache for discussion:', { owner, repo, number })

    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) {
            title
            author {
              login
            }
            body
            url
            updatedAt
            createdAt
            category {
              name
            }
            isAnswered
            answer {
              body
              author {
                login
              }
              createdAt
              replies(first: 100) {
                nodes {
                  body
                  author {
                    login
                  }
                  createdAt
                }
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
            labels(first: 100) {
              nodes {
                name
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

    const result = await executeQuery<DiscussionResponse>(query, {
      owner,
      repo,
      number
    })

    const discussion = result.repository.discussion
    if (!discussion) {
      logger.error('Discussion not found:', { owner, repo, number })
      throw new Error(`Could not find discussion ${owner}/${repo}#${number}`)
    }

    logger.debug('Discussion found:', {
      title: discussion.title,
      comments: discussion.comments.nodes.length,
      answers: discussion.answer ? 1 : 0
    })

    const contribution: DiscussionContribution = {
      type: 'discussion',
      title: discussion.title,
      author: discussion.author.login,
      body: discussion.body,
      url: discussion.url,
      updatedAt: discussion.updatedAt,
      createdAt: discussion.createdAt,
      category: discussion.category.name,
      isAnswered: discussion.isAnswered,
      answer: discussion.answer ? {
        body: discussion.answer.body,
        author: discussion.answer.author?.login || 'unknown',
        createdAt: discussion.answer.createdAt,
        replies: discussion.answer.replies.nodes.map(reply => ({
          body: reply.body,
          author: reply.author?.login || 'unknown',
          createdAt: reply.createdAt
        }))
      } : undefined,
      answers: discussion.answer ? [{
        body: discussion.answer.body,
        author: discussion.answer.author?.login || 'unknown',
        createdAt: discussion.answer.createdAt,
        replies: discussion.answer.replies.nodes.map(reply => ({
          body: reply.body,
          author: reply.author?.login || 'unknown',
          createdAt: reply.createdAt
        }))
      }] : [],
      comments: discussion.comments.nodes.map(node => ({
        body: node.body,
        author: node.author?.login || 'unknown',
        createdAt: node.createdAt
      })),
      labels: discussion.labels.nodes.map(node => node.name),
      repository: {
        owner,
        name: repo
      },
      number
    }

    // Cache the result
    await cache.set(owner, repo, 'discussions', number, contribution)
    logger.debug('Cached discussion data:', { owner, repo, number, updatedAt })

    return contribution
  }
})
