# Registro — Ricette semplici / cucina italiana (alternative da alternare)

**Data:** 30 luglio 2026 · Base: main.

## Obiettivo
Alcune clienti trovano le ricette troppo complesse. Ora possiamo marcare ricette come
**semplici** (cucina italiana) e proporle, **a chi lo sceglie in app**, alternandole a quelle
del piano. Più ricette semplici carichiamo, più varietà avranno.

## Cosa è stato fatto

### 1) Dato: difficoltà ricetta + preferenza cliente
- `Recipe.difficulty` (`semplice | media | elaborata`, default **media** → ricette attuali invariate).
- `ClientProfile.prefersSimpleRecipes` (bool, default false) — la cliente lo attiva dall'app.
- Migration: `prisma/migrations/20260730120000_recipe_difficulty_simple_pref/` (2 ALTER TABLE).
  **Si applica da sola al deploy** (Render `preDeployCommand` → `prisma migrate deploy`).

### 2) Backend — selezione menu (menu.service.ts)
Quando la cliente ha `prefersSimpleRecipes`, prima del controllo sicurezza il generatore:
- costruisce il pool di ricette **attive** con `difficulty='semplice'** dello **stesso regime**,
  filtrandole sulle **esclusioni** (allergie + intolleranze + cibi non graditi, espanse per
  categoria: es. "legumi" → ceci/lenticchie…);
- per ogni pasto, se c'è un'alternativa semplice **entro la tolleranza kcal** del piatto, la
  sceglie **ruotando per giorno** → i piatti semplici si alternano tra loro e, quando il pool è
  piccolo, con quelli esistenti.
- La **sicurezza resta garantita**: `evaluateMeals` gira comunque dopo (intolleranze bloccanti).
- Nota: la preferenza vale per i **menu dei prossimi giorni** (quelli già erogati non cambiano).

### 3) Backoffice (Ricette.tsx)
- Nuovo menu a tendina **Difficoltà** e checkbox **Cucina italiana** nell'editor ricetta.
- Nuova colonna **Difficoltà** in elenco (chip verde = semplice). L'elenco mostra già anche le
  ricette archiviate (`includeInactive`), quindi le bozze si trovano e si attivano da qui.

### 4) App (Profilo.tsx)
- Nuova sezione **Ricette** → toggle **"Preferisco ricette semplici"** (salva su
  `PATCH /me/client-profile`).

### 5) Set iniziale di ricette (BOZZA da approvare)
- `prisma/data/simple_italian_catalog.json`: ~36 ricette semplici italiane (colazione, spuntini,
  pranzo, cena; regimi onnivoro/vegetariano/vegano).
- `prisma/seed_simple_italian.ts` (script `seed:simple-italian`): le crea **`active=false`** e
  **`allergensReviewed=false`** → **non entrano nei menu** finché la coach non le **rivede e
  attiva** dal backoffice. Idempotente (salta quelle già presenti).
- ⚠ **kcal, macro e allergeni sono stime**: vanno confermati dalla nutrizionista prima di attivare.

## Come si mette in produzione
1. **Push** da GitHub Desktop → Render applica la migration in automatico e Vercel aggiorna
   web app e backoffice.
2. Sulla **Shell di Render** (backend), carica le ricette bozza:
   ```
   npm run seed:simple-italian              # DRY-RUN
   npm run seed:simple-italian -- --apply   # crea le ricette (active=false)
   ```
3. In **backoffice → Ricette**: rivedi le ricette "Archiviate" con chip *Semplice*, correggi
   kcal/macro/allergeni se serve, poi mettile **Attive**.
4. La cliente attiva **Profilo → Ricette → "Preferisco ricette semplici"**: dai menu dei giorni
   successivi vedrà i piatti semplici alternati.

## Verifica
- Backend: transpile OK dei file toccati; NUL check OK; JSON validi. (`prisma validate` non
  eseguibile in sandbox: engine non scaricabile — le modifiche sono `ADD COLUMN` standard.)
- Backoffice: `tsc --noEmit` OK, `npm run build` OK.
- App: `tsc --noEmit` OK, `npm run build` OK.

## App installata (iOS/Android)
Il toggle è frontend dell'app: per vederlo su iOS/Android installati serve l'aggiornamento del
bundle (OTA Capgo) come per gli altri fix — è compito dell'agente app. Web app e backoffice sono
subito aggiornati al deploy.

## Estensioni possibili (non fatte ora)
- Applicazione immediata: rigenerare i menu futuri appena la cliente attiva il toggle (oggi si
  applica dai prossimi giorni).
- Filtro "solo semplici" e badge "Semplice" sulla scheda ricetta in app.
