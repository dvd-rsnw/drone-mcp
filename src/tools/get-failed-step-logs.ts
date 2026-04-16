import { z } from 'zod';
import { DroneClient } from '../drone-client.js';
import { getStepLogs, GetStepLogsOutput } from './get-step-logs.js';

export const GetFailedStepLogsInput = z.object({
  build: z.number().int().positive().optional(),
  repo: z.string().optional(),
  max_lines: z.number().int().positive().optional(),
});
export type GetFailedStepLogsInput = z.infer<typeof GetFailedStepLogsInput>;

export interface FailedStepLog {
  stage: number;
  stage_name: string;
  step: number;
  step_name: string;
  exit_code: number;
  logs: GetStepLogsOutput;
}

export interface GetFailedStepLogsOutput {
  status: string;
  build_number: number;
  failures: FailedStepLog[];
  message?: string;
}

export async function getFailedStepLogs(
  client: DroneClient,
  args: { repo: string; build: number; max_lines?: number },
): Promise<GetFailedStepLogsOutput> {
  const build = await client.getBuild(args.repo, args.build);
  const failures: FailedStepLog[] = [];

  for (const stage of build.stages ?? []) {
    for (const step of stage.steps ?? []) {
      if (step.status === 'failure' && step.exit_code !== 0) {
        const logs = await getStepLogs(client, {
          repo: args.repo,
          build: args.build,
          stage: stage.number,
          step: step.number,
          max_lines: args.max_lines,
        });
        failures.push({
          stage: stage.number,
          stage_name: stage.name,
          step: step.number,
          step_name: step.name,
          exit_code: step.exit_code,
          logs,
        });
      }
    }
  }

  let message: string | undefined;
  if (failures.length === 0) {
    if (build.status === 'running' || build.status === 'pending') {
      const pending = (build.stages ?? [])
        .flatMap((s) => s.steps ?? [])
        .filter((s) => s.status === 'pending' || s.status === 'running').length;
      message = `Build still ${build.status}, ${pending} steps pending. Call wait_for_build to block until it finishes.`;
    } else if (build.status === 'success') {
      message = 'Build succeeded.';
    } else {
      message = `Build status: ${build.status}, no failed steps found.`;
    }
  }

  return {
    status: build.status,
    build_number: build.number,
    failures,
    message,
  };
}
