import { promises as fs } from 'fs'
import { join } from 'path'
import { logger } from './logger.js'

// Cache configuration
const CACHE_DIR = '.cache/analysis_v01'

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  } catch (error) {
    logger.error('Failed to create analysis cache directory:', error)
  }
}

// Get cache file path for an analysis
function getCachePath(owner: string, repo: string, type: string, number: number): string {
  return join(CACHE_DIR, owner, repo, type, `${number}.json`)
}

// Cache entry type
interface CacheEntry {
  data: string
  updatedAt: string
  cachedAt: string
}

export class AnalysisCacheService {
  private static instance: AnalysisCacheService

  private constructor() {
    ensureCacheDir()
  }

  static getInstance(): AnalysisCacheService {
    if (!AnalysisCacheService.instance) {
      AnalysisCacheService.instance = new AnalysisCacheService()
    }
    return AnalysisCacheService.instance
  }

  async get(
    owner: string,
    repo: string,
    type: string,
    number: number
  ): Promise<string | null> {
    const cachePath = getCachePath(owner, repo, type, number)

    try {
      // Ensure the directory exists
      await fs.mkdir(join(CACHE_DIR, owner, repo, type), { recursive: true })
      const data = await fs.readFile(cachePath, 'utf-8')
      const entry = JSON.parse(data) as CacheEntry

      logger.debug(`Using cached analysis for ${type} ${owner}/${repo}#${number}`)
      return entry.data
    } catch (error) {
      // Cache miss or error
      return null
    }
  }

  async set(
    owner: string,
    repo: string,
    type: string,
    number: number,
    data: string
  ): Promise<void> {
    const cachePath = getCachePath(owner, repo, type, number)
    const entry: CacheEntry = {
      data,
      updatedAt: new Date().toISOString(),
      cachedAt: new Date().toISOString()
    }

    try {
      // Ensure the directory exists
      await fs.mkdir(join(CACHE_DIR, owner, repo, type), { recursive: true })
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2))
      logger.debug(`Cached analysis for ${type} ${owner}/${repo}#${number}`)
    } catch (error) {
      logger.error(`Failed to cache analysis for ${type} ${owner}/${repo}#${number}:`, error)
    }
  }

  async clear(owner?: string, repo?: string, type?: string): Promise<void> {
    const path = join(CACHE_DIR, owner || '', repo || '', type || '')
    try {
      await fs.rm(path, { recursive: true, force: true })
    } catch (error) {
      // Path doesn't exist, that's fine
    }
  }
}
