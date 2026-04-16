import { z } from 'zod';
import { DroneClient, DroneBuild } from '../drone-client.js';
import { NotFoundError } from '../errors.js';

export const GetLatestBuildInput = z.object({
  branch: z.string().optional(),
  repo: z.string().optional(),
  event: z.enum(['push', 'pull_request', 'cron']).optional(),
});
export type GetLatestBuildInput = z.infer<typeof GetLatestBuildInput>;

export interface GetLatestBuildOutput {
  number: number;
  status: string;
  event: string;
  ref: string;
  source: string;
  target: string;
  author: string;
  started: number;
  finished: number;
  link: string;
  stages_summary: Array<{ name: string; status: string }>;
}

function matches(
  build: DroneBuild,
  branch: string,
  event: string | undefined,
): boolean {
  if (event && build.event !== event) return false;
  const bySource = build.source === branch;
  const byPushTarget = build.event === 'push' && build.target === branch;
  const byCronTarget = build.event === 'cron' && build.target === branch;
  return bySource || byPushTarget || byCronTarget;
}

export async function getLatestBuild(
  client: DroneClient,
  args: { repo: string; branch: string; event?: string },
): Promise<GetLatestBuildOutput> {
  const builds = await client.listBuilds(args.repo, { perPage: 25 });
  const matching = builds.filter((b) => matches(b, args.branch, args.event));
  if (matching.length === 0) {
    throw new NotFoundError(
      `No builds found for ${args.repo} matching branch "${args.branch}"${
        args.event ? ` with event "${args.event}"` : ''
      } in the most recent 25 builds.`,
    );
  }
  matching.sort((a, b) => b.number - a.number);
  const b = matching[0];
  return {
    number: b.number,
    status: b.status,
    event: b.event,
    ref: b.ref,
    source: b.source,
    target: b.target,
    author: b.author_login || b.sender,
    started: b.started,
    finished: b.finished,
    link: b.link,
    stages_summary: (b.stages ?? []).map((s) => ({
      name: s.name,
      status: s.status,
    })),
  };
}
