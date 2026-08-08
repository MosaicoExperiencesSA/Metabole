# Cambio piatto in chat con Gaia — progetto

Deciso il 9 agosto 2026 (Simone). Da costruire: qui c'è il disegno, le scelte già prese e
l'ordine dei pezzi, così si parte senza ridiscutere.

> **Stato: punti 1 e 2 FATTI** (8/8). Il pulsante «Sostituisci» dell'app porta nella chat, la
> sostituzione concordata entra nel menu della giornata coi grammi, e la conversazione con Gaia
> si legge dalla scheda cliente insieme all'elenco dei cambi «da verificare». Dettagli e scelte
> di implementazione nel REGISTRO del 9/8. **Restano i punti 3, 4 e 5.**
>
> Due cose decise strada facendo, che vale la pena sapere prima di attaccare il punto 3:
> - **il dialogo è deterministico**, non affidato all'AI. In produzione `ai_assistant_enabled`
>   è `false`: un ponte che funzionasse solo con l'AI accesa non funzionerebbe affatto. E
>   questo codice scrive grammi nel piatto di una persona. Quando l'AI si accenderà
>   riformulerà i testi, senza toccare la decisione;
> - **le due protezioni del punto 3 sono già in piedi** (allergeni e plausibilità dei grammi).
>   La plausibilità oggi è inerte perché proponiamo pari grammatura: diventa viva nel momento
>   in cui i grammi li dirà Gaia.

---

## Da dove nasce

Oggi, se una cliente vuole cambiare un alimento, esce un pop-up con tre bottoni — **oggi ·
questi giorni · per sempre** — e il menu cambia. Tre bottoni, nessuna domanda.

Il difetto è che «per quanto» è la conseguenza, non la causa. La domanda che conta è **perché**,
e non l'abbiamo mai fatta. «Non ce l'ho in casa» è un problema di martedì e il piatto domani
deve tornare; «mi resta sullo stomaco» non è un gusto, è un segnale clinico, e finora finiva
nella stessa casella di «non mi va».

In parallelo, **Gaia in chat lo sta già facendo bene**: la cliente scrive che vuole cambiare le
carote, Gaia chiede quante sono, propone le biete e dice quanti grammi usarne. La conversazione
funziona. Quello che manca non è il dialogo: è **tutto quello che succede dopo**.

## Il pezzo che manca

Oggi quella conversazione **non tocca il menu**. La cliente si accorda con Gaia, chiude la chat,
apre il menu e trova ancora le carote. Deve ricordarselo lei. E soprattutto: quello che ha
detto — cosa non le piace, cosa non digerisce, cosa non ha tempo di cucinare — **non lo sa
nessuno**. Non la coach, non la nutrizionista, non il motore che le comporrà il menu del mese
prossimo.

Quattro cose da costruire, in quest'ordine.

### 1. Il cambio entra nel menu ✅ FATTO (8/8)

Quando la conversazione arriva a una sostituzione concordata, va scritta sulla giornata:
l'ingrediente sostituito e la nuova quantità, **solo per quella cliente e solo per quel
giorno** (o per il periodo che il motivo comporta). Nessuna migrazione: `MenuDay.meals` è già
JSON, la sostituzione ci sta dentro come nota della porzione.

La ricetta di catalogo **non si tocca mai**: è di tutte, non di una.

### 2. La cronologia sta in scheda ✅ FATTO (8/8)

Il posto c'è già: `ChatThread` con `counterpart = 'ai'` e `Message` con `senderRole = 'ai'`.
La conversazione con Gaia è già una chat vera, va solo **mostrata sulla scheda cliente** in
backoffice, accanto alle altre. Coach e nutrizionista devono poter leggere cosa si sono dette.

### 3. Il nutrizionista verifica, e correggendo istruisce Gaia

**Scelta di Simone:** i grammi li dice Gaia, senza tabella nutrizionale. Il nutrizionista li
verifica dalla scheda cliente e, se sono sbagliati, li corregge.

Perché la correzione serva a qualcosa dev'essere **riutilizzabile**: quando corregge
«carote 100 g → biete 130 g» in «→ biete 150 g», quella coppia si salva come conoscenza, e da
lì in poi è il codice a rispondere, non l'AI. È così che «istruisce Gaia» diventa vero invece
di essere un modo di dire — altrimenti lo stesso errore torna la settimana dopo con un'altra
cliente.

Due protezioni, che non sono una discussione della scelta ma il minimo perché regga:

- **controllo di plausibilità**: una sostituzione fuori scala (meno di un terzo o più del
  triplo della quantità di partenza) non entra da sola; si ripiega su pari grammatura e si
  segnala. Un errore di battitura dell'AI non deve diventare una porzione tripla;
- **allergeni**: se il sostituto contiene un allergene dichiarato dalla cliente, il cambio si
  rifiuta e basta. Su questo non si media, e non è una questione di grammi.

Ogni cambio nasce marcato **«da verificare»** finché il nutrizionista non lo guarda: è quello
che rende la verifica una cosa che si può fare davvero, invece di dover rileggere tutte le chat.

### 4. Si impara

Due memorie diverse, e vanno tenute distinte:

- **il gusto** → `MenuWeight`: il piatto scartato prende un punteggio negativo e il motore
  smette di riproporglielo. Ma solo quando il motivo è un gusto: «non ce l'ho in casa» non dice
  niente sui suoi gusti, e trattarlo come un rifiuto le impoverirebbe il menu per una spesa
  saltata;
- **il motivo clinico** → segnalazione alla nutrizionista, come già fa `apriSegnalazione`.

### 5. Nel report di fine mese

**Scelta di Simone:** si scrive come **dato di personalizzazione**, non come conteggio di
richiami: «hai personalizzato 7 piatti questo mese», con i tre alimenti che cambia più spesso.
È un merito — il menu è diventato suo — e serve anche a lei per accorgersi di un'abitudine.

Un numero alto resta comunque un segnale per la coach: venti cambi in un mese vogliono dire che
il piano non le somiglia, e quello glielo deve dire una persona, non un report.

---

## Ordine di costruzione

1. ✅ **Il ponte**: la sostituzione concordata in chat scrive sulla giornata. Senza questo, il
   resto non serve a niente.
2. ✅ **La scheda**: cronologia Gaia visibile a coach e nutrizionista + elenco dei cambi «da
   verificare».
3. **La correzione che insegna**: il nutrizionista corregge, la coppia si salva, il codice
   risponde al posto dell'AI.
4. **La memoria dei gusti**: `MenuWeight` e la segnalazione clinica.
5. **Il report**: il conteggio come dato di personalizzazione.

I primi due si possono fare senza migrazioni. Il terzo ne chiede una piccola (le sostituzioni
imparate), ed è il momento giusto per farla.
