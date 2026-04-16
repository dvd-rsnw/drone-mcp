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
