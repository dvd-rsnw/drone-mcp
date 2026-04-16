import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { DroneClient } from '../../src/drone-client.js';
import { getStepLogs } from '../../src/tools/get-step-logs.js';
import {
  mockServer,
  MOCK_DRONE_SERVER,
  MOCK_DRONE_TOKEN,
} from '../helpers/msw.js';

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new DroneClient({
  server: MOCK_DRONE_SERVER,
  token: MOCK_DRONE_TOKEN,
});

describe('getStepLogs', () => {
  it('returns lines as an array', async () => {
    const result = await getStepLogs(client, {
      repo: 'octocat/example-repo',
      build: 225,
      stage: 1,
      step: 7,
    });
    expect(Array.isArray(result.lines)).toBe(true);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.line_count).toBe(result.lines.length);
  });

  it('truncates when over max_lines, keeps the last N', async () => {
    const result = await getStepLogs(client, {
      repo: 'octocat/example-repo',
      build: 225,
      stage: 1,
      step: 7,
      max_lines: 5,
    });
    expect(result.lines.length).toBe(5);
    expect(result.truncated).toBe(true);
  });

  it('does not set truncated when under cap', async () => {
    const result = await getStepLogs(client, {
      repo: 'octocat/example-repo',
      build: 225,
      stage: 1,
      step: 7,
      max_lines: 10_000,
    });
    expect(result.truncated).toBe(false);
  });
});
