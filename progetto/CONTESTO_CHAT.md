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

## LANCIO E MARKETING — stato al 17/07 (è qui che siamo)

**Prezzi decisi** (sostituiscono €297/€497/€797 a DB):
| Prodotto | Listino | Lancio |
|---|---|---|
| Prova gratuita | — | **€0 · 8 giorni = 4 menu** (senza carta) |
| 1 mese | €130 | **€99** (rinnovabile) |
| 3 mesi | €299 | **€249** (da spingere: =€83/mese) |
| Mantenimento | — | **€29/mese** ricorrente |
| Visita nutrizionista | — | **€50** in app (patologie/emergenze) |

**L'idea guida:** *la settimana gratuita non serve a far provare, serve a far imparare Gaia.* Dopo 8 giorni il motore conosce gusti, esclusioni, ritmi e cosa funziona su quel corpo: **quello** è ciò che il cliente perde se smette. È la leva di conversione (e il differenziatore che nessuno può copiare).

**Documenti già pronti:**
- `progetto/Handoff_Simone_Prezzi_Prova.md` — cosa deve costruire Simone (prezzi a DB, prova 8gg senza carta + misure obbligatorie + **purge profilo a 7 giorni**, codici sconto a scadenza, **report automatico consegnato in app** perché sono dati sanitari, **task/notifiche in dashboard coach**, tracciamento funnel, consensi).
- `marketing/Piano_Operativo_Lancio.md` — segmenti **A (10k ex clienti) → B (lead caldi) → C (freddi)**, sequenze pre-prova / prova G0–G8 / post-prova / fine piano con canale e responsabile, KPI, stime.
- `marketing/report_cliente/MetaboleAI_Report_Cliente.pdf` — report A→B di fine piano (anche fine prova). Da automatizzare.
- `marketing/vignette/Gaia_Impara_Chi_Sei.png` — vignetta per tutor e clienti.
- 48 email del ciclo di vita già scritte: `marketing/Metabole_Email_Ciclo_Vita.md`.

**Momenti chiave del funnel:** **G1** = messaggio personale della coach (decide tutto) · **G6** = email chiave *"oggi €249 invece di €299, codice XXX, scade tra 48h"* · **G8** = report A→B + ultimo giorno offerta · **+7gg** = il profilo si cancella davvero.

**Stime Ago–Dic:** prudente ~€110k · **base ~€300k** (~1.270 paganti su ~5.900 prove) · ottimistico ~€690k. Il vero valore è la base ricorrente: ~500 clienti a €29 = **~€15k/mese** (~€180k/anno) dal 2027. *Il lancio si giudica sulla base ricorrente che lascia, non sui 5 mesi.*

**Punti aperti da decidere:**
1. **Capacità delle coach** (il vincolo vero): 5.900 prove ÷ 12 tutor = ~490 a testa, ognuna con messaggio G1 personale. Gli inviti vanno **scaglionati sulla capacità reale**, non sulla dimensione del database. Meglio 800 prove seguite bene che 3.000 abbandonate.
2. Il report cita €249/€299: **i prezzi a DB vanno allineati prima** di mandarlo a un cliente vero.
3. "Mantenimento €29 **a vita**": impegno pesante, valutare *"finché resti attiva"*.
4. Nella vignetta la mascotte **non è la nostra Gaia** (è una mela generica): va sostituita con quella vera.

**Note storiche che contano:** €3,77M incassati **senza una sola email** → il database non è mai stato lavorato: tutto upside. Ma **consenso GDPR** e **deliverability** (warm-up dominio) sono condizioni non negoziabili.
