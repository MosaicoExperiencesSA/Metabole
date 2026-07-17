-- Task coach generati dal cron sui momenti chiave di prova e piani (handoff lancio, punto 5).
CREATE TABLE "coach_task" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "done_by_id" TEXT,
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coach_task_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coach_task_client_id_kind_ref_id_key" ON "coach_task"("client_id", "kind", "ref_id");
CREATE INDEX "coach_task_status_due_date_idx" ON "coach_task"("status", "due_date");
CREATE INDEX "coach_task_client_id_idx" ON "coach_task"("client_id");
ALTER TABLE "coach_task" ADD CONSTRAINT "coach_task_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
