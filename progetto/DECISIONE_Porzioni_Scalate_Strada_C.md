# Le porzioni si scalano all'erogazione — foglio per Simone (17/8/2026)

Voce 255. **La strada è già scelta da te: la C.** Questo foglio non ripropone il confronto fra B e C
(quello sta in `NOTA_Digiuno_E_Riempimento_Varianti.md` §4): serve a decidere le **due cose che la C
non dice ancora** e a mettere per iscritto cosa costa, prima di scrivere una riga di codice.

Tutto quello che c'è qui sotto è verificato nel codice, con file:riga. Dove c'è un numero, viene dalle
quote vere del motore, non da una stima.

---

> ## ✅ DECISO E CONSEGNATO — 18/8/2026
>
> Simone, in pagina Lavori: **«Va riproporzionato il pasto correggendo le quantità in base al
> fabbisogno»**. È la strada C.
>
> Le tre domande di sotto non le ha risposte una per una, e ho preso **la "consigliata" di
> ciascuna** — sono tutte e tre parametri, quindi cambiarle non costa un rilascio:
>
> | | scelta | dove si cambia |
> |---|---|---|
> | §4 tetto | **B** — per tipo di pasto: principali ×1,8 · colazione ×1,6 · spuntini ×1,25 | `config_param`: `porzione_tetto_pasto_principale`, `porzione_tetto_colazione`, `porzione_tetto_spuntino` |
> | §5 quando non basta | **A** — si eroga al tetto e lo si dice (log + `daily_kcal_below_target`, che ora vuol dire «resta corta anche col moltiplicatore»). ⛔ La **B** (avvisare quando si sceglie la finestra) resta da fare | — |
> | §6 chi scala di più | **uniforme coi tetti per slot**: chi non è al tetto cresce della stessa percentuale | — |
>
> ⚠️ Restano aperti, e sono scritti nella voce 255: la scheda ricetta con le grammature di
> catalogo, i giorni già erogati, il kit di rientro, e **i pezzi** (×1,5 di una mela).

## 0. Le tre domande da decidere (le risposte vanno qui sotto)

1. **Il tetto del moltiplicatore.** Quanto può crescere una porzione prima che il piatto non abbia
   più senso? Uno solo per tutti i pasti, o uno per tipo di pasto?
2. **Cosa si fa quando il tetto non basta.** Esiste una finestra in cui servirebbe **×2,2**: nessun
   tetto sensato ci arriva.
3. **Chi scala di più: tutti allo stesso modo, o i pasti principali più degli spuntini?**

Le prime due le avevi già indicate come le domande aperte. La terza è emersa scrivendo il foglio, ed
è clinica come le altre due: con il fattore uniforme lo «spuntino» di Sonia diventa da 246 kcal.

---

## 1. Da dove nasce il buco (verificato)

Le quote di calorie per pasto stanno in **un posto solo**, e sono cotte dentro la ricetta al momento
in cui il catalogo viene generato — `engine-rules.service.ts:43-47`:

| struttura | colazione | sp. mattina | pranzo | sp. pomeriggio | cena |
|---|---|---|---|---|---|
| 3 pasti | 25% | — | 40% | — | 35% |
| 5 pasti | 20% | 10% | 35% | 10% | 25% |
| digiuno | — | — | 45% | 10% | 45% |

⚠️ **Quella funzione ha un solo chiamante, ed è la generazione del catalogo**
(`engine-rules.service.ts:431`, prompt all'AI a `:1055`). **L'erogazione non la legge mai.** Nessun
campo di `Recipe` registra su quale quota quella ricetta è stata dimensionata: `Recipe.kcal` è un
numero assoluto (`schema.prisma:1686`) e `ingredients` sono grammature fisse (`:1687`).

Quindi quando la finestra toglie dei pasti, quello che resta **non sa** di dover crescere. E non
esiste da nessuna parte un fattore di porzione: cercato `portion|porzione|multiplier|servings|scala`
su tutto `backend/src`, nessun risultato (lo dichiara anche `catalog/struttura-per-digiuno.ts:43-52`).

### Quanto manca, finestra per finestra

Incrociando `FINESTRE_DIGIUNO` (`menu/finestre-digiuno.ts:52-99`) con il catalogo che la correzione
del 17/8 serve a ciascuna:

| finestra | catalogo | pasti che restano | % del fabbisogno | fattore necessario |
|---|---|---|---|---|
| salta la colazione | digiuno | pranzo, sp. pom., cena | **100%** | — |
| **salta la cena** (Sonia) | 5 pasti | colazione, sp. matt., pranzo | **65%** | **×1,54** |
| **salta il pranzo** | 5 pasti | colazione, sp. matt., sp. pom., cena | **65%** | **×1,54** |
| salta colazione e pranzo | digiuno | sp. pom., cena | **55%** | **×1,82** |
| **salta cena e colazione** | digiuno | pranzo | **45%** | **×2,22** |
| — spuntini tolti da Vera (due) | qualsiasi 5 pasti | tutti tranne gli spuntini | **80%** | ×1,25 |
| — un solo spuntino tolto | qualsiasi 5 pasti | — | **90%** | ×1,11 |

⚠️ Le ultime due righe sono il motivo per cui questa consegna non riguarda solo il digiuno: quando
Vera toglie gli spuntini (`vera-chat.service.ts:970`, filtrati a soli spuntini in
`finestre-digiuno.ts:127-137`) succede la stessa cosa, in piccolo, **a chiunque**.

⚠️ **Le due finestre più strette (55% e 45%) oggi non le usa nessuno** — le sette clienti in digiuno
sono cinque su «salta la colazione», Sonia su «salta la cena», Maria senza finestra. Ma quelle
finestre sono **nella tendina della scheda e nel questionario** (`finestre-digiuno.ts:82-99`), e il
prodotto **propone di provare** una giornata 20-4 (`notifications.service.ts:347-367`, che suggerisce
e non imposta): la riga del ×2,22 è raggiungibile domani, non è un caso di scuola.

---

## 2. Le quattro frasi che oggi promettono una cosa che il motore non fa

Questa è la parte che pesa più del codice, e va sistemata **in ogni caso**, qualunque tetto si
scelga:

- `app/src/pages/Profilo.tsx:226` — «Le calorie di quel pasto sono ridistribuite sugli altri: la
  giornata resta completa.» **Alla cliente.**
- `backend/src/vera/vera-chat.service.ts:926` — «Le kcal della giornata non si perdono: si
  ridistribuiscono sui pasti rimasti.» **Vera lo dice a voce alla nutrizionista.**
- `vera-chat.service.ts:992` — la stessa frase nella versione per lo staff.
- `schema.prisma:415` — il commento della colonna `pastiEsclusi` afferma la stessa cosa.

Più un test che pretende la frase (`vera-chat.service.spec.ts:883`) e il commento gemello in
`app/src/lib/spuntiniEsclusi.ts:5`.

Il repo sa già che sono false: `COMMIT_parte_digiuno_pasti_promessi.txt:106` — «kcal *sono
ridistribuite*, cosa che il motore NON fa». **La strada C le rende vere.** Fino a quel giorno, o si
riscrivono, o restano quattro punti in cui il prodotto dice alla cliente una cosa che non succede.

---

## 3. ✅ Il segnale che mancava — CONSEGNATO il 17/8 sera (voce 260)

> `menu/giornata-sotto-target.ts` + l'innesto in `deliverIfEligible`: `logger.warn` con la giornata
> peggiore e `analyticsEvent` **`daily_kcal_below_target`** con tutte. Quello che segue è la
> diagnosi che ha portato a scriverlo, e resta qui perché è la ragione per cui la Consegna 1 viene
> prima della cura.

C'è un'asimmetria dentro lo stesso file, e vale la pena vederla:

- **pasti** mancanti → `logger.warn` + `analyticsEvent` `fasting_meals_missing` +
  `npm run diag:digiuni` cliente per cliente (`menu.service.ts:557-582`);
- **calorie** mancanti → **niente.**

La tolleranza `menu_kcal_balance_tolerance_pct` (default 15, `menu.service.ts:621`) esiste ma è usata
come **filtro**, non come controllo: `day-combo.service.ts:48-56` scarta le combinazioni fuori banda
e se non ne resta nessuna torna `null`; quel `null` finisce in `menu.service.ts:720-725`, che compone
col template e **eroga comunque, senza una riga di log**. Una giornata al 65% del fabbisogno esce
identica a una giornata giusta.

⚠️ Il precedente da copiare esiste già, ed è di Vera: `vera/giornata-dettata.ts:31` e `:151-153`
(`TOLLERANZA_KCAL_PCT`, `scostamentoPct`, `dentroTolleranza`) **blocca** una giornata dettata fuori
target e lo dice col numero. Il motore, sulla stessa domanda, tace.

**Era il primo pezzo da consegnare, prima di toccare le porzioni** — ed è stato fatto la sera stessa.
Serve a sapere *quante* giornate sono sotto target oggi, invece di scalare le porzioni e scoprire
dopo su chi si è agito. ⚠️ Il numero da guardare prima di scrivere la Consegna 2 è quello:
`daily_kcal_below_target` in `analytics_event`.

---

## 3-bis. ⚠️ LA PRIMA LETTURA IN PRODUZIONE HA CAMBIATO LA DOMANDA (18/8)

`npm run diag:porzioni` su 14 giorni: **84 giornate erogate, 18 clienti, 5 con giornate sotto banda**.
E **quattro casi su cinque non hanno né digiuno né spuntini tolti**: sono «nessuna esclusione, è il
catalogo». Antonio riceve il **53% del suo fabbisogno per nove giornate su nove**.

### La causa, verificata nel codice e non dedotta dai numeri

Il catalogo ha **una sola taglia calorica**, e l'erogazione punta a **un'altra cosa**:

| | chi decide | valore |
|---|---|---|
| le **ricette del catalogo** | `menu_daycombo_kcal_target` (`engine-rules.catalog.ts:39`, `perDiet`) | **1500 kcal/giorno** di default (1600–1800 in tre preset) |
| il **menu erogato** | `menu_kcal_need_enabled` → il **fabbisogno della cliente** (Mifflin) | quello che è |

Il generatore scrive ogni ricetta dimensionata su quella giornata da 1500
(`engine-rules.service.ts:255` e `:447`: `kcalPasto = targetKcal × quota`). Poi `DayCombo` compone
puntando al fabbisogno vero — ma **dentro un pool che giornate più grandi non le contiene**.

⇒ **Chi ha un fabbisogno sopra ~1765 kcal** (1500 ÷ 0,85, il bordo della banda del 15%) **riceve
giornate fuori banda per costruzione**, tutti i giorni, qualunque cosa faccia il motore. E i numeri
osservati tornano: 53% → fabbisogno ≈2830 · 60% → ≈2500 · 72% → ≈2080 · 75% → ≈2000. Tutti sopra la
soglia, nessuno per colpa della propria finestra.

⚠️ Il parametro lo dice pure, nella sua descrizione: «Non cambia i menu già erogati: quelli seguono il
fabbisogno della cliente». Le due cose sono **dichiaratamente** separate — non era scritto da nessuna
parte cosa succede quando non coincidono, e fino al 17/8 non lo diceva nessuno.

⚠️ E lo schema aveva già previsto la risposta: `Diet.levels` nasce come `[{level:1,kcal:1400},
{level:2,kcal:1600}]`, cioè **più taglie per la stessa dieta**. Il livello 2 non esiste: 315 diete
sono tutte a livello 1.

### Cosa cambia per questo foglio

**La strada C non è un cerotto per il digiuno: è il meccanismo che manca al prodotto per servire UN
catalogo a PIÙ fabbisogni.** Il caso della finestra di digiuno è un'istanza particolare (la giornata
perde dei pasti), quello del catalogo è il caso generale (la giornata è tarata più in basso della
persona).

Ma il tetto cambia di significato, e va scelto su un altro numero:

| | serviva per | fattore richiesto |
|---|---|---|
| digiuno «salto la cena» | recuperare i pasti tolti | ×1,54 |
| **catalogo vs fabbisogno alto** | **tutti i giorni, per sempre** | **fino a ×1,89** |

⚠️ E qui la differenza clinica è vera: ×1,54 per tre giorni su una finestra è una porzione più
generosa; **×1,89 su ogni piatto di ogni giorno non è una porzione più grande, è un altro piano
alimentare** — con la lista della spesa che raddoppia e piatti pensati piccoli serviti in doppia dose.

**La strada onesta, se i numeri confermano:** una **seconda taglia di catalogo** per i fabbisogni alti
(è quello per cui `levels` esiste, e si genera col generatore che c'è già), **più** la porzione scalata
a coprire lo scarto che resta — con un tetto **piccolo** (×1,2–1,3), che è quello che una porzione può
davvero fare senza diventare un altro piatto.

---

## 4. Domanda 1 — il tetto

Il precedente in casa: nelle sostituzioni in chat la grammatura ammessa sta fra **⅓ e 3×**, e fuori
da lì si ripiega a pari grammatura segnalandolo (`menu/sostituzione-chat.ts:372-406`,
`grammaturaCorretta`). È un tetto di *plausibilità*, non di nutrizione: qui serve più stretto.

| | A — un tetto solo | B — un tetto per tipo di pasto (**consigliata**) |
|---|---|---|
| valore | ×1,6 su tutto | pasti principali ×1,8 · colazione ×1,6 · spuntini ×1,25 |
| Sonia (65%) | ci arriva quasi (serve 1,54) | ci arriva |
| 55% (serve 1,82) | no | sì, al limite |
| 45% (serve 2,22) | no | no |
| lo spuntino | ×1,6 → da 160 a 256 kcal: non è più uno spuntino | resta uno spuntino |
| costo | una chiave | tre chiavi |

⚠️ **Il tetto va in `config_param`, non nel codice** — è la regola n.1 del progetto (le soglie del
motore mai hardcodate) e vale doppio qui, perché è un numero clinico che la nutrizionista può voler
cambiare senza un rilascio. E va aggiunto a `prisma/seed.ts`: il seed gira a **ogni deploy**
(`render.yaml:48`, `preDeployCommand`) e crea le chiavi mancanti senza toccare i valori già
personalizzati (`seed.ts:1296-1300`), quindi la riga compare da sola.

⚠️ **Il limite che nessun tetto risolve:** una porzione ×1,5 di un piatto «a pezzo» non esiste. Un
frutto, un vasetto di yogurt, un uovo: ×1,5 vuol dire una mela e mezza. Il tetto basso sugli
spuntini è anche il modo di non doverlo dire troppo spesso, ma **prima o poi va detto**: o si accetta
l'arrotondamento («2 frutti»), o le ricette a pezzo si escludono dalla scalatura e il resto della
giornata compensa. Da decidere con la nutrizionista, non da noi.

---

## 5. Domanda 2 — cosa si fa quando il tetto non basta

La riga del **45%** («salta cena e colazione»: resta il solo pranzo) chiede ×2,22. Un pranzo che vale
l'intera giornata è un pasto da 1600 kcal: non è una porzione, è una scelta clinica.

- **A. Si eroga al tetto e si dice.** Warn + `analyticsEvent` (gemello di `fasting_meals_missing`) +
  riga in `diag:digiuni` + segnalazione a Vera, così la nutrizionista la vede fra le sue cose da
  guardare. **Questo va fatto comunque**, qualunque altra cosa si scelga: è il minimo.
- **B. Si previene quando la finestra si scegle.** Nel questionario e nella scheda, scegliendo una
  finestra che col suo fabbisogno non è raggiungibile, si dice **lì**: «con questa finestra
  arriveremmo al 45% delle tue calorie — ne parli con la coach». È l'unico modo di non far nascere
  il problema. ⚠️ Ma vuole una decisione tua: si **impedisce** o si **avvisa**? (Nel dubbio: si
  avvisa. Un divieto secco si aggira scrivendo il campo a mano, e allora non lo sa nessuno.)
- **C. Strada B mirata, solo per le finestre usate davvero.** Un catalogo con le quote di *quella*
  finestra. Costa ricette nuove dall'AI, e ha senso solo se una finestra diventa popolare —
  oggi due clienti su sette la userebbero, cioè nessuna delle due strette.
- **D. Si riapre uno spuntino dentro la finestra.** ⛔ Da non fare senza il consenso della cliente:
  è disfare la cosa che ha scelto.

**Consigliata: A + B.** A perché il silenzio è il difetto di famiglia di questo progetto. B perché è
l'unica che tolga il problema invece di rattopparlo. C si tiene sul tavolo con un numero davanti (chi
usa quella finestra), non per principio.

---

## 6. Domanda 3 — chi scala di più

Esempio su un fabbisogno di **1600 kcal**, finestra «salta la cena» (il caso di Sonia):

| | oggi | fattore uniforme ×1,54 | pesata (spuntino ×1,25, il resto sui pasti) |
|---|---|---|---|
| colazione | 320 | 493 | 512 |
| spuntino mattina | 160 | **246** | 200 |
| pranzo | 560 | 862 | 888 |
| totale | 1040 (65%) | 1600 | 1600 |

Il fattore uniforme è una riga di codice e mantiene le proporzioni fra i pasti rimasti; il prezzo è
che gonfia lo spuntino fino a farlo diventare un pasto. La pesata tiene lo spuntino uno spuntino e
manda la differenza su colazione e pranzo — che è quello che farebbe a mano una nutrizionista.

**Consigliata: uniforme, ma con il tetto per tipo di pasto della domanda 1** — che è la versione
pesata, ottenuta senza una seconda regola: lo spuntino si ferma al suo tetto e la differenza si
ridistribuisce su chi ha ancora margine. Una regola sola, e il tetto la governa.

---

## 7. Cosa costa, e in che ordine

### ✅ Consegna 1 — la verità (fatta a metà, 17/8 sera)
Il segnale (§3) è **consegnato**, voce 260. ⛔ Restano **le quattro frasi** (§2): non sono state
toccate perché il testo è voce di prodotto e serve il sì di Simone su come si riscrivono. Finché
restano, il prodotto promette una ridistribuzione che il motore non fa.

### ✅ Consegna 2 — il moltiplicatore nel motore — CONSEGNATA il 18/8
- Campo nuovo su `MealSnapshot` (`menu/pasto-giornata.ts:108-116`): **opzionale, assente = 1**, così
  i giorni già scritti si rileggono senza migrazione — è lo stesso criterio già usato per
  `substitutions` e `cambioPiatto`, ed è dichiarato in testa a quel file.
- ⚠️ **Come scrivere le kcal, ed è la scelta che decide quanti punti si rompono.** L'app **non**
  riceve il totale della giornata dal server: lo somma da sola (`app/src/pages/Home.tsx:307`,
  `Percorso.tsx:90` e `:237`). Quindi: se si scrive il fattore a parte e si lascia `kcal` alla
  porzione base, **tutti i totali diventano sbagliati in silenzio**, in tre schermate. Si scrive
  `kcal` **già scalato**, e accanto `porzione` e `kcalBase` per non perdere l'origine. I trenta punti
  che leggono `m.kcal` continuano a leggere un numero vero.
- Il calcolo in un **modulo puro** (`menu/porzione-scalata.ts`, sulla falsariga di
  `struttura-per-digiuno.ts`): target, kcal dei pasti rimasti, tetti per slot → fattore per slot.
  Provato per tabella su tutte e cinque le finestre più i due casi degli spuntini.
- Scrittura in `snapshotMeals` (`menu.service.ts:2428-2443`): è l'imbuto unico, ci passano tutti i
  percorsi di composizione. ⚠️ Ma **tre punti riscrivono i pasti dopo** ricostruendo l'oggetto campo
  per campo, e perderebbero un campo nuovo: `applySimplePreference` (`:1708`, `:1715`),
  `swapDislikedDishes` (`:1733-1828`) e la ripetizione bigiornaliera (`:759`).
- ⚠️ `menuDay.upsert` ha `update: {}` (`menu.service.ts:875-887`): **i giorni già erogati non si
  riscrivono**. La correzione vale dai giorni nuovi in avanti — per Sonia, dal primo giorno non
  ancora aperto. Se si vuole prima, c'è `diag:rigenera`.

### Consegna 3 — dove la cliente lo legge — FATTA A METÀ il 18/8 (lista della spesa, riga in app, pastiglia nel backoffice; resta la scheda ricetta)
- **La lista della spesa** (`menu.service.ts:2499-2558`): somma le grammature di catalogo
  (`current.qty += ing.qty`, riga **2538**) senza alcun fattore. Va moltiplicata prima della somma —
  e ⚠️ **c'è una cache**: se una lista per quell'intervallo esiste già la restituisce così com'è
  (`:2516-2519`), quindi un fattore scritto dopo non ci arriverebbe mai. Serve invalidarla.
  Serve anche una regola di arrotondamento: 185 g di riso non è una quantità che si compra.
- ⚠️ **Il dettaglio della ricetta è il costo nascosto della strada C.** L'app le grammature non le
  legge dal menu: chiama `GET /recipes/:id` (`app/src/pages/Menu.tsx:59` →
  `catalog.service.ts:1222-1227`), che restituisce la **ricetta di catalogo grezza** e non sa né di
  quale giorno né di quale pasto si stia parlando. Con la porzione scalata mostrerebbe grammature e
  kcal della porzione base, **in contraddizione visibile** con la riga del pasto sopra. O gli si
  passa giorno e slot, o si scala lato app col fattore che arriva nel menu. (È già oggi il punto
  dove le sostituzioni concordate non si vedono: si chiudono le due cose insieme.)
- Dove si legge «porzione ×1,6»: la fascia delle sostituzioni in `Menu.tsx:243-247` è il posto
  naturale — stesso stile, stessa riga. ⚠️ Non esiste una nota libera per pasto nel JSON: riusare
  `Substitution.nota` sarebbe un abuso (finisce nella verifica della nutrizionista e nei report).
- Scheda cliente nel backoffice: `backoffice/src/pages/ClientDetail.tsx:2106-2110` mostra le kcal
  per pasto — con `kcal` già scalato è corretta da sola, ma il fattore va mostrato lì, altrimenti la
  nutrizionista legge un pranzo da 862 kcal e non sa perché.
- ⚠️ Il kit di rientro **copia `meals` così com'è** in giorni nuovi
  (`monitoring.service.ts:407-490`): un fattore calcolato per una finestra verrebbe clonato in un
  periodo in cui quella finestra magari non c'è più. Da decidere: si ricalcola.

---

## 8. Cosa NON si fa

- ⛔ **Non si tocca `Recipe.kcal` né gli ingredienti di catalogo.** La ricetta è di tutte, non di una
  (regola ferrea di `progetto/STATO.md`). Il fattore vive sulla giornata della cliente.
- ⛔ Non si aggiunge un pasto fuori dalla finestra per far tornare i conti.
- ⛔ Non si scala oltre il tetto in silenzio: se non ci si arriva, lo dice qualcuno.

---

## 9. La riga da ricordare

Il difetto di famiglia di questo progetto è **«un dato che agisce e non si vede»**, e le porzioni ne
sono l'ottavo caso: una cliente al 65% del suo fabbisogno riceve un menu che sembra completo, in
un'app che le dice che le calorie «sono ridistribuite». Per questo la §3 viene prima della §7: la
prima cosa da consegnare non è la cura, è **il numero che dice quante sono**.
