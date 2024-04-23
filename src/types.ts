type CopilotUsageBreakdown = {
  language: string;
  editor: string;
  suggestions_count: number;
  acceptances_count: number;
  lines_suggested: number;
  lines_accepted: number;
  active_users: number;
};

type CopilotUsageResponseData = {
  day: string;
  total_suggestions_count: number;
  total_acceptances_count: number;
  total_lines_suggested: number;
  total_lines_accepted: number;
  total_active_users: number;
  total_chat_acceptances: number;
  total_chat_turns: number;
  total_active_chat_users: number;
  breakdown: CopilotUsageBreakdown[];
};

type CopilotUsageResponse = CopilotUsageResponseData[];

export {
  CopilotUsageResponse
}
