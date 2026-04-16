# drone-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that gives Claude Code read access to Drone CI pipelines — 5 tools covering latest-build summary, build detail, step logs, failed-step logs in one shot, and a polling wait-for-build with platform chime.

**Architecture:** Stdio MCP server using the official `@modelcontextprotocol/sdk`. Talks directly to the Drone HTTP API (no CLI dependency). One thin HTTP client (`drone-client.ts`), one file per tool, shared helpers for git-based repo/branch auto-detection and chime playback. TDD with Vitest + msw for API mocking; captured fixtures from `drone.example.com` anchor the tests.

**Tech Stack:** Node 20+, TypeScript (ESM, strict), `@modelcontextprotocol/sdk`, `zod` (input schemas), native `fetch`. Dev: Vitest, `msw` v2, `tsx`. No runtime dependency on the `drone` CLI.

**Spec:** See [`docs/design.md`](./design.md). Read it first — the plan implements that spec.

---

## File Structure

```
drone-mcp/
├── src/
│   ├── index.ts                   # MCP server bootstrap (stdio transport, tool registration)
│   ├── errors.ts                  # Shared error classes
│   ├── config.ts                  # Auth/config resolution chain
│   ├── drone-client.ts            # Thin HTTP client for Drone API
│   ├── resolvers.ts               # Repo/branch auto-detection via git in CWD
│   ├── chime.ts                   # Platform-specific sound playback
│   └── tools/
│       ├── get-latest-build.ts
│       ├── get-build.ts
│       ├── get-step-logs.ts
│       ├── get-failed-step-logs.ts
│       └── wait-for-build.ts
├── test/
│   ├── fixtures/
│   │   ├── builds-list.json       # scrubbed /api/repos/.../builds response
│   │   ├── build-225.json         # scrubbed /api/repos/.../builds/225 response
│   │   └── logs-stage1-step7.json # scrubbed /api/repos/.../builds/225/logs/1/7 response
│   ├── helpers/msw.ts             # msw handlers factory
│   ├── drone-client.test.ts
│   ├── config.test.ts
│   ├── resolvers.test.ts
│   ├── chime.test.ts
│   └── tools/
│       ├── get-latest-build.test.ts
│       ├── get-build.test.ts
│       ├── get-step-logs.test.ts
│       ├── get-failed-step-logs.test.ts
│       └── wait-for-build.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── README.md
└── .github/workflows/ci.yml
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `README.md`, `src/index.ts` (placeholder)

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
coverage/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "drone-mcp",
  "version": "0.1.0",
  "description": "MCP server for Drone CI read operations",
  "type": "module",
  "bin": {
    "drone-mcp": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0",
    "zod-to-json-schema": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "msw": "^2.4.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create `src/index.ts` placeholder**

```ts
// Entry point — real implementation lands in Task 13.
console.error('drone-mcp not yet implemented');
process.exit(1);
```

- [ ] **Step 6: Create `README.md` skeleton**

```markdown
# drone-mcp

MCP server exposing read access to Drone CI pipelines.

Full install + usage docs will be filled in at Task 14.
```

- [ ] **Step 7: Install deps and verify typecheck**

Run: `npm install && npm run typecheck`
Expected: installs clean, typecheck passes (no files to check is fine).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Scaffold TS/Node project"
```

---

## Task 2: Error Classes

**Files:**
- Create: `src/errors.ts`
- Create: `test/errors.test.ts`

- [ ] **Step 1: Write failing test**

`test/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  AuthError,
  NotFoundError,
  NetworkError,
  GitDetectionError,
  DroneApiError,
} from '../src/errors.js';

describe('error classes', () => {
  it('AuthError has name, message, kind', () => {
    const e = new AuthError('bad token');
    expect(e.name).toBe('AuthError');
    expect(e.message).toBe('bad token');
    expect(e.kind).toBe('auth');
  });

  it('DroneApiError carries status + body', () => {
    const e = new DroneApiError(500, '{"error":"boom"}');
    expect(e.status).toBe(500);
    expect(e.body).toBe('{"error":"boom"}');
    expect(e.kind).toBe('drone_api');
  });

  it('NotFoundError kind is not_found', () => {
    expect(new NotFoundError('no repo').kind).toBe('not_found');
  });

  it('NetworkError kind is network', () => {
    expect(new NetworkError('ECONNREFUSED').kind).toBe('network');
  });

  it('GitDetectionError kind is git_detection', () => {
    expect(new GitDetectionError('no remote').kind).toBe('git_detection');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/errors.ts`**

```ts
export type ErrorKind =
  | 'auth'
  | 'not_found'
  | 'network'
  | 'git_detection'
  | 'drone_api';

export class AuthError extends Error {
  readonly kind: ErrorKind = 'auth';
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends Error {
  readonly kind: ErrorKind = 'not_found';
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class NetworkError extends Error {
  readonly kind: ErrorKind = 'network';
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class GitDetectionError extends Error {
  readonly kind: ErrorKind = 'git_detection';
  constructor(message: string) {
    super(message);
    this.name = 'GitDetectionError';
  }
}

export class DroneApiError extends Error {
  readonly kind: ErrorKind = 'drone_api';
  constructor(public readonly status: number, public readonly body: string) {
    super(`Drone API ${status}: ${body.slice(0, 200)}`);
    this.name = 'DroneApiError';
  }
}

export type AnyDroneMcpError =
  | AuthError
  | NotFoundError
  | NetworkError
  | GitDetectionError
  | DroneApiError;
```

- [ ] **Step 4: Run test and verify it passes**

Run: `npm test`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts test/errors.test.ts
git commit -m "Add shared error classes"
```

---

## Task 3: Capture API Fixtures

**Goal:** Record real Drone API responses (scrubbed) as JSON fixtures that anchor client + tool tests.

**Files:**
- Create: `test/fixtures/builds-list.json`
- Create: `test/fixtures/build-225.json`
- Create: `test/fixtures/logs-stage1-step7.json`
- Create: `test/fixtures/README.md`

- [ ] **Step 1: Capture `builds-list.json`**

Run (with real `DRONE_SERVER` + `DRONE_TOKEN` in the shell):

```bash
curl -sSL -H "Authorization: Bearer $DRONE_TOKEN" \
  "$DRONE_SERVER/api/repos/octocat/example-repo/builds?per_page=10" \
  | python3 -m json.tool > test/fixtures/builds-list.json
```

- [ ] **Step 2: Capture `build-225.json`** (a known failed build, see [design.md](./design.md))

```bash
curl -sSL -H "Authorization: Bearer $DRONE_TOKEN" \
  "$DRONE_SERVER/api/repos/octocat/example-repo/builds/225" \
  | python3 -m json.tool > test/fixtures/build-225.json
```

- [ ] **Step 3: Capture `logs-stage1-step7.json`** (the failed `run_tests` step from build 225)

```bash
curl -sSL -H "Authorization: Bearer $DRONE_TOKEN" \
  "$DRONE_SERVER/api/repos/octocat/example-repo/builds/225/logs/1/7" \
  | python3 -m json.tool > test/fixtures/logs-stage1-step7.json
```

- [ ] **Step 4: Scrub fixtures**

Open each fixture and replace:
- `author_email` values with `"test@example.com"` (if non-empty)
- `"sender": "<actual-login>"` → keep (it's a username, not sensitive)
- Leave everything else — this data is about a public repo and is not sensitive.

Verify no access tokens, no secrets, no PII appear.

- [ ] **Step 5: Write `test/fixtures/README.md`**

```markdown
# Test fixtures

Captured from `https://drone.example.com` on 2026-04-13 against `octocat/example-repo`.
Email addresses have been scrubbed to `test@example.com`. Everything else is real
API data from a public repo.

## Regenerating

See `docs/plan.md` Task 3 for the `curl` commands used to capture these files.
```

- [ ] **Step 6: Commit**

```bash
git add test/fixtures
git commit -m "Add Drone API fixtures captured from octocat/example-repo build 225"
```

---

## Task 4: Drone HTTP Client (`drone-client.ts`)

**Files:**
- Create: `src/drone-client.ts`
- Create: `test/helpers/msw.ts`
- Create: `test/drone-client.test.ts`

- [ ] **Step 1: Install msw and set up test helper**

```bash
npm install --save-dev msw
```

Create `test/helpers/msw.ts`:

```ts
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
];

export const mockServer = setupServer(...droneMockHandlers);
export const MOCK_DRONE_SERVER = SERVER;
export const MOCK_DRONE_TOKEN = 'test-token';
```

- [ ] **Step 2: Write failing tests for `drone-client.ts`**

`test/drone-client.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { DroneClient } from '../src/drone-client.js';
import { AuthError, NotFoundError, DroneApiError } from '../src/errors.js';
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
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run: `npm test`
Expected: FAIL — `DroneClient` not found.

- [ ] **Step 4: Implement `src/drone-client.ts`**

```ts
import { AuthError, NotFoundError, NetworkError, DroneApiError } from './errors.js';

export interface DroneStep {
  id: number;
  number: number;
  name: string;
  status: string;
  exit_code: number;
  started?: number;
  stopped?: number;
  image?: string;
  depends_on?: string[];
}

export interface DroneStage {
  id: number;
  number: number;
  name: string;
  status: string;
  steps?: DroneStep[];
  started?: number;
  stopped?: number;
}

export interface DroneBuild {
  id: number;
  number: number;
  status: string;
  event: string;
  ref: string;
  source: string;
  target: string;
  author_login: string;
  author_email: string;
  sender: string;
  message: string;
  link: string;
  started: number;
  finished: number;
  created: number;
  updated: number;
  stages?: DroneStage[];
}

export interface DroneLogLine {
  pos: number;
  out: string;
  time: number;
}

export interface DroneClientConfig {
  server: string;
  token: string;
}

export class DroneClient {
  constructor(private readonly config: DroneClientConfig) {}

  async listBuilds(
    repo: string,
    opts: { perPage?: number } = {},
  ): Promise<DroneBuild[]> {
    const perPage = opts.perPage ?? 25;
    return this.get<DroneBuild[]>(
      `/api/repos/${repo}/builds?per_page=${perPage}`,
    );
  }

  async getBuild(repo: string, number: number): Promise<DroneBuild> {
    return this.get<DroneBuild>(`/api/repos/${repo}/builds/${number}`);
  }

  async getStepLogs(
    repo: string,
    build: number,
    stage: number,
    step: number,
  ): Promise<DroneLogLine[]> {
    return this.get<DroneLogLine[]>(
      `/api/repos/${repo}/builds/${build}/logs/${stage}/${step}`,
    );
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.config.server}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
    } catch (err) {
      throw new NetworkError(
        `Failed to reach ${this.config.server}: ${(err as Error).message}`,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(
        `Authentication failed (${res.status}). Check DRONE_TOKEN.`,
      );
    }
    if (res.status === 404) {
      throw new NotFoundError(`Not found: ${path}`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new DroneApiError(res.status, body);
    }
    return (await res.json()) as T;
  }
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `npm test`
Expected: PASS — 5 DroneClient tests green.

- [ ] **Step 6: Commit**

```bash
git add src/drone-client.ts src/errors.ts test/drone-client.test.ts test/helpers/msw.ts package.json package-lock.json
git commit -m "Add DroneClient HTTP wrapper + msw-backed tests"
```

---

## Task 5: Config Resolution (`config.ts`)

**Files:**
- Create: `src/config.ts`
- Create: `test/config.test.ts`

- [ ] **Step 1: Write failing tests**

`test/config.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveConfig } from '../src/config.js';
import { AuthError } from '../src/errors.js';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ORIG_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG_ENV };
  vi.restoreAllMocks();
});

describe('resolveConfig', () => {
  it('returns env values when both DRONE_SERVER and DRONE_TOKEN present', () => {
    process.env.DRONE_SERVER = 'https://a';
    process.env.DRONE_TOKEN = 't1';
    delete process.env.DRONE_DEFAULT_REPO;
    const cfg = resolveConfig();
    expect(cfg.server).toBe('https://a');
    expect(cfg.token).toBe('t1');
    expect(cfg.defaultRepo).toBeUndefined();
  });

  it('includes defaultRepo when DRONE_DEFAULT_REPO set', () => {
    process.env.DRONE_SERVER = 'https://a';
    process.env.DRONE_TOKEN = 't1';
    process.env.DRONE_DEFAULT_REPO = 'octocat/example-repo';
    expect(resolveConfig().defaultRepo).toBe('octocat/example-repo');
  });

  it('falls back to config file when env missing', () => {
    delete process.env.DRONE_SERVER;
    delete process.env.DRONE_TOKEN;
    const dir = mkdtempSync(join(tmpdir(), 'dmcp-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ server: 'https://fromfile', token: 't-file' }),
    );
    try {
      const cfg = resolveConfig({ configPath });
      expect(cfg.server).toBe('https://fromfile');
      expect(cfg.token).toBe('t-file');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('env wins over config file', () => {
    process.env.DRONE_SERVER = 'https://env';
    process.env.DRONE_TOKEN = 't-env';
    const dir = mkdtempSync(join(tmpdir(), 'dmcp-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ server: 'https://file', token: 't-file' }),
    );
    try {
      const cfg = resolveConfig({ configPath });
      expect(cfg.server).toBe('https://env');
      expect(cfg.token).toBe('t-env');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws AuthError when nothing is configured', () => {
    delete process.env.DRONE_SERVER;
    delete process.env.DRONE_TOKEN;
    expect(() =>
      resolveConfig({ configPath: '/nonexistent/path.json' }),
    ).toThrow(AuthError);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test`
Expected: FAIL — `resolveConfig` not found.

- [ ] **Step 3: Implement `src/config.ts`**

```ts
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AuthError } from './errors.js';

export interface ResolvedConfig {
  server: string;
  token: string;
  defaultRepo?: string;
  chime?: 'on' | 'off' | string;
}

export interface ResolveOptions {
  configPath?: string;
}

function defaultConfigPath(): string {
  return join(homedir(), '.config', 'drone-mcp', 'config.json');
}

function readConfigFile(path: string): Partial<ResolvedConfig> {
  if (!existsSync(path)) return {};
  try {
    const text = readFileSync(path, 'utf8');
    const parsed = JSON.parse(text) as Partial<ResolvedConfig> & {
      default_repo?: string;
    };
    // allow snake_case in file
    if (parsed.default_repo && !parsed.defaultRepo) {
      parsed.defaultRepo = parsed.default_repo;
    }
    return parsed;
  } catch {
    return {};
  }
}

export function resolveConfig(opts: ResolveOptions = {}): ResolvedConfig {
  const fileCfg = readConfigFile(opts.configPath ?? defaultConfigPath());

  const server = process.env.DRONE_SERVER || fileCfg.server;
  const token = process.env.DRONE_TOKEN || fileCfg.token;
  const defaultRepo =
    process.env.DRONE_DEFAULT_REPO || fileCfg.defaultRepo || undefined;
  const chime =
    (process.env.DRONE_MCP_CHIME as ResolvedConfig['chime']) ||
    fileCfg.chime ||
    'on';

  if (!server || !token) {
    throw new AuthError(
      'Missing Drone credentials. Set DRONE_SERVER and DRONE_TOKEN via (1) the MCP client `env` block, ' +
        '(2) shell environment, or (3) ~/.config/drone-mcp/config.json — see the README.',
    );
  }

  return { server, token, defaultRepo, chime };
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test`
Expected: PASS — 5 config tests green.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "Add config resolution: env > config file > error"
```

---

## Task 6: Git Resolvers (`resolvers.ts`)

**Files:**
- Create: `src/resolvers.ts`
- Create: `test/resolvers.test.ts`

- [ ] **Step 1: Write failing tests**

`test/resolvers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseGitRemote, resolveRepo, resolveBranch } from '../src/resolvers.js';
import { GitDetectionError } from '../src/errors.js';

describe('parseGitRemote', () => {
  it('parses https github remote', () => {
    expect(parseGitRemote('https://github.com/octocat/example-repo.git')).toBe(
      'octocat/example-repo',
    );
  });
  it('parses https remote without .git', () => {
    expect(parseGitRemote('https://github.com/octocat/example-repo')).toBe(
      'octocat/example-repo',
    );
  });
  it('parses ssh github remote', () => {
    expect(parseGitRemote('git@github.com:octocat/example-repo.git')).toBe(
      'octocat/example-repo',
    );
  });
  it('returns undefined for junk', () => {
    expect(parseGitRemote('not a url')).toBeUndefined();
  });
});

describe('resolveRepo', () => {
  it('uses explicit arg when given', () => {
    expect(resolveRepo('generic/foo', { defaultRepo: 'x/y' })).toBe(
      'generic/foo',
    );
  });
  it('falls back to default', () => {
    expect(resolveRepo(undefined, { defaultRepo: 'x/y', cwd: '/nowhere' })).toBe(
      'x/y',
    );
  });
  it('throws GitDetectionError when nothing resolves', () => {
    expect(() =>
      resolveRepo(undefined, { cwd: '/nonexistent' }),
    ).toThrow(GitDetectionError);
  });
});

describe('resolveBranch', () => {
  it('uses explicit arg when given', () => {
    expect(resolveBranch('feature/x', { cwd: '/nowhere' })).toBe('feature/x');
  });
  it('throws GitDetectionError when no git repo and no arg', () => {
    expect(() => resolveBranch(undefined, { cwd: '/nonexistent' })).toThrow(
      GitDetectionError,
    );
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test`
Expected: FAIL — resolvers module not found.

- [ ] **Step 3: Implement `src/resolvers.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { GitDetectionError } from './errors.js';

export function parseGitRemote(url: string): string | undefined {
  // https://github.com/octocat/example-repo(.git)?
  const https = url.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/.]+)(?:\.git)?\/?$/);
  if (https) return `${https[1]}/${https[2]}`;
  // git@github.com:octocat/example-repo.git
  const ssh = url.match(/^[^@]+@[^:]+:([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  return undefined;
}

function gitRemoteFromCwd(cwd: string): string | undefined {
  try {
    const out = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return parseGitRemote(out);
  } catch {
    return undefined;
  }
}

function gitBranchFromCwd(cwd: string): string | undefined {
  try {
    const out = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (!out || out === 'HEAD') return undefined;
    return out;
  } catch {
    return undefined;
  }
}

export interface ResolveRepoOptions {
  defaultRepo?: string;
  cwd?: string;
}

export function resolveRepo(
  explicit: string | undefined,
  opts: ResolveRepoOptions = {},
): string {
  if (explicit) return explicit;
  const fromGit = gitRemoteFromCwd(opts.cwd ?? process.cwd());
  if (fromGit) return fromGit;
  if (opts.defaultRepo) return opts.defaultRepo;
  throw new GitDetectionError(
    'Could not determine repo. Pass `repo`, set DRONE_DEFAULT_REPO, or run inside a git repo with a recognizable remote.',
  );
}

export interface ResolveBranchOptions {
  cwd?: string;
}

export function resolveBranch(
  explicit: string | undefined,
  opts: ResolveBranchOptions = {},
): string {
  if (explicit) return explicit;
  const fromGit = gitBranchFromCwd(opts.cwd ?? process.cwd());
  if (fromGit) return fromGit;
  throw new GitDetectionError(
    'Could not determine branch. Pass `branch` explicitly, or run inside a git repo on a named branch.',
  );
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test`
Expected: PASS — resolvers tests green.

- [ ] **Step 5: Commit**

```bash
git add src/resolvers.ts test/resolvers.test.ts
git commit -m "Add git-based repo/branch resolvers"
```

---

## Task 7: Chime (`chime.ts`)

**Files:**
- Create: `src/chime.ts`
- Create: `test/chime.test.ts`

- [ ] **Step 1: Write failing tests**

`test/chime.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cp from 'node:child_process';
import { playChime } from '../src/chime.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    unref: vi.fn(),
  })),
}));

const spawn = vi.mocked(cp.spawn);

beforeEach(() => {
  spawn.mockClear();
});

describe('playChime', () => {
  it('is a no-op when chime is "off"', () => {
    playChime({ chime: 'off', platform: 'darwin' });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('uses afplay on darwin', () => {
    playChime({ chime: 'on', platform: 'darwin' });
    expect(spawn).toHaveBeenCalledWith(
      'afplay',
      expect.arrayContaining([expect.stringMatching(/Glass\.aiff$/)]),
      expect.any(Object),
    );
  });

  it('accepts a sound name on darwin', () => {
    playChime({ chime: 'Hero', platform: 'darwin' });
    expect(spawn).toHaveBeenCalledWith(
      'afplay',
      expect.arrayContaining([expect.stringMatching(/Hero\.aiff$/)]),
      expect.any(Object),
    );
  });

  it('swallows errors from spawn failure', () => {
    spawn.mockImplementationOnce(() => {
      throw new Error('no such binary');
    });
    // Should not throw
    expect(() => playChime({ chime: 'on', platform: 'darwin' })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test`
Expected: FAIL — chime module not found.

- [ ] **Step 3: Implement `src/chime.ts`**

```ts
import { spawn } from 'node:child_process';

export interface ChimeOptions {
  chime: string;
  platform?: NodeJS.Platform;
}

export function playChime(opts: ChimeOptions): void {
  if (opts.chime === 'off') return;
  const platform = opts.platform ?? process.platform;
  const soundName = opts.chime === 'on' ? 'Glass' : opts.chime;

  try {
    if (platform === 'darwin') {
      const child = spawn(
        'afplay',
        [`/System/Library/Sounds/${soundName}.aiff`],
        { stdio: 'ignore', detached: true },
      );
      child.on('error', () => {});
      child.unref();
      return;
    }
    if (platform === 'linux') {
      // Fall back to terminal bell — bundling a WAV is v2
      process.stderr.write('\x07');
      return;
    }
    // Windows + other: no-op
  } catch {
    // Never let chime break the tool call
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test`
Expected: PASS — chime tests green.

- [ ] **Step 5: Commit**

```bash
git add src/chime.ts test/chime.test.ts
git commit -m "Add cross-platform chime playback"
```

---

## Task 8: Tool — `get_latest_build`

**Files:**
- Create: `src/tools/get-latest-build.ts`
- Create: `test/tools/get-latest-build.test.ts`

- [ ] **Step 1: Write failing test**

`test/tools/get-latest-build.test.ts`:

```ts
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
    // Asking for a push on main should match build 226 (cron, target=main)
    // but event filter 'cron' should find it.
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
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test`
Expected: FAIL — tool not found.

- [ ] **Step 3: Implement `src/tools/get-latest-build.ts`**

```ts
import { z } from 'zod';
import { DroneClient, DroneBuild } from '../drone-client.js';
import { NotFoundError } from '../errors.js';

export const GetLatestBuildInput = z.object({
  branch: z.string().optional(),
  repo: z.string().optional(),
  event: z.enum(['push', 'pull_request', 'cron']).optional(),
});
export type GetLatestBuildInput = z.infer<typeof GetLatestBuildInput>;

export interface GetLatestBuildOutput {
  number: number;
  status: string;
  event: string;
  ref: string;
  source: string;
  target: string;
  author: string;
  started: number;
  finished: number;
  link: string;
  stages_summary: Array<{ name: string; status: string }>;
}

function matches(
  build: DroneBuild,
  branch: string,
  event: string | undefined,
): boolean {
  if (event && build.event !== event) return false;
  const bySource = build.source === branch;
  const byPushTarget = build.event === 'push' && build.target === branch;
  const byCronTarget = build.event === 'cron' && build.target === branch;
  return bySource || byPushTarget || byCronTarget;
}

export async function getLatestBuild(
  client: DroneClient,
  args: { repo: string; branch: string; event?: string },
): Promise<GetLatestBuildOutput> {
  const builds = await client.listBuilds(args.repo, { perPage: 25 });
  const matching = builds.filter((b) => matches(b, args.branch, args.event));
  if (matching.length === 0) {
    throw new NotFoundError(
      `No builds found for ${args.repo} matching branch "${args.branch}"${
        args.event ? ` with event "${args.event}"` : ''
      } in the most recent 25 builds.`,
    );
  }
  matching.sort((a, b) => b.number - a.number);
  const b = matching[0];
  return {
    number: b.number,
    status: b.status,
    event: b.event,
    ref: b.ref,
    source: b.source,
    target: b.target,
    author: b.author_login || b.sender,
    started: b.started,
    finished: b.finished,
    link: b.link,
    stages_summary: (b.stages ?? []).map((s) => ({
      name: s.name,
      status: s.status,
    })),
  };
}
```

> Implementation note: the summary list endpoint does not include `stages`, so `stages_summary` will be empty here — that's fine and honest. If you want stages filled in, call `get_build` on the resulting number.

Update the output contract comment in the code to reflect that `stages_summary` is best-effort.

- [ ] **Step 4: Run test and verify it passes**

Run: `npm test`
Expected: PASS — 3 getLatestBuild tests green.

> If the third test (`filters by event`) fails because build 226's event in the fixture is not `cron`, adjust the test to match actual fixture data — use whatever build exists in your captured `builds-list.json`. The point is: an explicit event filter must select only builds with that event.

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-latest-build.ts test/tools/get-latest-build.test.ts
git commit -m "Add get_latest_build tool"
```

---

## Task 9: Tool — `get_build`

**Files:**
- Create: `src/tools/get-build.ts`
- Create: `test/tools/get-build.test.ts`

- [ ] **Step 1: Write failing test**

```ts
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
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/get-build.ts`**

```ts
import { z } from 'zod';
import { DroneClient, DroneBuild } from '../drone-client.js';

export const GetBuildInput = z.object({
  build: z.number().int().positive(),
  repo: z.string().optional(),
});
export type GetBuildInput = z.infer<typeof GetBuildInput>;

export async function getBuild(
  client: DroneClient,
  args: { repo: string; build: number },
): Promise<DroneBuild> {
  return client.getBuild(args.repo, args.build);
}
```

- [ ] **Step 4: Run test and verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-build.ts test/tools/get-build.test.ts
git commit -m "Add get_build tool"
```

---

## Task 10: Tool — `get_step_logs`

**Files:**
- Create: `src/tools/get-step-logs.ts`
- Create: `test/tools/get-step-logs.test.ts`

- [ ] **Step 1: Write failing test**

```ts
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
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/get-step-logs.ts`**

```ts
import { z } from 'zod';
import { DroneClient } from '../drone-client.js';

export const GetStepLogsInput = z.object({
  build: z.number().int().positive(),
  stage: z.number().int().positive(),
  step: z.number().int().positive(),
  repo: z.string().optional(),
  max_lines: z.number().int().positive().optional(),
});
export type GetStepLogsInput = z.infer<typeof GetStepLogsInput>;

export interface GetStepLogsOutput {
  lines: string[];
  line_count: number;
  truncated: boolean;
}

const DEFAULT_MAX_LINES = 500;

export async function getStepLogs(
  client: DroneClient,
  args: {
    repo: string;
    build: number;
    stage: number;
    step: number;
    max_lines?: number;
  },
): Promise<GetStepLogsOutput> {
  const envMax = Number(process.env.DRONE_MCP_MAX_LOG_LINES) || undefined;
  const cap = args.max_lines ?? envMax ?? DEFAULT_MAX_LINES;
  const logs = await client.getStepLogs(
    args.repo,
    args.build,
    args.stage,
    args.step,
  );
  // Each entry's `out` may already contain a trailing newline;
  // split on \n so one long log entry becomes multiple lines.
  const joined = logs.map((l) => l.out).join('');
  const allLines = joined.split('\n');
  // Drop the trailing empty string if the joined text ends with \n
  if (allLines.length && allLines[allLines.length - 1] === '') {
    allLines.pop();
  }
  const truncated = allLines.length > cap;
  const lines = truncated ? allLines.slice(-cap) : allLines;
  return { lines, line_count: lines.length, truncated };
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-step-logs.ts test/tools/get-step-logs.test.ts
git commit -m "Add get_step_logs tool with max_lines truncation"
```

---

## Task 11: Tool — `get_failed_step_logs`

**Files:**
- Create: `src/tools/get-failed-step-logs.ts`
- Create: `test/tools/get-failed-step-logs.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/get-failed-step-logs.ts`**

```ts
import { z } from 'zod';
import { DroneClient } from '../drone-client.js';
import { getStepLogs, GetStepLogsOutput } from './get-step-logs.js';

export const GetFailedStepLogsInput = z.object({
  build: z.number().int().positive().optional(),
  repo: z.string().optional(),
  max_lines: z.number().int().positive().optional(),
});
export type GetFailedStepLogsInput = z.infer<typeof GetFailedStepLogsInput>;

export interface FailedStepLog {
  stage: number;
  stage_name: string;
  step: number;
  step_name: string;
  exit_code: number;
  logs: GetStepLogsOutput;
}

export interface GetFailedStepLogsOutput {
  status: string;
  build_number: number;
  failures: FailedStepLog[];
  message?: string;
}

export async function getFailedStepLogs(
  client: DroneClient,
  args: { repo: string; build: number; max_lines?: number },
): Promise<GetFailedStepLogsOutput> {
  const build = await client.getBuild(args.repo, args.build);
  const failures: FailedStepLog[] = [];

  for (const stage of build.stages ?? []) {
    for (const step of stage.steps ?? []) {
      if (step.status === 'failure' && step.exit_code !== 0) {
        const logs = await getStepLogs(client, {
          repo: args.repo,
          build: args.build,
          stage: stage.number,
          step: step.number,
          max_lines: args.max_lines,
        });
        failures.push({
          stage: stage.number,
          stage_name: stage.name,
          step: step.number,
          step_name: step.name,
          exit_code: step.exit_code,
          logs,
        });
      }
    }
  }

  let message: string | undefined;
  if (failures.length === 0) {
    if (build.status === 'running' || build.status === 'pending') {
      const pending = (build.stages ?? [])
        .flatMap((s) => s.steps ?? [])
        .filter((s) => s.status === 'pending' || s.status === 'running').length;
      message = `Build still ${build.status}, ${pending} steps pending. Call wait_for_build to block until it finishes.`;
    } else if (build.status === 'success') {
      message = 'Build succeeded.';
    } else {
      message = `Build status: ${build.status}, no failed steps found.`;
    }
  }

  return {
    status: build.status,
    build_number: build.number,
    failures,
    message,
  };
}
```

- [ ] **Step 4: Run test and verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/get-failed-step-logs.ts test/tools/get-failed-step-logs.test.ts
git commit -m "Add get_failed_step_logs (MVP killer feature)"
```

---

## Task 12: Tool — `wait_for_build`

**Files:**
- Create: `src/tools/wait-for-build.ts`
- Create: `test/tools/wait-for-build.test.ts`

- [ ] **Step 1: Write failing tests**

`test/tools/wait-for-build.test.ts`:

```ts
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
      poll_interval_seconds: 0, // fire as fast as possible in tests
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
      timeout_seconds: 0, // immediate timeout
      poll_interval_seconds: 0,
    });
    expect(result.terminal).toBe(false);
    expect(result.status).toBe('running');
    expect(chimeSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `src/tools/wait-for-build.ts`**

```ts
import { z } from 'zod';
import { DroneClient } from '../drone-client.js';
import { playChime } from '../chime.js';

export const WaitForBuildInput = z.object({
  build: z.number().int().positive().optional(),
  repo: z.string().optional(),
  timeout_seconds: z.number().int().nonnegative().optional(),
  poll_interval_seconds: z.number().int().nonnegative().optional(),
});
export type WaitForBuildInput = z.infer<typeof WaitForBuildInput>;

export interface WaitForBuildOutput {
  terminal: boolean;
  status: string;
  waited_seconds: number;
  build_number: number;
}

const TERMINAL_STATUSES = new Set(['success', 'failure', 'killed', 'error']);
const DEFAULT_TIMEOUT = 600;
const MAX_TIMEOUT = 1800;
const DEFAULT_POLL = 45;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForBuild(
  client: DroneClient,
  args: {
    repo: string;
    build: number;
    timeout_seconds?: number;
    poll_interval_seconds?: number;
    chime?: string;
  },
): Promise<WaitForBuildOutput> {
  const timeout = Math.min(
    args.timeout_seconds ?? DEFAULT_TIMEOUT,
    MAX_TIMEOUT,
  );
  const interval = args.poll_interval_seconds ?? DEFAULT_POLL;
  const chime = args.chime ?? 'on';

  const startMs = Date.now();

  while (true) {
    const build = await client.getBuild(args.repo, args.build);
    const waited = Math.floor((Date.now() - startMs) / 1000);
    if (TERMINAL_STATUSES.has(build.status)) {
      playChime({ chime });
      return {
        terminal: true,
        status: build.status,
        waited_seconds: waited,
        build_number: build.number,
      };
    }
    if (waited >= timeout) {
      return {
        terminal: false,
        status: build.status,
        waited_seconds: waited,
        build_number: build.number,
      };
    }
    await sleep(interval * 1000);
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `npm test`
Expected: PASS — 3 waitForBuild tests green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/wait-for-build.ts test/tools/wait-for-build.test.ts
git commit -m "Add wait_for_build with bounded polling + chime on terminal"
```

---

## Task 13: MCP Server Entrypoint

**Goal:** Wire everything into a working MCP server over stdio — tool registration, input validation, error translation, repo/branch resolution per call.

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace the placeholder `src/index.ts` with the full server**

```ts
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { resolveConfig } from './config.js';
import { DroneClient } from './drone-client.js';
import { resolveRepo, resolveBranch } from './resolvers.js';

import {
  GetLatestBuildInput,
  getLatestBuild,
} from './tools/get-latest-build.js';
import { GetBuildInput, getBuild } from './tools/get-build.js';
import { GetStepLogsInput, getStepLogs } from './tools/get-step-logs.js';
import {
  GetFailedStepLogsInput,
  getFailedStepLogs,
} from './tools/get-failed-step-logs.js';
import { WaitForBuildInput, waitForBuild } from './tools/wait-for-build.js';

async function main() {
  const config = resolveConfig();
  const client = new DroneClient({
    server: config.server,
    token: config.token,
  });

  const server = new Server(
    { name: 'drone-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const tools = [
    {
      name: 'get_latest_build',
      description:
        'Get a summary of the most recent Drone build for a branch. Auto-detects repo and branch from the current git repo if not provided.',
      inputSchema: zodToJsonSchema(GetLatestBuildInput),
    },
    {
      name: 'get_build',
      description:
        'Get full detail for a specific Drone build, including all stages and steps with per-step status and exit_code.',
      inputSchema: zodToJsonSchema(GetBuildInput),
    },
    {
      name: 'get_step_logs',
      description:
        'Get logs for a specific step of a Drone build. Returns the tail of the log (last max_lines, default 500).',
      inputSchema: zodToJsonSchema(GetStepLogsInput),
    },
    {
      name: 'get_failed_step_logs',
      description:
        'Get logs for every failed step in a Drone build in one call. If no build number is given, uses the latest build for the current branch.',
      inputSchema: zodToJsonSchema(GetFailedStepLogsInput),
    },
    {
      name: 'wait_for_build',
      description:
        'Poll a Drone build until it reaches a terminal state (success/failure/killed/error) or timeout. Plays a chime on terminal state. Default poll interval 45s, default timeout 600s (max 1800s).',
      inputSchema: zodToJsonSchema(WaitForBuildInput),
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs = {} } = req.params;

    try {
      let result: unknown;
      switch (name) {
        case 'get_latest_build': {
          const a = GetLatestBuildInput.parse(rawArgs);
          result = await getLatestBuild(client, {
            repo: resolveRepo(a.repo, { defaultRepo: config.defaultRepo }),
            branch: resolveBranch(a.branch),
            event: a.event,
          });
          break;
        }
        case 'get_build': {
          const a = GetBuildInput.parse(rawArgs);
          result = await getBuild(client, {
            repo: resolveRepo(a.repo, { defaultRepo: config.defaultRepo }),
            build: a.build,
          });
          break;
        }
        case 'get_step_logs': {
          const a = GetStepLogsInput.parse(rawArgs);
          result = await getStepLogs(client, {
            repo: resolveRepo(a.repo, { defaultRepo: config.defaultRepo }),
            build: a.build,
            stage: a.stage,
            step: a.step,
            max_lines: a.max_lines,
          });
          break;
        }
        case 'get_failed_step_logs': {
          const a = GetFailedStepLogsInput.parse(rawArgs);
          const repo = resolveRepo(a.repo, {
            defaultRepo: config.defaultRepo,
          });
          let buildNum = a.build;
          if (!buildNum) {
            const latest = await getLatestBuild(client, {
              repo,
              branch: resolveBranch(undefined),
            });
            buildNum = latest.number;
          }
          result = await getFailedStepLogs(client, {
            repo,
            build: buildNum,
            max_lines: a.max_lines,
          });
          break;
        }
        case 'wait_for_build': {
          const a = WaitForBuildInput.parse(rawArgs);
          const repo = resolveRepo(a.repo, {
            defaultRepo: config.defaultRepo,
          });
          let buildNum = a.build;
          if (!buildNum) {
            const latest = await getLatestBuild(client, {
              repo,
              branch: resolveBranch(undefined),
            });
            buildNum = latest.number;
          }
          result = await waitForBuild(client, {
            repo,
            build: buildNum,
            timeout_seconds: a.timeout_seconds,
            poll_interval_seconds: a.poll_interval_seconds,
            chime: config.chime,
          });
          break;
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const kind = (err as { kind?: string })?.kind ?? 'unknown';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: { kind, message } }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('drone-mcp failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Build and smoke-test**

Run:

```bash
npm run build
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | DRONE_SERVER=https://drone.example.com DRONE_TOKEN=<your-token> \
    node dist/index.js
```

Expected: a single JSON-RPC response on stdout with a `tools` array of 5 entries, then the process exits when stdin closes.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "Wire MCP server entrypoint with 5 tools over stdio"
```

---

## Task 14: README and CI

**Files:**
- Modify: `README.md`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `README.md`**

```markdown
# drone-mcp

A Model Context Protocol server exposing read access to [Drone CI](https://drone.io) pipelines. Designed for the engineers using Claude Code, but should work against any Drone server.

## Install

In your Claude Code MCP config (`~/.claude.json` or the relevant client config):

\`\`\`json
{
  "mcpServers": {
    "drone": {
      "command": "npx",
      "args": ["-y", "drone-mcp"],
      "env": {
        "DRONE_SERVER": "https://drone.example.com",
        "DRONE_TOKEN": "<your token from drone.example.com user settings>",
        "DRONE_DEFAULT_REPO": "octocat/example-repo"
      }
    }
  }
}
\`\`\`

No external runtime dependencies beyond Node 20+. The `drone` CLI is **not** required.

## Configuration

`DRONE_SERVER` and `DRONE_TOKEN` are resolved in this order (first match wins):

1. `env` block in the MCP config above.
2. Your shell's environment (inherited at spawn).
3. `~/.config/drone-mcp/config.json`:

\`\`\`json
{
  "server": "https://drone.example.com",
  "token": "...",
  "default_repo": "octocat/example-repo",
  "chime": "on"
}
\`\`\`

If none of those provide both values, the MCP fails to start with an error.

### Other env vars

- `DRONE_DEFAULT_REPO` — used when the `repo` tool argument is omitted and the CWD isn't a git repo with a recognizable remote.
- `DRONE_MCP_CHIME` — `on` (default), `off`, or a macOS sound name (`Glass`, `Hero`, `Funk`, `Ping`, ...).
- `DRONE_MCP_MAX_LOG_LINES` — override default 500-line log cap.

## Tools

| Tool | What it does |
|---|---|
| `get_latest_build` | Latest build for a branch (auto-detects branch from CWD) |
| `get_build` | Full build detail with all stages/steps |
| `get_step_logs` | Logs for one step (tail, capped) |
| `get_failed_step_logs` | Every failed step's logs in one call — **this is usually what you want** |
| `wait_for_build` | Poll until terminal, chime when done |

## Development

\`\`\`bash
npm install
npm test
npm run build
\`\`\`

Unit tests use [`msw`](https://mswjs.io) with fixtures captured from `drone.example.com`. To re-capture, see `test/fixtures/README.md`.

## Manual integration test

With `DRONE_SERVER` and `DRONE_TOKEN` set in your shell:

\`\`\`bash
npm run build
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
\`\`\`

## Roadmap (v2 ideas, not in MVP)

- `restart_build`, `rebuild_build`
- `list_builds` with filters/pagination
- Stage approval/decline
- Cron and secret management
- Promote/rollback
- Multi-Drone-server profiles

## License

MIT
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Commit**

```bash
git add README.md .github/workflows/ci.yml
git commit -m "Add README and CI workflow"
```

---

## Post-plan: Publishing

Not part of the MVP plan but worth knowing:

- For MVP sharing before npm publish: teammates install from GitHub directly — `npx -y github:dvd-rsnw/drone-mcp` (a `prepare` script in `package.json` builds `dist/` on install). Once published to npm, the install becomes `npx -y drone-mcp`.

---

## Self-Review

**Spec coverage check** — every section in `docs/design.md` has a task:

| Spec section | Task(s) |
|---|---|
| Architecture (Node/TS/stdio/MCP SDK) | 1, 13 |
| Drone API surface | 4 (client), 3 (fixtures) |
| `get_latest_build` | 8 |
| `get_build` | 9 |
| `get_step_logs` | 10 |
| `get_failed_step_logs` | 11 |
| `wait_for_build` | 12 |
| Repo/branch resolution | 6 |
| "Latest build for branch" semantics | 8 (filter logic) |
| Auth & config | 5 |
| Precedence rules | 5 (config), 10 (max_lines), 12 (chime) |
| Chime | 7, 12 |
| Error model | 2, 4 |
| Repo layout | 1 |
| Testing strategy | 3, 4, 5, 6, 7, 8–12 |
| README + CI | 14 |

**Placeholder scan:** none — every step shows the exact command or code to write.

**Type consistency check:**
- `DroneBuild`, `DroneStage`, `DroneStep`, `DroneLogLine` defined in Task 4 and used unchanged in Tasks 8–12.
- `GetStepLogsOutput` is imported by `get_failed_step_logs` (Task 11) — matches the shape defined in Task 10.
- Zod schema names (`GetLatestBuildInput` etc.) and runtime tool names (`get_latest_build`) are consistent across Task 13's registration and the tool files.
