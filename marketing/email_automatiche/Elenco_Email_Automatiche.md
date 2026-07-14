# Metabole — Email automatiche (elenco di lavoro)

Registro delle email automatiche (triggered) che stiamo preparando. Ogni riga = una email, con **evento** che la fa partire, **oggetto**, **testo** (sintesi; copy completa in `../Metabole_Email_Ciclo_Vita.md`), **segmento**, **timing** e **stato**.

**Legenda stato:** ⚪ da progettare · 🟡 copy in bozza · 🟢 copy pronta · 🔵 da tradurre (9 lingue) · ⬛ template Brevo da costruire · ✅ live.
**Ogni email** passa dal **Giudice** (compliance) prima dell'invio; nessun invio senza consenso; no claim medici; niente numeri di peso nel testo.

---

## 1. Attivazione (lead → cliente)

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| WELCOME | Registrazione | Benvenuta in Metabole, {{nome}} | Cosa è Metabole, come funziona in 3 passi, invito a completare il profilo | Lead nuovo | Subito | 🟢 |
| PROFILO_PRONTO | Questionario completato | {{nome}}, ecco il percorso pensato per te | Riepilogo risposte + piano consigliato + nutrizionista + coach → attiva | Lead qualificato | Subito | 🟢 |
| PIANO_DOMANI | Pagamento ok (giorno prima avvio) | Si parte domani! Ecco la tua lista della spesa | Lista spesa + come funziona da domani + prepara la colazione | Cliente attivo | T-1 avvio | 🟢 |

## 2. Conversione (chi non acquista)

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| PROFILO_INCOMPLETO | Registrato, questionario non finito | Ti manca solo un minuto, {{nome}} | Riduci attrito, ribadisci valore → completa il profilo | Lead nuovo | +48h | 🟢 |
| CART_1H | Piano scelto, non pagato | Il tuo percorso {{piano}} ti aspetta | Riprendi da dove hai lasciato → paga | Opportunità | +1h | 🟢 |
| CART_24H | Piano scelto, non pagato | "Ci ho già provato e non ha funzionato" | Perché qui è diverso + 1 testimonianza | Opportunità | +24h | 🟢 |
| CART_72H | Piano scelto, non pagato | Un pensiero per iniziare 🎁 | Incentivo a tempo (48h) → attiva ora | Opportunità | +72h | 🟢 |
| NURTURE_1 | Profilo pronto, non sceglie piano | Perché non è una dieta | Il metodo (si adatta a te) | Lead qualificato | +2gg | 🟢 |
| NURTURE_2 | come sopra | Il tuo team | Chi sono coach e nutrizionista | Lead qualificato | +4gg | 🟢 |
| NURTURE_3 | come sopra | Storie come la tua | Testimonianza per persona-target | Lead qualificato | +6gg | 🟢 |
| NURTURE_4 | come sopra | Pronta quando lo sei tu | Riepilogo profilo + offerta gentile | Lead qualificato | +9gg | 🟢 |
| OBIEZIONE_PREZZO | Apre più email senza convertire | Un piccolo investimento su di te | Valore vs costo + parla con noi | Opportunità tiepida | evento | 🟢 |

## 3. Retention (cliente attivo)

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| ONB_G1 | Avvio percorso | Il tuo primo giorno | Come leggere il menu, dove sono coach/Gaia | Cliente attivo | Giorno 1 | 🟢 |
| ONB_G2 | Cliente attivo | Il primo check-in | Perché le misure ogni 2 giorni contano | Cliente attivo | Giorno 2 | 🟢 |
| ONB_G4 | Cliente attivo | Sostituzioni e gusti | Come dire cosa non ti piace → il menu cambia | Cliente attivo | Giorno 4 | 🟢 |
| ONB_G7 | Cliente attivo | La tua prima settimana | Incoraggiamento + primo micro-risultato | Cliente attivo | Giorno 7 | 🟢 |
| FEEDBACK_RICETTE | N cicli / ricette non valutate | Com'era il tuo menu? | Valuta le ricette (migliora la personalizzazione) | Cliente attivo | ricorrente | 🟢 |
| VALORE_SETTIMANALE | Settimanale | Ricetta/consiglio della settimana | Contenuto di valore (lega al blog) | Cliente attivo | settimanale | 🟢 |
| RIATTIVA_DROPOUT | Alert dropout_risk | Ci sei, {{nome}}? Ripartiamo insieme | Empatia, la coach si fa viva → riapri app | A rischio | evento | 🟢 |
| REFERRAL | Cliente soddisfatto | Porta un'amica | Invito con vantaggio per entrambe | Cliente attivo | dopo milestone | 🟢 |

## 4. Email per EVENTO (milestone & morale)

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| EV_PESO_OK | Obiettivo di peso raggiunto | {{nome}}, ce l'hai fatta 🎉 | Celebrazione + upsell al mantenimento | Cliente attivo | evento | 🟢 |
| EV_PRIMO | Primo calo registrato | Il primo passo è fatto 🌱 | Funziona per te, continua | Cliente attivo | evento | 🟢 |
| EV_META | ~50% obiettivo | Sei a metà strada 💪 | Ora sai di potercela fare | Cliente attivo | evento | 🟢 |
| EV_COSTANZA | X check-in consecutivi | Che costanza! 🔥 | Rinforza l'abitudine | Cliente attivo | evento | 🟢 |
| EV_PLATEAU | Stato agente Plateau | Il corpo lavora anche a bilancia ferma | Rassicura, il nutrizionista ritocca | Cliente attivo | evento | 🟢 |
| EV_MORALE | Stato Conforto / umore basso | Una giornata storta non cancella i progressi | Su il morale, menu coccola, firma coach | Cliente attivo | evento | 🟢 |
| EV_MISURE | Fine ciclo senza misure | Un attimo per te, {{nome}} | Reminder gentile misure | Cliente attivo | fine ciclo | 🟢 |
| EV_RIENTRO | Rientro dopo pausa/vacanza | Bentornata — ripartiamo con dolcezza | Giorni leggeri, nessun senso di colpa | Cliente attivo | evento | 🟢 |
| EV_COMPLEANNO | Data di nascita | Buon compleanno! 🎂 | Auguri (no vendita), pensiero opzionale | Tutti | annuale | 🟢 |
| EV_ANNIVERSARIO | 1/3/6 mesi dall'inizio | Un mese insieme 🌿 | Grazie + riepilogo progressi | Cliente attivo | ricorrenza | 🟢 |
| EV_PRE_EVENTO | Evento in agenda (matrimonio/vacanza) | Arriviamo pronte a {{evento}} | Menu più leggero/proteico pre-evento | Cliente attivo | T-K giorni | 🟢 |
| EV_MANTENIMENTO | Obiettivo raggiunto → mantenimento | E ora, manteniamo ciò che hai conquistato | Cambio obiettivo: difendere il risultato | Cliente attivo | evento | 🟢 |

## 5. Rinnovo (in scadenza)

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| RIN_T7 | Abbonamento in scadenza | Guarda quanta strada hai fatto | Risultati + rinnova | In scadenza | T-7 | 🟢 |
| RIN_T3 | come sopra | Non fermarti proprio ora | Continuità + upsell/cambio piano | In scadenza | T-3 | 🟢 |
| RIN_T1 | come sopra | Il tuo percorso scade domani | Urgenza gentile, un clic per continuare | In scadenza | T-1 | 🟢 |
| UPSELL | Buoni risultati / esigenza diversa | Un passo avanti per te | Upgrade/cambio piano (es. → keto, annuale) | Cliente attivo | evento | 🟢 |

## 6. Win-back (scaduti / usciti)

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| WB_T3 | Scaduto | Riprendi da dove avevi lasciato | Storico ancora lì + eventuale incentivo | Scaduto | T+3 | 🟢 |
| WB_T7 | Scaduto | Cosa è cambiato in Metabole | Novità + offerta rientro a tempo | Scaduto | T+7/14 | 🟢 |
| WB_SURVEY | Churn confermato | Aiutaci a capire | 1 domanda sul motivo d'uscita | Churn | evento | 🟢 |
| WB_STAGIONALE | Stagione/occasione (Agente Tempismo) | È il momento giusto per ripartire | Percorso adatto a stagione/occasione | Ex cliente | stagionale | 🟢 |

## 7. Servizio & transazionali (sempre attive)

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| TX_VERIFICA | Registrazione | Conferma il tuo indirizzo | Link verifica email | Tutti | evento | 🟢 |
| TX_RESET | Richiesta reset | Reimposta la password | Link reset | Tutti | evento | 🟢 |
| TX_RICEVUTA | Pagamento ok | La tua ricevuta | Dettaglio pagamento/abbonamento | Cliente | evento | 🟢 |
| TX_RINNOVO_OK | Rinnovo/cambio piano | Rinnovo confermato | Conferma + nuova scadenza | Cliente | evento | 🟢 |
| TX_DUNNING | Pagamento fallito | Problema con il pagamento | Retry + aggiorna metodo | Cliente | evento | 🟢 |
| TX_APPUNTAMENTO | Appuntamento fissato/promemoria | Il tuo appuntamento con {{nutrizionista}} | Data/ora + link televisita | Cliente | pre-appuntamento | 🟢 |

## 8. Consensi & preferenze

| Cod | Evento (trigger) | Oggetto | Testo (sintesi) | Segmento | Timing | Stato |
|---|---|---|---|---|---|---|
| REPERMISSION | Lead senza consenso valido | Vuoi restare in contatto? | Re-opt-in (base 80k) | Lead vecchio | campagna | 🟢 |
| PREFERENZE | Link nel footer | Gestisci le tue preferenze | Centro preferenze / frequenza | Tutti | on-demand | 🟢 |

---

### Riepilogo stato — **catalogo 100% con copy pronta 🟢**
Tutte le email hanno **copy pronta**: attivazione, conversione (profilo incompleto, checkout 1H/24H/72H, nurture 1–4, obiezione prezzo), retention (onboarding G1/G2/G4/G7, feedback ricette, valore settimanale, riattivazione, referral), 12 email per evento, rinnovo T7/T3/T1 + upsell, win-back (T3/T7/survey/stagionale), transazionali (verifica, reset, ricevuta, rinnovo, dunning, appuntamento), consensi (re-permission, preferenze).
**Copy completa in `../Metabole_Email_Ciclo_Vita.md`** (Parti 1, 3, 4, 5, 6, 7).
- **Prossimo passo (Sviluppo):** tradurre (🔵) nelle lingue dell'app → **template Brevo (⬛)** con i trigger → test → **live (✅)**.
- **Prossimi passi:** completare le 🟡/⚪ → **tradurre (🔵)** nelle lingue dell'app → **costruire i template Brevo (⬛)** con i trigger → test → **live (✅)**.

Copy completa e dettagli: `../Metabole_Email_Ciclo_Vita.md`. Campagne massive (win-back 20k / nurture 80k): `../../Metabole_Strategia_Rientro_Nurture.md`.
