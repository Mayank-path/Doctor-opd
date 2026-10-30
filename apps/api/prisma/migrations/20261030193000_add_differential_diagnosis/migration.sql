-- CreateEnum
CREATE TYPE "KnowledgePackDomain" AS ENUM ('GENERAL_MEDICINE', 'RESPIRATORY', 'GASTROENTEROLOGY', 'CARDIOLOGY', 'NEUROLOGY');

-- CreateEnum
CREATE TYPE "KnowledgePackReleaseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RELEASED', 'DEPRECATED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "DifferentialMatchTier" AS ENUM ('RED_FLAG_URGENT', 'STRONG_MATCH', 'MODERATE_MATCH', 'POSSIBLE', 'CONTRADICTED');

-- CreateEnum
CREATE TYPE "DoctorCandidateAction" AS ENUM ('ACCEPTED_AS_PRIMARY', 'ACCEPTED_AS_DIFFERENTIAL', 'REJECTED', 'DEFERRED_FOR_INVESTIGATION');

-- CreateTable
CREATE TABLE "clinical_knowledge_packs" (
    "id" TEXT NOT NULL,
    "domain" "KnowledgePackDomain" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_knowledge_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_pack_versions" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "majorVersion" INTEGER NOT NULL,
    "minorVersion" INTEGER NOT NULL,
    "patchVersion" INTEGER NOT NULL,
    "releaseStatus" "KnowledgePackReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "changelog" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_pack_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_conditions" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "conditionCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "icd10Guidance" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "differential_rules" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleTitle" TEXT NOT NULL,
    "minMajorCount" INTEGER NOT NULL DEFAULT 1,
    "applicabilityJson" JSONB NOT NULL,
    "mandatoryAstJson" JSONB NOT NULL,
    "majorSupportingJson" JSONB NOT NULL,
    "minorSupportingJson" JSONB,
    "contradictionsJson" JSONB,
    "missingDataRulesJson" JSONB,
    "investigationsJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "differential_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "red_flag_rules" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "flagCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "urgencyLevel" TEXT NOT NULL,
    "clinicalAction" TEXT NOT NULL,
    "ruleAstJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "red_flag_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_source_references" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceOrganization" TEXT NOT NULL,
    "sourceTitle" TEXT NOT NULL,
    "publicationDate" TEXT NOT NULL,
    "sectionIdentifier" TEXT NOT NULL,
    "sourceUrlOrDoi" TEXT NOT NULL,
    "licensingStatus" TEXT NOT NULL,
    "evidenceScope" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_source_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_source_mappings" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "rule_source_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_review_approvals" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "clinicianName" TEXT NOT NULL,
    "medicalRegistration" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "reviewNotes" TEXT NOT NULL,
    "approvalVerdict" TEXT NOT NULL,
    "signedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_review_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_pack_releases" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "versionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_pack_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "differential_diagnosis_audits" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "knowledgePackVerId" TEXT NOT NULL,
    "matchedCandidatesJson" JSONB NOT NULL,
    "redFlagsTriggeredJson" JSONB,
    "doctorDecisionsJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "differential_diagnosis_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_knowledge_packs_domain_key" ON "clinical_knowledge_packs"("domain");

-- CreateIndex
CREATE INDEX "knowledge_pack_versions_packId_releaseStatus_idx" ON "knowledge_pack_versions"("packId", "releaseStatus");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_pack_versions_packId_majorVersion_minorVersion_pa_key" ON "knowledge_pack_versions"("packId", "majorVersion", "minorVersion", "patchVersion");

-- CreateIndex
CREATE INDEX "clinical_conditions_versionId_category_idx" ON "clinical_conditions"("versionId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_conditions_versionId_conditionCode_key" ON "clinical_conditions"("versionId", "conditionCode");

-- CreateIndex
CREATE UNIQUE INDEX "differential_rules_conditionId_ruleCode_key" ON "differential_rules"("conditionId", "ruleCode");

-- CreateIndex
CREATE UNIQUE INDEX "red_flag_rules_versionId_flagCode_key" ON "red_flag_rules"("versionId", "flagCode");

-- CreateIndex
CREATE UNIQUE INDEX "rule_source_mappings_ruleId_sourceId_key" ON "rule_source_mappings"("ruleId", "sourceId");

-- CreateIndex
CREATE INDEX "knowledge_pack_releases_clinicId_isActive_idx" ON "knowledge_pack_releases"("clinicId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_pack_releases_clinicId_versionId_key" ON "knowledge_pack_releases"("clinicId", "versionId");

-- CreateIndex: GLOBAL baseline release uniqueness (single global release per versionId when clinicId IS NULL)
CREATE UNIQUE INDEX "knowledge_pack_releases_global_version_uidx" ON "knowledge_pack_releases"("versionId") WHERE "clinicId" IS NULL;

-- CreateIndex
CREATE INDEX "differential_diagnosis_audits_clinicId_consultationId_idx" ON "differential_diagnosis_audits"("clinicId", "consultationId");

-- CreateIndex
CREATE INDEX "differential_diagnosis_audits_clinicId_patientId_idx" ON "differential_diagnosis_audits"("clinicId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "differential_diagnosis_audits_id_clinicId_key" ON "differential_diagnosis_audits"("id", "clinicId");

-- AddForeignKey
ALTER TABLE "knowledge_pack_versions" ADD CONSTRAINT "knowledge_pack_versions_packId_fkey" FOREIGN KEY ("packId") REFERENCES "clinical_knowledge_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_conditions" ADD CONSTRAINT "clinical_conditions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_pack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "differential_rules" ADD CONSTRAINT "differential_rules_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "clinical_conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "red_flag_rules" ADD CONSTRAINT "red_flag_rules_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_pack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_source_references" ADD CONSTRAINT "clinical_source_references_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_pack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_source_mappings" ADD CONSTRAINT "rule_source_mappings_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "differential_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_source_mappings" ADD CONSTRAINT "rule_source_mappings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "clinical_source_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_review_approvals" ADD CONSTRAINT "clinical_review_approvals_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_pack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_pack_releases" ADD CONSTRAINT "knowledge_pack_releases_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_pack_releases" ADD CONSTRAINT "knowledge_pack_releases_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_pack_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "differential_diagnosis_audits" ADD CONSTRAINT "differential_diagnosis_audits_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "differential_diagnosis_audits" ADD CONSTRAINT "differential_diagnosis_audits_consultationId_clinicId_fkey" FOREIGN KEY ("consultationId", "clinicId") REFERENCES "consultations"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "differential_diagnosis_audits" ADD CONSTRAINT "differential_diagnosis_audits_patientId_clinicId_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "patients"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "differential_diagnosis_audits" ADD CONSTRAINT "differential_diagnosis_audits_clinicianId_clinicId_fkey" FOREIGN KEY ("clinicianId", "clinicId") REFERENCES "clinic_memberships"("userId", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

