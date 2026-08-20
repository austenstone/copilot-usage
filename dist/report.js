import { debug, info } from "@actions/core";
export const parseNdjson = (body) => body
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
const downloadReport = async (links) => {
    const results = [];
    for (const link of links) {
        const response = await fetch(link);
        if (!response.ok) {
            throw new Error(`Failed to download Copilot metrics report (${response.status} ${response.statusText})`);
        }
        results.push(...parseNdjson(await response.text()));
    }
    return results;
};
const explain = (status, message, route) => {
    switch (status) {
        case 401:
            return "The github-token is invalid or expired. Copilot metrics cannot be read with the default GITHUB_TOKEN, so supply a PAT with read:org (organization) or manage_billing:copilot / read:enterprise (enterprise).";
        case 403:
            return message.includes("policy")
                ? "The 'Copilot usage metrics' policy is disabled. An owner must enable it under Copilot policies before this API returns data."
                : `The github-token lacks permission for ${route}. Organization reports need read:org, enterprise reports need manage_billing:copilot or read:enterprise.`;
        case 404:
            return `${route} was not found. Check the organization or enterprise slug is correct and that the token can see it.`;
        default:
            return message;
    }
};
export const fetchReport = async (octokit, route, params = {}) => {
    debug(`Requesting report ${route} ${JSON.stringify(params)}`);
    let data;
    try {
        ({ data } = await octokit.request(`GET ${route}`, params));
    }
    catch (error) {
        const { status, message } = error;
        throw new Error(status ? explain(status, message, route) : message, { cause: error });
    }
    if (!data?.download_links?.length)
        return [];
    info(`Downloading ${data.download_links.length} report file(s) for ${route}`);
    return downloadReport(data.download_links);
};
const scope = (enterprise, org) => enterprise
    ? { base: "/enterprises/{enterprise}", params: { enterprise }, prefix: "enterprise" }
    : { base: "/orgs/{org}", params: { org: org }, prefix: "organization" };
export const fetchMetricsReport = async (octokit, { enterprise, organization, day }) => {
    const { base, params, prefix } = scope(enterprise, organization);
    return day
        ? fetchReport(octokit, `${base}/copilot/metrics/reports/${prefix}-1-day`, { ...params, day })
        : fetchReport(octokit, `${base}/copilot/metrics/reports/${prefix}-28-day/latest`, params);
};
export const fetchUserReport = async (octokit, { enterprise, organization, day }) => {
    const { base, params } = scope(enterprise, organization);
    return day
        ? fetchReport(octokit, `${base}/copilot/metrics/reports/users-1-day`, { ...params, day })
        : fetchReport(octokit, `${base}/copilot/metrics/reports/users-28-day/latest`, params);
};
export const fetchUserTeams = async (octokit, { enterprise, organization, day }) => {
    const { base, params } = scope(enterprise, organization);
    return fetchReport(octokit, `${base}/copilot/metrics/reports/user-teams-1-day`, { ...params, day });
};
//# sourceMappingURL=report.js.map