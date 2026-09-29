CREATE TABLE "chat_message_hides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_hides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_message_hides_message_user_key" ON "chat_message_hides"("message_id", "user_id");
CREATE INDEX "chat_message_hides_user_idx" ON "chat_message_hides"("user_id");

ALTER TABLE "chat_message_hides" ADD CONSTRAINT "chat_message_hides_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_message_hides" ADD CONSTRAINT "chat_message_hides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
