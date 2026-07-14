# Percorso KETO — Menu di partenza differenziati per cliente (Regola 10)

I **menu di partenza sono diversi per ogni cliente**, anche se scelgono **lo stesso percorso** (Keto) e **partono lo stesso giorno**. Due clienti = due menu di partenza diversi.

---

## 1. Principio
- Nessun "menu di partenza unico" condiviso: ogni cliente parte da un **punto diverso** della propria base personalizzata.
- Vale anche per **profili identici** e **stessa data di inizio**: l'ordine e il primo menu **non coincidono**.
- Evita l'effetto-gregge (tutti lo stesso piatto lo stesso giorno) e rende il percorso percepito come **su misura fin dal primo giorno**.

## 2. Come si ottiene
- A ogni cliente è associato un **seme personale** (derivato dal `client_id`).
- Il seme determina **ordine e menu iniziale** della sequenza pescata dalla **base personalizzata** (Regola 7): la lista dei menu viene **mescolata/ruotata** in modo deterministico ma **diverso per ciascun cliente**.
- Risultato: stesso percorso, stessa base di partenza, ma **sequenza e primo ciclo differenti** cliente per cliente.

```
Base personalizzata (R7) → [ordina con seme personale del cliente] → sequenza personale
   Cliente A (seme a) → parte da M-07, poi M-02, M-11…
   Cliente B (seme b) → parte da M-03, poi M-09, M-01…   (stesso giorno, menu diversi)
```

## 3. Cosa resta garantito
- La sequenza pesca **solo** dalla base personalizzata del cliente (già senza allergeni/non graditi — R7).
- Ogni menu resta **keto** e alle **kcal target**; ciclo **bigiornaliero** con 2 cotture (R6+R8).
- Da qui in poi entra la **Regola 9** (adattamento su misure/gradimento): il punto di partenza è diverso, e anche l'evoluzione diventa individuale.

## 4. Cosa registra
- La **sequenza di partenza assegnata** viene salvata nella **tabella personale** del cliente (isolata per `client_id`), così è tracciabile e ripetibile.

---

**Stato:** 🟡 logica definita, da validare col nutrizionista/prodotto. Nessun deploy.
→ impatto [Sviluppo]: alla creazione della base personalizzata, generare una **sequenza di partenza personale** (ordinamento deterministico con seme da `client_id`) sulla base personalizzata → **primo menu e ordine diversi** per ogni cliente, anche a pari percorso e data d'inizio; salvare la sequenza nello storico personale; l'Agente Adattamento (R9) prosegue da lì.
