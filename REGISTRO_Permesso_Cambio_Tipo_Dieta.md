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
