import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { DroneClient } from '../../src/drone-client.js';
import { getLatestBuild } from '../../src/tools/get-latest-build.js';
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

describe('getLatestBuild', () => {
  it('returns the highest-numbered build matching the branch', async () => {
    // The fixture contains build 225 (PR, source=feature-branch, target=dev)
    const result = await getLatestBuild(client, {
      repo: 'octocat/example-repo',
      branch: 'feature-branch',
    });
    expect(result.number).toBe(225);
    expect(result.event).toBe('pull_request');
    expect(result.stages_summary).toBeDefined();
  });

  it('filters by event when provided', async () => {
    // Asking for a build on main with event=cron should match build 226
    const result = await getLatestBuild(client, {
      repo: 'octocat/example-repo',
      branch: 'main',
      event: 'cron',
    });
    expect(result.number).toBe(226);
    expect(result.event).toBe('cron');
  });

  it('throws NotFoundError when no builds match the branch', async () => {
    await expect(
      getLatestBuild(client, {
        repo: 'octocat/example-repo',
        branch: 'no-such-branch-xyz',
      }),
    ).rejects.toThrow(/no builds found/i);
  });
});
