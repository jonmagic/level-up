// Main entry point for the Peer Feedback Application
// This application analyzes GitHub contributions and provides feedback on their quality
// and adherence to best practices.

import { searchAgent } from './agents/search.js'
import { contributionAnalyzerAgent } from './agents/contribution-analyzer.js'
import { SearchContributionsResult } from './tools/search-contributions.js'
import { logger } from './services/logger.js'

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
  const searchResult = await searchAgent.run(`Use the search_contributions tool with these parameters:
- organization: ${organization}
- author: ${user}
- since: ${startDate}
- until: ${endDate}
- limit: 3`)

  // Extract contributions from search result
  let contributions: Array<{ title: string; url: string }> = []
  for (const toolCall of searchResult.toolCalls) {
    if (toolCall.role === 'tool_result' && toolCall.content) {
      try {
        const { data } = toolCall.content as { data: SearchContributionsResult }
        logger.info(data.summary)

        // Combine all contribution types into a single array
        contributions = [
          ...data.issues.map(issue => ({ title: issue.title, url: issue.url })),
          ...data.pull_requests.map(pr => ({ title: pr.title, url: pr.url })),
          ...data.discussions.map(discussion => ({ title: discussion.title, url: discussion.url }))
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
    logger.info(`\nAnalyzing contribution ${index + 1}/${contributions.length}:`)
    logger.info(`Title: ${contribution.title}`)
    logger.info(`URL: ${contribution.url}`)

    try {
      const analysisResult = await contributionAnalyzerAgent.run(`Please analyze this GitHub contribution:

Title: ${contribution.title}
URL: ${contribution.url}
User: ${user}
Organization: ${organization}

Provide detailed feedback on the user's role and impact in this contribution. Consider:
- Their specific role in this contribution (author, reviewer, commenter, etc.)
- The quality and effectiveness of their contribution
- How their work aligns with project goals
- Areas for improvement and growth

Focus on providing role-specific feedback and actionable suggestions.`)

      logger.info('\nAnalysis Results:')
      logger.info('----------------')

      // Print analysis results
      for (const message of analysisResult.output) {
        if (message.role === 'assistant' && 'content' in message && message.content) {
          const content = typeof message.content === 'string'
            ? message.content
            : message.content.map(c => c.text).join('')
          logger.info(content)
        }
      }
    } catch (error) {
      logger.error(`Error analyzing contribution "${contribution.title}":`, error as Error)
      logger.debug('Contribution details:', contribution)
    }
  }

  logger.info('\nContribution analysis complete!')
}

// Execute main function and handle any uncaught errors
main().catch(error => {
  logger.error('Application error:', error)
  process.exit(1)
})
