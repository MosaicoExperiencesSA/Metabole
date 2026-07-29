# Registro modifiche — Email "primo giorno": data corretta + niente colazione per il digiuno

**Data:** 29 luglio 2026 · Base: main. (Reclamo cliente Gioia.)

## Problema (reclamo, ha ragione)
1. **Data sbagliata:** l'email "Benvenuta nel tuo primo giorno / oggi si comincia" (`onb_g1`)
   arrivava il **giorno DOPO** l'inizio piano. Gioia ha iniziato il 27 e l'ha ricevuta il 28
   ("buon inizio del 28").
2. **Colazione per tutti:** l'email dice "parti dalla colazione", ma chi fa **digiuno intermittente
   16:8 non fa colazione** → messaggio non pertinente.

## Fix — `backend/src/marketing/lifecycle.service.ts`
1. **Data:** `onb_g1` ora parte con **offset 0** (planStartDate = oggi), cioè **il giorno d'inizio**,
   non più il giorno dopo (offset -1). Aggiornata l'etichetta ("primo giorno", "Inizio piano = oggi").
   → Effetto immediato dopo il deploy backend, senza toccare i template.
2. **Colazione:** nuova variabile **`{{primoPasto}}`** passata alle email dei giorni piano
   (`piano_domani`, `onb_g1`, …): vale **"pranzo"** se `regime = intermittent_fasting`, altrimenti
   **"colazione"**.

## Template email — `backend/prisma/seed_email_marketing.ts`
- Aggiornati i testi di `onb_g1` e `piano_domani` per usare `{{primoPasto}}` invece di "colazione".
- ⚠ **I template LIVE non si aggiornano da soli:** il seed fa upsert ma aggiorna solo il `name`
  (per non sovrascrivere le modifiche dell'admin). Per applicare il fix colazione alle email già
  in produzione, **modificare i modelli nel backoffice** (Marketing → Modelli email):
  - **onb_g1** — sostituire *"Un consiglio: parti dalla colazione e prenditela con calma."* con
    *"Un consiglio: comincia dal tuo primo pasto (`{{primoPasto}}`) e prenditela con calma."*
  - **piano_domani** — sostituire *"prepara stasera ciò che ti serve per la colazione. Iniziare bene
    la mattina fa la differenza."* con *"prepara ciò che ti serve per il tuo primo pasto
    (`{{primoPasto}}`). Cominciare bene fa la differenza."*
  La variabile `{{primoPasto}}` è ora disponibile.

## Verifica
- Transpile `lifecycle.service.ts` e `seed_email_marketing.ts`: OK, NUL check OK.

## Impatto / deploy
- **Solo backend (Render).** Il fix data è immediato; il fix colazione richiede la modifica dei due
  template live nel backoffice (una tantum). Nessuna migration.
