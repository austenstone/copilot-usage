import { debug, getBooleanInput, getInput, info, setOutput } from "@actions/core";
import { getOctokit } from "@actions/github";
import { DefaultArtifactClient } from "@actions/artifact";
import { writeFileSync } from "fs";
import { createJobSummaryFooter, createJobSummarySeatAssignments, createJobSummarySeatInfo, createJobSummaryUsage } from "./job-summary";
import { createCSV } from "./csv";
import { Json2CsvOptions } from "json-2-csv";
import { createXML } from "./xml";
import { RequestError } from "@octokit/request-error";

export type CopilotUsageBreakdown = {
  language: string;
  editor: string;
  suggestions_count: number;
  acceptances_count: number;
  lines_suggested: number;
  lines_accepted: number;
  active_users: number;
};

export type CopilotUsageResponseData = {
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

interface Input {
  token: string;
  organization: string;
  enterprise?: string;
  team?: string;
  days?: number;
  since?: string;
  until?: string;
  jobSummary: boolean;
  csv: boolean;
  csvOptions?: Json2CsvOptions;
  xml: boolean;
  xmlOptions?: {
    header: boolean;
    indent: string;
    attributeExplicitTrue: boolean;
    selfCloseTags: boolean;
  };
}

const handleError = (error: unknown): void => {
  if (error instanceof RequestError) {
    info(`Error fetching Copilot usage data: ${error.message}, did you provide the correct 'github-token' for the enterprise, organization, or team?`);
  } else {
    info("Error fetching Copilot usage data");
  }
  debug(JSON.stringify(error, null, 2));
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
  result.csvOptions = getInput("csv-options") ? JSON.parse(getInput("csv-options")) : undefined;
  result.xml = getBooleanInput("xml");
  result.xmlOptions = getInput("xml-options") ? JSON.parse(getInput("xml-options")) : {
    header: true,
    indent: "  ",
  };
  if (!result.token?.trim()) {
    throw new Error("github-token is required");
  }
  if (result.team && !result.organization) {
    throw new Error("organization is required when team is provided");
  }
  return result;
};

const run = async (): Promise<void> => {
  const input = getInputs();
  const octokit = getOctokit(input.token);

  const params = {} as Record<string, string>;
  if (input.days) {
    params.since = new Date(new Date().setDate(new Date().getDate() - input.days)).toISOString().split('T')[0];
  } else if (input.since || input.until) {
    if (input.since) params.since = input.since;
    if (input.until) params.until = input.until;
  }
  let req: Promise<unknown[]>;
  if (input.enterprise) {
    info(`Fetching Copilot usage for enterprise ${input.enterprise}`);
    req = octokit.paginate("GET /enterprises/{enterprise}/copilot/usage", {
      enterprise: input.enterprise,
      ...params
    });
  } else if (input.team) {
    info(`Fetching Copilot usage for team ${input.team} inside organization ${input.organization}`);
    req = octokit.paginate("GET /orgs/{org}/team/{team}/copilot/usage", {
      org: input.organization,
      team: input.team,
      ...params
    });
  } else if (input.organization) {
    info(`Fetching Copilot usage for organization ${input.organization}`);
    req = octokit.paginate("GET /orgs/{org}/copilot/usage", {
      org: input.organization,
      ...params
    });
  } else {
    throw new Error("organization, enterprise or team is required");
  }

  let data: CopilotUsageResponse;
  try {
    data = await req as CopilotUsageResponse;
  } catch (error) {
    handleError(error);
    throw error;
  }
  if (!data || data.length === 0) {
    info("No Copilot usage data found");
    return;
  }
  debug(JSON.stringify(data, null, 2));
  info(`Fetched Copilot usage data for ${data.length} days (${data[0].day} to ${data[data.length - 1].day})`);

  if (input.jobSummary) {
    await createJobSummaryUsage(data).write();

    if (input.organization && !input.team) {
      info(`Fetching Copilot details for organization ${input.organization}`);
      let orgSeatInfo;
      try {
        orgSeatInfo = await octokit.rest.copilot.getCopilotOrganizationDetails({
          org: input.organization
        });
      } catch (error) {
        handleError(error);
        throw error;
      }
      if (orgSeatInfo?.data) {
        await createJobSummarySeatInfo(orgSeatInfo.data).write();
      }

      info(`Fetching Copilot seat assignments for organization ${input.organization}`);
      let orgSeatAssignments;
      try {
        orgSeatAssignments = await octokit.rest.copilot.listCopilotSeats({
          org: input.organization
        });
      } catch (error) {
        handleError(error);
        throw error;
      }
      if (orgSeatAssignments?.data) {
        await createJobSummarySeatAssignments(orgSeatAssignments.data)?.write();
      }
    }
    
    if (input.organization) {
      await createJobSummaryFooter(input.organization);
    }
  }

  if (input.csv) {
    const csv = await createCSV(data, input.csvOptions);
    writeFileSync('copilot-usage.csv', csv);
    const artifact = new DefaultArtifactClient()
    if (process.env.GITHUB_ACTIONS) {
      await artifact.uploadArtifact('copilot-usage', ['copilot-usage.csv'], '.');
    }
  }

  if (input.xml) {
    const xml = await createXML(data, input.xmlOptions);
    writeFileSync('copilot-usage.xml', xml);
    const artifact = new DefaultArtifactClient()
    if (process.env.GITHUB_ACTIONS) {
      await artifact.uploadArtifact('copilot-usage', ['copilot-usage.xml'], '.');
    }
  }

  setOutput("result", JSON.stringify(data));
  setOutput("since", data[0].day);
  setOutput("until", data[data.length - 1].day);
  setOutput("days", data.length.toString());
};

export default run;