import * as fs from 'fs';
import * as path from 'path';

export interface EnvLoadResult {
  loaded: boolean;
  path?: string;
  keysCount?: number;
}

/**
 * Parses .env file content and safely populates process.env.
 * Does not overwrite environment variables that are already defined.
 */
export function parseAndApplyEnv(content: string): number {
  let count = 0;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let val = trimmed.slice(eqIndex + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
        count++;
      }
    }
  }
  return count;
}

/**
 * Loads environment variables from the nearest `.env` file into `process.env`.
 *
 * Supported candidate paths:
 * 1. `apps/api/.env` (resolved from repo root `process.cwd()`)
 * 2. `.env` (resolved from `apps/api` working directory)
 * 3. Relative paths from `__dirname` for compiled dist / ts-node execution
 *
 * Preserves existing process-level environment variables (does not overwrite).
 */
export function loadEnvironment(): EnvLoadResult {
  const candidatePaths = [
    path.resolve(process.cwd(), 'apps/api/.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../apps/api/.env'),
    path.resolve(__dirname, '../.env'),
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        const count = parseAndApplyEnv(content);
        return { loaded: true, path: envPath, keysCount: count };
      } catch (err: any) {
        // Continue checking other candidates if error occurs
      }
    }
  }

  return { loaded: false };
}
