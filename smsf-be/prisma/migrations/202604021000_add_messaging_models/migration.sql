-- CreateTable friendships
CREATE TABLE IF NOT EXISTS friendships (
    fs_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    u_id UUID NOT NULL,
    friend_u_id UUID NOT NULL,
    fs_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT fk_friendship_user FOREIGN KEY (u_id) REFERENCES users(u_id) ON DELETE CASCADE,
    CONSTRAINT fk_friendship_friend FOREIGN KEY (friend_u_id) REFERENCES users(u_id) ON DELETE CASCADE,
    CONSTRAINT uq_friendship_users UNIQUE (u_id, friend_u_id)
);

CREATE INDEX IF NOT EXISTS idx_friendship_u_id ON friendships (u_id);
CREATE INDEX IF NOT EXISTS idx_friendship_friend_u_id ON friendships (friend_u_id);

-- CreateTable direct_messages
CREATE TABLE IF NOT EXISTS direct_messages (
    dm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_u_id UUID NOT NULL,
    receiver_u_id UUID NOT NULL,
    dm_content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT fk_dm_sender FOREIGN KEY (sender_u_id) REFERENCES users(u_id) ON DELETE CASCADE,
    CONSTRAINT fk_dm_receiver FOREIGN KEY (receiver_u_id) REFERENCES users(u_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dm_sender_u_id ON direct_messages (sender_u_id);
CREATE INDEX IF NOT EXISTS idx_dm_receiver_u_id ON direct_messages (receiver_u_id);
CREATE INDEX IF NOT EXISTS idx_dm_created_at ON direct_messages (created_at DESC);

-- CreateTable friend_requests
CREATE TABLE IF NOT EXISTS friend_requests (
    fr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_u_id UUID NOT NULL,
    receiver_u_id UUID NOT NULL,
    fr_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    CONSTRAINT fk_fr_sender FOREIGN KEY (sender_u_id) REFERENCES users(u_id) ON DELETE CASCADE,
    CONSTRAINT fk_fr_receiver FOREIGN KEY (receiver_u_id) REFERENCES users(u_id) ON DELETE CASCADE,
    CONSTRAINT uq_friend_request_users UNIQUE (sender_u_id, receiver_u_id)
);

CREATE INDEX IF NOT EXISTS idx_fr_receiver_u_id ON friend_requests (receiver_u_id);
