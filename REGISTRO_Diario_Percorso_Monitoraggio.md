# Registro modifiche — Diario del percorso in app + livello Monitoraggio

**Data:** 18 luglio 2026 · Base: origin/main 0fdd88e (modello Antonio `MetaboleAI_Diario_Percorso.html` + `progetto/Spec_Monitoraggio.md`).

## Summary
Due lavori. 1) Il **report in app** (mensile e di fine piano) è allineato al nuovo modello
"Diario del Percorso" di Antonio: timeline del percorso con Gaia, numeri del mese, "Gaia
consiglia" (aderenza/acqua/passi), grafico a tappe verso l'obiettivo con stima di arrivo, e le
**tre strade** a fine percorso (Rinnova / Mantenimento €29 / Monitoraggio gratis). Anche il PDF
"Report mensile" in Grafica PDF è ridisegnato nello stesso stile. 2) Implementato il livello
**Monitoraggio** come da spec: gratuito, max 1 mese, Gaia chiede le misure e se il peso sale di
+3 kg propone gli **8 menu di rientro a €29** presi dallo storico personale; se non paga il
profilo si **congela** (mai cancellato); il rientro pagato fa ripartire un altro mese gratis.

## Description

### Report / Diario (allineamento al modello)
- **plan-report.service**: il dato del report si arricchisce (retro-compatibile, i report
  vecchi restano leggibili) con: `journey` (8 giorni di prova + un tratto per mese: calo,
  peso di fine tratto, eventi gestiti, piatti valutati), `habits` (media reale acqua in litri
  con obiettivo ~30 ml/kg, media passi con obiettivo 8.000), `milestones` (peso a ogni tappa
  per il grafico), `etaLabel` (stima "entro <mese anno>" al ritmo attuale), `maintenance`
  (piano mantenimento a catalogo) e `monitoring` (prezzo menu di rientro).
- **app/Report.tsx**: ristrutturato sul Diario — hero "Il tuo mese con Gaia", timeline
  "Il tuo percorso con Gaia" (badge 8g/M1/M2…, chip "Gestito: …"), stat Peso/Vita/Dall'inizio,
  card "Gaia consiglia" (🍽️ aderenza, 💧 acqua, 👟 passi con i testi del modello), grafico
  "I tuoi passi verso l'obiettivo" multi-tappa con proiezione, goalbox obiettivo + stima,
  e a fine percorso le tre strade: **Rinnova** (consigliato, col codice personale),
  **Mantenimento €29/mese** (va al checkout col piano), **Monitoraggio gratis** (lo attiva
  subito da lì). Restano: tre mosse, coach reale, pannello onestà della prova, storico report.
- **pdf.defaults (monthly_report)**: template ridisegnato con la palette e la struttura del
  Diario (hero, stat con chip ▼, goalbox sfumato, pannello "Gaia consiglia").
  **Dopo il deploy: Grafica PDF → Report mensile → "Ripristina"** per adottare la nuova grafica
  (il seed non sovrascrive mai un template salvato).

### Monitoraggio (spec `progetto/Spec_Monitoraggio.md`)
- **schema + migration `20260719150000_monitoring`**: tabella `monitoring_period` (stato
  active/frozen/expired/converted, scadenza, peso di riferimento, offerta rientro, congelamento)
  e colonna `hidden` su `plan` (piani nascosti dallo shop ma acquistabili con link diretto).
- **seed**: piano nascosto **"Menu di rientro (8 giorni)" €29** (create-only: prezzo poi
  modificabile dal Negozio) + parametri `monitoring_regain_kg` (3), `monitoring_duration_days`
  (30), `monitoring_offer_days` (7), `monitoring_measure_ask_days` (3) — tutti regolabili da
  Parametri.
- **monitoring.service** (nuovo modulo):
  - `start`: attivabile solo senza piani attivi e con almeno una pesata; riferimento = ultimo
    peso; notifica di benvenuto; evento `monitoraggio_started`.
  - `dailyTick` (agganciato al cron giornaliero): scadenza mese → `monitoraggio_scaduto` +
    notifica con le tre strade; peso ≥ riferimento+soglia → offerta kit di rientro (notifica
    supportiva "il tuo kit di rientro è pronto", evento `monitoraggio_rientro_offerto`);
    offerta ignorata oltre la finestra → **congelato** (`monitoraggio_rifiutato_congelato`,
    notifica "il tuo profilo resta al sicuro", storico intatto); nessuna pesata da 3 giorni →
    "Ci pesiamo? ⚖️".
  - `onPlanActivated` (hook nel flusso di approvazione pagamenti): **rientro pagato** → genera
    gli 8 menu migliori e fa ripartire un nuovo mese gratis (`monitoraggio_rientro_pagato`);
    altro piano a pagamento → `monitoraggio_converted` (dimagrimento o mantenimento).
  - **Selezione 8 menu di rientro**: prima i giorni dei cicli col calo migliore
    (cycle_feedback, il learning del motore), poi i delta misure attorno ai singoli giorni di
    menu, poi i più recenti; ricreati nei prossimi 8 giorni (visibili da subito).
- **Endpoints cliente**: `GET /me/monitoring` (stato: giorni rimasti, peso riferimento, delta,
  piano rientro) e `POST /me/monitoring/start`.
- **app/Percorso.tsx**: card "Monitoraggio attivo 🛡️" (giorni rimasti, delta peso; se
  l'offerta è scattata, box kit di rientro col bottone che mette il piano €29 nel carrello) e
  card "Attiva il Monitoraggio · gratis" quando è idonea (fine percorso senza piano attivo;
  vale anche come RIattivazione dopo scadenza/congelamento — riaggancio caldo dallo storico).
- **Shop**: i piani `hidden` non compaiono in negozio (checkout diretto ok).

## Note
- **Serve la migration** (preDeploy la applica): CREATE TABLE + ADD COLUMN, dati esistenti intatti.
- Punto aperto della spec "il rientro pagato fa ripartire un mese gratis?" → implementata la
  proposta di Antonio: **sì** (loop pulito). Si può spegnere in seguito se decidete diversamente.
- Il congelamento NON tocca i dati (a differenza del purge prova): solo stop a sorveglianza e
  promemoria.

## Aggiunta — prodotti in negozio: Mantenimento e Monitoraggio
- **seed (seedMaintenancePlan)**: nuovo piano **"Mantenimento Metabole" €29/mese**
  (period `maintenance`, visibile nello shop, create-only: prezzo e testi poi modificabili
  dal Negozio). Rinnovo mensile manuale (niente addebito automatico finché non si decide
  su Stripe).
- **commerce (subscriptionEnd)**: i piani `maintenance` ora durano **1 mese** (prima la
  durata cadeva sul default di 3 mesi: il periodo 'maintenance' non era riconosciuto).
- **app/Negozio.tsx**: il Mantenimento compare tra i piani con bordo/etichetta "Una pausa
  che tiene il peso" e periodo "mensile · disdici quando vuoi"; il badge **"Più scelto"**
  ora va sul primo PERCORSO (prima sarebbe finito sul mantenimento, il più economico).
  Nuova card **"Monitoraggio · Gratis 1 mese"**: essendo gratuito non passa dal carrello,
  si attiva col bottone (visibile solo quando la cliente è idonea o l'ha già attivo, con
  giorni rimasti). Il "Menu di rientro (8 giorni)" resta nascosto: lo propone Gaia.

## Aggiunta — allineamento al restyling del socio (18/07, commit 7e2328f)
Il modello Diario aggiornato ha **5 card risultato con icone** (⚖️ Peso · 📏 Vita · ✨ Fianchi ·
✅ Aderenza · 🎯 Dall'inizio in evidenza scura): Report.tsx allineato (griglia 2 colonne, la
card "Dall'inizio" a tutta larghezza su fondo teal). Il resto del restyling è solo grafica dei
PDF marketing: timeline, "Gaia consiglia" e le tre strade combaciano già coi testi in app.
Verificato anche `e005762` (misure → menu subito): l'erogazione resta legata all'abbonamento
ATTIVO (chi è in Monitoraggio non riceve menu, come da spec) e il controllo "c'è già un menu
futuro" protegge gli 8 menu di rientro dalla rigenerazione del motore.

## Aggiunta — mini-grafici acqua e passi in "Gaia consiglia"
Nel modello del socio acqua e passi sono solo testo; su richiesta di Simone l'app li mostra
anche come **grafici a barre giornalieri** sotto i rispettivi consigli: una barra per giorno del
periodo (acqua in litri, blu; passi in verde), linea tratteggiata dell'obiettivo, barre piene
quando l'obiettivo è raggiunto. Dati: `habits.waterSeries`/`stepsSeries` nel report (max 31
giorni; i report già generati non le hanno e non mostrano i grafici).

## Aggiunta — acqua e passi anche nel PDF (Grafica PDF → Report mensile)
- **reports.service**: il report mensile inviato dallo staff ora calcola anche le abitudini
  (media acqua L/giorno con obiettivo ~30 ml/kg, media passi con obiettivo 8.000, serie
  giornaliere max 31 giorni) e passa al template i nuovi segnaposto `waterAvg`, `waterGoal`,
  `waterBars`, `stepsAvg`, `stepsGoal`, `stepsBars` (i *Bars sono frammenti HTML: barre
  giornaliere con linea obiettivo tratteggiata, piene a obiettivo raggiunto — come in app).
  Anche il PDF di ripiego (PDFkit) elenca le due medie.
- **pdf.defaults (monthly_report)**: nel pannello "Gaia consiglia" due righe 💧 Acqua e
  👟 Passi con i mini-grafici; anteprima dell'editor con dati d'esempio.
  → Ricorda: dopo il deploy, **Grafica PDF → Report mensile → Ripristina** (vale per tutto
  il restyle Diario, questo incluso).

## Aggiunta — collaudo: giro monitoraggio forzabile dall'admin
Nuovo `POST /admin/monitoring/tick` (solo admin, con audit `monitoring.tick.manual`): esegue
subito il giro giornaliero del monitoraggio (scadenze, trigger di rientro, congelamenti,
richieste misure) senza aspettare il cron — per collaudare il flusso o sbloccare una
situazione al volo. Stessa logica del cron, nessun doppio effetto (le condizioni sono
idempotenti: offerte già fatte e promemoria recenti non si ripetono).
