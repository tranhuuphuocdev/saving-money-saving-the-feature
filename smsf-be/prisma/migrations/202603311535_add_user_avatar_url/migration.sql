-- CreateTable users
CREATE TABLE "users" (
    "u_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dn" TEXT,
    "avatar_url" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'local',
    "google_sub" TEXT,
    "tele_chat_id" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("u_id")
);

-- CreateTable categories
CREATE TABLE "categories" (
    "cate_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "u_id" TEXT NOT NULL,
    "cate_name" TEXT NOT NULL,
    "cate_icon" TEXT,
    "cate_type" TEXT NOT NULL,
    "cate_index" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("cate_id")
);

-- CreateTable wallets  
CREATE TABLE "wallets" (
    "w_id" TEXT NOT NULL,
    "w_name" TEXT NOT NULL,
    "w_type" TEXT NOT NULL DEFAULT 'cash',
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("w_id")
);

-- CreateTable budgets
CREATE TABLE "budgets" (
    "b_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "u_id" UUID NOT NULL,
    "cate_id" UUID NOT NULL,
    "bud_name" TEXT NOT NULL,
    "bud_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bud_spent" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "bud_type" TEXT NOT NULL,
    "period_month" SMALLINT NOT NULL,
    "period_year" SMALLINT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("b_id")
);

-- CreateTable budget_category_maps
CREATE TABLE "budget_category_maps" (
    "bcm_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "b_id" UUID NOT NULL,
    "cate_id" UUID NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "budget_category_maps_pkey" PRIMARY KEY ("bcm_id")
);

-- CreateTable transactions
CREATE TABLE "transactions" (
    "txn_id" TEXT NOT NULL,
    "u_id" UUID NOT NULL,
    "u_name" TEXT,
    "w_id" TEXT NOT NULL,
    "cate_id" UUID NOT NULL,
    "cate_name" TEXT,
    "b_id" UUID,
    "b_name" TEXT,
    "txn_type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "txn_at" BIGINT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("txn_id")
);

-- CreateTable notifications
CREATE TABLE "notifications" (
    "noti_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "u_id" UUID NOT NULL,
    "cate_id" UUID NOT NULL,
    "cate_name" TEXT,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "tele_chat_id" TEXT,
    "due_day" SMALLINT NOT NULL,
    "active_months" SMALLINT NOT NULL DEFAULT 12,
    "next_due_at" BIGINT NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "paid_month" SMALLINT NOT NULL DEFAULT 0,
    "paid_year" SMALLINT NOT NULL DEFAULT 0,
    "current_month" SMALLINT NOT NULL DEFAULT 0,
    "current_year" SMALLINT NOT NULL DEFAULT 0,
    "last_payment_txn_id" TEXT,
    "last_reminder_period" INTEGER,
    "last_reminder_at" BIGINT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("noti_id")
);

-- CreateTable wallet_logs
CREATE TABLE "wallet_logs" (
    "wl_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "w_id" TEXT NOT NULL,
    "txn_id" TEXT,
    "wl_action" TEXT NOT NULL,
    "wl_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "wl_balance_before" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "wl_balance_after" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "wl_desc" TEXT,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "wallet_logs_pkey" PRIMARY KEY ("wl_id")
);

-- CreateTable user_wallets (shared wallet support)
CREATE TABLE "user_wallets" (
    "uw_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "u_id" UUID NOT NULL,
    "w_id" TEXT NOT NULL,
    "uw_role" TEXT NOT NULL DEFAULT 'owner',
    "uw_order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("uw_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "budget_category_maps_b_id_cate_id_key" ON "budget_category_maps"("b_id", "cate_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_wallets_u_id_w_id_key" ON "user_wallets"("u_id", "w_id");

-- CreateIndex
CREATE INDEX "user_wallets_u_id_idx" ON "user_wallets"("u_id");

-- CreateIndex
CREATE INDEX "user_wallets_w_id_idx" ON "user_wallets"("w_id");

-- CreateIndex
CREATE INDEX "idx_wallet_logs_w_id" ON "wallet_logs"("w_id");

-- CreateIndex
CREATE INDEX "idx_wallet_logs_created_at" ON "wallet_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_u_id_fkey" FOREIGN KEY ("u_id") REFERENCES "users"("u_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_cate_id_fkey" FOREIGN KEY ("cate_id") REFERENCES "categories"("cate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_category_maps" ADD CONSTRAINT "budget_category_maps_b_id_fkey" FOREIGN KEY ("b_id") REFERENCES "budgets"("b_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_category_maps" ADD CONSTRAINT "budget_category_maps_cate_id_fkey" FOREIGN KEY ("cate_id") REFERENCES "categories"("cate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_u_id_fkey" FOREIGN KEY ("u_id") REFERENCES "users"("u_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_w_id_fkey" FOREIGN KEY ("w_id") REFERENCES "wallets"("w_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cate_id_fkey" FOREIGN KEY ("cate_id") REFERENCES "categories"("cate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_u_id_fkey" FOREIGN KEY ("u_id") REFERENCES "users"("u_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cate_id_fkey" FOREIGN KEY ("cate_id") REFERENCES "categories"("cate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_logs" ADD CONSTRAINT "wallet_logs_w_id_fkey" FOREIGN KEY ("w_id") REFERENCES "wallets"("w_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_u_id_fkey" FOREIGN KEY ("u_id") REFERENCES "users"("u_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_w_id_fkey" FOREIGN KEY ("w_id") REFERENCES "wallets"("w_id") ON DELETE CASCADE ON UPDATE CASCADE;