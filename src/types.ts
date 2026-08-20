export interface TokenUsage {
  output_tokens_sum?: number;
  prompt_tokens_sum?: number;
  avg_tokens_per_request?: number;
}

export interface SessionTotals {
  session_count?: number;
  request_count?: number;
  prompt_count?: number;
  token_usage?: TokenUsage;
}

export interface ActivityTotals {
  user_initiated_interaction_count?: number;
  code_generation_activity_count?: number;
  code_acceptance_activity_count?: number;
  loc_suggested_to_add_sum?: number;
  loc_suggested_to_delete_sum?: number;
  loc_added_sum?: number;
  loc_deleted_sum?: number;
}

export interface IdeTotals extends ActivityTotals {
  ide: string;
}

export interface FeatureTotals extends ActivityTotals {
  feature: string;
}

export interface LanguageFeatureTotals extends ActivityTotals {
  language: string;
  feature: string;
}

export interface LanguageModelTotals extends ActivityTotals {
  language: string;
  model: string;
}

export interface ModelFeatureTotals extends ActivityTotals {
  model: string;
  feature: string;
}

export interface AiAdoptionPhaseTotals {
  phase: string;
  phase_number?: number;
  total_engaged_users?: number;
  avg_user_initiated_interactions?: number;
  avg_code_generation_activities?: number;
  avg_code_acceptance_activities?: number;
  avg_loc_added?: number;
  avg_loc_deleted?: number;
}

export interface PullRequestTotals {
  total_created?: number;
  total_created_by_copilot?: number;
  total_reviewed?: number;
  total_reviewed_by_copilot?: number;
  total_merged?: number;
  total_merged_created_by_copilot?: number;
  total_merged_reviewed_by_copilot?: number;
  total_suggestions?: number;
  total_applied_suggestions?: number;
  total_copilot_suggestions?: number;
  total_copilot_applied_suggestions?: number;
  median_minutes_to_merge?: number;
}

export interface DayTotals extends ActivityTotals {
  day: string;
  organization_id?: string;
  enterprise_id?: string;
  daily_active_users?: number;
  daily_active_cli_users?: number;
  daily_active_copilot_app_users?: number;
  daily_active_copilot_cloud_agent_users?: number;
  daily_active_copilot_code_review_users?: number;
  daily_passive_copilot_code_review_users?: number;
  weekly_active_users?: number;
  weekly_active_cli_users?: number;
  weekly_active_copilot_app_users?: number;
  weekly_active_copilot_cloud_agent_users?: number;
  weekly_active_copilot_code_review_users?: number;
  monthly_active_users?: number;
  monthly_active_cli_users?: number;
  monthly_active_copilot_app_users?: number;
  monthly_active_chat_users?: number;
  monthly_active_agent_users?: number;
  monthly_active_copilot_cloud_agent_users?: number;
  monthly_active_copilot_code_review_users?: number;
  pull_requests?: PullRequestTotals;
  totals_by_ide?: IdeTotals[];
  totals_by_feature?: FeatureTotals[];
  totals_by_language_feature?: LanguageFeatureTotals[];
  totals_by_language_model?: LanguageModelTotals[];
  totals_by_model_feature?: ModelFeatureTotals[];
  totals_by_ai_adoption_phase?: AiAdoptionPhaseTotals[];
  totals_by_cli?: SessionTotals;
  totals_by_copilot_app?: SessionTotals;
}

export interface MetricsReport {
  report_start_day?: string;
  report_end_day?: string;
  report_day?: string;
  organization_id?: string;
  enterprise_id?: string;
  created_at?: string;
  day_totals: DayTotals[];
}

export interface UserReportRecord extends ActivityTotals {
  day: string;
  user_id: number;
  user_login: string;
  ai_adoption_phase?: string;
  ai_credits_used?: number;
  used_agent?: boolean;
  used_chat?: boolean;
  used_cli?: boolean;
  used_copilot_app?: boolean;
  used_copilot_cloud_agent?: boolean;
  used_copilot_coding_agent?: boolean;
  totals_by_ide?: IdeTotals[];
  totals_by_feature?: FeatureTotals[];
  totals_by_language_feature?: LanguageFeatureTotals[];
  totals_by_language_model?: LanguageModelTotals[];
  totals_by_model_feature?: ModelFeatureTotals[];
  totals_by_cli?: SessionTotals;
}

export interface UserTeamRecord {
  user_id: number;
  user_login: string;
  day: string;
  organization_id?: string;
  team_id: number;
  slug: string;
}

export interface ReportResponse {
  download_links: string[];
  report_day?: string;
  report_start_day?: string;
  report_end_day?: string;
}
