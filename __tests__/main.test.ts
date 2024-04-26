import * as process from 'process';
import * as path from 'path';
import { test } from '@jest/globals';

import run from "../src/run";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

const addInput = (key, value) => process.env[`INPUT_${key.replace(/ /g, '-').toUpperCase()}`] = value || ''
const removeInput = (key) => delete process.env[`INPUT_${key.replace(/ /g, '-').toUpperCase()}`]

const input: any = {
  'github-token': process.env.GITHUB_TOKEN,
  'job-summary': 'false',
  'csv': 'false',
  'xml': 'false',
  'ACTIONS_RUNTIME_TOKEN': 'token',
}

const organization = process.env.GITHUB_ORG;
beforeEach(() => {
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('INPUT_')) delete process.env[key];
  });
  Object.entries(input).forEach(([key, value]) => addInput(key, value));
  process.env['GITHUB_REPOSITORY'] = `austenstone/${path.basename(process.cwd())}`;
});

test('test run with github organization', async () => {
  addInput('organization', organization);
  await run();
});

test('test run with github team', async () => {
  addInput('organization', organization);
  addInput('team', 'corporate-solutions-eng');
  await run();
});

test('test run with github enterprise', async () => {
  addInput('enterprise', organization); // same name as organization
  await run();
});

test('test run job summary', async () => {
  const fileName = 'copilot-usage.md';
  writeFileSync(fileName, '');
  process.env['GITHUB_STEP_SUMMARY'] = fileName;
  addInput('organization', organization);
  addInput('job-summary', 'true');
  await run();
  expect(existsSync(fileName)).toBe(true);
  expect(readFileSync(fileName).toString()).toContain('Copilot Usage');
  unlinkSync(fileName);
});

test('test run csv', async () => {
  const fileName = "copilot-usage.csv";
  const numDays = 20;
  addInput('organization', organization);
  addInput('csv', 'true');
  addInput('days', numDays.toString());
  await run();
  expect(existsSync(fileName)).toBe(true);
  const csv = readFileSync(fileName).toString();
  expect(csv).toContain('day,total_suggestions_count,total_acceptances_count,total_lines_suggested,total_lines_accepted,total_active_users,total_chat_acceptances,total_chat_turns,total_active_chat_users,breakdown');
  expect(csv.split('\n').length).toEqual(numDays);
  unlinkSync(fileName);
});

test('test run with xml', async () => {
  addInput('organization', organization);
  addInput('xml', 'true');
  await run();
  expect(existsSync('copilot-usage.xml')).toBe(true);
  unlinkSync('copilot-usage.xml');
});

test('test run with no org, team, or enterprise', async () => {
  await expect(run()).rejects.toThrow('organization, enterprise or team is required');
});

test('test run with no token', async () => {
  removeInput('github-token');
  await expect(run()).rejects.toThrow('github-token is required');
});

test('test get only 7 days of data', async () => {
  const fileName = "copilot-usage.csv";
  const numDays = 7;
  addInput('organization', organization);
  addInput('csv', 'true');
  addInput('days', numDays.toString());
  await run();
  expect(existsSync(fileName)).toBe(true);
  const csv = readFileSync(fileName).toString();
  expect(csv.split('\n').length - 1).toEqual(numDays);
});

test('test get data since a specific date', async () => {
  const fileName = "copilot-usage.csv";
  const since = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
  addInput('organization', organization);
  addInput('csv', 'true');
  addInput('since', since);
  await run();
  expect(existsSync(fileName)).toBe(true);
  const csv = readFileSync(fileName).toString();
  expect(csv.split('\n').length - 1).toEqual(7);
});

test('test get data since and until a specific date', async () => {
  const fileName = "copilot-usage.csv";
  const since = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
  const until = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
  addInput('organization', organization);
  addInput('csv', 'true');
  addInput('since', since);
  addInput('until', until);
  await run();
  expect(existsSync(fileName)).toBe(true);
  const csv = readFileSync(fileName).toString();
  expect(csv.split('\n').length - 1).toEqual(6);
});