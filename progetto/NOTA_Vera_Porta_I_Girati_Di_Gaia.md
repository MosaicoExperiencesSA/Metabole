# Vera porta i «girati» di Gaia — decisione del 14/8/2026

> Richiesta di Simone, 14/8 (dallo screenshot della chat di Antonio, dove Gaia scrive «ho girato la
> richiesta alla tua nutrizionista, che ti risponde nel vostro thread»): «anche queste notifiche
> devono arrivare attraverso l'assistente, poi le lasciamo anche lì, ma **da una parte o
> dall'altra il nutrizionista risponde**».

## Com'è oggi (verificato)

Quando Gaia non se la sente di decidere (`passaAllaNutrizionista`) apre una **segnalazione**
(`apriSegnalazione`, che almeno trova un destinatario se la cliente non ha una nutrizionista) e dice
alla cliente «ti risponde lei nel vostro thread». La nutrizionista lo scopre solo se apre la pagina
Segnalazioni **o** la chat: la coda di Vera non ne sa niente, e il quadro della giornata le conta
ma non le porta.

## Le decisioni

1. **La segnalazione RESTA dov'è** («poi le lasciamo anche lì»): non si sposta niente, si
   *aggiunge* una porta. In coda a `passaAllaNutrizionista` si apre anche una richiesta Vera di
   tipo **`girata_da_gaia`**, con `chiave = gaia:<escalationId>` — idempotente per costruzione: la
   stessa segnalazione non genera due domande.
2. **Vera la porta in chat con la sua domanda**, diversa da quella delle allergie: lì si chiede un
   elenco di alimenti, qui si chiede **una risposta per la cliente**. Tre uscite: si detta la
   risposta, «la vedo io» (chiude la domanda senza scrivere alla cliente — la nutrizionista aprirà
   la chat), «lascia stare» come sempre.
3. **La risposta dettata a Vera arriva davvero alla cliente**, nel thread `nutritionist`, firmata
   dal ruolo di chi l'ha dettata: è il punto della richiesta — «da una parte o dall'altra». ⚠️ Il
   thread si crea se non esiste (`upsert` sulla coppia cliente+controparte): una cliente che non ha
   mai scritto alla nutrizionista non deve far fallire la risposta.
4. **Rispondere da Vera CHIUDE anche la segnalazione** (`status: 'resolved'`, `resolvedAt`): è
   l'altra metà di «da una parte o dall'altra», e senza questo la stessa cosa resterebbe aperta in
   pagina per sempre.
5. **Chiudere la segnalazione dalla pagina toglie la domanda da Vera**: quando l'agente sta per
   portare una `girata_da_gaia`, guarda l'escalation nella chiave — se non è più aperta, la
   richiesta si chiude da sola (`stato: 'chiusa'`, senza risposta) e si passa alla prossima. ⚠️ Si
   controlla al momento di portarla e non con un cron: una domanda che torna dopo che l'hai già
   gestita altrove è il modo più rapido per insegnare a non leggere l'agente.
6. **Il quadro della giornata non cambia forma**: le `girata_da_gaia` sono richieste aperte, quindi
   entrano nella riga «domande aperte che aspettano una risposta» già esistente. Nessun contatore
   nuovo — due contatori sulla stessa cosa prima o poi ne dicono due.
7. **Non lancia mai**: se l'apertura della domanda fallisce, la segnalazione è già stata aperta e la
   cliente ha già avuto la sua risposta da Gaia. Ma **l'errore si scrive nei log**: una coda che
   smette di riempirsi in silenzio è peggio di una coda vuota.

## Cosa NON entra in questa consegna

- **I cambi da verificare** (`FoodSwap` `da_verificare`): il quadro della giornata li conta già, e
  la verifica ha la sua tabella in scheda con «correggi». Portarli in chat vuol dire decidere cosa
  succede quando la nutrizionista corregge i grammi *a voce* — merita la sua decisione. Voce nuova
  in lista Lavori.
- **L'agente del coach**: Vera è della nutrizionista (`nutri_assistant`). Un assistente che porta
  le attività al coach è un'altra cosa, con un'altra chiave di permesso e un altro perimetro: voce
  a sé, decisione prima del codice.
