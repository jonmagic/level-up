// Main entry point for the Peer Feedback Application
// This application analyzes GitHub contributions and provides feedback on their quality
// and adherence to best practices.

import { readFile, writeFile } from 'fs/promises'
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

type Contribution = {
  title: string
  url: string
  type: 'issue' | 'pull_request' | 'discussion'
  number: number
  repository: {
    owner: string
    name: string
  }
  updatedAt: string
}

type DetailedContribution = {
  data: PullRequestContribution | IssueContribution | DiscussionContribution
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

// Helper function to count roles from analyses
function countRoles(analyses: AnalysisData[]) {
  const roleCounts = {
    author: {
      issues: 0,
      pull_requests: 0,
      discussions: 0
    },
    reviewer: {
      issues: 0,
      pull_requests: 0,
      discussions: 0
    },
    commenter: {
      issues: 0,
      pull_requests: 0,
      discussions: 0
    },
    contributor: {
      issues: 0,
      pull_requests: 0,
      discussions: 0
    }
  }

  for (const analysis of analyses) {
    const conversationType = analysis.conversation_type === 'issue' ? 'issues' :
                           analysis.conversation_type === 'pull_request' ? 'pull_requests' :
                           'discussions'
    roleCounts[analysis.role][conversationType]++
  }

  return roleCounts
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
  const { organization, user, startDate, endDate, roleDescription, outputPath } = parseArgs()

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
  let contributions: Contribution[] = []
  for (const toolCall of searchResult.toolCalls) {
    if (toolCall.role === 'tool_result' && toolCall.content) {
      try {
        const { data } = toolCall.content as { data: SearchContributionsResult }

        // Process each unique conversation
        contributions = data.conversations.map(conversation => {
          const { owner, name, number } = extractRepoInfo(conversation.url)
          return {
            title: conversation.title,
            url: conversation.url,
            type: conversation.type,
            number,
            repository: { owner, name },
            updatedAt: conversation.updated_at
          }
        })

        if (contributions.length > 0) {
          logger.debug(`Found ${contributions.length} unique conversations to analyze:`)
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
    let detailedContribution: DetailedContribution | undefined
    for (const toolCall of fetcherResult.toolCalls) {
      logger.debug('Tool call:', JSON.stringify(toolCall, null, 2))
      if (toolCall.role === 'tool_result' && toolCall.content) {
        const content = toolCall.content as DetailedContribution
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
        logger.info(`Generating contribution analysis ${cachePath}`)

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
            conversation_type: contribution.type,
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
      // Only add pull requests that are merged or closed
      if (detailedContribution.data.type === 'pull_request') {
        if (detailedContribution.data.state === 'merged' || detailedContribution.data.state === 'closed') {
          analyses.push(analysisData)
        }
      } else {
        analyses.push(analysisData)
      }
    }
  }

  // Step 3: Generate summary feedback from all analyses
  if (analyses.length > 0) {
    logger.info(`Generating summary feedback from ${analyses.length} contributions...`)
    try {
      const contributionMetrics = countRoles(analyses)
      const summaryInput = {
        user,
        analyses,
        role_description: roleDescriptionText,
        contribution_metrics: contributionMetrics
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
          const summaryOutput = JSON.stringify(summaryJson, null, 2)
          if (outputPath) {
            await writeFile(outputPath, summaryOutput)
            logger.info(`Analysis saved to ${outputPath}`)
          }
          logger.info('\n' + summaryOutput)
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
