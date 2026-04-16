import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { DroneClient } from '../src/drone-client.js';
import { AuthError, NotFoundError } from '../src/errors.js';
import {
  mockServer,
  MOCK_DRONE_SERVER,
  MOCK_DRONE_TOKEN,
} from './helpers/msw.js';

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new DroneClient({
  server: MOCK_DRONE_SERVER,
  token: MOCK_DRONE_TOKEN,
});

describe('DroneClient', () => {
  it('listBuilds returns parsed array', async () => {
    const builds = await client.listBuilds('octocat/example-repo', { perPage: 10 });
    expect(Array.isArray(builds)).toBe(true);
    expect(builds.length).toBeGreaterThan(0);
    expect(builds[0]).toHaveProperty('number');
    expect(builds[0]).toHaveProperty('status');
  });

  it('getBuild returns detail with stages', async () => {
    const build = await client.getBuild('octocat/example-repo', 225);
    expect(build.number).toBe(225);
    expect(build.stages).toBeDefined();
    expect(build.stages!.length).toBeGreaterThan(0);
    expect(build.stages![0].steps).toBeDefined();
  });

  it('getStepLogs returns log entries', async () => {
    const logs = await client.getStepLogs('octocat/example-repo', 225, 1, 7);
    expect(Array.isArray(logs)).toBe(true);
    expect(logs[0]).toHaveProperty('out');
  });

  it('throws AuthError on 401', async () => {
    const bad = new DroneClient({
      server: MOCK_DRONE_SERVER,
      token: 'wrong',
    });
    await expect(bad.listBuilds('octocat/example-repo')).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it('throws NotFoundError on 404', async () => {
    await expect(
      client.getBuild('octocat/example-repo', 9999),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('restartBuild POSTs and returns the new build', async () => {
    const result = await client.restartBuild('octocat/example-repo', 225);
    expect(result.status).toBe('pending');
  });

  it('restartBuild forwards params as query string', async () => {
    const result = await client.restartBuild('octocat/example-repo', 225, {
      FOO: 'bar',
      BAZ: 'qux',
    });
    expect((result as unknown as { _echo_params: Record<string, string> })._echo_params).toEqual({
      FOO: 'bar',
      BAZ: 'qux',
    });
  });
});
