# Registro — Due anomalie di "fine piano"

**Data:** 3 agosto 2026 · Base: main.

## Anomalie segnalate
1. **Daniela Moreno:** "termino il piano oggi, ma mi ha dato il menù per domani e dopodomani."
   → il generatore consegnava giorni di menu **oltre la fine del piano**.
2. **Giusy:** piano scaduto il 28, ma riceve la notifica *"Il tuo piano di oggi — tutto
   confermato per oggi, continua col ritmo"* che la riporta al piano scaduto.
   → la notifica quotidiana del motore partiva anche a **piano scaduto**.

## Correzioni

### A) Menu oltre la fine piano — `backend/src/menu/menu.service.ts`
In `deliverIfEligible`: introdotto il **tetto alla data di fine piano** (`endDate` dell'abbonamento
attivo). Ora:
- se il primo giorno da erogare è oltre `endDate` → non si eroga nulla;
- nel ciclo di consegna si **interrompe** appena la data supererebbe `endDate` (il piano include
  fino a `endDate` compresa, non oltre).

### B) Notifica "piano di oggi" a piano scaduto — `backend/src/notifications/notifications.service.ts`
In `generateDailyForClient`: il messaggio quotidiano del motore (`engine_daily`) viene inviato
**solo se la cliente ha un piano attivo** (abbonamento `active` con `endDate` assente o ≥ oggi).
A piano scaduto/non attivo non parte più. Aggiornato anche lo spec (`notifications.service.spec.ts`)
con il mock dell'abbonamento attivo.

## Script

### Diagnostica (sola lettura) — `prisma/diag-anomalie-piano.ts` → `npm run diag:anomalie`
Elenca **tutte le clienti** con le due anomalie:
- A) chi ha MenuDay oltre la `endDate` del piano attivo (con l'elenco dei giorni);
- B) chi ha ricevuto una `engine_daily` negli ultimi 14 giorni pur **non** avendo un piano attivo.
Nessuna scrittura.

### Pulizia (una-tantum) — `prisma/prune-menu-after-planend.ts` → `npm run prune:menu-planend`
Rimuove i MenuDay già erogati **oltre** la fine piano (il bug A aveva già creato giorni in più,
es. il 04 e 05 per Daniela). Dry-run di default, scrive con `--apply`.

## Verifica
- Transpile OK di tutti i file toccati + i due script; spec aggiornato; NUL OK; package.json valido.
- (`prisma validate` non eseguibile in sandbox: engine non scaricabile.)

## Messa in produzione
1. **Push** da GitHub Desktop (deploy backend su Render). Le due correzioni sono lato server →
   attive subito, nessuna migration.
2. Sulla **Shell di Render**, controlla chi è coinvolto:
   ```
   npm run diag:anomalie
   ```
3. Ripulisci i menu già erogati oltre la fine piano:
   ```
   npm run prune:menu-planend              # DRY-RUN
   npm run prune:menu-planend -- --apply   # applica
   ```
   (Daniela vedrà sparire i giorni del 04/05; d'ora in poi non verranno più creati.)

Nessuna modifica frontend → niente OTA per queste due correzioni.
