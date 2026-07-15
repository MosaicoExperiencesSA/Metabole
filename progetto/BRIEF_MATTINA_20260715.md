# Brief del mattino — preparato mentre dormivi (15 lug)

## 1) SITO — FATTO ✅
`Metabole_Sito_Presentazione.html` (sul Mac, cartella Metabole) è stato migliorato:
- Aggiunto blocco **SEO/social**: canonical, robots, theme-color, Open Graph (og:*), Twitter Card, **JSON-LD Organization** (validato).
- **Lazy-load** (`loading="lazy" decoding="async"`) su 12 immagini che ne erano prive (la hero resta "eager" per non penalizzare l'LCP).
- HTML verificato integro, description unica, JSON-LD valido.
> Da fare tu: **ricaricare il file su SiteGround** (il sito non si aggiorna da git, è upload manuale).
> Nota: l'og:image e diverse foto usano ancora Unsplash/placeholder — se vuoi, in giornata le sostituiamo con immagini vere.

## 2) TASTO "GENERA CATALOGO" + ANTEPRIMA MODELLI EMAIL — NON è codice mancante, è DEPLOY ⚠️
Ho verificato: il commit **`a51cbaa`** ("Regole motore: generatore AI di catalogo + anteprima modelli email") **è già su GitHub (origin/main)** e contiene:
- il tasto **"Genera catalogo"** in `RegoleMotore.tsx` (righe 46, 101, 262);
- l'**anteprima** in `ModelliEmail.tsx` (iframe/srcDoc, 3 riscontri).

Quindi il codice c'è ed è pushato. Il backoffice **live** (`backoffice.metabole.eu`, Vercel) sta ancora servendo una **build vecchia** (lo screenshot mostrava il layout Applica/matita/cestino, cioè quello *prima* del tasto Genera).

**Cosa fare (tu, 2 minuti):**
1. Vai su **Vercel → progetto `metabole-backoffice` → Deployments**.
2. Guarda se esiste un deploy per il commit `a51cbaa`:
   - **Build fallita** → aprila, copiami l'errore: lo sistemo subito.
   - **Build OK** → è solo cache del browser: fai **hard refresh** (Cmd+Shift+R) o apri in incognito.
   - **Nessun deploy per a51cbaa** → clicca **Redeploy** sull'ultimo commit (o controlla che l'integrazione Git sia attiva).
Appena il backoffice si aggiorna, **Genera catalogo** e l'**anteprima mail** compaiono insieme.

## 3) PERMESSO ADMIN sulle regole motore — da committare
Ho lasciato modificato sul Mac `backend/src/permissions/pages.ts`: ora **admin** ha `engine_rules: { view: true, manage: true }` (riga 156).
- Da fare tu: **commit + push** (fa ripartire Render/backend).
- ⚠️ `syncDefaults` crea le righe mancanti ma **non aggiorna quelle già esistenti**: se admin non vede i pulsanti, vai in **Permessi (UI)** e attiva a mano *admin → regole motore → gestisci*.

Summary/Description per il commit:
- **Summary:** `Permessi: admin gestisce le regole del motore`
- **Description:** `pages.ts: engine_rules passa a { view, manage } anche per admin, oltre al capo nutrizionista. Per le righe già esistenti nel DB serve attivare il flag dalla UI Permessi.`

## 4) Pulizia minore
Ho spostato un `index.lock` git rimasto bloccato (avrebbe impedito i commit da GitHub Desktop) nella cartella **`_to_delete/`**: puoi eliminarla quando vuoi.

## Riepilogo modifiche in sospeso sul Mac (git status)
- `M Metabole_Sito_Presentazione.html`  → upload su SiteGround (commit facoltativo)
- `M backend/src/permissions/pages.ts`   → commit + push (punto 3)
- `?? _to_delete/`                        → cancellabile
