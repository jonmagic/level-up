// Type definitions for the executive summary output

export type ConversationType = 'issue' | 'pull_request' | 'discussion'

export interface StandoutContribution {
  url: string
  conversation_type: ConversationType
  reason: string
}

export interface ContributionMetrics {
  total_contributions: number
  average_contributions_per_month: number
  peak_monthly_contributions: number
  lowest_monthly_contributions: number
  contribution_type_breakdown: {
    pull_requests: number
    issues: number
    discussions: number
    reviews: number
    comments: number
  }
}

export interface ExecutiveSummary {
  user: string
  role_summary: string
  contribution_metrics: ContributionMetrics
  high_level_performance_summary: string
  key_strengths: string[]
  areas_for_improvement: string[]
  standout_contributions: StandoutContribution[]
}
