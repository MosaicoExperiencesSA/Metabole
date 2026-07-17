# Addendum all'Handoff — Prezzi e sconto di lancio (dettaglio tecnico)

Integra `progetto/Handoff_Simone_Prezzi_Prova.md` §1. Verifiche sul repo del **17/07/2026**.
Riferimenti: `backend/prisma/schema.prisma` (`Plan`, `DiscountCode`, `Subscription`) · commit **`28b7486`**.

> **DECISIONE 17/07 (pomeriggio).** Si abbandona il barrato mostrato di default. Strategia scelta:
> **a DB si mettono i prezzi PIENI (€130 / €299)**; lo sconto founding (→ €99 / €249) si applica
> **via codice sconto** inviato al **giorno 6** della prova (2 giorni prima della scadenza degli 8 giorni),
> **via email + tutor**. I campi barrato di `28b7486` (`listPriceCents`/`promoEndsAt`) restano disponibili
> ma **non usati** per ora.

---

## 1. Prezzi a DB — pieni, da Gestione Negozio

Importi in **centesimi**. `priceCents` = prezzo pieno mostrato; **niente** `listPriceCents`/`promoEndsAt`.

| name | period | priceCents | Tipo | Note |
|---|---|---:|---|---|
| Percorso Metabole 1 mese | `1m` | 13000 (€130) | ricorrente mensile | porta bassa / flessibile |
| **Percorso Metabole 3 mesi** | `3m` | 29900 (€299) | una tantum | **consigliato / default** |
| Mantenimento | `maintenance` | 2900 (€29) | ricorrente mensile | dopo il percorso |

Fuori dalla tabella `plan`:
- **Prova gratuita (8 giorni)** — stato *trial* (senza carta, misure al G0, purge a 7 giorni, handoff §2). Non un acquisto.
- **Visita nutrizionista €50** — `Product` una-tantum (`priceCents = 5000`).

**Vecchi piani (6m €497, 12m €797):** **NON cancellarli** (`Subscription.plan` ha `onDelete: Restrict`). Metterli `active = false`. Il "3 mesi" esistente si può **aggiornare** a €299 invece di ricrearlo.

**Provvigioni:** impostarle sui piani nuovi (`commission*Cents`), altrimenti le vendite di lancio danno commissione zero. Si riscalano da sole sull'importo effettivamente pagato (quindi dopo lo sconto).

---

## 2. Lo sconto founding — via codice, al giorno 6

Obiettivo: al **G6** (2 giorni prima della fine prova) il cliente riceve un codice, **valido 48h**, che al checkout porta **1 mese €130 → €99** e **3 mesi €299 → €249**. Canale: **email G6 + tutor** (task dashboard G6/G7 già previsti nel piano operativo).

**Come impostare i codici è a discrezione di Simone** (personali per cliente tipo `GIULIA-FOUND`, oppure condivisi per piano con tetto usi; fissi o percentuali; come generarli e agganciarli). Deve però valere:

- **Target esatti:** il codice deve produrre **€99** sul piano da 1 mese e **€249** sul piano da 3 mesi.
  - ⚠️ **Vincolo:** un **singolo** codice non copre entrambi (i codici si applicano sull'importo, non sono agganciati a un piano; −€50 e −€31 sono importi diversi, e in percentuale idem). Serve quindi **gestione per-piano** — es. due codici fissi: **−€50 (5000)** per il 3 mesi, **−€31 (3100)** per l'1 mese — o meccanismo equivalente a scelta di Simone.
- **Scadenza reale 48h** (`DiscountCode.expiresAt`, già esistente).
- **1 uso per cliente** (`maxPerClient = 1`, già esistente).
- Sconto calcolato **sul prezzo pieno del piano** (già così nel codice: `discounts.validate` lavora sul prezzo effettivo).

Nota Omnibus: mostrando il prezzo pieno di default e applicando lo sconto solo via codice personale a scadenza, il rischio "prezzo civetta" sul negozio è basso. Resta valida la regola sull'annuncio della riduzione nelle email/comunicazioni (indicare, se serve, il prezzo di riferimento).

---

## 3. Coerenza dei numeri — ✅ verificata lato codice

Grep del repo (17/07): **nessun prezzo hardcodato** nei sorgenti backend né nei template vivi (l'unico `€249/€299` scritto è nel doc `marketing/Piano_Operativo_Lancio.md`). Il checkout usa già il prezzo dal DB e applica lo sconto sull'effettivo.

Da verificare in fase di automazione: che **email G6** e **report cliente** mostrino il numero giusto (prezzo pieno del piano + effetto del codice), pescandolo e non scrivendolo a mano.

---

## 4. Punti aperti (to-do)

1. **Prezzi pieni a DB** da Gestione Negozio: 1m 13000, 3m 29900, mantenimento 2900; **disattivare** i vecchi 6m/12m; **provvigioni** sui nuovi.
2. **Codici sconto founding** che portino a €99/€249 (meccanica a scelta di Simone, coi vincoli di §2: target esatti, 48h, 1/cliente, per-piano).
3. **Trigger G6**: invio automatico del codice via email + comparsa nel task/dashboard della tutor (2 giorni prima della fine prova).
4. **Visita nutrizionista €50** come `Product` una-tantum.
5. **Ricorrente vs una-tantum:** `28b7486` non tocca la logica di rinnovo (subscribe crea un pagamento singolo). Confermare con Simone come si rinnovano **1 mese** e **mantenimento**.
6. **Coerenza email G6 / report:** che leggano prezzo e sconto dai dati, non fissi (vedi §3).

---

## Da confermare con Antonio

- **Mantenimento "a vita" vs "finché resti attiva"** (segnalato in `CONTESTO_CHAT.md`): impatta testo offerta e prezzo bloccato.
