-- Create user_wallets junction table for shared wallet support
CREATE TABLE "user_wallets" (
    "uw_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "u_id" UUID NOT NULL,
    "w_id" TEXT NOT NULL,
    "uw_role" TEXT NOT NULL DEFAULT 'owner',
    "uw_order_index" SMALLINT NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("uw_id")
);

-- Create indexes for efficient queries
CREATE UNIQUE INDEX "user_wallets_u_id_w_id_key" ON "user_wallets"("u_id", "w_id");
CREATE INDEX "user_wallets_u_id_idx" ON "user_wallets"("u_id");
CREATE INDEX "user_wallets_w_id_idx" ON "user_wallets"("w_id");

-- Add foreign key constraints
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_u_id_fkey" FOREIGN KEY ("u_id") REFERENCES "users"("u_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_w_id_fkey" FOREIGN KEY ("w_id") REFERENCES "wallets"("w_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing wallet-user relationships from wallets table
-- This assumes wallets have a u_id column that needs to be migrated
INSERT INTO "user_wallets" ("u_id", "w_id", "uw_role", "uw_order_index", "created_at", "updated_at")
SELECT "u_id", "w_id", 'owner', 0, "created_at", "updated_at"
FROM "wallets"
WHERE "u_id" IS NOT NULL;

-- Drop the u_id column from wallets table (if exists)
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "u_id";
