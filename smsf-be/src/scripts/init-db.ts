import pool from "../lib/db";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    u_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dn TEXT,
    username TEXT NOT NULL UNIQUE,
    tele_chat_id TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS categories (
    cate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    u_id TEXT NOT NULL,
    cate_name TEXT NOT NULL,
    cate_icon TEXT,
    cate_type TEXT NOT NULL CHECK (cate_type IN ('income', 'expense')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS cate_icon TEXT;

CREATE TABLE IF NOT EXISTS wallets (
    w_id TEXT PRIMARY KEY,
    u_id UUID NOT NULL REFERENCES users(u_id),
    w_name TEXT NOT NULL,
    w_type TEXT NOT NULL DEFAULT 'cash',
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    b_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    u_id UUID NOT NULL REFERENCES users(u_id),
    cate_id UUID NOT NULL REFERENCES categories(cate_id),
    bud_name TEXT NOT NULL,
    bud_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    bud_spent NUMERIC(18, 2) NOT NULL DEFAULT 0,
    description TEXT,
    bud_type TEXT NOT NULL CHECK (bud_type IN ('week', 'month', 'year', 'saving', 'jar')),
    period_month SMALLINT NOT NULL,
    period_year SMALLINT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

ALTER TABLE budgets
ADD COLUMN IF NOT EXISTS bud_spent NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE budgets
DROP CONSTRAINT IF EXISTS budgets_bud_type_check;

ALTER TABLE budgets
ADD CONSTRAINT budgets_bud_type_check
CHECK (bud_type IN ('week', 'month', 'year', 'saving', 'jar'));

CREATE TABLE IF NOT EXISTS budget_category_maps (
    bcm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    b_id UUID NOT NULL REFERENCES budgets(b_id) ON DELETE CASCADE,
    cate_id UUID NOT NULL REFERENCES categories(cate_id),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    UNIQUE (b_id, cate_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    txn_id TEXT PRIMARY KEY,
    u_id UUID NOT NULL REFERENCES users(u_id),
    u_name TEXT,
    w_id TEXT NOT NULL REFERENCES wallets(w_id),
    cate_id UUID NOT NULL REFERENCES categories(cate_id),
    cate_name TEXT,
    b_id UUID,
    b_name TEXT,
    txn_type TEXT NOT NULL CHECK (txn_type IN ('income', 'expense')),
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    note TEXT,
    txn_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS notifications (
    noti_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    u_id UUID NOT NULL REFERENCES users(u_id),
    cate_id UUID NOT NULL REFERENCES categories(cate_id),
    cate_name TEXT,
    amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    description TEXT,
    tele_chat_id TEXT,
    due_day SMALLINT NOT NULL,
    active_months SMALLINT NOT NULL DEFAULT 12,
    next_due_at BIGINT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    paid_month SMALLINT NOT NULL DEFAULT 0,
    paid_year SMALLINT NOT NULL DEFAULT 0,
    current_month SMALLINT NOT NULL DEFAULT 0,
    current_year SMALLINT NOT NULL DEFAULT 0,
    last_payment_txn_id TEXT,
    last_reminder_period INTEGER,
    last_reminder_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

CREATE INDEX IF NOT EXISTS idx_categories_u_id ON categories(u_id);
CREATE INDEX IF NOT EXISTS idx_categories_cate_type ON categories(cate_type);
CREATE INDEX IF NOT EXISTS idx_categories_is_default ON categories(is_default);
CREATE INDEX IF NOT EXISTS idx_categories_is_deleted ON categories(is_deleted);

CREATE INDEX IF NOT EXISTS idx_wallets_u_id ON wallets(u_id);

CREATE INDEX IF NOT EXISTS idx_budgets_u_id ON budgets(u_id);
CREATE INDEX IF NOT EXISTS idx_budgets_bud_type ON budgets(bud_type);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_month, period_year);
CREATE INDEX IF NOT EXISTS idx_budgets_u_period_type ON budgets(u_id, period_year, period_month, bud_type);

CREATE INDEX IF NOT EXISTS idx_budget_category_maps_b_id ON budget_category_maps(b_id);
CREATE INDEX IF NOT EXISTS idx_budget_category_maps_cate_id ON budget_category_maps(cate_id);

CREATE INDEX IF NOT EXISTS idx_transactions_u_id ON transactions(u_id);
CREATE INDEX IF NOT EXISTS idx_transactions_txn_at ON transactions(txn_at);
CREATE INDEX IF NOT EXISTS idx_transactions_cate_id ON transactions(cate_id);
CREATE INDEX IF NOT EXISTS idx_transactions_w_id ON transactions(w_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_deleted ON transactions(is_deleted);
CREATE INDEX IF NOT EXISTS idx_transactions_u_id_txn_at ON transactions(u_id, txn_at);

CREATE INDEX IF NOT EXISTS idx_notifications_u_id ON notifications(u_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_deleted ON notifications(is_deleted);
CREATE INDEX IF NOT EXISTS idx_notifications_next_due_at ON notifications(next_due_at);
`;

async function initDb(): Promise<void> {
    console.log("[init-db] creating tables and indexes...");
    await pool.query(SCHEMA_SQL);
    console.log("[init-db] schema initialized successfully.");
    await pool.end();
}

export { SCHEMA_SQL };

if (require.main === module) {
    initDb().catch((error) => {
        console.error("[init-db] failed:", (error as Error).message);
        process.exit(1);
    });
}
