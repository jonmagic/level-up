import { searchAgent } from './agents/search.js'
import { analyzerAgent } from './agents/analyzer.js'
import { SearchContributionsResult } from './tools/search-contributions.js'
import { logger } from './services/logger.js'

async function main() {
  logger.info('Peer Feedback Application')

  const thirtyDaysAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Step 1: Search contributions
  logger.info('Searching Contributions...')
  const searchResult = await searchAgent.run(`Use the search_contributions tool with these parameters:
- organization: open-truss
- author: jonmagic
- since: ${thirtyDaysAgo}
- until: ${now}`)

  // Extract contributions from search result
  let contributions: Array<{ title: string; url: string }> = []
  for (const toolCall of searchResult.toolCalls) {
    if (toolCall.role === 'tool_result' && toolCall.content) {
      try {
        const { data } = toolCall.content as { data: SearchContributionsResult }
        logger.info(data.summary)

        // Combine all contribution types
        contributions = [
          ...data.issues.map(issue => ({ title: issue.title, url: issue.url })),
          ...data.pull_requests.map(pr => ({ title: pr.title, url: pr.url })),
          ...data.discussions.map(discussion => ({ title: discussion.title, url: discussion.url }))
        ]

        if (contributions.length > 0) {
          logger.info('Found Contributions:')
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

  // Step 2: Analyze contributions
  logger.info('Analyzing Contributions...')
  const analysisResult = await analyzerAgent.run(`Please analyze these GitHub contribution titles:

${contributions.map(contribution => `- ${contribution.title}`).join('\n')}

Provide detailed feedback on their clarity, best practices, and consistency.`)

  logger.info('Analysis Results:')
  logger.info('----------------')

  // Print analysis
  for (const message of analysisResult.output) {
    if (message.role === 'assistant' && 'content' in message && message.content) {
      const content = typeof message.content === 'string'
        ? message.content
        : message.content.map(c => c.text).join('')
      logger.info(content)
    }
  }
}

main().catch(error => logger.error('Application error:', error))
