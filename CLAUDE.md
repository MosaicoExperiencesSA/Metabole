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

Documento di riferimento: `Metabole_Specifica_Backend_Sviluppatore.md` (modello dati, API, motore, roadmap a milestone).
Backend: vedi `backend/README.md` per sviluppo locale e deploy.
