import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { DroneClient } from '../../src/drone-client.js';
import { getBuild } from '../../src/tools/get-build.js';
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

describe('getBuild', () => {
  it('returns the full build detail with stages/steps', async () => {
    const result = await getBuild(client, {
      repo: 'octocat/example-repo',
      build: 225,
    });
    expect(result.number).toBe(225);
    expect(result.stages).toBeDefined();
    expect(result.stages![0].steps).toBeDefined();
    expect(result.stages![0].steps![0]).toHaveProperty('exit_code');
  });
});
