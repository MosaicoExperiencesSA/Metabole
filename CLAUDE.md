# Metabole — contesto per Claude Code

Web app di dimagrimento (desktop + mobile). Backend API-first.

Stack suggerito: Node.js + TypeScript + NestJS + PostgreSQL (Prisma). Auth JWT. Hosting UE.

Regole di progetto:
- API-first REST/JSON, versione /api/v1.
- RBAC per ruolo (client, coach, nutritionist, head_nutritionist, sales, admin); dati sanitari accessibili solo a cliente e suo nutrizionista.
- Tutte le soglie del motore in tabella `config_param` (mai hardcodate).
- Dati sanitari cifrati (a riposo e in transito); audit log; hosting UE (GDPR).
- Sviluppare un dominio alla volta con test; migrazioni versionate.

Documento di riferimento: `Metabole_Specifica_Backend_Sviluppatore.md` (modello dati, API, motore, roadmap a milestone).
