import { createNetwork, createState, createRoutingAgent } from '@inngest/agent-kit'
import { searchAgent } from './agents/search.js'
import { fetcherAgent } from './agents/fetcher.js'
import { contributionAnalyzerAgent } from './agents/contribution-analyzer.js'
import { summaryAnalyzerAgent } from './agents/summary-analyzer.js'
import { logger } from './services/logger.js'
import { defaultModel } from './services/models.js'
import { IncomingMessage, ServerResponse } from 'http'
import http from 'http'

// Define the network state interface
interface NetworkState {
  organization?: string
  user?: string
  startDate?: string
  endDate?: string
  contributions?: Record<string, {
    url: string
    updatedAt: string
  }>
  fetchedContributions?: Record<string, {
    url: string
    title: string
    body: string
    state: string
    createdAt: string
    updatedAt: string
    author: string
    comments: Array<{
      author: string
      body: string
      createdAt: string
      updatedAt: string
    }>
    reactions: Array<{
      content: string
      count: number
    }>
  }>
  noteworthyAnalyses?: string[]
  summary?: string
  // Add processing state
  currentPhase?: 'search' | 'fetch' | 'analyze' | 'summary' | 'complete'
  currentContributionUrl?: string
}

interface SearchAgentResult {
  contributions?: Array<{
    type: 'issue' | 'pull' | 'discussion'
    url: string
    title: string
    number: number
    repository: { owner: string; name: string }
    updatedAt: string
  }>
}

interface FetcherAgentResult {
  url?: string
  data?: Record<string, any>
}

interface AnalyzerAgentResult {
  role?: string
  noteworthy?: boolean
  feedback?: string
}

// Create the network with a router
const network = createNetwork({
  name: 'peer_feedback_network',
  agents: [searchAgent, fetcherAgent, contributionAnalyzerAgent, summaryAnalyzerAgent],
  defaultModel,
  router: createRoutingAgent({
    name: 'Peer Feedback Router',
    description: 'Routes between agents to analyze GitHub contributions',
    system: 'You are a router that coordinates the analysis of GitHub contributions. Based on the current state and call count, determine which agent should run next.',
    lifecycle: {
      onRoute: ({ result, network }) => {
        if (!network?.state) {
          logger.warn('No network state available')
          return undefined
        }

        const state = network.state.data as NetworkState
        const callCount = network.state.results.length
        const contributionCount = state.contributions ? Object.keys(state.contributions).length : 0
        const fetchedCount = state.fetchedContributions ? Object.keys(state.fetchedContributions).length : 0
        const noteworthyCount = state.noteworthyAnalyses?.length || 0

        logger.debug(`Router called with callCount: ${callCount}, state: {
          organization: ${state.organization},
          user: ${state.user},
          startDate: ${state.startDate},
          endDate: ${state.endDate},
          contributionCount: ${contributionCount},
          fetchedCount: ${fetchedCount},
          noteworthyCount: ${noteworthyCount},
          currentPhase: ${state.currentPhase},
          currentContributionUrl: ${state.currentContributionUrl}
        }`)

        // Initialize phase if not set
        if (!state.currentPhase) {
          state.currentPhase = 'search'
        }

        // Handle routing based on current phase
        switch (state.currentPhase) {
          case 'search':
            logger.debug('Routing to github-search agent')
            state.currentPhase = 'fetch'
            return ['github-search']

          case 'fetch':
            if (!state.contributions || Object.keys(state.contributions).length === 0) {
              logger.warn('No contributions found to fetch')
              state.currentPhase = 'summary'
              return ['summary-analyzer']
            }

            // Get the first contribution URL
            const contributionUrls = Object.keys(state.contributions)
            const currentUrl = contributionUrls[0]
            if (!currentUrl) {
              logger.warn('No contribution URLs found')
              state.currentPhase = 'summary'
              return ['summary-analyzer']
            }

            const currentContribution = state.contributions[currentUrl]
            if (!currentContribution) {
              logger.warn(`No contribution found for URL: ${currentUrl}`)
              delete state.contributions[currentUrl]
              return undefined
            }

            // Set current contribution URL but stay in fetch phase
            state.currentContributionUrl = currentUrl
            logger.debug(`Routing to github-fetcher agent for contribution: ${currentUrl}`)
            return ['github-fetcher', `Fetch the contribution at ${currentUrl} with updatedAt ${currentContribution.updatedAt}`]

          case 'analyze':
            if (!state.currentContributionUrl) {
              logger.warn('No current contribution URL for analysis')
              state.currentPhase = 'fetch'
              return undefined
            }

            // Check if we have fetched this contribution
            if (!state.fetchedContributions?.[state.currentContributionUrl]) {
              logger.warn('No fetched data for contribution:', state.currentContributionUrl)
              state.currentPhase = 'fetch'
              return undefined
            }

            // After analysis, check if we have more contributions to process
            if (!state.contributions || Object.keys(state.contributions).length === 0) {
              logger.info('All contributions processed, moving to summary phase')
              state.currentPhase = 'summary'
              return ['summary-analyzer']
            }

            // Go back to fetch phase for next contribution
            state.currentPhase = 'fetch'
            return ['contribution-analyzer']

          case 'summary':
            // Only run summary analyzer once
            if (state.summary) {
              logger.info('Summary generated, moving to complete phase')
              state.currentPhase = 'complete'
              return undefined
            }
            logger.info('Generating summary of all contributions')
            return ['summary-analyzer']

          case 'complete':
            logger.info('Analysis complete, stopping network')
            return undefined

          default:
            logger.warn(`Unknown phase: ${state.currentPhase}`)
            return undefined
        }
      }
    }
  })
})

// Create HTTP server
const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/analyze' && req.method === 'POST') {
    try {
      logger.info('Received POST request to /analyze')

      // Read request body
      let body = ''
      for await (const chunk of req) {
        body += chunk
      }
      logger.debug('Request body:', body)

      const { organization, user, startDate, endDate } = JSON.parse(body)
      logger.info('Parsed request parameters:', { organization, user, startDate, endDate })

      // Initialize state
      const state = createState<NetworkState>({
        organization,
        user,
        startDate,
        endDate
      })
      logger.info('Initialized state:', state.data)

      // Run the network
      logger.info('Starting network run...')
      const result = await network.run('Analyze contributions', { state })
      logger.info('Network run completed:', result)

      // Return the results
      const response = {
        contributions: state.data.contributions,
        noteworthyAnalyses: state.data.noteworthyAnalyses,
        summary: state.data.summary
      }
      logger.info('Sending response:', response)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } catch (error) {
      logger.error('Error processing request:', error as Error)
      logger.error('Error stack:', (error as Error).stack)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  } else {
    logger.warn('Received invalid request:', { url: req.url, method: req.method })
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }
})

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = 3000
  server.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`)
  })
}

export { server }
