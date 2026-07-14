# MetaboleAI — Vignette social (archivio + catalogo)

Cartella delle creative social, **catalogata per l'agente Publisher** (pubblicazione automatica sui social).

## Contenuto
- **`catalogo_vignette.json`** — catalogo **machine-readable** (lo legge l'agente): per ogni collezione trovi tema, messaggio, caption, hashtag, canale suggerito, stato, fonte e riferimenti (Canva `design_id` + preview, oppure file PNG).
- **`catalogo_canva.md`** — indice leggibile delle vignette Canva (messaggi, caption, link modifica/anteprima).
- **`app-screens/`** — screenshot **reali** del prototipo (`contatti`, `home`, `obiettivi`, `percorso`, `agenda`).
- **`vignette_app_reali.html`** — galleria vignette con le schermate reali dell'app.
- **`vignette_social_foto.html`** — vignette con foto reali + overlay (stock, da sostituire con scatti nostri).
- **`vignette_social_illustrate.html`** — vignette illustrate SVG (Lotto 1).
- **`_superseded_app_mockup.html`** — vecchia versione ricostruita (superata da `vignette_app_reali`).

## Fonti delle immagini
- **Canva**: cartella archivio → https://www.canva.com/folder/FAHPU5TzSCs. Il Publisher **esporta il PNG dal `design_id`** al momento della pubblicazione (i link di export sono temporanei; il design nella cartella è la fonte durevole).
- **PNG locali**: `app-screens/*.png` (schermate app).

## Come lo usa l'agente Publisher
1. Sceglie la **collezione** in base a segmento/stagione/calendario (campo `canale`, `stagione`, `categoria`).
2. Prende una **variante** (`design_id`) o un `asset` PNG.
3. Se Canva: **esporta PNG** dal `design_id`. Se PNG locale: usa il file.
4. Compone il post con **caption + hashtag** dal catalogo (adattabili per canale).
5. **Giudice obbligatorio** (compliance) → poi pubblica via API (Instagram/Facebook/…).
6. Logga la pubblicazione (`SocialPost`) e misura (Analista).

## Compliance (sempre)
No prima/dopo · no numeri/tempi/garanzie nei visual · no seconda persona su attributi fisici · tono di cura e dignità · 18+. Le offerte economiche stanno nelle **email 1:1**, non nei post. Firme educative generiche ("responsabile scientifico") finché non ci sono i nomi ufficiali; avatar coach/nutrizionista stock da sostituire con volti reali.

## In coda (da generare)
Punti di forza: gusto senza fame, sicurezza clinica, trasparenza. Temi: gravidanza pre/post, sposa. (Vedi `in_coda` nel JSON.)
