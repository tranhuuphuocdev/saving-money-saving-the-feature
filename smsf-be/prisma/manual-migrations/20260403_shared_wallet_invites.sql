CREATE TABLE IF NOT EXISTS shared_wallet_invites (
    swi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id VARCHAR(255) NOT NULL,
    sender_u_id UUID NOT NULL,
    receiver_u_id UUID NOT NULL,
    swi_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT fk_swi_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(w_id) ON DELETE CASCADE,
    CONSTRAINT fk_swi_sender FOREIGN KEY (sender_u_id) REFERENCES users(u_id) ON DELETE CASCADE,
    CONSTRAINT fk_swi_receiver FOREIGN KEY (receiver_u_id) REFERENCES users(u_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_swi_sender ON shared_wallet_invites (sender_u_id);
CREATE INDEX IF NOT EXISTS idx_swi_receiver ON shared_wallet_invites (receiver_u_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_swi_pending_wallet_receiver
ON shared_wallet_invites (wallet_id, receiver_u_id)
WHERE swi_status = 'pending';
