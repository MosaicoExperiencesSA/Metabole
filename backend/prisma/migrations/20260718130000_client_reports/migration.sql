-- Report di fine piano (handoff punto 4): snapshot A→B consegnato in app.
CREATE TABLE "client_report" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_report_subscription_id_key" ON "client_report"("subscription_id");
CREATE INDEX "client_report_client_id_created_at_idx" ON "client_report"("client_id", "created_at");

ALTER TABLE "client_report" ADD CONSTRAINT "client_report_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
