# Riepilogo lavori — ciclo collaudo (luglio 2026)

**Aggiornato:** 21 luglio 2026 · Origin: `d4729c8`

Questo documento riassume tutti i lavori del ciclo di collaudo, cosa è già su GitHub,
la checklist post-deploy e i punti ancora aperti. Il dettaglio tecnico di ogni voce è nei
rispettivi `REGISTRO_*.md`.

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
- Testi/colori pulsanti: "Passa al profilo professionale" (cliente); "Passa al profilo cliente"
  col colore tema. Icona profilo app staff allineata.

**Deliverability email (allegato 3, parte codice)**
- Disiscrizione con-un-click (header List-Unsubscribe + footer) su **campagne** e **lifecycle**.
  → `REGISTRO_Deliverability_Email.md`

**Ruoli staff**
- Home backoffice "Responsabile Coach" (`sales`) = home coach + ref code proprio; dashboard
  Coordinatrice (`coach_coordinator`) = coach con alert di team.
  → `REGISTRO_Responsabile_Coach.md` · `REGISTRO_Fix_Icona_Staff_Dashboard_Coordinatrice.md`

**Altri fix**
- Campo "Cibi esclusi": input a tutta larghezza sopra il pulsante.
- **Stili scheda cliente** = nome della dieta (niente più codici inglesi tipo "Summer Holiday").
  → `REGISTRO_Stili_Nomi_Diete.md`
- **Chat**: notifica push alla cliente a **ogni** risposta di coach/nutrizionista (anti-raffica 3 min).
  → `REGISTRO_Notifica_Chat_Risposta.md`
- **Ref code coach digitabile** dal backoffice (imposti un codice a scelta; attribuzioni per
  id → nessun dato perso). → `REGISTRO_Ref_Code_Custom.md`

**Piani**
- Piano completo per Stripe **pagamenti ricorrenti** (decisioni, config Stripe, codice, test).
  → `progetto/Piano_Stripe_Ricorrente.md`

---

## 2) Stato push (al 21/07, origin `d4729c8`)

**Tutto pushato su GitHub — niente in sospeso.** Ci sono: diagnostica, blocchi 1-2-3,
Consigliati, switch fix + testi/colori pulsanti, deliverability (campagne + lifecycle),
Coordinatrice + Responsabile Coach con ref code, layout "Cibi esclusi", Stili = nomi diete,
notifica push chat, ref code digitabile.

Resta solo da **deployare** (backend + backoffice + app) per vedere tutto in produzione.

---

## 3) Checklist POST-DEPLOY (azioni tue)

- [ ] **Migration DB**: al deploy backend gira `prisma migrate deploy` — nuove colonne
      (`user.linked_user_id`, `diet.recommended`). Verifica che siano applicate.
- [ ] **Env Render**: `PUBLIC_API_URL=https://metabole-backend.onrender.com` (disiscrizione one-click).
- [ ] **Push (FCM)**: impostare `FIREBASE_SERVICE_ACCOUNT` su Render → così le notifiche push
      (incl. "la coach ti ha risposto") arrivano sul telefono. Senza, restano solo in-app.
- [ ] **Ref code MOREND01 → MORENO01**: dopo il deploy backoffice → Utenti → coach → ↻ → scrivi
      MORENO01. Sicuro (attribuzione per id, nessun dato perso).
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

- **Notifiche push (FCM) — da configurare** (backlog #4, setup nativo lato Simone): il codice
  c'è, manca solo `FIREBASE_SERVICE_ACCOUNT` su Render + app con permesso notifiche.
- **Allegato 3 — CHIUSO** (20/07): parte codice completa; resta la sola config Brevo/DNS.
- **Decisioni business** (per il socio): Stripe ricorrente (piano pronto in
  `progetto/Piano_Stripe_Ricorrente.md`, servono le 7 decisioni Parte A); durata mantenimento;
  conferma loop rientro pagato→mese gratis; strategia warm-up degli 80k contatti storici.

### Backlog più ampio (non urgente, in memoria di progetto)
Notifiche push "complete" (tutti gli avvisi del widget mascotte), modulo Marketing campagne
con segmenti dinamici + storico, UI coach "registra cliente / link+QR", video di presentazione
coach, login social (Google/Apple). Dettagli in memoria `metabole-backlog.md`.
