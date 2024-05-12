import { debug, getBooleanInput, getInput, info, setOutput } from "@actions/core";
import { getOctokit } from "@actions/github";
import { DefaultArtifactClient } from "@actions/artifact";
import { writeFileSync } from "fs";
import { json2csv } from "json-2-csv";
import { toXML } from 'jstoxml';
import { createJobSummaryFooter, createJobSummarySeatAssignments, createJobSummarySeatInfo, createJobSummaryUsage } from "./job-summary";
import { warn } from "console";
const getInputs = () => {
    const result = {};
    result.token = getInput("github-token").trim();
    result.organization = getInput("organization").trim();
    result.enterprise = getInput("enterprise").trim();
    result.team = getInput("team").trim();
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
    if (!result.token) {
        throw new Error("github-token is required");
    }
    return result;
};
const run = async () => {
    const input = getInputs();
    const octokit = getOctokit(input.token);
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
    if (input.enterprise) {
        info(`Fetching Copilot usage for enterprise ${input.enterprise}`);
        req = octokit.paginate("GET /enterprises/{enterprise}/copilot/usage", {
            enterprise: input.enterprise,
            ...params
        });
    }
    else if (input.team) {
        if (!input.organization) {
            throw new Error("organization is required when team is provided");
        }
        info(`Fetching Copilot usage for team ${input.team} inside organization ${input.organization}`);
        req = octokit.paginate("GET /orgs/{org}/team/{team}/copilot/usage", {
            org: input.organization,
            team: input.team,
            ...params
        });
    }
    else if (input.organization) {
        info(`Fetching Copilot usage for organization ${input.organization}`);
        req = octokit.paginate("GET /orgs/{org}/copilot/usage", {
            org: input.organization,
            ...params
        });
    }
    else {
        throw new Error("organization, enterprise or team input is required");
    }
    const data = await req;
    if (!data || data.length === 0) {
        return warn("No Copilot usage data found");
    }
    debug(JSON.stringify(data, null, 2));
    info(`Fetched Copilot usage data for ${data.length} days (${data[0].day} to ${data[data.length - 1].day})`);
    if (input.jobSummary) {
        await createJobSummaryUsage(data).write();
        if (input.organization && !input.team) {
            info(`Fetching Copilot details for organization ${input.organization}`);
            const orgSeatInfo = await octokit.rest.copilot.getCopilotOrganizationDetails({
                org: input.organization
            });
            if (orgSeatInfo?.data) {
                await createJobSummarySeatInfo(orgSeatInfo.data).write();
            }
            info(`Fetching Copilot seat assignments for organization ${input.organization}`);
            const orgSeatAssignments = await octokit.rest.copilot.listCopilotSeats({
                org: input.organization
            });
            if (orgSeatAssignments?.data?.seats) {
                await createJobSummarySeatAssignments(orgSeatAssignments.data.seats)?.write();
            }
        }
        if (input.organization) {
            (await createJobSummaryFooter(input.organization)).write();
        }
    }
    if (input.csv || input.xml) {
        const artifact = new DefaultArtifactClient();
        if (input.csv) {
            writeFileSync('copilot-usage.csv', await json2csv(data, input.csvOptions));
            await artifact.uploadArtifact('copilot-usage', ['copilot-usage.csv'], '.');
        }
        if (input.xml) {
            writeFileSync('copilot-usage.xml', await toXML(data, input.xmlOptions));
            await artifact.uploadArtifact('copilot-usage', ['copilot-usage.xml'], '.');
        }
    }
    setOutput("result", JSON.stringify(data));
    setOutput("since", data[0].day);
    setOutput("until", data[data.length - 1].day);
    setOutput("days", data.length.toString());
};
export default run;
//# sourceMappingURL=run.js.map