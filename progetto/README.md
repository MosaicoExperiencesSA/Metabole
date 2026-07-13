# Metabole — Diario di progetto (fonte di verità condivisa)

Questa cartella (`progetto/`) è il **punto unico di allineamento** del progetto. Serve a tenere
sincronizzati i due team di lavoro e le loro AI:

- **Team Sviluppo** — Simone + Claude (Cowork): backend (NestJS), app cliente (React/Capacitor),
  backoffice, database, infrastruttura.
- **Team Prodotto** — il socio + la sua AI: prototipi navigabili, design/UX, voci (Gaia),
  specifiche del motore/agente AI, analisi mercato/marketing, CRM.

Regola d'oro: **ogni volta che si fa una modifica, si scrive qui.** Così, aprendo questa cartella,
entrambe le parti (e le due AI) trovano subito lo stato aggiornato per la parte che le riguarda,
senza dover ricostruire il contesto ogni volta.

> ⚠️ **Perché `progetto/` e non `docs/`**: la cartella `docs/` è **pubblica** (viene pubblicata da
> GitHub Pages come demo dei prototipi). I documenti interni — stato, registro, analisi, business —
> NON vanno in `docs/`. Restano nel repository privato ma fuori dalla pubblicazione. Vedi
> `../Metabole_Guida_Pubblicazione.pdf`.

## Cosa contiene

| File | A cosa serve | Chi scrive |
|---|---|---|
| `STATO.md` | Lo **stato attuale** del progetto per area (cosa è fatto, cosa manca). Si **aggiorna** (si sovrascrive la voce) quando qualcosa cambia. | Entrambi i team |
| `REGISTRO.md` | Il **log cronologico** di ogni modifica (data · autore · area · cosa). Si **aggiunge in cima**, non si cancella mai il passato. | Entrambi i team |
| `README.md` | Questo file: regole d'uso + indice dei documenti di specifica. | Entrambi i team |
| `ISTRUZIONI_PER_AI.md` | Istruzioni operative per le AI dei due team (leggere il diario a inizio sessione, aggiornarlo dopo ogni modifica). | Entrambi i team |

## Come si aggiorna (regole semplici)

1. Fai una modifica (codice, prototipo, specifica, voce…).
2. **Aggiungi una riga in cima a `REGISTRO.md`** con: data, autore, area, cosa è cambiato (1-2 righe).
3. Se la modifica cambia lo **stato** di un'area (una funzione passa da "da fare" a "fatta", o si
   scopre qualcosa di nuovo da fare), **aggiorna la voce corrispondente in `STATO.md`**.
4. Autori da usare nel registro: `[Sviluppo]` (Simone + Claude Cowork) oppure `[Prodotto]` (socio + AI).

> Le AI: quando lavorate a una modifica, aggiornate questi due file **nello stesso commit** della
> modifica. Non serve chiedere: fa parte del lavoro.

## Indice dei documenti di specifica (a cui questo diario rimanda)

Non duplichiamo le specifiche qui: restano nei loro documenti (nella **root** del repo), questo diario
le **collega**.

**Specifiche tecniche (backend / dati / motore)**
- `../Metabole_Specifica_Backend_Sviluppatore.md` — modello dati, RBAC, API, roadmap milestone.
- `../Metabole_Backend_Operazioni.md` — cosa costruire lato server per i 3 prototipi (delta + ordine).
- `../Metabole_Tracciamento_Dati.md` — mappa evento→dato→entità→endpoint per ogni click.
- `../Metabole_Motore_Personalizzazione.md` — motore dei menu (catalogo→dieta cliente→giornate→learning).
- `../Metabole_Agente_AI_Dieta.md` — politica di decisione dell'agente (stati, scoring, escalation).
- `../Metabole_Analisi_Tecnica_Motore.md` + `../Metabole_Analisi_Motore_Certificazione.md` — analisi motore e certificazione unicità.
- `../Metabole_Esempio_Agente_Giulia.md` — esempio pratico (6 giorni / 3 cicli).
- `../Metabole_App_Blueprint.md` — blueprint dell'app.
- `../CLAUDE.md` — regole tecniche di progetto (stack, sicurezza, migrazioni).
- `../backend/README.md` — sviluppo locale e deploy del backend.

**Prototipi navigabili (design/UX di riferimento — gli screen si prendono da qui)**
- `../Metabole_Prototipo_Navigabile.html` — app cliente (riferimento definitivo).
- `../Metabole_Coach_App.html`, `../Metabole_Coach_WebApp.html` — app coach.
- `../Metabole_Nutrizionista_App.html` — app nutrizionista.
- `../Metabole_Widget_Mascotte.html` — widget mascotte (3 formati).
- `../Metabole_Sondaggio_Iniziale.html`, `../Metabole_Flusso_Attivazione.html` — onboarding/attivazione.
- `../Metabole_App_Schermate_Nuovo_Cliente.pdf` — sequenza schermate nuovo cliente (**solo per la sequenza**; gli screen reali si prendono dal prototipo navigabile).

**Business, marketing, CRM, analisi**
- `../Metabole_Reparto_Marketing_e_Standard_CRM.pdf` — carta reparto marketing + standard lead/pipeline (stadi, campi, consensi) + ruolo `head_marketing`.
- `../Metabole_Macchina_Marketing_AI.pdf` — macchina di marketing: 8 agenti + il Giudice, motore creativo, compliance/blocchi social, media planning IT.
- `../Metabole_Agente_Contesto_Tempismo.pdf` — agente che legge news/stagioni/life-events: calendario 12 mesi, micro-pubblici a tempo (ISTAT).
- `../Metabole_Libreria_Creativa.pdf` — brand, lessico compliance, 30+ hook, template formati, testi pronti.
- `../Metabole_Specifica_Giudice_Compliance.pdf` — specifica tecnica del Giudice (ruleset social + scoring + audit). → impatto Sviluppo.
- `INTEGRAZIONE_MARKETING.md` — come reparto/agenti marketing entrano nel deploy (ruoli, eventi, endpoint).
- `../Metabole_Analisi_Progetto_Mercato.md`, `../Metabole_Punti_Forza_Marketing.md`,
  `../Metabole_Analisi_Esperienza_Vendita.md`, `../Metabole_Confronto_App_e_Questionario_BitePal.md`.
- `../Metabole_Coach_AI_e_Sondaggio.md`, `../Metabole_Sequenza_Schermate.md`, `../Metabole_Indice_Progetto.md`.

**Guide operative**
- `../Metabole_Guida_Pubblicazione.pdf` — pubblicazione demo (GitHub Pages su `docs/`) + deploy produzione (ordine + variabili d'ambiente).
- `../docs/APK_Build_Guida.md` — build APK Android.
- `../docs/Widget_Nativo_Guida.md` + `../docs/android-widget/` — widget nativo (file + guida).

**Backlog e piano**
- `../metabole-backlog.md` — richieste non urgenti.
- `STATO.md` (qui) — piano a 10 fasi con avanzamento.
