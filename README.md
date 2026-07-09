# Metabole

Web app di dimagrimento "stile di vita": percorso continuativo in cui un **motore intelligente** adatta il menu giorno per giorno, supportato da **coach** e **nutrizionista**. Questo repository raccoglie il prototipo cliccabile, i documenti strategici e la specifica tecnica per lo sviluppo del backend.

## Contenuto

**Specifica per lo sviluppo**
- `Metabole_Specifica_Backend_Sviluppatore.md` — specifica tecnica del backend (architettura, stack, modello dati, API, motore, compliance, roadmap). Punto di partenza per lo sviluppatore.
- `CLAUDE.md` — contesto per lo sviluppo con Claude Code.

**Prototipo cliccabile** (aprire gli `.html` nel browser)
- `Metabole_Prototipo_Navigabile.html` — flusso completo end-to-end (attivazione → app).
- `Metabole_Flusso_Attivazione.html` — solo il flusso di attivazione.
- `Metabole_Sondaggio_Iniziale.html` — il questionario iniziale.

**Documenti strategici**
- `Metabole_Piano_Prodotto_Business.docx` — piano prodotto + business.
- `Metabole_Motore_Intelligente.docx` — il motore intelligente (v2).
- `Metabole_Specifica_Prodotto.docx` — specifica funzionale.
- `Metabole_Modello_Economico.xlsx` — modello economico con scenari.

## Per lo sviluppatore backend

Il backend è **API-first** (REST/JSON). Il prototipo mostra schermate e flussi; la specifica definisce dati e contratti. Partire da `Metabole_Specifica_Backend_Sviluppatore.md` e sviluppare per domini seguendo la roadmap a milestone.

## Nota

Le parti su normativa, dati sanitari (GDPR) e prima visita in presenza sono un orientamento e vanno confermate con il legale/consulente privacy.
