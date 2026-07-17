-- Report mensile IN APP (stesso impianto del report di fine piano): più report per
-- abbonamento, uno per mese ('m1','m2',…) + quello finale ('final').
ALTER TABLE "client_report" ADD COLUMN "period_key" TEXT NOT NULL DEFAULT 'final';
DROP INDEX "client_report_subscription_id_key";
CREATE UNIQUE INDEX "client_report_subscription_id_period_key_key" ON "client_report"("subscription_id", "period_key");
