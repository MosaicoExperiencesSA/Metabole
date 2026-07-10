# Metabole — Backoffice

Pannello di gestione per **admin e staff** (React + Vite + TypeScript), collegato alle API Metabole.
Stesso tema grafico del prototipo dell'app cliente (verde acqua Metabole).

## Cosa c'è già

- **Login** staff (email + password), con gestione del limite tentativi.
- **Utenti**: elenco filtrabile per ruolo, creazione di membri dello staff (coach, nutrizionista, capo, commerciale, admin), cambio ruolo, sospensione/riattivazione, e **"Entra come"** (impersonazione) per vedere l'app come una cliente.
- **Permessi**: matrice ruolo × sezione con interruttori *vede / gestisce*, con la protezione anti-lockout dell'admin.
- **Dashboard** di benvenuto con scorciatoie in base al ruolo.
- Menu laterale che mostra solo le sezioni consentite dal ruolo (via `/me/permissions`).
- Le altre sezioni (clienti, CRM, agenda, bonifici, compensi, diete, protocolli, parametri, log) sono già a menu come **segnaposto**: le API backend esistono, l'interfaccia si aggiunge una alla volta.

## Sviluppo locale

Requisiti: Node 18+.

```bash
cd backoffice
cp .env.example .env      # VITE_API_URL: in locale http://localhost:3000, altrimenti l'URL di Render
npm install
npm run dev               # http://localhost:5173
```

Per parlare con il backend locale serve che l'API giri su `http://localhost:3000` (il CORS accetta i localhost in sviluppo).

## Pubblicazione (Vercel)

1. Su [vercel.com](https://vercel.com) → **Add New… → Project** → importa il repo `Metabole`.
2. **Root Directory**: `backoffice`.
3. Framework: **Vite** (rilevato in automatico). Build `npm run build`, output `dist`.
4. **Environment Variables** → `VITE_API_URL = https://metabole-backend.onrender.com`.
5. Deploy. Vercel darà un URL tipo `https://metabole-backoffice.vercel.app`.
6. Su **Render** (servizio backend) → Environment → aggiungi `CORS_ORIGINS` con quell'URL (es. `https://metabole-backoffice.vercel.app`). Da quel momento il backoffice può chiamare le API.

Ad ogni push su `main`, Vercel ripubblica da solo (come fa Render col backend).

## Note tecniche

- Access token JWT in memoria, refresh token in `localStorage`; rinnovo automatico e trasparente al primo 401.
- `vercel.json` riscrive tutte le rotte su `index.html` (single-page app).
- Nessuna chiave o segreto nel frontend: solo l'URL pubblico delle API.
