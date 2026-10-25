import {
  parseDatabaseTarget,
  validateDatabaseEnvironment,
} from './bootstrap-target.util';

describe('Bootstrap Database Target and Environment Guards', () => {
  describe('parseDatabaseTarget', () => {
    it('should correctly parse host, port, and database name from valid PostgreSQL URL', () => {
      const url =
        'postgresql://admin:secret123@db.internal.hospital.com:5433/opd_staging?schema=public';
      const target = parseDatabaseTarget(url);

      expect(target.host).toBe('db.internal.hospital.com');
      expect(target.port).toBe('5433');
      expect(target.databaseName).toBe('opd_staging');

      // Ensure credentials are NOT leaked in returned object
      expect(Object.keys(target)).toEqual(['host', 'port', 'databaseName']);
    });

    it('should throw if DATABASE_URL is missing or empty', () => {
      expect(() => parseDatabaseTarget('')).toThrow(
        'DATABASE_URL is not configured.',
      );
      expect(() => parseDatabaseTarget(undefined)).toThrow(
        'DATABASE_URL is not configured.',
      );
    });

    it('should throw if DATABASE_URL is malformed', () => {
      expect(() => parseDatabaseTarget('not-a-valid-url')).toThrow(
        'DATABASE_URL format is invalid.',
      );
    });
  });

  describe('validateDatabaseEnvironment', () => {
    it('should refuse execution if NODE_ENV is production', () => {
      const env = { NODE_ENV: 'production' };
      expect(() =>
        validateDatabaseEnvironment(env, 'doctor_opd_prod', false),
      ).toThrow(
        /Direct CLI bootstrap execution is disabled in production environment/,
      );
    });

    it('should accept valid non-interactive execution when confirmation matches target name', () => {
      const env = {
        NODE_ENV: 'development',
        BOOTSTRAP_CONFIRM_DATABASE_NAME: 'doctor_opd_dev',
      };
      expect(() =>
        validateDatabaseEnvironment(env, 'doctor_opd_dev', false),
      ).not.toThrow();
    });

    it('should refuse non-interactive execution if BOOTSTRAP_CONFIRM_DATABASE_NAME is missing or mismatched', () => {
      const envMissing = { NODE_ENV: 'development' };
      expect(() =>
        validateDatabaseEnvironment(envMissing, 'doctor_opd_dev', false),
      ).toThrow(/requires explicit BOOTSTRAP_CONFIRM_DATABASE_NAME/);

      const envMismatched = {
        NODE_ENV: 'development',
        BOOTSTRAP_CONFIRM_DATABASE_NAME: 'wrong_db',
      };
      expect(() =>
        validateDatabaseEnvironment(envMismatched, 'doctor_opd_dev', false),
      ).toThrow(/requires explicit BOOTSTRAP_CONFIRM_DATABASE_NAME/);
    });

    it('should accept interactive confirmation when operator types exact target name', () => {
      const env = { NODE_ENV: 'development' };
      expect(() =>
        validateDatabaseEnvironment(
          env,
          'doctor_opd_dev',
          true,
          'doctor_opd_dev',
        ),
      ).not.toThrow();
    });

    it('should reject interactive confirmation when operator types wrong name', () => {
      const env = { NODE_ENV: 'development' };
      expect(() =>
        validateDatabaseEnvironment(env, 'doctor_opd_dev', true, 'random_db'),
      ).toThrow(/was not confirmed by operator/);
    });
  });
});
