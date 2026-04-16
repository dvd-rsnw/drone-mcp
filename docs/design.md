# drone-mcp — Design

**Status:** Draft
**Date:** 2026-04-13
**Owner:** dave (`dvd-rsnw`)

## Purpose

A Model Context Protocol server that gives Claude Code read access to Drone CI pipelines. MVP goal: when an engineer asks "why did my build fail?", the model can answer in one or two tool calls without the engineer needing to open the Drone UI, run `drone` CLI commands, or paste logs manually.

## Non-goals (MVP)

- Mutating operations (restart, promote, rollback, stage approval)
- Secret/cron management
- Multi-server profiles
- Drone CLI wrapping (the CLI is not required to use this MCP)

## Architecture

**Runtime:** Node 20+, TypeScript (ESM), `@modelcontextprotocol/sdk` over stdio.
**Dependencies:** MCP SDK, a lightweight HTTP client (native `fetch`), `zod` for input schemas. No runtime dep on the `drone` CLI.
**Distribution:** published to npm as `drone-mcp`. Teammates install by adding an entry to their Claude Code MCP config:

```json
{
  "mcpServers": {
    "drone": {
      "command": "npx",
      "args": ["-y", "drone-mcp"],
      "env": {
        "DRONE_SERVER": "https://drone.example.com",
        "DRONE_TOKEN": "...",
        "DRONE_DEFAULT_REPO": "octocat/example-repo"
      }
    }
  }
}
```

**Repo:** `drone-mcp` (standalone, open-source).

### Drone API surface used

All calls use `Authorization: Bearer <token>`. Validated against `https://drone.example.com` on 2026-04-13:

| Endpoint | Purpose |
|---|---|
| `GET /api/repos/{owner}/{repo}/builds?per_page=N` | List recent builds (summary) |
| `GET /api/repos/{owner}/{repo}/builds/{n}` | Full build detail with nested `stages[].steps[]`, each step has `status` and `exit_code` |
| `GET /api/repos/{owner}/{repo}/builds/{n}/logs/{stage}/{step}` | Log lines as `[{ pos, out, time }, ...]` |

## Tool surface

Five tools, each with one clear purpose:

### `get_latest_build`
- **Input:** `branch?` (string), `repo?` (string), `event?` ("push" | "pull_request" | "cron" — default: any)
- **Output:** `{ number, status, event, ref, source, target, author, started, finished, link, stages_summary: [{ name, status }] }`
- Resolves "latest" by fetching `?per_page=25`, filtering client-side to builds where `source === branch` OR (`target === branch && event === "push"`), taking the highest `number`.

### `get_build`
- **Input:** `build` (number, required), `repo?`
- **Output:** Full Drone build detail object, including nested `stages[].steps[]` with per-step `status` and `exit_code`.

### `get_step_logs`
- **Input:** `build`, `stage` (number), `step` (number), `repo?`, `max_lines?` (default 500)
- **Output:** `{ lines: string[], line_count, truncated: bool }`
- Joins the `out` field from each API log entry. Tail by default — returns the last `max_lines` lines and sets `truncated: true` when the source had more.

### `get_failed_step_logs` (MVP killer feature)
- **Input:** `build?` (default: latest build for current branch), `repo?`, `max_lines?`
- **Output:**
  - If build has failed steps: `{ status, build_number, failures: [{ stage, step, step_name, exit_code, logs }] }`
  - If build still running with no failures yet: `{ status: "running", build_number, failures: [], message: "Build still running, N steps pending. Call wait_for_build to block until it finishes." }`
  - If build succeeded: `{ status: "success", build_number, failures: [], message: "Build succeeded." }`
- Walks the build detail, collects every step where `exit_code !== 0 && status === "failure"`, fetches each one's logs, returns them all in one response.

### `wait_for_build`
- **Input:** `build?` (default: latest for current branch), `repo?`, `timeout_seconds?` (default 600, max 1800), `poll_interval_seconds?` (default 45)
- **Output:** `{ terminal: bool, status, waited_seconds, build_number }`
- Polls `GET /api/repos/{owner}/{repo}/builds/{n}` every `poll_interval_seconds` until `status ∈ {success, failure, killed, error}` or `timeout_seconds` elapses.
- **Plays a chime** when the build reaches a terminal state. Silent on timeout.
- `timeout_seconds` clamped to 1800s (30 min) to keep the MCP from hanging the client indefinitely.

## Shared behaviors

### Repo resolution
1. Explicit `repo` argument.
2. `DRONE_DEFAULT_REPO` env var.
3. Parse `git config --get remote.origin.url` in CWD (supports SSH and HTTPS remotes; extracts `owner/repo`).
4. Fail with `GitDetectionError` listing all three options.

### Branch resolution
1. Explicit `branch` argument.
2. `git rev-parse --abbrev-ref HEAD` in CWD.
3. Fail with `GitDetectionError`.

### "Latest build for branch" semantics
A branch can have both push builds and PR builds:
- **Push builds:** `ref: refs/heads/<branch>`, `event: push`, `source: ""`, `target: <branch>`.
- **PR builds:** `ref: refs/pull/N/head`, `event: pull_request`, `source: <branch>`, `target: <target-branch>`.

Default filter: match builds where `source === branch` (catches PR builds) OR (`event === "push" && target === branch`) (catches push builds on that branch, including push to `main`/`dev` where `source` is empty). Return the highest-numbered match. Caller disambiguates with the `event` filter if needed.

**Search window:** fetch `?per_page=25` from the builds list. If the latest build for a branch is older than 25 builds ago it won't be found — in that case, the caller should pass an explicit `build` number. Noted as a known limit; paging is v2 work.

### Log handling
Drone logs are returned as an array of `{ pos, out, time }` objects. The MCP joins `out` values in order, splits on newlines, and returns the last `max_lines` lines (default 500) with a `truncated` flag. Binary or very long single lines are left as-is — the model is responsible for handling them.

## Auth & config

Resolution order (first match wins) for `DRONE_SERVER` and `DRONE_TOKEN`:

1. MCP config `env` block.
2. Inherited shell environment.
3. `~/.config/drone-mcp/config.json` — `{ "server": "...", "token": "...", "default_repo": "...", "chime": "on" }`.
4. Fail MCP `initialize` with a clear error listing all three options plus a link to the README.

**Other env vars:**
- `DRONE_DEFAULT_REPO` — fallback when `repo` arg isn't passed and CWD isn't a git repo (or remote isn't a Drone-tracked repo).
- `DRONE_MCP_CHIME` — `on` (default), `off`, or a sound name (e.g., `Glass`, `Hero`, `Funk` on macOS).
- `DRONE_MCP_MAX_LOG_LINES` — override default 500-line cap.

**Precedence for overridable settings (tool param wins):**
- `max_lines`: tool argument > `DRONE_MCP_MAX_LOG_LINES` > default (500).
- Chime: env `DRONE_MCP_CHIME` > config file `chime` key > default (`on` where audio tools are available).

**Security:**
- Token never logged, never included in tool responses, never written to disk by the MCP (the config file is user-written).
- Token only sent via `Authorization` header; never in URLs/query strings.
- Error responses pass through Drone's body for debugging; Drone does not echo tokens in errors.

## Chime

Platform-specific playback via `chime.ts`. Runs asynchronously on terminal state in `wait_for_build`; failure to play is logged (to MCP stderr) but never fails the tool call.

- **macOS:** `afplay /System/Library/Sounds/<name>.aiff` (default: `Glass`)
- **Linux:** try `paplay` then `aplay` with a bundled short WAV; fall back to terminal bell `\a` to stderr
- **Windows:** skip (documented as unsupported)
- **Disable:** `DRONE_MCP_CHIME=off`

## Error model

All tools return structured MCP errors (not thrown exceptions). Error classes:

- `AuthError` — token missing/invalid. Message points at config options.
- `NotFoundError` — repo or build doesn't exist. Message includes what was tried.
- `NetworkError` — Drone server unreachable. Includes server URL (never the token).
- `GitDetectionError` — CWD isn't a git repo and no explicit arg given. Lists fallback options.
- `DroneApiError` — passthrough for unexpected 4xx/5xx. Includes HTTP status and response body.

## Repo layout

```
drone-mcp/
├── src/
│   ├── index.ts              # MCP server entrypoint (stdio transport, tool registration)
│   ├── config.ts             # Auth/config resolution chain
│   ├── drone-client.ts       # Thin HTTP client: builds list/get, logs fetch
│   ├── resolvers.ts          # repo/branch auto-detect via git in CWD
│   ├── chime.ts              # Platform-specific sound playback
│   └── tools/
│       ├── get-latest-build.ts
│       ├── get-build.ts
│       ├── get-step-logs.ts
│       ├── get-failed-step-logs.ts
│       └── wait-for-build.ts
├── test/
│   ├── drone-client.test.ts  # HTTP client unit tests (msw for API mocking)
│   ├── resolvers.test.ts     # git parsing + fallback chain
│   ├── tools/*.test.ts       # one per tool, mocks drone-client
│   └── fixtures/             # Captured real Drone API responses (scrubbed)
├── package.json
├── tsconfig.json
├── README.md                 # Install + config instructions
└── .github/workflows/ci.yml  # Typecheck + test on PR
```

## Testing strategy

- **Unit tests (Vitest):** every tool mocks `drone-client`; `drone-client` mocks HTTP with `msw` against captured fixtures (build list, build #225 detail, step logs from a real Drone server — repo/user IDs scrubbed).
- **Integration test (manual, documented in README):** shell script hitting a real Drone server, validating each tool's response shape. Requires `DRONE_SERVER` + `DRONE_TOKEN`. Not in CI.
- **CI:** typecheck + unit tests only. No live-Drone tests in CI.

## Out of scope (future work)

Documented in README as "ideas for v2":
- `restart_build`, `rebuild_build`
- `list_builds` (broader filter/pagination)
- Stage approval/decline
- Cron management
- Secret management
- Promote/rollback
- Multi-Drone-server profiles (e.g., per-org configs)

## Open questions

None at spec time — revisit if implementation uncovers surprises.
