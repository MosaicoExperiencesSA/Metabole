# «Rifai con più proteine» — la decisione che manca (foglio per Simone, 14/8/2026)

È la terza frase dell'azione 3. Le altre due sono vive: «togli lo spuntino» (13/8) e «a colazione
qualcosa di salato» (aspetta le conferme di Lucia). Questa aspetta te, e ci vuole un minuto.

---

## Quello che c'è già nel motore (verificato oggi, non a memoria)

La quota proteica **è già un parametro**, e si chiama **banda**:

| | |
|---|---|
| `menu_daycombo_protein_min` | **0,20** (20% dei macro della giornata) |
| `menu_daycombo_protein_max` | **0,45** |
| dove si imposta | pagina **Regole motore**, ed è già **per dieta** (`perDiet: true`) |
| come agisce | `DayCombo` compone la giornata e **penalizza** le combinazioni fuori banda |

⚠️ **Due cose che contano per la decisione:**

1. **La banda non blocca niente.** È una penalità nel punteggio, non un filtro: se nessuna
   combinazione sta dentro, il motore prende comunque la migliore. Quindi alzare il minimo per una
   cliente **non può lasciarla senza cena**. (Il filtro duro è solo sulle kcal.)
2. **Quello che manca non è il concetto: è il livello per-CLIENTE.** Oggi la banda si imposta per
   dieta — cioè per tutte le clienti di quella dieta. «Rifai con più proteine **a Giulia**» non ha
   dove scriversi.

---

## Le tre letture possibili

### A — Banda sua, scritta in chiaro
Un campo per-cliente (es. minimo **0,30**) che vince su quello della dieta.

- ✅ Si legge in scheda: «Giulia: proteine minime 30%».
- ✅ Vera lo dice in anteprima con un numero, e si toglie quando vuoi.
- ⚠️ Se un domani alzi la banda della dieta (dal 20 al 28%), il valore di Giulia resta 30: giusto,
  ma qualcuno se ne deve ricordare.

### B — Spostamento relativo («+8 punti rispetto alla sua dieta»)
Si salva **quanto in più**, non il valore assoluto: la banda di Giulia diventa quella della sua
dieta + 8.

- ✅ Segue la dieta se un domani la cambi.
- ⚠️ In scheda si legge «+8» e per sapere il numero vero devi guardare due posti.
- ⚠️ Due «più proteine» detti a distanza di un mese diventano +16 senza che nessuno lo dica.

### C — Preferenza morbida, senza banda
Si accende per quella cliente il **bonus proteico** già esistente nel punteggio (oggi vive solo
nello stato «pre-evento»): i piatti più proteici salgono in classifica, ma nessuna soglia da
rispettare.

- ✅ È la più prudente: sposta le preferenze e non promette un numero.
- ⚠️ Non è verificabile: non puoi dire se «ha funzionato», perché non c'è una soglia da guardare.
- ⚠️ E non risponde alla domanda «quante proteine ha adesso Giulia?».

---

## Cosa consiglio, e perché

**La A.** Il progetto ha una regola che ha retto tutto il giorno: *prima di scrivere si mostra il
numero*. La A è l'unica che dà un numero da mostrare — in anteprima («la sua quota proteica minima
passa dal 20% al 30%»), in scheda e nel registro. La B fa risparmiare una manutenzione rara al
prezzo di rendere illeggibile il dato tutti i giorni; la C è gentile ma non si può controllare, ed è
esattamente il tipo di cosa che sembra funzionare finché nessuno la guarda.

⚠️ In tutte e tre, **la giornata si rifà solo sui giorni futuri non ancora aperti** — la regola
dell'annulla, come per tutto il resto.

---

## ✅ DECISO da Simone (14/8)

**La A**, con **+10 punti** come valore di scorta quando la percentuale non viene detta (dal 20%
della dieta al 30% per quella cliente), e la possibilità di dettarla («portala al 35%»).

Quindi:
- campo per-cliente `proteinMinPct` (frazione 0–1, nullable): `null` = vale la banda della sua
  dieta, cioè il comportamento di oggi;
- vince su `menu_daycombo_protein_min` quando c'è, e **solo sul minimo** — il massimo resta della
  dieta: alzare il pavimento non deve spostare il soffitto;
- Vera lo detta con anteprima («la sua quota proteica minima passa dal 20% al 30%») e conferma;
- si rifanno **solo i giorni futuri non ancora aperti**, come per l'annulla.
