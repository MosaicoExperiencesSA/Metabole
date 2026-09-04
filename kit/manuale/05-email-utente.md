# 05 · Cambio email, doppia email, scelta della principale

Questo capitolo risolve un problema che sembra piccolo e non lo è: **un utente cambia indirizzo, e
non deve perdere l'account nel farlo.**

## Il difetto del modo ovvio

Il modo ovvio è: campo «nuova email», salva, fatto. Ha due modi di andare male, e sono tutti e due
irreversibili:

1. **Errore di battitura.** L'utente scrive `mario@gmial.com`. Da quel momento l'account ha
   un'email che non esiste: non riceve più niente, e il reset password — l'unica via di rientro —
   manda il link a una casella che non c'è. **L'account è perso.**
2. **Indirizzo di qualcun altro.** Scrive l'indirizzo di un collega, o uno che non controlla più.
   Stesso risultato, con in più che i suoi dati arrivano a un terzo.

Nessuno dei due dà un errore. Si scoprono quando è tardi.

## La soluzione del kit: due indirizzi, uno principale

L'account ha **due caselle**, non una:

```prisma
email          String  @unique                              // la PRINCIPALE
secondaryEmail String? @unique @map("secondary_email")      // l'alternativa, verificata
```

E due regole che non cambiano mai:

> **Si entra con tutte e due. Si riceve solo sulla principale.**

Il login accetta entrambe — l'utente entra con quella che si ricorda. Notifiche, ricevute, avvisi
vanno **sempre** alla principale: una sola, altrimenti nessuno sa più dove guardare, e un documento
mandato a due caselle è un documento in giro in un posto in più.

## Il flusso completo, passo per passo

```
1.  L'utente inserisce la nuova email
    POST /auth/email-change/request  { newEmail }
        ├─ è già una delle sue due?         → «già collegata al tuo account»
        ├─ è di un altro account?           → «già in uso»
        ├─ crea ActionToken(email_change, email = newEmail), 48h
        └─ manda il link ⚠️ ALLA NUOVA EMAIL, non alla vecchia

2.  L'utente apre la nuova casella e clicca
    POST /auth/email-change/confirm  { token }
        ├─ ricontrolla che non sia stata presa nel frattempo   ← ⚠️ serve davvero
        └─ la nuova diventa SECONDARIA. La principale NON cambia.

3.  Adesso ha due indirizzi, e sceglie lui
    POST /auth/email/primary        → scambia principale ↔ secondaria
    DELETE /auth/email/secondary    → toglie la secondaria
```

## Perché tre passi e non uno — le quattro ragioni

1. **Il link va alla NUOVA email.** È l'unica cosa che dimostra che quella casella esiste ed è sua.
   Un link mandato alla vecchia dimostra solo che sa leggere la vecchia — che lo sapevamo già.
2. **La nuova entra come SECONDARIA, non come principale.** Finché l'utente non decide, l'account
   resta raggiungibile all'indirizzo di prima. Se ha sbagliato qualcosa, non ha perso niente.
3. **Lo scambio è un atto separato e consapevole.** «Rendi principale questa» è un pulsante che si
   preme guardando i due indirizzi scritti sullo schermo. È molto difficile sbagliarlo.
4. **Non si perde mai il vecchio indirizzo.** Lo scambio è uno *scambio*: la vecchia principale
   diventa secondaria e continua a far entrare. Si toglie solo con un gesto in più, quando l'utente
   è sicuro.

## I quattro controlli che non si saltano

| Controllo | Se lo salti |
|---|---|
| L'indirizzo non è già uno dei suoi due | l'utente "cambia" con lo stesso e non capisce perché non succede niente |
| L'indirizzo non è di un altro account | due account con la stessa email: il login non sa più chi far entrare |
| **Ricontrollo alla conferma** | fra richiesta e click passano ore: qualcuno può essersela presa nel frattempo |
| La modifica è in **transazione** | token consumato ed email non salvata: l'utente ha bruciato il link per niente |

⚠️ Il terzo è quello che si dimentica sempre. Il token dura 48 ore: in 48 ore un altro utente può
registrarsi con quell'indirizzo. Il controllo va rifatto **al momento della conferma**, non solo
al momento della richiesta.

## Cosa vede l'utente nelle Impostazioni

```
┌─ Le tue email ────────────────────────────────────────────┐
│                                                           │
│  mario.rossi@vecchia.it            [ PRINCIPALE ]         │
│  ↳ ricevi qui notifiche e ricevute                        │
│                                                           │
│  mario@nuova.it                    [ Rendi principale ]   │
│  ↳ verificata · puoi entrare anche con questa   [ × ]     │
│                                                           │
│  ── Aggiungi un'email ──────────────────────────────────  │
│  [                              ]  [ Invia verifica ]     │
│  Ti mandiamo un link su quell'indirizzo. Diventa la tua   │
│  seconda email: la principale la scegli tu dopo.          │
└───────────────────────────────────────────────────────────┘
```

⚠️ La frase sotto il campo non è decorazione: è quello che impedisce all'utente di pensare di aver
già cambiato indirizzo e di smettere di guardare la vecchia casella.

⚠️ **Un indirizzo non verificato non compare in questo elenco.** Finché il link non è stato
cliccato, quell'indirizzo non è dell'utente: mostrarlo in grigio con scritto «in attesa» sembra un
possesso, e invita a considerarlo acquisito.

## Le tracce nel registro

Quattro azioni, tutte da registrare (capitolo 07):

```
auth.email_change_requested   { newEmail }
auth.email_change_confirmed   { newEmail }
auth.email_primary_swapped
auth.email_secondary_removed
```

⚠️ Il cambio di email è il primo passo di quasi ogni presa di controllo di un account. Se non è nel
registro, il giorno che serve capire cosa è successo non c'è niente da leggere.

## Il caso dell'amministratore

Se un amministratore può cambiare l'email di un altro utente dal backoffice — e prima o poi lo
chiederà — quel percorso **è una chiave di permesso sua** (capitolo 03) e salta la verifica, perché
non è l'amministratore a possedere quella casella.

⚠️ Allora la traccia nel registro diventa l'unica difesa che resta: `admin.user_email_changed` con
`actorId`, vecchio e nuovo indirizzo. E l'utente riceve un avviso **al vecchio indirizzo** che dice
che è cambiato. Un cambio silenzioso fatto da un terzo è indistinguibile da un furto d'account.

## Checklist di montaggio — capitolo 05

- [ ] `secondaryEmail` a schema, `@unique`
- [ ] Il login cerca su tutti e due i campi
- [ ] Le notifiche partono **solo** verso `email` (la principale)
- [ ] Le quattro rotte esistono: request, confirm, primary, secondary
- [ ] Il link di verifica va alla **nuova** casella
- [ ] La conferma **ricontrolla** che l'indirizzo sia ancora libero
- [ ] Consumo del token e scrittura dell'email stanno nella **stessa transazione**
- [ ] La scheda Impostazioni mostra i due indirizzi con l'etichetta «principale»
- [ ] Le quattro azioni finiscono nel registro attività
- [ ] Se esiste il cambio da amministratore: chiave di permesso sua + avviso al vecchio indirizzo
