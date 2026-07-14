# Metabole — Email per stato utente (ciclo di vita)

Piano completo delle email transazionali e di marketing, **mappate agli stati CRM e agli stati dell'agente**.
Obiettivo da agente di marketing: **far acquistare chi non acquista**, **tenere ingaggiato chi è attivo**, **far rinnovare chi è in scadenza**, **recuperare chi è uscito** — sempre nel tono del brand (caldo, "non una dieta", supporto di coach + nutrizionista, nessuna promessa medica, nessun numero/kcal, 18+).

**Voce:** rassicurante, umana, mai colpevolizzante. Gaia (assistente) firma le email di servizio; coach/nutrizionista firmano quelle relazionali.
**Variabili (merge tag Brevo):** `{{nome}}`, `{{piano}}`, `{{obiettivo}}`, `{{nutrizionista}}`, `{{coach}}`, `{{data_inizio}}`, `{{scadenza}}`, `{{link_app}}`, `{{link_lista_spesa}}`, `{{link_paga}}`, `{{link_rinnova}}`.
**Compliance:** consenso registrato (base giuridica + timestamp), unsubscribe sempre, SPF/DKIM/DMARC, passaggio dal **Giudice** prima dell'invio, nessun claim terapeutico, tono 18+.

---

## Mappa stati → email (colpo d'occhio)

| Stato utente / CRM | Email | Scopo |
|---|---|---|
| Registrato (lead, no acquisto) | **Benvenuto** | orientare, creare fiducia |
| Ha completato il questionario | **Il tuo profilo è pronto** (riepilogo + piano/coach/nutrizionista consigliati) | mostrare personalizzazione → spingere alla scelta |
| Ha scelto il piano, non ha pagato | **Checkout abbandonato** (1–3 solleciti) | recupero acquisto |
| Ha pagato, percorso non iniziato | **Il tuo piano inizia domani + lista della spesa** | attivazione, ridurre attrito |
| Cliente attivo (giorni 1–14) | **Onboarding uso app** + primo check-in | far partire l'abitudine |
| Cliente attivo | **Milestone / risultati**, **feedback ricette**, **contenuti valore** | retention, gradimento |
| Attivo ma uso in calo (dropout_risk) | **Ti aiutiamo a ripartire** | riattivazione |
| Stato agente Conforto / giornata storta | **Va bene così** (supporto motivazionale) | evitare abbandono |
| In scadenza (T-7 / T-3 / T-1) | **Rinnovo** (con risultati ottenuti) | rinnovo |
| Scaduto (T+1 / T+3 / T+7) | **Win-back breve** | recupero rinnovo |
| Churn (ex cliente) | **Ci manchi + novità** | riattivazione |
| Qualsiasi cliente soddisfatto | **Porta un'amica** (referral) | acquisizione |
| Lead freddo (nurture 80k) | sequenza educativa | vedi `Metabole_Strategia_Rientro_Nurture.md` |

> Le campagne massive **win-back 20.000 clienti** e **nurture 80.000 lead** restano in `Metabole_Strategia_Rientro_Nurture.md`. Questo documento è il **ciclo di vita triggered** (email che partono da eventi/stati del singolo utente).

---

# PARTE 1 — Le 3 email richieste (copy pronta)

## 1) Benvenuto — trigger: registrazione (pre-acquisto)
**Oggetto:** Benvenuta in Metabole, {{nome}} 🌱
**Preview:** Non è una dieta. È un percorso pensato su di te.
**Corpo:**
> Ciao {{nome}},
> benvenuta in Metabole. Qui non troverai l'ennesima dieta uguale per tutti: costruiamo un **percorso su misura per te**, seguito da una **coach** e da un **nutrizionista** veri, con l'aiuto della nostra assistente Gaia.
>
> Ecco come funziona, in breve:
> 1. Rispondi a qualche domanda sul tuo obiettivo e i tuoi gusti.
> 2. Ti proponiamo il **percorso alimentare** più adatto, con coach e nutrizionista dedicati.
> 3. Ogni giorno hai il tuo menu; tu ci dici com'è andata e il percorso **si adatta a te**.
>
> Nessuna fame, nessun conteggio ossessivo: solo cibo buono, pensato per te.
>
> [**Completa il tuo profilo →**]({{link_app}})
>
> A presto,
> il team Metabole
**CTA:** Completa il tuo profilo. **Follow-up** se non completa entro 48h (vedi §"Profilo incompleto").

## 2) Il tuo profilo è pronto — trigger: questionario completato
**Oggetto:** {{nome}}, ecco il percorso pensato per te
**Preview:** Le tue risposte, il piano consigliato, il tuo team.
**Corpo:**
> Ciao {{nome}},
> abbiamo letto le tue risposte. Ecco cosa abbiamo capito di te e cosa ti proponiamo.
>
> **Il tuo obiettivo:** {{obiettivo}}
> **Le tue preferenze:** {{riepilogo_gusti}} · **da evitare:** {{riepilogo_esclusioni}}
>
> **Percorso consigliato: {{piano}}**
> Perché: {{motivo_piano}} — scelto tra i nostri percorsi in base a ciò che ci hai detto.
>
> **Il tuo team dedicato**
> 🥗 Nutrizionista: **{{nutrizionista}}** — costruisce e valida il tuo menu.
> 💬 Coach: **{{coach}}** — ti segue giorno per giorno e ti motiva.
>
> È tutto pronto: manca solo il tuo "sì" per iniziare.
>
> [**Attiva il tuo percorso →**]({{link_paga}})
>
> Hai dubbi? Rispondi a questa email: ti risponde una persona vera.
**CTA:** Attiva il percorso. Se non acquista → sequenza "Checkout abbandonato".

## 3) Il tuo piano inizia domani + lista della spesa — trigger: pagamento ok, giorno prima dell'avvio
**Oggetto:** {{nome}}, si parte domani! Ecco la tua lista della spesa 🛒
**Preview:** Tutto pronto per il tuo primo giorno.
**Corpo:**
> Ciao {{nome}},
> ci siamo: **domani {{data_inizio}} inizia il tuo percorso {{piano}}**. Per arrivare pronta, ecco la **lista della spesa** dei tuoi primi giorni.
>
> [**Apri la lista della spesa →**]({{link_lista_spesa}})
> (puoi spuntarla mentre fai la spesa; è già pensata sui tuoi menu)
>
> **Come funziona da domani:**
> • Ogni mattina trovi il menu del giorno nell'app.
> • Ogni 2 giorni ti chiediamo le tue **misure** (è il segnale che fa adattare il percorso a te).
> • {{coach}} è a un messaggio di distanza, e Gaia ti guida passo passo.
>
> Un consiglio: prepara stasera ciò che ti serve per la colazione. Iniziare bene la mattina fa la differenza.
>
> [**Apri l'app →**]({{link_app}})
>
> In bocca al lupo — siamo con te.
> {{coach}} e il team Metabole
**CTA:** Apri la lista della spesa / Apri l'app.

---

# PARTE 2 — Tutto il resto (proposta da agente di marketing)

## A. Conversione — chi NON acquista

### A1. Profilo incompleto (questionario iniziato, non finito)
**Trigger:** 48h dopo registrazione senza questionario completo.
**Oggetto:** Ti manca solo un minuto, {{nome}}
**Idea:** riduci l'attrito ("bastano 2 minuti"), ribadisci il valore (percorso su misura + team umano). CTA: Completa il profilo.

### A2. Checkout abbandonato (piano scelto, non pagato) — sequenza 3 email
- **A2.1 (dopo 1h):** "Il tuo percorso {{piano}} ti aspetta" — riprendi da dove hai lasciato, CTA diretta al pagamento.
- **A2.2 (dopo 24h):** gestione obiezioni — *"Ci hai già provato e non ha funzionato?"* Spiega perché qui è diverso (si adatta a te, team umano, niente fame). Prova sociale (1 testimonianza).
- **A2.3 (dopo 72h):** **incentivo a tempo** (es. prima settimana di coaching inclusa / consulenza iniziale) con **scadenza 48h**. CTA: Attiva ora.
**Nota:** stop sequenza appena paga.

### A3. Lead che ha il profilo ma non sceglie il piano — nurture educativo (3–4 email, cadenza 2–4 gg)
- **A3.1 "Perché non è una dieta"** — il metodo (menu che si adatta a te, non tu alla dieta).
- **A3.2 "Il tuo team"** — chi sono coach e nutrizionista, cosa fanno per te (fiducia).
- **A3.3 "Storie come la tua"** — testimonianza per persona-target (Maria/menopausa/post-gravidanza/rientro).
- **A3.4 "Pronta quando lo sei tu"** — riepilogo profilo + offerta gentile + CTA. Se non converte → nurture lungo (80k).

### A4. Obiezione prezzo / esitazione
**Trigger:** ha aperto A2/A3 più volte senza convertire.
**Idea:** valore vs costo (un caffè al giorno), garanzia/soddisfazione, opzione piano più leggero o rateale se esiste. CTA: Parla con noi (umano).

## B. Attivazione & retention — cliente ATTIVO

### B1. Onboarding uso app (serie giorni 1–7)
- **G1:** "Il tuo primo giorno" — come leggere il menu, dove sono coach/Gaia.
- **G2:** "Il primo check-in" — perché le misure ogni 2 giorni contano (senza ansia da bilancia).
- **G4:** "Sostituzioni e gusti" — come dire cosa non ti piace → il menu cambia.
- **G7:** "La tua prima settimana" — incoraggiamento + primo micro-risultato.

### B2. Milestone / risultati
**Trigger:** primo calo registrato, streak di check-in, traguardo obiettivo.
**Oggetto:** "{{nome}}, stai andando alla grande 🎉"
**Idea:** celebra il progresso (in modo sano, senza numeri ossessivi), rinforza l'abitudine, invita a condividere → aggancio referral.

### B3. Feedback ricette (gradimento)
**Trigger:** dopo N cicli o su ricette non ancora valutate.
**Idea:** "Com'era il tuo menu?" → migliora la personalizzazione (e alimenta il learning). CTA: Valuta nell'app.

### B4. Contenuti di valore (educational, ricorrente)
**Trigger:** settimanale/bisettimanale.
**Idea:** ricetta della settimana, consiglio pratico, mito sfatato. Costruisce abitudine di apertura e lega al blog (agente Redattore). Nessuna promessa medica.

### B5. Riattivazione uso in calo (dropout_risk)
**Trigger:** alert `dropout_risk` (poche aperture/check-in).
**Oggetto:** "Ci sei, {{nome}}? Ripartiamo insieme"
**Idea:** tono empatico, nessuna colpa; la coach si fa viva; "un passo alla volta". CTA: Riapri l'app / scrivi alla coach.

### B6. Supporto stato "Conforto / giornata storta"
**Trigger:** stato agente Conforto o umore basso ai check-in.
**Idea:** email calda, niente performance ("una giornata storta non cancella i tuoi progressi"). Rinforza il rientro morbido. Firma coach.

### B7. Referral "Porta un'amica"
**Trigger:** cliente soddisfatto (dopo milestone o buon gradimento).
**Idea:** invito con vantaggio per entrambe. CTA: Invita un'amica. (Aggancia il referral già presente nel commerce.)

## C. Rinnovo — chi è in SCADENZA

### C1. Pre-scadenza (T-7)
**Oggetto:** "{{nome}}, quanta strada hai fatto"
**Idea:** mostra i **risultati del percorso** (progresso, costanza), poi il rinnovo come continuazione naturale. CTA: Rinnova.

### C2. Pre-scadenza (T-3) — valore + continuità
**Idea:** "non fermarti ora": i risultati si consolidano continuando; anticipa cosa succede se si interrompe. CTA: Rinnova (magari upgrade/piano annuale con vantaggio).

### C3. Scadenza (T-1 / giorno stesso)
**Oggetto:** "Il tuo percorso scade domani"
**Idea:** urgenza gentile, un clic per continuare senza perdere lo storico/personalizzazione. CTA: Rinnova ora.

### C4. Upsell / cambio piano
**Trigger:** cliente con buoni risultati o esigenza diversa (es. da mediterranea a keto, o piano annuale).
**Idea:** proponi l'upgrade/cambio come passo avanti. CTA: Scopri il piano.

## D. Win-back — chi è SCADUTO / uscito

### D1. Grace period (T+3)
**Oggetto:** "Riprendi da dove avevi lasciato"
**Idea:** il percorso e lo storico sono ancora lì; basta un clic. Eventuale incentivo leggero. CTA: Riattiva.

### D2. Win-back (T+7 / T+14)
**Idea:** "Cosa è cambiato in Metabole" (novità, nuovi percorsi) + offerta rientro a tempo. CTA: Torna con noi.

### D3. Survey di uscita
**Trigger:** churn confermato.
**Idea:** "Aiutaci a capire" (motivo dell'uscita) — dato prezioso + porta di rientro. 1 domanda, non invasiva.

### D4. Riattivazione stagionale
**Trigger:** eventi (rientro vacanze, gennaio, pre-matrimonio) — aggancio Agente Contesto & Tempismo.
**Idea:** "È il momento giusto per ripartire" con il percorso adatto alla stagione/occasione.

## E. Transazionali & servizio (necessarie, non promozionali)
Verifica email · reset password · **ricevuta pagamento** · conferma cambio/rinnovo piano · **pagamento fallito (dunning)** con retry e link aggiorna metodo · promemoria **appuntamento** nutrizionista/coach (televisita) · avviso "misure in attesa" (se il ciclo resta aperto) · notifiche di sistema. Queste partono sempre (a prescindere dal consenso marketing) e vanno tenute pulite e brandizzate.

## F. Consensi & preferenze
Re-permission per i lead senza consenso valido (base per la campagna 80k) · **centro preferenze** (scegli quali email ricevere / frequenza) · conferma disiscrizione con opzione "ricevi solo l'essenziale". Riduce le disiscrizioni totali e protegge la deliverability.

---

# PARTE 3 — Copy completa: email ad alto impatto

## A2 — Checkout abbandonato (piano scelto, non pagato)

### A2.1 — dopo 1 ora
**Oggetto:** {{nome}}, il tuo percorso {{piano}} ti aspetta
**Preview:** Ci eravamo quasi. Riprendi da dove hai lasciato.
> Ciao {{nome}},
> hai scelto il percorso **{{piano}}** ma non hai completato l'attivazione. Nessun problema: è tutto salvato, riprendi in un clic.
> Ti aspettano il tuo menu su misura, la coach **{{coach}}** e il nutrizionista **{{nutrizionista}}**.
>
> [**Completa l'attivazione →**]({{link_paga}})
>
> Se qualcosa non è chiaro, rispondi a questa email: c'è una persona vera dall'altra parte.
**CTA:** Completa l'attivazione.

### A2.2 — dopo 24 ore (obiezioni + prova sociale)
**Oggetto:** "Ci ho già provato e non ha funzionato"
**Preview:** Ecco perché con Metabole è diverso.
> Ciao {{nome}},
> se hai esitato, probabilmente ci sei già passata: diete uguali per tutti, fame, e alla fine si molla.
> Con Metabole è diverso per un motivo semplice: **il percorso si adatta a te**, non tu alla dieta. Niente fame, niente conteggi ossessivi. E non sei sola: una **coach** ti segue ogni giorno, un **nutrizionista** valida ogni menu.
>
> *"{{testimonianza_breve}}"* — {{testimonianza_autrice}}
>
> [**Inizia il tuo percorso →**]({{link_paga}})
**CTA:** Inizia il percorso.

### A2.3 — dopo 72 ore (incentivo a tempo)
**Oggetto:** {{nome}}, un pensiero per iniziare 🎁
**Preview:** Un vantaggio per te — solo per 48 ore.
> Ciao {{nome}},
> vogliamo aiutarti a fare il primo passo: se attivi il tuo percorso **entro 48 ore**, {{incentivo}} (es. la prima settimana di coaching inclusa).
> È il momento giusto per iniziare a stare bene, con qualcuno al tuo fianco.
>
> [**Attiva ora e approfitta →**]({{link_paga}})
> L'offerta scade il {{scadenza_offerta}}.
**CTA:** Attiva ora. *(Stop sequenza appena paga.)*

## C — Rinnovo (in scadenza)

### C1 — T-7 (i risultati)
**Oggetto:** {{nome}}, guarda quanta strada hai fatto
**Preview:** Il tuo percorso continua — e i risultati si consolidano.
> Ciao {{nome}},
> in queste settimane hai costruito qualcosa di importante: **costanza, abitudini nuove e i primi risultati**. Il tuo percorso {{piano}} scade il **{{scadenza}}**.
> Continuare adesso è ciò che trasforma i risultati in qualcosa che resta. {{coach}} è pronta a proseguire con te.
>
> [**Rinnova il tuo percorso →**]({{link_rinnova}})
**CTA:** Rinnova.

### C2 — T-3 (continuità + valore)
**Oggetto:** Non fermarti proprio ora
**Preview:** I risultati si consolidano continuando.
> Ciao {{nome}},
> il tuo percorso scade tra pochi giorni ({{scadenza}}). Fermarsi ora significherebbe rinunciare allo slancio che hai costruito — e il bello arriva proprio con la continuità.
> Se vuoi, puoi anche **passare al piano più adatto a questa fase** ({{suggerimento_piano}}).
>
> [**Continua il percorso →**]({{link_rinnova}})
**CTA:** Rinnova / cambia piano.

### C3 — T-1 (urgenza gentile)
**Oggetto:** Il tuo percorso scade domani, {{nome}}
**Preview:** Un clic per continuare, senza perdere nulla.
> Ciao {{nome}},
> domani ({{scadenza}}) il tuo percorso {{piano}} si conclude. Rinnovando **ora** non perdi nulla: menu, storico, personalizzazione e il tuo team restano esattamente dove sono.
>
> [**Rinnova in un clic →**]({{link_rinnova}})
>
> Vuoi parlarne prima? Rispondi a questa email.
**CTA:** Rinnova ora.

---

# PARTE 4 — Email per EVENTO (milestone & morale)

Email che partono da un **evento** del percorso: risultato, ricorrenza, umore, stato dell'agente. Servono a **tenere alta la motivazione** e a ridurre l'abbandono. Tono: caldo, sano, mai ossessivo sui numeri. Firma della coach dove è relazionale.

### EV1 — Obiettivo di peso raggiunto 🎯
**Trigger:** peso/obiettivo target raggiunto.
**Oggetto:** {{nome}}, ce l'hai fatta 🎉
**Preview:** Hai raggiunto il tuo obiettivo. Ce lo godiamo insieme.
> Ciao {{nome}},
> oggi è un giorno speciale: **hai raggiunto il tuo obiettivo**. Non è stato un colpo di fortuna — è il risultato della tua costanza, un giorno dopo l'altro.
> Goditi questo traguardo. E se vuoi, parliamo di come **mantenere ciò che hai conquistato**: passare in modalità *mantenimento* è il modo migliore per non tornare indietro.
>
> [**Scopri il mantenimento →**]({{link_app}})
> Brava davvero. — {{coach}}
**CTA:** Passa al mantenimento (upsell naturale).

### EV2 — Primo risultato
**Trigger:** primo calo registrato.
**Oggetto:** Il primo passo è fatto, {{nome}} 🌱
> I primi risultati arrivano, e sono i più importanti perché ti dicono una cosa: **funziona, per te**. Continua così, un giorno alla volta.
**CTA:** Vedi il tuo percorso.

### EV3 — Traguardo intermedio (metà obiettivo)
**Trigger:** ~50% dell'obiettivo.
**Oggetto:** Sei a metà strada, {{nome}} 💪
> Metà del cammino è dietro di te. Il bello è che ora sai di poterlo fare. {{coach}} è con te per la seconda parte.
**CTA:** Continua.

### EV4 — Costanza / streak
**Trigger:** X check-in consecutivi / settimane di costanza.
**Oggetto:** {{nome}}, che costanza! 🔥
> La costanza è la tua arma migliore, e la stai usando benissimo. Piccolo grande traguardo: continua a prenderti cura di te.
**CTA:** Vedi i tuoi progressi.

### EV5 — Plateau (il peso non scende) — incoraggiamento
**Trigger:** stato agente Plateau / nessun calo per N cicli.
**Oggetto:** Il corpo sta lavorando, anche quando la bilancia è ferma
> Ciao {{nome}},
> a volte il peso si assesta per qualche giorno: è normale, il corpo si sta abituando. **Non è un passo indietro.** Il nutrizionista sta già ritoccando il tuo percorso per rimetterti in moto.
> Fidati del processo — e di noi. — {{coach}}
**CTA:** Scrivi alla coach.

### EV6 — Giornata storta / umore basso — su il morale
**Trigger:** stato agente Conforto / umore basso ai check-in.
**Oggetto:** Una giornata storta non cancella i tuoi progressi
> Ciao {{nome}},
> capita a tutti una giornata no. Non definisce il tuo percorso: domani si riparte, con calma. Per oggi, il menu è pensato per **coccolarti un po'** senza farti perdere la strada.
> Sono qui se hai bisogno. — {{coach}}
**CTA:** Apri l'app / scrivi alla coach.

### EV7 — Misure non inserite (ciclo aperto) — reminder gentile
**Trigger:** fine ciclo senza misure.
**Oggetto:** Un attimo per te, {{nome}}
> Per farti proseguire al meglio, ci servono le tue **misure** di questi due giorni: sono il segnale che fa adattare il percorso a te. Bastano pochi secondi.
**CTA:** Inserisci le misure.

### EV8 — Rientro dopo una pausa/vacanza
**Trigger:** evento `rientrato` (travel_mode chiuso) o riapertura dopo inattività.
**Oggetto:** Bentornata, {{nome}} — ripartiamo con dolcezza
> Ben tornata! Nessuna corsa e nessun senso di colpa: ripartiamo con qualche giorno leggero, poi torniamo al ritmo. Il tuo team ti riaccoglie da dove avevi lasciato.
**CTA:** Riprendi il percorso.

### EV9 — Compleanno
**Trigger:** data di nascita.
**Oggetto:** Buon compleanno, {{nome}}! 🎂
> Oggi è la tua giornata: goditela senza pensieri. Prenderti cura di te è il regalo più bello che puoi farti — e noi siamo felici di farlo con te.
**CTA:** (nessuna vendita) — auguri sinceri. *(Opzionale: piccolo pensiero/vantaggio.)*

### EV10 — Anniversario del percorso
**Trigger:** 1 mese / 3 mesi / 6 mesi dall'inizio.
**Oggetto:** {{nome}}, un mese insieme 🌿
> Un mese fa hai deciso di prenderti cura di te. Da allora ne è successa di strada. Grazie per la fiducia — il meglio deve ancora venire.
**CTA:** Vedi il tuo riepilogo.

### EV11 — Evento personale in agenda (pre-evento)
**Trigger:** evento marcato in agenda (matrimonio, vacanza, occasione) entro K giorni.
**Oggetto:** Arriviamo pronte a {{evento}}, {{nome}}
> Manca poco a {{evento}}! Nei prossimi giorni il tuo menu diventa un po' più leggero e proteico per farti arrivare al meglio, senza stress. Ci pensiamo noi.
**CTA:** Vedi il piano pre-evento.

### EV12 — Passaggio al mantenimento
**Trigger:** obiettivo raggiunto + scelta/mantenimento.
**Oggetto:** E ora, manteniamo ciò che hai conquistato
> Hai raggiunto il tuo obiettivo: bravissima. Da qui il percorso cambia obiettivo — **difendere il risultato** senza rinunce, con menu che ti mantengono in equilibrio.
**CTA:** Attiva il mantenimento.

> **Regole per le email evento:** frequenza controllata (non più di 1 email "emotiva" ravvicinata; le celebrazioni non si accavallano ai solleciti commerciali), niente numeri di peso espliciti nel testo (li mostra l'app), sempre nel rispetto del benessere della persona, mai colpevolizzare. Passaggio dal Giudice come le altre.

---

# PARTE 5 — Copy completa: conversione, retention, win-back

## Conversione

### PROFILO_INCOMPLETO — questionario iniziato, non finito (+48h)
**Oggetto:** Ti manca solo un minuto, {{nome}}
**Preview:** Il tuo percorso su misura è a un passo.
> Ciao {{nome}}, hai iniziato a raccontarci di te ma non hai finito. Bastano un paio di minuti per completare il profilo e ricevere il **percorso pensato su di te**, con coach e nutrizionista dedicati. Riprendi da dove hai lasciato.
**CTA:** Completa il profilo

### NURTURE_1 — Perché non è una dieta
**Oggetto:** Perché Metabole non è una dieta
**Preview:** La differenza che cambia tutto.
> Le diete falliscono perché chiedono a **te** di adattarti a loro. Noi facciamo il contrario: il menu si adatta a te — ai tuoi gusti, ai tuoi tempi, a come reagisce il tuo corpo — sotto la guida di un nutrizionista. Niente fame, niente conteggi. Solo cibo buono che funziona per te.
**CTA:** Scopri il tuo percorso

### NURTURE_2 — Il tuo team
**Oggetto:** Non sei sola: il tuo team Metabole
**Preview:** Una coach e un nutrizionista, veri.
> In Metabole non ti lasciamo con un'app e basta. Hai una **coach** che ti segue giorno per giorno e ti motiva, e un **nutrizionista** che costruisce e valida il tuo menu. Gaia, la nostra assistente, ti guida passo passo. Le persone fanno la differenza.
**CTA:** Inizia con il tuo team

### NURTURE_3 — Storie come la tua
**Oggetto:** Storie come la tua
**Preview:** Chi ha iniziato prima di te.
> {{testimonianza_breve}} — {{testimonianza_autrice}}
> Ognuna è partita da un momento diverso; tutte hanno trovato un modo sostenibile, senza rinunce. Il prossimo passo può essere il tuo.
**CTA:** Comincia oggi

### NURTURE_4 — Pronta quando lo sei tu
**Oggetto:** Ci siamo quando decidi tu, {{nome}}
**Preview:** Il tuo profilo è già pronto.
> Nessuna fretta e nessuna pressione. Quando ti va, il tuo percorso {{piano}} è pronto a partire, con coach e nutrizionista. Se hai una domanda, rispondi a questa email: ti risponde una persona vera.
**CTA:** Attiva quando vuoi

## Retention (cliente attivo)

### ONB_G1 — Il tuo primo giorno
**Oggetto:** Benvenuta nel tuo primo giorno, {{nome}}!
**Preview:** Ecco come muoverti nell'app.
> Oggi si comincia! Nell'app trovi il **menu del giorno** in Home; in Contatti ci sono la tua coach {{coach}} e Gaia, sempre a un messaggio di distanza. Un consiglio: parti dalla colazione e prenditela con calma.
**CTA:** Apri l'app

### ONB_G2 — Il primo check-in
**Oggetto:** Il tuo primo check-in
**Preview:** Bastano pochi secondi, ed è importante.
> Ogni 2 giorni ti chiediamo le tue misure: è il **segnale** che permette al percorso di adattarsi a te. Niente ansia da bilancia — è solo il modo in cui capiamo cosa funziona meglio per il tuo corpo.
**CTA:** Fai il check-in

### ONB_G4 — Sostituzioni e gusti
**Oggetto:** Un piatto non ti va? Cambialo
**Preview:** Il menu si modella sui tuoi gusti.
> Se un piatto non ti piace o non lo mangi, dillo nell'app: il percorso ti propone un'**alternativa**. Più ci dici cosa ami e cosa eviti, più il tuo menu diventa davvero tuo.
**CTA:** Aggiorna i tuoi gusti

### ONB_G7 — La tua prima settimana
**Oggetto:** Una settimana insieme, {{nome}} 🌿
**Preview:** Hai già fatto la parte più difficile: iniziare.
> Sette giorni fa hai deciso di prenderti cura di te, e sei ancora qui. È così che nascono i risultati che durano: **un passo alla volta**. {{coach}} è fiera di te — continua così.
**CTA:** Vedi i tuoi progressi

### FEEDBACK_RICETTE — com'era il menu
**Oggetto:** Com'era il tuo menu, {{nome}}?
**Preview:** Il tuo parere rende il percorso più tuo.
> Un piatto ti è piaciuto tantissimo? O proprio no? Dillo con un tocco nell'app: più valuti, più il percorso **impara** cosa proporti. Bastano pochi secondi.
**CTA:** Valuta i piatti

### RIATTIVA_DROPOUT — uso in calo
**Oggetto:** Ci sei, {{nome}}? Ripartiamo insieme
**Preview:** Un passo alla volta, senza fretta.
> Ti abbiamo persa di vista in questi giorni — capita, la vita è piena di cose. Nessun giudizio: il tuo percorso è ancora qui, pronto a riprenderti da dove eri. {{coach}} è a un messaggio di distanza se vuoi ripartire con calma.
**CTA:** Riapri l'app

### REFERRAL — porta un'amica
**Oggetto:** Conosci qualcuna che merita di stare bene?
**Preview:** Un percorso su misura, anche per lei.
> Se Metabole ti sta aiutando, forse può aiutare anche una persona a cui vuoi bene. Invitala: {{vantaggio}} per entrambe. Il benessere è più bello condiviso.
**CTA:** Invita un'amica

## Win-back (scaduti)

### WB_T3 — grace period
**Oggetto:** Riprendi da dove avevi lasciato, {{nome}}
**Preview:** Il tuo percorso e i tuoi progressi sono ancora qui.
> Il tuo percorso si è concluso qualche giorno fa, ma non abbiamo cancellato nulla: **menu, storico e personalizzazione** ti aspettano. Bastano un paio di clic per ricominciare, con la tua coach.
**CTA:** Riattiva il percorso

### WB_T7 — novità + offerta
**Oggetto:** È cambiato qualcosa in Metabole
**Preview:** Nuovi percorsi, la stessa cura per te.
> Da quando ci siamo lasciati abbiamo aggiunto novità pensate proprio per rendere il percorso più semplice e su misura. Se vuoi riprovare, ti accogliamo con {{offerta}}. Ci farebbe piacere riaverti.
**CTA:** Torna con noi

---

## Priorità di attivazione (da agente di marketing)
1. **Le 3 richieste** (benvenuto, profilo pronto, piano inizia domani) — sono il cuore dell'attivazione.
2. **Checkout abbandonato (A2)** e **Pre-scadenza/rinnovo (C1–C3)** — massimo ritorno immediato (recupero acquisti + rinnovi).
3. **Riattivazione dropout (B5)** e **Win-back (D1–D2)** — trattengono e recuperano.
4. **Nurture (A3)**, **milestone/referral (B2/B7)**, **transazionali/dunning (E)** — consolidano.

## Come si automatizza (per lo Sviluppo/Marketing)
- Ogni email è un **template Brevo** con i merge tag sopra, agganciato a un **trigger** (evento CRM/agente) — non invii manuali.
- Gli **stati** che fanno da trigger esistono già in gran parte: pipeline CRM (nuovo→…→a rischio→churn→rientro), stati agente (Conforto/Plateau/dropout_risk), eventi commerce (pagato, scaduto), eventi agenda (appuntamenti).
- Ogni bozza passa dal **Giudice** (compliance: no claim medici, consensi, 18+) prima dell'invio; l'**agente Redattore** può generare le varianti di copy e i contenuti di valore (B4) con il responsabile marketing che approva.
- **A/B test** su oggetto e CTA per le email ad alto impatto (A2, C1–C3, D2).
- **Metriche** per email: consegna, apertura, clic, conversione (acquisto/rinnovo/riattivazione), disiscrizione.

---
**Stato:** proposta di prodotto/marketing. Da approvare e poi tradurre nelle lingue dell'app + costruire i template Brevo con i trigger. Nessun invio senza consenso e senza passaggio dal Giudice.
