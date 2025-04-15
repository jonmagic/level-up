// Logger Service
// Implements a singleton logger with different log levels
// Provides consistent logging across the application

import { env } from '../config.js'

// Singleton logger class implementing different log levels
// Uses console methods for output with consistent formatting
class Logger {
  // Singleton instance
  private static instance: Logger
  // Debug mode flag
  private debugEnabled: boolean = false

  // Private constructor to enforce singleton pattern
  private constructor() {
    this.debugEnabled = env.debug || false
  }

  // Returns the singleton instance, creating it if necessary
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  // Enables or disables debug logging
  public setDebug(enabled: boolean): void {
    this.debugEnabled = enabled
  }

  // Logs debug messages when debug mode is enabled
  public debug(...args: any[]): void {
    if (this.debugEnabled) {
      console.log('[DEBUG]', ...args)
    }
  }

  // Logs informational messages
  public info(...args: any[]): void {
    console.log('[INFO]', ...args)
  }

  // Logs error messages
  public error(...args: any[]): void {
    console.error('[ERROR]', ...args)
  }

  // Logs warning messages
  public warn(...args: any[]): void {
    console.warn('[WARN]', ...args)
  }
}

// Export the singleton logger instance
export const logger = Logger.getInstance()
