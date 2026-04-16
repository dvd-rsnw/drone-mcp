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
    expect(resolveRepo('octocat/foo', { defaultRepo: 'x/y' })).toBe(
      'octocat/foo',
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
