import { KnowledgePackDomain } from '@prisma/client';
import { ReviewerVerificationStatus } from '../constants/governance.constants';

export interface ReviewerCredential {
  id: string;
  userId: string;
  clinicianName: string;
  medicalRegistration: string;
  stateMedicalCouncil: string;
  registrationYear: number;
  primaryQualification: string;
  specialtyQualification: string;
  specialty: KnowledgePackDomain | string;
  yearsOfExperience: number;
  isSeniorReviewer: boolean;
  verificationStatus: ReviewerVerificationStatus;
  verificationEvidence: string | null;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  credentialsExpiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewerCredentialSummary {
  id: string;
  userId: string;
  clinicianName: string;
  medicalRegistration: string;
  stateMedicalCouncil: string;
  specialty: string;
  yearsOfExperience: number;
  isSeniorReviewer: boolean;
  verificationStatus: ReviewerVerificationStatus;
  isExpired: boolean;
  isActive: boolean;
  credentialsExpiresAt: Date | null;
}

