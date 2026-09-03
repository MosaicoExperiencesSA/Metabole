# Metabole — contesto per Claude Code

Web app di dimagrimento (desktop + mobile). Backend API-first.

Stack deciso (9 luglio 2026): **NestJS + TypeScript + PostgreSQL (Prisma 6)**. Auth JWT. Hosting UE.
- Database: **Neon** (PostgreSQL serverless), region Francoforte
- Backend: **Render** (region Francoforte), blueprint `render.yaml` a root, codice in `backend/`
- Frontend: **Vercel** (dopo il backend) · Email transazionali: **Brevo** · Scheduler: Render Cron Jobs

Regole di progetto:
- API-first REST/JSON, versione /api/v1.
- RBAC per ruolo (client, coach, nutritionist, head_nutritionist, sales, admin); dati sanitari accessibili solo a cliente e suo nutrizionista.
- Tutte le soglie del motore in tabella `config_param` (mai hardcodate).
- Dati sanitari cifrati (a riposo e in transito); audit log; hosting UE (GDPR).
- Sviluppare un dominio alla volta con test; migrazioni versionate.
- Chiavi e connection string mai nel repo né in chat: si inseriscono nei pannelli dei servizi (Render/Neon/Brevo).

⚠️ **Ogni pagina nuova del backoffice ha una chiave di permesso SUA** (Simone, 13/8: «tutte le pagine
che aggiungiamo vanno gestite nei permessi, sempre»). Una voce di menu = una chiave. Riusare la
chiave di un'altra pagina perché «è lo stesso perimetro» lega due cose che si concedono e si tolgono
insieme, e non si può più separarle senza un rilascio. Tre passi, e sono tutti e tre obbligatori:
1. `backend/src/permissions/pages.ts` → `BACKOFFICE_PAGES` + i default di ruolo;
2. `backoffice/src/lib/labels.ts` → l'etichetta (`PAGE_LABEL`), o nella tabella dei permessi
   comparirebbe la chiave grezza;
3. la rotta (`App.tsx`), la voce di menu (`Layout.tsx`) **e la guardia sull'endpoint**
   (`@RequirePage`). ⚠️ La chiave nasce insieme alla guardia che la legge: una chiave dichiarata e
   non letta da nessuno è un interruttore che non accende niente — è già successo con `assignments`.

⛔ **UNA MODIFICA SI VERIFICA RILEGGENDO IL FILE, non fidandosi dell'uscita del comando.** Il 3/9
la chiusura di una voce dei lavori è stata scritta con `cd backend && python3 - <<'EOF' …`: la shell
era **già** in `backend`, il `cd` è fallito, e con `&&` **lo script non è mai partito**. Nessun
errore visibile — subito sotto girava `jest`, che passava sul file non modificato — e la consegna è
uscita con il messaggio di commit e il registro che dicevano «chiusa» e la voce ancora aperta.
⚠️ Il danno non è la riga mancante: è che **il registro comincia a mentire**, ed è la sola cosa che
dice cosa è stato fatto. Perciò: niente `cd X && <modifica>` (si usano percorsi assoluti, o `cd`
separato), e **dopo ogni modifica fatta da uno script si rilegge il pezzo cambiato** — un `grep` sul
risultato, non un `ok` stampato dallo script stesso. Un comando che non gira non stampa niente, e
«niente» somiglia troppo a «tutto bene».

⚠️ **`progetto/COMMIT.txt` si APPENDE, non si sovrascrive.** Il 13/8 è stato riscritto da zero due
volte in un'ora: due sessioni lavorano allo stesso commit, e chi scriveva per secondo cancellava il
messaggio dell'altra. Chi consegna aggiunge la sua parte in coda, sotto un separatore che dice da
quale lavoro viene — e tiene una copia in un file suo (`COMMIT_parte_<argomento>.txt`), così una
terza sovrascrittura non se la porta via. Vale anche per `REGISTRO.md`: si aggiunge in cima, non si
riscrive il file.

Documento di riferimento: `Metabole_Specifica_Backend_Sviluppatore.md` (modello dati, API, motore, roadmap a milestone).
Backend: vedi `backend/README.md` per sviluppo locale e deploy.
