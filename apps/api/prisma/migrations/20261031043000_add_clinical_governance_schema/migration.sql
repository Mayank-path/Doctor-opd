-- AlterTable: Add clinical governance columns to clinical_review_approvals
ALTER TABLE "clinical_review_approvals" ADD COLUMN "reviewerUserId" TEXT;
ALTER TABLE "clinical_review_approvals" ADD COLUMN "stateMedicalCouncil" TEXT;
ALTER TABLE "clinical_review_approvals" ADD COLUMN "qualification" TEXT;
ALTER TABLE "clinical_review_approvals" ADD COLUMN "checksumSha256" TEXT;
ALTER TABLE "clinical_review_approvals" ADD COLUMN "coiDeclared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinical_review_approvals" ADD COLUMN "coiDetails" TEXT;
ALTER TABLE "clinical_review_approvals" ADD COLUMN "digitalSignature" TEXT;
ALTER TABLE "clinical_review_approvals" ADD COLUMN "expiresAt" TIMESTAMPTZ(3);

-- AlterTable: Add release governance columns to knowledge_pack_releases (domain NOT NULL with default)
ALTER TABLE "knowledge_pack_releases" ADD COLUMN "domain" "KnowledgePackDomain" NOT NULL DEFAULT 'GENERAL_MEDICINE';
ALTER TABLE "knowledge_pack_releases" ADD COLUMN "releasedByUserId" TEXT;
ALTER TABLE "knowledge_pack_releases" ADD COLUMN "releaseNotes" TEXT;
ALTER TABLE "knowledge_pack_releases" ADD COLUMN "deactivatedAt" TIMESTAMPTZ(3);
ALTER TABLE "knowledge_pack_releases" ADD COLUMN "deactivationReason" TEXT;

-- CreateTable: Dedicated governance audit ledger
CREATE TABLE "knowledge_pack_governance_audits" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorUserId" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "metadataJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_pack_governance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Indexes on clinical_review_approvals
CREATE INDEX "clinical_review_approvals_versionId_approvalVerdict_idx" ON "clinical_review_approvals"("versionId", "approvalVerdict");
CREATE INDEX "clinical_review_approvals_checksumSha256_idx" ON "clinical_review_approvals"("checksumSha256");
CREATE INDEX "clinical_review_approvals_reviewerUserId_idx" ON "clinical_review_approvals"("reviewerUserId");

-- CreateIndex: Indexes on knowledge_pack_releases
CREATE INDEX "knowledge_pack_releases_releasedByUserId_idx" ON "knowledge_pack_releases"("releasedByUserId");

-- CreateIndex: Scope uniqueness - at most one active global release per domain (No NULL loophole)
CREATE UNIQUE INDEX "knowledge_pack_releases_active_global_domain_uidx" ON "knowledge_pack_releases"("domain") WHERE "clinicId" IS NULL AND "isActive" = true;

-- CreateIndex: Scope uniqueness - at most one active clinic release per clinic per domain
CREATE UNIQUE INDEX "knowledge_pack_releases_active_clinic_domain_uidx" ON "knowledge_pack_releases"("clinicId", "domain") WHERE "clinicId" IS NOT NULL AND "isActive" = true;

-- CreateIndex: Indexes on knowledge_pack_governance_audits
CREATE INDEX "knowledge_pack_governance_audits_versionId_createdAt_idx" ON "knowledge_pack_governance_audits"("versionId", "createdAt" DESC);
CREATE INDEX "knowledge_pack_governance_audits_action_idx" ON "knowledge_pack_governance_audits"("action");
CREATE INDEX "knowledge_pack_governance_audits_actorUserId_idx" ON "knowledge_pack_governance_audits"("actorUserId");

-- AddForeignKey: clinical_review_approvals.reviewerUserId -> users.id (RESTRICT prevents accidental reviewer deletion)
ALTER TABLE "clinical_review_approvals" ADD CONSTRAINT "clinical_review_approvals_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: knowledge_pack_releases.releasedByUserId -> users.id (RESTRICT prevents accidental release officer deletion)
ALTER TABLE "knowledge_pack_releases" ADD CONSTRAINT "knowledge_pack_releases_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: knowledge_pack_governance_audits.versionId -> knowledge_pack_versions.id (RESTRICT prevents accidental version deletion)
ALTER TABLE "knowledge_pack_governance_audits" ADD CONSTRAINT "knowledge_pack_governance_audits_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_pack_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: knowledge_pack_governance_audits.actorUserId -> users.id (RESTRICT prevents accidental audit actor deletion)
ALTER TABLE "knowledge_pack_governance_audits" ADD CONSTRAINT "knowledge_pack_governance_audits_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level Immutability Trigger: Prohibits UPDATE and DELETE on knowledge_pack_governance_audits
CREATE OR REPLACE FUNCTION prevent_governance_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutability Violation: % operation on table % is strictly prohibited.', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_knowledge_pack_governance_audits_immutable
BEFORE UPDATE OR DELETE ON "knowledge_pack_governance_audits"
FOR EACH ROW
EXECUTE FUNCTION prevent_governance_audit_mutation();

