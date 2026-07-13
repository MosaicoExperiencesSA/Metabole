# Metabole — Prodotti dinamici: piano di sviluppo (lato codice)

Handover Sviluppo per implementare la spec `Metabole_Spec_Prodotti_Dinamici_Sviluppo.md` sulla
**nostra** codebase reale. Obiettivo: schermo 16 "Stile che preferisci" data-driven (prodotti dall'API,
Keto incluso), poi wizard backoffice e agente per prodotto. Regola ferrea: isolamento menu per prodotto.

---

## ⚠️ Decisione da prendere PRIMA di scrivere la migrazione (serve un ok)

La spec chiama l'entità **`Product`**. Ma nel nostro backend:
- **`Product` esiste già** ed è un'altra cosa: gli **integratori** dello shop (`/products`, prezzo,
  provvigioni). Non possiamo riusare quel nome.
- **`Diet` esiste già** ed è **esattamente** il concetto della spec: ha `name`, `regime`, `style`,
  `mealsPerDay`, i **menu** (`MenuDay` legati a `diet_id`) e le ricette. L'isolamento menu che la spec
  chiede ("`product_id`, mai join tra prodotti") **da noi è già** `diet_id`.

**Raccomandazione (Sviluppo):** NON creare una nuova tabella `Product`. **Estendere `Diet`** con i campi
cliente della spec. Così i menu restano isolati per `diet_id` (già enforced), non si duplica il modello,
e non si rompe nulla. Il "prodotto" mostrato al cliente = una `Diet` con stato pubblicabile.

Delta su `Diet` (una migrazione additiva, nessun dato perso):
```
+ clientName        String?   // nome commerciale mostrato al cliente (es. "Keto")
+ clientDescription String?   // descrizione breve
+ highlights        Json?     // 3–5 "caratteristiche principali"
+ seasonalTag       String?   // es. "estate" (nullable)
+ objective         String    @default("dimagrimento") // dimagrimento | mantenimento
+ clientVisible     Boolean   @default(false) // compare nello schermo 16?
```
(Le regole opzionali → tabella `DietRule` [= `ProductRule` della spec]; le proposte → `RuleProposal`.
Questi servono al wizard/agente, fase 4-5, non allo schermo 16.)

**In alternativa**, se il socio vuole proprio l'entità separata `Product`, la chiamiamo `PlanProduct`
(per non collidere con gli integratori) e la leghiamo 1-a-1 a una `Diet`. Più lavoro, stesso risultato
per il cliente. → **Serve la tua/sua scelta: estendere `Diet` (consigliato) o `PlanProduct` separato.**

---

## Fasi (ognuna è consegnabile e testabile da sola)

**Fase A — Fondazione dati (backend, 1 migrazione)**
- Campi cliente su `Diet` (sopra) + enum `DietStyle` aggiornato con `keto` (oggi:
  mediterranean/protein/low_carb/flexible → +`keto`; `flexible` resta per non rompere i dati esistenti).
- Migrazione additiva (validata su Postgres locale prima della consegna).
- Seed idempotente: marcare `clientVisible=true` + `clientName`/`clientDescription`/`highlights` sulle
  diete reali già presenti (Mediterranea, Proteica, Low-carb) e creare **Keto** (catalogo menu vuoto,
  da popolare dal nutrizionista — regola isolamento menu).

**Fase B — Endpoint (backend)**
- `GET /catalog/diet-products?active=1` (nome **senza collisione** con `/products` integratori) →
  ritorna le `Diet` con `clientVisible=true`: `{id, style, clientName, clientDescription, highlights,
  objective, seasonalTag}`. Pubblico per il cliente in onboarding.

**Fase C — Schermo 16 dinamico (app)**
- La pagina `style` legge `GET /catalog/diet-products` invece della lista fissa; ogni nome è
  **toccabile** → apre `clientDescription` + `highlights` (un pannello per volta).
- Voce di Gaia **generica** (già deciso): "Scegli il piano più adatto alle tue esigenze: tocca il nome
  di un piano per scoprirne le caratteristiche principali." (niente enumerazione → audio non va
  rigenerato ad ogni prodotto nuovo).
- La scelta invia lo `style`/`dietId` del prodotto scelto (mappata al salvataggio esistente).

**Fase D — Wizard "Crea nuovo prodotto" (backoffice)**
- 5 passi (anagrafica → menu → regole → proposta → attivazione) come da spec, sopra `Diet` + `DietRule`.
- Ruoli: nutrizionista/capo/admin. Attivazione = `clientVisible=true` dopo approvazione menu.

**Fase E — Agente per prodotto**
- Istanza dell'agente dieta legata al prodotto/`dietId`, configurata dalle `DietRule` (già esiste il
  motore; qui si aggancia la config per-prodotto). `objective=mantenimento` → efficacia neutra.

**Fase F — Regole & proposte**
- `DietRule` (enabled + params) + coda `RuleProposal` con approvazione del capo.

---

## Rischi / note
- **Migrazione su DB live (Render):** ogni fase con migrazione va testata su un branch/preview prima del
  merge. La Fase A è additiva (bassa rischio), ma va comunque validata.
- **`DietStyle` enum:** aggiungere un valore enum in Postgres è additivo e sicuro (`ALTER TYPE … ADD
  VALUE`), ma non si può fare dentro una transazione con altri statement → migrazione dedicata.
- **Zero-redeploy:** dopo la Fase A/B, creare un nuovo prodotto dal wizard **non** richiede deploy: il
  client legge dall'API. (Vero appena la Fase C è online.)
- **Menu Keto vuoti:** finché il nutrizionista non li popola, Keto è selezionabile ma senza menu →
  gestire il caso "catalogo in preparazione" nell'app.

---

## In una riga
Il "Product" della spec = la nostra `Diet` estesa con campi cliente; si parte da una migrazione additiva
+ seed + endpoint + schermo 16 dinamico, poi wizard e agente. **Prima serve solo un ok** su:
estendere `Diet` (consigliato) vs entità `PlanProduct` separata.
