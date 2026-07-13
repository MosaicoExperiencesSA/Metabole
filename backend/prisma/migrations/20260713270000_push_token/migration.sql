-- Token dei dispositivi per le notifiche push (FCM).
CREATE TABLE "push_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_token_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_token_token_key" ON "push_token"("token");
CREATE INDEX "push_token_user_id_idx" ON "push_token"("user_id");
