# 06 · La scheda Impostazioni / profilo utente

**Dove sta.** Nel **menu utente in alto a destra**, non nella barra laterale. La barra è per il
lavoro; le impostazioni sono per sé stessi. Metterle in mezzo alle pagine di lavoro le fa cercare a
tutti nel posto sbagliato per il primo mese.

**Com'è fatta.** Una pagina sola, a card impilate, ognuna con il suo salva. **Non** un modulo unico
con un pulsante in fondo: chi cambia il tema non deve salvare anche l'indirizzo, e un salvataggio
unico rende impossibile capire cosa è andato storto quando qualcosa va storto.

## Le card, nell'ordine in cui vanno

### 1 · I miei dati

Nome, cognome, qualifica, telefono, indirizzo, foto.
`GET /me/profile` · `PATCH /me/profile`

⚠️ **La foto va ridimensionata nel browser prima di partire**, non caricata com'è. Una foto da
telefono è 4 MB; ridotta a 128×128 in `data:` URL è qualche kilobyte e sta nella riga dell'utente
senza bisogno di uno storage di file. Il ridimensionamento si fa con un `<canvas>`, dieci righe.

### 2 · Le mie email

Tutta la card è il capitolo [05](05-email-utente.md). È la card più delicata della pagina.

### 3 · Cambia password

Password attuale + nuova + conferma. `PATCH /me/password`.

⚠️ **La password attuale si chiede sempre**, anche se l'utente è già dentro. La sessione dice che
qualcuno è entrato, non che è ancora lui davanti allo schermo.

⚠️ Al cambio si revocano **le altre** sessioni, non questa: l'utente non deve rifare il login su
quello che sta usando, ma un dispositivo dimenticato altrove deve cadere.

### 4 · Notifiche

Quali avvisi ricevere e su quale canale (email, push, in-app). Un interruttore per tipo.

⚠️ **Alcuni avvisi non si spengono** e vanno segnati come tali: la ricevuta di un pagamento, un
avviso di sicurezza, la scadenza di un contratto. Un interruttore che c'è ma non funziona è peggio
di un interruttore che non c'è: si vede grigio, con scritto perché.

### 5 · Tema

I campioni del capitolo [01](01-grafica.md). Si applica **subito**, senza salva: il tema è la cosa
che l'utente vuole provare, e un'anteprima che richiede un salvataggio non è un'anteprima.
`PATCH /me/account { theme }`.

### 6 · La mia home

Se la dashboard ha moduli spostabili: quali mostrare, in che ordine, e un «rimetti com'era».
`GET /me/preferences` · `PATCH /me/preferences`

⚠️ Se lasci riordinare anche il **menu**, rileggi la trappola nel capitolo [02](02-gabbia.md): la
barra deve ridisegnarsi all'istante, o l'interruttore sembra rotto.

### 7 · Il mio account (in fondo, e in grigio)

Esporta i miei dati · Cancella l'account.

⚠️ Vanno **in fondo e senza colore**. Un pulsante rosso «Cancella account» in cima a una pagina che
si apre per cambiare la foto è un incidente che aspetta.

⚠️ **Cancellazione = richiesta, non esecuzione.** Si crea una `DeletionRequest`, l'utente riceve
un'email con un annulla, e la cancellazione vera avviene dopo N giorni. In mezzo l'account è
sospeso, non distrutto. È anche quello che il GDPR si aspetta: diritto alla cancellazione, non
cancellazione istantanea e irreversibile al primo click.

## Il contratto API

| Metodo | Rotta | Cosa fa |
|---|---|---|
| `GET` | `/me` | l'utente corrente (per la sessione) |
| `GET` | `/me/profile` | anagrafica completa |
| `PATCH` | `/me/profile` | nome, telefono, indirizzo, foto |
| `PATCH` | `/me/account` | tema, lingua, preferenze account |
| `PATCH` | `/me/password` | cambio password (con l'attuale) |
| `PATCH` | `/me/password/initial` | primo cambio obbligato (`mustChangePassword`) |
| `GET` | `/me/preferences` | ordine del menu, moduli della home |
| `PATCH` | `/me/preferences` | li salva |
| `POST` | `/me/account/delete` | apre la richiesta di cancellazione |

⚠️ **`/me/*` non ha chiavi di permesso.** Sono i propri dati: la protezione è che l'utente è
autenticato, e l'`id` viene **dal token**, mai da un parametro. Il giorno che un endpoint `/me`
accetta un `userId` dal corpo della richiesta, hai scritto «leggi i dati di chiunque».

## Se lo staff ha una scheda pubblica

Nei progetti dove lo staff ha un profilo visibile ai clienti (foto, bio, specializzazioni), i campi
pubblici stanno su una tabella `Staff` separata, **non** su `User`. Motivo: cambiano per ragioni
diverse e li vede gente diversa, e tenerli insieme fa sì che un errore di permessi su uno esponga
anche l'altro.

## Checklist di montaggio — capitolo 06

- [ ] La pagina sta nel menu utente, non nella barra laterale
- [ ] Ogni card ha il suo salva, indipendente dalle altre
- [ ] La foto è ridimensionata nel browser prima dell'invio
- [ ] Il cambio password chiede l'attuale e revoca le **altre** sessioni
- [ ] Gli avvisi non disattivabili sono grigi e spiegati, non assenti
- [ ] Il tema si applica subito, senza salva
- [ ] La cancellazione account è in fondo, grigia, ed è una **richiesta** con annulla
- [ ] Nessun endpoint `/me/*` accetta un id utente dal client
