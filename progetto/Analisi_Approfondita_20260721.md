# Analisi approfondita — software Metabole (backend, app, backoffice)

**Data:** 21 luglio 2026 · Metodo: audit su architettura, sicurezza, performance, frontend/UX, test & ops.

## In una frase
La base è **più solida di quanto il flusso "fondatore + iCloud" faccia pensare**: RBAC e
controlli di proprietà ben fatti (nessun IDOR sfruttabile trovato), dati sanitari cifrati,
firma webhook Stripe verificata, migration sicure, audit log esteso. I problemi veri sono in
tre aree: **idempotenza sui pagamenti/provvigioni**, **scalabilità sugli 80k contatti**, e
**processo/ops** (test non bloccanti in CI, poca osservabilità, un backdoor password). Sotto,
tutto in ordine di priorità, con l'onestà di distinguere *bug reali* da *irrobustimenti*.

---

## 🔴 DA SISTEMARE PRESTO

### 1. Pagamenti: doppie provvigioni/entrate in caso di webhook o clic doppi
`commerce.service.ts` (finalizeApproval ~846-921) e `finance.service.ts` (generateCommissions ~81).
- L'approvazione non è **transazionale** e non è **idempotente**: se Stripe riconsegna il
  webhook (lo fa di default) o due operatori cliccano "approva", entrambi superano il controllo
  di stato e generano **due volte** entrate e provvigioni. Nessun vincolo unico impedisce il
  doppio accredito allo staff.
- Inoltre, se un passo interno fallisce a metà (es. income scritto ma provvigioni no), lo stato
  resta incoerente e **non è più recuperabile** (il retry è bloccato).
- **Fix:** aggiornamento di stato atomico (`updateMany` condizionale, prosegui solo se 1 riga) +
  transazione su attivazione+income+provvigioni, oppure chiave di idempotenza `ref=payment.id`
  su `LedgerEntry`. È il punto più importante prima di spingere sui volumi/Stripe ricorrente.

### 2. Backdoor "MASTER_PASSWORD" troppo potente e non documentato
`auth.service.ts:196-215`. Se impostata, una **sola password** entra in **qualsiasi** account —
**admin compreso** — con minimo 8 caratteri, e non è documentata in `.env.example`/`render.yaml`.
Il confronto è a tempo costante e loggato, e il login è rate-limited, quindi il brute-force da
rete è impraticabile; il rischio è la potenza + la segretezza "in testa a una persona".
- **Fix:** escludere admin (e idealmente tutto lo staff), alzare molto la lunghezza minima, o
  sostituirla con l'`impersonate` già esistente (che è scoped e non tocca gli admin). Aggiungere
  un alert sull'audit `auth.master_login`.

### 3. Secret "fail-open" invece di "fail-closed" (irrobustimento)
`auth.module.ts` (`secret ?? 'dev-only-insecure-secret'`), `commerce.service.ts:85`
(`?? 'dev-only-file-key'`), `marketing.service.ts:64`.
- **In produzione oggi è OK**: `render.yaml` imposta `NODE_ENV=production` e genera i secret
  automaticamente, quindi il fallback pubblico non entra mai in gioco. **Non è un buco attivo.**
- Ma il codice "fallisce aperto": se un domani si crea un nuovo ambiente o si sbaglia una env,
  l'app firmerebbe i token con una stringa pubblica invece di rifiutarsi di partire.
- **Fix:** richiedere i secret **sempre** all'avvio (fail-closed), senza fallback letterali.

### 4. CI: i test non bloccano il deploy e uno è già rosso
`.github/workflows/ci.yml` ha `continue-on-error: true` sui test backend: 427 test non fermano
mai la pipeline, quindi una regressione passa silenziosa. Il test rosso noto è reale
(`auth.service.spec.ts` non passa `phone`, ora obbligatorio).
- **Fix:** sistemare quel test e rendere i test **bloccanti** — così "verde" torna a significare
  qualcosa. È la rete di sicurezza che serve prima di crescere.

### 5. Il cron giornaliero è fragile e non scala
`cron.controller.ts:62-89`. ~13 lavori pesanti girano **in sequenza in un'unica richiesta**,
senza `try/catch` per-step: se il primo fallisce, **quel giorno non gira più nulla** (scadenze,
monitoraggio, report). E ognuno scandisce tutti i clienti senza paginazione → col crescere dei
clienti **supererà il timeout** di Render.
- **Fix:** `try/catch` (o `allSettled`) per ogni step + logging; spezzare in endpoint separati e
  processare a blocchi (lease/paginazione) così ripartono da dove si erano fermati.

### 6. Fuso orario: menu e "gate misure" sbagliati a cavallo di mezzanotte
`common/date-only.ts` normalizza a mezzanotte **UTC**, non su `Europe/Rome`. Per una cliente in
Italia il confine di giornata cade all'1-2 di notte: menu che compaiono/spariscono e promemoria
misure che scattano "il giorno prima/dopo" rispetto a quanto si aspetta. Per un'app nutrizionale
è un bug di correttezza reale.
- **Fix:** calcolare la giornata sul fuso `Europe/Rome`.

### 7. Scalabilità sugli 80k contatti (indici + import + campagne)
Il tavolo `CrmRecord` (80k) non ha indice su `email`/`phone`; `Subscription` non ha indice su
`endDate`. Conseguenze concrete:
- **Import liste**: cerca duplicati riga-per-riga su colonna non indicizzata → all'atto pratico
  è O(n²), minuti di esecuzione e rischio timeout sugli 80k.
- **Campagne**: carica in memoria fino a 80k destinatari e li "congela" in una colonna JSON da
  vari MB, ri-letta e ri-parsata **a ogni minuto** dal ticker; invii seriali (1 email per giro).
- **Ogni form pubblico / registrazione** fa una scansione completa della tabella.
- **Fix:** `@@index([email])` + `@@index([phone])` su CrmRecord, `@@index([status,endDate])` su
  Subscription; riscrivere l'import con caricamento in blocco + `createMany`/`updateMany`;
  paginare il segmento campagna e parallelizzare gli invii. **Da fare prima di lanciare gli 80k.**

### 8. App: si viene sloggati da soli e schermo bianco sugli errori
- **Token refresh senza "single-flight"** (`api/client.ts`): quando il token scade e partono più
  chiamate insieme (dashboard, scheda cliente), ognuna tenta il refresh; il primo revoca il
  token, gli altri falliscono → **logout in mezzo al lavoro**. Fix: un solo refresh condiviso.
- **Nessun ErrorBoundary**: un singolo errore di rendering **azzera tutta la PWA** (schermo
  bianco, nessun recupero). Fix: ErrorBoundary in cima con "ricarica".
- **Dati sanitari a ruoli commerciali**: la scheda cliente restituisce l'intero profilo
  (screening sanitario, questionario) anche a `sales`/coach, che per `sales` vede **tutti** i
  clienti. È un tema GDPR (dato particolare a chi non è clinico). Fix: selezionare i campi per
  ruolo, togliere screening/questionario ai non clinici.

### 9. Nessuna osservabilità: i guasti sono silenziosi
Niente error tracker (Sentry), niente heartbeat del cron, nessun alert se il webhook Stripe
inizia a fallire (basta un `STRIPE_WEBHOOK_SECRET` sbagliato e **i pagamenti smettono di
auto-approvarsi** in silenzio). Oggi ve ne accorgereste solo guardando le dashboard.
- **Fix:** error tracker + heartbeat cron + alert sui fallimenti webhook.

---

## 🟠 MIGLIORABILE (medio)

- **Azioni critiche via `prompt()`/`confirm()`**: cambio email, collega utenza, data inizio
  piano, correzione misure. Alcune (correzione misure) girano nell'app Capacitor, dove
  `window.prompt()` è **inaffidabile su Android/iOS** → quel flusso può non funzionare sul
  nativo. Nessuna validazione, facili errori. Fix: veri modali con campi tipizzati.
- **Messaggio chat perso se l'invio fallisce** (app cliente `Assistente.tsx`): il campo si
  svuota prima della POST e l'errore è ingoiato. (Lato staff è già corretto.) Fix: svuotare
  solo dopo il successo.
- **PDF: un Chromium nuovo per ogni PDF** (`pdf.service.ts`), sincrono nella richiesta → memoria
  e latenza, rischio OOM se più report insieme. Fix: riusare un'unica istanza browser + coda.
- **Batch notifiche giornaliero N+1**: ~20-30 query per cliente in sequenza → decine di migliaia
  di query in una richiesta al crescere dei clienti. Fix: caricamenti in blocco + `createMany`.
- **Escalation non-scoped**: una nutrizionista vede/gestisce le escalation (testo clinico) anche
  di clienti non suoi. Fix: scoping su assegnazione.
- **Enum `SubscriptionStatus` incompleto** (manca `past_due`): serve per il dunning dei rinnovi
  (Stripe ricorrente). I cast `as never` nascondono valori enum potenzialmente errati → 500 a
  runtime. Fix: aggiungere gli stati, isolare i valori enum in costanti tipizzate.
- **Etichette diete duplicate in 3 punti** e già divergenti (una scheda mostra il codice grezzo
  `keto`). Fix: un unico modulo taxonomy condiviso (meglio se alimentato dal backend).
- **Query pubbliche non cachate** su tabella 80k (`publicStats`) e ricerca CRM con ILIKE non
  indicizzata + paginazione a offset. Fix: cache + indici trigram + paginazione a cursore.
- **55 `catch` silenziosi** nel backend (best-effort): senza error tracker, uno che nasconde un
  guasto vero è invisibile. Fix: almeno un `logger.warn` dentro.

---

## 🟢 DEBITO TECNICO / MANUTENIBILITÀ (basso)

- **File "monstre"**: `commerce.service.ts` (1600 righe, 13 dipendenze), `menu.service.ts`
  (1144), `ClientDetail.tsx` (1300+). Funzionano, ma sono i candidati naturali a uno split per
  ridurre il rischio di regressioni.
- **Test: coprire i moduli scoperti**: `monitoring` (guida le offerte a pagamento), `stripe`
  (`verifyWebhook`), `discounts`, `payouts`, le due guardie auth non testate.
- **Dipendenze major indietro**: React 18→19, Vite 5→8, Prisma 6→7, Capacitor 6→8,
  firebase-admin 12→14 → finestra di upgrade post-collaudo (Capacitor e Prisma i più pesanti).
- **Processo/repo**: repo su iCloud ha già causato un drift storico dello `schema.prisma`; git
  dovrebbe essere l'unica fonte di verità. ~30 `REGISTRO_*.md` + binari/PDF nella root: meglio un
  `docs/changelog/` indicizzato e binari fuori dal repo. APK: build da CI invece dello script
  manuale con path iCloud.
- **Env non documentate**: `MASTER_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT`, `BACKOFFICE_URL`,
  `ENGINE_SIGNING_KEY` lette nel codice ma assenti da `.env.example`/`render.yaml`, con
  fallimenti silenziosi. Fix: riconciliare e rendere "rumorosi" i misconfig all'avvio.

---

## ✅ COSA È GIÀ FATTO BENE (da non "aggiustare")
- **Autorizzazione solida**: catena JwtGuard→RolesGuard→PageGuard + controlli di proprietà su
  ogni dato cliente (`assertClientAccess`, `assertThreadAccess`, `assertPatientAccess`…).
  **Nessun IDOR sfruttabile trovato.** La coach non vede i dati clinici né la chat col nutrizionista.
- **Dati sanitari cifrati** a riposo (AES-256-GCM) per documenti/ricevute.
- **Stripe**: firma webhook verificata su raw body, con idempotenza best-effort già presente.
- **Migration additive e sicure** (verificate: `linked_user_id`, `diet.recommended` non rompono
  su DB popolato). `migrate deploy` nel preDeploy, seed idempotente con guardia `SEED_DEMO`.
- **Audit log esteso** (201 punti) su azioni sensibili; CORS allowlist esplicita, rate-limit
  globale non spoofabile (`trust proxy`), helmet attivo.

---

## Ordine consigliato di intervento
1. **Idempotenza pagamenti/provvigioni** (#1) — prima di Stripe ricorrente e dei volumi.
2. **Indici + import + campagne per gli 80k** (#7) — prima del warm-up dello storico.
3. **CI bloccante + test rosso** (#4) e **cron robusto/paginato** (#5).
4. **MASTER_PASSWORD** (#2) e **secret fail-closed** (#3) — sicurezza.
5. **Fuso orario** (#6), **token-refresh single-flight + ErrorBoundary** (#8), **dati sanitari
   per ruolo** (#8/GDPR), **osservabilità** (#9).
6. Il resto (🟠/🟢) a valle, in finestre dedicate.

> Nota: questa è un'analisi tecnica per orientare le priorità. Non è un consiglio legale; sugli
> aspetti GDPR (dato sanitario ai ruoli commerciali) conviene una verifica col vostro riferimento
> privacy.
