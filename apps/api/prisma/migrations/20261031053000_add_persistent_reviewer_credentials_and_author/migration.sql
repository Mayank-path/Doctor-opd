-- CreateEnum: ReviewerVerificationStatus
CREATE TYPE "ReviewerVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- AlterTable: Add authorUserId to knowledge_pack_versions (Nullable for safe zero-downtime migration)
ALTER TABLE "knowledge_pack_versions" ADD COLUMN "authorUserId" TEXT;

-- CreateTable: reviewer_credentials
CREATE TABLE "reviewer_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clinicianName" TEXT NOT NULL,
    "medicalRegistration" TEXT NOT NULL,
    "stateMedicalCouncil" TEXT NOT NULL,
    "registrationYear" INTEGER NOT NULL,
    "primaryQualification" TEXT NOT NULL,
    "specialtyQualification" TEXT NOT NULL,
    "specialty" "KnowledgePackDomain" NOT NULL,
    "yearsOfExperience" INTEGER NOT NULL,
    "isSeniorReviewer" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "ReviewerVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationEvidence" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "rejectionReason" TEXT,
    "credentialsExpiresAt" TIMESTAMPTZ(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviewer_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reviewer_verification_history (Append-only decision audit log)
CREATE TABLE "reviewer_verification_history" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "ReviewerVerificationStatus" NOT NULL,
    "toStatus" "ReviewerVerificationStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "evidence" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewer_verification_history_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: userId and medicalRegistration uniqueness on reviewer_credentials
CREATE UNIQUE INDEX "reviewer_credentials_userId_key" ON "reviewer_credentials"("userId");
CREATE UNIQUE INDEX "reviewer_credentials_medicalRegistration_key" ON "reviewer_credentials"("medicalRegistration");

-- CreateIndex: Indexes on reviewer_credentials
CREATE INDEX "reviewer_credentials_verificationStatus_isActive_idx" ON "reviewer_credentials"("verificationStatus", "isActive");
CREATE INDEX "reviewer_credentials_specialty_verificationStatus_idx" ON "reviewer_credentials"("specialty", "verificationStatus");

-- CreateIndex: Indexes on reviewer_verification_history
CREATE INDEX "reviewer_verification_history_credentialId_createdAt_idx" ON "reviewer_verification_history"("credentialId", "createdAt" DESC);
CREATE INDEX "reviewer_verification_history_actorUserId_idx" ON "reviewer_verification_history"("actorUserId");

-- CreateIndex: Index on knowledge_pack_versions.authorUserId
CREATE INDEX "knowledge_pack_versions_authorUserId_idx" ON "knowledge_pack_versions"("authorUserId");

-- AddForeignKey: knowledge_pack_versions.authorUserId -> users.id (RESTRICT prevents deleting version authors)
ALTER TABLE "knowledge_pack_versions" ADD CONSTRAINT "knowledge_pack_versions_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: reviewer_credentials.userId -> users.id (RESTRICT prevents deleting registered reviewer users)
ALTER TABLE "reviewer_credentials" ADD CONSTRAINT "reviewer_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: reviewer_credentials.verifiedByUserId -> users.id (RESTRICT prevents deleting credential verifiers)
ALTER TABLE "reviewer_credentials" ADD CONSTRAINT "reviewer_credentials_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: reviewer_verification_history.credentialId -> reviewer_credentials.id (CASCADE on credential deletion)
ALTER TABLE "reviewer_verification_history" ADD CONSTRAINT "reviewer_verification_history_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "reviewer_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: reviewer_verification_history.actorUserId -> users.id (RESTRICT prevents deleting decision actors)
ALTER TABLE "reviewer_verification_history" ADD CONSTRAINT "reviewer_verification_history_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level Immutability Trigger: Prohibits UPDATE and DELETE on reviewer_verification_history
CREATE OR REPLACE FUNCTION prevent_reviewer_verification_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutability Violation: % operation on table % is strictly prohibited.', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviewer_verification_history_immutable
BEFORE UPDATE OR DELETE ON "reviewer_verification_history"
FOR EACH ROW
EXECUTE FUNCTION prevent_reviewer_verification_history_mutation();

