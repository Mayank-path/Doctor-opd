import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { KnowledgePackDomain } from '@prisma/client';
import { ClinicalGovernanceAuthorizationService } from './clinical-governance-authorization.service';
import { ReviewerCredentialingService } from './reviewer-credentialing.service';

describe('ClinicalGovernanceAuthorizationService — Four-Eyes & Separation of Duties', () => {
  let service: ClinicalGovernanceAuthorizationService;
  let mockCredentialingService: any;

  beforeEach(() => {
    mockCredentialingService = {
      validateReviewerEligibility: jest.fn(),
    };
    service = new ClinicalGovernanceAuthorizationService(
      mockCredentialingService as unknown as ReviewerCredentialingService,
    );
  });

  describe('validateAuthorExclusion (Four-Eyes Principle)', () => {
    it('should throw ForbiddenException if author attempts to review or approve own version', () => {
      const authorUserId = 'user-author-123';
      const reviewerUserId = 'user-author-123';

      expect(() =>
        service.validateAuthorExclusion(authorUserId, reviewerUserId),
      ).toThrow(ForbiddenException);
    });

    it('should permit when author and reviewer are distinct identities', () => {
      const authorUserId = 'user-author-123';
      const reviewerUserId = 'user-reviewer-456';

      expect(() =>
        service.validateAuthorExclusion(authorUserId, reviewerUserId),
      ).not.toThrow();
    });

    it('should permit when authorUserId is null or undefined (e.g. system seed)', () => {
      expect(() =>
        service.validateAuthorExclusion(undefined, 'user-reviewer-456'),
      ).not.toThrow();
    });
  });

  describe('validateReleaseAuthorityExclusion (Separation of Duties)', () => {
    it('should throw ForbiddenException if release operator was an approving reviewer', () => {
      const approvingReviewers = ['reviewer-1', 'reviewer-2'];
      const releaseOfficer = 'reviewer-1';

      expect(() =>
        service.validateReleaseAuthorityExclusion(
          approvingReviewers,
          releaseOfficer,
        ),
      ).toThrow(ForbiddenException);
    });

    it('should permit release when release operator is an independent authority', () => {
      const approvingReviewers = ['reviewer-1', 'reviewer-2'];
      const releaseOfficer = 'cmo-release-officer';

      expect(() =>
        service.validateReleaseAuthorityExclusion(
          approvingReviewers,
          releaseOfficer,
        ),
      ).not.toThrow();
    });
  });

  describe('validateConflictOfInterest', () => {
    it('should throw BadRequestException if COI declaration is omitted', () => {
      expect(() =>
        service.validateConflictOfInterest(false),
      ).toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if reviewer declares a material conflict of interest', () => {
      expect(() =>
        service.validateConflictOfInterest(
          true,
          true,
          'Principal investigator on industry-sponsored drug trial for COPD',
        ),
      ).toThrow(ForbiddenException);
    });

    it('should permit review when COI is declared with no material conflicts', () => {
      expect(() =>
        service.validateConflictOfInterest(true, false, 'No commercial conflicts'),
      ).not.toThrow();
    });
  });

  describe('assertReviewerEligible', () => {
    it('should throw ForbiddenException if credentialing service reports ineligible', async () => {
      mockCredentialingService.validateReviewerEligibility.mockResolvedValueOnce({
        eligible: false,
        reason: 'Reviewer credential expired',
      });

      await expect(
        service.assertReviewerEligible(
          'user-1',
          KnowledgePackDomain.GENERAL_MEDICINE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return credential if reviewer is eligible', async () => {
      const mockCred = { userId: 'user-1', clinicianName: 'Dr. Valid' };
      mockCredentialingService.validateReviewerEligibility.mockResolvedValueOnce({
        eligible: true,
        credential: mockCred,
      });

      const cred = await service.assertReviewerEligible(
        'user-1',
        KnowledgePackDomain.GENERAL_MEDICINE,
      );
      expect(cred).toEqual(mockCred);
    });
  });
});

