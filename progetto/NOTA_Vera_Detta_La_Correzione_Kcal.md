# «Riduci le kcal del 10% a Giulia per 7 giorni» — decisione del 14/8/2026

> La seconda metà della richiesta di Nocanty (13/8): «La percentuale la inserisco io nella scheda
> della cliente e memorizzi il mio cambiamento… **Questa cosa vorrei farla anche dalla mia
> assistente**». Il campo e la scadenza esistono dalla consegna delle 11 (`kcalAdjustUntil`,
> `NOTA_Correzione_Kcal_A_Termine.md`): sono nati proprio perché la dettatura potesse scriverli
> senza inventarsi una seconda strada.

## Le decisioni

1. **Una strada sola: la porta che c'è già.** Vera scrive passando da
   `NutritionistService.impostaKcal` (token `SCRITTURA_KCAL`, come `SCRITTURA_CLIENTE` per il
   profilo). Quella porta ha già tutto quello che serve e che Vera non deve rifare: il permesso
   sulla cliente, lo storico in `kcal_override`, il rifiuto sotto la soglia di sicurezza, l'avviso
   ai capi. ⚠️ Riscrivere qui il calcolo o la scrittura vorrebbe dire due strade per lo stesso dato
   clinico — il difetto che questo progetto ha già pagato due volte.
2. **L'anteprima è il numero vero, non la percentuale.** Prima di scrivere, Vera dice **quante kcal
   al giorno** avrebbe adesso e quante avrebbe dopo (`simulaKcal`, stessa simulazione del
   backoffice). «Le tolgo il 10%» non dice niente a nessuno; «passa da 1620 a 1460 kcal al giorno,
   fino al 21/8» sì. È la regola del pool applicata ai numeri.
3. **La durata si può non dire, e allora si chiede.** «Riduci del 10% a Giulia» senza giorni →
   l'agente chiede per quanto, offrendo «per sempre» come risposta esplicita. Non si indovina una
   durata: «per 7 giorni» e «finché non te lo dico io» sono due prescrizioni diverse.
4. **La soglia di sicurezza NON si scavalca da Vera.** Se il numero finisce sotto il pavimento, la
   porta rifiuta con la sua frase e Vera **si ferma e lo dice**: quella conferma esplicita si dà
   dalla scheda, guardando il numero. ⚠️ È una decisione: dettare a voce «sì vai» a una domanda che
   il backoffice fa apposta due volte toglierebbe il senso alla domanda. Il clinico decide, ma
   davanti al numero.
5. **Il motivo è la frase originale.** `impostaKcal` pretende un motivo, e giustamente: qui il
   motivo è **quello che ha detto lei**, per intero — la stessa regola del registro di Vera. Chi
   rilegge fra tre mesi trova la frase vera, non un riassunto.
6. **Registro**: azione `variante_cliente` con `dettaglio.correzioneKcal { pct, giorni, prima,
   dopo }`. Il numero prima e dopo si conserva: il fabbisogno cambia col peso, quindi fra un mese
   quella percentuale darà un altro numero, e senza questi due non si saprebbe cos'era.

## Cosa NON si fa

- Non si tocca il **deficit** a voce: quella è la leva clinica grossa (kcal/giorno, agganciata al
  fabbisogno). Se servirà, sarà un'altra frase con la sua decisione.
- Non si scrive niente senza l'anteprima e il sì, come per tutto il resto di Vera.
