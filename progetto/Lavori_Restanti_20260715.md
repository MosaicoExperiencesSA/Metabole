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

## 1. 🔴 Gate di lancio (oltre alla app)
1. **Ricreare il catalogo** diete/ricette col **wizard** (era stato svuotato): generare, taggare i **14 allergeni UE**, approvare i **gruppi di equivalenza**, grammature reali + **firma nutrizionista sul Keto**. Ora è guidato dalla pagina Creazione e validazione. — [Sv/Nutrizionista]
2. **Pubblicare il sito** aggiornato su SiteGround (SEO/lazy). — ⏳ [altra istanza]
3. **Smoke test end-to-end** (registrazione→email in inbox→onboarding→pagamento→**menu erogato**→test allergene→lead CRM). Richiede il catalogo del punto 1. — [Sv/Pr]
4. **Igiene pre-apertura**: segreti Render (`AI_API_KEY` per il wizard, `BREVO_API_KEY` per marketing), **IBAN reale** (dato per inserito), conferma prezzi piani.

## 2. 📣 Marketing (il modulo è FATTO — restano contenuti/agganci)
- **Template email in Brevo**: agganciare i 45 testi ai trigger transazionali (il modulo campagne usa i modelli dal DB, già pronti).
- **Webhook Brevo → opt-out automatico** sulle disiscrizioni (oggi mostriamo il conteggio; l'auto-esclusione futura richiede il webhook, config su Brevo). Miglioria consigliata.
- **8 agenti AI di marketing + Giudice** (spec in `INTEGRAZIONE_MARKETING.md`): scheduler, fonti esterne, endpoint. **Publisher social**: servono le credenziali piattaforme.
- **Casella mail backoffice**: collaudo con account reale.

## 3. 🧠 Motore — code residue
- **Validazione socio** sulle 2 rifiniture R12 (efficacia in mantenimento; guardrail clinical vs mood_risk).
- **Piani stagionali estate** (`travel_mode`): sospensione popup misure, evento rientro → CRM.
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
