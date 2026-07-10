# Metabole — Coach AI (widget) & Sondaggio iniziale per settori

> Documento di design. Il Coach AI è il "personaggio" del prodotto: ti verifica ogni giorno,
> ti spinge, ti rassicura. È alimentato dai 5 segnali del motore (Corpo, Testa, Vita, Agenda, Gusto),
> che vengono inizializzati proprio dal sondaggio iniziale.

---

## Parte 1 — Il Coach AI (widget)

### 1.1 Cosa fa

Il Coach AI è un assistente personificato che accompagna il cliente ogni giorno. Non è una diet-app
statica: **ti verifica**, cioè legge i tuoi segnali e reagisce come farebbe un coach umano che ti tiene d'occhio.

Fa quattro cose:

1. **Verifica** — ogni giorno controlla come stai andando (check-in fatto? pasti seguiti? misure in trend? evento in arrivo?).
2. **Reagisce** — cambia stato/umore in base a ciò che vede (come il gufo di Duolingo che è fiero o preoccupato).
3. **Spinge** — ti dà un messaggio breve e una singola azione concreta per la giornata.
4. **Protegge il percorso** — anticipa gli sgarri (eventi) e ti aiuta a rientrare senza colpa dopo uno scivolone.

Il widget vive in due posti:
- **Widget di sistema / notifica giornaliera** (schermata home del telefono): stato + messaggio + azione.
- **Card in cima alla Home dell'app**: la stessa mascotte, cliccabile.

**Un'unica fonte di verità.** Il widget di sistema e il coach in-app sono **collegati**: mostrano lo stesso stato, la stessa frase del giorno e le stesse metriche, calcolati una sola volta dal motore. Se cambia lo stato (es. da "In rotta" a "Ti cerca"), cambiano insieme. La **frase del giorno** vive dentro la card del coach (dove compare "Non è una dieta, è il tuo nuovo stile").

### 1.2 I 5 segnali che lo alimentano

| Segnale | Cosa misura | Fonte dati |
|---|---|---|
| **Corpo** | Peso e misure (vita/fianchi/coscia), trend, plateau | Rilevazioni ogni 2 giorni |
| **Testa** | Umore ed energia | Check-in giornaliero (scala 😍😄😐😣🤯) |
| **Vita** | Contesto: lavoro, orari, sonno, carico | Sondaggio + check-in occasionali |
| **Agenda** | Eventi no-diet pianificati (cene, matrimoni, sgarro mensile) | Calendario del cliente |
| **Gusto** | Gradimento delle ricette (memoria dei piatti) | Valutazione ricette |

Il motore combina i segnali → decide il menu (standard / proteico / altro) **e** lo stato del Coach.

### 1.3 Gli stati del Coach (stile Duolingo)

Ogni stato = un'espressione del personaggio + un messaggio + **una** azione. Otto stati principali:

| # | Stato | Quando si attiva | Cosa "dice" (esempio) | Azione proposta | Segnale guida |
|---|---|---|---|---|---|
| 1 | **Pronto** | Inizio giornata, nessuna condizione speciale | "Nuovo giorno. Ho preparato la tua giornata." | Vedi il menu di oggi | — |
| 2 | **Fiero** | Check-in fatto + trend Corpo in discesa | "Stai andando forte. Il percorso funziona." | Continua così / registra misure | Corpo |
| 3 | **Carico** | Streak in crescita (più giorni in rotta) | "3 giorni di fila. Non fermarti ora." | Mantieni la streak | Corpo + Testa |
| 4 | **Attento** | Plateau: misure ferme da N rilevazioni | "Le misure si sono fermate: cambiamo passo." | Attiva menu proteico | Corpo |
| 5 | **Ti cerca** | Nessun dato da X giorni (check-in/misure) | "Non ti sento da 2 giorni, tutto ok?" | Fai il check-in ora | Testa + Corpo |
| 6 | **Traguardo** | Raggiunto un obiettivo (kg, cm o milestone streak) | "Traguardo! Hai raggiunto il tuo primo obiettivo." | Vedi i tuoi traguardi | Corpo |
| 7 | **Giorno libero** | Evento no-diet pianificato oggi | "Oggi è il tuo giorno. Goditelo, ci penso io a domani." | Vedi come gestirlo | Agenda |
| 8 | **Recupero** | Giorno dopo uno sgarro/salto | "Ieri è passato. Rientriamo con dolcezza." | Segui il menu di rientro | Agenda + Corpo |

Stati "di servizio" legati alla streak:
- **Streak a rischio** — sera, check-in non ancora fatto: "Ti manca solo il check-in per tenere la striscia."
- **Streak persa** — confluisce nello stato *Recupero*, senza colpevolizzare.

#### Catalogo completo stati del widget (18)

La mascotte va da **felice ad arrabbiata**; ogni famiglia ha un colore e animazioni proprie.

**Momenti & eventi** (mascotte accompagna la giornata)
- Buongiorno — "Buongiorno, Antonio!" (sole, rimbalza)
- Buonanotte — "Buonanotte, Antonio" (luna, occhi assonnati, "z z z")
- Evento gestito — quando c'è un evento in corso: "Evento gestito! Oggi divertiti" (calendario-cuore, rassicura)

**Percorso ok** (verde/teal · mascotte felice, rimbalza, coriandoli/scintille)
- In rotta — "5 giorni in rotta, Antonio!"
- Peso perso — "Hai perso 2,4 kg!" (cuori)
- Quasi all'obiettivo — "Ti mancano 3 giorni al tuo obiettivo"
- Misure in calo — "Le misure scendono, ottimo!"
- Traguardo — "Traguardo raggiunto!" (coriandoli)

**Umore / check-in** (scala 5 colori verde→rosso · mascotte specchia l'umore)
- Benissimo (verde) — occhi felici, cuori
- Bene (teal)
- Così così (giallo) — neutra
- Giù (arancio) — sopracciglia tristi
- Sopraffatto (rosso) — occhi che girano, vapore, tremore

**Allerta** (ambra/azzurro · mascotte preoccupata, oggetto che compare + pulsa)
- Misure — "Non hai messo le misure" (righello)
- Acqua — "Stai bevendo poco" (goccia)
- Passi — "Pochi passi oggi, muoviti" (camminata, goccia di sudore)

**Avviso / scadenze** (blu · mascotte informativa, badge)
- Piano in scadenza — "Il piano scade tra 5 giorni" (calendario)
- Visita domani — "Domani la visita col nutrizionista" (stetoscopio)

**Super allerta** (rosso · mascotte triste→arrabbiata, tremore, vapore, lampeggio rosso)
- App chiusa da giorni — "3 giorni che non ci vediamo…" (lacrima)
- Misure ferme da giorni — "5 giorni senza misure!" (arrabbiata)
- Visita saltata — "Hai saltato la visita col coach!" (arrabbiata)

Ogni stato è anche un trigger: le soglie (giorni, passi, scadenze) stanno in `config_param`.

#### Andamento nella giornata

La mascotte non è statica: apre e chiude la giornata e cambia in mezzo in base a ora e dati.

- **Mattino / primo avvio** → *Buongiorno*.
- **Durante il giorno** → stati guidati da dati e ora: promemoria (misure non messe, acqua scarsa, pochi passi a metà giornata), oppure percorso ok (in rotta, misure in calo) se i dati sono positivi.
- **Sera** → se manca il check-in, *streak a rischio*; a fine giornata *Buonanotte*.
- **Override sempre prioritari** (vincono su tutto, ordine di §1.6): evento in corso (*Evento gestito*), super allerte, traguardo.

Buongiorno e Buonanotte fanno da cornice; in mezzo comanda la precedenza già definita.

### 1.4 Streak e "verifica" giornaliera

- **Streak** = giorni consecutivi "in rotta" (check-in fatto **e** aderenza minima al piano). È l'aggancio motivazionale principale, come Duolingo.
- La **verifica** gira una volta al giorno (job schedulato). Legge i 5 segnali, calcola lo stato, prepara messaggio + azione e programma la notifica.
- Se mancano dati (segnale *Ti cerca*), l'assenza stessa diventa un evento: prima il Coach insiste con gentilezza, poi — se il silenzio continua — **segnala al coach umano** (vedi §1.7).

### 1.5 Notifiche

- **1 notifica al giorno** all'orario preferito del cliente (default mattina): stato + spinta + azione.
- **Trigger extra** (non ogni giorno): traguardo raggiunto, evento in arrivo domani, plateau rilevato.
- **Onboarding widget** — se il cliente non ha installato il widget sulla home del telefono, l'app mostra un invito all'installazione e invia una notifica di promemoria **ogni 7 giorni** finché non risulta installato; poi il promemoria si spegne.
- Regola anti-spam: massimo 1–2 notifiche al giorno; il cliente può scegliere orario e frequenza.
- Tutte le soglie (giorni di silenzio, giorni di plateau, orari) stanno in `config_param`, **mai hardcodate**.

### 1.6 Precedenza tra stati (quando più condizioni sono vere)

Ordine di priorità dall'alto:

1. **Giorno libero** (evento oggi) →
2. **Recupero** (sgarro ieri) →
3. **Traguardo** (milestone raggiunta) →
4. **Ti cerca** (dati mancanti) →
5. **Attento** (plateau) →
6. **Fiero / Carico** (tutto bene) →
7. **Pronto** (default).

Così l'evento del giorno e il rientro vincono sempre sui messaggi generici.

### 1.7 Escalation al coach umano

Il Coach AI **filtra e prepara**, ma non sostituisce le persone. Genera un alert nella dashboard del coach umano quando:
- silenzio oltre soglia (es. 3 giorni senza dati),
- plateau prolungato nonostante il menu proteico,
- segnali *Testa* molto bassi ripetuti (umore/energia).

Il nutrizionista resta l'unico a validare i protocolli e a vedere i dati sanitari.

### 1.8 Cosa il Coach AI NON fa (guardrail)

- Non dà diagnosi né consigli medici (posizionamento benessere, non dispositivo medico).
- Non commenta il corpo in modo giudicante; niente rinforzo di autocritica o sgarro come "colpa".
- Non prende decisioni cliniche: propone menu tra quelli **già validati** dal nutrizionista.
- Non mostra al coach dati sanitari/clinici (solo al cliente e al suo nutrizionista).

---

## Parte 2 — Sondaggio iniziale diviso per settori

Il sondaggio non è solo onboarding: **inizializza i 5 segnali** del motore. Per questo va organizzato
negli stessi 5 settori del Coach, così ogni risposta ha una destinazione chiara nel motore.

Struttura proposta: 5 sezioni, ognuna introdotta dal "suo" segnale, con una barra di avanzamento
(Corpo → Testa → Vita → Agenda → Gusto).

**La mascotte guida il sondaggio.** Come Duolingo nell'onboarding, la mascotte accompagna il cliente
in ogni sezione: la introduce, spiega perché serve, incoraggia e reagisce alle risposte. Riduce
l'abbandono e rende il test più leggero. Esempi di battute:
- Avvio: "Ciao! Ti faccio qualche domanda per costruire il tuo percorso."
- Corpo: "Niente giudizi: questi dati mi servono solo per partire."
- Gusto: "Qui divertiti: dimmi cosa ami e cosa eviti."
- Fine: "Perfetto, ho tutto. Ora ti preparo il piano!"

### 2.1 CORPO — dati e obiettivo

- Peso attuale e altezza.
- Obiettivo (peso desiderato o solo "sentirmi meglio").
- Misure di partenza: vita, fianchi, coscia.
- Storia del peso (oscillazioni, peso minimo/massimo da adulto).
- Regime alimentare: onnivoro / vegetariano / vegano.
- Intolleranze e allergie.
- Patologie o farmaci rilevanti *(dato sanitario → visibile solo al nutrizionista)*.

→ inizializza il trend Corpo e i vincoli del menu.

### 2.2 TESTA — motivazione e rapporto col cibo

- Perché adesso? (motivazione principale).
- Stato d'animo tipico delle ultime settimane.
- Rapporto con il cibo: mangi per fame o anche per stress/noia/emozioni?
- Esperienze con diete passate: cosa ha funzionato, cosa ti ha fatto mollare.
- Quanto ti senti fiducioso di riuscirci (1–5).

→ inizializza il segnale Testa e il tono dei messaggi del Coach.

### 2.3 VITA — contesto quotidiano

- Lavoro e orari (sedentario/in piedi, turni, trasferte).
- Livello di attività fisica attuale.
- Sonno (ore e qualità).
- Chi cucina in casa? Cucini anche per altri?
- Tempo e budget realistici per cucinare.

→ inizializza il segnale Vita e la fattibilità del piano.

### 2.4 AGENDA — eventi e ritmi

- Pasti fuori casa ricorrenti (pranzi di lavoro, cene fuori).
- Giorni "tipici" di sgarro (es. weekend).
- Eventi speciali già in vista (matrimoni, feste, viaggi).
- Vuoi un giorno libero pianificato al mese?
- Disponibilità settimanale a seguire il piano (tutti i giorni / 5 su 7…).

→ inizializza il segnale Agenda e la gestione dei giorni no-diet.

### 2.5 GUSTO — preferenze

- Cibi che ami / che non mangeresti mai.
- Cucine preferite (mediterranea, orientale…).
- Numero di pasti al giorno (fino a 5).
- Colazione dolce o salata.
- Abitudini: caffè, alcol, spuntini.

→ inizializza il segnale Gusto e la memoria dei piatti (gradimento).

### 2.6 Come il sondaggio accende il motore

1. Le risposte popolano il **profilo iniziale** e i valori di partenza dei 5 segnali.
2. Il motore genera il **primo piano** (regime + n. pasti + preferenze + vincoli sanitari).
3. Dalla prima rilevazione misure in poi, i segnali si aggiornano e il Coach passa dallo stato *Pronto*
   agli stati dinamici (Fiero, Attento, ecc.).
4. Le soglie che regolano tutto questo restano in `config_param`.

---

## Appendice — Valori soglia (`config_param`)

Valori decisi con il socio. Tutti modificabili da dashboard, mai hardcodati.

| Parametro | Valore | Significato |
|---|---|---|
| `coach_silence_days_seek` | **1** | Giorni senza dati (check-in/misure) prima dello stato *Ti cerca* |
| `coach_silence_days_escalate` | **3** | Giorni di silenzio totale prima dell'alert al coach umano |
| `plateau_flat_measurements` | **2** | Rilevazioni ferme (~4 giorni) prima di attivare il menu proteico |
| `notif_daily_time` | `08:00` | Orario notifica giornaliera (default mattina, personalizzabile) *(da confermare)* |
| `notif_max_per_day` | `2` | Numero massimo di notifiche al giorno *(da confermare)* |
| `streak_min_adherence` | `70%` | Aderenza minima al piano perché un giorno conti per la streak *(da confermare)* |
| `widget_install_reminder_days` | **7** | Ogni quanti giorni ricordare al cliente di installare il widget (finché non installato) |

I tre valori in grassetto sono confermati; gli altri sono default proposti da validare.

---

## Parte 3 — Prossimi passi

1. Validare stati e messaggi del Coach con il socio/nutrizionista (tono e claim).
2. Definire i valori di soglia iniziali (giorni di silenzio, plateau, orari notifica) → `config_param`.
3. Riscrivere le pagine del sondaggio nel prototipo raggruppandole nei 5 settori con barra di avanzamento.
4. Prototipare visivamente i 4–5 stati chiave del Coach nel widget/Home.
5. Collegare le regole di stato al motore backend (dominio "motore/segnali").

> Nota separata (Fase 0): predisporre il **contratto semplice su una pagina** da inviare al cliente via email
> + testo GDPR per l'accettazione in app. Da fare a parte rispetto a questo documento.
