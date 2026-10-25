-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "encounterDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMPTZ(3),
    "chiefComplaint" TEXT NOT NULL,
    "symptoms" TEXT,
    "examination" TEXT,
    "diagnosis" TEXT,
    "treatmentPlan" TEXT,
    "followUpDate" DATE,
    "bpSystolic" INTEGER,
    "bpDiastolic" INTEGER,
    "pulse" INTEGER,
    "temperature" DECIMAL(4,1),
    "weightKg" DECIMAL(5,2),
    "heightCm" DECIMAL(5,2),
    "spo2" INTEGER,
    "respiratoryRate" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultations_clinicId_patientId_encounterDate_idx" ON "consultations"("clinicId", "patientId", "encounterDate" DESC);

-- CreateIndex
CREATE INDEX "consultations_clinicId_encounterDate_idx" ON "consultations"("clinicId", "encounterDate" DESC);

-- CreateIndex
CREATE INDEX "consultations_clinicId_status_idx" ON "consultations"("clinicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_id_clinicId_key" ON "consultations"("id", "clinicId");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patientId_clinicId_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "patients"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_clinicianId_clinicId_fkey" FOREIGN KEY ("clinicianId", "clinicId") REFERENCES "clinic_memberships"("userId", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;
