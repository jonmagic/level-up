// GitHub API Service
// Provides a flexible interface for interacting with GitHub's GraphQL and REST APIs
// Handles authentication, rate limiting, and error handling

import { Octokit } from '@octokit/rest'
import { graphql } from '@octokit/graphql'
import { env } from '../config.js'
import { logger } from './logger.js'

// Creates an authenticated Octokit instance for REST API calls
export const octokit = new Octokit({
  auth: env.github.token
})

// Creates and exports an authenticated GraphQL client
// Uses the GitHub token from environment configuration for API authentication
export const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${env.github.token}`
  }
})

// Represents GitHub API rate limit information
export interface RateLimitInfo {
  // Number of requests remaining in the current rate limit window
  remaining: number
  // ISO timestamp when the rate limit will reset
  resetAt: string
}

// Represents a standard GitHub API response structure
export interface GitHubResponse {
  // Rate limit information for the current request
  rateLimit: RateLimitInfo
  // Response data returned by the query
  data: Record<string, any>
  // Response headers containing rate limit information
  headers?: Record<string, string>
}

// Tracks the last request time to implement request throttling
let lastRequestTime = 0

// Default rate limit state
let rateLimit: RateLimitInfo = {
  remaining: 5000,
  resetAt: new Date(Date.now() + 3600000).toISOString()
}

// Executes a GraphQL query against the GitHub API with rate limiting and error handling
//
// @param query - The GraphQL query string to execute
// @param variables - Variables to pass to the GraphQL query
// @returns Promise resolving to the query response
// @throws Error if the API request fails
//
// @example
// const result = await executeQuery<GitHubResponse>(`
//   query($owner: String!, $repo: String!) {
//     repository(owner: $owner, name: $repo) {
//       name
//       description
//     }
//   }
// `, { owner: "owner", repo: "repo" })
export async function executeQuery<T extends GitHubResponse>(query: string, variables: Record<string, any>): Promise<T> {
  // Ensure minimum delay between requests
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < 2000) {
    await new Promise(resolve => setTimeout(resolve, 2000 - timeSinceLastRequest))
  }

  // Check rate limit
  if (rateLimit.remaining <= 0) {
    const resetTime = new Date(rateLimit.resetAt).getTime()
    if (now < resetTime) {
      const waitTime = resetTime - now
      logger.debug(`Rate limit reached. Waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    rateLimit.remaining = 5000
    rateLimit.resetAt = new Date(now + 3600000).toISOString()
  }

  try {
    const result = await graphqlWithAuth(query, variables) as T

    // Update rate limit info from headers
    const headers = result.headers || {}
    rateLimit = {
      remaining: parseInt(headers['x-ratelimit-remaining'] || '5000', 10),
      resetAt: new Date(parseInt(headers['x-ratelimit-reset'] || '0', 10) * 1000).toISOString()
    }
    lastRequestTime = Date.now()

    // logger.debug('\nGitHub API Response:', JSON.stringify(result, null, 2))
    return result
  } catch (error) {
    logger.error('GitHub API request failed:', error)
    if (error instanceof Error) {
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    }
    throw error
  }
}
