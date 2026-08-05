# Registro — "Sceglie le bottiglie da 1,5 L e in dashboard compare 1,8"

**Data:** 5 agosto 2026 · Segnalazione di Simone: «se la cliente sceglie da profilo bottiglia da
1,5 l in dashboard compare 1,8, perché?». Nello screenshot il riquadro acqua diceva **5/1,8**.

## Cosa era, davvero

Nessun errore di conversione: **1,8 non era la misura della bottiglia, era l'obiettivo di
giornata**. Il riquadro mostra `bevuto / obiettivo` e converte **tutti e due** i numeri nell'unità
scelta dal profilo.

L'acqua è sempre salvata in **bicchieri da 250 ml**: l'unità scelta (bicchieri, bottiglie da 0,5,
da 1 o da 1,5 L) è solo un modo di leggerla, non cambia il dato né l'obiettivo. Lo dice già il
commento in testa a `app/src/lib/water.ts`, ed è la scelta giusta: in backoffice l'acqua bevuta
resta confrontabile fra clienti che contano in modi diversi.

L'obiettivo lo calcola il backend sul **peso** (`signals.service.ts`, `waterGoalFor`): circa
33 ml/kg (`water_ml_per_kg`, configurabile), diviso 250 ml, arrotondato e tenuto fra 6 e 16
bicchieri. Per una cliente intorno agli 80-85 kg fa **11 bicchieri, cioè 2,75 litri**. In bottiglie
da 1,5 L: 11 ÷ 6 = 1,83 → scritto con una cifra, **1,8**.

Il **5** davanti erano 5 bottiglie già segnate, cioè 30 bicchieri: ogni tocco sul riquadro aggiunge
una bottiglia intera, quindi bastano cinque tocchi (probabilmente di prova) per arrivarci.

Quindi il conto era giusto e il risultato illeggibile. Con le bottiglie da 1,5 L l'obiettivo esce
tondo **solo** se vale 6 o 12 bicchieri: in tutti gli altri casi è un numero con la virgola, e un
"1,8" scritto accanto all'etichetta *bottiglie da 1,5 L* si legge naturalmente come se fosse la
misura della bottiglia, non l'obiettivo. Il difetto non era di una cliente: era di quasi tutte.

## Com'è ora

Se la cliente ha scelto di contare in bottiglie, **anche l'obiettivo è detto in bottiglie intere**:
quante gliene servono, non il risultato di una divisione. Nuova `waterGoalValue` in
`app/src/lib/water.ts`, arrotondamento all'unità più vicina e mai sotto una.

Il riquadro di prima e quello di adesso, a parità di dati (30 bicchieri bevuti, obiettivo 11):

| prima | ora |
|---|---|
| `5/1,8` | `5/2` |

Il litraggio esatto non si perde: il suggerimento del riquadro ora dice *"Tocca per aggiungere una
bottiglia da 1,5 L · obiettivo di oggi 2,75 L"*. Prima diceva solo "Tocca per aggiungere una
bottiglia".

Chi conta in bicchieri non vede alcun cambiamento: l'obiettivo era già un numero intero di
bicchieri e resta identico.

Il passo del tocco resta **una unità intera** (decisione di Simone): con le bottiglie da 1,5 L
significa 1,5 L per tocco, coerente con l'unità scelta.

### Due cose messe per iscritto, perché non si perdano

**Il numeratore può ancora avere la virgola**, e deve. Se una cliente segna dell'acqua contando in
bicchieri e poi passa alle bottiglie, 5 bicchieri diventano `0,8/2`. È scomodo da leggere ma è la
verità su quanto ha bevuto: arrotondare anche quello vorrebbe dire mostrare un dato falso. Il
numero con la virgola sparisce da solo al tocco successivo.

**L'arrotondamento dell'obiettivo è solo di facciata.** L'obiettivo vero, quello su cui il backend
valuta l'aderenza (`alerts.service.ts`: l'avviso "beve poco" confronta i bicchieri bevuti con
l'obiettivo salvato), resta quello in bicchieri. Nella grande maggioranza dei casi l'arrotondamento
va per eccesso e non cambia niente. C'è però un caso limite: una cliente molto leggera con
obiettivo 7 bicchieri (1,75 L) che conta in bottiglie da 1,5 L vede **1**, e bevendo quella
bottiglia il riquadro sembra a posto mentre per il backend è ancora sotto di un quarto di litro.
Meglio così che l'alternativa — arrotondare sempre per eccesso direbbe a quella stessa cliente di
bere 3 litri, cioè quasi il doppio del suo obiettivo. Se un giorno dovesse dare fastidio, la strada
è calcolare l'obiettivo direttamente in multipli dell'unità scelta, lato server.

## Verifiche

- `npx tsc --noEmit -p tsconfig.json` in `app/` → **pulito**.
- Le funzioni sono state compilate ed eseguite davvero, non solo lette. Casi controllati con
  obiettivo 11 bicchieri: bottiglie da 1,5 L → `5/2`; da 1 L → `2/3`; da 0,5 L → `4/6`; bicchieri →
  `8/11` (invariato). Ai due estremi dell'intervallo con le bottiglie da 1,5 L: obiettivo 6
  bicchieri → `1`, obiettivo 16 → `3`. Il caso del cambio di unità a metà giornata → `0,8/2`, come
  descritto sopra.

L'app non ha un framework di test (`app/package.json` ha solo `dev`, `build`, `preview` e i comandi
Capacitor), quindi la verifica è stata fatta compilando `water.ts` ed eseguendo le funzioni su
quella lista di casi. Vale la pena ricordarlo: **tutto quello che sta in `app/src/lib/` oggi non è
coperto da nessun test automatico**.

## File toccati

| File | Cosa |
|---|---|
| `app/src/lib/water.ts` | nuove `waterGoalValue` (obiettivo in unità intere) e `waterLiters` |
| `app/src/pages/Home.tsx` | il riquadro acqua usa l'obiettivo in unità intere; il suggerimento dice l'unità e i litri esatti |

## Come arriva alle clienti

È una modifica **dell'app**, non del server: sul sito web arriva col push (Vercel), ma sui telefoni
con l'app già installata **serve una release OTA Capgo**. Fino ad allora chi ha l'app installata
continua a vedere `5/1,8`.
