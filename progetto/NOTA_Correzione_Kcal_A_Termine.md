# La correzione calorica ha una DURATA — decisione del 14/8/2026

> Risposta di Nocanty in pagina Lavori (13/8) alla domanda §15.2 punto 1: «La percentuale la
> inserisco io nella scheda della cliente e **memorizzi il mio cambiamento** esempio *riduci le kcal
> del 10% per 7 giorni e poi riprendi col normale ritmo*. Questa cosa vorrei farla anche dalla mia
> assistente».

## Cosa c'era già (verificato nel codice)

`ClientProfile.kcalAdjustPct` esiste dall'11/8 (§15.5) e funziona: `−10` toglie il 10% al target,
entra **dopo** il deficit e **prima** del pavimento (`menu/correzione-kcal.ts`), e ogni cambiamento
lascia una riga in `kcal_override`. Manca **la seconda metà della frase**: «per 7 giorni e poi
riprendi col normale ritmo». Oggi la correzione resta per sempre finché qualcuno se ne ricorda — e
nessuno se ne ricorda: è il classico dato che agisce e non si vede.

## Le decisioni

1. **Un campo nuovo, additivo**: `ClientProfile.kcalAdjustUntil` (data, nullable). `null` = «vale
   finché non la tolgo», che è il comportamento di oggi e quindi **nessuna cliente cambia** con la
   migrazione. Una data = l'ultimo giorno in cui la correzione vale.
2. **Scade da sola, senza cron.** La correzione si legge al momento del calcolo: se
   `kcalAdjustUntil` è passata, la percentuale **non si applica** e il target torna quello normale.
   ⚠️ Nessun lavoro notturno che «pulisce» i campi: un cron che azzera dati è un cron che un giorno
   azzera il dato sbagliato, e comunque il menu si genera guardando il profilo, non il calendario.
3. **Il valore NON si cancella alla scadenza**: resta scritto, spento. Serve a chi apre la scheda
   («le avevo tolto il 10% fino al 21») e serve al registro. Cancellarlo renderebbe invisibile una
   decisione clinica presa.
4. **La scadenza è inclusiva**: «per 7 giorni» da oggi vuol dire che l'ultimo giorno coperto è
   oggi+6, e dal settimo giorno dopo si riprende. Si confronta per **giorno**, non per istante: un
   menu generato alle 23:50 non deve comportarsi diversamente da uno generato alle 8:00.
5. **La spiegazione lo dice**: la frase che il backoffice mostra («togli il 10%») diventa «togli il
   10% fino al 21/8» finché è attiva, e quando è scaduta il target spiega di essere tornato normale.
   Un numero che cambia da solo senza una frase che lo spiega è un guasto, non una funzione.
6. **Vera arriva dopo, con la sua voce**: «riduci le kcal del 10% a Giulia per 7 giorni» è una frase
   da riconoscere, con anteprima e conferma come tutto il resto — e tocca i numeri nel piatto, che
   è la cosa che questo progetto tratta con più prudenza. Prima il motore e la scheda (questa
   consegna), poi la dettatura (voce in lista Lavori). ⚠️ Il campo nasce ora proprio perché la
   dettatura possa scriverlo senza inventarsi una seconda strada.
