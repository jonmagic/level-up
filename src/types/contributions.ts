// Base interface for a GitHub comment
export interface BaseComment {
  // The content of the comment
  body: string
  // The username of the comment author
  author: string
  // ISO timestamp when the comment was created
  createdAt: string
}

// Interface for a comment that can have replies
export interface CommentWithReplies extends BaseComment {
  // Array of replies to this comment
  replies: BaseComment[]
}

// Base interface for all GitHub contributions (issues, PRs, discussions)
export interface BaseContribution {
  // Title of the contribution
  title: string
  // Main content/description of the contribution
  body: string
  // ISO timestamp of the last update
  updatedAt: string
  // URL to view the contribution on GitHub
  url: string
  // Array of comments on the contribution
  comments: BaseComment[]
  // Repository information
  repository: {
    // Repository owner/organization
    owner: string
    // Repository name
    name: string
  }
  // Contribution number (issue/PR/discussion number)
  number: number
}

// Interface for a GitHub issue contribution
export interface IssueContribution extends BaseContribution {
  // Type discriminator
  type: 'issue'
  // Array of labels applied to the issue
  labels: string[]
  // Current state of the issue
  state: 'open' | 'closed'
}

// Interface for a GitHub commit
export interface Commit {
  // The commit message
  message: string
  // The commit hash
  oid: string
  // The commit author's username
  author: string
  // ISO timestamp when the commit was created
  createdAt: string
  // Array of files changed in this commit
  changedFiles: Array<{
    // Path to the changed file
    path: string
    // Number of lines added
    additions: number
    // Number of lines removed
    deletions: number
    // The actual diff patch
    patch: string | undefined
  }>
}

// Interface for a GitHub pull request contribution
export interface PullRequestContribution extends BaseContribution {
  // Type discriminator
  type: 'pull'
  // Current state of the pull request
  state: 'open' | 'closed' | 'merged'
  // Array of reviews on the pull request
  reviews: Array<{
    // Review comment content
    body: string
    // Username of the reviewer
    author: string
    // Review state (APPROVED, CHANGES_REQUESTED, etc.)
    state: string
    // ISO timestamp when the review was created
    createdAt: string
    // Array of inline review comments
    comments: Array<{
      // Comment content
      body: string
      // File path the comment is on
      path: string
      // Line number the comment is on
      line: number
    }>
  }>
  // Array of files changed in the pull request
  files: Array<{
    // Path to the changed file
    path: string
    // Number of lines added
    additions: number
    // Number of lines removed
    deletions: number
  }>
  // Array of commits in the pull request
  commits: Commit[]
}

// Interface for a GitHub discussion contribution
export interface DiscussionContribution extends BaseContribution {
  // Type discriminator
  type: 'discussion'
  // Category of the discussion
  category: string
  // Array of answers to the discussion
  answers: CommentWithReplies[]
  // Array of labels applied to the discussion
  labels: string[]
  // Whether the discussion has an accepted answer
  isAnswered: boolean
  // The accepted answer if one exists
  answer?: CommentWithReplies
}

// Union type of all possible contribution types
export type ContributionDetails =
  | IssueContribution
  | PullRequestContribution
  | DiscussionContribution
