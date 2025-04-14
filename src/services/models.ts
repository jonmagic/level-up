import { openai } from '@inngest/agent-kit'
import { env } from '../config.js'

export const defaultModel = openai({
  apiKey: env.openai.apiKey,
  model: env.openai.model
})
