# Addendum all'Handoff — Allineamento prezzi a DB (dettaglio tecnico)

Integra `progetto/Handoff_Simone_Prezzi_Prova.md` §1. Nato da una verifica del repo del **17/07/2026**.
Riferimenti: `backend/prisma/seed.ts` · `backend/prisma/schema.prisma` (model `Plan`, `DiscountCode`, `Subscription`) · commit **`28b7486`**.

> **AGGIORNAMENTO 17/07 (pomeriggio).** Il barrato listino + scadenza (§1) è **già stato implementato da Simone** nel commit `28b7486` — Opzione A. Questo addendum ora serve solo per i **5 punti ancora aperti** elencati in §7 (il grosso è: aggiornare i **dati** a DB, il codice c'è).

---

## 0. Stato

- **Codice: fatto.** `28b7486 feat(lancio): prezzi promo con listino barrato e scadenza`.
- **Dati: da fare.** A DB restano i vecchi `29700 / 49700 / 79700` (€297/€497/€797). Vanno aggiornati da **backoffice → Gestione Negozio** dopo il deploy (il seed è idempotente e non tocca la prod).

---

## 1. Barrato "founding" (Omnibus) — ✅ FATTO in `28b7486`

L'handoff chiedeva "listino + promo con **data di scadenza**" per rispettare l'Omnibus. Simone ha implementato l'**Opzione A**, in modo pulito:

- Schema `Plan`: aggiunti `listPriceCents` (listino barrato) e `promoEndsAt` (fine founding). `priceCents` = prezzo di **vendita** in promo. Migrazione `20260718110000_plan_promo_pricing`.
- `planPricing()`: promo attiva → vende a `priceCents` col barrato; **promo scaduta → prezzo torna da solo al listino, senza toccare il DB**.
- Applicato **ovunque si vende** (subscribe, checkout carrello, acquisto manuale), con **sconti ricalcolati sul prezzo effettivo**. `listPlans` espone `effectivePriceCents` + `promoActive`; app (Negozio, PlanFlow) e backoffice mostrano il barrato.

*(I codici sconto personali del §3 dell'handoff — es. `GIULIA-FOUND` — restano per lo sconto personale/urgenza a 48h, distinto dal listino founding.)*

---

## 2. I record piano esatti da mettere a DB (da Gestione Negozio)

Importi in **centesimi**. `priceCents` = promo (vendita); `listPriceCents` = listino barrato; `promoEndsAt` = data fine founding (**sempre valorizzata**, vedi §7.2).

| name | period | listPriceCents | priceCents (promo) | Tipo | Note |
|---|---|---:|---:|---|---|
| Percorso Metabole 1 mese | `1m` | 13000 (€130) | 9900 (€99) | ricorrente mensile | porta bassa / flessibile |
| **Percorso Metabole 3 mesi** | `3m` | 29900 (€299) | 24900 (€249) | una tantum | **consigliato / default** |
| Mantenimento | `maintenance` | 3900 (€39) | 2900 (€29) | ricorrente mensile | dopo il percorso |

Fuori dalla tabella `plan`:
- **Prova gratuita (8 giorni)** — stato *trial* (senza carta, misure al G0, purge a 7 giorni, handoff §2). Non un acquisto; se serve un record shop, `priceCents = 0`.
- **Visita nutrizionista €50** — `Product` una-tantum (`priceCents = 5000`). Vedi §7.3.

**Vecchi piani (6m €497, 12m €797):** **NON cancellarli** (`Subscription.plan` ha `onDelete: Restrict`). Metterli `active = false`. Il "3 mesi" esistente si può **aggiornare** invece di ricrearlo.

---

## 3. Provvigioni sui piani nuovi

`Plan` porta le provvigioni in centesimi (`commissionCoachCents`, `commissionManagerCoachCents`, `commissionNutritionistCents`, `commissionHeadNutritionistCents`), riscalate sull'importo effettivamente pagato. Vanno **impostate anche sui piani nuovi**, altrimenti le vendite di lancio danno commissione zero.

---

## 4. Coerenza dei numeri — ✅ verificata lato codice

Grep del repo (17/07): **nessun prezzo hardcodato** nei sorgenti backend né nei template vivi. L'unico `€249/€299` scritto a mano è in `marketing/Piano_Operativo_Lancio.md` (doc di piano, non un template). Il checkout usa già il prezzo effettivo dal DB.

Da verificare solo in fase di automazione: che **email G6** e **report cliente** peschino il prezzo dal piano (`effectivePriceCents`) e non un numero fisso.

---

## 5. Come aggiornare la produzione

Via **backoffice → Gestione Negozio** (Simone ha aggiunto i campi listino/fine promo): aggiorna i 3 piani, disattiva i vecchi, aggiungi il Product visita e imposta le provvigioni. In alternativa uno script idempotente dedicato (non il seed) se si preferisce farlo in batch.

---

## 6. Nota tecnica sul comportamento della promo

In `planPricing`, se `listPriceCents` è valorizzato ma `promoEndsAt` è **null**, la promo risulta **attiva a tempo indeterminato** → il barrato non scade mai. Per l'Omnibus è proprio ciò da evitare: **valorizzare sempre `promoEndsAt`** quando si imposta un listino founding.

---

## 7. Punti aperti (to-do)

1. **Aggiornare i piani a DB** da Gestione Negozio (i valori di §2), **disattivare** i vecchi 6m/12m, impostare le **provvigioni** sui nuovi.
2. **`promoEndsAt` sempre valorizzato** sui piani in promo (vedi §6).
3. **Visita nutrizionista €50** come `Product` una-tantum (non è nel commit `28b7486`).
4. **Ricorrente vs una-tantum:** `28b7486` non tocca la logica di rinnovo (subscribe crea un pagamento singolo). Confermare con Simone come si rinnovano **1 mese** e **mantenimento**.
5. **Coerenza email G6 / report:** verificare che leggano il prezzo effettivo dal piano al momento dell'automazione (vedi §4).

---

## Da confermare con Antonio

- **Mantenimento "a vita" vs "finché resti attiva"** (segnalato in `CONTESTO_CHAT.md`): impatta testo offerta e prezzo bloccato.
- **Listino mantenimento €39** (da `Offerta_Pricing_v2.md`): mostrare il barrato €39→€29 o solo €29?
