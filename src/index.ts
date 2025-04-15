import { fetcherAgent } from './agents/fetcher.js'
import { analyzerAgent } from './agents/analyzer.js'
import { SearchIssuesResult } from './tools/search-issues.js'
import { logger } from './services/logger.js'

async function main() {
  logger.info('Peer Feedback Application')

  const thirtyDaysAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Step 1: Fetch issues
  logger.info('Fetching Issues...')
  const fetchResult = await fetcherAgent.run(`Use the search_issues tool with these parameters:
- author: jonmagic
- since: ${thirtyDaysAgo}
- until: ${now}`)

  // Extract issues from fetch result
  let issues: Array<{ title: string; url: string }> = []
  for (const toolCall of fetchResult.toolCalls) {
    if (toolCall.role === 'tool_result' && toolCall.content) {
      try {
        const { data } = toolCall.content as { data: SearchIssuesResult }
        logger.info(data.summary)
        issues = data.issues
        if (issues.length > 0) {
          logger.info('Found Issues:')
          for (const issue of issues) {
            logger.info(`- ${issue.title} (${issue.url})`)
          }
        }
      } catch (error) {
        logger.error('Error processing tool result:', error as Error)
        logger.debug('Raw tool result: ' + JSON.stringify(toolCall.content, null, 2))
      }
    }
  }

  if (issues.length === 0) {
    logger.info('No issues found to analyze.')
    return
  }

  // Step 2: Analyze issues
  logger.info('Analyzing Issues...')
  const analysisResult = await analyzerAgent.run(`Please analyze these GitHub issue titles:

${issues.map(issue => `- ${issue.title}`).join('\n')}

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
