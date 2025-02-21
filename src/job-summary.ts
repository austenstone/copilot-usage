import { summary } from "@actions/core";
import { Endpoints } from "@octokit/types";

type CopilotUsageResponse = Endpoints["GET /orgs/{org}/copilot/metrics"]["response"]["data"];

const groupLanguageMetrics = (data: CopilotUsageResponse) => {
  const metrics = new Map<string, {
    total_engaged_users: number;
    total_code_acceptances: number;
    total_code_suggestions: number;
    total_code_lines_accepted: number;
    total_code_lines_suggested: number;
  }>();

  data.forEach(day => {
    day.copilot_ide_code_completions?.editors?.forEach(editor => {
      editor.models?.forEach(model => {
        model.languages?.forEach(lang => {
          const existing = metrics.get(lang.name || 'unknown') || {
            total_engaged_users: 0,
            total_code_acceptances: 0,
            total_code_suggestions: 0,
            total_code_lines_accepted: 0,
            total_code_lines_suggested: 0
          };

          metrics.set(lang.name || 'unknown', {
            total_engaged_users: Math.max(existing.total_engaged_users, lang.total_engaged_users || 0),
            total_code_acceptances: existing.total_code_acceptances + (lang.total_code_acceptances || 0),
            total_code_suggestions: existing.total_code_suggestions + (lang.total_code_suggestions || 0),
            total_code_lines_accepted: existing.total_code_lines_accepted + (lang.total_code_lines_accepted || 0),
            total_code_lines_suggested: existing.total_code_lines_suggested + (lang.total_code_lines_suggested || 0)
          });
        });
      });
    });
  });

  return Object.fromEntries(
    Array.from(metrics.entries())
      .sort((a, b) => b[1].total_code_acceptances - a[1].total_code_acceptances)
  );
};

const groupEditorMetrics = (data: CopilotUsageResponse) => {
  const metrics = new Map<string, {
    total_engaged_users: number;
    total_code_acceptances: number;
    total_code_suggestions: number;
    total_code_lines_accepted: number;
    total_code_lines_suggested: number;
  }>();

  data.forEach(day => {
    day.copilot_ide_code_completions?.editors?.forEach(editor => {
      const existing = metrics.get(editor.name || 'unknown') || {
        total_engaged_users: 0,
        total_code_acceptances: 0,
        total_code_suggestions: 0,
        total_code_lines_accepted: 0,
        total_code_lines_suggested: 0
      };

      let dailyAcceptances = 0;
      let dailySuggestions = 0;
      let dailyLinesAccepted = 0;
      let dailyLinesSuggested = 0;

      editor.models?.forEach(model => {
        model.languages?.forEach(lang => {
          dailyAcceptances += lang.total_code_acceptances || 0;
          dailySuggestions += lang.total_code_suggestions || 0;
          dailyLinesAccepted += lang.total_code_lines_accepted || 0;
          dailyLinesSuggested += lang.total_code_lines_suggested || 0;
        });
      });

      metrics.set(editor.name || 'unknown', {
        total_engaged_users: Math.max(existing.total_engaged_users, editor.total_engaged_users || 0),
        total_code_acceptances: existing.total_code_acceptances + dailyAcceptances,
        total_code_suggestions: existing.total_code_suggestions + dailySuggestions,
        total_code_lines_accepted: existing.total_code_lines_accepted + dailyLinesAccepted,
        total_code_lines_suggested: existing.total_code_lines_suggested + dailyLinesSuggested
      });
    });
  });

  return Object.fromEntries(
    Array.from(metrics.entries())
      .sort((a, b) => b[1].total_code_acceptances - a[1].total_code_acceptances)
  );
};

const dateFormat = (date: string, options: Intl.DateTimeFormatOptions = { 
  month: 'numeric', 
  day: 'numeric', 
  year: 'numeric' 
}): string => {
  options.timeZone = process.env.TZ || 'UTC';
  return new Date(date).toLocaleDateString('en-US', options);
};

// Add these functions before createJobSummaryUsage
const getPieChartLanguageUsage = (languageMetrics: Record<string, {
  total_code_suggestions: number;
  total_code_acceptances: number;
  total_code_lines_suggested: number;
  total_code_lines_accepted: number;
  total_engaged_users: number;
}>) => {
  return `\n\`\`\`mermaid
pie showData
title Language Usage
    ${Object.entries(languageMetrics)
      .sort((a, b) => b[1].total_code_suggestions - a[1].total_code_suggestions)
      .slice(0, 20)
      .map(([language, metrics]) => 
        `"${language}" : ${metrics.total_code_suggestions}`)
      .join('\n')}
\`\`\`\n`;
};

const getPieChartEditorUsage = (editorMetrics: Record<string, {
  total_code_suggestions: number;
  total_code_acceptances: number;
  total_code_lines_suggested: number;
  total_code_lines_accepted: number;
  total_engaged_users: number;
}>) => {
  return `\n\`\`\`mermaid
pie showData
title Editor Usage
    ${Object.entries(editorMetrics)
      .sort((a, b) => b[1].total_code_suggestions - a[1].total_code_suggestions)
      .map(([editor, metrics]) => 
        `"${editor}" : ${metrics.total_code_suggestions}`)
      .join('\n')}
\`\`\`\n`;
};

// Add this function after the existing chart functions
const generateXyChart = (
  data: CopilotUsageResponse,
  title: string,
  yAxisTitle: string,
  dataForBar: (day: any) => number,
  dataForLine: (day: any) => number,
  maxData: number
) => {
  return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${data.length * 45}
        height: 500
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "${title}"
  x-axis [${data.map((day) => `"${dateFormat(day.date, { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "${yAxisTitle}" 0 --> ${maxData}
  bar [${data.map(dataForBar).map(v => isFinite(v) ? v.toFixed(3) : '0.000').join(', ')}]
  line [${data.map(dataForLine).map(v => isFinite(v) ? v.toFixed(3) : '0.000').join(', ')}]
\`\`\`\n`;
};

const getXyChartAcceptanceRate = (data: CopilotUsageResponse) => {
  const maxAcceptances = Math.max(...data.map((day) => 
    day.copilot_ide_code_completions?.editors?.reduce((sum, editor) =>
      sum + (editor.models?.reduce((mSum, model) =>
        mSum + (model.languages?.reduce((lSum, lang) =>
          lSum + (lang.total_code_acceptances || 0), 0) || 0), 0) || 0), 0) || 0)) + 10;

  return generateXyChart(
    data,
    "Completion Accepts & Acceptance Rate",
    "Acceptances",
    (day) => day.copilot_ide_code_completions?.editors?.reduce((sum, editor) =>
      sum + (editor.models?.reduce((mSum, model) =>
        mSum + (model.languages?.reduce((lSum, lang) =>
          lSum + (lang.total_code_acceptances || 0), 0) || 0), 0) || 0), 0) || 0,
    (day) => {
      const accepts = day.copilot_ide_code_completions?.editors?.reduce((sum, editor) =>
        sum + (editor.models?.reduce((mSum, model) =>
          mSum + (model.languages?.reduce((lSum, lang) =>
            lSum + (lang.total_code_acceptances || 0), 0) || 0), 0) || 0), 0) || 0;
      const suggestions = day.copilot_ide_code_completions?.editors?.reduce((sum, editor) =>
        sum + (editor.models?.reduce((mSum, model) =>
          mSum + (model.languages?.reduce((lSum, lang) =>
            lSum + (lang.total_code_suggestions || 0), 0) || 0), 0) || 0), 0) || 0;
      return ((accepts / suggestions) * maxAcceptances) || 0;
    },
    maxAcceptances
  );
};

const getXyChartDailyActiveUsers = (data: CopilotUsageResponse) => {
  const maxActiveUsers = Math.max(...data.map((day) => getTotalEngagedUsers(day))) + 10;
  return `\n\`\`\`mermaid
---
config:
    xyChart:
        width: ${data.length * 45}
        height: 500
        xAxis:
            labelPadding: 20
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Daily Active Users"
  x-axis [${data.map((day) => `"${dateFormat(day.date, { month: '2-digit', day: '2-digit' })}"`).join(', ')}]
  y-axis "Active Users" 0 --> ${maxActiveUsers}
  line [${data.map((day) => getTotalEngagedUsers(day)).join(', ')}]
\`\`\`\n`;
};

export const createJobSummaryUsage = (data: CopilotUsageResponse, name: string) => {
  const languageMetrics = groupLanguageMetrics(data);
  const editorMetrics = groupEditorMetrics(data);

  const totalCodeAcceptances = Object.values(languageMetrics)
    .reduce((sum, lang) => sum + lang.total_code_acceptances, 0);
  const totalCodeSuggestions = Object.values(languageMetrics)
    .reduce((sum, lang) => sum + lang.total_code_suggestions, 0);
  const totalLinesAccepted = Object.values(languageMetrics)
    .reduce((sum, lang) => sum + lang.total_code_lines_accepted, 0);

  const totalChatTurns = data.reduce((sum, day) => 
    sum + (day.copilot_ide_chat?.editors?.reduce((edSum, ed) => 
      edSum + (ed.models?.reduce((modSum, mod) => 
        modSum + (mod.total_chats || 0), 0) ?? 0), 0) ?? 0), 0);

  const mostActiveDay = data.reduce((a, b) => 
    getTotalEngagedUsers(a) > getTotalEngagedUsers(b) ? a : b);

  return summary
    .addHeading(`Copilot Usage for ${name}<br>${dateFormat(data[0].date)} - ${dateFormat(data[data.length-1].date)}`)
    .addHeading('Usage Summary')
    .addList([
      `Total Code Suggestions: ${totalCodeSuggestions.toLocaleString()}`,
      `Total Code Acceptances: ${totalCodeAcceptances.toLocaleString()}`,
      `Acceptance Rate: ${((totalCodeAcceptances / totalCodeSuggestions) * 100).toFixed(2)}%`,
      `Total Lines of Code Accepted: ${totalLinesAccepted.toLocaleString()}`,
      `Total Chat Interactions: ${totalChatTurns.toLocaleString()}`,
      `Most Active Day: ${dateFormat(mostActiveDay.date)} (${getTotalEngagedUsers(mostActiveDay)} active users)`
    ])
    .addRaw(getXyChartAcceptanceRate(data))
    .addRaw(getXyChartDailyActiveUsers(data))
    .addHeading('Language Usage')
    .addRaw(getPieChartLanguageUsage(languageMetrics))
    .addHeading('Editor Usage')
    .addRaw(getPieChartEditorUsage(editorMetrics))
};

// Helper function to get total engaged users for a day
const getTotalEngagedUsers = (day: CopilotUsageResponse[0]): number => {
  return day.copilot_ide_code_completions?.editors?.reduce((sum, editor) => 
    sum + (editor.total_engaged_users ?? 0), 0) || 0;
};

export const setJobSummaryTimeZone = (timeZone: string) => process.env.TZ = timeZone;
