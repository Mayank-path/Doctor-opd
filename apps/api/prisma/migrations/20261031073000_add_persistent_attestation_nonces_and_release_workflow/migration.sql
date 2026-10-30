-- CreateTable: Persistent replay protection for Ed25519 cryptographic attestation nonces
CREATE TABLE "governance_attestation_nonces" (
    "id" TEXT NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "version_id" TEXT NOT NULL,
    "reviewer_user_id" TEXT NOT NULL,
    "consumed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_attestation_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint preventing nonce reuse across server restarts and distributed instances
CREATE UNIQUE INDEX "governance_attestation_nonces_nonce_key" ON "governance_attestation_nonces"("nonce");

-- CreateIndex: Lookup indexes for version and reviewer attestation nonces
CREATE INDEX "governance_attestation_nonces_version_id_idx" ON "governance_attestation_nonces"("version_id");
CREATE INDEX "governance_attestation_nonces_reviewer_user_id_idx" ON "governance_attestation_nonces"("reviewer_user_id");

-- AddForeignKey: Bind nonce consumption to KnowledgePackVersion (RESTRICT prevents accidental version deletion)
ALTER TABLE "governance_attestation_nonces" ADD CONSTRAINT "governance_attestation_nonces_version_id_fkey" 
FOREIGN KEY ("version_id") REFERENCES "knowledge_pack_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Bind nonce consumption to Reviewer User (RESTRICT prevents accidental reviewer deletion)
ALTER TABLE "governance_attestation_nonces" ADD CONSTRAINT "governance_attestation_nonces_reviewer_user_id_fkey" 
FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
