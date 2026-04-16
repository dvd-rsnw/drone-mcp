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
