# 08 · Il blocco commerciale

Otto pagine che stanno in piedi insieme: **Negozio · Acquisti · Bonifici · Buoni sconto ·
Compensi staff · Contabilità · % Provvigioni · Richieste prelievo**.

Si monta solo se il progetto vende qualcosa (decisione 8 del capitolo 00). Le ultime tre solo se
c'è una rete di vendita (decisione 9).

## Le due regole che valgono per tutto il capitolo

> **1 · Ogni importo è un intero in centesimi.** Mai virgola mobile, mai euro con la virgola.
> `0.1 + 0.2 !== 0.3`, e uno storno di tre centesimi in un registro contabile è un pomeriggio perso.

> **2 · Ogni movimento di denaro lascia una riga nel registro attività.** Approvazione, rifiuto,
> storno, provvigione, prelievo. Senza attore e senza ora, «chi ha approvato questo bonifico» non ha
> risposta.

## La mappa

```
   Negozio ─────► Acquisti ────► Bonifici        Buoni sconto
  (cosa vendi)   (chi ha        (le contabili    (agganciati
        │         comprato)      da approvare)    all'acquisto)
        │              │
        │              ▼
        │      ┌───────────────┐
        └─────►│  Provvigioni  │  quanto spetta, e a chi (a livelli)
      le %     └───────┬───────┘
                       ▼
              ┌────────────────┐      ┌──────────────┐
              │ Compensi staff │─────►│  Prelievi    │
              │ (il maturato)  │      │ (il pagato)  │
              └────────┬───────┘      └──────┬───────┘
                       ▼                     ▼
              ┌──────────────────────────────────────┐
              │   Contabilità  (entrate − uscite)    │
              └──────────────────────────────────────┘
```

---

## 8.1 · Negozio

**Chiave:** `shop` · **API:** `/admin/products`, pubblico `GET /products`

```prisma
model Product {
  id            String  @id @default(uuid())
  name          String
  description   String?
  priceCents    Int     @map("price_cents")
  active        Boolean @default(true)
  repurchasable Boolean @default(true)   // false = sparisce dallo shop di chi l'ha già preso
  // Percentuali per LIVELLO: {"1": 25, "2": 35, "3": 45} — vedi 8.7
  commissionByLevel Json @default("{}") @map("commission_by_level")
}
```

⚠️ **Un prodotto non si cancella mai: si disattiva.** Ha ordini attaccati, e un ordine che punta a
un prodotto sparito è una riga di contabilità che non si può più leggere.

⚠️ **Il prezzo si copia nell'ordine al momento dell'acquisto.** L'ordine porta `items` con nome e
prezzo di allora: se legge il prezzo dal prodotto, il giorno che aumenti il listino cambiano
retroattivamente tutte le ricevute già emesse.

---

## 8.2 · Acquisti

**Chiave:** `purchases` · **API:** `/admin/purchases`

L'elenco di cosa è stato comprato: chi, quando, quanto, con che metodo, in che stato.

```prisma
model Order {
  id         String      @id @default(uuid())
  clientId   String      @map("client_id")
  status     OrderStatus @default(pending)
  totalCents Int         @map("total_cents")
  items      Json        // [{productId, name, priceCents, qty}] — la fotografia di allora
  payment    Payment?
}
```

Serve almeno: creare un acquisto a mano (chi paga in contanti esiste), stornare, scaricare la
ricevuta in PDF.

⚠️ **Storno ≠ cancellazione.** Lo storno è una riga in più (`refundCents`, `refundedAt`,
`refundById`, `refundNote`), non una riga tolta. La contabilità deve poter raccontare che c'è stato
un incasso e poi un rimborso: cancellando, l'incasso non è mai esistito e i conti non tornano.

---

## 8.3 · Bonifici

**Chiave:** `accounting` · **API:** `/admin/payments`

Il pagamento con la sua **contabile allegata**, da approvare o rifiutare a mano.

```prisma
model Payment {
  id             String        @id @default(uuid())
  clientId       String        @map("client_id")
  orderId        String?       @unique @map("order_id")
  amountCents    Int           @map("amount_cents")
  description    String
  method         PaymentMethod @default(bank_transfer)
  status         PaymentStatus @default(pending)   // pending | approved | rejected
  receiptData    Bytes?        @map("receipt_data")  // ⚠️ CIFRATA
  receiptMime    String?       @map("receipt_mime")
  receiptName    String?       @map("receipt_name")
  approvedById   String?       @map("approved_by_id")
  approvedAt     DateTime?     @map("approved_at")
  rejectReason   String?       @map("reject_reason")
  discountCodeId String?       @map("discount_code_id")
  discountCents  Int?          @map("discount_cents")
  refundCents    Int?          @map("refund_cents")
  refundedAt     DateTime?     @map("refunded_at")
  billingReason  String?       @map("billing_reason")  // first | renewal
  @@index([status])
  @@index([clientId, createdAt])
}
```

### Le cose da sapere

⚠️ **La contabile è cifrata a riposo** (AES-256-GCM, formato `iv(12B) + authTag(16B) + ciphertext`
in una colonna `Bytes`). È un documento bancario con dentro un IBAN: non sta in chiaro, e non sta in
una cartella pubblica di file statici.

⚠️ **`billingReason` (`first` / `renewal`) sembra superfluo e non lo è.** Senza, un rinnovo è
indistinguibile da un primo acquisto, e la regola «sul rinnovo la provvigione si paga solo se chi ha
venduto è ancora quello assegnato» non si può nemmeno esprimere.

⚠️ **L'approvazione è il momento in cui scattano le provvigioni** (8.7). Deve essere una
transazione: pagamento approvato *e* provvigioni scritte, o nessuno dei due.

---

## 8.4 · Buoni sconto

**Chiave:** `discounts` · **API:** `/admin/discounts`, `POST /me/discounts/validate`

```prisma
model DiscountCode {
  id           String    @id @default(uuid())
  code         String    @unique          // maiuscolo
  type         String                     // percent | fixed
  value        Int                        // 10 (%) oppure centesimi
  clientId     String?   @map("client_id")     // se valorizzato: personale, solo suo
  maxTotalUses Int?      @map("max_total_uses") // null = illimitato
  maxPerClient Int       @default(1) @map("max_per_client")
  usedCount    Int       @default(0) @map("used_count")
  active       Boolean   @default(true)
  expiresAt    DateTime? @map("expires_at")
}

model DiscountRedemption {
  id          String @id @default(uuid())
  codeId      String @map("code_id")
  clientId    String @map("client_id")
  paymentId   String? @map("payment_id")
  amountCents Int    @map("amount_cents")   // quanto ha scontato DAVVERO
}
```

⚠️ **Le riscossioni sono una tabella a sé, non un contatore.** Il contatore dice *quanti*; la
tabella dice *chi, quando, quanto* — ed è l'unica che risponde a «questo codice quanto ci è
costato».

⚠️ **La validazione e l'applicazione sono due momenti diversi.** `POST /me/discounts/validate`
mostra lo sconto prima di pagare; l'incremento del contatore e la riga di riscossione avvengono
**alla conferma del pagamento**, in transazione. Se incrementi alla validazione, chi apre il
carrello e non compra brucia un utilizzo.

⚠️ **Il codice si normalizza a maiuscolo** all'ingresso, sempre, dai due lati.

---

## 8.5 · Contabilità

**Chiavi:** `accounting_costs` (i costi) e `accounting` (il conto economico)

```prisma
// Le USCITE
model CostEntry {
  id          String    @id @default(uuid())
  label       String
  category    String                     // salari | infrastruttura | marketing | commissioni | tasse | altro
  amountCents Int       @map("amount_cents")
  recurring   Boolean   @default(false)
  cadence     String    @default("once") // once | monthly | yearly
  date        DateTime  @db.Date         // una tantum: la data · ricorrente: l'inizio
  endDate     DateTime? @map("end_date") @db.Date
  vendor      String?
  paidWith    String?   @map("paid_with")     // ⚠️ tendina dai Parametri, vedi sotto
  invoiceData Bytes?    @map("invoice_data")  // fattura cifrata
  @@index([category, date])
}

// IL REGISTRO: ogni movimento, entrata o uscita
model LedgerEntry {
  id          String     @id @default(uuid())
  type        LedgerType              // income | expense
  amountCents Int        @map("amount_cents")
  category    String
  date        DateTime   @default(now())
  ref         String?                 // id del pagamento / prelievo di origine
  clientId    String?    @map("client_id")
  staffId     String?    @map("staff_id")
  @@index([type, date])
  @@index([category, date])
  @@index([staffId, date])   // ⚠️ «quanto ha maturato questa persona questo mese»
}
```

### Le cose da sapere

⚠️ **`LedgerEntry` è la fonte unica del conto economico.** Non si sommano i pagamenti da una parte e
i costi dall'altra sperando che tornino: ogni movimento — incasso, provvigione, prelievo, costo —
scrive **una** riga qui, e il report legge solo questa tabella.

⚠️ **«Con cosa è stato pagato» è testo libero scelto da una tendina**, e la tendina la riempie
l'amministratore dai Parametri. Non un enum (una carta nuova sarebbe una migrazione), non una
tabella sua (vorrebbe una pagina per gestirla, e la pagina Parametri esiste già).
Il prezzo di questa scelta, da sapere: rinominare una voce non riscrive i costi già registrati — le
righe vecchie continuano a dire il nome vecchio, che è la verità storica di come si chiamava allora.

⚠️ **I costi ricorrenti si espandono al momento del report, non salvati riga per riga.** Un canone
mensile è **una** riga con `cadence: monthly`, `date` di inizio ed eventuale `endDate`. Salvarne
dodici vuol dire che il giorno che il canone cambia ne devi correggere dodici.

⚠️ Anche le fatture dei fornitori si allegano cifrate, come le contabili.

---

## 8.6 · Compensi staff

**Chiave:** `compensation` · **API:** `/admin/compensation`, `GET /me/wallet`

```prisma
model StaffCompensation {
  id          String @id @default(uuid())
  staffId     String @map("staff_id")
  period      String                       // "2026-09"
  amountCents Int    @default(0) @map("amount_cents")
  items       Json   @default("[]")        // [{at, kind, amountCents, ref}]
  @@unique([staffId, period])
}
```

Aggregato **per mese**, con dentro il dettaglio delle voci. Due viste della stessa cosa: quella
dell'amministratore (tutti) e il **portafoglio** di ciascuno (`GET /me/wallet`) — maturato,
già prelevato, disponibile.

⚠️ **Se esiste un tetto di guadagno mensile**, `null` e `0` devono significare la stessa cosa
(«nessun tetto»). Un tetto a zero preso alla lettera azzererebbe i compensi di chi non ne ha uno, e
lo scopriresti dal primo che si lamenta.

---

## 8.7 · % Provvigioni

**Chiave:** `commissions`

### Il modello a livelli

Ogni persona dello staff ha un **livello**; ogni prodotto ha una percentuale **per livello**. Chi sta
sopra incassa **la differenza** col livello sotto:

```
prodotto: {"1": 25, "2": 35, "3": 45}   ·   pagamento 100,00 €

rete completa:   liv.1 → 25,00    liv.2 → 10,00    liv.3 → 10,00   (totale 45,00)
manca il liv.2:  liv.1 → 25,00                     liv.3 → 20,00   (totale 45,00)
```

⚠️ **Il totale è sempre la percentuale del livello più alto presente.** La rete non regala e non
buca — è la proprietà che rende il modello a differenza preferibile alla somma di percentuali.

⚠️ **Si calcola sull'importo effettivamente pagato**, non sul prezzo di listino: dopo lo sconto,
al netto degli storni.

### La provvigione accantonata

```prisma
model PendingCommission {
  id              String    @id @default(uuid())
  paymentId       String    @map("payment_id")
  clientId        String    @map("client_id")
  level           Int                              // il livello che deve incassare
  amountCents     Int       @map("amount_cents")
  status          String    @default("pending")    // pending | paid | cancelled
  resolvedStaffId String?   @map("resolved_staff_id")
}
```

Serve al caso «qualcuno paga **prima** che gli sia stato assegnato un referente». Senza questa
tabella quella provvigione o si perde in silenzio o si paga a chi non spetta. Si risolve quando
l'assegnazione arriva.

⚠️ **Sui rinnovi**: la provvigione si paga solo se chi ha venduto è ancora quello assegnato oggi.
È la regola che rende `billingReason` (8.3) indispensabile.

⚠️ **Cambiare le percentuali di un prodotto non tocca le provvigioni già maturate.** Le righe
maturate sono fatti; il listino è una regola per il futuro.

---

## 8.8 · Richieste prelievo

**Chiave:** `withdrawals` · **API:** `POST /me/wallet/withdrawals`, `/admin/withdrawals`

```prisma
model CommissionWithdrawal {
  id           String    @id @default(uuid())
  staffId      String    @map("staff_id")
  amountCents  Int       @map("amount_cents")
  iban         String
  status       String    @default("requested")  // requested | paid | rejected
  receiptData  Bytes?    @map("receipt_data")   // ricevuta/fattura, cifrata
  note         String?                          // il motivo del rifiuto
  requestedAt  DateTime  @default(now()) @map("requested_at")
  paidAt       DateTime? @map("paid_at")
  approvedById String?   @map("approved_by_id")
  @@index([staffId, status])
}
```

Il ciclo: **chiede** (dal portafoglio) → **l'amministratore conferma o rifiuta** → se confermato,
riga di uscita nel `LedgerEntry`.

⚠️ **Il disponibile si ricalcola al momento della richiesta, non si legge da un saldo salvato.**
`maturato − già prelevato − richieste in attesa`. Un saldo salvato prima o poi va fuori sincrono con
i movimenti, e va fuori sincrono proprio verso chi ha più movimenti.

⚠️ **Due richieste contemporanee**: la verifica del disponibile e la creazione della richiesta
stanno nella **stessa transazione**, o due click ravvicinati passano tutti e due.

⚠️ **Il rifiuto vuole un motivo obbligatorio.** Un rifiuto senza motivo è una telefonata garantita.

⚠️ **L'IBAN si copia nella richiesta**, non si legge dalla scheda: se la persona lo cambia dopo, la
richiesta deve continuare a raccontare dove i soldi sono davvero andati.

---

## Cosa copiare da Metabole (mappa file per file)

Questo blocco nello starter **non** c'è ripulito: in Metabole è intrecciato con abbonamenti e piani,
ed estrarlo "pulito" vorrebbe dire riscriverlo — cioè consegnarti codice mai girato. Quello che il
kit ti dà è la mappa esatta.

| Pezzo | Backend | Frontend |
|---|---|---|
| Negozio | `commerce/commerce.service.ts` (prodotti) | `pages/GestioneNegozio.tsx` |
| Acquisti | `commerce/commerce.controller.ts` → `admin/purchases` | `pages/Acquisti.tsx` |
| Bonifici | `commerce/accounting.controller.ts`, `finance.service.ts` | `pages/Payments.tsx` |
| Buoni sconto | `commerce/discounts.{controller,service}.ts` | `pages/BuoniSconto.tsx` |
| Contabilità | `commerce/accounting.{controller,service}.ts` | `pages/Contabilita.tsx` |
| Compensi | `compensation/compensation.controller.ts` | `pages/Compensi.tsx` |
| Provvigioni | `commerce/finance.service.ts`, `tetto-provvigioni.spec.ts` | `pages/Provvigioni.tsx` |
| Prelievi | `payouts/payouts.{controller,service}.ts` | `pages/Prelievi.tsx` |

**Mentre copi, le quattro sostituzioni da fare ogni volta:**

1. `coach` / `nutritionist` / `head_*` → **livelli numerici** (`level: 1 | 2 | 3`)
2. le cinque colonne `commission_*_pct` → **una** colonna `commissionByLevel Json`
3. `Subscription` / `Plan` → il modello di vendita del progetto nuovo (o via, se vende una tantum)
4. `ClientProfile` → l'anagrafica del progetto nuovo

## Checklist di montaggio — capitolo 08

- [ ] Tutti gli importi sono `Int` in centesimi, senza eccezioni
- [ ] Prodotti e utenti si disattivano, non si cancellano
- [ ] L'ordine porta la **fotografia** di nome e prezzo, non un riferimento al listino
- [ ] Contabili e fatture sono cifrate a riposo
- [ ] Lo storno è una riga in più, mai una riga tolta
- [ ] `LedgerEntry` è l'unica fonte del conto economico
- [ ] I costi ricorrenti sono una riga sola, espansa nel report
- [ ] Le provvigioni sono a livelli e si calcolano sull'importo pagato
- [ ] `PendingCommission` esiste per chi paga prima dell'assegnazione
- [ ] Il disponibile del prelievo si ricalcola, e la richiesta è in transazione
- [ ] Ogni movimento di denaro scrive nel registro attività
- [ ] Ognuna delle otto pagine ha la sua chiave e la sua guardia
