-- Rows skipped on import because the account already held an identical transaction.
ALTER TABLE import_batches ADD COLUMN duplicate_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_transactions_import_batch ON transactions (import_batch_id);
