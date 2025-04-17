import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchContributions } from '../../src/tools/search-contributions.js'
import { executeQuery } from '../../src/services/github.js'
import { GitHubResponse } from '../../src/services/github.js'

// Mock setup
vi.mock('../../src/services/github', () => ({
  executeQuery: vi.fn()
}))

vi.mock('../../src/services/logger', () => ({
  logger: {
    debug: vi.fn()
  }
}))

// Tests for the searchContributions function
// Covers:
// - Basic search functionality
// - Error handling
// - Pagination
describe('searchContributions', () => {
  let context: ReturnType<typeof createTestContext>

  beforeEach(() => {
    vi.clearAllMocks()
    context = createTestContext()
    vi.mocked(executeQuery).mockImplementation(async (query: string) => {
      return query.includes('type: ISSUE')
        ? createMockIssueResponse()
        : createMockDiscussionResponse()
    })
  })

  describe('when searching with valid input', () => {
    it('should return contributions with correct structure', async () => {
      const result = await searchContributions.handler(mockSearchInput, context)

      expect(result).toEqual({
        ...expectedSearchResult,
        summary: expect.stringContaining(expectedSearchResult.summary)
      })
    })

    it('should respect the limit parameter', async () => {
      const result = await searchContributions.handler(
        { ...mockSearchInput, limit: 1 },
        context
      )

      expect(vi.mocked(executeQuery)).toHaveBeenCalledTimes(2)
      expect(result.issues.length).toBeLessThanOrEqual(1)
      expect(result.discussions.length).toBeLessThanOrEqual(1)
    })
  })

  describe('when searching with no results', () => {
    it('should handle empty results gracefully', async () => {
      vi.mocked(executeQuery).mockImplementation(async () => createMockEmptyResponse())

      const result = await searchContributions.handler(mockSearchInput, context)

      expect(result).toEqual({
        ...expectedEmptyResult,
        summary: expect.stringContaining(expectedEmptyResult.summary)
      })
    })
  })
})

// Test constants
const TEST_USER = 'testuser'
const TEST_ORG = 'testorg'
const TEST_DATE_RANGE = {
  since: '2024-01-01',
  until: '2024-03-31'
}

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

function createMockIssueResponse(): GitHubResponse {
  return {
    ...createBaseGitHubResponse(),
    search: {
      nodes: [
        {
          title: 'Test Issue',
          url: 'https://github.com/testorg/repo/issues/1',
          createdAt: '2024-02-01T00:00:00Z',
          updatedAt: '2024-02-02T00:00:00Z',
          __typename: 'Issue'
        }
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  } as unknown as GitHubResponse
}

function createMockDiscussionResponse(): GitHubResponse {
  return {
    ...createBaseGitHubResponse(),
    search: {
      nodes: [
        {
          title: 'Test Discussion',
          url: 'https://github.com/testorg/repo/discussions/1',
          createdAt: '2024-02-15T00:00:00Z',
          updatedAt: '2024-02-16T00:00:00Z',
          __typename: 'Discussion'
        }
      ],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  } as unknown as GitHubResponse
}

function createMockEmptyResponse(): GitHubResponse {
  return {
    ...createBaseGitHubResponse(),
    search: {
      nodes: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      }
    }
  } as unknown as GitHubResponse
}

// Test context
function createTestContext() {
  return {
    agent: {} as any,
    network: {} as any
  }
}

// Test input/output fixtures
const mockSearchInput = {
  author: TEST_USER,
  ...TEST_DATE_RANGE,
  organization: TEST_ORG,
  limit: 10
}

const expectedSearchResult = {
  issues: [
    {
      title: 'Test Issue',
      url: 'https://github.com/testorg/repo/issues/1',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-02T00:00:00Z'
    }
  ],
  pull_requests: [],
  discussions: [
    {
      title: 'Test Discussion',
      url: 'https://github.com/testorg/repo/discussions/1',
      created_at: '2024-02-15T00:00:00Z',
      updated_at: '2024-02-16T00:00:00Z'
    }
  ],
  summary: 'Found 1 issues, 0 pull requests, and 1 discussions'
}

const expectedEmptyResult = {
  issues: [],
  pull_requests: [],
  discussions: [],
  summary: 'Found 0 issues, 0 pull requests, and 0 discussions'
}
