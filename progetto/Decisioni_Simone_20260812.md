# Decisioni di Simone — 12/8, sessione «regole scritte due volte»

Nate dall'audit del 12/8: sei punti in cui la **stessa regola di dominio** vive in due file e le due
copie danno risposte diverse. Le domande sono state fatte **una alla volta**, e ogni risposta è
scritta qui **prima** di scrivere il codice — così una decisione presa non si ri-discute la settimana
prossima, e chi legge il codice trova il perché senza dover ritrovare la conversazione.

Ogni voce dice: la domanda, la risposta, e — quando serve — la conseguenza che era stata messa sul
tavolo prima di scegliere.

---

## 1. Un voto basso quanto vale? ✅ DECISO

**Contesto.** L'11/8 un piatto mai votato valeva cinque stelle; il 12/8 è passato a **zero** (vedi
`menu/punteggio.ts`). Conseguenza non decisa da nessuno: un piatto votato **una stella** (0,2) si
trovava **sopra** uno mai provato (0), e nello stato «conforto» — il giorno di umore basso — il boost
allargava quel divario. Cioè un piatto bocciato poteva tornarle nel piatto proprio nel giorno peggiore.

**Risposta: una stella vale come «mai provato».**

La scala diventa `(stelle − 1) / 4`: una stella = 0 esattamente come un piatto sconosciuto, cinque
stelle = 1. Nessun piatto bocciato scavalca uno mai assaggiato, e non serve inventare una penalità
sotto lo zero — che con un catalogo ancora poco votato avrebbe ristretto parecchio le scelte.

⚠️ Da tenere presente scrivendolo: cambia il significato di **tutte** le stelle, non solo di una. Con
`/5` un tre stelle valeva 0,6; con `(x−1)/4` vale 0,5. È voluto: la scala parte da zero, e «tre su
cinque» su una scala che comincia a uno è esattamente metà.

---

## 2. L'obiettivo dell'acqua: 33 o 30 ml/kg? ✅ DECISO

**Contesto.** Due calcoli per la stessa cosa. La home usa `water_ml_per_kg` (default **33**,
modificabile dai Parametri) diviso 250 ml e arrotondato in bicchieri, con un limite fra 6 e 16; il
report usa `peso × 30 / 1000`, **scritto a mano in due file** (`plan-report.service.ts` e
`reports.service.ts`), senza parametro e senza limiti.

Una cliente di 70 kg legge **2,25 L** in home e **2,1 L** nel report. E se un admin tocca il
parametro, il report non se ne accorge affatto.

**Risposta: 33 ml/kg dal parametro, ovunque.**

Il report smette di calcolarselo e legge lo stesso `water_ml_per_kg`. Un obiettivo solo, e il giorno
che si cambia dai Parametri cambia in tutte e due le schermate.

⚠️ Conseguenza accettata: da qui in avanti il report mostra **2,25 L** dove prima diceva 2,1 (per una
di 70 kg). I report **già generati** restano com'erano — sono fotografie di un momento, e riscriverli
vorrebbe dire cambiare un numero che una cliente ha già letto.

---

## 3. «Ha raggiunto l'obiettivo?» — vince il report ✅ DECISO

**Contesto.** Due risposte alla stessa domanda, e alimentano due schermate che si contraddicono.
Il **report** la congela sull'ultima misura entro fine piano (+2 giorni) e la scrive dentro
`ClientReport.data`; il **Negozio/checkout** (`hasReachedObjective`) la ricalcola sempre
sull'ultima misura in assoluto, e blocca l'acquisto del Mantenimento.

Obiettivo 60,0 kg. Ultima pesata del piano 59,8 → il report la congratula e mostra «Attiva il
mantenimento». Una settimana dopo pesa 60,4 → tocca il pulsante e riceve un rifiuto.

**Risposta: vince il report. Se gliel'hai certificato, può comprare.**

Il Negozio accetta l'obiettivo raggiunto **anche solo** in un report già emesso. Due ragioni, e la
seconda conta più della prima: non le si rimangia una cosa scritta nera su bianco; e il Mantenimento
è esattamente il piano di chi è arrivata e rischia di tornare indietro — negarglielo perché ha
ripreso seicento grammi è il contrario di quello che serve, nel momento in cui serve.

⚠️ Da scrivere con attenzione: il controllo diventa «raggiunto adesso **oppure** raggiunto in un
report emesso», non «raggiunto in un report» e basta — chi arriva all'obiettivo senza aver mai
ricevuto un report deve continuare a poter comprare.

---

## 4. Il prezzo mostrato deve essere quello addebitato ✅ DECISO

**Contesto.** La regola della promo («finché è attiva si vende a `priceCents` col listino barrato;
scaduta si torna al listino pieno») è stata centralizzata il 12/8 in `commerce/prezzo-piano.ts`. Ma
**quattro punti leggono ancora il prezzo grezzo**: il Negozio, PlanFlow (il primo acquisto), il box
Mantenimento del report, e l'email G6 — che la regola se l'era addirittura riscritta inline.

Chi incassa (`commerce.service`) usa quella giusta. Quindi: piano con `priceCents` 24900,
`listPriceCents` 29700 e promo scaduta ieri → tre schermate e una email dicono **€249**, Stripe
addebita **€297**.

**Oggi non succede** perché `listPriceCents` è vuoto su tutti i piani (Opzione B). Si accende con un
singolo salvataggio da Gestione Negozio, e chi lo farà non avrà modo di sapere che sta armando questo.

**Risposta: allineo tutti al prezzo che incassa.**

Negozio, PlanFlow, report ed email leggono `effectivePriceCents`. Nessuno vede più una cifra diversa
da quella che pagherà.

⚠️ Da correggere anche il **commento** in `plan-report.service.ts:95-97`, che documenta il
comportamento sbagliato come se fosse voluto: è il tipo di riga che fa richiudere il difetto a chi
passa di lì fra sei mesi.

---

## 5. «Riceve i menu?» — una regola sola, quella dell'erogazione ✅ DECISO

**Contesto.** Due risposte dentro **lo stesso file** (`common/piano-attivo.ts`): il filtro
`filtroClienteConPianoAttivo` esclude il Monitoraggio, con tanto di spiegazione; `pianiDiClienti`
segna `riceveMenu: true` per chiunque abbia un abbonamento attivo — Monitoraggio compreso, e senza
guardare la pausa viaggio né il piano fermato dal nutrizionista. L'autorità vera è
`deliverIfEligible`, che a quelle persone non manda niente.

È il falso allarme del caso Rosaria citato nell'intestazione di quel file: la diagnostica la conta
fra le «attive» e stampa un ⚠️ su una dieta incompleta che a lei non arriverà mai.

**Risposta: una regola sola, quella dell'erogazione.**

`riceveMenu` diventa esattamente ciò che decide `deliverIfEligible`: niente Monitoraggio, niente
pausa viaggio, niente `planHeldAt`.

⚠️ Il costo del falso allarme non è il tempo perso a controllarlo: è che dopo due o tre nessuno guarda
più la lista — ed è la stessa lista dove un giorno comparirà quello vero.

---

## 6. L'obiettivo passi: il report legge il parametro ✅ DECISO

**Contesto.** `8000` scritto a mano in `plan-report.service.ts` e `reports.service.ts`, mentre la
home legge `steps_goal` dai Parametri (default 8000). Oggi coincidono, quindi non fa danno.

Il giorno che qualcuno lo alza a 10.000: la home chiede 10.000, il report scrive «Punta ad almeno
8.000 passi» e disegna la linea dell'obiettivo a 8.000. Il report dichiara raggiunto un obiettivo che
l'app considera mancato — col numero sbagliato stampato in un PDF che la cliente conserva.

**Risposta: il report legge `steps_goal`.**

Le due costanti spariscono. Nessun cambiamento visibile oggi — il default è lo stesso — e il campo
nei Parametri smette di essere una trappola per chi lo toccherà.

---

## 7. «Qual è la dieta assegnata?» — una ricerca sola ✅ DECISO

**Contesto.** Il caso più delicato dei sei, perché le due copie alimentano **la stessa frase** letta
da due persone che poi devono parlarsi.

- **Staff** (`clients.service`): cerca la variante esatta — nome + stile + regime + pasti — e in
  ripiego passa da `pickDietFor`, cioè **la stessa funzione che sceglie davvero i menu**.
- **Cliente** (`profile.service`): `diet.findFirst({ where: { name: dietFamily } })`. Solo il nome.
  È esattamente «la riga che mentiva», descritta e corretta l'11/8 sul lato staff e rimasta qui.

Cliente onnivora, 5 pasti, `dietFamily = "Mediterranea senza glutine"`, e quella variante a 5 pasti
non è a catalogo: lo staff ripiega su «Mediterranea», vede che le giornate future *sono* Mediterranea
e **non mostra nessun avviso**; la cliente confronta con «Mediterranea senza glutine» e legge in app
che i suoi prossimi menu sono ancora sulla dieta vecchia. Nessuna delle due può convincere l'altra.

**Risposta: la cliente usa la stessa ricerca dello staff.**

Un solo modo di rispondere, quello che passa da `pickDietFor`.

⚠️ Non sistema solo l'avviso: dalla stessa riga sbagliata escono anche lo **stile** e la
**descrizione** mostrati in app, che oggi possono venire da una variante a caso della famiglia. È il
caso Cristina, spostato dal backoffice all'app.

---

## 8. L'obiettivo passi diventa per cliente ✅ DECISO (domanda di Simone)

**Domanda di Simone:** «il numero di passi potrebbe essere una variabile bilanciata per cliente? non
conosco i parametri necessari».

**I parametri ci sono già tutti**, li raccoglie il questionario: sesso, età, altezza, peso e
soprattutto `activityLevel` sulle cinque fasce, che usiamo già per il fabbisogno calorico. E
`StepLog.goal` è scritto riga per riga, quindi un obiettivo per persona non richiede migrazioni.

**Risposta: sì, per fascia di attività, con crescita.** Partenza 6.000 (sedentaria) → 12.000 (molto
attiva), +5% ogni due settimane, tetto a +40%.

⚠️ **A chi si muove meno si chiede MENO, ed è voluto**: 10.000 passi al primo giorno a chi ne fa
3.000 non la fanno camminare, le fanno chiudere la schermata. Stessa lezione del conforto.

⚠️ **La mediana personale (il modo che funziona meglio) NON si può fare oggi**: `StepLog.source`
prevede `healthkit` e `google_fit` col commento «(futuro)», ma si scrive solo `manual` — i passi li
digita a mano. Una mediana su tre giorni inseriti a caso è rumore con l'aria di un dato. Si passa
alla storia quando i passi arrivano dal telefono.

⚠️ **La scala la conferma Nocanty**: per chi ha problemi cardiaci, articolari o è in gravidanza,
prescrivere passi è materia clinica.

**Popup di spiegazione** (chiesto da Simone): un «?» accanto al numero nel quadrotto passi, che apre
una scheda con la regola detta a lei. Serve perché quel numero **cambia da solo**: un obiettivo che
si muove senza spiegazione si legge come un guasto, e la reazione non è camminare di più — è smettere
di fidarsi del numero.
