# Registro modifiche — Campagne: azione post-invio (etichetta/stato) + esclusioni nel segmento

**Data:** 17 luglio 2026 · Base: origin/main 09ad70a.

## Summary
Nell'invio campagne si può ora impostare un'**azione post-invio**: sui destinatari a cui l'email è
stata **effettivamente inviata** viene aggiunta un'etichetta e/o cambiato lo stato pipeline (o
entrambi). In "Crea il segmento" arrivano i filtri **"Escludi etichette"** e **"Escludi stati"**:
insieme all'etichetta post-invio chiudono il cerchio (es. campagna 2 che esclude chi ha già
ricevuto la campagna 1).

## Description

Backend
- **schema.prisma + migration `20260718210000_campaign_post_actions`**: `marketing_campaign` ha due
  colonne nuove `post_tag` (TEXT) e `post_stage` (TEXT), entrambe opzionali.
- **marketing.controller (SendCampaignDto)**: campi opzionali `postTag` (max 40) e `postStage`
  (max 60), passati al service.
- **marketing.service.sendCampaign**: normalizza i due campi, valida `postStage` contro le
  `pipelineStage` esistenti (altrimenti 400 "Stato pipeline non valido per l'azione post-invio."),
  li salva sulla campagna e nell'audit.
- **marketing.service.runBatch → applyPostActions** (nuovo): dopo ogni lotto, sulle sole schede
  inviate con successo aggiunge l'etichetta se assente (tetto 30 etichette) e/o imposta lo stato
  se diverso, scrivendo anche `stageDates[stato] = { at, byUserId: creatore campagna, meta:
  { source: 'campaign' } }` come per i cambi manuali. Best-effort: una scheda che fallisce non
  ferma né le altre né la campagna. Vale sia per l'invio immediato sia per le programmate/a lotti.
- **SegmentFilters**: nuovi `excludeTags` (NOT hasSome sulle etichette) ed `excludeStages`
  (stage notIn), applicati in `conditions()` quindi validi per anteprima e invio.

Backoffice (Marketing.tsx)
- **Crea il segmento**: due nuove righe di chip "Escludi etichette" e "Escludi stati" sotto
  quelle di inclusione; "Azzera filtri" le pulisce.
- **Invia la campagna**: blocco "Dopo l'invio (facoltativo)" con campo etichetta (testo libero con
  suggerimenti dalle etichette esistenti) e tendina "Sposta allo stato"; i valori entrano nel body
  solo se compilati e vengono azzerati a invio riuscito.
- **Modale di conferma**: riepilogo dell'azione post-invio ("Dopo l'invio: etichetta X e stato Y
  sui contatti raggiunti").

## Note
- **Serve la migration** al deploy (preDeploy già la esegue): due ADD COLUMN, nessun dato toccato.
- L'azione si applica per lotto: sulle campagne a lotti le schede vengono aggiornate man mano che
  i lotti partono, non alla fine.
- Le email fallite non ricevono né etichetta né cambio stato.
