-- Embedded in every JWT; bumping it (on password change) invalidates all tokens issued before.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
