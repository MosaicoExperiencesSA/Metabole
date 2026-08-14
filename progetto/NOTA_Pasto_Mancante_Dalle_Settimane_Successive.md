# Il pasto che manca si prende dalle settimane successive — decisione del 14/8/2026

> Richiesta di Simone, 14/8: «Scriviamo una regola che se per esempio settimana 2 digiuno
> intermittente giorno 2 mi manca la cena vado a cercare la cena nelle settimane successive con le
> giuste caratteristiche».

## Com'è oggi (verificato nel codice)

`menu.service.soloGiornateComplete` (§15.4, 11/8) **scarta** la giornata monca: si servono solo le
complete, e il ciclo si accorcia. Sotto c'è la scala dei ripieghi: nessuna completa → gemella della
stessa famiglia → nessuna gemella → non si eroga e si apre una segnalazione. Il difetto che quella
regola chiudeva era servire una giornata con la sola colazione; il prezzo è che una giornata a cui
manca **un** pasto si butta via intera, anche quando quel pasto esiste identico due settimane dopo.

## La regola nuova

**Prima di scartare, si RIPARA.** Per ogni slot mancante di una giornata si cerca un piatto per
quello **stesso slot** nelle **altre giornate della stessa dieta e dello stesso livello**, e si
mette lì.

1. **Si guarda AVANTI per prime** — è la richiesta testuale: `dayIndex` maggiore, dalla più vicina
   alla più lontana (settimana 3, poi 4…). Solo se avanti non c'è niente si guarda **indietro**:
   meglio un pasto che nessun pasto, e il piatto resta comunque del ciclo di quella dieta.
2. **«Le giuste caratteristiche» sono queste, e sono già garantite dalla provenienza**: stesso
   slot, e il piatto viene dal **catalogo di quella dieta** (le sue stesse giornate), quindi passa
   dagli stessi filtri di sempre — regime, stagionalità, esclusioni e allergeni della cliente
   restano a valle (`buildScoringContext` / `evaluateMeals`): questa regola **non li scavalca**.
   ⚠️ Non si va a pescare in catalogo fuori dalla dieta: sarebbe un'altra dieta, non una riparazione.
3. **Mai un doppione nella stessa giornata**: un piatto già presente in un altro slot di quel
   giorno non è un candidato. Trovarsi lo stesso piatto a pranzo e a cena è peggio del buco.
4. **A parità, comanda il target calorico** quando lo si conosce: fra i candidati vince quello che
   avvicina di più il totale della giornata al target del livello. Se le kcal non sono note si
   prende il primo in avanti — dichiarato, non finto.
5. **La giornata riparata si SEGNA**: log con quale giorno, quale slot e da dove è arrivato il
   piatto, più un evento `diet_day_repaired`. Un ripiego dichiarato è un dato, uno nascosto è un
   errore — e il nutrizionista deve comunque completare il catalogo: la riparazione toglie il danno
   alla cliente, non il lavoro dal tavolo.
6. **Se dopo la riparazione la giornata è ancora monca**, si scarta come prima: la scala dei
   ripieghi (gemella → segnalazione) resta identica. Questa regola **aggiunge** un gradino sopra,
   non ne cambia nessuno.
7. **Funzione pura** (`menu/ripara-giornata.ts`), come `giornate-complete.ts`: riceve le giornate e
   le restituisce riparate, senza Prisma. Così la si collauda con giornate vere e la stessa regola
   può servire domani al gate del catalogo.

## Cosa NON si fa

- Non si inventa un pasto (nessuna ricetta creata, nessun piatto «equivalente» calcolato).
- Non si tocca la giornata a catalogo: la riparazione vive nel `MenuDay` della cliente, come tutte
  le personalizzazioni (regola ferrea: la ricetta di catalogo è di tutte, non di una).
- Non si spegne l'avviso al nutrizionista: il conteggio delle giornate monche resta nel log.
