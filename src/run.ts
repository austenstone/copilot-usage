import { debug, getBooleanInput, getInput, info, setOutput, summary } from "@actions/core";
import { Octokit, RestEndpointMethodTypes } from '@octokit/rest'
import { DefaultArtifactClient } from "@actions/artifact";
import { writeFileSync } from "fs";
import { Json2CsvOptions, json2csv } from "json-2-csv";
import { toXML } from 'jstoxml';
import { createJobSummaryFooter, createJobSummarySeatAssignments, setJobSummaryTimeZone } from "./deprecated-job-summary";
import { createJobSummaryUsage } from "./job-summary";
import { warn } from "console";

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

export type CopilotUsageResponse = CopilotUsageResponseData[];

interface Input {
  token: string;
  organization: string;
  team?: string;
  days?: number;
  since?: string;
  until?: string;
  jobSummary: boolean;
  json: boolean;
  csv: boolean;
  csvOptions?: Json2CsvOptions;
  xml: boolean;
  xmlOptions?: {
    header: boolean;
    indent: string;
    attributeExplicitTrue: boolean;
    selfCloseTags: boolean;
  };
  timeZone: string;
  artifactName: string;
}

const getInputs = (): Input => {
  const result = {} as Input;
  result.token = getInput("github-token").trim();
  result.organization = getInput("organization").trim();
  result.team = getInput("team").trim();
  result.jobSummary = getBooleanInput("job-summary");
  result.days = parseInt(getInput("days"));
  result.since = getInput("since");
  result.until = getInput("until");
  result.json = getBooleanInput("json");
  result.csv = getBooleanInput("csv");
  result.csvOptions = getInput("csv-options") ? JSON.parse(getInput("csv-options")) : undefined;
  result.xml = getBooleanInput("xml");
  result.xmlOptions = getInput("xml-options") ? JSON.parse(getInput("xml-options")) : {
    header: true,
    indent: "  ",
  };
  result.timeZone = getInput("time-zone");
  result.artifactName = getInput("artifact-name");
  if (!result.token) {
    throw new Error("github-token is required");
  }
  return result;
};

const run = async (): Promise<void> => {
  const input = getInputs();
  const octokit = new Octokit({
    auth: input.token
  });

  const params = {} as Record<string, string>;
  if (input.days) {
    params.since = new Date(new Date().setDate(new Date().getDate() - input.days)).toISOString().split('T')[0];
  } else if (input.since || input.until) {
    if (input.since) params.since = input.since;
    if (input.until) params.until = input.until;
  }
  let req: Promise<RestEndpointMethodTypes["copilot"]["copilotMetricsForOrganization"]["response"]["data"]>;

  if (input.team) {
    if (!input.organization) {
      throw new Error("organization is required when team is provided");
    }
    info(`Fetching Copilot usage for team ${input.team} inside organization ${input.organization}`);
    req = octokit.rest.copilot.copilotMetricsForTeam({
      org: input.organization,
      team_slug: input.team,
      ...params
    }).then(response => response.data);
  } else if (input.organization) {
    info(`Fetching Copilot usage for organization ${input.organization}`);
    req = octokit.rest.copilot.copilotMetricsForOrganization({
      org: input.organization,
      ...params
    }).then(response => response.data);
  } else {
    throw new Error("organization, enterprise or team input is required");
  }

  const data = await req;
  if (!data || data.length === 0) {
    return warn("No Copilot usage data found");
  }
  debug(JSON.stringify(data, null, 2));
  info(`Fetched Copilot usage data for ${data.length} days (${data[0].date} to ${data[data.length - 1].date})`);

  if (input.jobSummary) {
    setJobSummaryTimeZone(input.timeZone);
    const name = (input.team && input.organization) ? `${input.organization} / ${input.team}` : input.organization;
    await createJobSummaryUsage(data, name).write();

    if (input.organization && !input.team) { // refuse to fetch organization seat info if looking for team usage
      info(`Fetching Copilot details for organization ${input.organization}`);
      const orgCopilotDetails = await octokit.rest.copilot.getCopilotOrganizationDetails({
        org: input.organization
      }).then(response => response.data);
      if (orgCopilotDetails) {
        await summary
          .addHeading('Seat Info')
          .addTable([
            ['Seat Management Setting', {
              'assign_all': 'Assign All',
              'assign_selected': 'Assign Selected',
              'disabled': 'Disabled',
              'unconfigured': 'Unconfigured',
            }[orgCopilotDetails.seat_management_setting] || 'Unknown'],
            ['Public Code Suggestions Enabled', orgCopilotDetails.public_code_suggestions ? 'Yes' : 'No'],
            ['IDE Chat Enabled', orgCopilotDetails.ide_chat ? 'Yes' : 'No'],
            ['Platform IDE Enabled', orgCopilotDetails.platform_ide ? 'Yes' : 'No'], // TODO: Remove this line when platform_ide is available in the response
            ['Platform Chat Enabled', orgCopilotDetails.platform_chat ? 'Yes' : 'No'],
            ['CLI Enabled', orgCopilotDetails.cli ? 'Yes' : 'No'],
            ['Total Seats', (orgCopilotDetails.seat_breakdown.total || 0).toString()],
            ['Added this cycle', (orgCopilotDetails.seat_breakdown.added_this_cycle || 0).toString()],
            ['Pending invites', (orgCopilotDetails.seat_breakdown.pending_invitation || 0).toString()],
            ['Pending cancellations', (orgCopilotDetails.seat_breakdown.pending_cancellation || 0).toString()],
            ['Active this cycle', (orgCopilotDetails.seat_breakdown.active_this_cycle || 0).toString()],
            ['Inactive this cycle', (orgCopilotDetails.seat_breakdown.inactive_this_cycle || 0).toString()]
          ]).write()
      }

      info(`Fetching Copilot seat assignments for organization ${input.organization}`);
      const orgSeatAssignments = await octokit.paginate(octokit.rest.copilot.listCopilotSeats, {
        org: input.organization
      }) as { total_seats: number, seats: object[] }[];
      const _orgSeatAssignments = {
        total_seats: orgSeatAssignments[0]?.total_seats || 0,
        // octokit paginate returns an array of objects (bug)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seats: (orgSeatAssignments).reduce((acc, rsp) => acc.concat(rsp.seats), [] as any[])
      };
      if (_orgSeatAssignments.total_seats > 0 && _orgSeatAssignments?.seats) {
        _orgSeatAssignments.seats = _orgSeatAssignments.seats.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
        await createJobSummarySeatAssignments(_orgSeatAssignments?.seats)?.write();
      }
    }

    if (input.organization) {
      (await createJobSummaryFooter(input.organization)).write();
    }
  }

  if (input.csv || input.xml || input.json) {
    const artifact = new DefaultArtifactClient();
    if (input.json) {
      writeFileSync('copilot-usage.json', JSON.stringify(data, null, 2));
      await artifact.uploadArtifact(input.artifactName, ['copilot-usage.json'], '.');
    }
    if (input.csv) {
      writeFileSync('copilot-usage.csv', await json2csv(data, input.csvOptions));
      await artifact.uploadArtifact(input.artifactName, ['copilot-usage.csv'], '.');
    }
    if (input.xml) {
      writeFileSync('copilot-usage.xml', await toXML(data, input.xmlOptions));
      await artifact.uploadArtifact(input.artifactName, ['copilot-usage.xml'], '.');
    }
  }

  setOutput("result", JSON.stringify(data));
  setOutput("since", data[0].date);
  setOutput("until", data[data.length - 1].date);
  setOutput("days", data.length.toString());
};

export default run;