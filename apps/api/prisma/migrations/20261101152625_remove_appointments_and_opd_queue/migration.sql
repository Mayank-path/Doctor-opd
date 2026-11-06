/*
  Warnings:

  - You are about to drop the `appointments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opd_daily_counters` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `opd_queue_entries` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_doctorId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_patientId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_rescheduledFromId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "opd_daily_counters" DROP CONSTRAINT "opd_daily_counters_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "opd_daily_counters" DROP CONSTRAINT "opd_daily_counters_doctorId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "opd_queue_entries" DROP CONSTRAINT "opd_queue_entries_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "opd_queue_entries" DROP CONSTRAINT "opd_queue_entries_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "opd_queue_entries" DROP CONSTRAINT "opd_queue_entries_doctorId_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "opd_queue_entries" DROP CONSTRAINT "opd_queue_entries_patientId_clinicId_fkey";

-- DropTable
DROP TABLE "appointments";

-- DropTable
DROP TABLE "opd_daily_counters";

-- DropTable
DROP TABLE "opd_queue_entries";

-- DropEnum
DROP TYPE "AppointmentStatus";

-- DropEnum
DROP TYPE "AppointmentType";

-- DropEnum
DROP TYPE "QueueStatus";
