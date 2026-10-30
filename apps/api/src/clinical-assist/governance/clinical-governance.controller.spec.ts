import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClinicRole, KnowledgePackDomain } from '@prisma/client';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClinicalGovernanceController } from './clinical-governance.controller';
import { GovernanceAdminGuard } from './guards/governance-admin.guard';
import { GovernanceReleaseAuthorityGuard } from './guards/governance-release-authority.guard';
import { GovernanceReviewerGuard } from './guards/governance-reviewer.guard';
import { KnowledgePackReleaseAuthorityService } from './services/knowledge-pack-release-authority.service';
import { MultiSignatureApprovalService } from './services/multi-signature-approval.service';
import { ReviewerCredentialingService } from './services/reviewer-credentialing.service';
import { ReviewerKeyManagementService } from './services/reviewer-key-management.service';
import { ReviewerVerificationStatus } from './constants/governance.constants';

describe('ClinicalGovernanceController & Governance Guards — Role & Tenant Boundaries', () => {
  let controller: ClinicalGovernanceController;
  let reviewerGuard: GovernanceReviewerGuard;
  let adminGuard: GovernanceAdminGuard;
  let releaseGuard: GovernanceReleaseAuthorityGuard;
  let mockCredentialingService: any;
  let mockMultiSigService: any;
  let mockKeyManagementService: any;
  let mockReleaseAuthorityService: any;

  const validDoctorUserId = '11111111-1111-4111-a111-111111111111';
  const clinicId = 'clinic-alpha-uuid';

  beforeEach(async () => {
    mockKeyManagementService = {
      registerPublicKey: jest.fn().mockResolvedValue({
        id: 'key-1',
        reviewerUserId: validDoctorUserId,
        status: 'ACTIVE',
        keyFingerprint: 'SHA256:73a7b333d0e6776610f16e49cc2d4fc6836baca42ed49875ab52e5f0b60e9644',
      }),
      rotatePublicKey: jest.fn().mockResolvedValue({
        id: 'key-2',
        reviewerUserId: validDoctorUserId,
        status: 'ACTIVE',
        keyFingerprint: 'SHA256:9a7848048a4066a26672e99a87544a27e691bed9dd907648e3af4322de923a12',
      }),
      revokePublicKey: jest.fn().mockResolvedValue({
        id: 'key-1',
        reviewerUserId: validDoctorUserId,
        status: 'REVOKED',
        revokedAt: new Date(),
        revocationReason: 'Token compromised',
      }),
      getActivePublicKey: jest.fn().mockResolvedValue({
        id: 'key-1',
        reviewerUserId: validDoctorUserId,
        status: 'ACTIVE',
        keyFingerprint: 'SHA256:73a7b333d0e6776610f16e49cc2d4fc6836baca42ed49875ab52e5f0b60e9644',
      }),
    };

    mockCredentialingService = {
      submitCredentialApplication: jest.fn().mockResolvedValue({
        id: 'cred-1',
        verificationStatus: ReviewerVerificationStatus.PENDING,
      }),
      verifyCredential: jest.fn().mockResolvedValue({
        id: 'cred-1',
        verificationStatus: ReviewerVerificationStatus.VERIFIED,
      }),
      rejectCredential: jest.fn().mockResolvedValue({
        id: 'cred-1',
        verificationStatus: ReviewerVerificationStatus.REJECTED,
      }),
      revokeCredential: jest.fn().mockResolvedValue({
        id: 'cred-1',
        verificationStatus: ReviewerVerificationStatus.REVOKED,
      }),
      getCredentialByUserId: jest.fn().mockImplementation((userId) => {
        if (userId === validDoctorUserId) {
          return Promise.resolve({
            id: 'cred-1',
            userId: validDoctorUserId,
            clinicianName: 'Dr. Test Reviewer',
            verificationStatus: ReviewerVerificationStatus.VERIFIED,
            isActive: true,
            isExpired: false,
          });
        }
        return Promise.resolve(null);
      }),
    };

    mockMultiSigService = {
      submitApproval: jest.fn().mockResolvedValue({
        approvalId: 'appr-1',
        verdict: 'APPROVED',
        checksumSha256: 'abc123',
        quorumStatus: { isQuorumMet: true },
      }),
      evaluateQuorum: jest.fn().mockResolvedValue({
        isQuorumMet: true,
        approvedCount: 2,
      }),
    };

    mockReleaseAuthorityService = {
      activateRelease: jest.fn().mockResolvedValue({
        id: 'rel-1',
        versionId: 'ver-1',
        clinicId: null,
        isActive: true,
      }),
      emergencyDeactivate: jest.fn().mockResolvedValue({
        id: 'rel-1',
        versionId: 'ver-1',
        isActive: false,
        deactivatedAt: new Date(),
      }),
      rollbackRelease: jest.fn().mockResolvedValue({
        id: 'rel-1',
        versionId: 'ver-target',
        isActive: true,
      }),
      getActiveRelease: jest.fn().mockResolvedValue({
        id: 'rel-1',
        versionId: 'ver-1',
        isActive: true,
      }),
      getReleaseById: jest.fn().mockResolvedValue({
        id: 'rel-1',
        versionId: 'ver-1',
        isActive: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicalGovernanceController],
      providers: [
        {
          provide: ReviewerCredentialingService,
          useValue: mockCredentialingService,
        },
        {
          provide: MultiSignatureApprovalService,
          useValue: mockMultiSigService,
        },
        {
          provide: ReviewerKeyManagementService,
          useValue: mockKeyManagementService,
        },
        {
          provide: KnowledgePackReleaseAuthorityService,
          useValue: mockReleaseAuthorityService,
        },
        GovernanceReviewerGuard,
        GovernanceAdminGuard,
        GovernanceReleaseAuthorityGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClinicAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClinicalGovernanceController>(
      ClinicalGovernanceController,
    );
    reviewerGuard = module.get<GovernanceReviewerGuard>(
      GovernanceReviewerGuard,
    );
    adminGuard = module.get<GovernanceAdminGuard>(GovernanceAdminGuard);
    releaseGuard = module.get<GovernanceReleaseAuthorityGuard>(
      GovernanceReleaseAuthorityGuard,
    );
  });

  describe('Controller Endpoints', () => {
    it('should submit reviewer application successfully', async () => {
      const dto = {
        userId: validDoctorUserId,
        clinicianName: 'Dr. Test User',
        medicalRegistration: 'DMC-12345',
        stateMedicalCouncil: 'Delhi Medical Council',
        registrationYear: 2015,
        primaryQualification: 'MBBS',
        specialtyQualification: 'MD (General Medicine)',
        specialty: KnowledgePackDomain.GENERAL_MEDICINE,
        yearsOfExperience: 10,
      };

      const res = await controller.applyForReviewer(dto, {
        id: validDoctorUserId,
      } as any);

      expect(res.success).toBe(true);
      expect(mockCredentialingService.submitCredentialApplication).toHaveBeenCalledWith(
        dto,
        validDoctorUserId,
      );
    });

    it('should submit clinical approval successfully', async () => {
      const dto = {
        versionId: 'ver-1',
        reviewerUserId: validDoctorUserId,
        checksumSha256: 'a'.repeat(64),
        approvalVerdict: 'APPROVED' as const,
        reviewNotes: 'Verified against guidelines',
        coiDeclared: true,
      };

      const res = await controller.submitApproval(dto, {
        id: validDoctorUserId,
      } as any);

      expect(res.success).toBe(true);
      expect(mockMultiSigService.submitApproval).toHaveBeenCalledWith(
        dto,
        validDoctorUserId,
      );
    });

    it('should query quorum status', async () => {
      const res = await controller.getQuorumStatus('ver-1');
      expect(res.success).toBe(true);
      expect(mockMultiSigService.evaluateQuorum).toHaveBeenCalledWith('ver-1');
    });

    it('should retrieve own reviewer status via /me/status without IDOR risk', async () => {
      const res = await controller.getMyReviewerStatus({
        id: validDoctorUserId,
      } as any);

      expect(res.success).toBe(true);
      expect(mockCredentialingService.getCredentialByUserId).toHaveBeenCalledWith(
        validDoctorUserId,
      );
    });

    it('should allow user to query their own status via /:userId/status', async () => {
      const mockReq = {
        clinic: { clinicId, role: ClinicRole.DOCTOR },
      } as any;

      const res = await controller.getReviewerStatus(
        validDoctorUserId,
        { id: validDoctorUserId } as any,
        mockReq,
      );

      expect(res.success).toBe(true);
    });

    it('should forbid ordinary doctor from querying another user credential status (IDOR Protection)', async () => {
      const anotherUserId = 'other-user-uuid';
      const mockReq = {
        clinic: { clinicId, role: ClinicRole.DOCTOR },
      } as any;

      await expect(
        controller.getReviewerStatus(
          anotherUserId,
          { id: validDoctorUserId } as any,
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow governance admin to query another user credential status', async () => {
      const anotherUserId = 'other-user-uuid';
      const mockReq = {
        clinic: { clinicId, role: ClinicRole.ADMIN },
      } as any;

      const res = await controller.getReviewerStatus(
        anotherUserId,
        { id: validDoctorUserId } as any,
        mockReq,
      );

      expect(res.success).toBe(true);
    });

    it('should register Ed25519 public key via POST /keys/register', async () => {
      const res = await controller.registerPublicKey(
        {
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----',
        },
        { id: validDoctorUserId } as any,
      );

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('key-1');
      expect(mockKeyManagementService.registerPublicKey).toHaveBeenCalledWith(
        validDoctorUserId,
        expect.stringContaining('BEGIN PUBLIC KEY'),
        undefined,
      );
    });

    it('should rotate Ed25519 public key via POST /keys/rotate', async () => {
      const res = await controller.rotatePublicKey(
        {
          publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAnew...\n-----END PUBLIC KEY-----',
        },
        { id: validDoctorUserId } as any,
      );

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('key-2');
      expect(mockKeyManagementService.rotatePublicKey).toHaveBeenCalledWith(
        validDoctorUserId,
        expect.stringContaining('BEGIN PUBLIC KEY'),
      );
    });

    it('should revoke Ed25519 public key via POST /keys/:keyId/revoke', async () => {
      const res = await controller.revokePublicKey(
        'key-1',
        { reason: 'Security token compromised' },
        { id: validDoctorUserId } as any,
      );

      expect(res.success).toBe(true);
      expect(res.data.status).toBe('REVOKED');
      expect(mockKeyManagementService.revokePublicKey).toHaveBeenCalledWith(
        'key-1',
        'Security token compromised',
        validDoctorUserId,
      );
    });

    it('should retrieve active key for authenticated reviewer via GET /keys/me', async () => {
      const res = await controller.getMyActiveKey({ id: validDoctorUserId } as any);

      expect(res.success).toBe(true);
      expect(res.data.id).toBe('key-1');
      expect(mockKeyManagementService.getActivePublicKey).toHaveBeenCalledWith(
        validDoctorUserId,
      );
    });
  });

  describe('GovernanceReviewerGuard (DOCTOR != Governance Authority)', () => {
    const createMockExecutionContext = (
      user?: any,
      clinicRole: ClinicRole = ClinicRole.DOCTOR,
    ) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            clinic: user ? { clinicId, role: clinicRole } : undefined,
          }),
        }),
      }) as any;

    it('should fail with 401 Unauthorized if user is not authenticated', async () => {
      const context = createMockExecutionContext(undefined);
      await expect(reviewerGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should strictly reject standard DOCTOR role if user has no reviewer credentials', async () => {
      const nonReviewerDoctorId = 'doctor-without-cred-uuid';
      mockCredentialingService.getCredentialByUserId.mockResolvedValueOnce(null);

      const context = createMockExecutionContext({
        id: nonReviewerDoctorId,
        fullName: 'Dr. Standard OPD Doctor',
      });

      await expect(reviewerGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject DOCTOR if credentials are still in PENDING status', async () => {
      mockCredentialingService.getCredentialByUserId.mockResolvedValueOnce({
        id: 'cred-pending',
        verificationStatus: ReviewerVerificationStatus.PENDING,
        isActive: true,
        isExpired: false,
      });

      const context = createMockExecutionContext({ id: 'pending-doctor-id' });
      await expect(reviewerGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject DOCTOR if credentials are EXPIRED', async () => {
      mockCredentialingService.getCredentialByUserId.mockResolvedValueOnce({
        id: 'cred-expired',
        verificationStatus: ReviewerVerificationStatus.VERIFIED,
        isActive: true,
        isExpired: true,
      });

      const context = createMockExecutionContext({ id: 'expired-doctor-id' });
      await expect(reviewerGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should permit access when user has active VERIFIED clinical reviewer credentials', async () => {
      const context = createMockExecutionContext({ id: validDoctorUserId });
      const allowed = await reviewerGuard.canActivate(context);
      expect(allowed).toBe(true);
    });
  });

  describe('GovernanceAdminGuard & Tenant Boundaries', () => {
    const createMockAdminContext = (role: ClinicRole, user = { id: 'admin-1' }) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            clinic: { clinicId, role },
          }),
        }),
      }) as any;

    it('should reject standard DOCTOR role from governance admin operations', async () => {
      const context = createMockAdminContext(ClinicRole.DOCTOR);
      await expect(adminGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should permit ADMIN role for governance administration', async () => {
      const context = createMockAdminContext(ClinicRole.ADMIN);
      const allowed = await adminGuard.canActivate(context);
      expect(allowed).toBe(true);
    });

    it('should reject when clinic context is absent (Tenant Isolation)', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'some-user' },
            clinic: undefined, // No active tenant
          }),
        }),
      } as any;

      await expect(adminGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
