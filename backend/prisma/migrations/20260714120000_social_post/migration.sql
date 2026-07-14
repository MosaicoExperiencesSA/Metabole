-- Marketing — coda/log post social (agente Publisher)
CREATE TABLE "social_post" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT,
    "channel" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "image_ref" TEXT,
    "image_source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "judge_pass" BOOLEAN,
    "judge_issues" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "external_id" TEXT,
    "error" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "social_post_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "social_post_status_idx" ON "social_post"("status");
CREATE INDEX "social_post_channel_scheduled_at_idx" ON "social_post"("channel", "scheduled_at");
