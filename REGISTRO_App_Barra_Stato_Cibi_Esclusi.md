# Registro modifiche — App cliente: barra di stato colorata + refresh menu su cibi esclusi

**Data:** 22 luglio 2026 · Base: origin/main f6d7461.

## Summary
Due migliorie all'app cliente chieste da Simone:
1. **Barra di stato del telefono** (ora/batteria in alto) ora prende lo **stesso colore dell'app**
   (il colore "brand" scelto dall'utente), con icone chiare — prima era grigia di sistema.
2. **Cibi esclusi**: aggiungendo un cibo da escludere dal Profilo, i **menu si aggiornano da soli**
   subito (oggi + prossimi giorni), senza dover uscire e rientrare dall'app.

## Description
**1) Barra di stato (Capacitor)**
- Aggiunto il plugin **`@capacitor/status-bar`** (`^6.0.3`, compatibile con Capacitor 6).
- `lib/brand.ts` → `applyBrand()` ora, oltre alle variabili CSS `--brand/--brand-dark`:
  - su **app nativa** colora la barra di stato col colore brand (`StatusBar.setBackgroundColor`)
    con icone/testo chiari (`Style.Dark`) e barra non in overlay; no-op sul web, fire-and-forget
    con `try/catch` (se il plugin non c'è o è troppo presto, ignora).
  - aggiorna anche il meta `theme-color` (barra indirizzi del browser / PWA).
- Essendo `applyBrand()` chiamato all'avvio (`main.tsx`) e a ogni cambio colore (`setBrand`), la
  barra segue sempre il colore dell'app, anche quando l'utente lo cambia.

**2) Refresh menu sui cibi esclusi**
- `pages/Profilo.tsx` → sezione **Cibi esclusi**: quando si **aggiunge** un cibo, invece del solo
  salvataggio (`PATCH /me/client-profile`, che non toccava i menu già erogati), ora si chiama
  **`POST /me/menu/substitute` con `forever:true`** — lo stesso endpoint della "cambia cibo" in
  Home. Questo **esclude il cibo per sempre E sostituisce subito** i piatti nei menu di oggi e dei
  prossimi giorni. Messaggio di conferma "«…» escluso: i menu sono stati aggiornati.".
- La **rimozione** di un cibo resta un semplice `PATCH` (togliere un'esclusione non richiede di
  rigenerare i menu). Feedback di stato ("Aggiorno…") sul pulsante.

## Perché così
- La barra di stato nativa non è controllata dal CSS/`theme-color`: su Capacitor serve il plugin
  `@capacitor/status-bar`. Agganciarlo a `applyBrand` fa combaciare barra e header con un solo
  punto di verità (il colore brand), anche quando cambia.
- Per i cibi esclusi, il backend NON rigenera un giorno già erogato (`menuDay.upsert … update:{}`),
  e `PATCH client-profile` rigenera solo su cambio regime/stile/pasti — quindi il menu non
  cambiava. `substituteDisliked(forever:true)` invece aggiunge a `dislikedFoods` **e** applica la
  sostituzione ai giorni visibili: effetto immediato, coerente con la "cambia cibo" già esistente.

## Note e verifica
- **Build APK**: il nuovo plugin richiede, prima di ricompilare, `npm install` e **`npx cap sync
  android`** (così il plugin entra nel progetto nativo). Poi build come al solito. Il cambio dei
  cibi esclusi è puro JS: attivo al prossimo build/deploy dell'app.
- Verifica: `tsc --noEmit` **OK**; `npm run build` (vite) **OK** (il plugin si risolve, chunk web
  separato). Nessuna migration.
