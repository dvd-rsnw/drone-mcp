import { z } from 'zod';
import { DroneClient } from '../drone-client.js';
import { playChime } from '../chime.js';

export const WaitForBuildInput = z.object({
  build: z.number().int().positive().optional(),
  repo: z.string().optional(),
  timeout_seconds: z.number().int().nonnegative().optional(),
  poll_interval_seconds: z.number().int().nonnegative().optional(),
});
export type WaitForBuildInput = z.infer<typeof WaitForBuildInput>;

export interface WaitForBuildOutput {
  terminal: boolean;
  status: string;
  waited_seconds: number;
  build_number: number;
}

const TERMINAL_STATUSES = new Set(['success', 'failure', 'killed', 'error']);
const DEFAULT_TIMEOUT = 600;
const MAX_TIMEOUT = 1800;
const DEFAULT_POLL = 45;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForBuild(
  client: DroneClient,
  args: {
    repo: string;
    build: number;
    timeout_seconds?: number;
    poll_interval_seconds?: number;
    chime?: string;
  },
): Promise<WaitForBuildOutput> {
  const timeout = Math.min(
    args.timeout_seconds ?? DEFAULT_TIMEOUT,
    MAX_TIMEOUT,
  );
  const interval = args.poll_interval_seconds ?? DEFAULT_POLL;
  const chime = args.chime ?? 'on';

  const startMs = Date.now();

  while (true) {
    const build = await client.getBuild(args.repo, args.build);
    const waited = Math.floor((Date.now() - startMs) / 1000);
    if (TERMINAL_STATUSES.has(build.status)) {
      playChime({ chime });
      return {
        terminal: true,
        status: build.status,
        waited_seconds: waited,
        build_number: build.number,
      };
    }
    if (waited >= timeout) {
      return {
        terminal: false,
        status: build.status,
        waited_seconds: waited,
        build_number: build.number,
      };
    }
    await sleep(interval * 1000);
  }
}
