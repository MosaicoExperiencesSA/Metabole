# Istruzioni operative per le AI del progetto Metabole

Questo file vale per **qualsiasi AI** lavori al progetto Metabole (sia lato Sviluppo — Simone + Claude
Cowork — sia lato Prodotto — il socio + la sua AI). Serve a lavorare in modo coordinato usando il
diario condiviso in `progetto/`.

## 1. All'inizio di ogni sessione: leggi il contesto
Prima di fare qualsiasi cosa, leggi in quest'ordine:
1. `progetto/README.md` — regole d'uso + indice di tutte le specifiche.
2. `progetto/STATO.md` — stato attuale del progetto per area e piano a 10 fasi.
3. `progetto/REGISTRO.md` — cosa è stato fatto di recente (le voci più in alto sono le più nuove).
4. I documenti di specifica pertinenti alla tua parte (linkati nel README): per il Prodotto soprattutto
   i prototipi HTML, `Metabole_Motore_Personalizzazione.md`, `Metabole_Agente_AI_Dieta.md`,
   `Metabole_Tracciamento_Dati.md`, `Metabole_Reparto_Marketing_e_Standard_CRM.pdf`.

Così parti già allineato e non rifai cose già fatte dall'altro team.

## 2. Dopo ogni modifica: aggiorna il diario (obbligatorio)
Ogni volta che consegni una modifica (codice, prototipo, specifica, voce, analisi…):
- **Aggiungi una riga IN CIMA a `progetto/REGISTRO.md`**, formato:
  `AAAA-MM-GG · [Team] · area — cosa è cambiato (1-2 righe)`
  Usa `[Prodotto]` se sei l'AI del socio, `[Sviluppo]` se sei l'AI lato Simone.
- Se la modifica cambia lo **stato** di un'area (una funzione passa a "fatta", o emerge qualcosa di
  nuovo da fare), **aggiorna la voce corrispondente in `progetto/STATO.md`**.
- Fai questi aggiornamenti **nello stesso commit** della modifica. Non serve che l'umano lo chieda:
  è parte del lavoro.

## 3. Divisione delle aree (chi tocca cosa, di norma)
- **Prodotto (socio + AI)**: prototipi navigabili (HTML), design/UX, voci di Gaia, specifiche del
  motore e dell'agente AI, analisi mercato/marketing, standard CRM.
- **Sviluppo (Simone + Claude Cowork)**: backend (NestJS), app cliente (React/Capacitor), backoffice,
  database, infrastruttura, deploy.
- Quando una modifica di un lato ha impatto sull'altro (es. una nuova schermata del prototipo che
  richiede un endpoint, o un campo dati nuovo), **scrivilo nel REGISTRO** così l'altro team lo vede.

## 4. Regole tecniche da rispettare sempre
- **Chiavi e segreti**: mai nel repository né in chat. Solo nei pannelli dei servizi (Neon, Render,
  Vercel, Brevo, Stripe, Anthropic). In locale un file `.env` git-ignored.
- **`docs/` è PUBBLICA** (GitHub Pages pubblica la demo dei prototipi). In `docs/` vanno SOLO i
  prototipi HTML + asset (audio, icone) e le guide non sensibili. I documenti interni, di business,
  le analisi e i file del motore restano nella **root** o in **`progetto/`** (repo privato), mai in `docs/`.
- **Pubblicare la demo**: dopo aver aggiornato un prototipo nella root, copiarlo in `docs/` e fare
  commit+push (GitHub Pages si rigenera da solo). Vedi `Metabole_Guida_Pubblicazione.pdf`.
- Le decisioni/specifiche non si duplicano in `progetto/`: restano nei loro documenti, il diario le
  collega.

## 5. In una riga
Leggi `progetto/STATO.md` + `progetto/REGISTRO.md` per capire dove siamo, fai il tuo lavoro, e prima di
chiudere aggiorna quei due file con quello che hai fatto, marcandolo `[Prodotto]` o `[Sviluppo]`.
