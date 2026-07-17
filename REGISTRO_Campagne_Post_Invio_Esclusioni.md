# Registro modifiche — Campagne: azione post-invio (tag/stato) + esclusioni nel segmento

**Data:** 17 luglio 2026 · Base: origin/main 09ad70a.

## Summary
Nell'invio campagne si può ora impostare un'**azione post-invio**: sui destinatari a cui l'email è
stata **effettivamente inviata** viene aggiunto un tag e/o cambiato lo stato pipeline (o
entrambi). In "Crea il segmento" arrivano i filtri **"Escludi tag"** e **"Escludi stati"**:
insieme al tag post-invio chiudono il cerchio (es. campagna 2 che esclude chi ha già
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
  inviate con successo aggiunge il tag se assente (tetto 30 tag) e/o imposta lo stato
  se diverso, scrivendo anche `stageDates[stato] = { at, byUserId: creatore campagna, meta:
  { source: 'campaign' } }` come per i cambi manuali. Best-effort: una scheda che fallisce non
  ferma né le altre né la campagna. Vale sia per l'invio immediato sia per le programmate/a lotti.
- **SegmentFilters**: nuovi `excludeTags` (NOT hasSome sui tag) ed `excludeStages`
  (stage notIn), applicati in `conditions()` quindi validi per anteprima e invio.

Stati pipeline (fix richiesti da Simone)
- **seed.ts (seedPipelineStages)**: il set predefinito viene creato SOLO alla prima installazione
  (tabella vuota). Da lì in poi gli stati sono dell'admin: rinomina, riordina, aggiunge, **elimina**
  — il seed non ricrea più quelli eliminati a ogni deploy. Restano protetti solo i 3 di sistema
  (lead_in, trial, paid), usati dall'automazione: se mancano vengono ripristinati.
  → Dopo il prossimo deploy: elimina una volta gli stati indesiderati e non torneranno più.
- **marketing.service.options()**: gli stati per "Crea segmento" ora arrivano dalla tabella
  pipeline (TUTTI quelli definiti, nell'ordine dell'admin, con l'etichetta leggibile), non più
  dalle sole schede esistenti — prima uno stato senza contatti non compariva, e si vedeva la
  chiave tecnica invece del nome.

Backoffice (Marketing.tsx)
- **Crea il segmento**: due nuove righe di chip "Escludi tag" e "Escludi stati" sotto
  quelle di inclusione ("Etichette"/"Stato" rinominate "Includi tag"/"Includi stati" — su
  richiesta di Simone il termine in UI è "tag"); "Azzera filtri" le pulisce. I chip stato mostrano il nome (es. "Da Ricontattare"),
  come nel resto del CRM; anche l'anteprima del segmento mostra il nome dello stato.
- **Invia la campagna**: blocco "Dopo l'invio (facoltativo)" con campo tag (testo libero con
  suggerimenti dai tag esistenti) e tendina "Sposta allo stato"; i valori entrano nel body
  solo se compilati e vengono azzerati a invio riuscito.
- **Modale di conferma**: riepilogo dell'azione post-invio ("Dopo l'invio: tag X e stato Y
  sui contatti raggiunti").

## Note
- **Serve la migration** al deploy (preDeploy già la esegue): due ADD COLUMN, nessun dato toccato.
- L'azione si applica per lotto: sulle campagne a lotti le schede vengono aggiornate man mano che
  i lotti partono, non alla fine.
- Le email fallite non ricevono né tag né cambio stato.

## Aggiunta (chiarimento tag vs stato)
- Il badge **"CRM: trial"** sulla scheda cliente NON è un tag: è lo **stato pipeline**, che
  mostrava la chiave tecnica. Ora mostra il nome scelto dall'admin (es. "CRM: Prova"):
  clients.service arricchisce `crm` con `stageLabel`, ClientDetail.tsx lo usa.
- I **tag** veri sono le scritte libere sulla scheda CRM (campo "Etichette/Tag" del lead), quelli
  usati da "Includi/Escludi tag" e dall'azione post-invio. "Attivo" è lo stato dell'abbonamento.
