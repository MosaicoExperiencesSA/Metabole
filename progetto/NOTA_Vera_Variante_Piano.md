# Vera, azione 3 — la variante di piano: decisione del 14/8/2026 (prima del codice)

> Risposta di Simone in pagina Lavori (14/8), testuale: «Cambia i pasti per i giorni futuri
> significa che la nutrizionista o detta le nuove combinazioni e crea dei menu specifici guidata
> da vera, oppure sceglie una diversa dieta, tutto quanto già erogato non cambia salvo diversa
> istruzione della nutrizionista, che alla domanda di Vera da quando se risponde da Subito va a
> correggere il menu già dal giorno dopo. quello già fatto compreso la data odierna resta fisso».

## I due meccanismi (e la spartizione)

1. **«Mettila su una dieta diversa»** — QUESTA consegna. La frase dettata a Vera fa quello che
   oggi fa la scheda cliente: stessa strada, stessa porta.
2. **«Detta le combinazioni e crea menu specifici»** — lavoro a sé, voce in lista Lavori: è la
   dettatura di giornate intere (slot per slot, con i conti di kcal), e merita la sua decisione.

## Le decisioni della consegna 1 (dieta diversa)

1. **Una strada sola: `ClientsService.updateClient`** (token `SCRITTURA_CLIENTE`), che è la porta
   della scheda: controlla il permesso `change_diet_type` sull'attore vero (la nutrizionista che
   detta), scrive `regime` + `dietStyle` + `dietFamily` (tutti e tre, dalla dieta trovata in
   catalogo: `pickDietFor` abbina famiglia+stile, e scriverne uno solo lascerebbe l'abbinamento a
   metà), fa l'audit e **rifà da sé i giorni futuri** (`redeliverFutureDays`: cancella i giorni
   `date > oggi` e rieroga; se la rierogazione non produce niente RIMETTE i giorni com'erano).
   ⚠️ Vera NON riscrive questa logica e NON importa MenuModule: la rierogazione è dentro la porta.
2. **La dieta si cerca nel catalogo** (`Diet`, solo `approved`), per nome, a parole. Zero → lo
   dico e mostro i nomi disponibili; più d'una → chiedo quale. Mai indovinare.
3. **«Da quando?»** — la domanda di Simone, due risposte utili:
   - **«da subito»** → la strada di oggi: i giorni fino a OGGI compresi restano fissi, quelli da
     domani si rifanno con la dieta nuova (è esattamente `redeliverFutureDays`: `date > oggi`);
   - **«lascia i giorni già preparati»** → la dieta cambia ma i giorni già erogati NON si
     toccano: la nuova entra coi prossimi menu generati. Serve un flag nuovo sulla porta
     (`dietChangeKeepDeliveredDays` nel DTO, letto e mai scritto sul profilo).
   Una data puntuale («dal 20/8») è un'estensione futura: oggi non si indovina — risposta non
   capita → si ripete una volta, alla seconda si ANNULLA senza scrivere (una data sbagliata
   scrive menu sbagliati).
4. **Anteprima prima del sì**, come tutto il resto: chi è la cliente, da quale dieta a quale,
   cosa succede ai giorni (e l'avvertenza onesta: se adesso non è idonea a ricevere menu, i
   giorni vecchi restano e si vede in scheda — è il paracadute di `redeliverFutureDays`).
5. **Registro**: azione `variante_cliente` (il tipo esiste già), ambito `cliente`, con
   `dettaglio { cambioDieta: { prima, dopo, daSubito } }`. Per la cliente si applica senza capo
   (decisione 13/8: «se è per la cliente applica»). Il ritorno alla dieta di prima si fa
   ridettando la frase inversa — stessa strada, stessa anteprima.
6. **Niente qui tocca i giorni già visti o passati**: `redeliverFutureDays` parte da domani per
   costruzione. «Quello già fatto compresa la data odierna resta fisso» è garantito dalla query,
   non da una promessa.
