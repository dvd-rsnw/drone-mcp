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
