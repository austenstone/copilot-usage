import { test } from '@jest/globals';
import dotenv from 'dotenv'
dotenv.config({ override: true })
import { createJobSummarySeatAssignments, createJobSummarySeatInfo, createJobSummaryUsage } from '../src/job-summary';
import { summary } from '@actions/core/lib/summary';
import { exampleResponseEnterprise, exampleResponseOrg, exampleResponseTeam, exampleSeatAssignmentResponse, exampleSeatInfoResponse } from './mock/mock-data';
import { readFileSync } from 'fs';

const getSummaryBuffer = (_summary: typeof summary): string => {
  return (_summary as unknown as {
    _buffer: string,
    _filePath?: string;
  })._buffer
}

// beforeAll(async () => {
//   await createMockData();
// });

beforeEach(() => {
  summary.emptyBuffer();
});

test('createJobSummaryUsage(enterpriseUsage)', async () => {
  const summary = await createJobSummaryUsage(exampleResponseEnterprise);
  expect(summary).toBeDefined();
  expect(getSummaryBuffer(summary)).toEqual(readFileSync('./__tests__/mock/enterprise-usage-summary.md', 'utf-8'));
});

test('createJobSummaryUsage(orgUsage)', async () => {
  const summary = await createJobSummaryUsage(exampleResponseOrg);
  expect(summary).toBeDefined();
  expect(getSummaryBuffer(summary)).toEqual(readFileSync('./__tests__/mock/org-usage-summary.md', 'utf-8'));
});

test('createJobSummaryUsage(teamUsage)', async () => {
  const summary = await createJobSummaryUsage(exampleResponseTeam);
  expect(summary).toBeDefined();
  expect(getSummaryBuffer(summary)).toEqual(readFileSync('./__tests__/mock/team-usage-summary.md', 'utf-8'));
});

test('createJobSummarySeatInfo(orgSeatInfo)', async () => {
  const summary = await createJobSummarySeatInfo(exampleSeatInfoResponse);
  expect(summary).toBeDefined();
  expect(getSummaryBuffer(summary)).toEqual(readFileSync('./__tests__/mock/org-seat-info-summary.md', 'utf-8'));
});

test('createJobSummarySeatAssignments(orgSeatAssignments)', async () => {
  const summary = await createJobSummarySeatAssignments(exampleSeatAssignmentResponse);
  expect(summary).toBeDefined();
  expect(getSummaryBuffer(summary)).toEqual(readFileSync('./__tests__/mock/org-seat-assignments-summary.md', 'utf-8'));
});
