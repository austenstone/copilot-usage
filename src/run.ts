import { getBooleanInput, getInput, info, setOutput, summary } from "@actions/core";
import { getOctokit } from "@actions/github";
import { CopilotUsageResponse } from "./types";
import { DefaultArtifactClient } from "@actions/artifact";
import { writeFileSync } from "fs";
import { createJobSummaryFooter, createJobSummarySeatAssignments, createJobSummarySeatInfo, createJobSummaryUsage } from "./job.summary";
import { createCSV } from "./csv";
import { Json2CsvOptions } from "json-2-csv";
import { debug } from "console";
import { createXML } from "./xml";

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
  csvOptions: Json2CsvOptions;
  xml: boolean;
  xmlOptions: {
    header: boolean;
    indent: string;
    attributeExplicitTrue: boolean;
    selfCloseTags: boolean;
  };
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
};

const run = async (): Promise<void> => {
  const input = getInputs();
  const octokit = getOctokit(input.token);

  const params = {} as Record<string, string>;
  if (input.days) {
    params.since = new Date(new Date().setDate(new Date().getDate() - input.days)).toISOString().split('T')[0];
    info(`Fetching Copilot usage for the last ${input.days} days (since ${params.since})`)
  } else if (input.since || input.until) {
    params.since = input.since || '';
    params.until = input.until || '';
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

  const data: CopilotUsageResponse = await req as CopilotUsageResponse;

  if (!data || data.length === 0) {
    info("No Copilot usage data found");
    return;
  }
  debug(JSON.stringify(data, null, 2));
  info(`Fetched Copilot usage data for ${data.length} days (${data[0].day} to ${data[data.length - 1].day})`);

  if (input.jobSummary) {
    await createJobSummaryUsage(data);

    if (input.organization && !input.team) {
      info(`Fetching Copilot details for organization ${input.organization}`);
      const orgSeatInfo = await octokit.rest.copilot.getCopilotOrganizationDetails({
        org: input.organization
      });
      if (orgSeatInfo?.data) {
        await createJobSummarySeatInfo(orgSeatInfo.data);
      }

      info(`Fetching Copilot seat assignments for organization ${input.organization}`);
      const orgSeatAssignments = await octokit.rest.copilot.listCopilotSeats({
        org: input.organization
      });
      if (orgSeatAssignments?.data.seats) {
        await createJobSummarySeatAssignments(orgSeatAssignments.data);
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