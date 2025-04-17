import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchDiscussion } from '../../src/tools/fetch-discussion.js'
import { executeQuery, GitHubResponse } from '../../src/services/github.js'
import { DiscussionContribution } from '../../src/types/contributions.js'

// Create mock instances
const mockCache = {
  get: vi.fn(),
  set: vi.fn()
}

// Mock setup
vi.mock('../../src/services/github', () => ({
  executeQuery: vi.fn(),
  GitHubResponse: {}
}))

vi.mock('../../src/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../src/services/contribution-cache', () => ({
  ContributionCacheService: {
    getInstance: vi.fn(() => mockCache)
  }
}))

vi.mock('../../src/services/analysis-cache', () => ({
  AnalysisCacheService: {
    getInstance: vi.fn(() => ({
      clear: vi.fn()
    }))
  }
}))

// Tests for the fetchDiscussion function
// Covers:
// - Basic fetch functionality
// - Cache hit/miss behavior
// - Error handling
// - Data transformation
describe('fetchDiscussion', () => {
  let context: ReturnType<typeof createTestContext>

  beforeEach(() => {
    vi.clearAllMocks()
    context = createTestContext()
  })

  it('should return cached data when available', async () => {
    const mockCachedData = createMockDiscussionContribution()
    mockCache.get.mockResolvedValue({ data: mockCachedData })

    const result = await fetchDiscussion.handler({
      owner: 'test-owner',
      repo: 'test-repo',
      number: 123,
      updatedAt: '2024-04-17T00:00:00Z'
    }, context)

    expect(result).toEqual(mockCachedData)
    expect(mockCache.get).toHaveBeenCalledWith(
      'test-owner',
      'test-repo',
      'discussion',
      123,
      '2024-04-17T00:00:00Z'
    )
    expect(executeQuery).not.toHaveBeenCalled()
  })

  it('should fetch and transform discussion data when not cached', async () => {
    const mockResponse = createMockDiscussionResponse()
    mockCache.get.mockResolvedValue(null)
    ;(executeQuery as any).mockResolvedValue(mockResponse)

    const result = await fetchDiscussion.handler({
      owner: 'test-owner',
      repo: 'test-repo',
      number: 123,
      updatedAt: '2024-04-17T00:00:00Z'
    }, context)

    expect(result).toEqual(createExpectedDiscussionContribution())
    expect(mockCache.set).toHaveBeenCalledWith(
      'test-owner',
      'test-repo',
      'discussion',
      123,
      createExpectedDiscussionContribution()
    )
  })

  it('should throw error when discussion is not found', async () => {
    const mockResponse = createMockErrorResponse()
    mockCache.get.mockResolvedValue(null)
    ;(executeQuery as any).mockResolvedValue(mockResponse)

    await expect(
      fetchDiscussion.handler({
        owner: 'test-owner',
        repo: 'test-repo',
        number: 123,
        updatedAt: '2024-04-17T00:00:00Z'
      }, context)
    ).rejects.toThrow('Could not find discussion test-owner/test-repo#123')
  })
})

// Helper functions for creating test data
function createBaseGitHubResponse(): GitHubResponse {
  return {
    data: {},
    rateLimit: {
      remaining: 5000,
      resetAt: '2024-04-17T00:00:00Z'
    }
  }
}

interface DiscussionResponse extends GitHubResponse {
  repository: {
    discussion: {
      title: string
      body: string
      url: string
      updatedAt: string
      state: string
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
    } | null
  }
}

function createMockDiscussionResponse(): DiscussionResponse {
  return {
    ...createBaseGitHubResponse(),
    repository: {
      discussion: {
        title: 'Test Discussion',
        body: 'Discussion body',
        url: 'https://github.com/test-owner/test-repo/discussions/123',
        updatedAt: '2024-04-17T00:00:00Z',
        state: 'OPEN',
        category: {
          name: 'General'
        },
        isAnswered: true,
        answer: {
          body: 'Answer body',
          author: {
            login: 'answer-author'
          },
          createdAt: '2024-04-16T00:00:00Z',
          replies: {
            nodes: [
              {
                body: 'Reply body',
                author: {
                  login: 'reply-author'
                },
                createdAt: '2024-04-16T01:00:00Z'
              }
            ]
          }
        },
        comments: {
          nodes: [
            {
              body: 'Comment body',
              author: {
                login: 'comment-author'
              },
              createdAt: '2024-04-15T00:00:00Z'
            }
          ]
        },
        labels: {
          nodes: [
            {
              name: 'bug'
            },
            {
              name: 'help wanted'
            }
          ]
        }
      }
    }
  }
}

function createMockErrorResponse(): DiscussionResponse {
  return {
    ...createBaseGitHubResponse(),
    repository: {
      discussion: null
    }
  }
}

function createMockDiscussionContribution(): DiscussionContribution {
  return {
    type: 'discussion',
    title: 'Test Discussion',
    body: 'Discussion body',
    url: 'https://github.com/test-owner/test-repo/discussions/123',
    updatedAt: '2024-04-17T00:00:00Z',
    state: 'open',
    category: 'General',
    isAnswered: true,
    answer: {
      body: 'Answer body',
      author: 'answer-author',
      createdAt: '2024-04-16T00:00:00Z',
      replies: [
        {
          body: 'Reply body',
          author: 'reply-author',
          createdAt: '2024-04-16T01:00:00Z'
        }
      ]
    },
    answers: [
      {
        body: 'Answer body',
        author: 'answer-author',
        createdAt: '2024-04-16T00:00:00Z',
        replies: [
          {
            body: 'Reply body',
            author: 'reply-author',
            createdAt: '2024-04-16T01:00:00Z'
          }
        ]
      }
    ],
    comments: [
      {
        body: 'Comment body',
        author: 'comment-author',
        createdAt: '2024-04-15T00:00:00Z'
      }
    ],
    labels: ['bug', 'help wanted'],
    repository: {
      owner: 'test-owner',
      name: 'test-repo'
    },
    number: 123
  }
}

function createExpectedDiscussionContribution(): DiscussionContribution {
  return createMockDiscussionContribution()
}

// Test context
function createTestContext() {
  return {
    agent: {} as any,
    network: {} as any
  }
}
