/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export * from "./_core/errors";

// Supabase types
export type Profile = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  company_name?: string;
  job_title?: string;
  linkedin_url?: string;
  phone?: string;
  timezone: string;
  locale: 'ar' | 'en';
  subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'inactive' | 'past_due' | 'canceled';
  credits_remaining: number;
  monthly_credits: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise';
  credits_remaining: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  type: 'invitation' | 'message' | 'invitation_message' | 'visit' | 'email_finder' | 'combined';
  configuration: Record<string, any>;
  schedule_settings?: Record<string, any>;
  stats?: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
};

export type Lead = {
  id: string;
  team_id: string;
  campaign_id?: string;
  linkedin_id?: string;
  linkedin_url: string;
  profile_data: Record<string, any>;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  headline?: string;
  company?: string;
  industry?: string;
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
  status: 'new' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  priority: number;
  tags: string[];
  notes?: string;
  imported_by?: string;
  imported_at: string;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
};

export type ActionQueueItem = {
  id: string;
  team_id: string;
  campaign_id: string;
  lead_id: string;
  step_id?: string;
  action_type: 'visit' | 'follow' | 'invitation' | 'message' | 'email';
  status: 'pending' | 'ready' | 'completed' | 'failed' | 'skipped';
  content?: string;
  personalized_content?: string;
  scheduled_at?: string;
  executed_at?: string;
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  result_data?: Record<string, any>;
  error_message?: string;
  created_at: string;
  updated_at: string;
};
