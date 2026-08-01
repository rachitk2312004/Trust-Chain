-- Wave 3: Blockchain integration (single DocumentRegistry; Hardhat + Sepolia)

CREATE TABLE "blockchain_networks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rpc_url_hint" TEXT,
    "explorer_base_url" TEXT,
    "document_registry_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_networks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blockchain_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "network_id" UUID NOT NULL,
    "organization_id" UUID,
    "document_id" UUID,
    "document_version_id" UUID,
    "operation" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "nonce" INTEGER,
    "tx_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "block_number" BIGINT,
    "block_hash" TEXT,
    "transaction_index" INTEGER,
    "confirmation_count" INTEGER NOT NULL DEFAULT 0,
    "gas_limit" BIGINT,
    "gas_used" BIGINT,
    "max_fee_per_gas" BIGINT,
    "error" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blockchain_anchors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "network_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "content_hash" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "org_id_bytes32" TEXT NOT NULL,
    "document_id_bytes32" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "block_number" BIGINT,
    "block_hash" TEXT,
    "transaction_index" INTEGER,
    "confirmation_count" INTEGER NOT NULL DEFAULT 0,
    "anchored_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "failure_reason" TEXT,
    "anchor_tx_id" UUID,
    "revoke_tx_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_anchors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blockchain_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "network_id" UUID NOT NULL,
    "contract_address" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "block_number" BIGINT NOT NULL,
    "log_index" INTEGER NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "payload" JSONB,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blockchain_retry_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "network_id" UUID NOT NULL,
    "organization_id" UUID,
    "operation" TEXT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" UUID NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "last_error" TEXT,
    "next_run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_retry_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_chain_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "network_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "register_tx_id" UUID,
    "registered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_chain_registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blockchain_intent_nonces" (
    "organization_id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "next_nonce" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_intent_nonces_pkey" PRIMARY KEY ("organization_id","network_id")
);

CREATE UNIQUE INDEX "blockchain_networks_key_key" ON "blockchain_networks"("key");
CREATE INDEX "blockchain_networks_chain_id_idx" ON "blockchain_networks"("chain_id");

CREATE UNIQUE INDEX "blockchain_transactions_network_id_tx_hash_key" ON "blockchain_transactions"("network_id", "tx_hash");
CREATE INDEX "blockchain_transactions_status_idx" ON "blockchain_transactions"("status");
CREATE INDEX "blockchain_transactions_organization_id_idx" ON "blockchain_transactions"("organization_id");
CREATE INDEX "blockchain_transactions_document_id_idx" ON "blockchain_transactions"("document_id");

CREATE UNIQUE INDEX "blockchain_anchors_network_id_document_version_id_key" ON "blockchain_anchors"("network_id", "document_version_id");
CREATE INDEX "blockchain_anchors_content_hash_idx" ON "blockchain_anchors"("content_hash");
CREATE INDEX "blockchain_anchors_organization_id_idx" ON "blockchain_anchors"("organization_id");
CREATE INDEX "blockchain_anchors_status_idx" ON "blockchain_anchors"("status");

CREATE UNIQUE INDEX "blockchain_events_network_id_tx_hash_log_index_key" ON "blockchain_events"("network_id", "tx_hash", "log_index");
CREATE INDEX "blockchain_events_network_id_event_name_idx" ON "blockchain_events"("network_id", "event_name");

CREATE INDEX "blockchain_retry_jobs_status_next_run_at_idx" ON "blockchain_retry_jobs"("status", "next_run_at");
CREATE INDEX "blockchain_retry_jobs_organization_id_idx" ON "blockchain_retry_jobs"("organization_id");

CREATE UNIQUE INDEX "organization_chain_registrations_network_id_organization_id_key" ON "organization_chain_registrations"("network_id", "organization_id");

ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blockchain_anchors" ADD CONSTRAINT "blockchain_anchors_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_anchors" ADD CONSTRAINT "blockchain_anchors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_anchors" ADD CONSTRAINT "blockchain_anchors_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_anchors" ADD CONSTRAINT "blockchain_anchors_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_anchors" ADD CONSTRAINT "blockchain_anchors_anchor_tx_id_fkey" FOREIGN KEY ("anchor_tx_id") REFERENCES "blockchain_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blockchain_anchors" ADD CONSTRAINT "blockchain_anchors_revoke_tx_id_fkey" FOREIGN KEY ("revoke_tx_id") REFERENCES "blockchain_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blockchain_events" ADD CONSTRAINT "blockchain_events_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blockchain_retry_jobs" ADD CONSTRAINT "blockchain_retry_jobs_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_retry_jobs" ADD CONSTRAINT "blockchain_retry_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_chain_registrations" ADD CONSTRAINT "organization_chain_registrations_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_chain_registrations" ADD CONSTRAINT "organization_chain_registrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_chain_registrations" ADD CONSTRAINT "organization_chain_registrations_register_tx_id_fkey" FOREIGN KEY ("register_tx_id") REFERENCES "blockchain_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blockchain_intent_nonces" ADD CONSTRAINT "blockchain_intent_nonces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blockchain_intent_nonces" ADD CONSTRAINT "blockchain_intent_nonces_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed allowed networks (Hardhat + Sepolia only)
INSERT INTO "blockchain_networks" ("key", "chain_id", "name", "rpc_url_hint", "explorer_base_url", "is_active")
VALUES
  ('hardhat', 31337, 'Hardhat', 'http://127.0.0.1:8545', NULL, true),
  ('sepolia', 11155111, 'Sepolia', 'https://rpc.sepolia.org', 'https://sepolia.etherscan.io', true);
