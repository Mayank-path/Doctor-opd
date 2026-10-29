import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ClinicRole, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface BootstrapAdminInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  clinicName: string;
}

export interface BootstrapAdminResult {
  userId: string;
  clinicId: string;
  membershipId: string;
  email: string | null;
  role: ClinicRole;
  status: MembershipStatus;
}

export interface BootstrapDoctorInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  clinicId: string;
}

export interface BootstrapDoctorResult {
  userId: string;
  clinicId: string;
  membershipId: string;
  email: string | null;
  fullName: string;
  role: ClinicRole;
  status: MembershipStatus;
}

/**
 * Stable, dedicated 64-bit advisory lock key reserved for DOCTOR-OPD initial administrator bootstrap.
 * Derived from the hash of 'DOCTOR_OPD_INITIAL_BOOTSTRAP_ADVISORY_LOCK'.
 * Transaction-scoped (pg_advisory_xact_lock) ensuring automatic release on COMMIT or ROLLBACK.
 */
export const BOOTSTRAP_ADVISORY_LOCK_KEY = BigInt(428172901);

/**
 * BootstrapService provides a controlled provisioning mechanism for the initial clinic administrator.
 *
 * Requirements & Invariants:
 * - Never exposed via HTTP endpoint.
 * - Concurrency & Mutual Exclusion: Serialized via PostgreSQL transaction-scoped advisory lock (pg_advisory_xact_lock).
 * - Idempotency & Freshness: Refuses execution if any user record already exists in PostgreSQL.
 * - Transactional: User, Clinic, and ACTIVE ADMIN Membership are created in a single ACID transaction.
 * - Password Security: Hashes password using Argon2id; passwords and hashes are never logged.
 */
@Injectable()
export class BootstrapService {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async bootstrapAdmin(
    input: BootstrapAdminInput,
  ): Promise<BootstrapAdminResult> {
    if (!input.email || !input.email.includes('@')) {
      throw new Error('Bootstrap failed: A valid email address is required.');
    }

    if (!input.password || input.password.length < 8) {
      throw new Error(
        'Bootstrap failed: Password must be at least 8 characters long.',
      );
    }

    if (!input.phone || input.phone.trim().length === 0) {
      throw new Error('Bootstrap failed: Phone number is required.');
    }

    if (!input.fullName || input.fullName.trim().length === 0) {
      throw new Error('Bootstrap failed: Full name is required.');
    }

    if (!input.clinicName || input.clinicName.trim().length === 0) {
      throw new Error('Bootstrap failed: Clinic name is required.');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = input.phone.trim();
    const normalizedFullName = input.fullName.trim();
    const normalizedClinicName = input.clinicName.trim();

    // Check if database already has users before performing CPU-expensive hashing
    const existingUserCount = await this.prisma.user.count();
    if (existingUserCount > 0) {
      throw new Error(
        'Bootstrap refused: Database already contains user accounts. Initial bootstrap is strictly permitted only on a fresh database.',
      );
    }

    // Hash password using Argon2id
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    // Create user, clinic, and membership transactionally with PostgreSQL advisory lock
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Acquire transaction-scoped advisory lock; blocks concurrent processes until transaction commits/aborts
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_ADVISORY_LOCK_KEY}::bigint);`;

      // 2. Re-verify in transaction under advisory lock to prevent race conditions
      const count = await tx.user.count();
      if (count > 0) {
        throw new Error(
          'Bootstrap refused: Concurrent creation detected; database is not empty.',
        );
      }

      const user = await tx.user.create({
        data: {
          fullName: normalizedFullName,
          phone: normalizedPhone,
          email: normalizedEmail,
          passwordHash,
          isActive: true,
        },
      });

      const clinic = await tx.clinic.create({
        data: {
          name: normalizedClinicName,
          isActive: true,
        },
      });

      const membership = await tx.clinicMembership.create({
        data: {
          userId: user.id,
          clinicId: clinic.id,
          role: ClinicRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });

      return {
        userId: user.id,
        clinicId: clinic.id,
        membershipId: membership.id,
        email: user.email,
        role: membership.role,
        status: membership.status,
      };
    });

    this.logger.log(
      `Initial clinic administrator provisioned successfully for clinicId: ${result.clinicId}`,
    );

    return result;
  }

  async bootstrapDoctor(
    input: BootstrapDoctorInput,
  ): Promise<BootstrapDoctorResult> {
    if (!input.email || !input.email.includes('@')) {
      throw new Error('Bootstrap failed: A valid email address is required.');
    }

    if (!input.password || input.password.length < 8) {
      throw new Error(
        'Bootstrap failed: Password must be at least 8 characters long.',
      );
    }

    if (!input.phone || input.phone.trim().length === 0) {
      throw new Error('Bootstrap failed: Phone number is required.');
    }

    if (!input.fullName || input.fullName.trim().length === 0) {
      throw new Error('Bootstrap failed: Full name is required.');
    }

    if (!input.clinicId || input.clinicId.trim().length === 0) {
      throw new Error('Bootstrap failed: Target clinic ID is required.');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = input.phone.trim();
    const normalizedFullName = input.fullName.trim();
    const normalizedClinicId = input.clinicId.trim();

    // 1. Verify target clinic exists and is active before hashing
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: normalizedClinicId },
    });

    if (!clinic) {
      throw new Error(
        `Bootstrap failed: Target clinic with ID "${normalizedClinicId}" not found.`,
      );
    }

    if (!clinic.isActive) {
      throw new Error(
        `Bootstrap failed: Target clinic "${clinic.name}" (${normalizedClinicId}) is inactive.`,
      );
    }

    // 2. Check unique constraints before hashing
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUserByEmail) {
      throw new Error(
        `Bootstrap failed: A user with email "${normalizedEmail}" already exists.`,
      );
    }

    const existingUserByPhone = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });
    if (existingUserByPhone) {
      throw new Error(
        `Bootstrap failed: A user with phone number "${normalizedPhone}" already exists.`,
      );
    }

    // 3. Hash password using Argon2id
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    // 4. Create doctor user and membership transactionally
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-verify in transaction to prevent race conditions
      const clinicInTx = await tx.clinic.findUnique({
        where: { id: normalizedClinicId },
      });
      if (!clinicInTx || !clinicInTx.isActive) {
        throw new Error(
          'Bootstrap failed: Target clinic not found or is inactive.',
        );
      }

      const emailInTx = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (emailInTx) {
        throw new Error(
          `Bootstrap failed: A user with email "${normalizedEmail}" already exists.`,
        );
      }

      const phoneInTx = await tx.user.findUnique({
        where: { phone: normalizedPhone },
      });
      if (phoneInTx) {
        throw new Error(
          `Bootstrap failed: A user with phone number "${normalizedPhone}" already exists.`,
        );
      }

      const user = await tx.user.create({
        data: {
          fullName: normalizedFullName,
          phone: normalizedPhone,
          email: normalizedEmail,
          passwordHash,
          isActive: true,
        },
      });

      const membership = await tx.clinicMembership.create({
        data: {
          userId: user.id,
          clinicId: clinicInTx.id,
          role: ClinicRole.DOCTOR,
          status: MembershipStatus.ACTIVE,
        },
      });

      return {
        userId: user.id,
        clinicId: clinicInTx.id,
        membershipId: membership.id,
        email: user.email,
        fullName: user.fullName,
        role: membership.role,
        status: membership.status,
      };
    });

    this.logger.log(
      `Doctor provisioned successfully: ${result.fullName} (${result.userId}) for clinicId: ${result.clinicId}`,
    );

    return result;
  }
}
