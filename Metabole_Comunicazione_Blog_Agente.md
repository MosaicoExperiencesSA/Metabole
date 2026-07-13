# Metabole — Comunicazione & Agente Blog

**Dove:** Dashboard → **Marketing** → nuovo sotto-reparto **Comunicazione**.
**Cosa:** un agente redattore scrive articoli di nutrizione, il **responsabile marketing approva**, e **un articolo al giorno** viene pubblicato automaticamente nel **blog del sito** (`Metabole_Blog.html`).

Autore: [Prodotto]. Documento di specifica per lo Sviluppo.

---

## 1. Idea

La Comunicazione è il sotto-reparto che presidia la **voce pubblica** del brand fuori dai social: **blog**, e in prospettiva newsletter e comunicati. Il primo mattone è il **blog automatizzato ma sorvegliato**: l'AI produce, l'umano approva, il sistema pubblica con cadenza costante. Questo dà **SEO**, autorevolezza e materia prima da declinare poi sui social.

Principio Metabole: **l'AI accelera, l'umano decide** sui temi sensibili (come per il Giudice e per le parti cliniche).

---

## 2. Posizione nella dashboard

```
Marketing
├── Acquisizione (ads, funnel, lead)
├── Contenuti social (Stratega/Creativo/Copy/Giudice/Publisher)
├── Analisi (KPI, memoria)
└── Comunicazione   ← NUOVO
    ├── Blog            (coda articoli, calendario, pubblicati)
    ├── Fonti           (knowledge base nutrizione, calendario stagionale)
    └── Newsletter      (fase 2)
```

Permessi (RBAC): il **Redattore-AI** genera bozze; **sales/marketing_manager** rivede e approva; **head_nutritionist** è escalation obbligata per qualsiasi **claim di salute**; **admin** configura cadenza e fonti.

---

## 3. L'agente Redattore (blog)

**Tipo:** agente di generazione testo con recupero informazioni (RAG) su fonti curate. Non naviga il web libero: lavora su una **knowledge base validata** (linee guida nutrizionali, contenuti del nutrizionista capo, calendario stagionale, FAQ prodotto) per evitare imprecisioni e claim rischiosi.

**Input:** tema/angolo (dal calendario editoriale o dallo Stratega), stagione, segmento, lingua.
**Output:** bozza articolo strutturata: titolo, sommario, corpo (H2/H3), categoria, immagine di copertina suggerita, meta description SEO, tag, tempo di lettura.

**Ciclo di vita dell'articolo:**

```
Calendario/Stratega (tema)
   → Redattore-AI (bozza + SEO + copertina)
      → GIUDICE compliance/brand ──[Blocca]──► scarta + spiega
              │[Approva / Rivedi]
              ▼
      Responsabile marketing (approva / rimanda con note)
              │[claim salute?] → escalation head_nutritionist
              ▼
      Scheduler: 1 articolo/giorno → pubblicato sul blog del sito
              ▼
      Analista (traffico, lead da blog) → memoria → torna al tema
```

**Compliance (stesse regole del marketing):** niente prima/dopo, niente promesse a tempo o numeri garantiti, niente seconda persona su attributi fisici, 18+. Ogni **claim di salute** è escalato al nutrizionista capo. Ogni decisione **loggata** (audit).

---

## 4. Modello dati (impatto [Sviluppo])

Entità **`Article`**:

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `slug` | string | univoco per lingua |
| `lang` | enum | it/en/es/pt/fr/de/ru/zh/ar (allineato all'i18n del sito) |
| `title`, `excerpt`, `body` | text | body in Markdown/HTML sanificato |
| `category` | string | Alimentazione, Abitudini, Cultura del cibo, Benessere |
| `coverUrl` | string | immagine |
| `readingMin` | int | |
| `seoDescription`, `tags` | text/json | |
| `status` | enum | `draft` → `in_review` → `approved` → `scheduled` → `published` (+ `rejected`) |
| `authorType` | enum | `ai` \| `human` |
| `approvedBy` | uuid | utente marketing |
| `judgeScore`, `judgeVerdict` | — | esito Giudice |
| `publishAt`, `publishedAt` | datetime | scheduler |
| `sourceRefs` | json | fonti usate (tracciabilità) |

**Scheduler:** un cron (Render Cron Job) gira ogni giorno, prende il **prossimo `approved`** in coda per `publishAt` e lo porta a `published`. Se la coda approvata è vuota → alert al responsabile marketing (niente pubblicazione automatica non approvata).

**Endpoint:**
- Pubblici: `GET /api/v1/blog/articles?lang=xx` (lista pubblicati), `GET /api/v1/blog/articles/:slug`.
- Admin: CRUD bozze, `POST /:id/submit` (→ Giudice), `POST /:id/approve`, `POST /:id/schedule`, `POST /:id/reject`.
- Generazione: `POST /api/v1/blog/generate` (avvia il Redattore-AI su un tema).

**Sito:** il blog (`Metabole_Blog.html` + articolo in evidenza in home) legge da `GET /blog/articles` — stesso schema del `data-i18n-endpoint`/`data-stats-endpoint`: attributo `data-blog-endpoint`, con fallback statico agli articoli demo attuali.

---

## 5. Cadenza e multilingua

- **1 articolo/giorno** pubblicato (configurabile in Comunicazione → Blog).
- L'articolo nasce in **italiano**; la traduzione nelle altre 8 lingue passa dallo stesso meccanismo delle stringhe (traduzioni **nel DB**), con revisione madrelingua per le lingue sensibili.
- SEO: slug, meta description, sitemap, canonical per lingua.

---

## 6. Perché conviene

Blog costante = **SEO e autorevolezza** senza costo redazionale umano pieno; materia prima riusabile dallo Stratega per i social; coerenza di tono garantita dal Giudice; sicurezza clinica garantita dall'escalation al nutrizionista capo. **Zero-redeploy**: temi, cadenza e fonti sono dati, non codice.

---

## 7. Impatto [Sviluppo] (sintesi)

1. Entità `Article` + stati + migrazione.
2. Endpoint pubblici e admin (sopra); il sito legge da `data-blog-endpoint`.
3. Cron giornaliero di pubblicazione (Render Cron).
4. Integrazione **Redattore-AI** (motore testo + RAG su knowledge base) e passaggio dal **Giudice** già esistente.
5. Ruoli/permessi: bozza AI, approvazione marketing, escalation head_nutritionist per claim salute.
6. Traduzioni articoli nel DB (coerente con l'i18n del sito).
