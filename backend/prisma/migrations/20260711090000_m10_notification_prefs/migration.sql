-- M10: preferenze notifiche per cliente (opt-out per tipo + email opzionale).
ALTER TABLE "client_profile" ADD COLUMN "notification_prefs" JSONB;
