import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { DroneClient } from '../../src/drone-client.js';
import { restartBuild } from '../../src/tools/restart-build.js';
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

describe('restartBuild tool', () => {
  it('returns the new build with status pending', async () => {
    const result = await restartBuild(client, {
      repo: 'octocat/example-repo',
      build: 225,
    });
    expect(result.status).toBe('pending');
  });
});
