# Registro modifiche — Analisi, Blocco 8 (CI bloccante + fix test rosso)

**Data:** 21 luglio 2026 · Base: origin/main 8ceaed3.

## Summary
La CI (`.github/workflows/ci.yml`) aveva i test backend con `continue-on-error: true`: i test
**non fermavano mai** la pipeline, quindi una regressione passava silenziosa e "verde" non
garantiva nulla. Inoltre un test era **rosso di suo**: `auth.service.spec.ts` non passava più
il `phone`, diventato **obbligatorio** in registrazione. Ora il test è **sistemato** e i test
sono **bloccanti**.

## Description
`auth.service.spec.ts`
- Aggiunto al mock `prisma.user` il metodo **`findMany`** (default `[]`): `register()` lo usa
  per il controllo di **univocità del telefono**; senza, il test andava in errore.
- I due test di `register` ora passano un **`phone`** valido (il campo è obbligatorio nel DTO):
  `register({ …, phone: '+39 333 1234567' })`; aggiunta l'asserzione che il telefono venga
  salvato.
- Rinominata la `describe('impersonate …')` da "master password sicura" a "accesso assistenza
  sicuro" (la MASTER_PASSWORD è stata rimossa nel Blocco 6; il test riguarda l'impersonazione).

`.github/workflows/ci.yml`
- Rimosso `continue-on-error: true` dallo step dei test backend: **un test rosso ora ferma la
  pipeline**. Lasciato un commento con l'istruzione per sbloccare temporaneamente in caso di
  necessità.

## Perché è la soluzione giusta
Una suite che non blocca è una rete di sicurezza spenta. Rendere i test bloccanti — dopo aver
sistemato il rosso noto — fa sì che ogni regressione futura venga fermata prima del merge/deploy.
Il fix del test riflette il comportamento reale (telefono obbligatorio e univoco), quindi il
test ora verifica la cosa giusta.

## Note e verifica
- **Non verificabile in sandbox**: l'intera suite (427 test) richiede il client Prisma generato
  (`prisma generate` scarica un engine bloccato qui). Le modifiche al file di test sono state
  controllate a livello di sintassi/transpile; il fix è mirato e coerente col DTO.
- **Cautela CI**: se, girando in CI con Prisma generato, dovessero emergere **altri** fallimenti
  pre-esistenti (il vecchio commento citava problemi di DI NestJS), la pipeline andrà rossa —
  che è esattamente lo scopo della rete di sicurezza. Per sbloccare in fretta basta rimettere
  `continue-on-error: true` sullo step "Test" e sistemare i test segnalati. Il **deploy su
  Render è indipendente** dalla CI GitHub, quindi una CI rossa non blocca la messa in produzione.
- Nessuna migration.
