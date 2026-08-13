# Da riprendere — 14/8/2026

> Scritto il 13/8 sera, a giornata chiusa. Ordine di lettura per chi riprende: questo file, poi
> `Decisioni_Simone_20260813.md` (§12-§14 sono di oggi), poi la pagina Lavori. Il dettaglio di Vera
> sta in `VERA_AVANZAMENTO.md`; le trappole in `HANDOFF_Vera_Sessione.md` e `CLAUDE.md`.

**Suite: 2657 test verdi su 184 suite** (verifica sul Mac in coda), `tsc` a zero (restano i 2 errori pre-esistenti di
`prisma/approve-diets.ts` e `prisma/dedupe-diets.ts` col tsc completo). Build backoffice pulita.

## In produzione da ieri sera (13/8)

- **Tutti i rossi della pagina Lavori sono chiusi**: «serve la visita» parte in automatico dalle
  tre strade (criteri Nocanty §15), il freno forte è deciso (non esiste), il resto era fatto e si
  spunta col caricamento (`fatta: true` nel file — novità del 13 sera, a senso unico: mai riaprire).

- **OTA 2.1.8**: scheda in home che chiede le allergie, allergie/intolleranze + «Cibi da evitare»/
  «Cibi assolutamente vietati» nel profilo, pezzi inerti della campagna (rotta notifica, intent).
- **Pagina Colazioni** nel backoffice: 2653 colazioni, proposte dolce/salato, selezione per riga,
  conferme in blocco a pacchetti da 500. Le conferme le fa Lucia; l'azione di Vera resta spenta.
- **Vera**: battesimo che non scade più (condizione sui dati), «togli lo spuntino» vivo
  (`pastiEsclusi`, kcal ridistribuite come nel digiuno, giorni mai aperti rifatti).
- **Campagna allergie**: script pronti, NON ancora lanciati.

## Stamattina alle 11 — LA CAMPAGNA (promemoria automatico alle 10:55)

Shell di Render, nell'ordine, prima in prova e letti riga per riga:
1. `npm run chiedi:allergie` → attese 3 (Maria/Carboidrati, Mariastella/Favismo, Patrizia/finocchi…),
   poi `CONFERMA=1`. Ora manda anche la push vera, non solo la campanella.
2. `npm run avvisa:allergie` → attesi ~45 (24 mai risposto → scheda in home; 21 a posto →
   informativa), poi `CONFERMA=1`. Decisione di Simone: a tutti (Decisioni §13).

⚠️ Chi non ha aggiornato l'app riceve la push ma il tocco non apre scheda/dialogo, e la notifica
vale come «già chiesto».

## Poi, in ordine di valore

0. **Crudo/cotto (Decisioni §16)**: la tabella di Nocanty è arrivata la sera del 13. Da fare a
   mente fresca: default crudo nella ricerca per nome di `valori-nutrizionali`, domanda in
   `ricetta-dettata` sopra il 30% di scarto, import delle 44 righe (stato esplicito, confermate),
   poi l'indice glicemico che aspettava questa risposta.

1. **Lucia sulla pagina Colazioni** (~2180 proposte da confermare, ~470 a mano). Quando le
   conferme bastano, si accende «a colazione qualcosa di salato» (azione 3, frase 2).
2. **«Rifai con più proteine»** (azione 3, frase 3): serve la decisione di Simone — livello
   assoluto per cliente o spostamento relativo rispetto alla dieta.
3. **Voce 235**: `pastiEsclusi` non si vede in nessuna scheda (stesso buco che avevano le allergie).
4. Voci in attesa: indice glicemico (crudo/cotto), elenco clienti scoperte da un divieto di dieta,
   `ai_assistant_enabled` spento in produzione, le due decisioni di Vera (§6 dell'handoff).

## Conta di controllo (fra qualche giorno)

`npm run conta:allergie`: la popolazione 3 (24 il 13/8) deve SCENDERE da sola con la scheda in
home. Se non scende, il problema è la scheda, non la campagna.
