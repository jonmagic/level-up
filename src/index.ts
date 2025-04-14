import { fetcherAgent } from './agents/fetcher.js'
import { analyzerAgent } from './agents/analyzer.js'
import { SearchIssuesResult } from './tools/search-issues.js'

async function main() {
  console.log('Peer Feedback Application')

  const thirtyDaysAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Step 1: Fetch issues
  console.log('\nFetching Issues...')
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
        console.log('\n' + data.summary)
        issues = data.issues
        if (issues.length > 0) {
          console.log('\nFound Issues:')
          for (const issue of issues) {
            console.log(`- ${issue.title} (${issue.url})`)
          }
        }
      } catch (error) {
        console.error('Error processing tool result:', error)
        console.log('Raw tool result:', JSON.stringify(toolCall.content, null, 2))
      }
    }
  }

  if (issues.length === 0) {
    console.log('No issues found to analyze.')
    return
  }

  // Step 2: Analyze issues
  console.log('\nAnalyzing Issues...')
  const analysisResult = await analyzerAgent.run(`Please analyze these GitHub issue titles:

${issues.map(issue => `- ${issue.title}`).join('\n')}

Provide detailed feedback on their clarity, best practices, and consistency.`)

  console.log('\nAnalysis Results:')
  console.log('----------------')

  // Print analysis
  for (const message of analysisResult.output) {
    if (message.role === 'assistant' && 'content' in message && message.content) {
      console.log('\n' + message.content)
    }
  }
}

main().catch(console.error)
