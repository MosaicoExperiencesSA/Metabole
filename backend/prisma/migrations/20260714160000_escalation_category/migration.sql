-- R12 — categoria della segnalazione per il routing al ruolo giusto
-- (diet_blocked | no_progress | low_adherence | mood_risk | clinical | other).
ALTER TABLE "escalation" ADD COLUMN IF NOT EXISTS "category" TEXT;
