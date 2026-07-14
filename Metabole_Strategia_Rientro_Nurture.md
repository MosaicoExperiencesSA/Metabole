# Metabole — Strategia: rientro 20.000 clienti + nurture 80.000 lead

Riattivare la base storica (clienti della vecchia app) e riscaldare i lead mai convertiti, in modo **conforme** e **misurabile**, sfruttando la nuova proposta (persone vere + AI Gaia) e i canali già previsti (email Brevo, social, CRM).

---

## 0. ⚠️ Prima di tutto: base giuridica (LPD/GDPR)

Sono **contatti storici**: prima di inviare qualsiasi comunicazione va verificata la **base legale**.
- **Clienti (20.000):** rapporto contrattuale pregresso → in genere si può contattare per servizi **analoghi** (soft opt-in), **sempre** con opt-out chiaro e rispettando eventuali revoche. Verificare i **registri di consenso** e le suppression list.
- **Lead (80.000):** serve **consenso marketing valido**. Se manca o è vecchio/incerto → **campagna di re-permission (re-opt-in)** come primo passo; chi non riconferma **non** si contatta più a fini marketing.
- In ogni email: mittente identificato, motivo del contatto, link disiscrizione, riferimento privacy. Pulire prima le liste (email non valide, hard bounce, unsubscribe storici).

> Regola operativa: **niente invii massivi finché non sono a posto** consensi + SPF/DKIM/DMARC (vedi checklist go-live).

---

## 1. Obiettivi e KPI

| Traccia | Obiettivo | KPI primari |
|---|---|---|
| Rientro clienti | Riattivare abbonamenti dormienti | tasso di riattivazione, ricavo da rientro, costo per rientro, churn dopo rientro |
| Nurture lead | Convertire lead storici in clienti | re-opt-in rate, lead→cliente, tempo di conversione, ricavo |
| Trasversali | Salute della lista | deliverability, open/click, unsubscribe, spam complaint |

---

## 2. Segmentazione

**Clienti (20.000) — per recenza e motivo di uscita:**
- **Caldi** (churn < 6 mesi): ricordano il brand → offerta di rientro diretta.
- **Tiepidi** (6–18 mesi): serve un richiamo emotivo + novità (nuova app, AI + persone vere).
- **Dormienti** (> 18 mesi): prima ri-contatto soft ("è cambiato tutto"), poi offerta.
- Sotto-segmenti utili: per **prodotto** seguito, per **motivo di abbandono** (costo, tempo, risultati, vita), per **stagione** (chi lasciava d'estate → hook rientro settembre).

**Lead (80.000) — per stadio e fonte:**
- **Mai contattati / freddi** → re-permission + valore.
- **Contattati non convertiti** (avevano interesse) → obiezioni note (prezzo/tempo) da sciogliere.
- Per **fonte/campagna** (utm) e **interesse** (dimagrimento, menopausa, post-gravidanza, sportivo…) → contenuti coerenti col segmento.

---

## 3. Offerta e messaggi

- **Angolo centrale:** "È cambiato tutto: ora c'è un'AI (Gaia) **insieme** a coach e nutrizionista veri." Non un'altra dieta: un percorso che capisce le tue giornate.
- **Clienti (rientro):** percorso di rientro dolce (riusa i protocolli *Ritorno in Equilibrio* / stagionali), **prima visita/valutazione** inclusa, continuità con lo storico ("ripartiamo da dove eri"). Eventuale vantaggio di rientro (giorni extra / condizione riservata) — **senza numeri/promesse nei contenuti social**, l'offerta sta nell'email 1:1.
- **Lead (nurture):** prima **valore** (educazione: fame vera/emotiva, porzioni, cultura del cibo), poi **prova** (come funziona, assaggio menu), poi **soft offer** (valutazione iniziale).
- Coerenza con i **segmenti di cura**: menopausa, pre/post-gravidanza, sportivo, pre-matrimonio → contenuti dedicati.

---

## 4. Canali

- **Email (Brevo)** — canale principale per entrambe le tracce (sequenze automatizzate).
- **SMS** — solo per segmenti caldi/alta intenzione e con consenso (promemoria offerta, scadenza).
- **Social retargeting** — custom audience da liste (hash email) su Meta: rinforza le email con le **vignette** del Lotto 1.
- **WhatsApp/Telegram** — solo con consenso esplicito, per i più caldi (1:1 della coach).
- **Sito** — landing di rientro dedicata (riusa il form lead → CRM).

---

## 5. Sequenze (bozza)

### A. Rientro clienti (durata ~3–4 settimane)
1. **E1 — "Bentornata, è cambiato tutto"**: cosa c'è di nuovo (app + Gaia + persone vere). Nessuna pressione, solo curiosità. CTA: scopri.
2. **E2 — Empatia**: "le giornate storte non rovinano il percorso" (vignetta #5). Valore + fiducia.
3. **E3 — Offerta di rientro**: valutazione/prima visita + percorso di rientro dolce. CTA: riparti.
4. **E4 — Ultima chiamata**: scadenza gentile dell'offerta. Poi: chi non reagisce → newsletter mensile (no pressione).
- *SMS opzionale* tra E3 ed E4 per i caldi.

### B. Nurture lead (durata ~4–6 settimane)
1. **E1 — Re-permission + benvenuto**: chi siamo oggi, conferma il consenso. (Chi non conferma → stop.)
2. **E2 — Educazione 1**: fame vera vs emotiva (carosello #2).
3. **E3 — Educazione 2**: porzioni / cultura del cibo (per ogni tavola).
4. **E4 — Prodotto**: come funziona (app: misure → l'AI propone → nutrizionista valida) + assaggio menu.
5. **E5 — Prova sociale**: testimonianza conforme (#10) + "per ogni cultura".
6. **E6 — Soft offer**: valutazione iniziale / parliamone. Poi → newsletter mensile + retargeting.

---

## 6. Email per stato (aggancio al CRM e all'agente)

Le sequenze si innestano sugli **stati** già presenti (dettaglio operativo = agenda del 15/7, punto D):
- **Pipeline CRM:** nuovo → contattato → qualificato (MQL) → opportunità (SQL) → cliente → **a rischio** → **churn** → **in rientro**. A ogni transizione un'email dedicata (es. "a rischio" → email di ritenzione; "churn" → entra nella sequenza rientro A).
- **Stati agente dieta** (per i clienti attivi): pre-evento, post-evento, plateau, conforto, rientro → email/notifiche di accompagnamento coerenti con lo stato.
- **Trigger comportamentali:** apertura/click, visita landing, form compilato → passaggio di stadio e sequenza corretta.

---

## 7. Piano operativo (ordine consigliato)

1. **Igiene liste + consensi** (clienti e lead) e verifica deliverability (SPF/DKIM/DMARC).
2. **Re-permission lead** (E1 traccia B) → costruisce la lista contattabile pulita.
3. **Rientro clienti caldi** (traccia A) → risultato rapido, valida i messaggi.
4. Estendere a tiepidi/dormienti e completare il nurture lead.
5. **Retargeting social** con le vignette a supporto delle email.
6. Misura, tieni ciò che converte, sospendi ciò che non rende (l'Analista chiude il cerchio).

---

## 8. Compliance dei contenuti
Come per tutto il marketing: **no prima/dopo**, no numeri/tempi/garanzie nei contenuti pubblici, no seconda persona su attributi fisici, tono di cura, **18+**; ogni pezzo passa dal **Giudice**. Le offerte con condizioni economiche stanno nelle **email 1:1**, non nei post.

---

### In una riga
Prima si **mette in regola** consenso e deliverability; poi **re-permission dei lead** e **rientro dei clienti caldi**, con email a sequenza agganciate agli stati CRM/agente e rinforzate dalle vignette in retargeting — misurando riattivazione e conversione, sempre conformi.
