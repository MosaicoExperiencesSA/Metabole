# Registro modifiche — Script di bonifica dati CRM (#11, parte 2 — applicazione)

**Data:** 22 luglio 2026 · Base: origin/main 90aaacf (+ #7,#8, phone2). (Richiesta #11.)

## Summary
Script una-tantum per **applicare la bonifica** dei dati importati sui record CRM, con **dry-run
di default** (mostra cosa cambierebbe senza scrivere) e `--apply` per scrivere davvero. Tocca
**solo i casi sicuri**; gli ambigui restano da rivedere a mano.

## Description
`backend/prisma/bonifica-crm.ts` (nuovo) + npm script `bonifica:crm`.
- **Email (casi sicuri):**
  - `deleted_<email>_deleted` → `<email>` (contatti eliminati in Mosaico: ripristino l'indirizzo,
    come deciso da Simone);
  - email con `;` `,` o spazi **finali** → ripulita;
  - `x@dominio.tld@dominio.tld` (dominio duplicato identico) → `x@dominio.tld`.
- **Telefono (caso sicuro):** 20 cifre = due numeri appiccicati → primo 10 in `phone`, secondo 10
  in `phone2` (scrive phone2 solo se vuoto, non sovrascrive).
- **NON tocca** i casi ambigui: domini troncati (`@libero`, `@gm`), caratteri extra
  (`gmail.9com`), email alternative tra parentesi, telefoni di lunghezza anomala. Restano da
  rivedere col foglio `Bonifica_Import_Anteprima.xlsx`.
- Segnala (senza bloccare) le email ripristinate che coincidono con un contatto già esistente
  (possibile doppione da controllare a mano).

## Verifica (fatta sui dati reali del CSV di import)
- Email che verrebbero corrette: **19** (7 deleted + 10 separatori finali + 2 dominio doppio).
- Telefoni che verrebbero divisi in due numeri: **119** (esattamente 20 cifre).
- Coerente con l'anteprima Excel (colonne "SICURO"). transpile OK, NUL check OK.

## Come si lancia (dalla Shell di Render sul servizio backend, dove c'è DATABASE_URL)
```
npm run bonifica:crm              # DRY-RUN: stampa cosa cambierebbe, non scrive
npm run bonifica:crm -- --apply   # APPLICA davvero
```
Prerequisito: la colonna `phone2` deve esistere (deploy con `prisma migrate deploy` della
migration `20260722180000_crm_phone2`).

## Note
- Nessuna migration nuova (usa quella di phone2). Idempotente: rigirandolo non ri-cambia ciò che
  è già pulito.
- Gli ambigui (domini troncati, ecc.) e i telefoni di lunghezza anomala vanno sistemati a mano
  dalla scheda lead (ora phone/phone2 sono modificabili) o in un secondo passaggio guidato.
