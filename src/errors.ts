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
