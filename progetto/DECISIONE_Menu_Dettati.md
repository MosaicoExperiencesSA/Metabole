# «Detta le combinazioni e crea menu specifici» — foglio per Simone (14/8/2026)

La voce 241, il secondo meccanismo della variante di piano. La tua risposta del 14/8 diceva:
*«la nutrizionista o detta le nuove combinazioni e crea dei menu specifici guidata da Vera, oppure
sceglie una diversa dieta»*. La seconda metà è fatta e pushata (il cambio dieta); questa è la prima.

---

## Quello che il motore fa già (verificato)

Una giornata non è un elenco di parole: è **una ricetta per ogni pasto**, presa dal catalogo
approvato per quella cliente, con la somma delle kcal dentro la tolleranza del target (±15%) e la
quota proteica dentro la banda. Chi compone oggi è `DayCombo`, e quando scrive lo fa in
`MenuDay.meals` con i `recipeId`.

⚠️ **Il vincolo che decide tutto**: un menu deve puntare a **ricette che esistono in catalogo**. Il
motore, la scheda, le sostituzioni di Gaia, gli allergeni, il conteggio delle kcal — tutto parte dal
`recipeId`. Una giornata «scritta a parole» non è un menu: è un testo.

---

## Le tre letture

### A — Sceglie i piatti dal catalogo, uno per pasto
Vera chiede pasto per pasto e lei nomina il piatto; l'agente lo cerca **fra quelli approvati per
quella cliente** (la sua base personale certificata), mostra le kcal che vengono fuori e scrive la
giornata.

- ✅ È un menu vero da subito: allergeni, kcal, sostituzioni, tutto continua a funzionare.
- ✅ Riusa `client_menu_pool` e i controlli che ci sono già.
- ⚠️ Lei può nominare solo piatti che esistono. Se ne vuole uno nuovo, prima lo detta (azione 4, che
  già c'è) e poi lo usa.

### B — Detta la giornata a parole e il sistema la traduce
«Colazione: yogurt e frutta secca. Pranzo: pasta al pomodoro e insalata…» e l'agente cerca la
ricetta più vicina per ogni riga.

- ✅ È il modo in cui una nutrizionista parla davvero.
- ⚠️ **La somiglianza è un indovinello**: «pasta al pomodoro» può essere cinque ricette con kcal
  molto diverse. O si sceglie da soli (e allora il menu non è quello che ha dettato), o si chiede
  ogni volta (e allora è la A con più passaggi).

### C — Una giornata «modello» che si ripete
Lei compone **una** giornata tipo e quella entra nel ciclo di quella cliente per N giorni.

- ✅ Poco lavoro, molto effetto: è quello che chiede chi vuole «la settimana di scarico».
- ⚠️ Rompe la varietà, che è una promessa fatta alle clienti (il motore ha una regola apposta perché
  lo stesso piatto non torni entro 2 giorni).

---

## Cosa consiglio, e perché

**La A**, e in un secondo momento eventualmente la C come «ripeti questa giornata per N giorni».

La B sembra la più naturale e sarebbe la più pericolosa: tradurre «pasta al pomodoro» in un
`recipeId` è esattamente il tipo di scelta che non produce nessun errore e cambia le calorie di una
giornata. Se un domani la vorremo, il posto giusto è **dopo** la A: prima si impara a comporre bene,
poi si aggiunge la scorciatoia.

⚠️ In tutte: si scrive **solo sui giorni futuri non ancora aperti**, e prima si mostra il totale
delle kcal contro il target (come già fa il pool per le esclusioni).

---

## Le domande, in tre righe

1. **A, B o C?**
2. Se A: quando la giornata composta **esce dalla tolleranza kcal** (±15%), Vera **si ferma e lo
   dice**, o **scrive lo stesso** dicendo di quanto sfora? (io propongo: si ferma, con il numero —
   ma è un tuo tetto clinico, non mio)
3. La giornata dettata vale **per un giorno** o si può dire «da lunedì a venerdì»?
