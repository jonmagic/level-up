// Type definitions for the executive summary output

export type ContributionType = 'issue' | 'pull_request' | 'discussion'

export interface StandoutContribution {
  url: string
  contribution_type: ContributionType
  reason: string
}

export interface ExecutiveSummary {
  user: string
  role_summary: string
  high_level_performance_summary: string
  key_strengths: string[]
  areas_for_improvement: string[]
  standout_contributions: StandoutContribution[]
}
