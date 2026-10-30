import { KnowledgePackDomain, KnowledgePackReleaseStatus } from '@prisma/client';

export interface QuorumApprovalSummary {
  approvalId: string;
  reviewerUserId: string;
  clinicianName: string;
  medicalRegistration: string;
  specialty: string;
  qualification?: string | null;
  isSeniorReviewer: boolean;
  yearsOfExperience?: number;
  signedAt: Date;
  expiresAt: Date | null;
  checksumSha256: string;
  approvalVerdict: string;
}

export class QuorumStatusResponseDto {
  versionId: string;
  domain: KnowledgePackDomain;
  semver: string;
  releaseStatus: KnowledgePackReleaseStatus;
  currentChecksumSha256: string;
  requiredQuorum: number;
  approvedCount: number;
  seniorReviewerCount: number;
  isQuorumMet: boolean;
  missingRequirements: string[];
  approvals: QuorumApprovalSummary[];
}

