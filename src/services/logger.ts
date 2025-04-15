import { env } from '../config.js'

class Logger {
  private static instance: Logger
  private debugEnabled: boolean = false

  private constructor() {
    this.debugEnabled = env.debug || false
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  public setDebug(enabled: boolean): void {
    this.debugEnabled = enabled
  }

  public debug(...args: any[]): void {
    if (this.debugEnabled) {
      console.log('[DEBUG]', ...args)
    }
  }

  public info(...args: any[]): void {
    console.log('[INFO]', ...args)
  }

  public error(...args: any[]): void {
    console.error('[ERROR]', ...args)
  }

  public warn(...args: any[]): void {
    console.warn('[WARN]', ...args)
  }
}

export const logger = Logger.getInstance()
