// GitHub API Service
// Configures and exports an authenticated GraphQL client for GitHub API interactions
// Uses the GitHub token from environment configuration for authentication

import { graphql } from '@octokit/graphql'
import { env } from '../config.js'

// Creates and exports an authenticated GraphQL client
// Uses the GitHub token from environment configuration for API authentication
export const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${env.github.token}`
  }
})
