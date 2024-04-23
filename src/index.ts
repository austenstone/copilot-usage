import { getBooleanInput, getInput, info, summary, setOutput } from "@actions/core";
import { getOctokit } from "@actions/github";
import { CopilotUsageResponse } from './types'
import { DefaultArtifactClient } from '@actions/artifact'
import { writeFileSync } from "fs";

interface Input {
  token: string;
  organization?: string;
  enterprise?: string;
  team?: string;
  days?: number;
  since?: string;
  until?: string;
  jobSummary: boolean;
  csv: boolean;
}

const getInputs = (): Input => {
  const result = {} as Input;
  result.token = getInput("github-token");
  result.organization = getInput("organization");
  result.enterprise = getInput("enterprise");
  result.team = getInput("team");
  result.jobSummary = getBooleanInput("job-summary");
  result.days = parseInt(getInput("days"));
  result.since = getInput("since");
  result.until = getInput("until");
  result.csv = getBooleanInput("csv");
  if (!result.token || result.token === "") {
    throw new Error("github-token is required");
  }
  if (!result.organization && !result.enterprise && !result.team) {
    throw new Error("organization, enterprise or team is required");
  }
  if (result.team && !result.organization) {
    throw new Error("organization is required when team is provided");
  }
  return result;
}

const run = async (): Promise<void> => {
  const input = getInputs();
  const octokit = getOctokit(input.token);

  let params = {} as any;
  if (input.days) {
    params.since = new Date(new Date().setDate(new Date().getDate() - input.days)).toISOString().split('T')[0];
  } else if (params.since || params.until) {
    params.since = input.since;
    params.until = input.until;
  }
  let req: Promise<any>;
  if (input.enterprise) {
    info(`Fetching Copilot usage for enterprise ${input.enterprise}`);
    req = octokit.paginate("GET /enterprises/{enterprise}/copilot/usage", {
      enterprise: input.enterprise,
      ...params
    });
  } else if (input.organization) {
    info(`Fetching Copilot usage for organization ${input.organization}`);
    req = octokit.paginate("GET /orgs/{org}/copilot/usage", {
      org: input.organization,
      ...params
    });
  } else if (input.team) {
    info(`Fetching Copilot usage for team ${input.team} inside organization ${input.organization}`);
    req = octokit.paginate("GET /orgs/{org}/team/{team}/copilot/usage", {
      org: input.organization,
      team: input.team,
      ...params
    });
  } else {
    throw new Error("organization, enterprise or team is required");
  }

  const data: CopilotUsageResponse = await req;

  if (!data) return;

  if (input.jobSummary) {
    await createJobSummary(data);
  }

  if (input.csv) {
    const csv = await createCSV(data);
    writeFileSync('copilot-usage.csv', csv);
    const artifact = new DefaultArtifactClient()
    await artifact.uploadArtifact('copilot-usage', ['copilot-usage.csv'], '.');
  }

  setOutput('result', JSON.stringify(data));
};

const createJobSummary = async (data: CopilotUsageResponse) => {
  let tableData = [
    [
      { data: 'Day', header: true },
      { data: 'Total Suggestions', header: true },
      { data: 'Total Acceptances', header: true },
      { data: 'Total Lines Suggested', header: true },
      { data: 'Total Lines Accepted', header: true },
      { data: 'Total Active Users', header: true },
      { data: 'Total Chat Acceptances', header: true },
      { data: 'Total Chat Turns', header: true },
      { data: 'Total Active Chat Users', header: true }
    ]
  ];

  data.forEach(item => {
    tableData.push([
      { data: item.day.replace(/-/g, '&#8209;'), header: false },
      { data: item.total_suggestions_count.toString(), header: false },
      { data: item.total_acceptances_count.toString(), header: false },
      { data: item.total_lines_suggested.toString(), header: false },
      { data: item.total_lines_accepted.toString(), header: false },
      { data: item.total_active_users.toString(), header: false },
      { data: item.total_chat_acceptances.toString(), header: false },
      { data: item.total_chat_turns.toString(), header: false },
      { data: item.total_active_chat_users.toString(), header: false }
    ]);
  });

  const languageUsage = data.reduce((acc, item) => {
    item.breakdown.forEach((breakdownItem) => {
      if (acc[breakdownItem.language]) {
        acc[breakdownItem.language] += breakdownItem.suggestions_count;
      } else {
        acc[breakdownItem.language] = breakdownItem.suggestions_count;
      }
    });
    return acc;
  }, {})

  const pieChartLanguageUsage = `\n\`\`\`mermaid
pie showData
title Language Usage
    ${Object.entries(languageUsage as Record<string, number>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([language, count]) => `"${language}" : ${count}`)
      .join('\n')}
\`\`\`\n`;

  const maxAcceptances = Math.max(...data.map((item) => item.total_acceptances_count)) + 10;
  const xyChartAcceptanceRate = `\n\`\`\`mermaid
---
config:
    themeVariables:
        xyChart:
            backgroundColor: "transparent"
---
xychart-beta
  title "Accepts & Acceptance Rate"
  x-axis [${
    data.map((item) => `"${item.day}"`).join(', ')
  }]
  y-axis "Acceptances" 0 --> ${maxAcceptances}
  bar [${
    data.map((item) => item.total_acceptances_count).join(', ')
  }]
  line [${
    data.map((item) => (item.total_acceptances_count / item.total_suggestions_count) * maxAcceptances).join(', ')
  }]
\`\`\`\n`;

  await summary
    .addHeading('Copilot Usage Results')
    .addRaw(pieChartLanguageUsage)
    .addRaw(xyChartAcceptanceRate)
    .addTable(tableData)
    .write();
}

const createCSV = (data: CopilotUsageResponse): string => {
  let csv = 'Day,Total Suggestions,Total Acceptances,Total Lines Suggested,Total Lines Accepted,Total Active Users,Total Chat Acceptances,Total Chat Turns,Total Active Chat Users\n';
  Object.entries(data).forEach(([_, value]) => {
    csv += `${value.day},${value.total_suggestions_count},${value.total_acceptances_count},${value.total_lines_suggested},${value.total_lines_accepted},${value.total_active_users},${value.total_chat_acceptances},${value.total_chat_turns},${value.total_active_chat_users}\n`;
  });
  return csv;
}

run();
