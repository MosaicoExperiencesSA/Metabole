# MetaboleAI — Reparto Marketing: carta, responsabile e standard CRM

Documento unico e **fonte di verità** per far nascere il reparto Marketing e per farlo combaciare con il CRM che stiamo costruendo in parallelo. Tre parti:

- **Parte A — Carta del reparto** e profilo del **Responsabile Marketing** (chi possiede cosa, KPI, team, confini con le vendite, ruolo nel sistema).
- **Parte B — Standard Lead & Pipeline**: il linguaggio comune (stadi, campi, consensi, eventi) che marketing e CRM devono condividere.
- **Parte C — Cosa deve preparare il socio** per essere allineati: un template compilabile dal lato CRM.

A chi serve: **Antonio** (indirizzo strategico), il **Responsabile Marketing** (mandato operativo), il **socio** che costruisce il CRM (allineamento tecnico). Una volta approvato, il documento viene **pubblicato dal socio** e versionato.

---

# Parte A — Carta del reparto Marketing

## A1. Mandato

> Il reparto Marketing possiede l'**intero ciclo di vita del cliente**: attrae persone nuove, le converte, le fa restare e le riporta dentro quando escono — in modo **misurabile**, **automatizzato dove possibile** e **conforme al GDPR**.

Non è "il reparto che fa le grafiche": è responsabile di **numeri** (lead, conversioni, retention, LTV), non solo di attività.

## A2. Le 5 fasi presidiate

| # | Fase | Obiettivo | Owner primario |
|---|---|---|---|
| 1 | **Acquisizione** | Trasformare pubblico freddo in lead | Marketing (Acquisition) |
| 2 | **Nurture lead** | Convertire chi non ha (ancora) comprato | Marketing (Lifecycle) → handoff Vendite |
| 3 | **Attivazione + Retention** | Far iniziare e restare chi ha comprato | Marketing (Lifecycle) + Coach |
| 4 | **Win-back** | Riportare dentro chi è andato via | Marketing (Lifecycle) |
| 5 | **Automazione & presidio social** | Pubblicare, raccogliere lead, versarli nel CRM | Marketing (Content/Ops) |

L'idea dell'**app-allert di rientro** ("pesati ogni settimana → ti proponiamo un percorso veloce") vive nella **fase 4**: è di fatto un **prodotto gratuito di rientro**, un gancio a basso attrito per riaprire il dialogo con chi ha fatto churn.

## A3. Profilo del Responsabile Marketing

**Di cosa risponde (KPI di ruolo):** volume e qualità dei lead, costo di acquisizione (CAC), conversione lead→cliente, tasso di churn e retention, LTV e rapporto LTV/CAC, ritorno sulla spesa pubblicitaria (ROAS).

**Cosa decide (autonomia):** mix dei canali e budget entro il tetto assegnato, calendario e messaggi delle campagne, segmentazione e flussi automatici, priorità del team, test A/B.

**Cosa NON decide da solo (governance):** prezzi e offerte commerciali (con Antonio/Vendite), claim clinici o promesse di risultato (con il **nutrizionista capo** — vincolo di sicurezza e legale), uso dei dati sanitari (mai a fini marketing).

**Cosa possiede operativamente:** il CRM lato marketing (segmenti, automazioni, consensi), i canali (social, ads, email, SMS, push), il piano editoriale, i KPI e la reportistica.

## A4. Struttura del team (scalabile)

Si può partire con poche persone che coprono più aree e crescere. Le **funzioni** da coprire:

- **Acquisition / Performance** — ads (Meta, Google, TikTok), SEO, landing, tracking e attribuzione.
- **Content / Social** — piano editoriale, creatività, contenuti firmati dal nutrizionista (autorevolezza), gestione community.
- **Lifecycle / CRM** — email, SMS, push, automazioni per nurture/retention/win-back, gestione consensi.
- **Partnership & Referral** — palestre/farmacie/nutrizionisti, programma "porta un'amica" (`refcod`).

## A5. Confine Marketing ↔ Vendite (SLA)

Per evitare l'attrito classico tra i due reparti, si fissa una **linea di consegna**:

- Il **Marketing possiede il lead fino a MQL** (lead qualificato: ha mostrato intento reale — es. ha completato il questionario/demo o richiesto contatto).
- Al passaggio a MQL il lead viene **consegnato alle Vendite** e compare nel CRM come **"lead in lavorazione"**, con un **owner** assegnato.
- **SLA di presa in carico**: il commerciale contatta entro *N* ore (da concordare, es. 24h). Se non lavorato entro *M* giorni, il lead **torna** al marketing per il nurture (regola di *recycle*).
- Nessun lead resta senza owner e senza stato: è la regola d'oro appresa dai 100k lead già gestiti.

## A6. Il reparto nel sistema (ruolo RBAC)

Il backend ha già i ruoli (client, coach, nutritionist, head_nutritionist, sales, admin). Il reparto diventa **reale nel software** con:

- Nuovo ruolo **`head_marketing`** (Responsabile) + eventuale **`marketing`** (operatori).
- **Sezione backoffice** dedicata: campagne, segmenti, automazioni, KPI, gestione consensi.
- **Permessi**: vede lead, contatti, stati, metriche e consensi. **Non** vede **dati sanitari/note cliniche** (vincolo GDPR, coerente con la matrice permessi già a sistema).
- Si aggiunge alla matrice permessi ruolo × sezione già presente nel backend.

## A7. KPI e cadenza di revisione

Cruscotto per fase: **Acquisizione** (impression→lead, CAC, ROAS) · **Nurture** (lead→cliente, tempo di conversione) · **Retention** (attivazione a 7 giorni, churn mensile, aderenza) · **Win-back** (riattivati / churn, costo per rientro) · **LTV & LTV/CAC** trasversali. Revisione **settimanale** operativa, **mensile** strategica con Antonio.

---

# Parte B — Standard Lead & Pipeline (linguaggio comune col CRM)

Questa parte è il **contratto** tra marketing e CRM: se marketing e CRM usano gli stessi stadi, gli stessi campi e gli stessi eventi, i due sistemi combaciano.

## B1. Stadi del ciclo lead → cliente

| Stadio | Definizione | Entra quando… | Esce quando… |
|---|---|---|---|
| **nuovo** | Lead appena acquisito, non ancora contattato | Arriva da form/social/ads/referral | Primo contatto o qualifica |
| **contattato** | Primo tentativo di contatto fatto | Marketing/Vendite lo tocca | Diventa qualificato o perso |
| **qualificato (MQL)** | Intento reale dimostrato | Completa questionario/demo o chiede contatto | Consegnato alle Vendite |
| **opportunità (SQL)** | In trattativa attiva con un commerciale | Owner Vendite assegnato | Vince (cliente) o perde |
| **cliente** | Ha acquistato | Pagamento confermato | — |
| **a rischio** | Cliente con segnali di abbandono | Alert dal backend (no check-in, calo aderenza) | Recuperato o churn |
| **churn** | Cliente uscito / non rinnovato | Fine piano senza rinnovo / disdetta | Rientra (win-back) |
| **in rientro** | Ex cliente in percorso di win-back | Entra nell'app-allert / campagna rientro | Ridiventa cliente |

I nomi esatti nel CRM possono differire: l'importante è che ci sia una **mappatura 1:1** con questi stadi (vedi Parte C).

## B2. Modello dati minimo del Lead

Campi che **ogni** lead deve avere per essere lavorabile e misurabile:

| Campo | Descrizione |
|---|---|
| `lead_id` | Identificativo univoco |
| `fonte` / `canale` | Es. meta_ads, google, instagram_organic, referral, partner |
| `campagna` + `utm_*` | Campagna e parametri UTM per l'attribuzione |
| `refcod` | Codice referral di chi ha portato il lead (se presente) |
| `consenso_email` / `consenso_sms` / `consenso_marketing` | Booleani **+ timestamp + base giuridica** per ciascuno |
| `owner` | A chi è assegnato (marketing o commerciale) |
| `stato` | Uno degli stadi di B1 |
| `score` | Punteggio di priorità (opzionale ma consigliato) |
| `contatti` | email / telefono (validati) |
| `created_at` / `updated_at` | Timestamp |
| `note` | Diario della relazione |

## B3. Consenso & GDPR (requisito vincolante)

- **Email**: doppio opt-in (conferma via link). **SMS**: opt-in **separato** ed esplicito (regole più severe). **Non** si usano i dati raccolti per un fine diverso da quello consentito.
- Consensi **granulari** (email ≠ SMS ≠ profilazione), **revocabili** in un clic, con **timestamp e base giuridica** registrati e **audit**.
- **I dati sanitari non entrano mai** nei flussi di marketing.
- Hosting e trattamento in **UE**, coerenti col resto del sistema.

## B4. Eventi che il backend Metabole già emette (il CRM deve riceverli)

Il prodotto genera già segnali utili al marketing: il CRM li consuma e fa scattare le automazioni.

| Evento (dal backend) | Trigger | Azione marketing tipica |
|---|---|---|
| **Click/tracking UI** (hook `track`) | Interazioni in app/demo | Punteggio lead, retargeting |
| **Attribuzione refcod** | Registrazione con `?ref=` | Accredito referral + messaggio a chi ha invitato |
| **Pagamento confermato** | Acquisto | Passaggio a "cliente", onboarding, richiesta recensione dopo il primo risultato |
| **Alert / escalation** | No check-in, calo aderenza, stallo | Passaggio a "a rischio" + flusso retention |
| **Fine piano senza rinnovo** | Scadenza | Passaggio a "churn" + campagna win-back (app-allert) |

Molti messaggi possono essere **scritti dall'AI** (il backend ha già un *AI composer*) e partire in automatico da questi eventi.

## B5. Handoff, routing e dedup

- **Handoff**: al raggiungimento di **MQL** il lead passa alle Vendite come *"lead in lavorazione"* con owner assegnato e SLA (A5).
- **Dedup**: un contatto = un lead. Se rientra da un altro canale, si **aggiorna** il lead esistente (non se ne crea uno nuovo) e si tracciano tutte le fonti.
- **Re-assign / recycle**: lead non lavorati entro SLA tornano al marketing.

## B6. Naming & attribuzione (UTM / refcod)

Convenzione unica per non perdere la provenienza:

```
utm_source   = meta | google | tiktok | instagram | newsletter | partner
utm_medium   = cpc | organic | email | sms | referral
utm_campaign = <nome-campagna-in-minuscolo-con-trattini>
refcod       = <codice-univoco-per-referrer>   (es. LUCA2026)
```

---

# Parte C — Cosa deve preparare il socio (per essere allineati)

Dal lato CRM serve un breve documento — chiamiamolo **"CRM Interface Spec"** — che risponda ai punti qui sotto. Con questo, i due sistemi nascono compatibili. Il socio può consegnarlo compilando questo template:

### 1. Mappatura degli stadi
Elenco **esatto** degli stadi/pipeline nel CRM e mapping 1:1 con gli stadi di **B1**.

```
CRM stage "..."  →  standard "nuovo"
CRM stage "..."  →  standard "contattato"
... (uno per riga, tutti gli stadi)
```

### 2. Schema campi
Schema dei campi di **Lead / Contatto / Opportunità (Deal)** nel CRM e mapping ai campi di **B2** (quali esistono, come si chiamano, quali mancano).

### 3. Ingresso dei lead (come si crea un lead nel CRM)
Come sito, social, ads e backend inviano un lead al CRM:

```
Endpoint / webhook di ingresso: URL = ...
Metodo: POST / ...
Autenticazione: (API key / token / firma) = ...
Payload di esempio (campi e formato JSON) = ...
```

### 4. Uscita degli eventi (come il CRM notifica gli aggiornamenti)
Come il CRM comunica cambi di stato/eventi verso l'esterno (per rimandare lo stato al backend/marketing): webhook in uscita, formato, autenticazione.

### 5. Regole di assegnazione e SLA
Come il CRM assegna l'**owner**, con quali regole di round-robin/territorio, e gli **SLA** di presa in carico e di recycle.

### 6. Consensi
Dove e come il CRM salva i consensi (email/SMS/profilazione), timestamp e base giuridica, e come si gestisce la **revoca**.

### 7. Ambiente e pubblicazione
Hosting (UE?), ambienti (test/produzione) e **come pubblica** il CRM, così restiamo allineati anche sul deploy.

---

## In una riga

Il Marketing è un **reparto con un responsabile e dei numeri**, che presidia le 5 fasi del ciclo di vita; combacia col CRM se entrambi parlano lo **stesso linguaggio** (stadi B1, campi B2, eventi B4); e per allinearci basta che il socio consegni la **CRM Interface Spec** della Parte C. Approvato il documento, lo **pubblica lui** e lo versioniamo.
