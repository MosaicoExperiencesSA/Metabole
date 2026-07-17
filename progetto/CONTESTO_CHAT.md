# Contesto rapido — riprendere il lavoro in una nuova chat

**Come si usa:** in una chat nuova scrivi *"leggi progetto/CONTESTO_CHAT.md e riprendiamo"*. Basta questo.

## Chi fa cosa
Prodotto = Antonio (+ AI) · Sviluppo = Simone. Repo: `~/Documents/GitHub/Metabole` (le regole di progetto sono in `CLAUDE.md`, letto in automatico).
Regole fisse: commit sempre con **summary + description**; `git pull --ff-only` prima di committare; mai chiavi/connection string nel repo o in chat; non sovrascrivere il codice di Simone (in caso di conflitto fermarsi e chiedere).

## Prodotto
App di dimagrimento con **motore AI**. 12 regole (`percorsi/METODO_MOTORE_INTELLIGENTE.md`): **R1–R7** costruzione base approvata dal nutrizionista; **R8–R12** agente AI per cliente (esclusioni, partenza unica certificata, ciclo bigiornaliero, adattamento, escalation/RBAC). Erogazione: stesso menu per 2 giorni con 2 cotture diverse. Kcal interne, mai mostrate al cliente.

## Percorsi
- **Keto** — 118 piatti, **approvata**, nel motore (`backend/prisma/data/keto_catalog.json` + seed + test). PDF 28 giorni: `percorsi/keto/Metabole_Keto_Menu.pdf`.
- **Proteica sportiva** — ~1700 kcal, 118 piatti, **da approvare**. `percorsi/proteica/` + `backend/prisma/data/proteica_catalog.json` + PDF 28 giorni.

## Stato lancio (`progetto/STATO_LANCIO.md`)
**VIA LIBERA (16/07):** pagamento reale testato, smoke test end-to-end fatto, igiene pre-apertura fatta. Live: backend, DB Neon, Stripe LIVE, metabole.eu, app.metabole.eu, backoffice, DNS Brevo ok.
Non bloccanti: foto/CV team · testimonianze · revisione madrelingua RU/ZH/AR · grammature + firma nutrizionista sul Keto · tagging 14 allergeni UE.

## Dati reali (da `Clienti Uniti.xlsx` / `Lead Uniti.xlsx`, fuori dal repo)
Clienti paganti **6.745** (su 20.572 record) · incassato storico **€3.771.966** · spesa media **€559** (mediana €390) · lead mai convertiti **94.435**. *(In discussione arrotondati a ~10.000 paganti / ~80.000 lead.)*

## Equipaggio (leadership)
**19 stendardi "Brevetto di bordo"** in `marketing/stendardi/` (nome, ruolo nautico, emblema, frase cucita). Generati con Gemini/Nano Banana allegando lo stendardo di **Simone** come riferimento e cambiando solo nome/ruolo/emblema/frase (prompt: `marketing/vignette_gagliardetto/Metabole_18_Stendardi_NanoBanana.md`).
Meet 10 min: `marketing/vignette_equipaggio/Meet_Scaletta_10min.md` (+ PDF). Metafora: **"La nave è nuova. Ora si salpa."**

## Sito (`Metabole_Sito_Presentazione.html`)
Contatore **"percorsi gestiti"** guidato dai box mostrati · carosello percorsi auto-scroll · galleria app con **5 schermate reali** che ruotano ogni 3s · orbita Gaia con fasci allineati ai 5 operatori + bagliore del contorno centrale all'arrivo. L'endpoint `/public/paths` (catalogo diete) popolerà i box da solo quando avrà dati.

## App
Audio Gaia rigenerati **v02** (`percorso_v02.mp3`, `q_come_vuoi_essere_chiamata_v02.mp3`) con mappa `CLIP_VERSIONS` in `app/src/audio/gaia.ts`.

## Limiti strumenti (importante)
Canva = **quota esaurita**. **ElevenLabs e Nano Banana non sono collegati**: li usa Antonio a mano. Le **immagini incollate in chat non arrivano come file** → vanno salvate nella cartella **`App dimagrimento`** sul Desktop.

## Prossimo passo (in corso)
**Reparto marketing + struttura email/messaggi** (48 email del ciclo di vita già scritte). Offerta: **prova gratuita di 4 menu = 8 giorni**. Obiettivo: rendere profittevole il lancio → funnel prova→pagante, sequenze email/WhatsApp/SMS (i numeri ci sono), retargeting, coach 1:1, stime di fatturato. Presidiare **consenso marketing (GDPR)** e **deliverability** (warm-up dominio).
