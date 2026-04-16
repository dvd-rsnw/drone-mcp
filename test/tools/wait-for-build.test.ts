import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { DroneClient } from '../../src/drone-client.js';
import { waitForBuild } from '../../src/tools/wait-for-build.js';
import {
  mockServer,
  MOCK_DRONE_SERVER,
  MOCK_DRONE_TOKEN,
} from '../helpers/msw.js';
import * as chimeModule from '../../src/chime.js';

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  mockServer.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => mockServer.close());

const client = new DroneClient({
  server: MOCK_DRONE_SERVER,
  token: MOCK_DRONE_TOKEN,
});

function buildStub(status: string, number = 300) {
  return {
    id: 1,
    number,
    status,
    event: 'push',
    ref: 'refs/heads/main',
    source: '',
    target: 'main',
    author_login: 'x',
    author_email: '',
    sender: 'x',
    message: '',
    link: '',
    started: 0,
    finished: 0,
    created: 0,
    updated: 0,
    stages: [],
  };
}

describe('waitForBuild', () => {
  it('returns immediately when build already in terminal state', async () => {
    mockServer.use(
      http.get(
        `${MOCK_DRONE_SERVER}/api/repos/octocat/example-repo/builds/300`,
        () => HttpResponse.json(buildStub('success')),
      ),
    );
    const chimeSpy = vi.spyOn(chimeModule, 'playChime').mockImplementation(() => {});
    const result = await waitForBuild(client, {
      repo: 'octocat/example-repo',
      build: 300,
      timeout_seconds: 5,
      poll_interval_seconds: 1,
    });
    expect(result.terminal).toBe(true);
    expect(result.status).toBe('success');
    expect(chimeSpy).toHaveBeenCalledTimes(1);
  });

  it('polls until terminal status is reached', async () => {
    let calls = 0;
    mockServer.use(
      http.get(
        `${MOCK_DRONE_SERVER}/api/repos/octocat/example-repo/builds/301`,
        () => {
          calls++;
          return HttpResponse.json(
            buildStub(calls < 3 ? 'running' : 'failure', 301),
          );
        },
      ),
    );
    vi.spyOn(chimeModule, 'playChime').mockImplementation(() => {});
    const result = await waitForBuild(client, {
      repo: 'octocat/example-repo',
      build: 301,
      timeout_seconds: 10,
      poll_interval_seconds: 0,
    });
    expect(result.terminal).toBe(true);
    expect(result.status).toBe('failure');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('returns terminal:false on timeout and does NOT chime', async () => {
    mockServer.use(
      http.get(
        `${MOCK_DRONE_SERVER}/api/repos/octocat/example-repo/builds/302`,
        () => HttpResponse.json(buildStub('running', 302)),
      ),
    );
    const chimeSpy = vi.spyOn(chimeModule, 'playChime').mockImplementation(() => {});
    const result = await waitForBuild(client, {
      repo: 'octocat/example-repo',
      build: 302,
      timeout_seconds: 0,
      poll_interval_seconds: 0,
    });
    expect(result.terminal).toBe(false);
    expect(result.status).toBe('running');
    expect(chimeSpy).not.toHaveBeenCalled();
  });
});
