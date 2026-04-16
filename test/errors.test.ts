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
