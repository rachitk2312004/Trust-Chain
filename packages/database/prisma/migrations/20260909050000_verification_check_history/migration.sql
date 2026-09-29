CREATE TABLE "verification_check_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "valid_count" INTEGER NOT NULL,
    "failed_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_check_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_check_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "input_label" TEXT NOT NULL,
    "file_name" TEXT,
    "outcome" TEXT NOT NULL,
    "verdict" TEXT,
    "valid" BOOLEAN NOT NULL,
    "recipient_name" TEXT,
    "public_id" TEXT,
    "title" TEXT,
    "unique_id" TEXT,
    "content_hash" TEXT,
    "certificate_id" UUID,
    "document_id" UUID,
    "request_id" UUID,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_check_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verification_check_runs_org_created_idx" ON "verification_check_runs"("organization_id", "created_at");
CREATE INDEX "verification_check_rows_org_created_idx" ON "verification_check_rows"("organization_id", "created_at");
CREATE INDEX "verification_check_rows_run_idx" ON "verification_check_rows"("run_id");

ALTER TABLE "verification_check_runs" ADD CONSTRAINT "verification_check_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_check_runs" ADD CONSTRAINT "verification_check_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_check_rows" ADD CONSTRAINT "verification_check_rows_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "verification_check_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "verification_check_rows" ADD CONSTRAINT "verification_check_rows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
