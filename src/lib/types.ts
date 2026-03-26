// ============================================
// Core Entities
// ============================================

export interface Workspace {
  id: string
  team_id: string
  team_name: string | null
  bot_token: string
  bot_user_id: string | null
  logo_url: string | null
  rating_scale: any
  onboarding_completed: boolean
  installed_at: string | null
  updated_at: string | null
}

export interface User {
  id: string
  workspace_id: string | null
  slack_user_id: string
  slack_email: string | null
  slack_name: string | null
  role: 'admin' | 'manager' | 'hr' | 'user' | null
  manager_id: string | null
  job_title: string | null
  department: string | null
  level_id: string | null
  start_date: string | null
  avatar_url: string | null
  is_department_head: boolean
  employee_status: string
  timezone: string | null
  created_at: string | null
  updated_at: string | null
  // Relations
  manager?: User | null
  level?: Level | null
}

// ============================================
// Templates & Questions
// ============================================

export interface Template {
  id: string
  workspace_id: string | null
  name: string
  description: string | null
  questions: Question[]
  is_default: boolean | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Question {
  id: string
  text: string
  type: 'text' | 'rating'
}

// ============================================
// Continuous Feedback (ad-hoc, via Slack)
// ============================================

export interface ContinuousFeedback {
  id: string
  workspace_id: string | null
  from_user_id: string | null
  to_user_id: string
  message: string
  feedback_type: 'praise' | 'constructive' | 'general' | 'improvement' | 'question'
  is_anonymous: boolean | null
  slack_message_ts: string | null
  slack_channel_id: string | null
  created_at: string | null
  // Relations
  from_user?: User | null
  to_user?: User
}

// ============================================
// Performance Cycles (org-wide review periods)
// ============================================

export type PerformanceCycleStatus = 'draft' | 'active' | 'in_review' | 'completed' | 'closed'

export interface PerformanceCycle {
  id: string
  workspace_id: string | null
  name: string
  description: string | null
  status: PerformanceCycleStatus
  type: 'annual' | 'mid_year' | 'quarterly' | 'probation' | 'custom' | null
  start_date: string
  end_date: string
  review_deadline: string | null
  grades_released: boolean
  created_by: string | null
  created_at: string | null
  updated_at: string | null
  // Relations
  creator?: User
  phases?: CyclePhase[]
}

export type CyclePhaseType =
  | 'goal_setting'
  | 'self_assessment'
  | 'peer_review'
  | 'manager_review'
  | 'calibration'
  | 'communication'

export interface CyclePhase {
  id: string
  cycle_id: string
  phase_type: CyclePhaseType
  name: string
  start_date: string
  end_date: string
  status: 'pending' | 'active' | 'completed'
  created_at: string | null
  updated_at: string | null
}

export type PerformanceCycleEmployeeStatus = 'pending' | 'in_progress' | 'completed'

export interface PerformanceCycleEmployee {
  id: string
  performance_cycle_id: string | null
  employee_id: string | null
  status: PerformanceCycleEmployeeStatus
  created_at: string | null
  // Relations
  employee?: User
}

// ============================================
// Competencies & Skills Matrix
// ============================================

export interface Competency {
  id: string
  workspace_id: string | null
  name: string
  description: string | null
  category: string | null
  is_core: boolean
  created_at: string | null
  updated_at: string | null
}

export interface RoleCompetency {
  id: string
  workspace_id: string | null
  role_name: string
  competency_id: string | null
  expected_level: number | null
  created_at: string | null
  updated_at: string | null
  // Relations
  competency?: Competency
}

export interface LevelCompetency {
  id: string
  workspace_id: string | null
  level_id: string
  competency_id: string
  expected_level: number
  weight: number | null
  behavioral_indicators: Record<number, string> | null
  created_at: string | null
  updated_at: string | null
  // Relations
  level?: Level
  competency?: Competency
}

// ============================================
// Job Families & Levels
// ============================================

export interface JobFamily {
  id: string
  workspace_id: string | null
  name: string
  description: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Level {
  id: string
  workspace_id: string | null
  job_family_id: string | null
  name: string
  grade: string | null
  sort_order: number
  created_at: string | null
  updated_at: string | null
  // Relations
  job_family?: JobFamily
}

// ============================================
// Review Assignments (tied to performance cycles)
// ============================================

export interface ReviewAssignment {
  id: string
  cycle_id: string
  employee_id: string
  manager_id: string | null
  reviewer_id: string | null
  assignment_type: 'standard' | 'upward'
  status: 'pending' | 'in_progress' | 'completed'
  overall_rating: number | null
  final_grade: string | null
  calibrated_by: string | null
  calibrated_at: string | null
  slack_notification_ts: string | null
  slack_notification_channel: string | null
  last_reminder_at: string | null
  reminder_count: number | null
  created_at: string | null
  updated_at: string | null
  // Relations
  employee?: User
  manager?: User
  cycle?: PerformanceCycle
  responses?: ReviewResponse[]
}

export interface ReviewResponse {
  id: string
  assignment_id: string
  reviewer_id: string
  reviewer_role: 'self' | 'peer' | 'manager' | 'skip_level'
  competency_id: string | null
  rating: number | null
  comment: string | null
  phase_id: string | null
  created_at: string | null
  updated_at: string | null
  // Relations
  reviewer?: User
  competency?: Competency
}

// ============================================
// Goals & OKRs
// ============================================

export type GoalStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'archived'
export type GoalTrackingStatus = 'on_track' | 'at_risk' | 'delayed' | 'achieved'
export type GoalScope = 'company' | 'team' | 'individual'

export interface Goal {
  id: string
  workspace_id: string | null
  employee_id: string
  cycle_id: string | null
  parent_id: string | null
  title: string
  description: string | null
  status: GoalStatus
  progress: number
  weight: number
  metric_start: number | null
  metric_current: number | null
  metric_target: number | null
  metric_unit: string | null
  tracking_status: GoalTrackingStatus | null
  scope: GoalScope
  due_date: string | null
  created_at: string | null
  updated_at: string | null
  // Relations
  employee?: User
  cycle?: PerformanceCycle
  children?: Goal[]
}

// ============================================
// Billing & Subscriptions
// ============================================

export type SubscriptionPlan = 'free' | 'starter' | 'professional' | 'enterprise'
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'

export interface Subscription {
  id: string
  workspace_id: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  user_limit: number | null
  created_at: string | null
  updated_at: string | null
}

// ============================================
// Tenure Buckets (configurable per workspace)
// ============================================

export interface TenureBucket {
  id: string;
  workspace_id: string;
  label: string;
  min_months: number;
  max_months: number | null;
  sort_order: number;
}

// ============================================
// Dashboard & Utility Types
// ============================================

export interface DashboardStats {
  totalReviews: number
  activeReviews: number
  completedReviews: number
  totalFeedback: number
  totalUsers: number
}
