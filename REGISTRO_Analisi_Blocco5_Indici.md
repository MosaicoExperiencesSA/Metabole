# Registro modifiche — Analisi, Blocco 5 (scalabilità 80k contatti: indici)

**Data:** 21 luglio 2026 · Base: origin/main 181c738.

## Summary
Con l'arrivo delle liste storiche (circa **80.000 contatti**) alcune query CRM e
abbonamenti diventavano **scansioni piene** della tabella (senza indice). In particolare la
ricerca/dedup dei lead per **email** e **telefono** (form pubblici, registrazione, controllo
duplicati) e la selezione dei **piani/prove in scadenza** (status + data fine). Aggiunti
indici dedicati: a 80k righe la differenza è tra millisecondi e secondi per query.

## Description
`schema.prisma`
- **CrmRecord** (`crm_record`): aggiunti `@@index([email])` e `@@index([phone])`.
  Coprono la ricerca lead e il controllo duplicati durante l'import e le registrazioni.
- **Subscription** (`subscription`): aggiunto `@@index([status, endDate])`.
  Copre le query del cron rinnovi/scadenze (`status='active' AND endDate < ora`) e i report.

`prisma/migrations/20260721170000_scale_indexes/migration.sql`
- `CREATE INDEX "crm_record_email_idx" ON "crm_record"("email");`
- `CREATE INDEX "crm_record_phone_idx" ON "crm_record"("phone");`
- `CREATE INDEX "subscription_status_end_date_idx" ON "subscription"("status", "end_date");`

## Perché è la soluzione giusta
Gli indici sono la risposta standard alle scansioni piene: trasformano una ricerca
proporzionale al numero di righe (O(n)) in una ricerca su albero (O(log n)). Su email/telefono
la cardinalità è alta (quasi unici) → indice molto selettivo. Su `(status, endDate)` l'indice
composto serve sia il filtro per stato sia l'ordinamento/confronto sulla data in un'unica
struttura. Nessun cambio di logica applicativa: solo lettura più veloce.

## Note
- Migration **solo additiva** (CREATE INDEX): nessun rischio sui dati, nessun downtime.
  Su Postgres la creazione indice blocca le scritture per il tempo di build; a 80k righe è
  praticamente istantanea. (Per tabelle enormi si userebbe `CREATE INDEX CONCURRENTLY`, qui
  non necessario.)
- La riscrittura O(n²) dell'import è stata **esclusa dallo scope**: l'import è già completato
  e verificato lato utente. Restano solo gli indici, utili per l'operatività continua.
- Campagne marketing (invii): l'ottimizzazione di parallelizzazione è **rimandata** — va
  bilanciata con i limiti di rate di Brevo per non farsi bloccare l'account.
