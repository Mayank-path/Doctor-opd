import { KnowledgePackDomain } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReviewerVerificationStatus } from '../constants/governance.constants';
import { ReviewerCredential } from '../interfaces/reviewer-credential.interface';
import { PrismaReviewerCredentialRepository } from './prisma-reviewer-credential.repository';

describe('PrismaReviewerCredentialRepository — Persistence & Registration Normalization', () => {
  let repository: PrismaReviewerCredentialRepository;
  let mockPrisma: any;
  let inMemoryDb: Map<string, any>;
  let historyDb: any[];

  const createSampleCredential = (
    userId = 'user-1',
    reg = 'DMC-2015-12345',
  ): ReviewerCredential => ({
    id: `cred-${userId}`,
    userId,
    clinicianName: 'Dr. Persistent Test',
    medicalRegistration: reg,
    stateMedicalCouncil: 'Delhi Medical Council',
    registrationYear: 2015,
    primaryQualification: 'MBBS',
    specialtyQualification: 'MD (General Medicine)',
    specialty: KnowledgePackDomain.GENERAL_MEDICINE,
    yearsOfExperience: 11,
    isSeniorReviewer: true,
    verificationStatus: ReviewerVerificationStatus.PENDING,
    verificationEvidence: null,
    verifiedByUserId: null,
    verifiedAt: null,
    rejectionReason: null,
    credentialsExpiresAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    inMemoryDb = new Map();
    historyDb = [];

    mockPrisma = {
      reviewerCredential: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.userId) {
            for (const item of inMemoryDb.values()) {
              if (item.userId === where.userId) return Promise.resolve({ ...item });
            }
          }
          if (where.id) {
            const item = inMemoryDb.get(where.id);
            return Promise.resolve(item ? { ...item } : null);
          }
          if (where.medicalRegistration) {
            for (const item of inMemoryDb.values()) {
              if (
                item.medicalRegistration.toUpperCase() ===
                where.medicalRegistration.toUpperCase()
              ) {
                return Promise.resolve({ ...item });
              }
            }
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = { ...data, updatedAt: new Date(), createdAt: new Date() };
          inMemoryDb.set(created.id, created);
          return Promise.resolve({ ...created });
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const existing = inMemoryDb.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          inMemoryDb.set(where.id, updated);
          return Promise.resolve({ ...updated });
        }),
        findMany: jest.fn().mockImplementation(() => {
          return Promise.resolve(Array.from(inMemoryDb.values()).map((v) => ({ ...v })));
        }),
        deleteMany: jest.fn().mockImplementation(() => {
          inMemoryDb.clear();
          return Promise.resolve({ count: 0 });
        }),
      },
      reviewerVerificationHistory: {
        create: jest.fn().mockImplementation(({ data }) => {
          const record = { id: `hist-${historyDb.length + 1}`, ...data };
          historyDb.push(record);
          return Promise.resolve(record);
        }),
        deleteMany: jest.fn().mockImplementation(() => {
          historyDb = [];
          return Promise.resolve({ count: 0 });
        }),
      },
    };

    repository = new PrismaReviewerCredentialRepository(
      mockPrisma as unknown as PrismaService,
    );
  });

  it('should persist credential and normalize medical registration to uppercase', async () => {
    const cred = createSampleCredential('user-persist-1', 'dmc-2015-lowercase');
    const saved = await repository.save(cred);

    expect(saved.medicalRegistration).toBe('DMC-2015-LOWERCASE');
    expect(mockPrisma.reviewerCredential.create).toHaveBeenCalled();

    // Verify history was recorded
    expect(mockPrisma.reviewerVerificationHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credentialId: cred.id,
          action: 'SUBMITTED',
          actorUserId: 'user-persist-1',
        }),
      }),
    );
  });

  it('should find credential case-insensitively by medical registration', async () => {
    const cred = createSampleCredential('user-find-1', 'MMC-2010-99999');
    await repository.save(cred);

    const found = await repository.findByMedicalRegistration('mmc-2010-99999');
    expect(found).not.toBeNull();
    expect(found?.userId).toBe('user-find-1');
  });

  it('should retrieve persistent credential across repository instances with same database', async () => {
    const cred = createSampleCredential('user-recreate-1', 'DMC-2018-77777');
    await repository.save(cred);

    // Instantiate a new repository instance pointing to the same Prisma client
    const newRepoInstance = new PrismaReviewerCredentialRepository(
      mockPrisma as unknown as PrismaService,
    );

    const retrieved = await newRepoInstance.findByUserId('user-recreate-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(cred.id);
    expect(retrieved?.medicalRegistration).toBe('DMC-2018-77777');
  });

  it('should record append-only verification history when verificationStatus transitions', async () => {
    const cred = createSampleCredential('user-history-1', 'DMC-2012-33333');
    await repository.save(cred);

    await repository.update(cred.id, {
      verificationStatus: ReviewerVerificationStatus.VERIFIED,
      verificationEvidence: 'Gazette Verified #1234',
      verifiedByUserId: 'admin-actor-uuid',
    });

    expect(mockPrisma.reviewerVerificationHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credentialId: cred.id,
          action: ReviewerVerificationStatus.VERIFIED,
          fromStatus: ReviewerVerificationStatus.PENDING,
          toStatus: ReviewerVerificationStatus.VERIFIED,
          actorUserId: 'admin-actor-uuid',
          evidence: 'Gazette Verified #1234',
        }),
      }),
    );
  });

  it('should handle P2021 table missing error gracefully via pre-migration buffer', async () => {
    const tableMissingError: any = new Error(
      'relation "reviewer_credentials" does not exist in the current database',
    );
    tableMissingError.code = 'P2021';

    mockPrisma.reviewerCredential.create.mockRejectedValueOnce(tableMissingError);

    const cred = createSampleCredential('user-buffer-1', 'DMC-2022-88888');
    const saved = await repository.save(cred);

    expect(saved.userId).toBe('user-buffer-1');

    mockPrisma.reviewerCredential.findUnique.mockRejectedValueOnce(tableMissingError);
    const retrievedFromBuffer = await repository.findByUserId('user-buffer-1');
    expect(retrievedFromBuffer).not.toBeNull();
    expect(retrievedFromBuffer?.userId).toBe('user-buffer-1');
  });
});

