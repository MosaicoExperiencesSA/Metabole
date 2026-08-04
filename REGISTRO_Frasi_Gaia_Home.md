# Registro — "La frase di oggi" di Gaia: da 6 frasi a 360

**Data:** 4 agosto 2026 · Richiesta di Simone: «facciamo 360 frasi scelte in maniera random».

## Com'era

In Home, la card *GAIA · LA FRASE DI OGGI* pescava da una lista di **sei** frasi scritte dentro
`Home.tsx`, con `FRASI[now.getDate() % 6]` — cioè il giorno del mese diviso sei. Tre conseguenze:

- il ciclo si ripeteva **cinque volte al mese**, sempre nello stesso ordine;
- la frase era **identica per tutte le clienti**, lo stesso giorno;
- nei mesi di 31 giorni la stessa frase usciva **due giorni di fila**, perché `31 % 6` e `1 % 6`
  danno lo stesso indice. Succedeva sette volte l'anno (gennaio, marzo, maggio, luglio, agosto,
  ottobre, dicembre).

## Com'è ora

**360 frasi** in un file dedicato, `app/src/lib/frasiGaia.ts`, e una selezione che dà a ogni
cliente una sequenza sua.

### Perché non `Math.random()`

L'etichetta dice "la frase di **oggi**". Con un random vero la frase cambierebbe a ogni ritorno
in Home — e siccome il testo è animato a macchina da scrivere (`TypeText`, 62 ms per carattere),
ripartirebbe da capo ogni volta: sembrerebbe un difetto, non una sorpresa. La scelta è quindi
deterministica su **(utente, giorno)**:

```
indice = (partenza_utente + numero_del_giorno × passo_utente) % 360
```

`partenza` e `passo` derivano da bit **diversi** dell'hash dell'id utente, così non sono
correlati fra loro. Il passo è preso da sedici numeri **coprimi con 360**: è questa la proprietà
che garantisce che la sequenza tocchi tutte e 360 le frasi **prima di ripeterne una**. Ogni
cliente ha quindi quasi un anno senza ripetizioni, e due clienti lo stesso giorno leggono quasi
sempre frasi diverse, in ordine diverso.

L'ordine dell'array è **volutamente mescolato** (mescolata una volta sola, con seme fisso, prima
di scrivere il file). Le frasi nascono raggruppate per tema — costanza, acqua, sonno, movimento,
cucina, misure… — ma siccome la selezione avanza a passi fissi *dentro* l'array, con i temi in
blocco una cliente si sarebbe letta più giorni di fila sullo stesso argomento.

### Le regole dei testi

Scritte in testa al file, perché valgano anche per chi ne aggiungerà altre: niente promesse di
risultati, numeri, tempi o garanzie; niente claim medici; niente colpa, vergogna, "cibo proibito"
o "sgarro"; niente aspetto fisico come misura del valore della persona; e **niente aggettivi di
genere riferiti a chi legge** — l'app è usata anche da uomini, quindi "brava", "stanca", "sicuro"
vanno riformulati in modo neutro. Massimo ~80 caratteri: oltre, l'animazione diventa più lenta di
quanto una card sopporti (le 360 attuali stanno tutte sotto, media 44 caratteri).

Le sei frasi vecchie sono state tenute: erano già in produzione ed erano già state approvate.

## Verifiche

Nell'app non c'è un test runner, quindi il controllo è stato fatto compilando il modulo con
`esbuild` ed eseguendolo:

- 360 frasi, **nessun duplicato**, nessuna oltre 80 caratteri;
- per otto id utente diversi, **360 frasi distinte in 360 giorni** (zero ripetizioni), e il
  giorno 361 riparte dalla prima: il ciclo è pieno, non c'è un sottoinsieme che si ripete;
- la frase è **stabile dentro la giornata** (stessa alle 00:01 e alle 23:59) e **cambia ogni
  giorno** per 400 giorni di fila;
- 31 luglio e 1º agosto danno frasi diverse: il difetto del vecchio ciclo non c'è più;
- su 2000 utenti finti, lo stesso giorno escono **341 frasi diverse su 360**.

**Non-vacuità.** Sostituendo i passi coprimi con `60` (che con 360 non lo è), il controllo delle
ripetizioni è diventato rosso nel modo giusto: **6 frasi distinte in 360 giorni** invece di 360 —
per ironia, esattamente il comportamento vecchio. La proprietà "coprimo con 360" è quindi
davvero quella che regge il risultato, non un dettaglio decorativo.

**Una cosa che non è un difetto.** Il conteggio dei giorni usa `Date.UTC` su anno/mese/giorno
locali. Provando la formulazione ingenua su un anno intero, compresi i due cambi di ora legale
del 2026, **non salta né ripete un giorno**: `Date.UTC` qui non corregge un bug, rende solo
esplicito che il conteggio non dipende dal fuso. È scritto anche nel commento, per non far
credere a chi legge che ci fosse un problema.

## File toccati

`app/src/lib/frasiGaia.ts` (nuovo, 360 frasi + selezione), `app/src/pages/Home.tsx` (via la
lista inline, chiama `fraseDelGiorno(user?.id, now)`). Nessuna migration, nessun endpoint: è
tutto dentro il bundle dell'app. `tsc -b` verde.

**Serve l'OTA.** Le frasi stanno nel bundle, non sul server: l'app installata continuerà a
mostrare le sei vecchie finché non parte una release. Aggiunto a
`NOTA_Agente_App_2026-08-04.md`.
