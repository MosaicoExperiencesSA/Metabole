# Metabole — Stato del progetto

Ultimo aggiornamento: 2026-07-13 · Aggiornare la voce quando qualcosa cambia (e loggare in `REGISTRO.md`).

Legenda: ✅ fatto · 🟡 in corso/parziale · ⬜ da fare

---

## Infrastruttura / Stack
- Stack: **NestJS + TypeScript + PostgreSQL (Prisma 6)**, JWT, hosting UE. ✅
- Database **Neon** (Francoforte), pooled `DATABASE_URL` + direct `DIRECT_DATABASE_URL`. ✅
- Backend **Render** (`backend/`, blueprint `render.yaml`) + cron giornaliero 07:00 CEST. ✅
- Frontend **Vercel**: app cliente (`app/`) e backoffice (`backoffice/`). ✅
- Email **Brevo**, pagamenti **Stripe** (+ webhook), AI **Anthropic/Claude**. ✅
- Demo prototipi via **GitHub Pages** su `docs/` (cartella pubblica). ✅
- Regola: chiavi/segreti solo nei pannelli servizi, mai nel repo né in chat. Dettagli: `../Metabole_Guida_Pubblicazione.pdf`.
- Migrazioni versionate in `backend/prisma/migrations`; il type-check reale gira su Render (client Prisma non generabile in sandbox).

## Backend (NestJS) — moduli presenti
Auth (JWT+refresh rotante, RBAC), Users/Profile, Onboarding, Signals (misure/checkin/acqua/passi/progress),
Catalog (diete/ricette), Menu (erogazione), Engine (motore a regole M5), Notifications, Cron, Chat (+AI),
Clients, Commerce/CRM, Reports, Health/HealthArea, Escalations, Visits, Compensation/Payouts,
Analytics (grafici), Dashboard, Permissions/Roles, Signals/Widget, **Tracking (eventi)**, **Alerts (coda coach)**. ✅
- Ruoli RBAC: client, coach, nutritionist, head_nutritionist, sales, admin. ✅
- Dati sanitari cifrati, accessibili solo a cliente + suo nutrizionista. ✅

## App cliente (React + Vite + Capacitor)
- Onboarding, Home (dati reali), Menu, Obiettivo (grafici), Calendario, Assistente (chat AI),
  Negozio, Profilo, Checkout/Pagamento. ✅
- Tab bar e icone allineate al prototipo. ✅
- Widget home Android (3 formati, mascotte Gaia). ✅
- Tracciamento eventi via `track()` (viste, login, registrazione, logout). ✅
- Popup bloccante misure al 2° giorno del ciclo. ✅
- APK Android generabile da Android Studio (guida in `../docs/APK_Build_Guida.md`). ✅

## App Coach (nuova) 🟡
- Prototipo pronto: `../Metabole_Coach_App.html` (+ web).
- Backend fatto finora: `GET /coach/alerts` + `PUT /alerts/:id` (Alert engine, Fase 3),
  `GET /coach/clients` (lista clienti assegnate con riepilogo), `GET /coach/dashboard`
  (clienti, piani in scadenza, guadagni mese/totale, alert aperti). Dettaglio cliente via `admin/clients/:id`.
- Agenda/appuntamenti: entità `Appointment` + `GET /coach/agenda` (propri gestibili, nutrizionista sola
  lettura), `POST/PATCH /appointments`, `GET /me/agenda` (cliente, con `?next=1` per la Home).
- Chat: base in `staff/threads` (coach) + `me/threads` (cliente). Riassunti conversazioni giornalieri
  (`ConversationSummary`, titolo AI) generati dal cron: `GET /me/threads/:who/summaries` (cliente) e
  `GET /staff/threads/:clientId/:who/summaries` (staff; la coach non vede i riassunti del nutrizionista).
- Home cliente: box "Prossimo appuntamento" (usa `GET /me/agenda?next=1`, tap → Calendario). ✅
- **Backend Fase 4 completo.** Ancora da fare: l'**app front-end coach** (React).

## App Nutrizionista (nuova) ⬜
- Prototipo pronto: `../Metabole_Nutrizionista_App.html`. Da costruire (Fase 7). Unico ruolo con accesso ai dati sanitari.

## Backoffice (React + Vite)
- Dashboard (moduli configurabili/trascinabili, grafici con assi mesi + tooltip), CRM/Lead,
  Acquisti, Calendario/Reminder (tipi telefonata/messaggio/email), Impostazioni. ✅
- Editor: Diete (crea + componi giorni), Ricette, Protocolli (regole motore). ✅
- Matrice permessi ruolo × sezione. ✅

## Motore / AI
- Motore a regole (Engine, M5): protocolli condizioni→azione, decisioni per cliente. ✅ (base)
- Assistente AI (Claude) per chat e instradamento. ✅
- **Motore di personalizzazione dei menu** (catalogo→dieta cliente→giornate→learning): 🟡 (Fase 5).
  - Sicurezza esclusioni (v1): intolleranze/allergie in un piatto → **blocco erogazione + escalation al
    nutrizionista** (la coach la vede via Alert engine); `GET /me/menu` espone `blocked` e l'app mostra
    "stiamo sistemando il tuo piano". Ancora da fare: sostituzione equivalente degli ingredienti,
    giornate bilanciate, cicli con learning (esito peso/cm), MenuWeight.
- **Agente AI della dieta** (stati Conforto/Rientro/Pre-evento/Plateau, scoring): ⬜ (Fase 6).
- **Certificazione unicità** (seed, collision check, registro firmato): ⬜ (Fase 10).

## Marketing / CRM (nuovo, da `../Metabole_Reparto_Marketing_e_Standard_CRM.pdf`) ⬜
- Nuovo ruolo `head_marketing` (+ `marketing`) da aggiungere all'RBAC e alla matrice permessi.
- Sezione backoffice marketing: campagne, segmenti, automazioni, KPI, gestione consensi (no dati sanitari).
- Standard lead/pipeline: stadi (nuovo→contattato→qualificato MQL→opportunità SQL→cliente→a rischio→churn→in rientro);
  campi lead (fonte/canale, campagna+utm, refcod, consensi email/sms/marketing con timestamp+base giuridica, owner).
- SLA marketing↔vendite e regola di recycle (collegato al backlog "assegnazione lead a tempo").

---

## Piano di lavoro a 10 fasi (dai handoff del socio)
Dettaglio in `metabole-piano-lavoro.md` (memoria) e in `../Metabole_Backend_Operazioni.md`.

| Fase | Cosa | Stato |
|---|---|---|
| 0 | Consolidamento: ogni risposta test salvata 1:1; login → role/home_route (4 percorsi) | 🟡 |
| 1 | **Tracciamento eventi** (POST /events + client track()) | ✅ (13/7) |
| 2 | **Misure bloccanti** al 2° giorno del ciclo | ✅ (13/7) |
| 3 | **Alert engine** (coda avvisi coach, tutte le regole) | ✅ (13/7) |
| 4 | App Coach — API (clienti, agenda, dashboard guadagni, chat, appuntamenti, riassunti) | 🟡 clients+dashboard fatti |
| 5 | Motore di personalizzazione menu — v1 "naive" | 🟡 sicurezza esclusioni fatta |
| 6 | Agente AI della dieta (stati, scoring, escalation) | ⬜ |
| 7 | App Nutrizionista (cartella clinica, validazione diete/protocolli, televisite) | ⬜ |
| 8 | Shop / abbonamenti / provvigioni | ⬜ |
| 9 | Certificazione unicità (seed, collision check, registro firmato) | ⬜ |

> Trasversali: privacy/consensi + AuditLog; tutte le soglie in `config_param`; notifiche push (backlog);
> numero versione app (backlog); avatar/menu utente in alto nel backoffice (backlog).
