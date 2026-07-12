# MetaboleAI — Blueprint dell'app (post-registrazione)

Documento unico per costruire le schermate dell'app dopo la registrazione. Definisce il
**design system** (look premium, sfondo bianco, box flottanti, icone di qualità) e il **contenuto
di ogni schermata**, secondo la struttura decisa con Antonio.

---

## 1. Design system (il "premium look")

**Principio:** niente effetto cartone. Superfici bianche, poche ombre ma morbide, molto spazio,
gerarchia tipografica chiara, icone lineari coerenti. L'accento è il **colore personalizzabile**
scelto dall'utente (`--brand`), usato con parsimonia.

- **Sfondo app:** bianco puro `#FFFFFF` (oggi è beige — si cambia solo per le schermate app, non per
  l'onboarding, salvo diversa indicazione).
- **Superfici / box flottanti:** bianco su bianco separato dall'**ombra**, non dal colore.
  Card: `border-radius 18–20px`, `box-shadow 0 6px 20px rgba(16,48,42,.06)`, bordo `1px #EEF2F0`.
- **Testo:** titolo `#101826`, corpo `#3A4A46`, secondario `#8A938F`.
- **Accento:** `--brand` per icone attive, valori chiave, grafici, stato "in rotta". Mai come sfondo
  di intere schermate.
- **Tipografia:** un solo font di sistema, 3 pesi (400/600/700). Scala: H1 20–22, sezione 13 semibold
  maiuscoletto, corpo 13–14, caption 11.
- **Icone:** set lineare di alta qualità (Tabler/Lucide), tratto uniforme ~1.75px, dimensione coerente
  (20–22 nelle liste, 26 nella nav). Icone piene solo per lo stato "attivo" nella nav.
- **Spaziatura:** griglia a 4px; padding schermata 16px; gap tra card 10–12px.
- **Micro-interazioni:** ombre e scale leggere al tocco (non rimbalzi cartoon); transizioni 150–200ms.
- **Grafici:** linee sottili, area sfumata tenue del colore `--brand`, punti solo sui dati chiave.

---

## 2. Header (sempre visibile in alto)

A sinistra il saluto/logo compatto; a destra tre elementi:

- **Notifiche** (campanella): tutto ciò che è utile sapere (menu sbloccato, messaggio della coach,
  visita in arrivo, nuova offerta). Badge numerico.
- **Allert** (icona a scudo/esclamativo, colore d'attenzione): **le cose non fatte** — check-in
  saltato, misure non aggiornate, menu non valutato, acqua sotto obiettivo. È la lista "azioni da
  completare", separata dalle notifiche informative.
- **Profilo** (avatar): apre la pagina profilo con **cambio email, telefono e colore app**, più
  logout e impostazioni.

---

## 3. Barra di navigazione (in basso, 5 voci)

`Home · Percorso · Obiettivi · Contatti · Shop`
Icona lineare + etichetta; voce attiva in `--brand` (icona piena), le altre neutre.

---

## 4. Le schermate

### 4.1 Home — riepilogo
Colpo d'occhio della giornata. In ordine:
- Saluto + stato sintetico ("Sei in rotta", giorno X del percorso).
- **Menu di oggi** (card compatta con i pasti; tocca → dettaglio nel Percorso).
- **Anelli/indicatori del giorno:** calorie, acqua, passi, check-in (con l'azione rapida).
- **Prossimo obiettivo** in breve (mini-grafico peso + delta).
- **Da fare oggi** (2–3 voci prese dagli allert) con azione.
- **Un tocco della coach/Gaia:** messaggio del giorno / promemoria.

### 4.2 Percorso — il diario del percorso (passato ↔ futuro)
Una **timeline scorrevole** centrata su "oggi".
- **Rullino orizzontale dei giorni** (passati → oggi → futuri). Ogni giorno è una card con
  miniatura del menu.
- **Toccando un giorno passato:** i pasti di quel giorno, le **ricette consigliate**, la
  **valutazione del menu** (gradimento a stelle) e la **variazione di peso** registrata
  (−/+ rispetto al giorno prima o alla settimana).
- **Verso il futuro:** gli **eventi da gestire** inseriti dall'utente/agenda ("tra 15 gg matrimonio",
  "tra 45 gg ferie") con la strategia associata ("gestiamo così").
- Filtro rapido: solo menu / solo eventi.

### 4.3 Obiettivi — progresso e traguardi
- **Grafico con storico** a 3 metriche selezionabili: **peso**, **vita (cm)**, **fianchi (cm)**.
  Linea del valore reale + linea/tacca dell'obiettivo.
- Card riassuntive: valore attuale, obiettivo, quanto manca, trend.
- **Obiettivo di registrazione** visibile, con pulsante **"Modifica obiettivo"** / **"Fissa un
  nuovo obiettivo"** (peso/misure + entro quando, con guardrail di sostenibilità).
- Storico dei traguardi raggiunti (badge).

### 4.4 Contatti — AI, Coach, Nutrizionista
Il centro relazioni. Tre interlocutori:
- **Gaia (AI):** sempre disponibile, risponde subito, guida quotidiana.
- **Coach (Sara):** motivazione, aderenza, messaggi; foto/stato "online".
- **Nutrizionista (dott.ssa Marini):** piano e salute; area riservata per i dati sanitari.
Struttura: elenco dei tre con ultimo messaggio + accesso alla **chat dedicata** di ciascuno.
*(Nota: la struttura esatta — 3 chat separate vs hub — verrà rifinita in fase di build.)*

### 4.5 Shop — piani e offerte
- **Piano attivo** con stato e **scadenza** ("il tuo piano scade tra 22 giorni") + rinnovo.
- **Piani/acquisti passati** (storico ordini, ricevute).
- **Offerte nuove** (upgrade, prodotti, integratori) — card promozionali sobrie.

---

## 5. Pagine dell'header (dettaglio)

- **Profilo:** dati account (nome), **email**, **telefono**, **colore app** (gli swatch del tema),
  gestione abbonamento (link allo Shop), privacy/consensi, logout.
- **Notifiche:** feed cronologico di eventi informativi, con "segna come letto".
- **Allert:** lista delle **azioni non completate** con pulsante per farle subito (aggiorna misure,
  valuta il menu, fai il check-in, bevi/registra acqua).

---

## 6. Note per il backend (mappatura veloce)
- Percorso → `MenuDay` (storico, gradimento via `RecipeRating`), `Measurement` (peso per delta),
  `CalendarEvent` (eventi futuri + strategia).
- Obiettivi → `Goal` (peso/vita/fianchi, target + data, versioni: quello iniziale e i nuovi).
- Contatti → thread di chat per `assigned_coach_id`, `assigned_nutritionist_id`, assistente AI.
- Shop → `Purchase`/`Subscription` (stato, scadenza), `Offer`.
- Allert → job/regole che generano "azioni dovute" (check-in, misure, valutazioni).

---

## 7. Come procediamo (build)
Suggerisco quest'ordine, una schermata alla volta con verifica:
1. **Design system** (sfondo bianco app, card flottanti, icone, nav e header nuovi).
2. **Home** (riepilogo).
3. **Percorso** (rullino + dettaglio giorno + eventi).
4. **Obiettivi** (grafico + cambio obiettivo).
5. **Contatti** (i tre interlocutori).
6. **Shop** + pagine header (profilo, notifiche, allert).
