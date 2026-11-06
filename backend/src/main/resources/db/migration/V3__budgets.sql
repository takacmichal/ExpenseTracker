-- Monthly spending limits. A null category is the overall limit across every expense.
CREATE TABLE budgets (
    id           UUID PRIMARY KEY,
    user_id      UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id  UUID REFERENCES categories (id) ON DELETE CASCADE,
    amount_limit NUMERIC(19, 2) NOT NULL CHECK (amount_limit > 0),
    created_at   TIMESTAMPTZ    NOT NULL,
    updated_at   TIMESTAMPTZ    NOT NULL
);

-- A plain UNIQUE (user_id, category_id) would allow any number of overall budgets, because
-- NULLs never compare equal; two partial indexes cover both cases.
CREATE UNIQUE INDEX uq_budgets_user_category ON budgets (user_id, category_id) WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX uq_budgets_user_overall ON budgets (user_id) WHERE category_id IS NULL;
