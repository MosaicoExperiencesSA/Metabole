# Gaia, cambio colazione: «dolce o salata?» — decisione del 14/8/2026 (prima del codice)

> Richiesta di Simone, 14/8 in chat (dallo screenshot della conversazione con Antonio): «nel caso
> il cliente chieda il cambio colazione deve chiedere dolce o salata? e in base alla risposta
> cercare nel pool delle colazioni una con ingredienti diversi con lo stesso apporto di
> nutrizionali».

## Le decisioni

1. **La domanda si fa SOLO per la colazione**, e SOLO se la cliente non ha già detto cosa vuole:
   «una colazione proteica» ha già risposto a una domanda più precisa — richiedere «dolce o
   salata?» dopo sarebbe ignorare quello che ha appena scritto.
2. **Il gusto sono i tag di Lucia**: `piatto:dolce` / `piatto:salato` (pagina Colazioni,
   Decisioni 13/8 §12). ⚠️ Una colazione **senza tag non partecipa** alla ricerca filtrata — è la
   stessa regola dell'azione di Vera: il tag scritto È la conferma di una persona, e proporre come
   «salata» una colazione che nessuno ha classificato è un'invenzione.
3. **«Stesso apporto» = le regole che il cambio piatto ha già**: tolleranza kcal
   (`menu_kcal_balance_tolerance_pct`, 15%), solo la base personale certificata
   (`client_menu_pool`), il piatto attuale e quelli della giornata esclusi, il quasi-omonimo in
   fondo. Non si inventa un secondo metro.
4. **Le risposte accettate**: «dolce», «salata/salato», e «fa lo stesso» (indifferente → si cerca
   senza filtro). Una risposta non capita → si ripete la domanda una volta (con l'ultima domanda
   testuale, come da regola del 12/8); alla seconda non capita si cerca **senza filtro** — meglio
   due proposte qualsiasi che un dialogo che insiste su dolce/salato.
5. **Se col filtro non c'è niente dentro le calorie**: si dice e si passa alla nutrizionista
   (strada esistente), nominando il gusto chiesto («non trovo un'alternativa salata…»).
6. Il gusto scelto finisce in `preferenzaPiatto` dello stato («colazione dolce/salata»), così il
   cambio registrato in scheda e nel report dice cosa aveva chiesto.

## In coda (stessa mattina, decisione successiva di Simone)

«Anche queste notifiche devono arrivare attraverso l'assistente: le lasciamo anche lì, ma da una
parte o dall'altra il nutrizionista risponde» — i «girati» di Gaia e i cambi da verificare devono
comparire anche nella chat di Vera, con la risposta possibile da entrambe le parti. Porta
esistente: `apriRichiestaVera` (CONTRATTO_Vera_Richieste.md). Si fa come lavoro a sé, con la sua
decisione scritta.
