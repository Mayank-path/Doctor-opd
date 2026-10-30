-- CreateEnum: PublicKeyStatus
CREATE TYPE "PublicKeyStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');

-- CreateTable: reviewer_public_keys
CREATE TABLE "reviewer_public_keys" (
    "id" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "keyAlgorithm" TEXT NOT NULL DEFAULT 'ed25519',
    "keyFingerprint" TEXT NOT NULL,
    "status" "PublicKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviewer_public_keys_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: keyFingerprint uniqueness on reviewer_public_keys
CREATE UNIQUE INDEX "reviewer_public_keys_keyFingerprint_key" ON "reviewer_public_keys"("keyFingerprint");

-- CreateIndex: Index on reviewerUserId and status
CREATE INDEX "reviewer_public_keys_reviewerUserId_status_idx" ON "reviewer_public_keys"("reviewerUserId", "status");

-- AddForeignKey: reviewer_public_keys.reviewerUserId -> users.id (RESTRICT prevents deleting key owners)
ALTER TABLE "reviewer_public_keys" ADD CONSTRAINT "reviewer_public_keys_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

