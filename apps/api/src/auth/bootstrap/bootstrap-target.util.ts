export interface DatabaseTargetInfo {
  host: string;
  port: string;
  databaseName: string;
}

/**
 * Extracts host, port, and database name from a connection URL without exposing credentials.
 * Never prints or returns username, password, or full URL.
 */
export function parseDatabaseTarget(
  connectionUrl?: string,
): DatabaseTargetInfo {
  if (!connectionUrl || connectionUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is not configured.');
  }

  try {
    const parsed = new URL(connectionUrl);
    const host = parsed.hostname || 'localhost';
    const port = parsed.port || '5432';
    const databaseName = parsed.pathname.replace(/^\//, '') || 'unknown';

    return { host, port, databaseName };
  } catch {
    throw new Error('DATABASE_URL format is invalid.');
  }
}

/**
 * Enforces database environment guards:
 * - Refuses execution if NODE_ENV === 'production'
 * - In non-interactive mode, requires explicit BOOTSTRAP_CONFIRM_DATABASE_NAME matching targetDb
 */
export function validateDatabaseEnvironment(
  env: NodeJS.ProcessEnv,
  targetDbName: string,
  isInteractive: boolean,
  userConfirmationAnswer?: string,
): void {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Bootstrap refused: Direct CLI bootstrap execution is disabled in production environment (NODE_ENV=production).',
    );
  }

  if (isInteractive) {
    if (userConfirmationAnswer !== targetDbName) {
      throw new Error(
        `Bootstrap cancelled: Target database "${targetDbName}" was not confirmed by operator.`,
      );
    }
  } else {
    const confirmationEnv = env.BOOTSTRAP_CONFIRM_DATABASE_NAME;
    if (!confirmationEnv || confirmationEnv.trim() !== targetDbName) {
      throw new Error(
        `Bootstrap refused: Non-interactive execution requires explicit BOOTSTRAP_CONFIRM_DATABASE_NAME="${targetDbName}" to prevent accidental execution against wrong target.`,
      );
    }
  }
}
