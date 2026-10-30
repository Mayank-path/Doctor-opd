import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ClinicRole, KnowledgePackDomain } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ClinicAuthGuard } from '../../auth/guards/clinic-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type {
  AuthenticatedUser,
  RequestWithAuth,
} from '../../auth/interfaces/auth.interfaces';
import { ActivateReleaseDto } from './dto/activate-release.dto';
import { EmergencyDeactivateReleaseDto } from './dto/emergency-deactivate-release.dto';
import { RegisterPublicKeyDto } from './dto/register-public-key.dto';
import { RejectReviewerCredentialDto } from './dto/reject-reviewer-credential.dto';
import { RevokePublicKeyDto } from './dto/revoke-public-key.dto';
import { RollbackReleaseDto } from './dto/rollback-release.dto';
import { SubmitApprovalDto } from './dto/submit-approval.dto';
import { SubmitReviewerCredentialDto } from './dto/submit-reviewer-credential.dto';
import { VerifyReviewerCredentialDto } from './dto/verify-reviewer-credential.dto';
import { GovernanceAdminGuard } from './guards/governance-admin.guard';
import { GovernanceReleaseAuthorityGuard } from './guards/governance-release-authority.guard';
import { GovernanceReviewerGuard } from './guards/governance-reviewer.guard';
import { KnowledgePackReleaseAuthorityService } from './services/knowledge-pack-release-authority.service';
import { MultiSignatureApprovalService } from './services/multi-signature-approval.service';
import { ReviewerCredentialingService } from './services/reviewer-credentialing.service';
import { ReviewerKeyManagementService } from './services/reviewer-key-management.service';

@Controller('clinical-assist/governance')
export class ClinicalGovernanceController {
  constructor(
    private readonly credentialingService: ReviewerCredentialingService,
    private readonly multiSigService: MultiSignatureApprovalService,
    private readonly keyManagementService: ReviewerKeyManagementService,
    private readonly releaseAuthorityService: KnowledgePackReleaseAuthorityService,
  ) {}

  /**
   * Submit an application for clinical reviewer credentialing.
   * Self-reported details are placed into PENDING verification.
   */
  @Post('reviewers/apply')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async applyForReviewer(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: SubmitReviewerCredentialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result =
      await this.credentialingService.submitCredentialApplication(
        dto,
        user.id,
      );
    return {
      success: true,
      message:
        'Reviewer credential application submitted. Pending independent Medical Governance Board verification.',
      data: result,
    };
  }

  /**
   * Independently verify a reviewer credential application.
   * Requires administrative governance authority.
   */
  @Post('reviewers/:credentialId/verify')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard, GovernanceAdminGuard)
  @HttpCode(HttpStatus.OK)
  async verifyReviewerCredential(
    @Param('credentialId') credentialId: string,
    @Body(new ValidationPipe({ whitelist: true }))
    dto: VerifyReviewerCredentialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.credentialingService.verifyCredential(
      credentialId,
      dto,
      user.id,
    );
    return {
      success: true,
      message: 'Reviewer credential verified successfully.',
      data: result,
    };
  }

  /**
   * Reject a reviewer credential application.
   * Requires administrative governance authority.
   */
  @Post('reviewers/:credentialId/reject')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard, GovernanceAdminGuard)
  @HttpCode(HttpStatus.OK)
  async rejectReviewerCredential(
    @Param('credentialId') credentialId: string,
    @Body(new ValidationPipe({ whitelist: true }))
    dto: RejectReviewerCredentialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.credentialingService.rejectCredential(
      credentialId,
      dto,
      user.id,
    );
    return {
      success: true,
      message: 'Reviewer credential application rejected.',
      data: result,
    };
  }

  /**
   * Revoke an active reviewer credential.
   * Requires administrative governance authority.
   */
  @Post('reviewers/:credentialId/revoke')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard, GovernanceAdminGuard)
  @HttpCode(HttpStatus.OK)
  async revokeReviewerCredential(
    @Param('credentialId') credentialId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.credentialingService.revokeCredential(
      credentialId,
      reason || 'Administrative revocation',
      user.id,
    );
    return {
      success: true,
      message: 'Reviewer credential revoked.',
      data: result,
    };
  }

  /**
   * Retrieve current authenticated user's own reviewer credential status.
   */
  @Get('reviewers/me/status')
  @UseGuards(JwtAuthGuard)
  async getMyReviewerStatus(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.credentialingService.getCredentialByUserId(user.id);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Retrieve reviewer credential status for a given user.
   * IDOR Protection: Ordinary clinicians can only query their own status;
   * querying another user requires administrative governance authority.
   */
  @Get('reviewers/:userId/status')
  @UseGuards(JwtAuthGuard)
  async getReviewerStatus(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithAuth,
  ) {
    const isSelf = user.id === targetUserId;
    const isAdmin = req.clinic?.role === ClinicRole.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException(
        'Unauthorized: You may only query your own reviewer credential status.',
      );
    }

    const result = await this.credentialingService.getCredentialByUserId(targetUserId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Submit an official clinical approval for an immutable knowledge-pack version.
   * Requires verified reviewer credentials, exact SHA-256 binding, and four-eyes compliance.
   */
  @Post('approvals/submit')
  @UseGuards(JwtAuthGuard, GovernanceReviewerGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitApproval(
    @Body(new ValidationPipe({ whitelist: true }))
    dto: SubmitApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.multiSigService.submitApproval(dto, user.id);
    return {
      success: true,
      message: 'Clinical approval successfully recorded and cryptographically bound to checksum.',
      data: result,
    };
  }

  /**
   * Evaluate multi-signature quorum status for a knowledge-pack version.
   */
  @Get('versions/:versionId/quorum-status')
  @UseGuards(JwtAuthGuard)
  async getQuorumStatus(@Param('versionId') versionId: string) {
    const result = await this.multiSigService.evaluateQuorum(versionId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Register a new Ed25519 public key for the authenticated clinical reviewer.
   */
  @Post('keys/register')
  @UseGuards(JwtAuthGuard, GovernanceReviewerGuard)
  @HttpCode(HttpStatus.CREATED)
  async registerPublicKey(
    @Body(new ValidationPipe({ whitelist: true })) dto: RegisterPublicKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const expiresAt = dto.customExpiresAt
      ? new Date(dto.customExpiresAt)
      : undefined;
    const result = await this.keyManagementService.registerPublicKey(
      user.id,
      dto.publicKeyPem,
      expiresAt,
    );
    return {
      success: true,
      message: 'Ed25519 public key registered successfully.',
      data: result,
    };
  }

  /**
   * Rotate active Ed25519 public key for the authenticated clinical reviewer.
   */
  @Post('keys/rotate')
  @UseGuards(JwtAuthGuard, GovernanceReviewerGuard)
  @HttpCode(HttpStatus.OK)
  async rotatePublicKey(
    @Body(new ValidationPipe({ whitelist: true })) dto: RegisterPublicKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.keyManagementService.rotatePublicKey(
      user.id,
      dto.publicKeyPem,
    );
    return {
      success: true,
      message: 'Ed25519 public key rotated successfully.',
      data: result,
    };
  }

  /**
   * Revoke an Ed25519 public key.
   */
  @Post('keys/:keyId/revoke')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard, GovernanceAdminGuard)
  @HttpCode(HttpStatus.OK)
  async revokePublicKey(
    @Param('keyId') keyId: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: RevokePublicKeyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.keyManagementService.revokePublicKey(
      keyId,
      dto.reason,
      user.id,
    );
    return {
      success: true,
      message: 'Ed25519 public key revoked.',
      data: result,
    };
  }

  /**
   * Retrieve current active Ed25519 public key for the authenticated reviewer.
   */
  @Get('keys/me')
  @UseGuards(JwtAuthGuard, GovernanceReviewerGuard)
  async getMyActiveKey(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.keyManagementService.getActivePublicKey(user.id);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Activate a knowledge-pack release (GLOBAL or CLINIC).
   */
  @Post('releases/activate')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard, GovernanceReleaseAuthorityGuard)
  @HttpCode(HttpStatus.OK)
  async activateRelease(
    @Body(new ValidationPipe({ whitelist: true })) dto: ActivateReleaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithAuth,
  ) {
    const result = await this.releaseAuthorityService.activateRelease(
      dto,
      user.id,
      {
        clinicId: req.clinic?.clinicId,
        isPlatformAdmin: req.clinic?.role === ClinicRole.ADMIN,
      },
    );
    return {
      success: true,
      message: `Knowledge-pack release successfully activated for scope ${dto.scope}.`,
      data: result,
    };
  }

  /**
   * Emergency deactivate an active knowledge-pack release.
   */
  @Post('releases/:releaseId/deactivate')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard, GovernanceReleaseAuthorityGuard)
  @HttpCode(HttpStatus.OK)
  async emergencyDeactivateRelease(
    @Param('releaseId') releaseId: string,
    @Body(new ValidationPipe({ whitelist: true }))
    dto: EmergencyDeactivateReleaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithAuth,
  ) {
    const result = await this.releaseAuthorityService.emergencyDeactivate(
      releaseId,
      dto,
      user.id,
      {
        clinicId: req.clinic?.clinicId,
        isPlatformAdmin: req.clinic?.role === ClinicRole.ADMIN,
      },
    );
    return {
      success: true,
      message: 'Knowledge-pack release emergency deactivated.',
      data: result,
    };
  }

  /**
   * Rollback a knowledge-pack release to a prior eligible version.
   */
  @Post('releases/:releaseId/rollback')
  @UseGuards(JwtAuthGuard, ClinicAuthGuard, GovernanceReleaseAuthorityGuard)
  @HttpCode(HttpStatus.OK)
  async rollbackRelease(
    @Param('releaseId') releaseId: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: RollbackReleaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithAuth,
  ) {
    const result = await this.releaseAuthorityService.rollbackRelease(
      releaseId,
      dto,
      user.id,
      {
        clinicId: req.clinic?.clinicId,
        isPlatformAdmin: req.clinic?.role === ClinicRole.ADMIN,
      },
    );
    return {
      success: true,
      message: 'Knowledge-pack release successfully rolled back to target version.',
      data: result,
    };
  }

  /**
   * Query currently active release for a given domain and optional clinic scope.
   */
  @Get('releases/active')
  @UseGuards(JwtAuthGuard)
  async getActiveRelease(
    @Query('domain') domain: KnowledgePackDomain = KnowledgePackDomain.GENERAL_MEDICINE,
    @Query('clinicId') clinicId?: string,
  ) {
    const result = await this.releaseAuthorityService.getActiveRelease(
      domain,
      clinicId,
    );
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Retrieve release record details by ID.
   */
  @Get('releases/:releaseId')
  @UseGuards(JwtAuthGuard)
  async getReleaseById(@Param('releaseId') releaseId: string) {
    const result = await this.releaseAuthorityService.getReleaseById(releaseId);
    return {
      success: true,
      data: result,
    };
  }
}
