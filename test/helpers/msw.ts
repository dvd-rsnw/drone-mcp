import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import buildsList from '../fixtures/builds-list.json' with { type: 'json' };
import build225 from '../fixtures/build-225.json' with { type: 'json' };
import logsStage1Step7 from '../fixtures/logs-stage1-step7.json' with { type: 'json' };

const SERVER = 'https://drone.test';

export const droneMockHandlers = [
  http.get(`${SERVER}/api/repos/octocat/example-repo/builds`, ({ request }) => {
    const auth = request.headers.get('authorization');
    if (auth !== 'Bearer test-token') {
      return new HttpResponse('unauthorized', { status: 401 });
    }
    return HttpResponse.json(buildsList);
  }),
  http.get(`${SERVER}/api/repos/octocat/example-repo/builds/225`, () =>
    HttpResponse.json(build225),
  ),
  http.get(`${SERVER}/api/repos/octocat/example-repo/builds/225/logs/1/7`, () =>
    HttpResponse.json(logsStage1Step7),
  ),
  http.get(`${SERVER}/api/repos/octocat/example-repo/builds/9999`, () =>
    new HttpResponse('not found', { status: 404 }),
  ),
  http.post(
    `${SERVER}/api/repos/octocat/example-repo/builds/225`,
    ({ request }) => {
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams.entries());
      return HttpResponse.json({
        ...build225,
        number: 226,
        status: 'pending',
        _echo_params: params,
      });
    },
  ),
];

export const mockServer = setupServer(...droneMockHandlers);
export const MOCK_DRONE_SERVER = SERVER;
export const MOCK_DRONE_TOKEN = 'test-token';
