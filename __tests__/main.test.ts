import { test, describe, it, beforeEach, expect } from 'vitest';
import dotenv from 'dotenv'
dotenv.config({ override: true })
import { createJobSummaryCopilotDetails, createJobSummarySeatAssignments, createJobSummaryUsage, groupTotals, sumActivity } from '../src/job-summary';
import { parseNdjson, fetchReport } from '../src/report';
import { aggregateUsersToDays } from '../src/run';
import { DayTotals, MetricsReport, UserReportRecord } from '../src/types';
import { summary } from '@actions/core';
import { readFileSync, writeFileSync } from 'fs';

beforeEach(() => {
  summary.emptyBuffer();
});

const report = parseNdjson<MetricsReport>(
  readFileSync('./__tests__/mock/sample-metrics-report.ndjson', 'utf-8')
);
const days: DayTotals[] = report.flatMap(entry => entry.day_totals || []);
const exampleResponseCopilotDetails = JSON.parse(readFileSync('./__tests__/mock/sample-copilot-details.json', 'utf-8'));
const exampleResponseCopilotSeats = JSON.parse(readFileSync('./__tests__/mock/sample-copilot-seats.json', 'utf-8'));

test('parseNdjson yields one report with day totals', () => {
  expect(report.length).toBeGreaterThan(0);
  expect(days.length).toBeGreaterThan(0);
  expect(days[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('createJobSummaryUsage(orgUsage)', async () => {
  const result = createJobSummaryUsage(days, 'octodemo');
  writeFileSync('./__tests__/mock/sample-output.md', result.stringify());
  expect(result.stringify()).toContain('Copilot Usage');
  expect(result.stringify()).toContain('octodemo');
});

test('createJobSummaryUsage renders totals and charts', () => {
  const output = createJobSummaryUsage(days, 'octodemo').stringify();
  expect(output).toContain('xychart-beta');
  expect(output).toContain('Acceptance Rate');
});

test('createJobSummaryUsage handles a single day', () => {
  const output = createJobSummaryUsage(days.slice(0, 1), 'octodemo').stringify();
  expect(output).toContain('Copilot Usage');
});

test('createJobSummaryCopilotDetails(orgDetails)', () => {
  const result = createJobSummaryCopilotDetails(exampleResponseCopilotDetails);
  writeFileSync('./__tests__/mock/sample-copilot-details-output.md', result.stringify());
  expect(result).toBeDefined();
});

test('createJobSummaryCopilotSeats(orgSeats)', () => {
  const result = createJobSummarySeatAssignments(exampleResponseCopilotSeats.seats);
  writeFileSync('./__tests__/mock/sample-copilot-seats-output.md', result.stringify());
  expect(result).toBeDefined();
});

test('sumActivity totals a numeric field across days', () => {
  const input = [
    { day: '2026-01-01', user_initiated_interaction_count: 10 },
    { day: '2026-01-02', user_initiated_interaction_count: 5 },
    { day: '2026-01-03' }
  ] as DayTotals[];
  expect(sumActivity(input, 'user_initiated_interaction_count')).toBe(15);
});

test('sumActivity returns 0 for an empty list', () => {
  expect(sumActivity([], 'code_generation_activity_count')).toBe(0);
});

test('sumActivity matches the fixture', () => {
  expect(sumActivity(days, 'user_initiated_interaction_count')).toBeGreaterThan(0);
  expect(sumActivity(days, 'code_generation_activity_count')).toBeGreaterThan(0);
});

test('groupTotals merges rows sharing a key', () => {
  const grouped = groupTotals([
    { ide: 'vscode', user_initiated_interaction_count: 5, code_generation_activity_count: 2 },
    { ide: 'vscode', user_initiated_interaction_count: 3, code_generation_activity_count: 1 },
    { ide: 'jetbrains', user_initiated_interaction_count: 4, code_generation_activity_count: 0 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any[], row => row.ide);
  expect(grouped['vscode']).toBe(2 + 1);
  expect(grouped['jetbrains']).toBe(0);
});

test('groupTotals buckets rows with a missing key under "unknown"', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped = groupTotals([{ code_generation_activity_count: 5 }] as any[], row => (row as { ide?: string }).ide as string);
  expect(grouped['unknown']).toBe(5);
});

test('aggregateUsersToDays rolls user records into day totals', () => {
  const users = [
    { day: '2026-01-01', user_id: 1, user_initiated_interaction_count: 4, loc_added_sum: 10 },
    { day: '2026-01-01', user_id: 2, user_initiated_interaction_count: 6, loc_added_sum: 5 },
    { day: '2026-01-02', user_id: 1, user_initiated_interaction_count: 2, loc_added_sum: 1 }
  ] as UserReportRecord[];
  const aggregated = aggregateUsersToDays(users);
  expect(aggregated).toHaveLength(2);
  expect(aggregated[0].user_initiated_interaction_count).toBe(10);
  expect(aggregated[0].daily_active_users).toBe(2);
  expect(aggregated[0].loc_added_sum).toBe(15);
  expect(aggregated[1].daily_active_users).toBe(1);
});

test('aggregateUsersToDays returns an empty array for no users', () => {
  expect(aggregateUsersToDays([])).toEqual([]);
});

test('aggregateUsersToDays counts weekly and monthly actives over trailing windows', () => {
  const users = [
    { day: '2026-01-01', user_id: 1 },
    { day: '2026-01-02', user_id: 2 },
    { day: '2026-01-20', user_id: 3 }
  ] as UserReportRecord[];
  const [first, second, third] = aggregateUsersToDays(users);

  expect(first.weekly_active_users).toBe(1);
  expect(second.daily_active_users).toBe(1);
  expect(second.weekly_active_users).toBe(2);
  expect(second.monthly_active_users).toBe(2);

  expect(third.weekly_active_users).toBe(1);
  expect(third.monthly_active_users).toBe(3);
});

test('aggregateUsersToDays drops users outside the trailing monthly window', () => {
  const users = [
    { day: '2026-01-01', user_id: 1 },
    { day: '2026-03-01', user_id: 2 }
  ] as UserReportRecord[];
  const [, later] = aggregateUsersToDays(users);
  expect(later.monthly_active_users).toBe(1);
});

describe('error messages', () => {
  const failing = (status: number, message: string) => ({
    request: () => Promise.reject(Object.assign(new Error(message), { status }))
  }) as never;

  it('explains an expired token', async () => {
    await expect(fetchReport(failing(401, 'Bad credentials'), '/orgs/{org}/x'))
      .rejects.toThrow(/read:org/);
  });

  it('explains a disabled metrics policy', async () => {
    await expect(fetchReport(failing(403, "The 'Copilot usage metrics' policy must be enabled"), '/orgs/{org}/x'))
      .rejects.toThrow(/policy is disabled/);
  });

  it('explains a missing slug', async () => {
    await expect(fetchReport(failing(404, 'Not Found'), '/orgs/{org}/x'))
      .rejects.toThrow(/slug is correct/);
  });
});
