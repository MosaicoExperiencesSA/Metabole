# Registro modifiche — "Invia credenziali" al lead (email + password provvisoria)

**Data:** 17 luglio 2026 · Base: origin/main b326e55.

## Summary
Nuova azione **"Invia credenziali"**: crea l'accesso a un lead (account con password provvisoria
auto-generata) e glielo manda via email. Il lead **resta lead** finché non fa un acquisto (flusso
verificato: la conversione a "Acquisito" avviene solo al pagamento). Disponibile in 3 punti:
app (rubrica staff), backoffice inserimento lead, backoffice scheda lead.

## Flusso verificato
Un `CrmRecord` (lead) può avere o meno un account (`clientId`). Diventa cliente ("paid") **solo
al pagamento** (`crm.autoAdvance('paid')` in commerce.service). "Invia credenziali" NON tocca lo
stage: crea solo l'accesso.

## Description

Backend
- **crm.service.sendCredentials(leadId)**: se il lead non ha account lo crea (email del lead,
  **password provvisoria auto-generata** `genTempPassword`, role `client`, `mustChangePassword=true`,
  `emailVerifiedAt=now`, telefono/nome dal lead) e lo collega al CrmRecord; se ce l'ha già rigenera
  la provvisoria e revoca le sessioni. Poi invia l'email. Lo stage non cambia. Audit senza password.
- **commerce.controller (CrmController)**: `POST /crm/leads/:id/send-credentials`; il `POST /crm/leads`
  accetta il flag `sendCredentials` (per "inserisci lead e invia credenziali" in un colpo).
- **mail.service.sendLeadCredentials** + testo i18n `mail.credentials.*` (IT), modello editabile dal
  backoffice (chiave `lead_credentials`). L'email contiene nome, email, password provvisoria, link app
  e la nota "al primo accesso farai il questionario e poi imposterai la tua password".

App (rubrica staff)
- **ContactActions**: nuova azione **"Invia credenziali"** (icona chiave) sulle righe lead
  (CoachClienti/NutriPazienti), con foglio di conferma e conferma d'invio.

Backoffice
- **LeadForm**: secondo pulsante **"Inserisci e invia credenziali"** (crea il lead + manda l'accesso).
- **LeadDetail**: pulsante **"Invia credenziali"** nella barra verde in alto.

## Compatibilità
Si appoggia a `mustChangePassword` (già esistente): l'app forza l'impostazione della password
personale a fine questionario. Nessuna migration.

## Note
- Prima di buildare: **git pull** per b326e55; **redeploy Render** (per i nuovi endpoint + testo email).
- L'email parte solo se `BREVO_API_KEY` è configurata su Render (altrimenti viene loggata come "skipped").
