import { z } from 'zod';
import { DroneClient, DroneBuild } from '../drone-client.js';

export const GetBuildInput = z.object({
  build: z.number().int().positive(),
  repo: z.string().optional(),
});
export type GetBuildInput = z.infer<typeof GetBuildInput>;

export async function getBuild(
  client: DroneClient,
  args: { repo: string; build: number },
): Promise<DroneBuild> {
  return client.getBuild(args.repo, args.build);
}
