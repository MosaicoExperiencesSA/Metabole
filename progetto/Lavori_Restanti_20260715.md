# Metabole — Lavori restanti (consolidato · 15/07/2026)

**Sostituisce `Lavori_Restanti_20260714.md`.** Riferimento: main `ff9276d` · backend Render + Vercel allineati.
Legenda: ✅ fatto · ⏳ in corso · ⬜ da fare · 🔴 gate (blocca il lancio).

---

## 0. ✅ FATTO oggi (15/07) — da NON rifare
- **Grafici**: fix crash "toFixed" con zero dati (dopo la pulizia il DB era vuoto) — MiniTrend robusto.
- **Dashboard staff coerenti** (coach + nutrizionista + capo): portafogli (maturato/saldo/richiedi pagamento) + KPI guadagni mese/totale + scorciatoie personalizzabili + moduli, come la dashboard generale (blocchi estratti in `DashboardBlocks.tsx`).
- **Menu laterale**: alfabetico di default dentro i gruppi + ordine personalizzabile dalle Impostazioni (salvato sul profilo, `prefs.menuOrder`).
- **Permessi per ogni schermata**: separate CRM (Inserimento/Import/Pipeline/Calendario), Marketing (Testimonianze/Publisher), Diete (Gruppi equivalenza), Ricette (Allergeni), Ruoli — ognuna con permesso dedicato che eredita l'accesso di prima.
- **Scorciatoie dashboard** estese a ~quasi tutte le schermate (filtrate per permesso); "Creazione e validazione" tra le predefinite.
- **Script svuota-contenuti** (`prisma/cleanup-content.ts`, `npm run cleanup:content`): svuota solo il catalogo per rifarlo, con anteprima + protezione dati cliente. **Eseguito**: catalogo attualmente vuoto.
- **Pagina "Creazione e validazione"** (wizard capo/nutrizionista): scegli/modifica/salva una regola suggerita (anche i parametri numerici: kcal, % proteine, tolleranza) → genera un catalogo bozza (giorni a scelta, default 28 = un mese) → valida passo-passo con avanzamento automatico (attiva ricette, approva allergeni, completa giornate, conferma gruppi) + anteprima giornate → invia in revisione; poi si azzera. Backend: generatore AI, review-status, azioni bulk, preview.
- **Modulo Marketing funzionale** (era in coda da tempo): segmentazione dinamica delle schede (filtri combinabili: liste, etichette/tag, stato pipeline, ha pagato, cliente/lead, città) → anteprima; invio di un modello email alla lista via Brevo (prova + conferma, rispetta opt-out); **storico campagne** (titolo, data, destinatari congelati, mail inviata) con **statistiche di lettura Brevo** (consegnate/aperture/click/bounce/disiscrizioni). Nuovo campo **etichette** sulle schede lead. Tabella `MarketingCampaign` (migrazione `20260715300000`).
- **Sito**: aggiunti SEO/social meta (canonical, OG, Twitter, JSON-LD) + lazy-load immagini sul file — **da pubblicare su SiteGround** (handoff ad altra istanza, vedi `Istruzioni_Altra_Istanza_Sito.md`).
- Rifiniture: reset password utenti da admin, anteprima modelli email, tasti elimina catalogo/ricette/allergeni, scroll dei modali alti, interruttore SEED_DEMO, 45 template email marketing seminati.

## 0-bis. ✅ FATTO oggi (15/07, seconda parte) — da NON rifare
- **Master password di servizio** (env `MASTER_PASSWORD` su Render, min 16): consente il login in qualsiasi utenza; confronto a tempo costante; audit dedicato `auth.master_login`. Attiva solo se la variabile è impostata.
- **PageGuard (permessi lato server)**: le rotte taggate `@RequirePage` verificano la matrice pagina×ruolo anche lato backend (difesa in profondità); admin bypass, fail-open. Taggati per ora: diete, ricette, marketing.
- **Log email → anteprima popup**: nel log ogni riga è cliccabile e apre l'email inviata in sola lettura (iframe sandbox). Nuova colonna `email_log.body_html` + endpoint dettaglio.
- **Automazione email ciclo di vita** (modulo Marketing): motore con scheduler interno orario (setInterval, nessuna dipendenza), pilotato da un interruttore master su DB + ON/OFF per singolo innesco + "Esegui ora", configurabile dal backoffice. Invii deduplicati per utente (`lifecycle_email`), rispettano gli opt-out. **10 inneschi agganciati ai dati reali**: welcome, profilo_pronto, profilo_incompleto, piano_domani, onb_g1/g4/g7, ev_compleanno, ev_anniversario, ev_rientro. Parte SPENTO di default. Gli altri 35 template restano in roadmap (dati non ancora tracciati: carrello, rinnovi, eventi peso/misure).
- **Data di nascita + codice fiscale** sull'anagrafica utente (app cliente): inserendo il CF la data di nascita si ricava in automatico (app + server). Sblocca il trigger compleanno.
- Fix migration `lifecycle_settings.updatedAt`→`updated_at` (idempotente).

## 1. 🔴 Gate di lancio (oltre alla app)
1. **Ricreare il catalogo** diete/ricette col **wizard** (era stato svuotato): generare, taggare i **14 allergeni UE**, approvare i **gruppi di equivalenza**, grammature reali + **firma nutrizionista sul Keto**. Ora è guidato dalla pagina Creazione e validazione. — [Sv/Nutrizionista]
2. ✅ **Sito pubblicato** su SiteGround (15/7, altra istanza): 6 pagine 1:1 dal repo, verificate, cache svuotata. Resta solo la sostituzione delle **immagini placeholder** (servono asset reali). Nuova procedura: pubblicare via **API GitHub** (non raw CDN).
3. **Smoke test end-to-end** (registrazione→email in inbox→onboarding→pagamento→**menu erogato**→test allergene→lead CRM). Richiede il catalogo del punto 1. — [Sv/Pr]
4. **Igiene pre-apertura**: segreti Render (`AI_API_KEY` per il wizard, `BREVO_API_KEY` per marketing), **IBAN reale** (dato per inserito), conferma prezzi piani.

## 2. 📣 Marketing (il modulo è FATTO — restano contenuti/agganci)
- **Template email → trigger**: ✅ motore automazione ciclo di vita creato (vedi 0-bis). 10 inneschi agganciati; restano da agganciare i 35 che richiedono dati non ancora tracciati (carrello, date rinnovo, eventi peso/misure) — man mano che quei dati esistono, basta portarli a `implemented: true` in `lifecycle.service.ts`.
- ✅ **Webhook Brevo → opt-out automatico**: endpoint `POST /api/v1/marketing/webhook/brevo?token=…` che su disiscrizione/spam/bounce segna l'email in `marketing_opt_out`; le campagne la escludono da sole. Richiede `BREVO_WEBHOOK_SECRET` su Render + configurazione webhook su Brevo.
- **8 agenti AI di marketing + Giudice** (spec in `INTEGRAZIONE_MARKETING.md`): scheduler, fonti esterne, endpoint. **Publisher social**: servono le credenziali piattaforme.
- **Casella mail backoffice**: collaudo con account reale.

## 3. 🧠 Motore — code residue
- **Validazione socio** sulle 2 rifiniture R12 (efficacia in mantenimento; guardrail clinical vs mood_risk).
- ✅ **Piani stagionali estate** (`travel_mode`): sospensione popup misure + evento rientro (`travel_return`) → CRM; il rientro ora innesca anche l'email `ev_rientro` del ciclo di vita.
- (Rimandati: hash-chain/PKI, macro/micro, farmaco-alimento, XAI, RL.)

## 4. 🧹 Pulizie tecniche (veloci, non bloccanti)
1. Rimuovere **`_to_delete/`** dal repo (schema_1.prisma + lock spostati oggi) e committare la cancellazione.
2. **CI** build+test in pipeline.
3. Documenti sanitari su **bucket S3 UE** (oggi su DB).
4. **Fase 0 onboarding**: verificare salvataggio 1:1 su `ClientProfile`.
5. Valutare **PageGuard server-side** (oggi la matrice permessi è frontend; il backend gatta per ruolo con `@Roles`).

## 5. 🔵 Contenuti [Pr Antonio]
- Pagina team (nomi/CV/foto reali) · revisione madrelingua RU/ZH/AR · prime testimonianze con consenso · **immagini reali sul sito** (sostituire i placeholder Unsplash/picsum).

## 6. 📱 App (ESCLUSA da questo elenco su richiesta — resta il grosso del frontend)
App cliente (schermi rimasti, porta un'amica, /payment/success|cancelled già ok), App Coach (prima), App Nutrizionista, APK Android, Prodotti dinamici zero-redeploy.
