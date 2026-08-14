# Vera guida la giornata — decisione del 14/8/2026 (prima del codice)

> Richiesta di Simone, 14/8 mattina, in chat: «l'assistente avevamo detto avrebbe aiutato la
> dottoressa anche nella gestione quotidiana: facciamo in modo che legga notifiche e avvisi in modo
> da guidare la nutrizionista, e nel caso del capo nutrizionista lo avvisi quando ha cose da
> approvare inserite dal suo team».

## Il difetto visto (screenshot del 14/8, 08:35)

«Ciao hai segnalazioni per me?» → «Non ci arrivo». La domanda esplicita non è un intento:
`cosaTiPorto` scatta solo quando ha qualcosa da portare, quindi **a coda vuota la domanda cade nel
«non capito»** — che è vero e fuorviante, perché la risposta giusta esiste già (`codaVuota`).

## Le decisioni

1. **Nuovo intento `segnalazioni`** in `capisci.ts`: le domande esplicite sulla giornata («hai
   segnalazioni?», «cosa mi aspetta?», «cosa c'è da fare/vedere?», «novità?», «avvisi?»,
   «guidami», «da dove comincio?»). Forme **ancorate all'intera frase**: «avvisi la cliente che…»
   resta un'istruzione e NON combacia. Riconosciute PRIMA di `daScartare` (sono domande che
   meritano risposta, come «hai la lista dei formaggi molli?»).
2. **La risposta è il quadro della giornata**, e risponde SEMPRE, anche a vuoto:
   - le tre code di `aspetta-me` (domande aperte; proposte da approvare, solo per il capo;
     sostituzioni da verificare) — contate **dalle tabelle di origine**, non dalle notifiche;
   - **le notifiche in-app non lette** dell'utente, raggruppate per tipo con etichette leggibili.
     ⚠️ Escluse dai gruppi le `vera_richiesta`/`vera_proposta_in_coda`, già contate alle code
     sopra: due contatori sulla stessa cosa prima o poi ne dicono due.
   - poi Vera **porta subito la prima cosa da fare** (riusa `cosaTiPorto`): guida, non elenca.
   - tutto vuoto → `codaVuota()`, non «non ci arrivo».
3. **Le notifiche NON si marcano lette dalla chat**: leggerne il conto in chat non è averle
   gestite; la campanella resta finché non le apre.
4. **L'avviso al capo sulla proposta nuova**: in coda a `registro.scrivi`, quando
   `inApprovazione` è vero, notifica in-app `vera_proposta_in_coda` a tutti i capi attivi
   (**escluso l'autore**), col pattern di `avvisa-capo.ts`: DOPO la scrittura, e **non lancia
   mai**. ⚠️ Niente email: quella resta solo per il conflitto sanitario (orologio diverso —
   Decisione di Simone 13/8). ⚠️ Se la riga è anche `conflittoSanitario`, parte SOLO l'avviso di
   conflitto, che è più forte: niente doppia campanella per la stessa riga.

## Cosa NON si fa (e perché)

- Nessun modello che «legge» le notifiche: il quadro si compone dai contatori veri, in modo
  deterministico, come tutto il resto di Vera.
- Nessun riassunto delle notifiche delle CLIENTI: la chat di Vera è della nutrizionista; le sue
  clienti hanno Gaia.
- `cosaTiPorto` non cambia comportamento all'apertura pagina (a vuoto continua a tacere: un agente
  che saluta con «niente da fare» ogni volta insegna a non leggerlo). Cambia solo la risposta alla
  **domanda esplicita**.
