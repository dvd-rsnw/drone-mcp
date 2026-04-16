import { z } from 'zod';
import { DroneClient, DroneBuild } from '../drone-client.js';

export const RestartBuildInput = z.object({
  build: z.number().int().positive(),
  repo: z.string().optional(),
  params: z.record(z.string()).optional(),
});
export type RestartBuildInput = z.infer<typeof RestartBuildInput>;

export async function restartBuild(
  client: DroneClient,
  args: { repo: string; build: number; params?: Record<string, string> },
): Promise<DroneBuild> {
  return client.restartBuild(args.repo, args.build, args.params);
}
