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

const explain = (status: number, message: string, route: string): string => {
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

export const fetchReport = async <T>(
  octokit: Octokit,
  route: string,
  params: Record<string, string> = {}
): Promise<T[]> => {
  debug(`Requesting report ${route} ${JSON.stringify(params)}`);
  let data: ReportResponse;
  try {
    ({ data } = await octokit.request(`GET ${route}`, params) as { data: ReportResponse });
  } catch (error) {
    const { status, message } = error as { status?: number; message: string };
    throw new Error(status ? explain(status, message, route) : message, { cause: error });
  }
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
