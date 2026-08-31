CREATE TABLE users (
    id            UUID PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL
);

CREATE TABLE accounts (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    currency   VARCHAR(3)   NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_accounts_user ON accounts (user_id);

CREATE TABLE categories (
    id         UUID PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    color      VARCHAR(7),
    icon       VARCHAR(255),
    type       VARCHAR(20)  NOT NULL,
    parent_id  UUID REFERENCES categories (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ  NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_categories_user ON categories (user_id);
CREATE INDEX idx_categories_parent ON categories (parent_id);

CREATE TABLE import_batches (
    id            UUID PRIMARY KEY,
    user_id       UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    filename      VARCHAR(255) NOT NULL,
    imported_at   TIMESTAMPTZ  NOT NULL,
    row_count     INTEGER      NOT NULL,
    status        VARCHAR(20)  NOT NULL,
    error_message TEXT,
    created_at    TIMESTAMPTZ  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_import_batches_user ON import_batches (user_id);

CREATE TABLE transactions (
    id               UUID PRIMARY KEY,
    user_id          UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    account_id       UUID           NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    category_id      UUID REFERENCES categories (id) ON DELETE SET NULL,
    amount           NUMERIC(19, 2) NOT NULL,
    transaction_date DATE           NOT NULL,
    description      VARCHAR(255),
    type             VARCHAR(20)    NOT NULL,
    source           VARCHAR(20)    NOT NULL,
    import_batch_id  UUID REFERENCES import_batches (id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ    NOT NULL,
    updated_at       TIMESTAMPTZ    NOT NULL
);

CREATE INDEX idx_transactions_user_date ON transactions (user_id, transaction_date DESC);
CREATE INDEX idx_transactions_category ON transactions (category_id);
CREATE INDEX idx_transactions_account ON transactions (account_id);

CREATE TABLE incomes (
    id             UUID PRIMARY KEY,
    user_id        UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    transaction_id UUID UNIQUE REFERENCES transactions (id) ON DELETE SET NULL,
    income_date    DATE           NOT NULL,
    net_amount     NUMERIC(19, 2) NOT NULL,
    gross_amount   NUMERIC(19, 2),
    employer       VARCHAR(255),
    note           VARCHAR(255),
    created_at     TIMESTAMPTZ    NOT NULL,
    updated_at     TIMESTAMPTZ    NOT NULL
);

CREATE INDEX idx_incomes_user_date ON incomes (user_id, income_date DESC);

CREATE TABLE category_rules (
    id            UUID PRIMARY KEY,
    user_id       UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    match_pattern VARCHAR(255) NOT NULL,
    category_id   UUID         NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    priority      INTEGER      NOT NULL DEFAULT 0,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_category_rules_user ON category_rules (user_id, priority DESC);
