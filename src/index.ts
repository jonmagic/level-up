// Main entry point for the Peer Feedback Application
// This application analyzes GitHub contributions and provides feedback on their quality
// and adherence to best practices.

import { searchAgent } from './agents/search.js'
import { contributionAnalyzerAgent } from './agents/contribution-analyzer.js'
import { fetcherAgent } from './agents/fetcher.js'
import { SearchContributionsResult } from './tools/search-contributions.js'
import { logger } from './services/logger.js'

// Helper function to extract repository and number from GitHub URL
function extractRepoInfo(url: string): { owner: string; name: string; number: number } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(issues|pull|discussions)\/(\d+)/)
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`)
  }
  return {
    owner: match[1],
    name: match[2],
    number: parseInt(match[4], 10)
  }
}

// Main application function that orchestrates the contribution analysis process
// 1. Searches for recent GitHub contributions
// 2. Extracts relevant contribution data
// 3. Analyzes each contribution individually using AI
// 4. Outputs detailed feedback for each contribution
async function main() {
  logger.info('Starting Peer Feedback Application')
  logger.debug('Initializing contribution analysis process')

  // Configuration
  const organization = 'open-truss'
  const user = 'jonmagic'
  const daysToAnalyze = 730 // 2 years

  // Calculate date range for contribution search
  const startDate = new Date(Date.now() - daysToAnalyze * 24 * 60 * 60 * 1000).toISOString()
  const endDate = new Date().toISOString()
  logger.debug(`Searching contributions between ${startDate} and ${endDate}`)

  // Step 1: Search contributions using the search agent
  logger.info(`Searching for recent contributions by ${user}...`)
  let searchResult
  try {
    searchResult = await searchAgent.run(`Use the search_contributions tool with these parameters:
- organization: ${organization}
- author: ${user}
- since: ${startDate}
- until: ${endDate}
- limit: 3`)
  } catch (error) {
    logger.error('Failed to search for contributions:', error as Error)
    return
  }

  // Extract contributions from search result
  let contributions: Array<{ title: string; url: string; type: 'issue' | 'pull' | 'discussion'; number: number; repository: { owner: string; name: string }; updatedAt: string }> = []
  for (const toolCall of searchResult.toolCalls) {
    if (toolCall.role === 'tool_result' && toolCall.content) {
      try {
        const { data } = toolCall.content as { data: SearchContributionsResult }

        // Combine all contribution types into a single array with type information
        contributions = [
          ...data.issues.map(issue => {
            const { owner, name, number } = extractRepoInfo(issue.url)
            return {
              title: issue.title,
              url: issue.url,
              type: 'issue' as const,
              number,
              repository: { owner, name },
              updatedAt: issue.updated_at
            }
          }),
          ...data.pull_requests.map(pr => {
            const { owner, name, number } = extractRepoInfo(pr.url)
            return {
              title: pr.title,
              url: pr.url,
              type: 'pull' as const,
              number,
              repository: { owner, name },
              updatedAt: pr.updated_at
            }
          }),
          ...data.discussions.map(discussion => {
            const { owner, name, number } = extractRepoInfo(discussion.url)
            return {
              title: discussion.title,
              url: discussion.url,
              type: 'discussion' as const,
              number,
              repository: { owner, name },
              updatedAt: discussion.updated_at
            }
          })
        ]

        if (contributions.length > 0) {
          logger.info(`Found ${contributions.length} contributions to analyze:`)
          for (const contribution of contributions) {
            logger.info(`- ${contribution.title} (${contribution.url})`)
          }
        }
      } catch (error) {
        logger.error('Error processing tool result:', error as Error)
        logger.debug('Raw tool result: ' + JSON.stringify(toolCall.content, null, 2))
      }
    }
  }

  if (contributions.length === 0) {
    logger.info('No contributions found to analyze.')
    return
  }

  // Step 2: Analyze each contribution individually
  logger.info('Starting individual contribution analysis...')
  logger.debug(`Processing ${contributions.length} contributions sequentially`)

  for (const [index, contribution] of contributions.entries()) {
    logger.info(`Analyzing contribution ${index + 1}/${contributions.length}:`)
    logger.info(`Title: ${contribution.title}`)
    logger.info(`URL: ${contribution.url}`)
    logger.debug(`Type: ${contribution.type}`)
    logger.debug(`Repository: ${contribution.repository.owner}/${contribution.repository.name}`)
    logger.debug(`Number: ${contribution.number}`)

    let fetcherResult
    try {
      // Use the fetcher agent to get detailed contribution data
      const fetchPrompt = `Fetch the contribution at ${contribution.url} with updatedAt ${contribution.updatedAt}`
      logger.debug('\nFetch Prompt:', fetchPrompt)
      fetcherResult = await fetcherAgent.run(fetchPrompt)
    } catch (error) {
      logger.error(`Failed to fetch contribution "${contribution.title}":`, error as Error)
      logger.error('Error details:', JSON.stringify(error, null, 2))
      continue
    }

    // Extract the contribution data from the tool result
    let detailedContribution
    for (const toolCall of fetcherResult.toolCalls) {
      logger.debug('Tool call:', JSON.stringify(toolCall, null, 2))
      if (toolCall.role === 'tool_result' && toolCall.content) {
        detailedContribution = toolCall.content
        logger.debug('Found detailed contribution:', JSON.stringify(detailedContribution, null, 2))
        break
      }
    }

    if (!detailedContribution) {
      logger.error(`Failed to extract details for ${contribution.type} ${contribution.number}`)
      logger.error('Tool calls:', JSON.stringify(fetcherResult.toolCalls, null, 2))
      continue
    }

    // Format contribution data for analysis
    const contributionData = JSON.stringify(detailedContribution, null, 2)

    let analysis
    try {
      // Analyze the contribution using our detailed analyzer
      analysis = await contributionAnalyzerAgent.run(contributionData)
    } catch (error) {
      logger.error(`Failed to analyze contribution "${contribution.title}":`, error as Error)
      continue
    }

    logger.info('Analysis Results:')
    logger.info('----------------')
    const lastMessage = analysis?.output?.[analysis.output.length - 1]
    if (lastMessage?.type === 'text' && lastMessage?.content) {
      logger.info('\n' +lastMessage.content)
    }
  }

  logger.info('Contribution analysis complete!')
}

// Execute main function and handle any uncaught errors
main().catch(error => {
  logger.error('Application error:', error)
  process.exit(1)
})
