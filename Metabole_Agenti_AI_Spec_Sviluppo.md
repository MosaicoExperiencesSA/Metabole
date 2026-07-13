# Metabole — Agenti AI: specifica per lo Sviluppo

Destinatario: **[Sviluppo]** (Simone). Obiettivo: implementare la sezione **Agenti** della dashboard e il runtime degli agenti, **standard su Claude**.
Riferimenti: prototipo `../Metabole_Dashboard_Agenti.html`, `../Metabole_Agenti_AI_Motori_Costi.md`, `../Metabole_Macchina_Marketing_AI.md`, `../Metabole_Specifica_Giudice_Compliance.md`.

Principi di progetto già in vigore: **API-first** `/api/v1`, **RBAC** per ruolo, soglie in **`config_param`** (mai hardcodate), dati sanitari cifrati e riservati, audit log, **zero-redeploy** (config a runtime).

---

## 1. Cosa sono questi agenti

Agenti **LLM specializzati, orchestrati, con umano-nel-ciclo**. Ogni agente = un compito, input/output chiari, un **motore** (modello Claude o servizio), una **regola** vincolante. Non sono autonomi: i contenuti sensibili passano dal **Giudice** e, per i claim di salute, dal **nutrizionista capo**.

Standard motore: **Claude** — `Haiku 4.5` (default alto volume), `Sonnet 5` (qualità/giudizio), `Opus 4.8` (raro). Voce = **ElevenLabs**. Il **motore dieta resta deterministico** (nessun LLM).

I nomi dei modelli **non vanno hardcodati**: si mettono in `config_param` (es. `agent.default_model`, `agent.judge_model`) così si cambiano senza redeploy.

---

## 2. Modello dati

### 2.1 `Agent` (definizione/registro)
| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid | |
| `key` | string | slug univoco (`gaia`, `giudice`, `redattore_blog`…) |
| `name` | string | nome mostrato |
| `type` | enum | `conversational` \| `generative` \| `judge` \| `rag` \| `planner` \| `analyst` \| `writer` \| `orchestrator` \| `tts` \| `deterministic` |
| `department` | enum | `app` \| `marketing` \| `communication` \| `crm` \| `system` |
| `task` | text | "cosa fa" |
| `rule` | text | "regola" (vincolo sempre valido) |
| `engine` | string | `claude-haiku-4-5` \| `claude-sonnet-5` \| `claude-opus-4-8` \| `elevenlabs` \| `none` (default da `config_param`) |
| `systemPrompt` | text | prompt di sistema versionato |
| `tools` | json | tool/endpoint che può usare |
| `enabled` | bool | on/off |
| `humanInLoop` | bool | richiede approvazione umana sull'output |
| `monthlyBudgetCents` | int | tetto di spesa (guardrail) |
| `createdBy`, `updatedAt` | — | audit |

> La sezione dashboard "Agenti" fa **CRUD** su questa tabella; il form "Nuovo agente" crea una riga (`name, type, department, engine, task, rule`).

### 2.2 `AgentRun` (esecuzioni, per costi/audit)
`id, agentId, startedAt, status(queued/running/done/error/blocked), inputRef, outputRef, model, inputTokens, outputTokens, costCents, verdict(nullable), approvedBy(nullable), error(nullable)`.

### 2.3 `AgentLog` (audit append-only)
`id, agentRunId, ts, level, message, payload(json)`. Obbligatorio per il **Giudice** e per ogni decisione su contenuti/claim (difendibilità).

---

## 3. Orchestrazione (runtime)

```
Trigger (evento/cron/manuale)
  → Orchestratore: sceglie l'agente, applica RBAC + budget (config_param)
    → Agente esegue sul motore (Claude/ElevenLabs)
      → [contenuti pubblici o claim] → GIUDICE (verdetto) → [claim salute] → nutrizionista capo
        → humanInLoop? → approvazione ruolo competente
          → azione (pubblica / salva / invia) + AgentRun/AgentLog (token, costo, verdetto)
```

- **Orchestratore**: instrada per `department`/`type`; verifica `enabled`, permessi e `monthlyBudgetCents`; blocca se budget superato.
- **Idempotenza + retry** con backoff; timeouts per agente.
- **Costi**: ogni chiamata scrive token e `costCents` su `AgentRun` (per la dashboard costi).
- **Ottimizzazioni**: prompt caching del contesto (catalogo/profilo), `batch` per lavori non real-time (blog, traduzioni, analisi), Haiku come default.

---

## 4. Endpoint (`/api/v1`)

Admin (RBAC `admin`/`marketing_manager` secondo reparto):
- `GET /agents` · `POST /agents` · `PATCH /agents/:id` · `DELETE /agents/:id` (soft) — CRUD registro.
- `POST /agents/:id/run` — esecuzione manuale (con input).
- `GET /agents/:id/runs` — storico esecuzioni + costi.
- `GET /agents/costs?from&to` — aggregato costi per agente/reparto (alimenta la dashboard costi).

Interni:
- Coda/worker per esecuzioni asincrone; cron per gli agenti pianificati (es. Redattore blog 1/giorno, Analista).

---

## 5. Mappatura agenti → motore (default consigliati)

| Agente | department | type | engine | humanInLoop |
|---|---|---|---|---|
| Gaia | app | conversational | sonnet-5 (Haiku per routine) | no (escalation clinica sì) |
| Motore dieta | app | deterministic | none | — |
| Voce di Gaia | app | tts | elevenlabs | no |
| Stratega | marketing | planner | sonnet-5 | no |
| Creativo | marketing | generative | sonnet-5 + immagini | sì (sensibili) |
| Copywriter | marketing | generative | haiku-4-5 | no |
| Giudice | marketing | judge | sonnet-5 | — (è lui il gate) |
| Publisher | marketing | orchestrator | haiku-4-5 | no |
| Lead | crm | analyst | haiku-4-5 | no |
| Analista | marketing | analyst | haiku-4-5 | no |
| Contesto & Tempismo | marketing | planner | sonnet-5 | no |
| Redattore blog | communication | writer/rag | sonnet-5 + haiku (trad.) | **sì** (responsabile marketing) |
| Orchestratore | system | orchestrator | haiku-4-5 | no |

---

## 6. Guardrail e sicurezza

- **RBAC**: dati sanitari solo cliente + suo nutrizionista; nessun agente marketing/analista accede ai dati clinici.
- **Giudice obbligatorio** su ogni contenuto pubblico; **claim di salute → nutrizionista capo** (come le parti cliniche del prodotto).
- **Budget per agente** (`monthlyBudgetCents`) + alert a soglia; stop automatico oltre il tetto.
- **Audit append-only** (`AgentLog`) per ogni decisione.
- **Segreti** (API key Claude/ElevenLabs) solo nei pannelli dei servizi (Render), mai nel repo né in chat.
- **Prompt versionati** (`systemPrompt`) per riproducibilità.

---

## 7. Collegamenti già pronti lato Prodotto

- Dashboard "Agenti" (prototipo `../Metabole_Dashboard_Agenti.html`): nome · dove lavora · cosa fa · regola · motore + form "Nuovo agente".
- Blog: entità `Article` + endpoint (vedi `../Metabole_Comunicazione_Blog_Agente.md`); il **Redattore** produce, il **Giudice** valuta, il responsabile marketing approva, cron 1/giorno.
- Sito: legge già da endpoint (`data-i18n-endpoint`, `data-stats-endpoint`, `data-paths-endpoint`, `data-blog-endpoint`) — le traduzioni e i contatori "vivono nel DB".

---

## 8. Prossimi passi minimi (proposta)

1. Migrazione `Agent` + `AgentRun` + `AgentLog` + seed dei 13 agenti (dalla tabella §5).
2. CRUD `/agents` + pagina backoffice "Agenti" (mirror del prototipo).
3. Wrapper motore Claude (Haiku/Sonnet/Opus) con conteggio token/costo → `AgentRun`.
4. Orchestratore + coda + cron; integrazione del **Giudice** esistente.
5. `config_param`: `agent.default_model`, `agent.judge_model`, budget di default.
