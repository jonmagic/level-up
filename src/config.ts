import { config } from 'dotenv'

// Load environment variables
config()

export const env = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4'
  },
  github: {
    token: process.env.GITHUB_TOKEN!
  }
}
