import { summary } from "@actions/core";
import { Endpoints } from "@octokit/types";
import { createPieChart, createXYChart } from "./mermaid";
import { dateFormat } from "./utility";
import { ActivityTotals, DayTotals, FeatureTotals, IdeTotals, LanguageFeatureTotals, ModelFeatureTotals, PullRequestTotals } from "./types";

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const sumActivity = (days: DayTotals[], key: keyof ActivityTotals): number =>
  sum(days.map(day => Number(day[key]) || 0));

export const groupTotals = <T extends ActivityTotals>(
  rows: T[],
  keyOf: (row: T) => string,
  metric: keyof ActivityTotals = "code_generation_activity_count"
): Record<string, number> =>
  rows.reduce((acc, row) => {
    const key = keyOf(row) || "unknown";
    acc[key] = (acc[key] || 0) + (Number(row[metric]) || 0);
    return acc;
  }, {} as Record<string, number>);

const flatten = <T>(days: DayTotals[], key: keyof DayTotals): T[] =>
  days.flatMap(day => (day[key] as unknown as T[] | undefined) || []);

// GitHub occasionally returns an editor version string in place of the IDE name
const isVersionLabel = (label: string) => /^[\d.]+:?$/.test(label);

const cleanLabel = (label: string) => (!label || isVersionLabel(label) ? "unknown" : label);

const withoutZeroes = (totals: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(totals).filter(([, value]) => value > 0));

const percent = (numerator: number, denominator: number) =>
  denominator > 0 ? `${((numerator / denominator) * 100).toFixed(2)}%` : "N/A";

const sumPullRequests = (days: DayTotals[], key: keyof PullRequestTotals): number =>
  sum(days.map(day => Number(day.pull_requests?.[key]) || 0));

const dailyCategories = (days: DayTotals[]) => days.map(day => dateFormat(day.day, { day: "numeric" }));

export const createJobSummaryUsage = (days: DayTotals[], name: string) => {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted[sorted.length - 1];

  const generations = sumActivity(sorted, "code_generation_activity_count");
  const acceptances = sumActivity(sorted, "code_acceptance_activity_count");
  const interactions = sumActivity(sorted, "user_initiated_interaction_count");
  const locAdded = sumActivity(sorted, "loc_added_sum");
  const locDeleted = sumActivity(sorted, "loc_deleted_sum");

  const categories = dailyCategories(sorted);
  const ideTotals = withoutZeroes(groupTotals(flatten<IdeTotals>(sorted, "totals_by_ide"), row => cleanLabel(row.ide)));
  const featureTotals = withoutZeroes(groupTotals(flatten<FeatureTotals>(sorted, "totals_by_feature"), row => row.feature));
  const languageTotals = withoutZeroes(groupTotals(flatten<LanguageFeatureTotals>(sorted, "totals_by_language_feature"), row => row.language));
  const modelTotals = withoutZeroes(groupTotals(flatten<ModelFeatureTotals>(sorted, "totals_by_model_feature"), row => row.model));

  const cliSessions = sum(sorted.map(day => day.totals_by_cli?.session_count || 0));
  const appSessions = sum(sorted.map(day => day.totals_by_copilot_app?.session_count || 0));

  let report = summary
    .addHeading(`Copilot Usage for ${name}<br>${dateFormat(sorted[0].day)} - ${dateFormat(latest.day)}`)
    .addRaw(`Metrics for the last ${sorted.length} days`)
    .addHeading("Totals", 2)
    .addTable([
      ["Active Users (latest day)", (latest.daily_active_users || 0).toLocaleString()],
      ["Active Users (28 day)", (latest.monthly_active_users || 0).toLocaleString()],
      ["User Initiated Interactions", interactions.toLocaleString()],
      ["Code Generation Activities", generations.toLocaleString()],
      ["Code Acceptance Activities", acceptances.toLocaleString()],
      ["Acceptance Rate", percent(acceptances, generations)],
      ["Lines of Code Added", locAdded.toLocaleString()],
      ["Lines of Code Deleted", locDeleted.toLocaleString()],
      ["CLI Sessions", cliSessions.toLocaleString()],
      ["Copilot App Sessions", appSessions.toLocaleString()]
    ])
    .addHeading("Daily Active Users", 3)
    .addRaw(createXYChart({
      xAxis: { categories },
      yAxis: {},
      series: [
        { type: "bar", values: sorted.map(day => day.daily_active_users || 0) },
        { type: "line", values: sorted.map(day => day.weekly_active_users || 0) }
      ],
      legend: ["Daily Active", "Weekly Active"]
    }))
    .addHeading("Daily Active Users by Surface", 3)
    .addRaw(createXYChart({
      xAxis: { categories },
      yAxis: {},
      series: [
        { type: "line", values: sorted.map(day => day.daily_active_copilot_app_users || 0) },
        { type: "line", values: sorted.map(day => day.daily_active_cli_users || 0) },
        { type: "line", values: sorted.map(day => day.daily_active_copilot_cloud_agent_users || 0) },
        { type: "line", values: sorted.map(day => day.daily_active_copilot_code_review_users || 0) }
      ],
      legend: ["Copilot App", "CLI", "Cloud Agent", "Code Review"]
    }))
    .addHeading("Code Activity", 2)
    .addHeading("Generations vs. Acceptances", 3)
    .addRaw(createXYChart({
      xAxis: { categories },
      yAxis: {},
      series: [
        { type: "bar", values: sorted.map(day => day.code_generation_activity_count || 0) },
        { type: "bar", values: sorted.map(day => day.code_acceptance_activity_count || 0) }
      ],
      legend: ["Generations", "Acceptances"]
    }))
    .addHeading("Lines of Code", 3)
    .addRaw(createXYChart({
      xAxis: { categories },
      yAxis: {},
      series: [
        { type: "bar", values: sorted.map(day => day.loc_added_sum || 0) },
        { type: "bar", values: sorted.map(day => day.loc_deleted_sum || 0) }
      ],
      legend: ["Lines Added", "Lines Deleted"]
    }))
    .addHeading("Acceptance Rate", 3)
    .addRaw(createXYChart({
      xAxis: { categories },
      yAxis: { min: 0, max: 100 },
      series: [{
        type: "line",
        values: sorted.map(day => {
          const generated = day.code_generation_activity_count || 0;
          const accepted = day.code_acceptance_activity_count || 0;
          return generated > 0 ? Math.round((accepted / generated) * 100) : 0;
        })
      }]
    }));

  if (Object.keys(languageTotals).length) {
    report = report.addHeading("Language Usage", 3).addRaw(createPieChart(languageTotals));
  }
  if (Object.keys(ideTotals).length) {
    report = report.addHeading("IDE Usage", 3).addRaw(createPieChart(ideTotals));
  }
  if (Object.keys(featureTotals).length) {
    report = report.addHeading("Feature Usage", 3).addRaw(createPieChart(featureTotals));
  }
  if (Object.keys(modelTotals).length) {
    report = report.addHeading("Model Usage", 3).addRaw(createPieChart(modelTotals));
  }

  const prCreated = sumPullRequests(sorted, "total_created");
  if (prCreated > 0 || sumPullRequests(sorted, "total_reviewed") > 0) {
    report = report
      .addHeading("Pull Requests", 2)
      .addTable([
        ["Created", prCreated.toLocaleString()],
        ["Created by Copilot", sumPullRequests(sorted, "total_created_by_copilot").toLocaleString()],
        ["Reviewed", sumPullRequests(sorted, "total_reviewed").toLocaleString()],
        ["Reviewed by Copilot", sumPullRequests(sorted, "total_reviewed_by_copilot").toLocaleString()],
        ["Merged", sumPullRequests(sorted, "total_merged").toLocaleString()],
        ["Copilot Suggestions", sumPullRequests(sorted, "total_copilot_suggestions").toLocaleString()],
        ["Copilot Suggestions Applied", sumPullRequests(sorted, "total_copilot_applied_suggestions").toLocaleString()]
      ]);
  }

  const phases = latest.totals_by_ai_adoption_phase || [];
  if (phases.length) {
    report = report
      .addHeading("AI Adoption Phases", 2)
      .addTable([
        [
          { data: "Phase", header: true },
          { data: "Engaged Users", header: true },
          { data: "Avg Interactions", header: true },
          { data: "Avg Generations", header: true },
          { data: "Avg Acceptances", header: true }
        ],
        ...phases.map(phase => [
          phase.phase,
          (phase.total_engaged_users || 0).toLocaleString(),
          String(phase.avg_user_initiated_interactions ?? 0),
          String(phase.avg_code_generation_activities ?? 0),
          String(phase.avg_code_acceptance_activities ?? 0)
        ])
      ]);
  }

  return report;
};

export const createJobSummaryCopilotDetails = (orgCopilotDetails: Endpoints["GET /orgs/{org}/copilot/billing"]["response"]["data"]) => {
  return summary
    .addHeading('Seat Info')
    .addHeading('Organization Copilot Details', 3)
    .addTable([
      ['Plan Type', orgCopilotDetails.plan_type?.toLocaleUpperCase() || 'Unknown'],
      ['Seat Management Setting', {
        'assign_all': 'Assign All',
        'assign_selected': 'Assign Selected',
        'disabled': 'Disabled',
        'unconfigured': 'Unconfigured',
      }[orgCopilotDetails.seat_management_setting] || 'Unknown'],
    ])
    .addHeading('Seat Breakdown', 3)
    .addTable([
      ['Total Seats', (orgCopilotDetails.seat_breakdown.total || 0).toString()],
      ['Added this cycle', (orgCopilotDetails.seat_breakdown.added_this_cycle || 0).toString()],
      ['Pending invites', (orgCopilotDetails.seat_breakdown.pending_invitation || 0).toString()],
      ['Pending cancellations', (orgCopilotDetails.seat_breakdown.pending_cancellation || 0).toString()],
      ['Active this cycle', (orgCopilotDetails.seat_breakdown.active_this_cycle || 0).toString()],
      ['Inactive this cycle', (orgCopilotDetails.seat_breakdown.inactive_this_cycle || 0).toString()]
    ])
    .addHeading('Policies', 3)
    .addTable([
      ['Public Code Suggestions Enabled', {
        'allow': 'Allowed',
        'block': 'Blocked',
        'unconfigured': 'Unconfigured',
      }[orgCopilotDetails.public_code_suggestions] || 'Unknown'],
      ['IDE Chat Enabled', orgCopilotDetails.ide_chat?.toLocaleUpperCase() || 'Unknown'],
      ['Platform Chat Enabled', orgCopilotDetails.platform_chat?.toLocaleUpperCase() || 'Unknown'],
      ['CLI Enabled', orgCopilotDetails.cli?.toLocaleUpperCase() || 'Unknown'],
    ])
};

// GitHub rejects job summaries over 1MiB, and a large seat table can single-handedly
// blow that budget and take the usage report down with it
const MAX_SEAT_ROWS = 1000;

export const createJobSummarySeatAssignments = (data: Endpoints["GET /orgs/{org}/copilot/billing/seats"]["response"]["data"]["seats"]) => {
  if (!data) data = [];
  const seats = data.slice(0, MAX_SEAT_ROWS);
  const report = summary
    .addHeading('Seat Assignments')
    .addTable([
      [
        { data: 'Avatar', header: true },
        { data: 'Login', header: true },
        { data: `Last Activity (${process.env.TZ || 'UTC'})`, header: true },
        { data: 'Last Editor Used', header: true },
        { data: 'Created At', header: true },
        { data: 'Pending Cancellation Date', header: true },
        { data: 'Team', header: true },
      ],
      ...seats.map(seat => [
        `<img src="${seat.assignee?.avatar_url}" width="33" />`,
        seat.assignee?.login,
        seat.last_activity_at ? dateFormat(seat.last_activity_at, { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }) : 'No Activity',
        seat.last_activity_editor || 'N/A',
        dateFormat(seat.created_at),
        dateFormat(seat.pending_cancellation_date || ''),
        String(seat.assigning_team?.name || ' '),
      ] as string[])
    ]);
  return data.length > seats.length
    ? report.addRaw(`Showing the ${seats.length.toLocaleString()} most recently active seats of ${data.length.toLocaleString()}. Enable the <code>json</code> input to export them all.`)
    : report;
}

export const setJobSummaryTimeZone = (timeZone: string) => process.env.TZ = timeZone;
