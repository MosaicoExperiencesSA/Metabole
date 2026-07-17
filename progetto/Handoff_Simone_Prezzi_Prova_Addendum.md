# Addendum all'Handoff — Allineamento prezzi a DB (dettaglio tecnico)

Integra `progetto/Handoff_Simone_Prezzi_Prova.md` §1. Nasce da una verifica del repo del **17/07/2026**.
Riferimenti letti: `backend/prisma/seed.ts` (righe 707–727) · `backend/prisma/schema.prisma` (model `Plan` 431–453, `DiscountCode` 1403–1420, `Subscription` 455–472).

---

## 0. Stato verificato (non ancora fatto)

- **A DB ci sono ancora i vecchi prezzi**: `29700 / 49700 / 79700` (piani "3/6/12 mesi" = €297/€497/€797), definiti in `seed.ts` righe 711–713.
- **Il seed NON aggiorna la produzione.** `seedCommerce()` crea i piani **solo se la tabella è vuota** (`if (await prisma.plan.count()) === 0`). Il DB prod è già popolato, quindi modificare `seed.ts` non cambia nulla in prod.
- **Conseguenza:** l'allineamento va fatto **direttamente sui dati di produzione** — pannello admin piani, oppure uno script dedicato di UPDATE/upsert (vedi §5). Non basta editare il seed.

---

## 1. Il nodo da decidere prima: il barrato "founding" (Omnibus)

L'handoff chiede "prezzo di listino + prezzo promo con **data di scadenza**", perché il barrato €299→€249 deve essere *vero* (Direttiva Omnibus: quando annunci una riduzione devi indicare il prezzo minimo dei 30 giorni precedenti). **Il modello `Plan` oggi non lo rappresenta**: ha un solo campo `priceCents`, nessun listino né scadenza promo.

Due strade:

**Opzione A — campi sul `Plan` (consigliata).** Nuova migrazione che aggiunge a `Plan`:
- `listPriceCents Int?` → prezzo pieno (barrato)
- `promoPriceCents Int?` → prezzo founding
- `promoEndsAt DateTime?` → quando il founding finisce da solo

Vantaggi: il barrato è nativo e mostrabile ovunque (checkout, report, email) leggendo lo stesso record; alla scadenza il prezzo pieno subentra senza intervento. È la più pulita per l'Omnibus.

**Opzione B — sconto via `DiscountCode`.** `Plan.priceCents` = prezzo pieno; il founding è un codice sconto a scadenza (il model `DiscountCode` ha già `expiresAt`, `maxTotalUses`, `maxPerClient`). Meno lavoro di schema, ma il prezzo "di default" mostrato resta il pieno e il barrato dipende dall'applicazione del codice: per l'Omnibus il prezzo di riferimento va comunque calcolato a parte. Meno lineare.

➡️ **Raccomandazione: Opzione A.** (I codici sconto personali del §3 dell'handoff — es. `GIULIA-FOUND` — restano comunque, ma per lo sconto *personale/urgenza a 48h*, non per il listino founding di base.)

---

## 2. I record piano esatti da avere a DB

Importi in **centesimi**. Listino = prezzo pieno (barrato); Promo = founding.

| name | period | listPriceCents | promoPriceCents | Tipo | Note |
|---|---|---:|---:|---|---|
| Percorso Metabole 1 mese | `1m` | 13000 (€130) | 9900 (€99) | ricorrente mensile | porta bassa / flessibile |
| **Percorso Metabole 3 mesi** | `3m` | 29900 (€299) | 24900 (€249) | una tantum | **consigliato / default** |
| Mantenimento | `maintenance` | 3900 (€39) | 2900 (€29) | ricorrente mensile | attivo dopo il percorso |

Fuori dalla tabella `plan`:
- **Prova gratuita (8 giorni)** — **non è un `Plan` a pagamento**: è lo stato *trial* (senza carta, misure al G0, purge a 7 giorni — vedi handoff §2). Se lo shop ha bisogno di un record, usare `priceCents = 0`, ma il flusso è quello della prova, non un acquisto.
- **Visita nutrizionista €50** — **non è un `Plan`**: è un `Product` una-tantum (`priceCents = 5000`). Il model `Product` esiste già (schema 511). Emergenze/patologie.

**Vecchi piani (6m €497, 12m €797):** **NON cancellarli.** `Subscription.plan` ha `onDelete: Restrict` (schema 460): un piano con abbonamenti collegati non è cancellabile. `Plan` ha il campo `active` → **disattivarli** (`active = false`) così spariscono dallo shop ma le sottoscrizioni storiche restano integre. Il piano "3 mesi" esistente si può **aggiornare** ai nuovi valori invece di crearne uno nuovo.

---

## 3. Provvigioni sui nuovi piani

`Plan` porta i campi provvigione in centesimi (`commissionCoachCents`, `commissionManagerCoachCents`, `commissionNutritionistCents`, `commissionHeadNutritionistCents`) e lo schema nota che vanno **riscalate sull'importo effettivamente pagato in caso di sconto**. Vanno **definiti anche per i piani nuovi** (1 mese, 3 mesi, mantenimento), altrimenti le commissioni sulle vendite di lancio risultano a zero.

---

## 4. Coerenza dei numeri (nessun prezzo hardcodato)

Un solo numero, letto dal DB, ovunque:
- **Checkout** (Stripe LIVE prende i prezzi dal DB, nessun prodotto su Stripe).
- **Report cliente** (`marketing/report_cliente/…`) — cita €249/€299: dopo l'allineamento combacia.
- **Email G6** ("oggi €249 invece di €299, codice XXX, scade tra 48h").

Regola: **nessun prezzo deve differire tra email, report e checkout.** Se qualche testo ha il prezzo scritto a mano, va reso dinamico.

---

## 5. Come aggiornare la produzione

Preferibile uno **script idempotente dedicato** (non il seed), rilanciabile senza rischio, es. `backend/prisma/scripts/align-prices.ts`:
1. `upsert` dei 3 piani nuovi per `period` (1m / 3m / maintenance) con listino + promo + `promoEndsAt` + provvigioni.
2. `update` dei vecchi 6m/12m → `active = false`.
3. `upsert` del `Product` "Visita nutrizionista" a 5000.
4. Log finale di ciò che ha toccato.

In alternativa, se il **pannello admin** ha già l'editor prezzi piani, si fa a mano da lì (più veloce, ma verificare che esponga listino + promo + scadenza dopo la migrazione dell'Opzione A).

---

## 6. Checklist (ordine)

- [ ] **Decisione barrato**: Opzione A (campi su `Plan`) vs B (codice sconto). *Consigliata A.*
- [ ] Se A → migrazione `Plan`: `listPriceCents`, `promoPriceCents`, `promoEndsAt`.
- [ ] Estendere il vocabolario `period` con `1m` e `maintenance` (oggi solo `3m/6m/12m`).
- [ ] Definire trattamento ricorrente vs una-tantum (3 mesi = una tantum; 1 mese e mantenimento = ricorrenti mensili).
- [ ] Script `align-prices.ts`: nuovi piani + disattiva vecchi + Product visita €50.
- [ ] Provvigioni impostate sui piani nuovi.
- [ ] Prova gratuita gestita come *trial* (non piano a pagamento).
- [ ] Verifica coerenza: checkout = report = email (stesso numero dal DB).
- [ ] Aggiornare `progetto/STATO_LANCIO.md` quando fatto.

---

## Punti aperti (da confermare con Antonio prima)

- **Mantenimento "a vita" vs "finché resti attiva"** (già segnalato in `CONTESTO_CHAT.md`): impatta il testo dell'offerta e la logica del prezzo bloccato.
- **Listino mantenimento €39**: preso da `Offerta_Pricing_v2.md`; l'handoff §1 lo lascia senza listino. Confermare se mostrare il barrato €39→€29 o solo €29.
