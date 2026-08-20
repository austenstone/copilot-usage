import { debug, getBooleanInput, getInput, info, setOutput, summary, warning } from "@actions/core";
import { Octokit } from '@octokit/rest';
import { DefaultArtifactClient } from "@actions/artifact";
import { writeFileSync } from "fs";
import { json2csv } from "json-2-csv";
import { toXML } from 'jstoxml';
import { createJobSummaryCopilotDetails, createJobSummarySeatAssignments, createJobSummaryUsage, setJobSummaryTimeZone } from "./job-summary";
import { fetchMetricsReport, fetchUserReport, fetchUserTeams } from "./report";
const getInputs = () => {
    const result = {};
    result.token = getInput("github-token").trim();
    result.enterprise = getInput("enterprise").trim();
    result.organization = getInput("organization").trim();
    result.team = getInput("team").trim();
    result.jobSummary = getBooleanInput("job-summary");
    const days = parseInt(getInput("days"));
    result.days = Number.isNaN(days) ? undefined : days;
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
    if (!result.enterprise && !result.organization) {
        throw new Error("enterprise or organization input is required");
    }
    if (result.enterprise && result.team) {
        throw new Error("team is only supported with the organization input");
    }
    return result;
};
const withinRange = (day, since, until) => (!since || day >= since) && (!until || day <= until);
const filterDays = (days, input) => {
    let since = input.since || undefined;
    const until = input.until || undefined;
    if (input.days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - input.days);
        since = cutoff.toISOString().split("T")[0];
    }
    const filtered = days.filter(day => withinRange(day.day, since, until));
    if (!filtered.length) {
        warning("No days matched the requested range; returning the full report instead");
        return days;
    }
    return filtered;
};
export const aggregateUsersToDays = (users) => {
    const byDay = new Map();
    const activeUsers = new Map();
    for (const user of users) {
        const day = byDay.get(user.day) || { day: user.day };
        day.user_initiated_interaction_count = (day.user_initiated_interaction_count || 0) + (user.user_initiated_interaction_count || 0);
        day.code_generation_activity_count = (day.code_generation_activity_count || 0) + (user.code_generation_activity_count || 0);
        day.code_acceptance_activity_count = (day.code_acceptance_activity_count || 0) + (user.code_acceptance_activity_count || 0);
        day.loc_added_sum = (day.loc_added_sum || 0) + (user.loc_added_sum || 0);
        day.loc_deleted_sum = (day.loc_deleted_sum || 0) + (user.loc_deleted_sum || 0);
        day.loc_suggested_to_add_sum = (day.loc_suggested_to_add_sum || 0) + (user.loc_suggested_to_add_sum || 0);
        day.loc_suggested_to_delete_sum = (day.loc_suggested_to_delete_sum || 0) + (user.loc_suggested_to_delete_sum || 0);
        day.totals_by_ide = [...(day.totals_by_ide || []), ...(user.totals_by_ide || [])];
        day.totals_by_feature = [...(day.totals_by_feature || []), ...(user.totals_by_feature || [])];
        day.totals_by_language_feature = [...(day.totals_by_language_feature || []), ...(user.totals_by_language_feature || [])];
        day.totals_by_model_feature = [...(day.totals_by_model_feature || []), ...(user.totals_by_model_feature || [])];
        const seen = activeUsers.get(user.day) || new Set();
        seen.add(user.user_id);
        activeUsers.set(user.day, seen);
        day.daily_active_users = seen.size;
        byDay.set(user.day, day);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
};
const getTeamMetrics = async (octokit, input) => {
    const organization = input.organization;
    const users = await fetchUserReport(octokit, { organization });
    if (!users.length)
        return [];
    const latestDay = users.reduce((latest, user) => user.day > latest ? user.day : latest, users[0].day);
    const memberships = await fetchUserTeams(octokit, { organization, day: latestDay });
    const teamMembers = new Set(memberships.filter(member => member.slug === input.team).map(member => member.user_id));
    if (!teamMembers.size) {
        warning(`No members found for team ${input.team} on ${latestDay}`);
        return [];
    }
    info(`Team ${input.team} has ${teamMembers.size} member(s) with Copilot activity data`);
    return aggregateUsersToDays(users.filter(user => teamMembers.has(user.user_id)));
};
const run = async () => {
    const input = getInputs();
    const octokit = new Octokit({
        auth: input.token
    });
    let days;
    if (input.team) {
        info(`Fetching Copilot metrics for team ${input.team} inside organization ${input.organization}`);
        days = await getTeamMetrics(octokit, input);
    }
    else {
        const target = input.enterprise ? `enterprise ${input.enterprise}` : `organization ${input.organization}`;
        info(`Fetching Copilot metrics for ${target}`);
        const reports = await fetchMetricsReport(octokit, {
            enterprise: input.enterprise || undefined,
            organization: input.organization || undefined
        });
        days = reports.flatMap(report => report.day_totals || []);
    }
    if (!days.length) {
        return warning("No Copilot usage data found");
    }
    const data = filterDays(days, input).sort((a, b) => a.day.localeCompare(b.day));
    debug(JSON.stringify(data, null, 2));
    info(`Fetched Copilot usage data for ${data.length} days (${data[0].day} to ${data[data.length - 1].day})`);
    if (input.jobSummary) {
        setJobSummaryTimeZone(input.timeZone);
        const name = input.enterprise
            ? input.enterprise
            : (input.team ? `${input.organization} / ${input.team}` : input.organization);
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
        const files = [];
        if (input.json) {
            writeFileSync('copilot-usage.json', JSON.stringify(data, null, 2));
            files.push('copilot-usage.json');
        }
        if (input.csv) {
            writeFileSync('copilot-usage.csv', await json2csv(data, input.csvOptions));
            files.push('copilot-usage.csv');
        }
        if (input.xml) {
            writeFileSync('copilot-usage.xml', await toXML(data, input.xmlOptions));
            files.push('copilot-usage.xml');
        }
        await artifact.uploadArtifact(input.artifactName, files, '.');
    }
    setOutput("result", JSON.stringify(data));
    setOutput("since", data[0].day);
    setOutput("until", data[data.length - 1].day);
    setOutput("days", data.length.toString());
};
export default run;
//# sourceMappingURL=run.js.map