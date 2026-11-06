/*
  Warnings:

  - You are about to drop the `differential_diagnosis_audits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `differential_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rule_source_mappings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "differential_diagnosis_audits" DROP CONSTRAINT "differential_diagnosis_audits_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "differential_diagnosis_audits" DROP CONSTRAINT "differential_diagnosis_audits_clinicianId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "differential_diagnosis_audits" DROP CONSTRAINT "differential_diagnosis_audits_consultationId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "differential_diagnosis_audits" DROP CONSTRAINT "differential_diagnosis_audits_patientId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "differential_rules" DROP CONSTRAINT "differential_rules_conditionId_fkey";

-- DropForeignKey
ALTER TABLE "rule_source_mappings" DROP CONSTRAINT "rule_source_mappings_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "rule_source_mappings" DROP CONSTRAINT "rule_source_mappings_sourceId_fkey";

-- DropTable
DROP TABLE "differential_diagnosis_audits";

-- DropTable
DROP TABLE "differential_rules";

-- DropTable
DROP TABLE "rule_source_mappings";

-- DropEnum
DROP TYPE "DifferentialMatchTier";

-- DropEnum
DROP TYPE "DoctorCandidateAction";
