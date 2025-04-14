import { graphql } from '@octokit/graphql'
import { env } from '../config.js'

export const graphqlWithAuth = graphql.defaults({
  headers: {
    authorization: `token ${env.github.token}`
  }
})
