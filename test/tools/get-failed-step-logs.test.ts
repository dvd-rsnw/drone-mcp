import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { DroneClient } from '../../src/drone-client.js';
import { getFailedStepLogs } from '../../src/tools/get-failed-step-logs.js';
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

describe('getFailedStepLogs', () => {
  it('returns logs for every failed step in a failed build', async () => {
    const result = await getFailedStepLogs(client, {
      repo: 'octocat/example-repo',
      build: 225,
    });
    expect(result.status).toBe('failure');
    expect(result.build_number).toBe(225);
    expect(result.failures.length).toBeGreaterThanOrEqual(1);
    const firstFailure = result.failures[0];
    expect(firstFailure.step_name).toBe('run_tests');
    expect(firstFailure.exit_code).toBe(1);
    expect(firstFailure.logs.lines.length).toBeGreaterThan(0);
  });
});
