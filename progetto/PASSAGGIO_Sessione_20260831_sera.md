# Passaggio — sessione del 31/8 (sera)

## Cosa è stato consegnato oggi (tutto già pushato)

1. **Chat dello staff** — il nome della cliente apre la sua scheda in un'altra finestra (solo a chi
   ha il permesso `clients`); i messaggi inoltrati da Gaia portano una riga di contesto letta dallo
   stato del dialogo, così un «1» non arriva più nudo; e la pagina dell'assistente si apre davvero
   sull'ultimo messaggio.
   ⛔ La lezione: **una lista che si apre in cima non è la prova che manchi il codice per
   scorrerla.** Il codice c'era da sei giorni. La causa era `if (loading) return <Spinner />`: i
   messaggi arrivano mentre al posto della scatola c'è la rotellina, il `ref` è `null`, e quando la
   scatola compare l'effetto non riparte. Adesso si scorre **quando la scatola si attacca**.

2. **`npm run diag:allergeni-deducibili`** — i due numeri promessi a Nocanty al §5 del foglio.
   Sola lettura.

3. **`npm run diag:fase0`** — la misura della Fase 0 del piano panieri. Sola lettura.

## La prima cosa da fare alla prossima sessione

Sulla shell di Render, dentro `~/project/src/backend`:

```
npm run diag:fase0
npm run diag:allergeni-deducibili
```

Nessuno dei due scrive niente. Il primo dice se la Fase 1 dei panieri si apre, il secondo dice
quanto costa la Fase 8. **Incollare l'output in chat.**

⚠️ **Come si leggono, e non è un dettaglio.**
- `diag:fase0` stampa **due** verdetti: su tutte le 306 varianti e sulle sole varianti con clienti
  sopra. Se il primo è «no» e il secondo «sì», il piano **non cambia**: quello che manca sta su
  varianti che nessuno usa e che le famiglie doppione portano via con sé (§2.3 del piano).
- `diag:allergeni-deducibili` stampa **tre** numeri e non due. Misurato sulle 273 ricette del repo
  con le 306 righe di tabella dei seed si ferma l'82% — ma i nomi che fermano di più sono
  `insalata`, `zucchine`, `pomodoro`, `riso`, `albumi`. Quel numero misura **quanto è indietro la
  tabella alimenti** (306 righe contro 7831 nomi di ingrediente usati), non quanto sono scritte male
  le ricette. ⛔ Portato a Nocanty così com'è gli farebbe bocciare l'Opzione A per la ragione
  sbagliata.

## LA DOMANDA APERTA, e blocca la scrittura in DECISIONI_Panieri.md

Nocanty ha firmato Q1 il 31/8, ma **la casella è ambigua**: quella davanti ad «A» è stata
cancellata e la riga adesso dice `A ☐ B X C`. Letta com'è scritta sembra **B**; nel PDF la X sta nel
posto esatto dove stava la casella di **C**. Simone ha risposto «C».

Alla proposta di una **via di mezzo** ha risposto «ok vai così», che ho letto come *sì alla via di
mezzo* — ma non è stato confermato a parole. **Da confermare prima di scrivere qualsiasi cosa in
`DECISIONI_Panieri.md`.**

La via di mezzo, per esteso:
> Allergeni **dedotti dagli ingredienti sommati a quelli suggeriti dall'AI** (mai l'AI da sola dove
> la deduzione dice di più), e le ricette con un ingrediente non riconosciuto **si servono a tutte
> tranne a chi ha dichiarato quell'allergia o intolleranza**, finché non le guarda qualcuno. Il
> catalogo parte come in C; nessun allergene incerto arriva addosso a chi quell'allergene ce l'ha.

⚠️ Se invece resta **C secco**, serve una riga di Nocanty che dica «C» **a lettere**, non una X in
una casella che si legge in due modi. C è l'unica opzione in cui allergeni scritti dall'AI e mai
guardati finiscono nei piatti, ed è quella che il foglio stesso dichiarava di non sentirsela di
proporre.

## L'altra decisione tecnica in sospeso (mia, non di Nocanty)

Il riconoscimento degli ingredienti passa da `abbinaPerRicetta`, che è **tarato sulle calorie**:
torna «non lo so» quando due righe vanno bene uguale, e non collega «riso» a «riso basmati». Per le
calorie è giusto — integrale e bianco sono numeri diversi. Per gli **allergeni** quell'ambiguità non
esiste: qualunque riso dà la stessa risposta. O si tara il riconoscimento sulla domanda vera (coda
più corta, e nessun rischio in più), o si accetta una coda più lunga di quanto serva.
Scritto nella voce `allergeni-deducibili-i-due-numeri` dell'elenco lavori.

## Difetti dichiarati e ancora aperti

- ⛔ **L'erogazione non controlla `active`**, la base personale sì: una ricetta in bozza ancora
  nominata da una giornata **viene servita** da una porta e rifiutata dall'altra. È il §2.4 del
  piano; `diag:fase0` stampa quante ricette sono in quello stato.
- ⚠️ **Essere in tabella non vuol dire conoscerne gli allergeni**: su un «pesto pronto» che avesse
  la sua riga la deduzione direbbe «nessun allergene» con la stessa faccia. È il limite n° 2 del
  foglio, e si chiude dichiarando gli allergeni **sull'alimento** — non allungando un elenco di
  parole.
- ⚠️ Dallo screenshot della chat dell'assistente: «a patrizia sogari sostituisci Biscotti d'Avena e
  Banana con Biscotti senza glutine e banana» → «Non ci arrivo», due volte. I nomi di piatto che
  contengono «e» spezzano `nomeAlimento` sulla congiunzione e `leggiElenco` torna `null`. **Da
  chiudere**, non ancora aperta come voce.

## Nota di metodo, da non perdere

Nelle ultime tre consegne la revisione avversariale ha trovato, ogni volta, **prove che passavano
anche col difetto dentro**: una guardia che cercava la rotellina di un altro componente, una che non
guardava le dipendenze del `useMemo`, e tre mutazioni sopravvissute sul verdetto della Fase 0.
⛔ Una mutazione va **verificata che si sia davvero applicata** prima di lanciare i test — due volte
sono risultate «sopravvissute» solo perché la sostituzione non aveva toccato il file.
