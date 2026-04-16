import { spawn } from 'node:child_process';

export interface ChimeOptions {
  chime: string;
  platform?: NodeJS.Platform;
}

export function playChime(opts: ChimeOptions): void {
  if (opts.chime === 'off') return;
  const platform = opts.platform ?? process.platform;
  const soundName = opts.chime === 'on' ? 'Glass' : opts.chime;

  try {
    if (platform === 'darwin') {
      const child = spawn(
        'afplay',
        [`/System/Library/Sounds/${soundName}.aiff`],
        { stdio: 'ignore', detached: true },
      );
      child.on('error', () => {});
      child.unref();
      return;
    }
    if (platform === 'linux') {
      // Fall back to terminal bell — bundling a WAV is v2
      process.stderr.write('\x07');
      return;
    }
    // Windows + other: no-op
  } catch {
    // Never let chime break the tool call
  }
}
