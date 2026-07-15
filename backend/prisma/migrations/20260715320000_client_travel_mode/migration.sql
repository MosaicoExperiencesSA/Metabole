-- Modalità viaggio/estate sul profilo cliente (piani stagionali)
ALTER TABLE "client_profile" ADD COLUMN "travel_state" TEXT;
ALTER TABLE "client_profile" ADD COLUMN "travel_start" TIMESTAMP(3);
ALTER TABLE "client_profile" ADD COLUMN "travel_end" TIMESTAMP(3);
