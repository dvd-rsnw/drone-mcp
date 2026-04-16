# drone-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI assistants (Claude Code, Claude Desktop, any other MCP client) read access to [Drone CI](https://drone.io) pipelines and the ability to restart builds. Talks directly to the Drone HTTP API — no `drone` CLI required.

> **Why?** When a build fails, you usually just want to know *which step failed* and *what its logs say* — without leaving your editor to open the Drone UI. This MCP gives the model one tool call to find out, plus a few related tools for polling and restart.

## Install

Add this to your MCP client config (e.g. `~/.claude.json` for Claude Code, or `claude_desktop_config.json` for Claude Desktop):

```json
{
  "mcpServers": {
    "drone": {
      "command": "npx",
      "args": ["-y", "drone-mcp"],
      "env": {
        "DRONE_SERVER": "https://your-drone-server.example.com",
        "DRONE_TOKEN": "<your token from /account on the Drone UI>",
        "DRONE_DEFAULT_REPO": "your-org/your-repo"
      }
    }
  }
}
```

The first run downloads the package and installs deps (~10 seconds). Subsequent runs are instant (cached). Requires **Node 20+**.

To pin a version: `drone-mcp@0.1.0`. To install directly from GitHub instead (e.g. for unreleased changes on `main`): `github:dvd-rsnw/drone-mcp`.

## Configuration

`DRONE_SERVER` and `DRONE_TOKEN` are resolved in this order (first match wins):

1. `env` block in the MCP config above.
2. Your shell's environment (inherited at spawn).
3. `~/.config/drone-mcp/config.json`:

```json
{
  "server": "https://your-drone-server.example.com",
  "token": "...",
  "default_repo": "your-org/your-repo",
  "chime": "on"
}
```

If none of those provide both values, the server fails to start with a clear error.

### Other env vars

| Variable | Purpose |
|---|---|
| `DRONE_DEFAULT_REPO` | Fallback `<owner>/<repo>` when the `repo` tool argument is omitted and the current working directory isn't a recognizable git repo. |
| `DRONE_MCP_CHIME` | `on` (default), `off`, or a macOS system sound name (`Glass`, `Hero`, `Funk`, `Ping`, ...). |
| `DRONE_MCP_MAX_LOG_LINES` | Override the default 500-line log tail cap. |

### Where do I get a Drone token?

Sign in to your Drone server's web UI, click your avatar → **User Settings**, and copy the personal access token shown there. The token inherits your repo permissions — read scope is enough for the read-only tools, write scope is required for `restart_build`.

## Tools

| Tool | What it does |
|---|---|
| `get_latest_build` | Latest build for a branch (auto-detects branch from CWD git state) |
| `get_build` | Full build detail with all stages/steps |
| `get_step_logs` | Logs for one step (tailed, length-capped) |
| `get_failed_step_logs` | Every failed step's logs in one call — **this is usually what you want** |
| `wait_for_build` | Poll until terminal, chime when done |
| `restart_build` | Restart a build by number (mutating; requires write scope on the token) |

Most read tools auto-detect the repo from `git config remote.origin.url` and the branch from `git rev-parse --abbrev-ref HEAD` in the model's working directory. You can always pass `repo` and `branch` explicitly to override.

## Development

```bash
git clone https://github.com/dvd-rsnw/drone-mcp.git
cd drone-mcp
npm install   # also builds dist/ via the prepare script
npm test
```

Unit tests use [`msw`](https://mswjs.io) v2 with example fixtures shaped like real Drone API responses. To capture fresh fixtures from your own Drone server, see [`test/fixtures/README.md`](./test/fixtures/README.md).

## Manual integration test

With `DRONE_SERVER` and `DRONE_TOKEN` set in your shell:

```bash
npm run build
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

You should see a JSON-RPC response listing all 6 tools.

## Roadmap

Ideas not yet implemented:

- `list_builds` with filters and pagination
- Stage approval / decline
- Cron and secret management
- Promote / rollback
- Multi-server profiles (point at multiple Drone instances)

PRs welcome.

## License

MIT
