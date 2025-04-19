// Command Line Interface (CLI) Module
// Handles parsing and validation of command line arguments

import { z } from 'zod'
import { logger } from './services/logger.js'
import minimist from 'minimist'

// Schema for validating command line arguments
const CliArgsSchema = z.object({
  organization: z.string().min(1).describe('GitHub organization to search within'),
  user: z.string().min(1).describe('GitHub username to analyze'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('End date in YYYY-MM-DD format'),
  roleDescription: z.string().min(1).describe('Path to a file containing the role description'),
  outputPath: z.string().optional().describe('Path where the analysis JSON will be saved')
})

// Type definition for command line arguments
export type CliArgs = z.infer<typeof CliArgsSchema>

// Prints usage information and exits
function showHelp() {
  logger.info('Peer Feedback Application - GitHub Contribution Analysis')
  logger.info('\nUsage:')
  logger.info('  npm run analyze -- --organization <org> --user <user> --start-date <date> --end-date <date> --role-description <path> [--output-path <path>]')
  logger.info('  npm run analyze -o <org> -u <user> -s <date> -e <date> -r <path> [-p <path>]')
  logger.info('\nOptions:')
  logger.info('  --organization, -o     GitHub organization to search within')
  logger.info('  --user, -u            GitHub username to analyze')
  logger.info('  --start-date, -s      Start date in YYYY-MM-DD format')
  logger.info('  --end-date, -e        End date in YYYY-MM-DD format')
  logger.info('  --role-description, -r Path to a file containing the role description')
  logger.info('  --output-path, -p     Optional path to save the analysis JSON (if not provided, analysis will only be printed to console)')
  logger.info('  --help, -h            Show this help message')
  logger.info('\nExample:')
  logger.info('  npm run analyze -- --organization open-truss --user jonmagic --start-date 2022-01-01 --end-date 2024-01-01 --role-description ./role-description.md --output-path ./analysis.json')
  process.exit(0)
}

// Parses command line arguments and returns validated configuration
export function parseArgs(): CliArgs {
  const args = minimist(process.argv.slice(2), {
    string: ['organization', 'user', 'start-date', 'end-date', 'role-description', 'output-path'],
    alias: {
      o: 'organization',
      u: 'user',
      s: 'start-date',
      e: 'end-date',
      r: 'role-description',
      p: 'output-path',
      h: 'help'
    },
    boolean: ['help']
  })

  // Show help if requested
  if (args.help) {
    showHelp()
  }

  // Check for required arguments
  const requiredArgs = ['organization', 'user', 'start-date', 'end-date', 'role-description']
  const missingArgs = requiredArgs.filter(arg => !args[arg])

  if (missingArgs.length > 0) {
    logger.error('Missing required arguments:')
    missingArgs.forEach(arg => logger.error(`- --${arg} or -${arg[0]}`))
    logger.error('\nRun with --help for usage information')
    process.exit(1)
  }

  try {
    const parsedArgs = CliArgsSchema.parse({
      organization: args.organization,
      user: args.user,
      startDate: args['start-date'],
      endDate: args['end-date'],
      roleDescription: args['role-description'],
      outputPath: args['output-path']
    })

    // Validate date order
    const start = new Date(parsedArgs.startDate)
    const end = new Date(parsedArgs.endDate)
    if (start > end) {
      logger.error('Invalid date range: end date must be after start date')
      process.exit(1)
    }

    return parsedArgs
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Invalid command line arguments:')
      error.errors.forEach(err => {
        logger.error(`- ${err.path.join('.')}: ${err.message}`)
      })
    } else {
      logger.error('Error parsing command line arguments:', error)
    }
    logger.error('\nRun with --help for usage information')
    process.exit(1)
  }
}
