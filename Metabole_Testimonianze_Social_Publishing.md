# Metabole — Testimonianze sul sito & Pubblicazione social (Marketing)

Destinatario: **[Sviluppo]** + [Prodotto]. Due funzioni del reparto **Marketing**:
1. **Testimonianze** → ogni volta che ne raccogliamo una (e la approviamo), va **pubblicata sul sito** oltre che usata nel marketing.
2. **Pubblicazione social via API** → collegare il reparto ai canali (Facebook, Instagram, TikTok, + altri) per pubblicare.

Principi di progetto: API-first, **RBAC**, **Giudice** (compliance) prima di ogni pubblicazione, audit log, segreti solo nei pannelli dei servizi (Render), zero-redeploy.

---

## 1. Testimonianze collegate al sito

**Idea:** una testimonianza raccolta (da recensione a 5★, UGC con consenso, intervista) entra in un flusso unico; una volta **approvata** è disponibile sia per i **social** sia per il **sito** (sezione "Storie").

### 1.1 Flusso
```
Raccolta (recensione 5★ / UGC con consenso / modulo)
  → Giudice compliance (no prima/dopo, no numeri/garanzie, 18+, consenso presente)
     → Approvazione responsabile marketing
        → Pubblicata:  ✓ sul SITO (Storie)   +   ✓ disponibile al marketing (post social)
```
Regola d'oro: **niente pubblicazione senza consenso esplicito** e senza superare il Giudice.

### 1.2 Modello dati — entità `Testimonial`
| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `name` | string | nome mostrato (o iniziale) |
| `age` | int? | facoltativo |
| `text` | text | la testimonianza |
| `photoUrl` | string? | foto (con consenso immagine) |
| `lang` | enum | lingua (allineata all'i18n del sito) |
| `source` | enum | `review_5star` \| `ugc` \| `interview` \| `form` |
| `consent` | bool | consenso al trattamento + uso immagine/testo |
| `consentRef` | string | riferimento/prova del consenso |
| `status` | enum | `draft` → `in_review` → `approved` → `published` (+ `rejected`) |
| `onSite` | bool | pubblicata nella sezione Storie |
| `usedInMarketing` | bool | usata nei contenuti social |
| `judgeVerdict` | — | esito Giudice |
| `approvedBy`, `publishedAt` | — | audit |

### 1.3 Endpoint
- Pubblico (sito): `GET /api/v1/testimonials?lang=xx&published=true` → lista `{name, age, text, photo}`.
- Admin: CRUD, `POST /:id/submit` (→ Giudice), `POST /:id/approve`, `POST /:id/reject`, toggle `onSite`/`usedInMarketing`.

### 1.4 Sito — già pronto
La sezione **Storie** del sito legge da `data-testimonials-endpoint` (attributo sul `<body>`), con **fallback** alle 3 storie statiche attuali. Appena l'endpoint restituisce testimonianze pubblicate, **compaiono automaticamente** sul sito. (Nessun redeploy.)

---

## 2. Pubblicazione social via API (agente Publisher)

L'agente **Publisher** pubblica i contenuti approvati dal Giudice sui canali, tramite **adapter** per piattaforma. **Regola:** pubblica solo ciò che è approvato; ogni azione è loggata; i token stanno nei pannelli dei servizi.

> ⚠️ **Azioni dell'utente, non dell'AI:** collegare gli account (login/OAuth), accettare i permessi delle piattaforme e completare le App Review sono **operazioni che fai tu** nei pannelli ufficiali. Il codice usa i token risultanti; l'AI non esegue login né OAuth.

### 2.1 Canali richiesti

**Facebook (Pagina) + Instagram** — via **Meta Graph API / Instagram Content Publishing API**.
Requisiti: account **Business**, **Pagina Facebook** collegata, **Instagram professionale** (Business/Creator), **app Meta Developer**, permessi `instagram_basic` + `instagram_content_publish`, e **App Review** di Meta per la produzione (oltre i 25 utenti di test; ~2–4 settimane per permesso). Pubblicazione IG in **due passi**: crea il *media container* (`POST /{ig-user-id}/media`) → pubblica (`POST /{ig-user-id}/media_publish`).

**TikTok** — via **Content Posting API**.
È tra le API più restrittive: **App Review** obbligatoria, upload video **a chunk in sequenza**, **token che scade in 24h**, **limite di post/giorno** assegnato in fase di review, **nessuna schedulazione nativa** (la gestiamo noi). Da progettare con retry e refresh token puntuale.

### 2.2 Altri canali consigliati (da valutare)
- **LinkedIn** (Pagina aziendale) — autorevolezza B2B / recruiting (utile per "Lavora con noi").
- **YouTube** (Data API) — Shorts e video lunghi.
- **Threads** (Threads API, Meta) — sinergia con IG.
- **Pinterest** — molto affine a food/benessere femminile.
- **Google Business Profile** — recensioni e visibilità locale/mappe.
- **WhatsApp / Telegram (broadcast)** — nurture diretto dei lead (con consenso).

### 2.3 Architettura publisher
```
Contenuto approvato (Giudice) + calendario (Tempismo)
  → Publisher: per ogni canale un ADAPTER (Meta / TikTok / LinkedIn / …)
     → gestione OAuth token (refresh), rate limit, retry/backoff, upload media
        → pubblica → salva id post + metadati → Analista misura
```
Entità **`SocialAccount`** `{platform, handle, pageId, tokenRef(→segreto Render), scopes, status, connectedBy}` e **`SocialPost`** `{contentId, platform, status(queued/published/failed), externalId, scheduledAt, publishedAt, metrics}`.

### 2.4 Guardrail
- **Giudice obbligatorio** prima di ogni pubblicazione (policy piattaforma + anti-ban + veridicità + brand). Claim salute → nutrizionista capo.
- **Rate limit & quote** per canale; coda + retry; **token refresh** (critico su TikTok, 24h).
- **Audit** di ogni pubblicazione (chi/cosa/quando/esito).
- **Segreti** (token/app secret) solo nei pannelli Render; mai nel repo né in chat.
- **Consenso** verificato per contenuti con persone reali (testimonianze/UGC).

---

## 3. Impatto [Sviluppo] (sintesi)
1. Entità `Testimonial` + endpoint pubblico/admin; il sito legge da `data-testimonials-endpoint` (già predisposto).
2. Flusso testimonianza: raccolta → Giudice → approvazione → pubblica su sito + marketing.
3. Entità `SocialAccount` + `SocialPost`; **Publisher** con adapter Meta (FB Pagina + IG), TikTok, e predisposizione LinkedIn/YouTube/Threads/Pinterest/Google Business.
4. Gestione OAuth/token (refresh), rate limit, retry, schedulazione (TikTok non ha scheduling nativo).
5. App Review Meta e TikTok: attività lato utente/business, da avviare in anticipo (settimane).

## Fonti
- [Meta — Instagram Content Publishing / Graph API (guida 2026)](https://postproxy.dev/blog/post-to-instagram-via-api/)
- [Instagram API integration (requisiti, OAuth, rate limit)](https://www.getphyllo.com/post/instagram-api-integration-101-for-developers-of-the-creator-economy)
- [TikTok — Content Posting API (docs ufficiali)](https://developers.tiktok.com/products/content-posting-api/)
- [TikTok Content Posting API — guida sviluppatore 2026](https://zernio.com/blog/tiktok-developer-api)
