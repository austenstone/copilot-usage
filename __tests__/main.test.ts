import { test, beforeAll, beforeEach, expect } from 'vitest';
import dotenv from 'dotenv'
dotenv.config({ override: true })
import { createJobSummaryCopilotDetails, createJobSummarySeatAssignments, createJobSummaryUsage } from '../src/job-summary';
import { sumNestedValue } from '../src/job-summary'; // Import sumNestedValue function
import { summary } from '@actions/core/lib/summary';
import { read, readFileSync, writeFileSync } from 'fs';

const getSummaryBuffer = (_summary: typeof summary): string => {
  return (_summary as unknown as {
    _buffer: string,
    _filePath?: string;
  })._buffer
}

beforeAll(async () => {
  // await createMockData();
});

beforeEach(() => {
  summary.emptyBuffer();
});

const sample = readFileSync('./__tests__/mock/sample.json', 'utf-8');
const exampleResponseEnterprise = JSON.parse(sample);
const sampleCopilotDetails = readFileSync('./__tests__/mock/sample-copilot-details.json', 'utf-8');
const exampleResponseCopilotDetails = JSON.parse(sampleCopilotDetails);
const sampleCopilotSeats = readFileSync('./__tests__/mock/sample-copilot-seats.json', 'utf-8');
const exampleResponseCopilotSeats = JSON.parse(sampleCopilotSeats);

test('createJobSummaryUsage(enterpriseUsage)', async () => {
  const summary = await createJobSummaryUsage(exampleResponseEnterprise, 'enterprise');
  writeFileSync('./__tests__/mock/sample-output.md', summary.stringify());
  expect(summary).toBeDefined();
});

test('createJobSummaryCopilotDetails(enterpriseUsage)', async () => {
  const summary = await createJobSummaryCopilotDetails(exampleResponseCopilotDetails);
  writeFileSync('./__tests__/mock/sample-copilot-details-output.md', summary.stringify());
  expect(summary).toBeDefined();
});

test('createJobSummaryCopilotSeats(enterpriseUsage)', async () => {
  const summary = await createJobSummarySeatAssignments(exampleResponseCopilotSeats.seats);
  writeFileSync('./__tests__/mock/sample-copilot-seats-output.md', summary.stringify());
  expect(summary).toBeDefined();
});


// Tests for sumNestedValue function
test('sumNestedValue with simple objects', () => {
  const data = [
    { a: { b: 10 } },
    { a: { b: 20 } },
    { a: { b: 30 } }
  ];
  expect(sumNestedValue(data, ['a', 'b'])).toBe(60);
});

test('sumNestedValue with missing paths', () => {
  const data = [
    { a: { b: 10 } },
    { a: { c: 20 } }, // Missing 'b' key
    { a: { b: 30 } }
  ];
  expect(sumNestedValue(data, ['a', 'b'])).toBe(40); // Should skip the object with missing path
});

test('sumNestedValue with deeply nested objects', () => {
  const data = [
    { level1: { level2: { level3: 100 } } },
    { level1: { level2: { level3: 200 } } }
  ];
  expect(sumNestedValue(data, ['level1', 'level2', 'level3'])).toBe(300);
});

test('sumNestedValue with non-numeric values', () => {
  const data = [
    { a: { b: 10 } },
    { a: { b: "20" } }, // String value instead of number
    { a: { b: 30 } }
  ];
  expect(sumNestedValue(data, ['a', 'b'])).toBe(40); // Should only sum numeric values
});

test('sumNestedValue with empty data array', () => {
  expect(sumNestedValue([], ['a', 'b'])).toBe(0); // Should return 0 for empty array
});

test('sumNestedValue with completely missing path', () => {
  const data = [
    { x: { y: 10 } },
    { x: { y: 20 } }
  ];
  expect(sumNestedValue(data, ['a', 'b'])).toBe(0); // Path doesn't exist at all
});

// New test for array traversal
test('sumNestedValue with array traversal', () => {
  const data = [
    { 
      a: { 
        items: [
          { value: 5 },
          { value: 10 }
        ] 
      } 
    },
    { 
      a: { 
        items: [
          { value: 15 },
          { value: 20 }
        ] 
      } 
    }
  ];
  expect(sumNestedValue(data, ['a', 'items', 'value'])).toBe(50); // Should sum all values in the arrays
});

test('sumNestedValue with exampleResponseEnterprise data', () => {
  // Test with real data paths
  const totalChatEngagedUsers = sumNestedValue(exampleResponseEnterprise, ['copilot_ide_chat', 'total_engaged_users']);
  expect(totalChatEngagedUsers).toBeGreaterThan(0);
  
  // Calculate total active users across all days
  const totalActiveUsers = sumNestedValue(exampleResponseEnterprise, ['total_active_users']);
  expect(totalActiveUsers).toBeGreaterThan(0);
  
  // Test with a more specific path - this needed to be adjusted to match the actual data structure
  const totalEngagedUsers = sumNestedValue(exampleResponseEnterprise, ['total_engaged_users']);
  expect(totalEngagedUsers).toBeGreaterThan(0);
  
  // Test a path that should return 0 (non-existent path)
  const nonExistentPath = sumNestedValue(exampleResponseEnterprise, ['non', 'existent', 'path']);
  expect(nonExistentPath).toBe(0);
});
