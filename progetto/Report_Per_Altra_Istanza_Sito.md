# Report — Lavoro sul SITO Metabole (risposta all'handoff del 15/7)

> Da: istanza "pubblicazione sito" (sessione Cowork di Simone) · 2026-07-15
> In risposta a `Istruzioni_Altra_Istanza_Sito.md`. La memoria di progetto
> `metabole-sito-web.md` è stata aggiornata con tutto quello che segue.

## 1. Esito: TUTTO PUBBLICATO E ALLINEATO ✅

La divergenza segnalata nel tuo §1 si è risolta da sola prima del mio intervento:
la versione **~444 KB** (immagini app base64 + il tuo blocco SEO/social + lazy-load
+ restyling a box del socio) è stata **committata su main** ed è quella canonica.

Il 15/7 ho pubblicato su SiteGround **tutte e 6 le pagine** dalla versione committata:

| Pagina live | = repo main | Salvataggio |
|---|---|---|
| `/` (index.html ← Metabole_Sito_Presentazione.html, 430.294 unità JS) | ✅ identica | POST 201 |
| `/Metabole_Blog.html` | ✅ identica | POST 201 |
| `/Metabole_Lavora.html` | ✅ identica | POST 201 |
| `/Metabole_Cookie.html` | ✅ identica | POST 201 |
| `/Metabole_Termini.html` | ✅ identica | POST 201 |
| `/Metabole_Privacy.html` | ✅ identica | POST 201 |

Verifica finale: fetch-compare `{cache:'no-store'}` contro l'API GitHub per ogni
pagina → `same: true` su tutte. Cache Dinamica svuotata. `favicon.svg` → 200.

**Non esiste più alcun delta repo→live**: favicon (righe 7-8) ed endpoint sono nel
repo per tutte le pagine. Da ora si pubblica sempre 1:1 da main, senza trasformazioni.

## 2. Bugfix incluso

Le 4 pagine Lavora/Cookie/Termini/Privacy pubblicate il 14/7 avevano **2 caratteri
corrotti nella base64 del PNG-favicon** (trascrizione manuale mia, non tua). La
ripubblicazione 1:1 dal repo le ha sanate. Ora la base64 live = quella committata.

## 3. Scoperte operative nuove (già in `metabole-sito-web.md`)

- **Usare l'API GitHub, non il CDN raw**: `api.github.com/repos/MosaicoExperiencesSA/Metabole/contents/<file>?ref=main`
  con `Accept: application/vnd.github.raw` (CORS ok, sempre fresca). raw.githubusercontent
  ha servito versioni **stale anche con cache-buster**. Nota: repo pubblico; se diventa
  privato l'API richiederà auth.
- **`.length` in JS = unità UTF-16**: le emoji contano 2. Il sito ha 9×🌿 → le lunghezze
  JS risultano +9 rispetto a Python/bytes. Non è corruzione: confrontare contenuti, non lunghezze
  cross-ambiente.
- **Confermata la tua verifica POST 201**: adottata su ogni salvataggio (tracking attivato
  prima del click, `POST …/api-sgcp/v00/file` → 201). Nessun salvataggio silenziosamente fallito.
- La **sessione Site Tools può scadere** → redirect al login: deve rientrare Simone
  (niente credenziali via automazione). Successo il 15/7.
- Il paste sintetico regge anche **430K unità** in un colpo solo, nessun freeze.
- Apertura file affidabile: eventi mouse **sintetici** sull'elemento trovato per
  `textContent` esatto (i click a coordinate sull'albero sbagliano file quando scrolla).

## 4. Cose fatte in precedenza che ti possono servire

- 14/7: go-live collaudato secondo `progetto/Istruzioni_Claude_Sito_Metabole.md` —
  endpoint pubblici 200 con CORS ok da `metabole.eu` **e** `www.metabole.eu`; sezioni
  dinamiche popolate; form lead → CRM verificato; honeypot che scarta (200 senza id).
- Favicon Gaia: `favicon.svg` estratta dal symbol `#gaiaMascot` (animazioni rimosse) +
  PNG 32px inline come fallback. Committata su main (commit `71d0131`).
- Diario aggiornato: sezione "Sito di presentazione" in `progetto/STATO.md` + voce
  REGISTRO del 14/7.

## 5. Ancora in sospeso (dal tuo §4, confermato)

1. **Immagini placeholder**: le foto Unsplash con fallback picsum e l'`og:image`
   Unsplash restano da sostituire con immagini reali → servono gli asset definitivi da
   Simone/socio. (Le screenshot dell'app sono già incorporate in base64.)
2. **Lead di prova** "Test GoLive Claude" (`simone.salogni+lead-golive@gmail.com`)
   ancora da cancellare dal CRM del backoffice.
3. Nulla da fare su favicon/sottopagine: coerenza ottenuta via repo.

## 6. Regole di ingaggio confermate

Tutte le tue (§0) valgono ancora: repo pubblico senza segreti, backend intoccabile,
Cowork non pusha (consegna nella cartella iCloud collegabile con "Add folder" —
collaudato — oppure file in chat + Summary/Description per GitHub Desktop), mai git
via device_bash, `~/Documents/Metabole` spuria. Unica correzione alla tua §3:
pubblica dall'**API GitHub** anziché dal raw CDN, e confronta contenuti (non lunghezze)
tra ambienti diversi.
