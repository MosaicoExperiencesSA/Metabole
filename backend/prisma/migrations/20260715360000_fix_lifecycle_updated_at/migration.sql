-- Correzione: la colonna era stata creata come "updatedAt" (camelCase) mentre
-- lo schema la mappa su "updated_at" (@map). La rinominiamo per allinearla al
-- client Prisma. La tabella è appena introdotta e vuota, quindi la rename è sicura.
ALTER TABLE "lifecycle_settings" RENAME COLUMN "updatedAt" TO "updated_at";
