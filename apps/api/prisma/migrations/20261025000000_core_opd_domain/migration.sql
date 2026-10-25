-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('SCHEDULED', 'WALK_IN', 'FOLLOW_UP', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "uhid" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" DATE,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_uhid_counters" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "lastUhid" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patient_uhid_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "endTime" TIMESTAMPTZ(3),
    "type" "AppointmentType" NOT NULL DEFAULT 'SCHEDULED',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "chiefComplaint" TEXT,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "rescheduledFromId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_queue_entries" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "idempotencyKey" TEXT,
    "serviceDate" DATE NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "checkInTime" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMPTZ(3),
    "consultationStartTime" TIMESTAMPTZ(3),
    "consultationEndTime" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opd_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opd_daily_counters" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "lastTokenNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opd_daily_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_clinicId_phone_idx" ON "patients"("clinicId", "phone");

-- CreateIndex
CREATE INDEX "patients_clinicId_fullName_idx" ON "patients"("clinicId", "fullName");

-- CreateIndex
CREATE INDEX "patients_clinicId_createdAt_idx" ON "patients"("clinicId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "patients_clinicId_uhid_key" ON "patients"("clinicId", "uhid");

-- CreateIndex
CREATE UNIQUE INDEX "patients_id_clinicId_key" ON "patients"("id", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_uhid_counters_clinicId_key" ON "patient_uhid_counters"("clinicId");

-- CreateIndex
CREATE INDEX "appointments_clinicId_serviceDate_doctorId_idx" ON "appointments"("clinicId", "serviceDate", "doctorId");

-- CreateIndex
CREATE INDEX "appointments_clinicId_patientId_idx" ON "appointments"("clinicId", "patientId");

-- CreateIndex
CREATE INDEX "appointments_clinicId_status_idx" ON "appointments"("clinicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_id_clinicId_key" ON "appointments"("id", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "opd_queue_entries_appointmentId_key" ON "opd_queue_entries"("appointmentId");

-- CreateIndex
CREATE INDEX "opd_queue_entries_clinicId_serviceDate_doctorId_status_idx" ON "opd_queue_entries"("clinicId", "serviceDate", "doctorId", "status");

-- CreateIndex
CREATE INDEX "opd_queue_entries_clinicId_patientId_idx" ON "opd_queue_entries"("clinicId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "opd_queue_entries_clinicId_doctorId_serviceDate_tokenNumber_key" ON "opd_queue_entries"("clinicId", "doctorId", "serviceDate", "tokenNumber");

-- CreateIndex
CREATE UNIQUE INDEX "opd_queue_entries_clinicId_idempotencyKey_key" ON "opd_queue_entries"("clinicId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "opd_daily_counters_clinicId_doctorId_serviceDate_key" ON "opd_daily_counters"("clinicId", "doctorId", "serviceDate");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_uhid_counters" ADD CONSTRAINT "patient_uhid_counters_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_clinicId_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "patients"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_clinicId_fkey" FOREIGN KEY ("doctorId", "clinicId") REFERENCES "clinic_memberships"("userId", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduledFromId_clinicId_fkey" FOREIGN KEY ("rescheduledFromId", "clinicId") REFERENCES "appointments"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_queue_entries" ADD CONSTRAINT "opd_queue_entries_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_queue_entries" ADD CONSTRAINT "opd_queue_entries_patientId_clinicId_fkey" FOREIGN KEY ("patientId", "clinicId") REFERENCES "patients"("id", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_queue_entries" ADD CONSTRAINT "opd_queue_entries_doctorId_clinicId_fkey" FOREIGN KEY ("doctorId", "clinicId") REFERENCES "clinic_memberships"("userId", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_queue_entries" ADD CONSTRAINT "opd_queue_entries_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_daily_counters" ADD CONSTRAINT "opd_daily_counters_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opd_daily_counters" ADD CONSTRAINT "opd_daily_counters_doctorId_clinicId_fkey" FOREIGN KEY ("doctorId", "clinicId") REFERENCES "clinic_memberships"("userId", "clinicId") ON DELETE RESTRICT ON UPDATE CASCADE;
