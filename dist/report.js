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
export const fetchReport = async (octokit, route, params = {}) => {
    debug(`Requesting report ${route} ${JSON.stringify(params)}`);
    const { data } = await octokit.request(`GET ${route}`, params);
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