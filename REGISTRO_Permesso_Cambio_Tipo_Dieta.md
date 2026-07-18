# Registro modifiche — Permesso "Cambia tipo di dieta" (scheda cliente)

**Data:** 18 luglio 2026 · Base: origin/main cbef138.

## Summary
Cambiare il **tipo di dieta** della cliente (Regime: onnivora/vegetariana/vegana + Stile:
mediterranea/keto/proteica…) dalla scheda ora richiede il permesso dedicato **"Cambia tipo di
dieta"** nella matrice Permessi. Default ON per **nutrizionista, capo nutrizionista e admin**;
tutti gli altri OFF — Simone lo regola dai Permessi come per "Correggi misure cliente".
Prima chiunque avesse accesso alla scheda (coach comprese) poteva cambiarli.

## Description

Backend
- **permissions/pages.ts**: nuova pagina `change_diet_type`; default vede+gestisce per
  nutritionist, head_nutritionist, admin.
- **clients.service.updateClient**: se la modifica tocca `regime` o `dietStyle` con un valore
  DIVERSO dall'attuale, verifica il permesso (stessa logica del PageGuard: riga matrice se
  esiste, altrimenti default; admin sempre sì) → altrimenti 403 con messaggio chiaro.
  Il resto della scheda resta modificabile come prima; rimandare i valori invariati non
  richiede il permesso (il form li invia sempre).
- **Audit dedicato** `client.diet_type.change` con prima/dopo (regime e stile), oltre al
  consueto `client.update` — visibile nel "Log modifiche" della scheda.

Backoffice
- **ClientDetail.tsx (Modifica scheda)**: senza permesso, i menu Regime e Stile sono
  **bloccati** (lucchetto + tooltip "lo cambia chi ha il permesso…"); col permesso tutto
  come prima. Nel Log modifiche la voce compare come "Cambio tipo di dieta".
- **labels.ts**: etichetta "Cambia tipo di dieta" per la riga nei Permessi.

## Note
- Nessuna migration. Al deploy il seed permessi crea la riga con i default (i permessi già
  personalizzati non vengono toccati). Per ruoli personalizzati: abilitare vede+gestisce
  dalla matrice.
- Il questionario del CLIENTE lato app non è toccato: qui si parla solo della scheda staff.

## Aggiunta — data inizio piano in "Acquisti" (permesso "Cambia data inizio piano")
- **Nuovo permesso `change_plan_start`** nella matrice (default: solo admin; Simone lo abilita
  ai ruoli che vuole).
- **Scheda cliente → Acquisti**: sotto l'intestazione compare "Inizio piano: gg/mm/aaaa · fine
  gg/mm/aaaa"; chi ha il permesso vede la matita e può spostare l'inizio (accetta AAAA-MM-GG o
  GG/MM/AAAA, max ±1 anno).
- **Backend `PATCH /admin/clients/:id/plan-start`** (@RequirePage change_plan_start): sposta
  l'inizio dell'abbonamento mostrato in scheda (attivo > in attesa > più recente), **ricalcola
  la fine** dalla durata del piano e **allinea la base dei menu** (profile.planStartDate), in
  transazione. Audit `client.plan_start.change` con prima/dopo.

## Aggiunta — fix: "Inizio piano" mostrava la data di attivazione, non quella scelta
Caso reale di Simone: scheda con "Inizio piano 17/07" ma menu dal 20/07. Esistono due date:
`subscription.startDate` (attivazione = approvazione pagamento) e `profile.planStartDate`
(data di inizio SCELTA dalla cliente nell'onboarding, che guida i menu). La riga in Acquisti
mostrava la prima. Fix su due livelli:
- **Scheda**: "Inizio piano" ora è la data SCELTA (planStartDate); se l'attivazione è avvenuta
  in un giorno diverso compare accanto "· attivato il gg/mm" con tooltip. La matita parte
  dalla data scelta e (come già faceva) allinea TUTTO: inizio abbonamento, fine ricalcolata e
  base menu.
- **Alla radice (commerce, attivazione pagamento)**: se la cliente ha scelto un inizio nel
  FUTURO (max 60 giorni), l'abbonamento parte da quella data (e la scadenza di conseguenza),
  non dal giorno dell'approvazione. Le clienti esistenti disallineate si sistemano con la
  matita (un colpo solo).
