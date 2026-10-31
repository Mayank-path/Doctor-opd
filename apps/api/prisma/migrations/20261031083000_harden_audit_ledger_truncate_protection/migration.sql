-- Migration: 20261031083000_harden_audit_ledger_truncate_protection
-- Closes the table-level TRUNCATE gap on clinical governance audit ledgers.

-- Attach statement-level BEFORE TRUNCATE trigger to knowledge_pack_governance_audits
CREATE TRIGGER trg_knowledge_pack_governance_audits_truncate
BEFORE TRUNCATE ON "knowledge_pack_governance_audits"
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_governance_audit_mutation();

-- Attach statement-level BEFORE TRUNCATE trigger to reviewer_verification_history
CREATE TRIGGER trg_reviewer_verification_history_truncate
BEFORE TRUNCATE ON "reviewer_verification_history"
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_reviewer_verification_history_mutation();

