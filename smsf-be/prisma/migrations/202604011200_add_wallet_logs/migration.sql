CREATE TABLE IF NOT EXISTS wallet_logs (
    wl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    w_id VARCHAR(255) NOT NULL,
    txn_id VARCHAR(255),
    wl_action VARCHAR(50) NOT NULL,
    wl_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    wl_balance_before DECIMAL(18, 2) NOT NULL DEFAULT 0,
    wl_balance_after DECIMAL(18, 2) NOT NULL DEFAULT 0,
    wl_desc TEXT,
    created_at BIGINT NOT NULL,
    CONSTRAINT fk_wallet_log_wallet FOREIGN KEY (w_id) REFERENCES wallets(w_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wallet_logs_w_id ON wallet_logs (w_id);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_created_at ON wallet_logs (created_at DESC);
