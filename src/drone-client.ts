import { AuthError, NotFoundError, NetworkError, DroneApiError } from './errors.js';

export interface DroneStep {
  id: number;
  number: number;
  name: string;
  status: string;
  exit_code: number;
  started?: number;
  stopped?: number;
  image?: string;
  depends_on?: string[];
}

export interface DroneStage {
  id: number;
  number: number;
  name: string;
  status: string;
  steps?: DroneStep[];
  started?: number;
  stopped?: number;
}

export interface DroneBuild {
  id: number;
  number: number;
  status: string;
  event: string;
  ref: string;
  source: string;
  target: string;
  author_login: string;
  author_email: string;
  sender: string;
  message: string;
  link: string;
  started: number;
  finished: number;
  created: number;
  updated: number;
  stages?: DroneStage[];
}

export interface DroneLogLine {
  pos: number;
  out: string;
  time: number;
}

export interface DroneClientConfig {
  server: string;
  token: string;
}

export class DroneClient {
  constructor(private readonly config: DroneClientConfig) {}

  async listBuilds(
    repo: string,
    opts: { perPage?: number } = {},
  ): Promise<DroneBuild[]> {
    const perPage = opts.perPage ?? 25;
    return this.get<DroneBuild[]>(
      `/api/repos/${repo}/builds?per_page=${perPage}`,
    );
  }

  async getBuild(repo: string, number: number): Promise<DroneBuild> {
    return this.get<DroneBuild>(`/api/repos/${repo}/builds/${number}`);
  }

  async getStepLogs(
    repo: string,
    build: number,
    stage: number,
    step: number,
  ): Promise<DroneLogLine[]> {
    return this.get<DroneLogLine[]>(
      `/api/repos/${repo}/builds/${build}/logs/${stage}/${step}`,
    );
  }

  async restartBuild(
    repo: string,
    build: number,
    params?: Record<string, string>,
  ): Promise<DroneBuild> {
    const qs = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<DroneBuild>(
      'POST',
      `/api/repos/${repo}/builds/${build}${qs}`,
    );
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
  ): Promise<T> {
    const url = `${this.config.server}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
    } catch (err) {
      throw new NetworkError(
        `Failed to reach ${this.config.server}: ${(err as Error).message}`,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(
        `Authentication failed (${res.status}). Check DRONE_TOKEN.`,
      );
    }
    if (res.status === 404) {
      throw new NotFoundError(`Not found: ${path}`);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new DroneApiError(res.status, body);
    }
    return (await res.json()) as T;
  }
}
