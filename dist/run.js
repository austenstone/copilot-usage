import { debug, getBooleanInput, getInput, info, setOutput, summary, warning } from "@actions/core";
import { Octokit } from '@octokit/rest';
import { DefaultArtifactClient } from "@actions/artifact";
import { writeFileSync } from "fs";
import { json2csv } from "json-2-csv";
import { toXML } from 'jstoxml';
import { createJobSummaryCopilotDetails, createJobSummarySeatAssignments, createJobSummaryUsage, setJobSummaryTimeZone } from "./job-summary";
const getInputs = () => {
    const result = {};
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
const run = async () => {
    const input = getInputs();
    const octokit = new Octokit({
        auth: input.token
    });
    const params = {};
    if (input.days) {
        params.since = new Date(new Date().setDate(new Date().getDate() - input.days)).toISOString().split('T')[0];
    }
    else if (input.since || input.until) {
        if (input.since)
            params.since = input.since;
        if (input.until)
            params.until = input.until;
    }
    let req;
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
    }
    else if (input.organization) {
        info(`Fetching Copilot usage for organization ${input.organization}`);
        req = octokit.rest.copilot.copilotMetricsForOrganization({
            org: input.organization,
            ...params
        }).then(response => response.data);
    }
    else {
        throw new Error("organization, enterprise or team input is required");
    }
    const data = await req;
    if (!data || data.length === 0) {
        return warning("No Copilot usage data found");
    }
    debug(JSON.stringify(data, null, 2));
    info(`Fetched Copilot usage data for ${data.length} days (${data[0].date} to ${data[data.length - 1].date})`);
    if (input.jobSummary) {
        setJobSummaryTimeZone(input.timeZone);
        const name = (input.team && input.organization) ? `${input.organization} / ${input.team}` : input.organization;
        await createJobSummaryUsage(data, name).write();
        if (input.organization && !input.team) {
            info(`Fetching Copilot details for organization ${input.organization}`);
            const orgCopilotDetails = await octokit.rest.copilot.getCopilotOrganizationDetails({
                org: input.organization
            }).then(response => response.data);
            if (orgCopilotDetails) {
                await createJobSummaryCopilotDetails(orgCopilotDetails).write();
            }
            setOutput("result-org-details", JSON.stringify(orgCopilotDetails));
            info(`Fetching Copilot seat assignments for organization ${input.organization}`);
            const orgSeatAssignments = await octokit.paginate(octokit.rest.copilot.listCopilotSeats, {
                org: input.organization
            });
            const _orgSeatAssignments = {
                total_seats: orgSeatAssignments[0]?.total_seats || 0,
                seats: (orgSeatAssignments).reduce((acc, rsp) => acc.concat(rsp.seats), [])
            };
            if (_orgSeatAssignments.total_seats > 0 && _orgSeatAssignments?.seats) {
                _orgSeatAssignments.seats = _orgSeatAssignments.seats.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
                await createJobSummarySeatAssignments(_orgSeatAssignments?.seats)?.write();
            }
            setOutput("result-seats", JSON.stringify(_orgSeatAssignments));
        }
        if (input.organization) {
            await summary.addLink(`Manage Access for ${input.organization}`, `https://github.com/organizations/${input.organization}/settings/copilot/seat_management`)
                .write();
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
//# sourceMappingURL=run.js.map