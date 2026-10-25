import { ClinicRole, MembershipStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  isActive: boolean;
}

export interface JwtPayload {
  sub: string;
  phone: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
}

export interface ActiveClinicContext {
  clinicId: string;
  membershipId: string;
  role: ClinicRole;
  status: MembershipStatus;
}

export interface RequestWithAuth {
  user?: AuthenticatedUser;
  clinic?: ActiveClinicContext;
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  query?: Record<string, string | string[] | undefined>;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: {
    id: string;
    email: string | null;
    fullName: string;
  };
}
