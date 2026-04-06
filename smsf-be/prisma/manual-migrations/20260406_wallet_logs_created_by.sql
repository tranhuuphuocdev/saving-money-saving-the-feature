ALTER TABLE wallet_logs
ADD COLUMN IF NOT EXISTS created_by UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_wallet_logs_created_by'
    ) THEN
        ALTER TABLE wallet_logs
        ADD CONSTRAINT fk_wallet_logs_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(u_id)
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_logs_created_by ON wallet_logs (created_by);

-- Backfill log creator from transaction owner when available.
UPDATE wallet_logs wl
SET created_by = t.u_id
FROM transactions t
WHERE wl.created_by IS NULL
  AND wl.txn_id IS NOT NULL
  AND wl.txn_id = t.txn_id;

-- Fallback backfill: wallet owner for remaining rows when determinable.
UPDATE wallet_logs wl
SET created_by = uw.u_id
FROM user_wallets uw
WHERE wl.created_by IS NULL
  AND wl.w_id = uw.w_id
  AND uw.uw_role = 'owner';
