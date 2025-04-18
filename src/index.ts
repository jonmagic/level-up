// Main entry point for the Peer Feedback Application
// This application analyzes GitHub contributions and provides feedback on their quality
// and adherence to best practices.

import { readFile } from 'fs/promises'
import { searchAgent } from './agents/search.js'
import { contributionAnalyzerAgent } from './agents/contribution-analyzer.js'
import { fetcherAgent } from './agents/fetcher.js'
import { SearchContributionsResult } from './tools/search-contributions.js'
import { logger } from './services/logger.js'
import { AnalysisCacheService, type AnalysisData } from './services/analysis-cache.js'
import { summaryAnalyzerAgent } from './agents/summary-analyzer.js'
import { parseArgs } from './cli.js'
import { type ExecutiveSummary } from './types/summary.js'
import { type PullRequestContribution, type IssueContribution, type DiscussionContribution } from './types/contributions.js'

// Type definitions
type RepoInfo = {
  owner: string
  name: string
  number: number
}

// Helper function to extract repository and number from GitHub URL
// This is used to parse GitHub URLs consistently across the application
export function extractRepoInfo(url: string): RepoInfo {
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

  // Parse command line arguments
  const { organization, user, startDate, endDate, roleDescription } = parseArgs()

  // Read role description file
  let roleDescriptionText: string
  try {
    roleDescriptionText = await readFile(roleDescription, 'utf-8')
    logger.debug('Role description loaded successfully')
  } catch (error) {
    logger.error('Failed to read role description file:', error as Error)
    return
  }

  // Set the user in the analysis cache service
  const analysisCache = AnalysisCacheService.getInstance()
  analysisCache.setUser(user)

  // Convert dates to ISO format
  const startDateISO = new Date(startDate).toISOString()
  const endDateISO = new Date(endDate).toISOString()

  logger.debug(`Searching contributions between ${startDateISO} and ${endDateISO}`)

  // Step 1: Search contributions using the search agent
  logger.debug(`Searching for recent contributions by ${user}...`)
  let searchResult
  try {
    const searchPrompt = `Use the search_contributions tool with these parameters:
- organization: ${organization}
- author: ${user}
- since: ${startDateISO}
- until: ${endDateISO}
- limit: 500`
    logger.info(searchPrompt)
    searchResult = await searchAgent.run(searchPrompt)
  } catch (error) {
    logger.error('Failed to search for contributions:', error as Error)
    return
  }

  // Extract contributions from search result
  let contributions: Array<{ title: string; url: string; type: 'issues' | 'pull' | 'discussions'; number: number; repository: { owner: string; name: string }; updatedAt: string }> = []
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
              type: 'issues' as const,
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
              type: 'discussions' as const,
              number,
              repository: { owner, name },
              updatedAt: discussion.updated_at
            }
          })
        ]

        if (contributions.length > 0) {
          logger.debug(`Found ${contributions.length} contributions to analyze:`)
          for (const contribution of contributions) {
            logger.debug(`- ${contribution.title} (${contribution.url})`)
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
  logger.debug('Starting individual contribution analysis...')
  logger.debug(`Processing ${contributions.length} contributions sequentially`)

  const analyses: AnalysisData[] = []

  for (const [index, contribution] of contributions.entries()) {
    logger.debug(`Analyzing contribution ${index + 1}/${contributions.length}:`)
    logger.debug(`Title: ${contribution.title}`)
    logger.debug(`URL: ${contribution.url}`)
    logger.debug(`Type: ${contribution.type}`)
    logger.debug(`Repository: ${contribution.repository.owner}/${contribution.repository.name}`)
    logger.debug(`Number: ${contribution.number}`)

    let fetcherResult
    try {
      // Use the fetcher agent to get detailed contribution data
      const fetchPrompt = `Fetch the contribution at ${contribution.url} with updatedAt ${contribution.updatedAt}`
      logger.info(fetchPrompt)
      fetcherResult = await fetcherAgent.run(fetchPrompt)
    } catch (error) {
      logger.error(`Failed to fetch contribution "${contribution.title}":`, error as Error)
      logger.error('Error details:', JSON.stringify(error, null, 2))
      continue
    }

    // Extract the contribution data from the tool result
    let detailedContribution: PullRequestContribution | IssueContribution | DiscussionContribution | undefined
    for (const toolCall of fetcherResult.toolCalls) {
      logger.debug('Tool call:', JSON.stringify(toolCall, null, 2))
      if (toolCall.role === 'tool_result' && toolCall.content) {
        const content = toolCall.content as PullRequestContribution | IssueContribution | DiscussionContribution
        detailedContribution = content
        logger.debug('Found detailed contribution:', JSON.stringify(detailedContribution, null, 2))
        break
      }
    }

    if (!detailedContribution) {
      logger.error(`Failed to extract details for ${contribution.type} ${contribution.number}`)
      logger.error('Tool calls:', JSON.stringify(fetcherResult.toolCalls, null, 2))
      continue
    }

    // Skip analysis of open pull requests
    if (contribution.type === 'pull' && 'state' in detailedContribution && detailedContribution.state === 'open') {
      logger.debug(`Skipping analysis of open pull request: ${contribution.title}`)
      continue
    }

    // Check analysis cache first
    let analysisData: AnalysisData | null = null
    const cachedAnalysis = await analysisCache.get(
      contribution.repository.owner,
      contribution.repository.name,
      contribution.type,
      contribution.number
    )

    if (cachedAnalysis) {
      logger.debug('Using cached analysis:')
      logger.debug('----------------')
      logger.debug('\n' + JSON.stringify(cachedAnalysis, null, 2))
      analysisData = cachedAnalysis
    } else {
      let analysis
      try {
        // Analyze the contribution using our detailed analyzer
        const cachePath = analysisCache.getCachePath(user, contribution.repository.owner, contribution.repository.name, contribution.type, contribution.number)
        logger.info(`Analyzing contribution from ${cachePath}`)

        // Analyze the specific contribution
        const analysisInput = {
          user,
          contribution: detailedContribution,
          roleDescription: roleDescriptionText
        }
        analysis = await contributionAnalyzerAgent.run(JSON.stringify(analysisInput, null, 2))
      } catch (error) {
        logger.error(`Failed to analyze contribution "${contribution.title}":`, error as Error)
        continue
      }

      logger.debug('Analysis Results:')
      logger.debug('----------------')
      const lastMessage = analysis?.output?.[analysis.output.length - 1]
      if (lastMessage?.type === 'text' && lastMessage?.content) {
        let analysisText = ''
        if (typeof lastMessage.content === 'string') {
          analysisText = lastMessage.content
        } else if (Array.isArray(lastMessage.content)) {
          analysisText = lastMessage.content.map(c => c.text).join('\n')
        } else {
          throw new Error('Unexpected content type from agent')
        }

        logger.debug('\n' + analysisText)

        // Parse the analysis text into structured data
        try {
          const parsedData = JSON.parse(analysisText)
          analysisData = {
            user,
            url: contribution.url,
            contribution_type: contribution.type === 'pull' ? 'pull_request' : contribution.type as 'issue' | 'discussion',
            role: parsedData.role,
            impact: parsedData.impact,
            technical_quality: parsedData.technical_quality,
            collaboration: parsedData.collaboration,
            alignment_with_goals: parsedData.alignment_with_goals
          }

          // Cache the analysis
          await analysisCache.set(
            contribution.repository.owner,
            contribution.repository.name,
            contribution.type,
            contribution.number,
            analysisData
          )
        } catch (error) {
          logger.error('Failed to parse analysis data:', error)
          continue
        }
      }
    }

    if (analysisData) {
      analyses.push(analysisData)
    }
  }

  // Step 3: Generate summary feedback from all analyses
  if (analyses.length > 0) {
    logger.info(`Generating summary feedback from ${analyses.length} contributions...`)
    try {
      const summaryInput = {
        user,
        analyses,
        roleDescription: roleDescriptionText
      }
      const result = await summaryAnalyzerAgent.run(JSON.stringify(summaryInput, null, 2))
      const lastMessage = result.output[result.output.length - 1]
      if (lastMessage && typeof lastMessage === 'object' && 'content' in lastMessage) {
        let summaryJson: ExecutiveSummary
        try {
          // Parse the JSON content
          summaryJson = JSON.parse(lastMessage.content as string) as ExecutiveSummary

          // Validate the required fields
          if (!summaryJson.user || !summaryJson.role_summary || !summaryJson.high_level_performance_summary ||
              !summaryJson.key_strengths || !summaryJson.areas_for_improvement || !summaryJson.standout_contributions) {
            throw new Error('Invalid summary JSON structure')
          }

          // Log the structured summary
          logger.info(`
Role Summary:
${summaryJson.role_summary}

High-Level Performance Summary:
${summaryJson.high_level_performance_summary}

Key Strengths:
1. ${summaryJson.key_strengths[0]}
2. ${summaryJson.key_strengths[1]}

Areas for Improvement:
1. ${summaryJson.areas_for_improvement[0]}
2. ${summaryJson.areas_for_improvement[1]}

Standout Contributions:
${summaryJson.standout_contributions.map((contribution, index) =>
  `${index + 1}. ${contribution.url} (${contribution.contribution_type})
   ${contribution.reason}`
).join('\n')}
`)
        } catch (error) {
          logger.error('Failed to parse summary JSON:', error)
          throw error
        }
      } else {
        throw new Error('Unexpected message type from agent')
      }
    } catch (error) {
      logger.error('Failed to generate summary feedback:', error as Error)
    }
  } else {
    logger.info('No contributions found to summarize.')
  }

  logger.debug('Contribution analysis complete!')
}

// Execute main function and handle any uncaught errors
main().catch(error => {
  logger.error('Application error:', error)
  process.exit(1)
})
