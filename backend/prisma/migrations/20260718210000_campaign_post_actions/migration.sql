-- Azione post-invio campagna: aggiungi etichetta e/o cambia stato pipeline ai destinatari inviati.
ALTER TABLE "marketing_campaign" ADD COLUMN "post_tag" TEXT;
ALTER TABLE "marketing_campaign" ADD COLUMN "post_stage" TEXT;
