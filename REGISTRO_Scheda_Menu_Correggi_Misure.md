# Registro modifiche — Scheda cliente: menu con stelline + correzione misure (con permesso)

**Data:** 18 luglio 2026 · Base: origin/main 5d556ef.

## Summary
Due aggiunte alla scheda cliente del backoffice. 1) Cliccando sul **piano** (chip in alto nella
sezione Acquisti) si apre il popup **"Menu del cliente"**: i giorni di menu delle ultime 8
settimane (+ prossimi 7 giorni) con i piatti e le **stelline** date dal cliente, così il
nutrizionista può controllarli. 2) Chi ha il nuovo permesso **"Correggi misure cliente"** può
correggere le pesate inserite male dal cliente (matita sulla riga), con audit prima/dopo.

## Description

Backend
- **clients.service.getMenus** + `GET /admin/clients/:id/menus`: giorni di `menu_day` (ultime 8
  settimane + 7 giorni futuri) con dieta, livello e piatti; per ogni piatto la valutazione del
  cliente (`recipe_rating`): stelline del **giorno esatto** se esistono, altrimenti l'**ultima**
  data alla stessa ricetta (contrassegnata `ratedSameDay:false` + data). Accesso con la stessa
  regola della scheda (assertClientAccess: coach/nutrizionista solo i propri assegnati). Audit
  `client.menus.view`.
- **clients.service.updateMeasurement** + `PATCH /admin/clients/:id/measurements/:measurementId`
  protetto da **@RequirePage('fix_measures','manage')**: corregge peso (25–400 kg) e
  circonferenze vita/fianchi/cosce (20–300 cm, `null` = svuota). Audit
  `client.measurement.fix` con **prima/dopo** e data della pesata.
- **permissions/pages.ts**: nuova pagina `fix_measures` nella matrice Permessi. Default ON
  (vede+gestisce) per **nutrizionista, capo nutrizionista e admin**; tutti gli altri OFF —
  Simone la abilita/disabilita dai Permessi a chi serve.

Backoffice
- **ClientDetail.tsx**:
  - il chip del piano in "Acquisti" è cliccabile → popup "Menu del cliente": per ogni giorno
    data, dieta, livello e piatti (slot, nome, kcal) con le stelline ★ del cliente; se la
    valutazione è di un altro giorno, accanto compare la data tra parentesi; "non valutato"
    altrimenti.
  - sezione "Pesate": con permesso `fix_measures` (manage) appare la matita per riga → popup
    "Correggi misura" (peso/vita/fianchi/cosce, virgola accettata, campo vuoto = rimuove il
    dato) con nota che la correzione resta nel log.
- **labels.ts**: etichetta "Correggi misure cliente" per la riga nei Permessi.

## Note
- Nessuna migration. Al deploy il seed permessi crea la riga `fix_measures` con i default; come
  sempre, i permessi già personalizzati a mano non vengono toccati.
- La coach di default NON ha il permesso: si può dare dai Permessi (vede+gestisce) se serve.

## Aggiunta — chip abbonamento in "Acquisti" (fix)
Il chip mostrava l'abbonamento **più recente per data di creazione**, qualunque fosse lo stato:
un checkout "Percorso 1 mese" creato e poi annullato copriva la Prova gratuita ATTIVA.
Ora la scheda mostra: **attivo** → altrimenti **in attesa** → altrimenti il più recente
(clients.service.getDetail: findMany + scelta, al posto del findFirst per createdAt).
