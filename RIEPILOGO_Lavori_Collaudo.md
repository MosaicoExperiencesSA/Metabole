# Riepilogo lavori — ciclo collaudo (luglio 2026)

**Aggiornato:** 21 luglio 2026 · Origin: `8ff23e8`

Questo documento riassume tutti i lavori del ciclo di collaudo, cosa è già su GitHub,
cosa resta da pushare, la checklist post-deploy e i punti ancora aperti. Il dettaglio
tecnico di ogni voce è nei rispettivi `REGISTRO_*.md`.

---

## 1) Cosa è stato fatto (per area)

**Diagnostica & sicurezza**
- Script di audit del socio corretto ed eseguito; backend a **0 vulnerabilità npm**.
  → `REGISTRO_Diagnostica_Codebase.md`

**Feedback collaudo — Blocco 1** (cliente + motore menu)
- Cambio cibo: correzione immediata di oggi+domani+dopodomani + popup "elimina per sempre".
- Sezione "Cibi esclusi" nel profilo app.
- Chat coach/nutrizionista attiva (con aggiornamento automatico) + conversazioni passate.
- Cambio tipo dieta → rigenera i menu futuri (solo la differenza); cambio data inizio →
  cancella e riparte.
- Card "Il mio piano": data del primo menu erogato. Stili alimentari solo da diete approvate.
- Iconcina profilo (app cliente) allineata.
  → `REGISTRO_Feedback_Collaudo_Blocco1.md`

**Feedback collaudo — Blocco 2** (coordinatrice + utenze collegate)
- Dashboard e alert di team per la coordinatrice; ref code anche per la manager coach.
- Collegamento utenza cliente↔staff con switch senza logout + banner "PROFILO TECNICO".
  → `REGISTRO_Feedback_Collaudo_Blocco2.md`

**Feedback collaudo — Blocco 3** (app coach operativa)
- Scheda cliente coach: modifica dati, note, correzione misure. Lead cliccabili con scheda
  (stato pipeline + note).
  → `REGISTRO_Feedback_Collaudo_Blocco3.md`

**Consigliati stagionali**
- Flag "Consigliato" sulle diete + sezione "Consigliati" nell'app; prodotti Vacanza estiva
  e Rientro estivo con bilanciamenti da ricerca.
  → `REGISTRO_Consigliati_Estate.md` · `progetto/Consigliati_Estate_Bilanciamenti.md`

**Switch profilo — rifiniture**
- Fix `linkedUserId` restituito da login/switch (pulsante visibile subito).
- Testi pulsanti: "Passa al profilo professionale" (lato cliente); "Passa al profilo cliente"
  reso col colore del tema (era bianco, poco leggibile).

**Deliverability email (allegato 3, parte codice)**
- Disiscrizione con-un-click (header List-Unsubscribe + footer) su **campagne** e **lifecycle**.
  → `REGISTRO_Deliverability_Email.md`

**Fix vari**
- Icona profilo app staff allineata; home backoffice "Responsabile Coach" = home coach.
  → `REGISTRO_Fix_Icona_Staff_Dashboard_Coordinatrice.md`
- **Responsabile Coach** (`sales`): home coach in backoffice + ref code proprio.
  → `REGISTRO_Responsabile_Coach.md`
- Pulsante/icona switch staff col colore tema; campo "Cibi esclusi" input a tutta larghezza.
- **Stili scheda cliente** = nome della dieta (niente più codici inglesi tipo "Summer Holiday").
  → `REGISTRO_Stili_Nomi_Diete.md`

**Piani**
- Piano completo per Stripe **pagamenti ricorrenti** (decisioni, config Stripe, codice, test).
  → `progetto/Piano_Stripe_Ricorrente.md`

---

## 2) Stato push (al 21/07, origin 8ff23e8)

**Tutto pushato su GitHub — niente in sospeso.** Sono su origin: diagnostica, blocchi 1-2-3,
Consigliati, switch fix + testi pulsanti, deliverability (campagne + lifecycle), fix icona
cliente e staff, dashboard **Coordinatrice** (`coach_coordinator`), **Responsabile Coach**
(`sales`) con ref code, layout "Cibi esclusi", e allineamento **Stili = nomi diete**.

Resta solo da **deployare** (backend + backoffice + app) per vedere tutto in produzione.

**Nota ruoli:** "Coordinatrice Coach" = `coach_coordinator`; "Responsabile Coach" = `sales`.
Sono due ruoli distinti, entrambi ora con home coach + ref code.

---

## 3) Checklist POST-DEPLOY (azioni tue)

- [ ] **Migration DB**: al deploy backend gira `prisma migrate deploy` — ci sono nuove
      colonne (`user.linked_user_id`, `diet.recommended`). Verifica che siano applicate.
- [ ] **Env Render**: imposta `PUBLIC_API_URL=https://metabole-backend.onrender.com`
      (serve alla disiscrizione one-click).
- [ ] **Brevo/DNS** (fattore #1 deliverability, NON codice): autentica il dominio su Brevo
      (SPF, DKIM, DMARC tutti verdi) e invia da un indirizzo `@` del dominio, mai da Gmail.
- [ ] **Grafica PDF → Ripristina** su "Report mensile" e "Ricevuta di pagamento" (il seed non
      sovrascrive i template salvati).
- [ ] **Consigliati in produzione**: crea dal backoffice le diete `summer_holiday` /
      `summer_return` coi testi di `progetto/Consigliati_Estate_Bilanciamenti.md`, spunta
      "Consigliato" + "Visibile", componi i menu e approva (in prod il seed non li crea).
- [ ] **Posta**: se ricompaiono i timeout, gira a SiteGround gli Outbound IP di Render per la
      whitelist IMAP/SMTP.

---

## 4) Punti ancora APERTI

- **DA FARE (richiesto da Simone, quando torna):** cambiare il **ref code `morend01` → `moreno01`**
  della coach e propagarlo a **tutte le sue clienti e i suoi lead**, SENZA perdere dati (il
  refCode è su `Staff`; l'attribuzione su clienti/lead va aggiornata dove punta al vecchio
  codice — verificare `clientProfile.referralCode`/attribuzione CRM e i lead con
  `stageDates`/ref). Da fare con uno script/endpoint transazionale.
- **Allegato 3 — CHIUSO** (20/07): parte codice completa; consenso/liste coperti dai
  meccanismi CRM esistenti; resta la sola config Brevo/DNS (azione operativa).
- **Decisioni business** (per il socio): Stripe ricorrente (pagamenti automatici); durata
  mantenimento; conferma loop rientro pagato→mese gratis; strategia warm-up degli 80k
  contatti storici.
