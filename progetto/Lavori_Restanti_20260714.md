# Metabole — Lavori restanti (consolidato · 14/07/2026 sera)

**Fonti:** `Relazione_Cosa_Manca_20260714.md` + `Metabole_Handoff_Sessione_20260714.md` + sessione Cowork del 14/07 (sprint go-live) + nuova richiesta di Simone (regola ripetizione bigiornaliera, §2). **Sostituisce le liste precedenti.**
**Riferimento:** main `94015c4` · backend live (`/health` ok) · deploy Render allineato.

---

## 0. Fatto e verificato — da NON rifare

- Backend M1–M10 **+ motore R8–R12 completo** (E1→E5 + rifiniture R12) live; posta staff, pagamenti/contabile (approva/rifiuta/elimina, auto-annullo bonifici), report contabilità PDF/CSV.
- **Contatori con base storica** live e verificati: `/public/stats` → `{clients:18983, reached:85232, methods:4, years:20}`.
- **Stripe LIVE configurato** (14/07 pomeriggio): chiave `sk_live` dedicata + webhook `checkout.session.completed` → `/api/v1/payments/webhook`, segreti in Render, redeploy ok. **Non** servono prodotti/prezzi in Stripe (il checkout usa `price_data` inline col prezzo del piano dal DB). Manca solo il pagamento reale di prova (§1.2).
- Vercel: app cliente e backoffice live e puntati al backend prod (verificato nel bundle). DNS email Brevo ok (SPF, DKIM brevo1/2, DMARC, brevo-code).
- Pulizie: `app/.env.example` ✅, `schema_1.prisma` rimosso ✅ (residuo: §6.1). Backoffice: permessi completi, moduli dashboard, scheda lead, filtro categoria Segnalazioni ✅.

## 1. 🔴 Gate di lancio (in ordine — bloccano l'apertura)

1. **Ripubblicare il sito su SiteGround** — il repo è avanti di 2 versioni rispetto al live (galleria app `33a48bd` + restyling box/MetaboleAI® `4a42f71`); è cambiato solo `Metabole_Sito_Presentazione.html` → da ricopiare solo `index.html` + svuotare Cache Dinamica. Procedura collaudata — [Claude su richiesta]
2. **Pagamento reale di prova** (piano più economico, carta di Simone) → webhook live consegnato con 200 + abbonamento attivo + contabilità/CRM aggiornati. Consigliato PRIMA: verificare/creare le pagine **`/payment/success` e `/payment/cancelled`** nell'app (oggi il redirect Stripe rischia un 404 visivo; l'attivazione via webhook funziona comunque). Dopo il test: rimborso dal pannello Stripe + sistemazione a mano dell'abbonamento di prova (il rimborso non lo disattiva). — [Simone, previsto 15/07]
3. **Smoke test end-to-end** (`Metabole_Smoke_Test.md`): registrazione → email **in inbox** (chiude la verifica Brevo/DNS) → onboarding → pagamento reale (=punto 2) → menu erogato → test allergene (blocco + segnalazione `diet_blocked`) → lead nel CRM. — [Simone+Antonio, Claude per i collaudi API]
4. **Igiene pre-apertura**: cancellare il lead di prova "Test GoLive Claude" (simone.salogni+lead-golive@gmail.com); verificare segreti Render (`ADMIN_*`, `CORS_ORIGINS`, eventuale `AI_API_KEY`); **IBAN reale** in `bank_transfer_details` (oggi placeholder); conferma prezzi piani/prodotti; **riallineare `progetto/STATO_LANCIO.md`** (segna ancora "base contatori ⬜" e "E2–E5 da fare": sono fatti).

## 2. 🆕 Nuove richieste (Simone, 14/07 sera)

### 2.1 Regola motore menu — ripetizione bigiornaliera decisa dal nutrizionista

**Cosa:** il nutrizionista può decidere che il menu di una cliente si ripete per 2 giorni consecutivi: il giorno 2 usa **gli stessi alimenti** del giorno 1 ma con **ricetta/preparazione diversa**, scelta **automaticamente dal motore** (nessun lavoro manuale oltre al flag).

**Design proposto:**
- Flag per cliente (es. `menu_repeat_two_days`, deciso dal nutrizionista dalla scheda cliente nel backoffice) + default in `config_param`; mai hardcode.
- In `MenuService`: col flag attivo, il giorno 2 del ciclo non si compone da zero — per ogni pasto del giorno 1 il motore cerca nella **base personale** (`ClientMenuPool`, così la sicurezza allergie resta garantita) una ricetta "gemella": stessi alimenti principali (gruppi di equivalenza/ingredienti primari), kcal in banda (tolleranza in `config_param`), **metodo di cottura diverso** — riusa il concetto "2 cotture" R5/R6 già presente in `cycle.service`.
- Fallback senza gemella: si ripete la stessa ricetta (mai uscire dalla base sicura); segnalazione soft se succede spesso (pool povero su quello slot).
- Coerenza: gate misure del 2° giorno invariato; la penalità di ripetizione `menu_penalty_repeat` non deve punire la ripetizione voluta (escludere la coppia del ciclo corrente dal conteggio); gradimento ciclo resta min/max come in E3.
- Nuovi `config_param`: `menu_repeat_two_days_default` (off), `repeat_twin_kcal_tolerance_pct` (es. 10).

**Da validare col socio** (il motore è dominio suo): definizione operativa di "stessi alimenti" (gruppo di equivalenza vs ingredienti identici), fallback preferito, flag per cliente vs per prodotto. **Stima:** piccola/media (backend + toggle backoffice + test + riga informativa in app). — [Sv/Claude]

### 2.2 Liste CRM — Fase A (liste manuali) ✅ + Fase B (import storico) ✅ FATTE (in attesa di push)

**Cosa:** poter raggruppare lead e clienti in **liste create manualmente** dal backoffice; le viste CRM (Gestione lead, clienti) mostrano **tutti insieme o filtrati per lista**; nel **dettaglio** del lead/cliente la lista compare come badge accanto a "CRM: paid". In più, **import delle liste storiche esistenti** di Simone: per ogni contatto importato si salvano — visibili nello stesso punto della scheda — lo **stato precedente** (dallo storico pre-Metabole) e il **totale già pagato** da quel cliente.

**Design proposto:**
- Entità `CrmList` (nome, descrizione, colore?) + relazione N:N con `CrmRecord` (un contatto può stare in più liste; da confermare). CRUD liste solo manuale (niente automatismi in questa fase).
- Backoffice: gestione liste; filtro "Lista" nelle viste lead/pipeline (default: tutte); assegnazione dalla scheda e in massa (selezione multipla).
- Scheda lead/cliente: badge lista accanto allo stato CRM; sezione storico con `previous_status` e `historical_paid` (testo/etichetta + importo).
- **Import** (CSV/XLSX dal backoffice): crea/aggancia la lista, match per email sui contatti esistenti (altrimenti crea lead), popola `previous_status` e `historical_paid_cents`. Il totale storico resta **separato dalla contabilità Metabole** (non inquina report/KPI/provvigioni) — è informativo sulla scheda.
- Nota GDPR: per l'import di dati personali storici verificare base giuridica/consensi (i contatti arrivano da prodotti precedenti di Mosaico).

**Stima:** media (migrazione + backend CRUD/filtri/import + backoffice UI). Sinergia con il modulo Marketing (§4): le liste possono fare da base ai futuri "segmenti". — [Sv/Claude]

## 3. 🧠 Motore — code residue (niente codice mancante salvo §2)

- **Validazione socio** sulle 2 rifiniture R12: ① mantenimento = efficacia azzerata (`menu_maintenance_w_eff=0`) vs ridotta; ② guardrail motore/chat sensibile/calo rapido tutti in `clinical` (solo nutrizionista) vs chat sensibile come `mood_risk` (coach). Ritocchi piccoli se cambia idea.
- **Operativo nutrizionista nel backoffice** (sblocca i prodotti col motore pieno): tagging **14 allergeni UE** sulle ricette Mediterranea + Keto (118); approvazione **gruppi di equivalenza** (23 in seed); grammature reali + **firma sul percorso Keto**.
- **Piani stagionali estate** (`Metabole_Piani_Estate.pdf`): segnale `travel_mode` con date, sospensione popup misure, evento `rientrato` → CRM. Sviluppo piccolo/medio, riusa gli stati agente.
- **Rimandati esplicitamente** (D3/Analisi §6): hash-chain/PKI con auditor, macro/micronutrienti, farmaco-alimento, XAI, RL con guardrail.

## 4. 📱 Frontend / App (il grosso dello sviluppo)

- **App cliente**: schermi rimasti della nuova navigazione (27–28 video, 29 e 33 con contenuti reali); schermata **"porta un'amica"** (backend referral pronto) + notifica alla referrer; pagine `/payment/success|cancelled` (vedi §1.2) e `APP_URL` se serve; **APK Android** quando si distribuisce (`docs/APK_Build_Guida.md`).
- **App Coach** (front-end; backend `/coach/*` completo, prototipi pronti). Include UI "registra cliente / mio link+QR". **Prima della Nutrizionista (deciso).**
- **App Nutrizionista** (front-end; backend `/nutritionist/*` completo: cartella clinica cifrata, validazioni, televisite).
- **Backoffice**: modulo **Marketing funzionale** (campagne, segmenti, KPI, consensi — ruoli/menu pronti); valutare **PageGuard server-side** (oggi matrice permessi solo frontend, backend con guardie statiche per ruolo).
- **Prodotti dinamici / zero-redeploy** (spec `Metabole_Spec_Prodotti_Dinamici_Sviluppo.md`): entità Product + wizard backoffice + pagina 16 app su `GET /products?active=1`. Primo filone dopo i gate.

## 5. 📣 Marketing (dopo i gate)

- **48 email automatiche**: copy pronta → tradurre + template Brevo agganciati ai trigger. [Sviluppo, consistente]
- **Servizio Giudice** (ruleset in `config_param`) + endpoint agenti; **Publisher social** (stub, servono le credenziali piattaforme); **casella mail backoffice**: collaudo con account reale.
- **Contenuti [Pr] Antonio**: pagina team (nomi/CV/foto reali); revisione madrelingua RU/ZH/AR (estratto pronto in `marketing/Traduzioni_Revisione_RU_ZH_AR.md`, manca il revisore); prime testimonianze con consenso.

## 6. 🧹 Pulizie tecniche (veloci, non bloccanti)

1. Rimuovere **`_to_delete/schema_1.prisma`** dal repo (è entrata nel commit `ba16168`: eliminare la cartella e committare la cancellazione).
2. CI build+test in pipeline; valutare migrazione documenti sanitari a **bucket S3 UE**; **fase 0** ancora 🟡: verificare che ogni risposta dell'onboarding salvi 1:1 su `ClientProfile`.

## 7. 📦 Backlog minore (al momento giusto)

Notifiche push complete (FCM/APNs, config native col device; `push.service` già pronto a spegnersi da solo); video di presentazione coach (S3/R2 + `intro_video_url`); login social Google/Apple (dopo account Apple Developer); permessi con pulsante Salva; assegnazione lead a tempo; numero versione visibile in app; avatar/menu utente in alto.

## 8. 🗺️ Ordine consigliato

§1 (gate, chiudibili in giornata salvo contenuti) → §2 nuove richieste (regola ripetizione + liste CRM con import storico) + validazioni socio R12 + tagging allergeni (sbloccano il motore pieno) → App Coach → prodotti dinamici → email Brevo → App Nutrizionista → Giudice/Publisher → backlog (§7).

## 9. ⚙️ Regole operative (invarianti)

Cowork non pusha: file su iCloud → Simone committa/pusha (sempre Summary+Description; confrontare i file con GitHub HEAD prima di scrivere). Mai git via device_bash; mai "Stash changes" sui conflitti del diario. STATO.md+REGISTRO.md a ogni modifica. Repo PUBBLICO e `docs/` pubblica: niente segreti/dati personali. Type-check vero su Render: controllare il deploy dopo ogni push. Collaudi API via Chrome (tab dedicato), account di prova `simone.salogni+*@gmail.com`. Il motore è dominio del socio: proporre e far validare. Cataloghi mai mischiati (regola ferrea n.1).
