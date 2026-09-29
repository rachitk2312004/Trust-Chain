ALTER TABLE "chat_messages"
  ADD COLUMN "edited_at" TIMESTAMPTZ(6),
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
