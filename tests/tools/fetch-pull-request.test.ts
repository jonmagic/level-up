import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPullRequest } from '../../src/tools/fetch-pull-request.js'
import { executeQuery } from '../../src/services/github.js'
import { octokit } from '../../src/services/github.js'
import { GitHubResponse } from '../../src/services/github.js'
import { PullRequestContribution } from '../../src/types/contributions.js'

// Create mock instances
const mockCache = {
  get: vi.fn(),
  set: vi.fn()
}

// Mock setup
vi.mock('../../src/services/github', () => ({
  executeQuery: vi.fn(),
  octokit: {
    pulls: {
      listCommits: vi.fn()
    },
    repos: {
      getCommit: vi.fn()
    }
  }
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

// Tests for the fetchPullRequest function
// Covers:
// - Basic fetch functionality
// - Error handling
// - Cache usage
describe('fetchPullRequest', () => {
  let context: ReturnType<typeof createTestContext>

  beforeEach(() => {
    vi.clearAllMocks()
    context = createTestContext()
  })

  describe('when fetching a pull request', () => {
    it('should return pull request data when found', async () => {
      mockCache.get.mockResolvedValue(null)
      vi.mocked(executeQuery).mockResolvedValue(createMockPullRequestResponse())
      vi.mocked(octokit.pulls.listCommits).mockResolvedValue(createMockCommitsResponse() as any)
      vi.mocked(octokit.repos.getCommit).mockResolvedValue(createMockCommitDiffResponse() as any)

      const result = await fetchPullRequest.handler(mockInput, context)

      expect(result).toEqual(expectedPullRequestResult)
    })

    it('should throw error when pull request not found', async () => {
      mockCache.get.mockResolvedValue(null)
      vi.mocked(executeQuery).mockResolvedValue(createMockErrorResponse())

      await expect(fetchPullRequest.handler(mockInput, context)).rejects.toThrow(
        `Could not find pull request ${TEST_OWNER}/${TEST_REPO}#${TEST_PR_NUMBER}`
      )
    })
  })

  describe('when using cache', () => {
    it('should use cached data when available', async () => {
      mockCache.get.mockResolvedValue({
        data: mockCachedData,
        updatedAt: TEST_DATE,
        cachedAt: TEST_DATE
      })

      const result = await fetchPullRequest.handler(mockInput, context)

      expect(result).toEqual(mockCachedData)
      expect(executeQuery).not.toHaveBeenCalled()
    })
  })
})

// Test constants
const TEST_OWNER = 'test-owner'
const TEST_REPO = 'test-repo'
const TEST_PR_NUMBER = 123
const TEST_DATE = '2024-04-17T00:00:00Z'

// Test data builders
function createBaseGitHubResponse(): GitHubResponse {
  return {
    rateLimit: {
      remaining: 5000,
      resetAt: new Date(Date.now() + 3600000).toISOString()
    },
    headers: {
      'x-ratelimit-remaining': '5000',
      'x-ratelimit-reset': Math.floor(Date.now() / 1000).toString()
    }
  } as unknown as GitHubResponse
}

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
          comments: {
            nodes: Array<{
              body: string
              path: string
              line: number
            }>
          }
        }>
      }
    }
  }
}

function createMockPullRequestResponse(): PullRequestResponse {
  return {
    ...createBaseGitHubResponse(),
    repository: {
      pullRequest: {
        title: 'Test PR',
        body: 'Test PR body',
        url: `https://github.com/${TEST_OWNER}/${TEST_REPO}/pull/${TEST_PR_NUMBER}`,
        updatedAt: TEST_DATE,
        state: 'OPEN',
        labels: {
          nodes: []
        },
        comments: {
          nodes: [
            {
              body: 'Test comment',
              author: { login: 'test-user' },
              createdAt: TEST_DATE
            }
          ]
        },
        reviews: {
          nodes: [
            {
              body: 'Test review',
              author: { login: 'test-reviewer' },
              createdAt: TEST_DATE,
              state: 'APPROVED',
              comments: {
                nodes: []
              }
            }
          ]
        }
      }
    }
  } as unknown as PullRequestResponse
}

function createMockErrorResponse(): PullRequestResponse {
  return {
    ...createBaseGitHubResponse(),
    repository: { pullRequest: null }
  } as unknown as PullRequestResponse
}

function createMockCommitsResponse() {
  return {
    data: [
      {
        sha: 'abc123',
        commit: {
          message: 'Test commit',
          author: {
            name: 'Test Author',
            date: TEST_DATE
          }
        },
        author: {
          login: 'test-author'
        }
      }
    ]
  }
}

function createMockCommitDiffResponse() {
  return {
    data: {
      files: [
        {
          filename: 'test.txt',
          additions: 1,
          deletions: 0,
          patch: '@@ -0,0 +1 @@\n+test'
        }
      ]
    }
  }
}

// Test input/output fixtures
const mockInput = {
  owner: TEST_OWNER,
  repo: TEST_REPO,
  number: TEST_PR_NUMBER,
  updatedAt: TEST_DATE
}

const expectedPullRequestResult: PullRequestContribution = {
  type: 'pull',
  title: 'Test PR',
  body: 'Test PR body',
  url: `https://github.com/${TEST_OWNER}/${TEST_REPO}/pull/${TEST_PR_NUMBER}`,
  updatedAt: TEST_DATE,
  state: 'open',
  comments: [
    {
      body: 'Test comment',
      author: 'test-user',
      createdAt: TEST_DATE
    }
  ],
  reviews: [
    {
      body: 'Test review',
      author: 'test-reviewer',
      createdAt: TEST_DATE,
      state: 'APPROVED',
      comments: []
    }
  ],
  files: [],
  commits: [
    {
      message: 'Test commit',
      oid: 'abc123',
      author: 'test-author',
      createdAt: TEST_DATE,
      changedFiles: [
        {
          path: 'test.txt',
          additions: 1,
          deletions: 0,
          patch: '@@ -0,0 +1 @@\n+test'
        }
      ]
    }
  ],
  repository: {
    owner: TEST_OWNER,
    name: TEST_REPO
  },
  number: TEST_PR_NUMBER
}

const mockCachedData: PullRequestContribution = {
  type: 'pull',
  title: 'Cached PR',
  body: 'Cached PR body',
  url: `https://github.com/${TEST_OWNER}/${TEST_REPO}/pull/${TEST_PR_NUMBER}`,
  updatedAt: TEST_DATE,
  state: 'open',
  comments: [],
  reviews: [],
  files: [],
  commits: [],
  repository: {
    owner: TEST_OWNER,
    name: TEST_REPO
  },
  number: TEST_PR_NUMBER
}

// Test context
function createTestContext() {
  return {
    agent: {} as any,
    network: {} as any
  }
}
