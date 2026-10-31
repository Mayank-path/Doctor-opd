import * as path from 'path';
import { loadEnvironment } from './env.loader';

describe('Environment Loader (env.loader)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should locate and load environment variables from candidate paths without throwing', () => {
    const result = loadEnvironment();
    console.log('Jest env test result:', result, 'keys in process.env:', Object.keys(process.env).filter(k => k.includes('JWT')));
    expect(result.loaded).toBe(true);
    expect(result.path).toBeDefined();
    expect(result.path).toContain('.env');
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.JWT_SECRET!.length).toBeGreaterThanOrEqual(32);
  });

  it('should not overwrite an already existing environment variable', () => {
    process.env.CUSTOM_TEST_VAR = 'pre-existing-value';
    process.env.JWT_ISSUER = 'custom-issuer-override';

    loadEnvironment();

    expect(process.env.CUSTOM_TEST_VAR).toBe('pre-existing-value');
    expect(process.env.JWT_ISSUER).toBe('custom-issuer-override');
  });
});
