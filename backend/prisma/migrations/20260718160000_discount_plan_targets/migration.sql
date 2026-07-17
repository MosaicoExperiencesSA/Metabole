-- Opzione B (decisione socio 17/07): sconto founding via codice con TARGET esatti per piano.
-- plan_targets = { "<planId>": prezzoTargetCents } — il codice porta il piano al prezzo target.
ALTER TABLE "discount_code" ADD COLUMN "plan_targets" JSONB;
