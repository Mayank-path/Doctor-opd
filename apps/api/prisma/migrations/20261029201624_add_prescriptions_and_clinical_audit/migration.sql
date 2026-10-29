-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DosageForm" AS ENUM ('TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'OINTMENT', 'DROPS', 'INHALER', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicationRoute" AS ENUM ('ORAL', 'TOPICAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'SUBLINGUAL', 'INHALATION', 'OPHTHALMIC', 'NASAL', 'OTIC');

-- CreateEnum
CREATE TYPE "MedicationTiming" AS ENUM ('BEFORE_MEALS', 'AFTER_MEALS', 'WITH_MEALS', 'EMPTY_STOMACH', 'AT_BEDTIME', 'AS_NEEDED');

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT,
    "doctorId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "supersedesPrescriptionId" TEXT,
    "amendmentReason" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "brandName" TEXT,
    "dosageForm" "DosageForm" NOT NULL DEFAULT 'TABLET',
    "strength" TEXT NOT NULL,
    "route" "MedicationRoute" NOT NULL DEFAULT 'ORAL',
    "frequency" TEXT NOT NULL,
    "durationValue" INTEGER NOT NULL,
    "durationUnit" TEXT NOT NULL,
    "timing" "MedicationTiming" NOT NULL DEFAULT 'AFTER_MEALS',
    "specialInstructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_audit_events" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescriptions_clinicId_patientId_createdAt_idx" ON "prescriptions"("clinicId", "patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "prescriptions_clinicId_consultationId_idx" ON "prescriptions"("clinicId", "consultationId");

-- CreateIndex
CREATE INDEX "prescriptions_clinicId_status_idx" ON "prescriptions"("clinicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_id_clinicId_key" ON "prescriptions"("id", "clinicId");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_sortOrder_idx" ON "prescription_items"("prescriptionId", "sortOrder");

-- CreateIndex
CREATE INDEX "clinical_audit_events_clinicId_entityType_entityId_idx" ON "clinical_audit_events"("clinicId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "clinical_audit_events_clinicId_createdAt_idx" ON "clinical_audit_events"("clinicId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_clinicId_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "patients"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultationId_clinicId_fkey" FOREIGN KEY ("consultationId", "clinicId") REFERENCES "consultations"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_clinicId_fkey" FOREIGN KEY ("doctorId", "clinicId") REFERENCES "clinic_memberships"("userId", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_supersedesPrescriptionId_clinicId_fkey" FOREIGN KEY ("supersedesPrescriptionId", "clinicId") REFERENCES "prescriptions"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_clinicId_fkey" FOREIGN KEY ("prescriptionId", "clinicId") REFERENCES "prescriptions"("id", "clinicId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_audit_events" ADD CONSTRAINT "clinical_audit_events_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_audit_events" ADD CONSTRAINT "clinical_audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
