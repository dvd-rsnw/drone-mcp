import { execFileSync } from 'node:child_process';
import { GitDetectionError } from './errors.js';

export function parseGitRemote(url: string): string | undefined {
  // https://github.com/owner/repo(.git)?
  const https = url.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/.]+)(?:\.git)?\/?$/);
  if (https) return `${https[1]}/${https[2]}`;
  // git@github.com:owner/repo.git
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
