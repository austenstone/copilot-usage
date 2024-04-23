import { getBooleanInput, getInput, info, summary } from "@actions/core";
import { getOctokit } from "@actions/github";
import { CopilotUsageResponse } from './types'

interface Input {
  token: string;
  organization?: string;
  enterprise?: string;
  team?: string;
  report: boolean;
}

const getInputs = (): Input => {
  const result = {} as Input;
  result.token = getInput("github-token");
  result.organization = getInput("organization");
  result.enterprise = getInput("enterprise");
  result.report = getBooleanInput("report");
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

  let req;
  if (input.enterprise) {
    info(`Fetching Copilot usage for enterprise ${input.enterprise}`);
    req = octokit.request("GET /enterprises/{enterprise}/copilot/usage", {
      enterprise: input.enterprise,
    });
  } else if (input.organization) {
    info(`Fetching Copilot usage for organization ${input.organization}`);
    req = octokit.request("GET /orgs/{org}/copilot/usage", {
      org: input.organization,
    });
  } else if (input.team) {
    info(`Fetching Copilot usage for team ${input.team}`);
    req = octokit.request("GET /orgs/{org}/team/{team_slug}/copilot/usage", {
      org: input.organization,
      team_id: input.team,
    });
  }
  
  const data: CopilotUsageResponse = (await req).data;

  console.log(data);

  createJobSummary(data);
};

const createJobSummary = async (data: CopilotUsageResponse) => {
  let tableData = [
    [
      {data: 'Day', header: true},
      {data: 'Total Suggestions', header: true},
      {data: 'Total Acceptances', header: true},
      {data: 'Total Lines Suggested', header: true},
      {data: 'Total Lines Accepted', header: true},
      {data: 'Total Active Users', header: true},
      {data: 'Total Chat Acceptances', header: true},
      {data: 'Total Chat Turns', header: true},
      {data: 'Total Active Chat Users', header: true}
    ]
  ];
  
  data.forEach(item => {
    tableData.push([
      {data: item.day.replace(/-/g, '&#8209;'), header: false},
      {data: item.total_suggestions_count.toString(), header: false},
      {data: item.total_acceptances_count.toString(), header: false},
      {data: item.total_lines_suggested.toString(), header: false},
      {data: item.total_lines_accepted.toString(), header: false},
      {data: item.total_active_users.toString(), header: false},
      {data: item.total_chat_acceptances.toString(), header: false},
      {data: item.total_chat_turns.toString(), header: false},
      {data: item.total_active_chat_users.toString(), header: false}
    ]);
  });
  
  await summary
    .addHeading('Copilot Usage Results')
    .addTable(tableData)
    .addLink('View more details!', 'https://github.com')
    .write();
}

run();
