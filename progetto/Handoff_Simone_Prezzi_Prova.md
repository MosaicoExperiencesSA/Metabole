# Handoff Sviluppo — Prezzi, Prova gratuita, Report, Task coach

Documento di sintesi per **Simone**. Cosa cambia e cosa va costruito per il lancio.
Riferimenti: `progetto/STATO_LANCIO.md` (via libera 16/07) · `percorsi/METODO_MOTORE_INTELLIGENTE.md` (12 regole).

---

## 1. Nuova struttura prezzi ⚠️ **sostituisce quella a DB**

| Prodotto | Listino | Lancio (founding) | Tipo |
|---|---|---|---|
| **Prova gratuita** | — | **€0 · 8 giorni = 4 menu** | trial, senza carta |
| **1 mese** | €130 | **€99** | rinnovabile |
| **3 mesi** | €299 | **€249** | una tantum (consigliato) |
| **Mantenimento** | — | **€29/mese** | ricorrente |
| **Visita nutrizionista** | — | **€50** | una tantum, in app (emergenze/patologie) |

⚠️ **Oggi a DB ci sono €297 / €497 / €797: vanno sostituiti.** Stripe LIVE prende i prezzi dal DB (nessun prodotto su Stripe), quindi basta aggiornare i piani a DB.
⚠️ Il **report cliente** già pronto cita €249/€299: dopo l'allineamento i numeri combaciano. **Nessun prezzo deve differire tra email, report e checkout.**

**Da gestire:** prezzo di listino + prezzo promo con **data di scadenza** (il "founding" deve poter finire), così il barrato €299→€249 è vero.

---

## 2. Prova gratuita (8 giorni)

- **Senza carta** (massimizza le attivazioni).
- Durata **8 giorni = 4 menu × 2 giorni** (coerente con il ciclo bigiornaliero, R10).
- **Misure iniziali obbligatorie al giorno 0**: senza punto A non esiste il report A→B.
- Scadenza automatica a fine giorno 8.
- **Dopo la prova, il profilo personalizzato (ciò che Gaia ha imparato) resta salvato 7 giorni, poi si cancella davvero.** È la leva di conversione più forte e **deve essere vera**: serve un job di purge + l'evento relativo.

**Stati da tracciare:** `trial_started` · `trial_measures_ok` · `trial_day6_offer_sent` · `trial_converted` · `trial_expired` · `profile_purged`.

---

## 3. Codici sconto personali

- Codice per cliente (es. `GIULIA-FOUND`) con **scadenza** (48h dall'invio al giorno 6).
- Validazione al checkout; se scaduto → prezzo pieno, senza sorprese.
- Il codice compare nell'email del giorno 6 e nel report.

---

## 4. Report di fine piano (automatico)

Va generato **a ogni fine piano, inclusa la prova gratuita**, da motore + CRM. Modello già pronto: `marketing/report_cliente/MetaboleAI_Report_Cliente.pdf`.

**Dati da pescare:** misure A→B (peso, vita, fianchi) · aderenza (giorni e pasti) · traiettoria verso l'obiettivo · **"cosa ha imparato Gaia su di te"** (metodo, gusti, adattamenti, eventi gestiti, ritmi, cotture) · coach assegnata (nome reale) · obiettivo · offerta + codice personale.

**Consegna: IN APP** (o link protetto), **non allegato a email/WhatsApp** — sono **dati sanitari**. L'email/notifica contiene solo l'avviso + link.

**Attenzione:** nomi **dinamici** (cliente e coach dalla loro anagrafica), mai fissi.

---

## 5. Task/notifiche per la coach (dashboard)

La coach deve **vedere cosa fare e quando**, non ricordarselo. Servono task con **scadenza e stato** (da fare / fatto / saltato), generati in automatico:

| Quando | Task per la coach |
|---|---|
| Prova G0 | Verifica che abbia inserito le **misure iniziali** |
| Prova **G1** | **Messaggio personale di benvenuto** (obbligatorio — è il momento che decide tutto) |
| Prova G4 | Senti come va **se aderenza < 70%** |
| Prova G7 | WhatsApp: "domani finisce, ti va di continuare?" |
| Fine piano | Consegna il **report** e proponi rinnovo/mantenimento |
| Post-prova +7 | Ultima chiamata (solo ex clienti / lead caldi) |

Utile anche un contatore in dashboard: prove attive, in scadenza oggi/domani, non convertite.

---

## 6. Tracciamento funnel (per misurare)

Eventi minimi per sapere se funziona: **raggiunti → prova attivata → convertiti → rinnovi → mantenimento**, con segmento di provenienza (ex cliente / lead caldo / lead freddo) e canale (email / WhatsApp / retargeting / coach).

---

## 7. Consensi e canali (GDPR)

- **Consenso marketing** sul lead/cliente + **preferenze canale** (email, WhatsApp, SMS) + disiscrizione sempre facile.
- Inviare **solo** a chi ha base giuridica valida; per i contatti vecchi serve **ri-opt-in**.
- Nota: il DB storico ha ~80.000 lead e ~10.000 ex clienti — mai lavorati con email. Prima di aprire i rubinetti servono **warm-up del dominio** e liste pulite, altrimenti si brucia l'asset.

---

## Priorità consigliata

1. **Prezzi a DB** (blocca tutto il resto: email, report e checkout devono dire lo stesso numero).
2. **Prova 8 giorni** + misure obbligatorie + purge a 7 giorni.
3. **Task coach in dashboard** (senza, la conversione crolla: il G1 è decisivo).
4. **Report automatico** in app.
5. **Codici sconto** con scadenza.
6. **Tracciamento + consensi**.

Dettaglio operativo di sequenze e tempi: `marketing/Piano_Operativo_Lancio.md`.
