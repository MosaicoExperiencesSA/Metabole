# Audit di fine giornata — è stato fatto tutto?

**Data:** 6 agosto 2026 · **Richiesto da:** Simone («controlla bene tutti i registri e appunti»)
**Metodo:** clone fresco di `origin/main` (commit `33be6b3`), quattro revisioni in parallelo su
`progetto/REGISTRO.md`, i ~90 `REGISTRO_*.md` alla radice, `metabole-backlog.md`, `STATO.md`,
`STATO_LANCIO.md`, le checklist di luglio e le note di memoria. Ogni voce ri-verificata **nel
codice**, non nei documenti.

> Regola applicata, imparata dall'audit del 5/8 (che sbagliò 3 segnalazioni su 8): prima di
> dichiarare aperta una voce, cercare se una decisione **successiva** l'ha chiusa o ribaltata di
> proposito. Un caso è emerso anche stavolta ed è escluso qui sotto (i regimi «Pescetariana»,
> chiusi per decisione di Simone).

---

> ## ⚠️ SUPERATO NELLA STESSA GIORNATA (sera del 6/8)
>
> Questo audit è stato scritto **a metà giornata** e quasi tutto ciò che segnalava è stato chiuso
> nelle ore successive. Va letto come cronaca, non come lista di cose da fare:
>
> - **#2 Keto-Mediterranea** → generata dal nutrizionista dal generatore del backoffice.
> - **#10 monitoraggio a pagamento** → la decisione che lo bloccava è stata presa (provvigioni sul
>   rinnovo chiuse in tutte e tre le domande), e il listino è fissato: mantenimento €49/mese,
>   monitoraggio €19/mese. Resta il codice dello Stripe ricorrente.
> - **I quattro difetti della §2** («un interruttore che si può girare e non fa niente») → corretti
>   tutti, più `npm run diag:parametri` che impedisce il ripetersi della famiglia.
> - **§3 punto 3, «CI che non blocca niente, dietro ~30 test rossi»** → doppiamente sbagliato: erano
>   **99 in 18 suite**, ora sono **zero su 527**, e `continue-on-error` è stato tolto.
> - **§3 punto 8, «manca la select assegna a… nel form lead»** → fatta, col ciclo di accettazione e
>   la notifica alla coach.
> - **§4** → `OTA_VERSION` svuotata, Keto generata, quota coach decisa.
> - **§5** → le quattro correzioni documentali sono state applicate.
> - **Due segnalazioni erano sbagliate**, ed è giusto dirlo: la **certificazione di unicità** e il
>   **Giudice/Publisher** erano dati come «mai iniziati». Esistono entrambi
>   (`personal-base.service.ts:234-257` con seme, collision check e certificato firmato;
>   `backend/src/social/`). È lo stesso errore che l'audit del 5/8 aveva fatto tre volte su otto:
>   un audit che grida al lupo si smette di leggere.

## Risposta breve

**No, non è tutto fatto — ma niente di ciò che manca blocca la 2.1.** Le 18 richieste del 5/8 sono
chiuse tranne due, entrambe ferme su qualcosa che non è codice: la #2 aspetta la nutrizionista, la
#10 aspetta una tua decisione.

La parte che vale la pena leggere è la seconda: **quattro difetti nuovi**, tutti della stessa
famiglia già scoperta due volte oggi — un interruttore che sembra esserci e non c'è.

---

## 1. Le 18 richieste del 5/8

**16 chiuse** con prova nel codice. Le altre due:

- **#2 — ingredienti Keto introvabili:** il codice è finito (Keto-Mediterranea nel generatore, 12
  varianti, vincolo «solo supermercato italiano» nelle note cliniche del preset). Manca la
  generazione e la validazione della nutrizionista. Nessuna cliente riceve ancora menu
  semplificati.
- **#10 — monitoraggio a pagamento:** non iniziata. `stripe.service.ts:40` è ancora
  `mode: 'payment'`, e `monitoring.service.ts:22-28` descrive il monitoraggio come paracadute
  **gratuito**. Ferma sulla quota coach delle provvigioni sul rinnovo.

---

## 2. Quattro difetti NUOVI (verificati uno per uno)

### a. Un interruttore che si può girare e non fa niente ⚠️

`menu_daycombo_kcal_target` è nel catalogo delle regole del motore
(`engine-rules.catalog.ts:32`), quindi il capo nutrizionista lo vede nella pagina *Regole motore*,
può cambiarne il valore globale e il sistema glielo salva. La descrizione dice che serve «al
generatore di catalogo/bozze **e alla composizione DayCombo**».

La seconda metà è falsa. Il motore calcola il target kcal della giornata così
(`menu.service.ts:392-399`): se il «menu a necessità» è attivo usa il **fabbisogno calcolato sul
profilo**, altrimenti le **kcal del livello della dieta**. Quel parametro non lo legge mai. L'unica
lettura in tutto il backend è `engine-rules.service.ts:184`, e prende il valore da un altro posto
(il JSON `rules` del preset), non dal parametro globale.

Chi lo gira crede di aver cambiato le calorie dei menu. Non è cambiato niente.
**La correzione giusta è la descrizione, non il codice**: il target kcal deve venire dal fabbisogno
della singola cliente, non da un numero globale.

### b. Due leve vere, invisibili ovunque

- **`menu_kcal_need_enabled`** (`menu.service.ts:375`, default acceso) decide se il target kcal
  viene dal fabbisogno calcolato o dai livelli della dieta: è una scelta clinica. Il commento nel
  codice dice «disattivabile globalmente o per dieta» — ma la chiave non è nel catalogo motore,
  quindi non compare in nessuna pagina e nemmeno i preset possono toccarla (`cleanRules` scarta i
  codici che non sono nel catalogo).
- **`menu_penalty_season`** (`menu.service.ts:855`, default 0,5) è la forza della penalità di
  stagionalità — la funzione costruita **oggi** per la voce #11. Nessuno può regolarla.

### c. `refund_receipt`: la stessa dimenticanza di stamattina, una casella più in là

Stessa identica storia di `lead_credentials`, che abbiamo corretto oggi: la ricevuta di **rimborso**
(`mail.service.ts:311`) non ha una riga in `EMAIL_TEMPLATES`. L'email parte lo stesso (ripiega sui
testi nel codice), ma in *Modelli email* non c'è, quindi non è personalizzabile.

### d. Un commento che promette una pagina che non esiste

`marketing.service.ts:302-305` dice che `marketing_require_consent` si accende «da Parametri», e
che va acceso **prima di lavorare lo storico importato**. In *Parametri* non c'è: la chiave non è
seminata. È il gate che esclude dalle campagne i lead senza consenso esplicito — un tema di
conformità, non un dettaglio tecnico. Stessa cosa, più innocua, per `app_store_url` e
`play_store_url` (`mail.service.ts:57-58`): il commento dice «il giorno che serve correggerli non
deve servire un deploy», e oggi invece servirebbe.

**Il rimedio strutturale** — più utile dei quattro rattoppi — è un controllo automatico che
confronti le chiavi lette dal codice con quelle seminate, e si lamenti quando divergono. Il difetto
si è già ripresentato tre volte: non è sfortuna, è che nessuno può accorgersene.

---

## 3. Lavori aperti confermati (codice)

In ordine di quanto pesano:

1. **Stripe ricorrente** (`stripe.service.ts:40`) → blocca la #10 e le provvigioni sul rinnovo. Grande.
2. **Registrazione: una card per stile invece che per prodotto**
   (`onboarding.service.ts:39`, `if (seen.has(style)) continue`). Già in `metabole-backlog.md`. Media.
3. **CI che non blocca niente** (`.github/workflows/ci.yml:39`, `continue-on-error: true`), dietro
   ~30 test rossi in `src/commerce`. Piccola da togliere, lunga da meritare.
4. **Prodotti dinamici / zero-redeploy** — la spec esiste, l'entità no (il `model Product` è il
   catalogo integratori). Grande, mai iniziata.
5. **Certificazione di unicità** (seme, collision check, registro firmato — fase 10). Grande, mai iniziata.
6. **Login social Google/Apple.** Media, mai iniziata.
7. **Modulo marketing: Giudice/Publisher e gli 8 agenti.** Grande, mai iniziata.
8. Minori: nessuna notifica alla referrer quando scatta la ricompensa; niente QR nel link d'invito
   della coach; niente Sentry; nel form di creazione lead manca la select «assegna a…» (il backend
   la supporta già).

Le voci 4-7 non sono dimenticanze: sono fasi che non abbiamo mai iniziato, e nei documenti
risultano correttamente ⬜.

---

## 4. Cose da fare sui DATI o in produzione (non codice)

- Svuotare **`OTA_VERSION`** dopo la pubblicazione.
- **Keto-Mediterranea**: generare e validare le 12 varianti.
- **Provvigioni**: azzerare la quota nutrizionista su Mantenimento e Monitoraggio dal Negozio, e
  decidere la quota coach.
- **Diete a 3 pasti e digiuno** nel catalogo: oggi il grosso è a 5 pasti.
- **Prodotti «Vacanza estiva» e «Rientro estivo»**: esistono in demo, vanno creati in produzione.
- **Firebase Android** con il package `app.metabole` (nuovo `google-services.json`) per il Play Store.
- **Deployment target iOS 15.0** — non stasera.
- Traduzioni RU/ZH/AR: estratto pronto, manca il revisore madrelingua.
- Aggiornamenti major (React 19, Vite, Prisma 7, Capacitor 8): finestra dedicata, non a spizzichi.

---

## 5. Documenti che dicono il falso (da ripulire, non da lavorare)

- `Metabole_Checklist_GoLive.md:22-25` — quattro gate ancora 🔴, ma `STATO_LANCIO.md:11` dichiara
  «tutti i gate chiusi» dal 16/7.
- `RIEPILOGO_Lavori_Collaudo.md:161-163` — dà come da fare il modulo campagne marketing, chiuso il
  15/7 (`schema.prisma`, `model MarketingCampaign`), e il **video di presentazione della coach**,
  che Simone ha **annullato** il 17/7.
- `Metabole_Checklist_Allineamento_STATO.md:37-38` — schermate 28-29 «serve il video»: stessa cosa.
- `STATO.md:230-234` — i piani stagionali sono segnati ⬜ ma `clients.service.ts:634-653` e
  `menu.service.ts:690,715` mostrano che `travelState` è costruito e usato: va portato a 🟡.

---

## 6. Una segnalazione scartata di proposito

L'audit automatico ha rialzato i **18 profili «Pescetariana» con regime onnivoro**
(`REGISTRO_Varieta_Menu.md:85-86`). **Chiusa per decisione di Simone**: i regimi «Pescetariana»
restano come sono. Non è un difetto da riaprire — è la regola del ribaltamento che ha fatto
sbagliare l'audit precedente, ed è la ragione per cui questa nota esiste.
