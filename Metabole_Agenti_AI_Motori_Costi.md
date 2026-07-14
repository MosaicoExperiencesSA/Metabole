# Metabole — Agenti AI: tipo, motore e stima costi

Verifica richiesta: quali agenti abbiamo progettato, di che tipo sono, che motore usano e quanto costano.
Prezzi API rilevati a **luglio 2026** (vedi Fonti). Nota importante: nei documenti di progetto gli agenti sono definiti **a livello funzionale**; il **modello (motore) non è ancora fissato nel codice** — qui trovi la mappatura **consigliata** e la stima.

---

## 1. Che tipo di agenti sono

Sono **agenti basati su LLM** (large language model), **specializzati e orchestrati**: ognuno ha un compito unico, input/output chiari, e — sui temi sensibili — **l'umano approva** (non sono agenti autonomi liberi). Tre "famiglie":

- **Agenti generativi/di ragionamento** (testo): scrivono, pianificano, sintetizzano.
- **Agente classificatore/giudice**: valuta e dà un verdetto (compliance) — è un uso "a bassa creatività, alta affidabilità".
- **Agenti con recupero informazioni (RAG)**: lavorano su dati curati (catalogo menu, knowledge base nutrizione) invece che sul web libero.
- **Agente vocale (TTS)**: la voce di Gaia, generata con un motore text-to-speech dedicato.

Molte parti "intelligenti" del prodotto (il **motore della dieta**, le soglie) sono **deterministiche/data-driven**, non LLM: costano quasi nulla. L'LLM serve soprattutto per **dialogo, spiegazioni, creatività e giudizio**.

---

## 2. Inventario agenti + motore consigliato

| Agente | Dove | Tipo | Motore consigliato |
|---|---|---|---|
| **Gaia** (assistente + spiegazioni menu) | App cliente | Conversazionale + RAG | **Haiku 4.5** per il grosso, **Sonnet 5** per i casi complessi |
| Motore dieta | App cliente | Deterministico (regole+catalogo) | *nessun LLM* (costo ~0) |
| Voce di Gaia | App cliente | TTS | **ElevenLabs** (frasi pre-generate, non in tempo reale) |
| **Stratega** | Marketing | Pianificazione/ragionamento | **Sonnet 5** (Opus 4.8 per la strategia mensile) |
| **Creativo (art)** | Marketing | Concept + immagini | Sonnet 5 + **modello immagini** |
| **Copywriter** | Marketing | Generazione testo | **Haiku 4.5** (Sonnet per l'adv chiave) |
| **Giudice** (compliance) | Marketing | Classificatore/giudizio | **Sonnet 5** (affidabilità sicurezza) |
| **Publisher** | Marketing | Orchestrazione API | *LLM minimo / nessuno* |
| **Lead** | Marketing/CRM | Normalizzazione dati | **Haiku 4.5** o nessuno |
| **Analista** | Marketing | Analisi/sintesi | Haiku/Sonnet |
| **Contesto & Tempismo** | Marketing | Pianificazione periodica | Sonnet 5 (uso raro) |
| **Redattore blog** (nuovo) | Comunicazione | Generazione + RAG + traduzione | **Sonnet 5** (bozza) + **Haiku** (traduzioni) |
| Orchestratore | Trasversale | Routing | Haiku / nessuno |

**Prezzi motori (per 1M token, luglio 2026):** Haiku 4.5 **$1 / $5** · Sonnet 5 **$2 / $10** (intro, poi $3/$15) · Opus 4.8 **$5 / $25** · GPT-4o mini **$0,15 / $0,60** (alternativa low-cost). Leve di sconto: **caching -90%** input, **batch -50%**, Haiku al posto di Sonnet **-80%**.

---

## 3. Stima costi (mensile)

Assunzioni prudenti: motore dieta deterministico (LLM solo per dialogo/spiegazioni); uso Haiku-prevalente con caching del contesto; prezzi correnti. Valori in USD (~€ a parità, per stima).

### 3.1 Gaia in-app (voce a parte) — dipende dai clienti attivi
Ipotesi ~150k token input + 60k output al mese per cliente attivo (blended Haiku/Sonnet con caching): **~$0,30–0,80 per cliente/mese**.

| Scenario | Clienti attivi | Costo Gaia LLM |
|---|---|---|
| **Avvio** | 1.000 | **$300–800/mese** |
| **Scala** | 10.000 | **$3.000–8.000/mese** |

Questo è **il driver di costo principale**: a scala conta ogni ottimizzazione (caching, Haiku, quota per cliente).

### 3.2 Marketing + Comunicazione (quasi indipendenti dai clienti)

| Voce | Ipotesi | Costo/mese |
|---|---|---|
| Macchina marketing (testo: Stratega/Copy/Giudice/Analista) | ~30 post + varianti + strategia | **$15–40** |
| Redattore blog (1 articolo/giorno × 9 lingue) | bozza + traduzioni | **$10–30** |
| Immagini (creatività + copertine blog) | ~60 immagini | **$10–40** |
| Voce di Gaia (ElevenLabs) | frasi pre-generate + rigenerazioni | **$22–99** (fisso) |
| **Sub-totale non-cliente** | | **~$60–210/mese** |

### 3.3 Totale AI

| Scenario | Totale motori AI/mese |
|---|---|
| **Avvio (1.000 clienti)** | **~$360–1.000** (≈ €350–950) |
| **Scala (10.000 clienti)** | **~$3.100–8.200** |

> Non incluso qui (non sono "motori AI"): infrastruttura **Neon + Render + Vercel + Brevo**, in avvio indicativamente **$50–150/mese**.

---

## 4. Leve per ridurre i costi

1. **Motore dieta deterministico**: l'LLM spiega/dialoga, non genera ogni pasto → grande risparmio a scala.
2. **Haiku 4.5 come default**, Sonnet 5 solo dove serve qualità → ~-80% sui token interessati.
3. **Prompt caching** del contesto (catalogo, profilo): -90% sull'input ripetuto.
4. **Batch** per lavori non in tempo reale (blog, traduzioni, analisi): -50%.
5. **Quota per cliente** e risposte brevi: tetto di spesa prevedibile.
6. **Frasi vocali pre-generate** (già la scelta attuale): la voce non scala col numero di utenti.

---

## 5. In sintesi

Agenti **LLM specializzati con umano-nel-ciclo**; motore consigliato **Claude (Haiku 4.5 default, Sonnet 5 dove serve, Opus 4.8 raro)** + **ElevenLabs** per la voce + un **modello immagini** per le creatività. Costo dominato da **Gaia in-app**: **~$0,30–0,80 per cliente/mese**, cioè **~$360–1.000/mese in avvio** e **~$3–8k/mese a 10.000 clienti**, marketing e blog quasi trascurabili. Le leve (deterministico, Haiku, caching, batch) possono **dimezzare o più** la spesa a scala.

*Stima indicativa: i prezzi delle API cambiano; da riverificare prima del budget definitivo. Il motore va ancora fissato nel codice (decisione di progetto).*

## Fonti
- [Anthropic — Claude Platform pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude API Pricing 2026 — Opus 4.8, Sonnet, Haiku (metacto)](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [ElevenLabs — Pricing](https://elevenlabs.io/pricing)
