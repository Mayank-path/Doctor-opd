import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KnowledgePackResolverService } from '../differential/services/knowledge-pack-resolver.service';
import { ClinicalGovernanceController } from './clinical-governance.controller';
import { GovernanceAdminGuard } from './guards/governance-admin.guard';
import { GovernanceReleaseAuthorityGuard } from './guards/governance-release-authority.guard';
import { GovernanceReviewerGuard } from './guards/governance-reviewer.guard';
import { GOVERNANCE_NONCE_REPOSITORY } from './interfaces/governance-nonce-repository.interface';
import { REVIEWER_CREDENTIAL_REPOSITORY } from './interfaces/reviewer-credential-repository.interface';
import { REVIEWER_KEY_REPOSITORY } from './interfaces/reviewer-key-repository.interface';
import { InMemoryReviewerCredentialRepository } from './repositories/in-memory-reviewer-credential.repository';
import { PrismaGovernanceNonceRepository } from './repositories/prisma-governance-nonce.repository';
import { PrismaReviewerCredentialRepository } from './repositories/prisma-reviewer-credential.repository';
import { PrismaReviewerKeyRepository } from './repositories/prisma-reviewer-key.repository';
import { ClinicalGovernanceAuthorizationService } from './services/clinical-governance-authorization.service';
import { CryptographicAttestationService } from './services/cryptographic-attestation.service';
import { KnowledgePackGovernanceAuditService } from './services/knowledge-pack-governance-audit.service';
import { KnowledgePackReleaseAuthorityService } from './services/knowledge-pack-release-authority.service';
import { MultiSignatureApprovalService } from './services/multi-signature-approval.service';
import { ReviewerCredentialingService } from './services/reviewer-credentialing.service';
import { ReviewerKeyManagementService } from './services/reviewer-key-management.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClinicalGovernanceController],
  providers: [
    {
      provide: REVIEWER_CREDENTIAL_REPOSITORY,
      useClass: PrismaReviewerCredentialRepository,
    },
    {
      provide: REVIEWER_KEY_REPOSITORY,
      useClass: PrismaReviewerKeyRepository,
    },
    {
      provide: GOVERNANCE_NONCE_REPOSITORY,
      useClass: PrismaGovernanceNonceRepository,
    },
    InMemoryReviewerCredentialRepository,
    ReviewerCredentialingService,
    ReviewerKeyManagementService,
    CryptographicAttestationService,
    ClinicalGovernanceAuthorizationService,
    KnowledgePackGovernanceAuditService,
    MultiSignatureApprovalService,
    KnowledgePackResolverService,
    KnowledgePackReleaseAuthorityService,
    GovernanceReviewerGuard,
    GovernanceAdminGuard,
    GovernanceReleaseAuthorityGuard,
  ],
  exports: [
    REVIEWER_CREDENTIAL_REPOSITORY,
    REVIEWER_KEY_REPOSITORY,
    GOVERNANCE_NONCE_REPOSITORY,
    ReviewerCredentialingService,
    ReviewerKeyManagementService,
    CryptographicAttestationService,
    ClinicalGovernanceAuthorizationService,
    KnowledgePackGovernanceAuditService,
    MultiSignatureApprovalService,
    KnowledgePackResolverService,
    KnowledgePackReleaseAuthorityService,
    GovernanceReviewerGuard,
    GovernanceAdminGuard,
    GovernanceReleaseAuthorityGuard,
  ],
})
export class ClinicalGovernanceModule {}
