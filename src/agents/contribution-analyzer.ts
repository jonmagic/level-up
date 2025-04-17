// GitHub Contribution Analyzer Agent
// An AI agent specialized in analyzing GitHub contributions
// Provides detailed feedback on contribution quality, best practices, and impact

import { createAgent } from '@inngest/agent-kit'
import { defaultModel } from '../services/models.js'
import { logger } from '../services/logger.js'

// Creates a helpful agent that can analyze GitHub contributions
export const contributionAnalyzerAgent = createAgent({
  name: 'contribution-analyzer',
  system: `You are a GitHub contribution analyzer assistant.
Your task is to analyze GitHub contributions (issues, pull requests, and discussions) and provide feedback.

Given a contribution, you will:
1. Analyze the contribution's content, context, and impact
2. Determine if it's noteworthy based on its quality and impact
3. Provide constructive feedback on how it could be improved
4. Return your analysis in a structured JSON format:
{
  "role": "AUTHOR | COMMENTER | REVIEWER",
  "noteworthy": boolean indicating if this is a noteworthy contribution,
  "feedback": "string with detailed feedback and suggestions"
}

The role must be one of:
- AUTHOR: The person who created the issue, PR, or discussion
- COMMENTER: Someone who provided comments or feedback
- REVIEWER: Someone who reviewed and approved/rejected changes

IMPORTANT: Your response must be ONLY the JSON object, with no additional text or explanation.`,
  model: defaultModel,
  tools: [],
  lifecycle: {
    onStart: ({ prompt, history = [], network }) => {
      const firstMessage = prompt[0]
      logger.debug('\nAnalyzer Agent - Starting with prompt:', {
        messageType: firstMessage?.type,
        role: firstMessage?.role,
        contentLength: firstMessage?.type === 'text' ? firstMessage.content.length : 0
      })
      return { prompt, history, stop: false }
    },
    onResponse: ({ result }) => {
      const { output, toolCalls } = result
      logger.debug('\nAnalyzer Agent - Model Response:', {
        outputLength: output.length,
        toolCallsCount: toolCalls.length,
        lastMessageType: output[output.length - 1]?.type
      })
      return result
    },
    onFinish: ({ result, network }) => {
      logger.debug('\nAnalyzer Agent - Final Result:', {
        outputLength: result.output.length,
        toolCallsCount: result.toolCalls.length,
        createdAt: result.createdAt
      })

      // Extract analysis from the last message
      const lastMessage = result.output[result.output.length - 1]
      if (!lastMessage || lastMessage.type !== 'text') {
        logger.error('No text message found in result')
        return result
      }

      try {
        // Handle both string and TextContent[] content types
        const content = typeof lastMessage.content === 'string'
          ? lastMessage.content
          : lastMessage.content.map(c => c.text).join('')

        // Try to parse the content as JSON
        const analysis = JSON.parse(content)

        // Update network state with analysis
        if (network?.state) {
          if (!network.state.data.noteworthyAnalyses) {
            network.state.data.noteworthyAnalyses = []
          }
          if (analysis.noteworthy) {
            network.state.data.noteworthyAnalyses.push(analysis)
          }
          logger.debug('Updated network state with analysis:', {
            role: analysis.role,
            noteworthy: analysis.noteworthy,
            feedbackLength: analysis.feedback.length
          })
        }
      } catch (error) {
        logger.error('Error parsing analysis:', error as Error)
      }

      return result
    }
  }
})
