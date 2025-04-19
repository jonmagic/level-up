import fs from 'fs/promises'
import path from 'path'
import { logger } from './logger.js'
import { ContributionDetails } from '../types/contributions.js'

// Cache configuration
const CACHE_DIR = '.cache/conversations'

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  } catch (error) {
    logger.error('Failed to create cache directory:', error)
  }
}

// Get cache file path for a contribution
function getCachePath(owner: string, repo: string, type: string, number: number): string {
  return path.join(CACHE_DIR, owner, repo, type, `${number}.json`)
}

// Cache entry type
interface CacheEntry<T> {
  data: T
  updatedAt: string
  cachedAt: string
}

export class ConversationCacheService {
  private static instance: ConversationCacheService

  private constructor() {
    ensureCacheDir()
  }

  static getInstance(): ConversationCacheService {
    if (!ConversationCacheService.instance) {
      ConversationCacheService.instance = new ConversationCacheService()
    }
    return ConversationCacheService.instance
  }

  async get<T extends ContributionDetails>(
    owner: string,
    repo: string,
    type: string,
    number: number,
    updatedAt?: string
  ): Promise<CacheEntry<T> | null> {
    const cachePath = getCachePath(owner, repo, type, number)

    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(cachePath), { recursive: true })
      const data = await fs.readFile(cachePath, 'utf-8')
      const entry = JSON.parse(data) as CacheEntry<T>

      // Check if contribution has been updated since cache
      if (updatedAt && new Date(updatedAt) > new Date(entry.data.updatedAt)) {
        logger.debug(`Contribution updated since cache for ${type} ${owner}/${repo}#${number}`)
        return null
      }

      logger.debug(`Using cached data for ${type} ${owner}/${repo}#${number}`)
      return entry
    } catch (error) {
      // Cache miss or error
      return null
    }
  }

  async set<T extends ContributionDetails>(
    owner: string,
    repo: string,
    type: string,
    number: number,
    data: T
  ): Promise<void> {
    const cachePath = getCachePath(owner, repo, type, number)
    const entry: CacheEntry<T> = {
      data,
      updatedAt: data.updatedAt,
      cachedAt: new Date().toISOString()
    }

    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(cachePath), { recursive: true })
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2))
      logger.debug(`Cached data for ${type} ${owner}/${repo}#${number}`)
    } catch (error) {
      logger.error(`Failed to cache data for ${type} ${owner}/${repo}#${number}:`, error)
    }
  }
}
