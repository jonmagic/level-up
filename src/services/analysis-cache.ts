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

// Analysis data type
export type ContributionType = 'issue' | 'pull_request' | 'discussion'
export type RoleType = 'author' | 'reviewer' | 'commenter' | 'contributor'
export type ImportanceLevel = 'high' | 'medium' | 'low'
export type QualityLevel = 'excellent' | 'good' | 'adequate' | 'needs_improvement' | 'n/a'
export type AlignmentLevel = 'strong' | 'moderate' | 'weak'

export interface ImpactAnalysis {
  summary: string
  importance: ImportanceLevel
}

export interface TechnicalQualityAnalysis {
  applicable: boolean
  analysis: string
  complexity: 'high' | 'medium' | 'low' | 'n/a'
  quality: QualityLevel
  standards_adherence: QualityLevel
}

export interface CollaborationAnalysis {
  analysis: string
  communication: QualityLevel
  helpfulness: QualityLevel
}

export interface AlignmentAnalysis {
  analysis: string
  alignment: AlignmentLevel
}

export interface AnalysisData {
  user: string
  url: string
  contribution_type: ContributionType
  role: RoleType
  impact: ImpactAnalysis
  technical_quality: TechnicalQualityAnalysis
  collaboration: CollaborationAnalysis
  alignment_with_goals: AlignmentAnalysis
}

// Cache entry type
interface CacheEntry {
  data: AnalysisData
  updatedAt: string
  cachedAt: string
}

export class AnalysisCacheService {
  private static instance: AnalysisCacheService
  private user: string | null = null

  private constructor() {
    ensureCacheDir()
  }

  static getInstance(): AnalysisCacheService {
    if (!AnalysisCacheService.instance) {
      AnalysisCacheService.instance = new AnalysisCacheService()
    }
    return AnalysisCacheService.instance
  }

  setUser(user: string) {
    this.user = user
  }

  // Gets the cache file path for an analysis
  getCachePath(user: string, owner: string, repo: string, type: string, number: number): string {
    if (!this.user) {
      throw new Error('User must be set before using AnalysisCacheService')
    }
    return join(CACHE_DIR, this.user, owner, repo, type, `${number}.json`)
  }

  async get(
    owner: string,
    repo: string,
    type: string,
    number: number
  ): Promise<AnalysisData | null> {
    if (!this.user) {
      throw new Error('User must be set before using AnalysisCacheService')
    }

    const cachePath = this.getCachePath(this.user, owner, repo, type, number)

    try {
      // Ensure the directory exists
      await fs.mkdir(join(CACHE_DIR, this.user, owner, repo, type), { recursive: true })
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
    data: AnalysisData
  ): Promise<void> {
    if (!this.user) {
      throw new Error('User must be set before using AnalysisCacheService')
    }

    const cachePath = this.getCachePath(this.user, owner, repo, type, number)
    const entry: CacheEntry = {
      data,
      updatedAt: new Date().toISOString(),
      cachedAt: new Date().toISOString()
    }

    try {
      // Ensure the directory exists
      await fs.mkdir(join(CACHE_DIR, this.user, owner, repo, type), { recursive: true })
      await fs.writeFile(cachePath, JSON.stringify(entry, null, 2))
      logger.debug(`Cached analysis for ${type} ${owner}/${repo}#${number}`)
    } catch (error) {
      logger.error(`Failed to cache analysis for ${type} ${owner}/${repo}#${number}:`, error)
    }
  }

  async clear(owner?: string, repo?: string, type?: string): Promise<void> {
    if (!this.user) {
      throw new Error('User must be set before using AnalysisCacheService')
    }

    const path = join(CACHE_DIR, this.user, owner || '', repo || '', type || '')
    try {
      await fs.rm(path, { recursive: true, force: true })
    } catch (error) {
      // Path doesn't exist, that's fine
    }
  }
}
