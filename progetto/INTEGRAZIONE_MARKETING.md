# Integrazione Marketing nel deploy — handover per lo Sviluppo

Documento unico da condividere con il team Sviluppo (il socio e la sua AI). Raccoglie **tutto il
lavoro di marketing** fatto e dice **cosa serve per integrarlo nel deploy**: il reparto, gli **8
agenti AI di marketing al completo**, lo standard CRM e i punti di aggancio tecnici (ruoli, eventi,
endpoint, dati, segreti).

Tag: **[P]** = Prodotto (già fatto) · **[S]** = Sviluppo (da fare). Tutto è registrato in
`progetto/` secondo la convenzione condivisa.

---

## 1. Cosa è pronto (lato Prodotto)

I documenti di riferimento (in root, indicizzati in `progetto/README.md`):

- **`Metabole_Reparto_Marketing_e_Standard_CRM`** — carta del reparto, profilo del Responsabile, e lo **standard lead/pipeline** con il template "CRM Interface Spec" che il socio deve compilare.
- **`Metabole_Macchina_Marketing_AI`** — la macchina: **7 agenti + il Giudice**, motore creativo, compliance/blocchi social (Meta/TikTok/Google), media planning Italia.
- **`Metabole_Agente_Contesto_Tempismo`** — l'**8° agente**: legge news/stagioni/life-events, calendario 12 mesi, micro-pubblici a tempo (dati ISTAT).
- **`Metabole_Guida_Pubblicazione`** — deploy demo + produzione (contesto in cui si innesta il marketing).

---

## 2. Gli 8 agenti di marketing (roster completo) e cosa serve loro dalla piattaforma

Questa è la vista **tecnica**: per ogni agente, cosa deve fornirgli il sistema per funzionare in produzione.

| # | Agente | Funzione | Cosa serve dal backend/deploy **[S]** |
|---|---|---|---|
| 1 | **Contesto & Tempismo** | Legge news/trend/calendario/life-events, decide quando e per chi | Accesso a fonti esterne (news, Google Trends), scheduler (cron) per i brief periodici |
| 2 | **Stratega** | Da KPI + brief tempismo → temi/angoli/priorità | Lettura KPI dall'analytics; store dei brief |
| 3 | **Creativo** | Genera concept visivi (vignette, storyboard, caroselli) | Storage asset (immagini/video), API modello immagini |
| 4 | **Copywriter** | Testi per canale (hook, caption, script, email, SMS, adv) | API modello testo (AI composer già previsto), libreria messaggi |
| 5 | **Giudice (compliance & brand)** | Valuta **ogni** proposta prima di pubblicare; approva/rivedi/blocca | Servizio di review + **audit log** delle decisioni; ruleset compliance versionato in `config_param` |
| 6 | **Publisher** | Programma e pubblica via **API ufficiali** social | Connettori social (Meta/IG, TikTok, LinkedIn), coda di pubblicazione, calendario |
| 7 | **Lead** | Cattura lead, deduplica, applica consenso, versa nel CRM | **Endpoint di ingestion lead**, store consensi, connessione CRM |
| 8 | **Analista** | Misura performance, alimenta Stratega e memoria | Pipeline analytics/attribuzione, report |

Orchestrazione: **Contesto → Stratega → Creativo/Copy → Giudice → (revisione umana solo se sensibile) → Publisher → Lead + Analista → memoria**. Il **Giudice è il freno di sicurezza obbligatorio** prima di ogni pubblicazione.

---

## 3. Cosa deve aggiungere lo Sviluppo per integrarlo nel deploy **[S]**

### 3.1 Ruoli e permessi (RBAC)
- Nuovo ruolo **`head_marketing`** (Responsabile) e **`marketing`** (operatori), aggiunti alla matrice permessi ruolo × sezione già a sistema.
- **Sezione backoffice** dedicata: campagne, segmenti, automazioni, KPI, gestione consensi, coda del Giudice.
- **Vincolo**: il marketing **non** vede dati sanitari/note cliniche (come la coach). Solo lead, contatti, stati, metriche, consensi.

### 3.2 Esposizione degli eventi (il backend già li emette)
Il prodotto genera già segnali utili; vanno **esposti** verso CRM/marketing (internal API o webhook, con `CRON_SECRET`/token):
- **`track`** (interazioni UI in app/demo) → scoring lead, retargeting.
- **attribuzione `refcod`** (registrazione con `?ref=`) → accredito referral.
- **pagamento confermato** → stato "cliente", onboarding, richiesta recensione al primo risultato.
- **alert/escalation** (no check-in, calo aderenza, stallo) → stato "a rischio" → flusso retention.
- **fine piano senza rinnovo** → stato "churn" → win-back (app-allert di rientro).

### 3.3 Nuovi servizi/endpoint
- **Lead ingestion**: `POST` per creare/aggiornare un lead (da form/social/ads) con dedup e attribuzione.
- **Consenso**: store dei consensi granulari (email/SMS/profilazione) con timestamp e base giuridica, revoca in un clic, audit.
- **Content review (Giudice)**: servizio che valuta un asset e registra la decisione (approva/rivedi/blocca + motivazione) in **audit log**.
- **Publishing connectors**: integrazione con le **API ufficiali** dei social per programmare/pubblicare.
- **Analytics/attribuzione**: raccolta performance per fase e per campagna (UTM/refcod).

### 3.4 Modello dati (delta, allineato allo standard CRM)
`Lead` (campi in `Reparto_Marketing_e_Standard_CRM` §B2) · `Consent` · `ContentAsset` · `ReviewDecision` (Giudice) · `Campaign` · `Publication`. Stadi pipeline in §B1 dello stesso documento.

### 3.5 Configurazione e segreti
- Soglie/regole marketing (ruleset Giudice, soglie scoring, SLA handoff) in **`config_param`**, mai hardcodate.
- Segreti (API social, provider AI immagini/testo, tool di scheduling) **solo nei pannelli** dei servizi; in `render.yaml` come variabili `sync: false`. Mai nel repo.

### 3.6 Punti di deploy
- Il **Contesto & Tempismo** e il **Publisher** hanno bisogno di esecuzioni **schedulate** (cron): si affiancano al `metabole-cron-daily` già presente in `render.yaml`, o come nuovo cron dedicato.
- Il backoffice marketing vive nel frontend Vercel (sezione riservata ai ruoli marketing).

---

## 4. Allineamento col CRM (in costruzione lato socio)

Il CRM lo costruisce il team Sviluppo. Per farlo combaciare col marketing, serve che il socio
**compili la "CRM Interface Spec"** (Parte C di `Metabole_Reparto_Marketing_e_Standard_CRM`):
mappatura degli stadi, schema campi, endpoint di ingresso lead, webhook in uscita, regole di
assegnazione, consensi, ambiente/pubblicazione. Con quella, l'agente **Lead** e il CRM parlano la
stessa lingua e i lead entrano come **"in lavorazione"** con owner e stato.

---

## 5. Divisione dei compiti e prossime azioni

**[Prodotto] — fatto**
- Reparto + Responsabile + KPI; 8 agenti definiti; standard lead/pipeline; compliance social; calendario 12 mesi e micro-pubblici; guida deploy.

**[Prodotto] — prossimo**
- Libreria creativa di partenza (messaggi-pilastro, hook conformi, template dei formati).
- Specifica di dettaglio del **Giudice** (ruleset compliance) se lo Sviluppo la richiede.

**[Sviluppo] — da fare**
- Ruolo `head_marketing`/`marketing` + sezione backoffice + permessi (no dati sanitari).
- Esporre gli eventi (§3.2) e creare gli endpoint (§3.3).
- Modello dati marketing (§3.4) allineato allo standard CRM.
- Compilare la **CRM Interface Spec** (§4).
- Cron per Contesto&Tempismo + Publisher; segreti nei pannelli.

---

## 6. Governance

Tutto è tracciato in `progetto/` (convenzione condivisa): `README.md` indicizza i documenti,
`STATO.md` riporta lo stato per area, `REGISTRO.md` il diario. Ogni modifica futura va registrata
con il tag del team e, se tocca l'altro team, con `→ impatto [Prodotto|Sviluppo]`.

## In una riga

Il marketing è **pronto e completo** (reparto + 8 agenti + standard CRM + compliance + calendario);
per portarlo nel deploy lo Sviluppo aggiunge **un ruolo, alcuni endpoint, l'esposizione degli eventi
già emessi e il modello dati allineato al CRM** — il resto (strategia, creatività, tempismo,
compliance) è governato dagli agenti, con il **Giudice** come freno di sicurezza prima di ogni
pubblicazione.
