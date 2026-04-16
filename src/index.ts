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
import { RestartBuildInput, restartBuild } from './tools/restart-build.js';

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
    {
      name: 'restart_build',
      description:
        'Restart a Drone build by number. **Mutating operation** — kicks off a new build run with the same commit/ref. Requires write scope on the Drone token. The build number is required (no auto-default to latest, to prevent accidental restarts). Optional `params` (Record<string, string>) become env-var overrides for the new build.',
      inputSchema: zodToJsonSchema(RestartBuildInput),
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
        case 'restart_build': {
          const a = RestartBuildInput.parse(rawArgs);
          result = await restartBuild(client, {
            repo: resolveRepo(a.repo, { defaultRepo: config.defaultRepo }),
            build: a.build,
            params: a.params,
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
