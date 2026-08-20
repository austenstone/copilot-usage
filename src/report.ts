import { debug, info } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { MetricsReport, ReportResponse, UserReportRecord, UserTeamRecord } from "./types";

export const parseNdjson = <T>(body: string): T[] =>
  body
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as T);

const downloadReport = async <T>(links: string[]): Promise<T[]> => {
  const results: T[] = [];
  for (const link of links) {
    const response = await fetch(link);
    if (!response.ok) {
      throw new Error(`Failed to download Copilot metrics report (${response.status} ${response.statusText})`);
    }
    results.push(...parseNdjson<T>(await response.text()));
  }
  return results;
};

export const fetchReport = async <T>(
  octokit: Octokit,
  route: string,
  params: Record<string, string> = {}
): Promise<T[]> => {
  debug(`Requesting report ${route} ${JSON.stringify(params)}`);
  const { data } = await octokit.request(`GET ${route}`, params) as { data: ReportResponse };
  if (!data?.download_links?.length) return [];
  info(`Downloading ${data.download_links.length} report file(s) for ${route}`);
  return downloadReport<T>(data.download_links);
};

const scope = (enterprise?: string, org?: string): { base: string; params: Record<string, string>; prefix: string } =>
  enterprise
    ? { base: "/enterprises/{enterprise}", params: { enterprise }, prefix: "enterprise" }
    : { base: "/orgs/{org}", params: { org: org as string }, prefix: "organization" };

export const fetchMetricsReport = async (
  octokit: Octokit,
  { enterprise, organization, day }: { enterprise?: string; organization?: string; day?: string }
): Promise<MetricsReport[]> => {
  const { base, params, prefix } = scope(enterprise, organization);
  return day
    ? fetchReport<MetricsReport>(octokit, `${base}/copilot/metrics/reports/${prefix}-1-day`, { ...params, day })
    : fetchReport<MetricsReport>(octokit, `${base}/copilot/metrics/reports/${prefix}-28-day/latest`, params);
};

export const fetchUserReport = async (
  octokit: Octokit,
  { enterprise, organization, day }: { enterprise?: string; organization?: string; day?: string }
): Promise<UserReportRecord[]> => {
  const { base, params } = scope(enterprise, organization);
  return day
    ? fetchReport<UserReportRecord>(octokit, `${base}/copilot/metrics/reports/users-1-day`, { ...params, day })
    : fetchReport<UserReportRecord>(octokit, `${base}/copilot/metrics/reports/users-28-day/latest`, params);
};

export const fetchUserTeams = async (
  octokit: Octokit,
  { enterprise, organization, day }: { enterprise?: string; organization?: string; day: string }
): Promise<UserTeamRecord[]> => {
  const { base, params } = scope(enterprise, organization);
  return fetchReport<UserTeamRecord>(octokit, `${base}/copilot/metrics/reports/user-teams-1-day`, { ...params, day });
};
