/* eslint-disable @typescript-eslint/no-explicit-any */
// Tests for the fetchIssue function
// Covers:
// - Cache hit behavior
// - Fetch and transform issue data
// - Error handling when issue not found

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchIssue } from '../../src/tools/fetch-issue.js'
import { executeQuery, GitHubResponse } from '../../src/services/github.js'
import { IssueContribution } from '../../src/types/contributions.js'

// Create mock cache instance
const mockCache = {
  get: vi.fn(),
  set: vi.fn()
}

// Mock setup
vi.mock('../../src/services/github', () => ({
  executeQuery: vi.fn()
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
    getInstance: vi.fn(() => ({ clear: vi.fn() }))
  }
}))

describe('fetchIssue', () => {
  let context: ReturnType<typeof createTestContext>

  beforeEach(() => {
    vi.clearAllMocks()
    context = createTestContext()
  })

  it('should return cached data when available', async () => {
    const mockCachedData: IssueContribution = createExpectedIssueContribution()
    mockCache.get.mockResolvedValue({ data: mockCachedData, updatedAt: TEST_DATE, cachedAt: TEST_DATE })

    const result = await fetchIssue.handler(mockInput, context)

    expect(result).toEqual(mockCachedData)
    expect(executeQuery).not.toHaveBeenCalled()
  })

  it('should fetch and transform issue data when not cached', async () => {
    mockCache.get.mockResolvedValue(null)
    vi.mocked(executeQuery).mockResolvedValue(createMockIssueResponse())

    const result = await fetchIssue.handler(mockInput, context)

    expect(result).toEqual(createExpectedIssueContribution())
    expect(mockCache.set).toHaveBeenCalledWith(
      TEST_OWNER,
      TEST_REPO,
      'issue',
      TEST_ISSUE_NUMBER,
      createExpectedIssueContribution()
    )
  })

  it('should throw error when issue not found', async () => {
    mockCache.get.mockResolvedValue(null)
    vi.mocked(executeQuery).mockResolvedValue(createMockErrorResponse())

    await expect(fetchIssue.handler(mockInput, context)).rejects.toThrow(
      `Could not find issue ${TEST_OWNER}/${TEST_REPO}#${TEST_ISSUE_NUMBER}`
    )
  })
})

// Test constants
const TEST_OWNER = 'test-owner'
const TEST_REPO = 'test-repo'
const TEST_ISSUE_NUMBER = 456
const TEST_DATE = '2024-04-17T00:00:00Z'

// Test input fixture
const mockInput = {
  owner: TEST_OWNER,
  repo: TEST_REPO,
  number: TEST_ISSUE_NUMBER,
  updatedAt: TEST_DATE
}

// Test data builders
function createBaseGitHubResponse(): GitHubResponse {
  return {
    rateLimit: { remaining: 5000, resetAt: new Date(Date.now() + 3600000).toISOString() },
    data: {},
    headers: { 'x-ratelimit-remaining': '5000', 'x-ratelimit-reset': Math.floor(Date.now() / 1000).toString() }
  }
}

interface IssueResponse extends GitHubResponse {
  repository: {
    issue: {
      title: string
      body: string
      url: string
      updatedAt: string
      state: string
      labels: { nodes: Array<{ name: string }> }
      comments: { nodes: Array<{ body: string; author: { login: string } | null; createdAt: string }> }
    } | null
  }
}

function createMockIssueResponse(): IssueResponse {
  return {
    ...createBaseGitHubResponse(),
    repository: {
      issue: {
        title: 'Test Issue',
        body: 'Issue body',
        url: `https://github.com/${TEST_OWNER}/${TEST_REPO}/issues/${TEST_ISSUE_NUMBER}`,
        updatedAt: TEST_DATE,
        state: 'OPEN',
        labels: { nodes: [{ name: 'bug' }, { name: 'help wanted' }] },
        comments: { nodes: [ { body: 'Comment', author: { login: 'user1' }, createdAt: TEST_DATE } ] }
      }
    }
  }
}

function createMockErrorResponse(): IssueResponse {
  return {
    ...createBaseGitHubResponse(),
    repository: { issue: null }
  }
}

function createExpectedIssueContribution(): IssueContribution {
  return {
    type: 'issue',
    title: 'Test Issue',
    body: 'Issue body',
    url: `https://github.com/${TEST_OWNER}/${TEST_REPO}/issues/${TEST_ISSUE_NUMBER}`,
    updatedAt: TEST_DATE,
    state: 'open',
    labels: ['bug', 'help wanted'],
    comments: [{ body: 'Comment', author: 'user1', createdAt: TEST_DATE }],
    repository: { owner: TEST_OWNER, name: TEST_REPO },
    number: TEST_ISSUE_NUMBER
  }
}

// Test context helper
function createTestContext() {
  return { agent: {} as any, network: {} as any }
}
