import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { KnowledgePackDomain } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ReviewerVerificationStatus,
  SENIOR_REVIEWER_EXPERIENCE_THRESHOLD_YEARS,
} from '../constants/governance.constants';
import { InMemoryReviewerCredentialRepository } from '../repositories/in-memory-reviewer-credential.repository';
import { KnowledgePackGovernanceAuditService } from './knowledge-pack-governance-audit.service';
import { ReviewerCredentialingService } from './reviewer-credentialing.service';

describe('ReviewerCredentialingService — Clinical Credentialing & Verification', () => {
  let service: ReviewerCredentialingService;
  let repository: InMemoryReviewerCredentialRepository;
  let mockPrisma: any;
  let mockAuditService: any;

  const validDoctorUserId = '11111111-1111-4111-a111-111111111111';
  const adminUserId = '22222222-2222-4222-a222-222222222222';
  const applicantDto = {
    userId: validDoctorUserId,
    clinicianName: 'Dr. Sunil Sharma',
    medicalRegistration: 'DMC-2012-54321',
    stateMedicalCouncil: 'Delhi Medical Council',
    registrationYear: 2012,
    primaryQualification: 'MBBS',
    specialtyQualification: 'MD (General Medicine)',
    specialty: KnowledgePackDomain.GENERAL_MEDICINE,
    yearsOfExperience: 12,
  };

  beforeEach(() => {
    repository = new InMemoryReviewerCredentialRepository();
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === validDoctorUserId || where.id === adminUserId) {
            return Promise.resolve({
              id: where.id,
              fullName: 'Dr. Test User',
              isActive: true,
            });
          }
          return Promise.resolve(null);
        }),
      },
    };
    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    service = new ReviewerCredentialingService(
      repository,
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as KnowledgePackGovernanceAuditService,
    );
  });

  describe('submitCredentialApplication', () => {
    it('should submit application in PENDING status and not treat as verified credentials', async () => {
      const result = await service.submitCredentialApplication(
        applicantDto,
        validDoctorUserId,
      );

      expect(result.verificationStatus).toBe(
        ReviewerVerificationStatus.PENDING,
      );
      expect(result.isExpired).toBe(false);
      expect(result.isActive).toBe(true);
      expect(result.isSeniorReviewer).toBe(true); // 12 years >= 10 threshold

      // Confirm in repository
      const stored = await repository.findByUserId(validDoctorUserId);
      expect(stored).not.toBeNull();
      expect(stored?.verificationEvidence).toBeNull();
      expect(stored?.verifiedAt).toBeNull();
      expect(stored?.verifiedByUserId).toBeNull();
    });

    it('should reject application if user submits on behalf of another user ID (Applicant Identity Spoofing)', async () => {
      // Client authenticated as validDoctorUserId passes different userId in body
      const spoofingDto = {
        ...applicantDto,
        userId: '99999999-9999-4999-a999-999999999999',
      };

      await expect(
        service.submitCredentialApplication(
          spoofingDto,
          validDoctorUserId, // Authenticated principal
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject duplicate registration with different letter casing (case-insensitive normalization)', async () => {
      await service.submitCredentialApplication(
        { ...applicantDto, medicalRegistration: 'DMC-2012-54321' },
        validDoctorUserId,
      );

      const anotherDoctorUserId = '33333333-3333-4333-a333-333333333333';
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: anotherDoctorUserId,
        isActive: true,
      });

      // Submit identical number in lowercase
      const lowercaseDto = {
        ...applicantDto,
        userId: anotherDoctorUserId,
        medicalRegistration: 'dmc-2012-54321',
      };

      await expect(
        service.submitCredentialApplication(
          lowercaseDto,
          anotherDoctorUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject application if user does not exist in database', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.submitCredentialApplication(
          applicantDto,
          validDoctorUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject application if user account is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: validDoctorUserId,
        isActive: false,
      });

      await expect(
        service.submitCredentialApplication(
          applicantDto,
          validDoctorUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject duplicate credential registration for same user', async () => {
      await service.submitCredentialApplication(applicantDto, validDoctorUserId);

      await expect(
        service.submitCredentialApplication(applicantDto, validDoctorUserId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject duplicate medical registration number if already used by another user', async () => {
      await service.submitCredentialApplication(applicantDto, validDoctorUserId);

      const anotherDoctorUserId = '33333333-3333-4333-a333-333333333333';
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: anotherDoctorUserId,
        isActive: true,
      });

      const duplicateDto = {
        ...applicantDto,
        userId: anotherDoctorUserId,
      };

      await expect(
        service.submitCredentialApplication(
          duplicateDto,
          anotherDoctorUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyCredential', () => {
    it('should verify credentials and set verification evidence and expiration', async () => {
      const summary = await service.submitCredentialApplication(
        applicantDto,
        validDoctorUserId,
      );

      const verified = await service.verifyCredential(
        summary.id,
        {
          verificationEvidence:
            'Verified via Delhi Medical Council Gazette 2012, Entry #4102',
        },
        adminUserId,
      );

      expect(verified.verificationStatus).toBe(
        ReviewerVerificationStatus.VERIFIED,
      );
      expect(verified.isExpired).toBe(false);
      expect(verified.credentialsExpiresAt).toBeInstanceOf(Date);

      const stored = await repository.findById(summary.id);
      expect(stored?.verifiedByUserId).toBe(adminUserId);
      expect(stored?.verificationEvidence).toContain('Delhi Medical Council');
    });

    it('should forbid self-verification by a reviewer', async () => {
      const summary = await service.submitCredentialApplication(
        applicantDto,
        validDoctorUserId,
      );

      await expect(
        service.verifyCredential(
          summary.id,
          { verificationEvidence: 'Self-check' },
          validDoctorUserId, // Self-verification attempt
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectCredential', () => {
    it('should record structured rejection reason', async () => {
      const summary = await service.submitCredentialApplication(
        applicantDto,
        validDoctorUserId,
      );

      const rejected = await service.rejectCredential(
        summary.id,
        { rejectionReason: 'Could not corroborate registration with SMC' },
        adminUserId,
      );

      expect(rejected.verificationStatus).toBe(
        ReviewerVerificationStatus.REJECTED,
      );

      const stored = await repository.findById(summary.id);
      expect(stored?.rejectionReason).toBe(
        'Could not corroborate registration with SMC',
      );
    });
  });

  describe('revokeCredential', () => {
    it('should immediately deactivate and revoke active credential', async () => {
      const summary = await service.submitCredentialApplication(
        applicantDto,
        validDoctorUserId,
      );
      await service.verifyCredential(
        summary.id,
        { verificationEvidence: 'Valid evidence' },
        adminUserId,
      );

      const revoked = await service.revokeCredential(
        summary.id,
        'Disciplinary sanction notice received from State Medical Council',
        adminUserId,
      );

      expect(revoked.verificationStatus).toBe(
        ReviewerVerificationStatus.REVOKED,
      );
      expect(revoked.isActive).toBe(false);
    });
  });

  describe('validateReviewerEligibility', () => {
    it('should reject unverified reviewer (status PENDING)', async () => {
      await service.submitCredentialApplication(applicantDto, validDoctorUserId);

      const check = await service.validateReviewerEligibility(
        validDoctorUserId,
        KnowledgePackDomain.GENERAL_MEDICINE,
      );

      expect(check.eligible).toBe(false);
      expect(check.reason).toContain('PENDING');
    });

    it('should reject expired credentials', async () => {
      const summary = await service.submitCredentialApplication(
        applicantDto,
        validDoctorUserId,
      );

      // Verify with an expiration in the past
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await service.verifyCredential(
        summary.id,
        {
          verificationEvidence: 'Evidence',
          validUntil: pastDate,
        },
        adminUserId,
      );

      const check = await service.validateReviewerEligibility(
        validDoctorUserId,
        KnowledgePackDomain.GENERAL_MEDICINE,
      );

      expect(check.eligible).toBe(false);
      expect(check.reason).toContain('expired');
    });

    it('should reject mismatched specialty for domain', async () => {
      const dermDoctorUserId = '44444444-4444-4444-a444-444444444444';
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: dermDoctorUserId,
        isActive: true,
      });

      const dermDto = {
        userId: dermDoctorUserId,
        clinicianName: 'Dr. Derm Specialist',
        medicalRegistration: 'DMC-2015-88888',
        stateMedicalCouncil: 'Delhi Medical Council',
        registrationYear: 2015,
        primaryQualification: 'MBBS',
        specialtyQualification: 'MD (Dermatology)',
        specialty: 'DERMATOLOGY',
        yearsOfExperience: 8,
      };

      const summary = await service.submitCredentialApplication(
        dermDto as any,
        dermDoctorUserId,
      );
      await service.verifyCredential(
        summary.id,
        { verificationEvidence: 'DMC verified' },
        adminUserId,
      );

      const check = await service.validateReviewerEligibility(
        dermDoctorUserId,
        KnowledgePackDomain.GENERAL_MEDICINE,
      );

      expect(check.eligible).toBe(false);
      expect(check.reason).toContain('does not satisfy required specialties');
    });

    it('should accept verified eligible reviewer matching domain and active credentials', async () => {
      const summary = await service.submitCredentialApplication(
        applicantDto,
        validDoctorUserId,
      );
      await service.verifyCredential(
        summary.id,
        { verificationEvidence: 'DMC Gazette verified' },
        adminUserId,
      );

      const check = await service.validateReviewerEligibility(
        validDoctorUserId,
        KnowledgePackDomain.GENERAL_MEDICINE,
      );

      expect(check.eligible).toBe(true);
      expect(check.credential?.isSeniorReviewer).toBe(true);
    });
  });
});
