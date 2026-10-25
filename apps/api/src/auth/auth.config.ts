export interface AuthConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtExpiresIn: string;
}

export function loadAuthConfig(): AuthConfig {
  const secret = process.env.JWT_SECRET;
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '1h';

  if (!secret || secret.trim().length < 32) {
    throw new Error(
      'Authentication configuration error: JWT_SECRET must be configured and at least 32 characters long.',
    );
  }

  if (!issuer || issuer.trim().length === 0) {
    throw new Error(
      'Authentication configuration error: JWT_ISSUER must be configured.',
    );
  }

  if (!audience || audience.trim().length === 0) {
    throw new Error(
      'Authentication configuration error: JWT_AUDIENCE must be configured.',
    );
  }

  return {
    jwtSecret: secret.trim(),
    jwtIssuer: issuer.trim(),
    jwtAudience: audience.trim(),
    jwtExpiresIn: expiresIn.trim(),
  };
}
