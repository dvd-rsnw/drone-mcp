import { z } from 'zod';
import { DroneClient } from '../drone-client.js';

export const GetStepLogsInput = z.object({
  build: z.number().int().positive(),
  stage: z.number().int().positive(),
  step: z.number().int().positive(),
  repo: z.string().optional(),
  max_lines: z.number().int().positive().optional(),
});
export type GetStepLogsInput = z.infer<typeof GetStepLogsInput>;

export interface GetStepLogsOutput {
  lines: string[];
  line_count: number;
  truncated: boolean;
}

const DEFAULT_MAX_LINES = 500;

export async function getStepLogs(
  client: DroneClient,
  args: {
    repo: string;
    build: number;
    stage: number;
    step: number;
    max_lines?: number;
  },
): Promise<GetStepLogsOutput> {
  const envMax = Number(process.env.DRONE_MCP_MAX_LOG_LINES) || undefined;
  const cap = args.max_lines ?? envMax ?? DEFAULT_MAX_LINES;
  const logs = await client.getStepLogs(
    args.repo,
    args.build,
    args.stage,
    args.step,
  );
  // Each entry's `out` may already contain a trailing newline;
  // split on \n so one long log entry becomes multiple lines.
  const joined = logs.map((l) => l.out).join('');
  const allLines = joined.split('\n');
  // Drop the trailing empty string if the joined text ends with \n
  if (allLines.length && allLines[allLines.length - 1] === '') {
    allLines.pop();
  }
  const truncated = allLines.length > cap;
  const lines = truncated ? allLines.slice(-cap) : allLines;
  return { lines, line_count: lines.length, truncated };
}
