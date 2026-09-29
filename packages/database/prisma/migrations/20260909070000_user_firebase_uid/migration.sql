ALTER TABLE "users" ADD COLUMN "firebase_uid" TEXT;

CREATE UNIQUE INDEX "users_firebase_uid_unique_idx" ON "users"("firebase_uid");
