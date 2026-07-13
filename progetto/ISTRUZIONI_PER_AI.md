# ISTRUZIONI PER AI — progetto Metabole

Regole operative valide per **entrambe le AI** che lavorano al progetto: il team **[Prodotto]**
(prototipi, design, voci di Gaia, specifiche motore/agente AI, analisi, marketing/CRM) e il team
**[Sviluppo]** (backend, frontend, deploy). Questa è la versione estesa; la versione breve da
incollare a inizio chat è in `PROMPT_PER_AI_SOCIO.md`.

La cartella `progetto/` è la **fonte di verità condivisa**. Non è codice: è il "cruscotto" da cui
qualsiasi Aj capisce dove siamo e cosa fare, senza rifare cose già fatte.

---

## 1. A inizio sessione — leggi sempre, in quest'ordine

1. `progetto/ISTRUZIONI_PER_AI.md` (questo file: le regole)
2. `progetto/README.md` (indice di tutte le specifiche e i documenti)
3. `progetto/STATO.md` (stato attuale per area + piano a fasi)
4. `progetto/REGISTRO.md` (diario: le voci in alto sono le più recenti)

Solo dopo aver letto questi quattro file inizia a lavorare. Così parti allineato con l'altro team.

## 2. Dopo ogni modifica — aggiorna il diario (stesso commit)

- Aggiungi **una riga in cima** a `progetto/REGISTRO.md`, formato:

  ```
  AAAA-MM-GG · [Prodotto|Sviluppo] · area — cosa hai cambiato (1-2 righe)
  ```

- Se la modifica cambia lo **stato di un'area**, aggiorna la voce corrispondente in `progetto/STATO.md`.
- Se aggiungi un documento/specifica nuovi, aggiungi la riga nell'indice `progetto/README.md`.
- Marca **sempre** il tuo lavoro con il tag del tuo team: `[Prodotto]` o `[Sviluppo]`.

## 3. Segnala gli impatti sull'altro team

Se una tua modifica ha impatto sull'altro team — es. una nuova schermata che richiede un endpoint,
un campo dati nuovo, un evento da esporre — **scrivilo nel REGISTRO** con la dicitura
`→ impatto [Sviluppo]` (o `→ impatto [Prodotto]`), così viene visto e preso in carico.

## 4. Regole tecniche da rispettare sempre

- **Segreti**: chiavi e connection string **mai** nel repository né in chat. Solo nei pannelli dei
  servizi (Neon, Render, Vercel, Brevo, Stripe, Anthropic, API social). In locale: `.env` git-ignored.
- **Cartella `docs/` PUBBLICA** (GitHub Pages): lì **solo** i prototipi HTML + asset. Documenti
  interni/di business/analisi/marketing restano nella **root** o in `progetto/`, **mai** in `docs/`.
- **Aggiornare la demo pubblica**: copia il prototipo aggiornato in `docs/` e fai commit + push.
- **Dati sanitari**: cifrati, accessibili solo a cliente e suo nutrizionista; **fuori** da ogni uso
  di marketing. Hosting UE (GDPR).
- **Soglie del motore**: in tabella `config_param`, mai hardcodate.

## 5. Tag dei team

- **[Prodotto]** — prototipi HTML (cliente/coach/nutrizionista), design, voci di Gaia, specifiche
  motore e agente AI, catalogo menu, analisi, **marketing/CRM**.
- **[Sviluppo]** — backend NestJS, frontend, database, deploy, integrazioni.

## 6. In sintesi

Leggi `STATO.md` + `REGISTRO.md` per capire dove siamo → fai il tuo lavoro → prima di chiudere
aggiorna quei file (e `README.md` se serve) con quello che hai fatto, marcato col tuo tag. Segnala
sempre gli impatti sull'altro team.
