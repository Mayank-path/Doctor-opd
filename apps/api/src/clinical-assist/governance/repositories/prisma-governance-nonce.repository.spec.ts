import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaGovernanceNonceRepository } from './prisma-governance-nonce.repository';

describe('PrismaGovernanceNonceRepository — Persistent Replay Protection', () => {
  let repository: PrismaGovernanceNonceRepository;
  let mockPrisma: any;

  const sampleVersionId = '11111111-2222-3333-4444-555555555555';
  const sampleReviewerId = 'user-reviewer-uuid-1';
  const sampleNonce = '01234567-89ab-cdef-0123-456789abcdef';

  beforeEach(() => {
    const nonceDb = new Map<string, any>();

    mockPrisma = {
      governanceAttestationNonce: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(nonceDb.get(where.nonce) || null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          if (nonceDb.has(data.nonce)) {
            const error: any = new Error('Unique constraint failed');
            error.code = 'P2002';
            return Promise.reject(error);
          }
          const created = {
            id: `nonce-${Math.random().toString(36).substring(7)}`,
            ...data,
            consumedAt: new Date(),
          };
          nonceDb.set(data.nonce, created);
          return Promise.resolve(created);
        }),
        deleteMany: jest.fn().mockImplementation(() => {
          nonceDb.clear();
          return Promise.resolve({ count: 0 });
        }),
      },
    };

    repository = new PrismaGovernanceNonceRepository(
      mockPrisma as unknown as PrismaService,
    );
  });

  it('checks and reports unconsumed nonce as false', async () => {
    const isConsumed = await repository.isConsumed(sampleNonce);
    expect(isConsumed).toBe(false);
  });

  it('atomically consumes a new nonce and marks it consumed', async () => {
    const consumed = await repository.consumeAtomic(
      sampleNonce,
      sampleVersionId,
      sampleReviewerId,
    );

    expect(consumed.id).toBeDefined();
    expect(consumed.nonce).toBe(sampleNonce);
    expect(consumed.versionId).toBe(sampleVersionId);
    expect(consumed.reviewerUserId).toBe(sampleReviewerId);

    const isNowConsumed = await repository.isConsumed(sampleNonce);
    expect(isNowConsumed).toBe(true);
  });

  it('rejects duplicate nonce consumption with ConflictException (P2002 unique constraint violation)', async () => {
    await repository.consumeAtomic(
      sampleNonce,
      sampleVersionId,
      sampleReviewerId,
    );

    await expect(
      repository.consumeAtomic(
        sampleNonce,
        sampleVersionId,
        sampleReviewerId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('handles P2021 table missing error gracefully via pre-migration buffer', async () => {
    // Force P2021 error on Prisma call
    mockPrisma.governanceAttestationNonce.findUnique.mockRejectedValueOnce({
      code: 'P2021',
      message: 'Table does not exist',
    });

    const isConsumed = await repository.isConsumed('fallback-nonce');
    expect(isConsumed).toBe(false);

    // Force P2021 error on create
    mockPrisma.governanceAttestationNonce.create.mockRejectedValueOnce({
      code: 'P2021',
      message: 'Table does not exist',
    });

    const consumed = await repository.consumeAtomic(
      'fallback-nonce',
      sampleVersionId,
      sampleReviewerId,
    );
    expect(consumed.nonce).toBe('fallback-nonce');

    // Attempting to consume same nonce in pre-migration buffer must throw ConflictException
    await expect(
      repository.consumeAtomic(
        'fallback-nonce',
        sampleVersionId,
        sampleReviewerId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('clears consumed nonces upon reset', async () => {
    await repository.consumeAtomic(
      sampleNonce,
      sampleVersionId,
      sampleReviewerId,
    );
    await repository.clear();

    const isConsumed = await repository.isConsumed(sampleNonce);
    expect(isConsumed).toBe(false);
  });
});
