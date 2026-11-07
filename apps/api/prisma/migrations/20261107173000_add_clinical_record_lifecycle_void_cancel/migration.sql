-- AlterEnum
ALTER TYPE "ConsultationStatus" ADD VALUE 'VOIDED';

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN "voidedAt" TIMESTAMPTZ(3),
ADD COLUMN "voidReason" TEXT;

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN "cancelledAt" TIMESTAMPTZ(3),
ADD COLUMN "cancellationReason" TEXT;

