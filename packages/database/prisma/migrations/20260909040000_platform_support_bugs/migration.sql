CREATE TABLE "platform_inquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "created_by_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "last_message_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_inquiry_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inquiry_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_inquiry_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "organization_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_object_key" TEXT,
    "image_content_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bug_report_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status_after" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_report_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_inquiries_creator_created_idx" ON "platform_inquiries"("created_by_id", "created_at");
CREATE INDEX "platform_inquiries_status_last_idx" ON "platform_inquiries"("status", "last_message_at");
CREATE INDEX "platform_inquiry_messages_inquiry_created_idx" ON "platform_inquiry_messages"("inquiry_id", "created_at");
CREATE INDEX "bug_reports_reporter_created_idx" ON "bug_reports"("reporter_id", "created_at");
CREATE INDEX "bug_reports_status_created_idx" ON "bug_reports"("status", "created_at");
CREATE INDEX "bug_report_responses_report_created_idx" ON "bug_report_responses"("report_id", "created_at");

ALTER TABLE "platform_inquiries" ADD CONSTRAINT "platform_inquiries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_inquiries" ADD CONSTRAINT "platform_inquiries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_inquiry_messages" ADD CONSTRAINT "platform_inquiry_messages_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "platform_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_inquiry_messages" ADD CONSTRAINT "platform_inquiry_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bug_report_responses" ADD CONSTRAINT "bug_report_responses_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bug_report_responses" ADD CONSTRAINT "bug_report_responses_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
