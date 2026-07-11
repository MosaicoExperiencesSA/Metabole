# Metabole — Analisi esperienza & vendita (Giusy & Antonio)

Terzo giro di simulazione, sull'app **aggiornata** (coach in video, assaggio del menu con ricette
e consigli, mascotte naturale che sbatte gli occhi, tema colore personalizzabile, prove sociali,
"perché" richiamato al piano, value stack, garanzia, obiezioni). Due punti di vista nuovi:
**Giusy**, 50 anni, che vuole *qualcosa di diverso*, e **Antonio**, il commerciale che vuole uno
strumento che *venda da solo*.

---

## 1. Il percorso di Giusy (la cliente 50enne)

Giusy ha 50 anni. Ha fatto la chetogenica, i punti, il digiuno, la palestra. Il corpo è cambiato:
metabolismo più lento, la menopausa, qualche acciacco. Non vuole "l'ennesima app per ragazzine":
vuole *qualcosa di nuovo*, qualcuno che capisca il suo momento della vita e la segua davvero.

### Punti di forza (cosa la colpisce)

**L'esperienza è oggettivamente diversa.** Gaia le *parla* con voce e una mascotte che la guarda,
sbatte gli occhi, sorride. Dopo anni di moduli freddi, questo è nuovo e la disarma. → *Curiosità.*

**La relazione si vede, non si promette.** La schermata della coach Sara — volto, messaggio,
"potrai scriverle dal primo giorno" — le dà la sensazione di una persona vera dietro l'app, non
di un algoritmo. È esattamente ciò che cerca a 50 anni. → *Abbassa la diffidenza.*

**Assaggia prima di pagare.** L'anteprima del menu, con **Ricetta** sui piatti da cucinare e
**Consiglio** su quelli da comporre, le fa toccare il prodotto. Vede che è concreto e sostenibile,
non una promessa. → *Prova reale, non marketing.*

**Rassicurazione sulla sostenibilità.** Il fatto che il sistema verifichi se l'obiettivo è
sostenibile la tranquillizza: a 50 anni teme le diete drastiche. → *Fiducia nel metodo.*

**Ordine psicologico.** Partire dalla *mente* e dal *perché* la fa sentire ascoltata prima di
essere misurata. → *Adesione emotiva.*

### Punti deboli (dove Giusy si sente fuori posto o dubita)

- **Il target percepito sembra più giovane di lei.** I nomi (Giulia), le testimonianze (35 e 41
  anni), toni tipo "rientrare nei vestiti": Giusy a 50 non si vede rappresentata. Mancano prove
  sociali *della sua fascia* (donne 50+, "dopo la menopausa ho ritrovato energia").
- **Nessun aggancio ai temi dei 50 anni.** Menopausa, massa muscolare, salute delle ossa, energia,
  farmaci: la sezione salute li raccoglie ma non li *valorizza* mai come punto di forza del percorso.
  Per Giusy è proprio lì la differenza che cerca.
- **La "novità" è nell'esperienza, non nella promessa.** Il funnel è nuovo, ma la promessa
  ("−6 kg, menu, coach") somiglia a tante altre. Manca un **meccanismo unico spiegato**: *cosa* fa
  di diverso il motore giorno per giorno, perché stavolta funziona. Senza, il "nuovo" resta estetico.
- **Il video della coach è finto.** Una 50enne scettica lo nota subito: il player non parte. Finché
  non c'è il volto/voce reale, la leva più forte (la relazione) resta a metà.
- **Il "percorso pronto" è ancora generico.** Ha raccontato tutto di sé e non lo rivede riflesso:
  dovrebbe dirle "mediterranea, senza lattosio, attenta ai tuoi farmaci, −6 kg in 18 settimane".
- **Leggibilità.** Alcuni box hanno testo piccolo e contrasto tenue: a 50 anni conta. Un'opzione
  testo più grande / contrasto alto aiuterebbe (e allarga il target).
- **Credenziali reali.** Il nutrizionista è un nome. Per fidarsi, Giusy vuole numero d'albo, anni,
  recensioni verificate: prove, non etichette.

→ *Giusy è incuriosita e quasi convinta dal metodo e dalla relazione, ma non si sente ancora "vista"
come cinquantenne, e la novità che cercava resta più nell'esperienza che nella sostanza.*

---

## 2. L'occhio di Antonio (il commerciale che vuole uno strumento che vende da solo)

Antonio non vuole telefonare ai lead. Vuole un'app che, da sola — installi, inserisci i dati,
paghi — chiuda la vendita e gli attribuisca la provvigione. Guarda ogni schermo chiedendosi:
*questo passo vende senza di me?*

### Cosa già vende da solo (forza)

Il funnel è completo e automatico: rapport (Gaia) → scoperta (test) → soluzione su misura
(percorso pronto) → **prova del prodotto** (coach in video + assaggio menu) → raccomandazione
(piano) → chiusura (pagamento). Prove sociali, value stack, garanzia, obiezioni gestite, richiamo
del "perché": quasi tutte le leve di un bravo venditore sono già dentro l'app, senza bisogno di una
persona. I micro-impegni del test creano investimento (sunk cost). → *Base solida: vende quasi da solo.*

### Dove NON vende ancora da solo (debolezze)

- **Zero urgenza automatica.** C'è "più scelto −10%", ma niente che spinga a decidere *adesso*
  (offerta a tempo, posti con la coach limitati). Senza spinta, Giusy rimanda — e chi rimanda non
  torna. Serve una leva di scarsità/tempo gestita da config.
- **Nessun recupero di chi abbandona.** Se non completa o non paga, non parte nulla: niente email o
  reminder automatico. "Vendere da solo" include il **follow-up automatico** (recupero carrello).
- **Il refcod non lavora.** Un link `?ref=ANTONIO` dovrebbe precompilare il codice, sbloccare
  un'offerta dedicata e tracciare la provvigione. Oggi è solo un campo: per Antonio è *la* leva
  mancante, perché è la sua.
- **Prezzo "prendere o lasciare".** Mostrato una volta sola, senza alternativa se dice no: manca un
  **downsell** automatico (prova, primo mese scontato, piano più leggero) per non perdere chi non è
  pronto ai 3 mesi.
- **Manca la prova del meccanismo.** Far *vedere* il motore che adatta il menu (anche una mini-demo)
  darebbe all'app l'autorevolezza per vendere da sola il suo elemento più unico.
- **Nessuna misurazione del funnel.** Per ottimizzare la vendita automatica servono drop-off per
  step e A/B test sulle soglie (il modello `config_param` è già previsto: va sfruttato).

→ *L'app accompanga bene fino alla soglia, ma alla chiusura le manca la spinta finale automatica
(urgenza + recupero + downsell) e l'aggancio commerciale (refcod). Con queste, "vende da sola" davvero.*

---

## 3. Sintesi e priorità

Rispetto al giro precedente, due lacune sono state colmate: la **relazione si tocca** (coach in
video) e il **prodotto si assaggia** (anteprima menu con ricette/consigli). Il salto successivo è
duplice, uno per lente.

**Per Giusy (farla sentire vista + dare vera novità):**
1. Prove sociali e linguaggio **50+** (menopausa, energia, sostenibilità), testimonianze coetanee.
2. **Percorso pronto come specchio** dei suoi dati (dieta, esclusioni, farmaci, obiettivo).
3. Spiegare il **meccanismo unico** (cosa adatta il motore, perché è diverso).
4. **Video coach reale** + credenziali verificabili; opzione **testo grande/contrasto**.

**Per Antonio (farla chiudere da sola):**
1. **Urgenza/scarsità** automatica (offerta a tempo, posti coach) da config.
2. **Recupero automatico** (email/reminder per chi non completa o non paga).
3. **Refcod attivo**: link → precompilazione + offerta dedicata + tracking provvigioni.
4. **Downsell** se rifiuta il piano (prova / primo mese / piano leggero).
5. **Analytics di funnel** + A/B test sulle soglie.

**In una riga:** l'app è passata da *"ottimo onboarding"* a *"onboarding che fa provare".* Ora, per
Giusy deve **parlare la sua età** e mostrare *perché è nuova davvero*; per Antonio deve aggiungere
la **spinta finale automatica** (urgenza, recupero, downsell, refcod). Fatto questo, è uno strumento
che si vende — e si racconta — praticamente da solo.
