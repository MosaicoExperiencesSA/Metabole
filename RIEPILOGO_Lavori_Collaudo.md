# Riepilogo lavori — ciclo collaudo (luglio 2026)

**Aggiornato:** 21 luglio 2026 · Origin: `181c738` (+ Blocco 5 analisi in commit, da pushare)

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

**Analisi approfondita software/app (21/07)** — interventi sui punti emersi dall'analisi
(escluso il #6 fusi orari, come richiesto):
- **Blocco 1** — Cambio password cliente da admin (l'admin scrive la nuova password; operazione
  abilitabile ad altri ruoli dalla tabella Permessi, chiave `set_client_password`) + tabella
  **Utenti** impaginata come Permessi (scorrevole, header fisso).
- **Blocco 2** — Robustezza: secret JWT/prefs **fail-closed** (niente fallback insicuro),
  refresh token **single-flight**, **ErrorBoundary** globale su app e backoffice.
  → `REGISTRO_Analisi_Blocco2_Robustezza.md`
- **Blocco 3** — Dati sanitari (screening/questionario/consensi) **riservati allo staff clinico**
  nella scheda cliente (GDPR art. 9). → `REGISTRO_Analisi_Blocco3_Dati_Sanitari_Ruolo.md`
- **Blocco 4** — Approvazione pagamenti **idempotente** (claim atomico): niente doppie
  provvigioni/entrate da webhook Stripe ripetuti o doppio clic.
  → `REGISTRO_Analisi_Blocco4_Pagamenti_Idempotenti.md`
- **Blocco 5** — Scalabilità 80k: **indici** su CRM (email/telefono) e abbonamenti
  (status+scadenza). Import già completato → riscrittura import esclusa dallo scope.
  → `REGISTRO_Analisi_Blocco5_Indici.md`
- **Blocco 6** — **Rimozione MASTER_PASSWORD**: eliminata la password globale che entrava in
  qualsiasi account (admin compreso). Per l'assistenza si usa l'impersonazione già esistente
  (scoped, no admin, audit). → `REGISTRO_Analisi_Blocco6_Master_Password.md`
- **Blocco 7** — **Robustezza cron + osservabilità**: ogni job notturno isolato (un errore non
  blocca più gli altri), **heartbeat** sempre registrato (durata/esiti/fallimenti), webhook
  Stripe falliti tracciati e rilanciati (retry). Sentry esterno rimandato.
  → `REGISTRO_Analisi_Blocco7_Cron_Osservabilita.md`
- **Blocco 8** — **CI bloccante + fix test rosso**: sistemato `auth.service.spec` (telefono ora
  obbligatorio) e resi i test **bloccanti** (tolto `continue-on-error`). Suite completa da
  confermare nella CI (serve Prisma generato). → `REGISTRO_Analisi_Blocco8_CI_Test.md`

---

## 2) Stato push (al 21/07, origin `d4729c8`)

**Tutto pushato su GitHub — niente in sospeso.** Ci sono: diagnostica, blocchi 1-2-3,
Consigliati, switch fix + testi/colori pulsanti, deliverability (campagne + lifecycle),
Coordinatrice + Responsabile Coach con ref code, layout "Cibi esclusi", Stili = nomi diete,
notifica push chat, ref code digitabile.

Resta solo da **deployare** (backend + backoffice + app) per vedere tutto in produzione.

**In commit, da pushare:** interventi analisi approfondita — Blocco 1 (cambio password cliente
+ tabella Utenti scorrevole), Blocco 2 (robustezza), Blocco 3 (dati sanitari per ruolo),
Blocco 4 (pagamenti idempotenti), Blocco 5 (indici scalabilità), Blocco 6 (rimozione
MASTER_PASSWORD), Blocco 7 (robustezza cron + osservabilità), Blocco 8 (CI bloccante + fix test).
Blocchi 1/2/3/4 già su GitHub; da pushare Blocco 5, 6, 7 e 8.

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
- [ ] **Migration indici (Blocco 5)**: al deploy backend `prisma migrate deploy` applica
      `20260721170000_scale_indexes` (indici CRM email/telefono + subscription status/scadenza).
- [ ] **Permesso "Imposta password cliente"**: di default è dell'admin. Se vuoi darlo anche ad
      altri ruoli, backoffice → Permessi → spunta `set_client_password`.

---

## 4) Punti ancora APERTI

### Analisi approfondita — punti non ancora fatti
- **#9 — Sentry (parte esterna)**: error-tracking esterno rimandato (serve dipendenza +
  `SENTRY_DSN`). Heartbeat cron e audit `payments.webhook_failed` già fatti (Blocco 7).
- **#6 — Fusi orari**: **escluso** su tua richiesta.

> Tutti gli altri punti dell'analisi (tranne il #6) sono stati fatti: vedi Blocchi 1-8. Restano
> solo la parte **esterna** di Sentry (config, non codice) e il #6 escluso.


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
