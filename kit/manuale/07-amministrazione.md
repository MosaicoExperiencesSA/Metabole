# 07 · Le pagine di amministrazione

Cinque pagine, e sono quelle che ci sono **in ogni progetto**: Utenti, Ruoli, Permessi, Log
attività, Lista lavori. Si montano tutte e cinque all'inizio, anche se il progetto è piccolo — sono
quelle che ti permettono di non toccare più il database a mano.

---

## 7.1 · Utenti

**Chiave:** `users` · **Rotta:** `/utenti` · **API:** `/admin/users`

### Cosa fa

Elenco filtrabile (ruolo, stato, ricerca testuale) e scheda del singolo utente.

| Metodo | Rotta | Cosa fa |
|---|---|---|
| `GET` | `/admin/users` | elenco, con filtri e paginazione |
| `GET` | `/admin/users/:id` | la scheda |
| `POST` | `/admin/users` | crea (nasce con `mustChangePassword`) |
| `PATCH` | `/admin/users/:id` | anagrafica, ruolo, stato |
| `DELETE` | `/admin/users/:id` | **sospende**, non distrugge |
| `POST` | `/admin/users/:id/restore` | riporta indietro |
| `POST` | `/admin/users/:id/reset-password` | manda il link |

### Le cose da sapere

⚠️ **Cancellare vuol dire `deletedAt` + `status = deleted`, mai `DELETE FROM`.** Un utente vero ha
righe attaccate ovunque — ordini, pagamenti, messaggi, log — e una cancellazione fisica o le porta
via con sé o lascia riferimenti rotti. La cancellazione fisica vera esiste solo nel percorso GDPR
(capitolo 06), è differita, ed è un'altra cosa.

⚠️ **I poteri gravi hanno una chiave di permesso PROPRIA, non «Utenti: gestisci».** In Metabole
sono chiavi separate, una per ciascuno: impostare una password scelta, entrare nell'account di un
altro, cambiare l'email di un altro. Il motivo è sempre lo stesso: vuoi poter dare l'elenco utenti
a qualcuno **senza** dargli questi.

### «Entra come» (impersonificazione)

Se lo monti — ed è utilissimo per l'assistenza — quattro condizioni, tutte:

1. Chiave di permesso sua, **spenta** per tutti tranne chi decidi tu.
2. **Sola lettura**, imposta da una guardia sul server. Non «si raccomanda di non scrivere».
3. **Scadenza breve** (30 minuti), automatica.
4. **Striscia sempre visibile** in cima (capitolo 02) + riga nel registro all'entrata e all'uscita.

---

## 7.2 · Ruoli

**Chiave:** `roles` · **Rotta:** `/ruoli` · **API:** `/admin/roles`

Crea i **ruoli personalizzati** (capitolo 00): etichetta, colore, ruolo di sistema su cui poggiano.

```prisma
model CustomRole {
  key      String  @id      // "tutor", "segreteria"…
  label    String           // "Tutor"
  color    String?          // per la pastiglia negli elenchi
  baseRole Role    @map("base_role")
}
```

⚠️ **Cancellare un ruolo che qualcuno ha addosso**: la relazione è `onDelete: SetNull`, così quegli
utenti tornano al loro ruolo di sistema invece di restare con una chiave che non esiste più. Vanno
avvisati con un «tre utenti hanno questo ruolo, torneranno a *staff*: procedo?».

⚠️ Il ruolo di base **non è modificabile dopo la creazione**. Cambiarlo sposterebbe in silenzio i
default di tutte le pagine per tutti quelli che ce l'hanno. Si crea un ruolo nuovo.

---

## 7.3 · Permessi

**Chiave:** `permissions` · **Rotta:** `/permessi` · **API:** `/admin/permissions`

La matrice **pagine × ruoli**, con due caselle per cella (`vede` / `gestisce`).

| Metodo | Rotta | Cosa fa |
|---|---|---|
| `GET` | `/admin/permissions` | la matrice intera |
| `PATCH` | `/admin/permissions` | salva le celle cambiate |
| `GET` | `/me/permissions` | ⚠️ quello che il **frontend** usa per `can()` |

### Le cose da sapere

⚠️ **`/me/permissions` è la fonte del `can()` del frontend, e non è una protezione.** Nasconde le
voci di menu. La protezione vera è `@RequirePage` sul server (capitolo 03). Una pagina protetta solo
dal `can()` è una pagina aperta a chiunque conosca l'URL.

⚠️ **Le righe si creano all'avvio (`syncDefaults`), non alla prima apertura della pagina.** Se
esistono solo quando qualcuno apre i Permessi, prima di quel momento tutto gira sui default e nessuno
lo sa.

⚠️ **Se `syncDefaults` fallisce, l'avvio non deve tirare dritto in silenzio.** Un `warn` assorbito
lascia un'istanza viva per sempre con le righe mancanti, ed è la guardia a decidere chi entra.

⚠️ **La matrice deve dire la verità**: una chiave senza etichetta compare grezza, un'etichetta
senza chiave è un interruttore fantasma. Il test `matrice-dice-la-verita.spec.ts` lo impedisce.

---

## 7.4 · Log attività

**Chiave:** `audit_logs` · **Rotta:** `/log` · **API:** `/admin/audit-logs`

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  actorId    String?  @map("actor_id")     // chi (null = il sistema)
  action     String                        // "user.login", "payment.approved"…
  entityType String?  @map("entity_type")  // su cosa
  entityId   String?  @map("entity_id")
  metadata   Json?                         // il dettaglio
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now())

  @@index([actorId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@index([action, createdAt])   // ⚠️ vedi sotto
}
```

### Cosa si registra

- **Ogni** azione su dati sensibili, **letture comprese** (capitolo 00).
- Ogni azione di identità (capitoli 04 e 05).
- Ogni movimento di denaro: approvazione, storno, prelievo, provvigione (capitolo 08).
- Ogni cambio di permesso, ruolo, stato utente.
- Ogni decisione automatica del sistema, con dentro i parametri che l'hanno prodotta.

### Le cose da sapere

⚠️ **Il registro non si modifica e non si cancella. Nessun endpoint di scrittura, per nessuno.**
Un registro modificabile non è una prova, è un documento.

⚠️ **`action` come stringa `dominio.verbo`**, non un enum: le azioni nuove nascono in continuazione
e non devono costare una migrazione ogni volta.

⚠️ **L'indice `[action, createdAt]` non è un lusso.** «Di quando è l'ultima X» è una domanda che una
pagina fa a ogni apertura, e senza indice costa la scansione dell'**intero** registro proprio quando
la riga non c'è — cioè nello stato che quella domanda esiste per raccontare.

⚠️ **La ritenzione si decide adesso.** Questa tabella cresce più di tutte le altre messe insieme.
Decidi ora per quanto si tiene (12 mesi? 24?) e mettici un cron di archiviazione, o fra due anni è
la tabella più grande del database e nessuno se lo aspetta.

⚠️ **Scrivere nel registro non deve poter far fallire l'operazione.** Un errore del logger si
inghiotte e si segnala — ma l'approvazione del pagamento va a buon fine lo stesso.

---

## 7.5 · Lista lavori

**Chiave:** `dev_backlog` · **Rotta:** `/lavori` · **API:** `/admin/lavori`

L'elenco di cosa c'è da fare, **dentro il prodotto**, non in uno strumento a parte. Sembra un lusso;
è la pagina che fa risparmiare più tempo di tutte, perché è l'unico posto dove committente e chi
sviluppa guardano la stessa lista.

### Il modello

```prisma
model Lavoro {
  id        String   @id @default(uuid())
  chiave    String?  @unique      // per le voci caricate da file: evita i doppioni
  titolo    String                // 3–200 caratteri
  dettaglio String?
  categoria String   @default("Da fare")
  ordine    Int      @default(0)
  blocca    Boolean  @default(false)    // ⚠️ vedi sotto
  priorita  String   @default("neutra") // alta | neutra | bassa
  fatta     Boolean  @default(false)
  risposta  String?                     // la nota di chi consegna
  createdAt DateTime @default(now())
  chiusaIl  DateTime?
}
```

### Le tre distinzioni che fanno funzionare la pagina

1. **`blocca` non è «urgente».** È un **fatto** che chiunque può verificare: dietro questa voce c'è
   una fila ferma. `priorita` è un **giudizio**, e lo dà una persona sola. Tenerle separate è quello
   che permette di dire «lo so che ferma la coda, aspetta lo stesso». Con un campo solo, in un mese
   è tutto rosso e il colore smette di dire qualcosa.

2. **Il default della priorità è `neutra`, non `bassa`.** Una voce nuova non è meno importante delle
   altre: è una voce su cui **nessuno si è ancora pronunciato**. Metterla in fondo al posto di chi
   deve decidere è un giudizio inventato.

3. **Una priorità che non conosciamo è un errore, non una `neutra`.** Se arriva «media» o «Alta »
   con uno spazio, la voce messa in cima tornerebbe in mezzo al mucchio in silenzio — e chi l'aveva
   messa lo scoprirebbe non vedendola più.

### Le voci di partenza

Un file `voci-iniziali.ts` con la lista, letto da **due** posti: il seed e il pulsante «carica le
voci nuove» nella pagina.

⚠️ **Una lista sola, non una copia per ciascuno**, o fra un mese caricano due elenchi diversi.

⚠️ **Il caricamento spunta una voce se è già aperta, ma non riapre mai una voce spuntata a mano.**
Il file è l'unico posto da aggiornare quando una consegna chiude un lavoro, e una spunta tolta da un
umano è una decisione, non un disallineamento.

---

## 7.6 · Le tre pagine di contorno (quando servono)

| Pagina | Chiave | A cosa serve |
|---|---|---|
| **Parametri** | `engine_config` | le soglie del sistema, in tabella e mai nel codice |
| **Modelli email** | `email_templates` | i testi delle transazionali, modificabili senza rilascio |
| **Log email** | `email_log` | cosa è partito, a chi, e se è arrivato |

⚠️ **Nessuna soglia si scrive nel codice.** Un numero nel codice è un numero che per cambiare
richiede te. In tabella `config_param` (chiave, valore, tipo, descrizione, chi l'ha cambiato) è un
numero che il committente cambia da solo alle sei di sera.

⚠️ Il **log email** è la pagina che risponde a «non mi è arrivato niente» senza aprire il pannello
del fornitore. Vale le due ore che costa.

---

## Checklist di montaggio — capitolo 07

- [ ] Le cinque pagine esistono, ognuna con la sua chiave e la sua guardia
- [ ] Gli utenti si sospendono, non si distruggono
- [ ] I poteri gravi (password imposta, impersonificazione, cambio email altrui) hanno chiavi proprie
- [ ] Se c'è «entra come»: sola lettura lato server, scadenza, striscia, registro
- [ ] I ruoli personalizzati si creano dalla pagina, senza migrazioni
- [ ] La matrice permessi si salva a celle, e `syncDefaults` gira all'avvio **rumorosamente**
- [ ] Il registro attività non ha **nessun** endpoint di scrittura o cancellazione
- [ ] Gli indici del registro ci sono, ritenzione decisa, errori del logger inghiottiti
- [ ] La lista lavori distingue `blocca` da `priorita`, e il default è `neutra`
- [ ] Nessuna soglia è scritta nel codice: stanno tutte in `config_param`
