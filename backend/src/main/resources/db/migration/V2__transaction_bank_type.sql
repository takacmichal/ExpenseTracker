-- The bank's own label for the movement ("Platba kartou", "SEPA platba", ...).
-- Kept so rules can be re-applied later: a transfer carries only a person's name in its
-- description, and the type is then the only signal left to categorise it by.
ALTER TABLE transactions ADD COLUMN bank_type VARCHAR(100);
