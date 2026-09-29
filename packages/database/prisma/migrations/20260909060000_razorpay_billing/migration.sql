CREATE TABLE "billing_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_type" TEXT NOT NULL,
    "user_id" UUID,
    "organization_id" UUID,
    "plan_key" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "razorpay_customer_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "plan_key" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'created',
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "razorpay_signature" TEXT,
    "receipt" TEXT,
    "notes_json" JSONB,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "billing_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "period_ym" TEXT NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_accounts_user_id_key" ON "billing_accounts"("user_id");
CREATE UNIQUE INDEX "billing_accounts_organization_id_key" ON "billing_accounts"("organization_id");
CREATE INDEX "billing_accounts_plan_status_idx" ON "billing_accounts"("plan_key", "status");
CREATE UNIQUE INDEX "billing_orders_razorpay_order_id_key" ON "billing_orders"("razorpay_order_id");
CREATE INDEX "billing_orders_account_created_idx" ON "billing_orders"("account_id", "created_at");
CREATE INDEX "billing_orders_status_idx" ON "billing_orders"("status");
CREATE UNIQUE INDEX "billing_usage_account_metric_period_unique" ON "billing_usage"("account_id", "metric_key", "period_ym");
CREATE INDEX "billing_usage_account_period_idx" ON "billing_usage"("account_id", "period_ym");

ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_usage" ADD CONSTRAINT "billing_usage_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "billing_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "billing_accounts" ("owner_type", "organization_id", "plan_key", "status", "period_start", "period_end")
SELECT
    'organization',
    o.id,
    'premium_pro',
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 year'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM billing_accounts b WHERE b.organization_id = o.id
);
