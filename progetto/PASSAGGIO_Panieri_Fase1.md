# Panieri — dove siamo, e cosa fare domani mattina

Scritto la notte del 31/8, mentre Simone dormiva.

## In una riga

La Fase 1 è scritta tutta. **Non è ancora applicata a niente**: il motore compone i menu esattamente
come ieri, e nessuna cliente vede una differenza. Serve una migrazione e tre comandi, in ordine.

## L'ordine, dopo il push e il deploy

Tutto dentro `~/project/src/backend`, sulla shell di Render.

### 1. La migrazione
Applica le due tabelle nuove (`paniere`, `paniere_ricetta`). ⛔ **Da Render, mai dal Mac.**
La migrazione crea solo le tabelle: non tocca né sposta niente.

### 2. `npm run panieri:riempi`
⛔ **Non scrive.** Stampa quanti panieri verrebbero creati, quante appartenenze, e per ogni paniere
quante ricette per pasto. **Incolla l'output.** Da guardare:
- il numero delle appartenenze non deve essere ridicolmente basso;
- l'elenco delle varianti che non versano in nessun paniere (sono le famiglie del §2.1: normale);
- i riferimenti rotti, che sono l'unica cosa che si perde di proposito.

### 3. `APPLICA=1 npm run panieri:riempi`
Scrive i panieri e le appartenenze. Ripetibile: rilanciarlo non aggiunge e non toglie niente.

### 4. `npm run panieri:confronta`
⛔ **Non scrive.** Mette il pool dalle giornate accanto al pool dal paniere e dà un verdetto secco.
⚠️ **Non deve tornare l'uguaglianza dei numeri**: il pool dal paniere sarà quasi sempre più grande,
ed è il senso della riforma (la Mediterranea vegana eredita i pranzi della DASH vegana). Quello che
deve tornare è che **nessuna ricetta si perde**.

### 5. Solo se il verdetto è ✅
Si mette in `config_param` il parametro `panieri_sorgente_pool` = `paniere`.
⛔ Prima di quel momento il pool arriva ancora dalle giornate, e va bene così.
⚠️ Si può tornare indietro in un secondo rimettendo `giornate`.

## Cosa NON fa ancora, e va saputo

- **La composizione della giornata legge ancora le giornate pre-costruite.** Il paniere decide *quali
  ricette può ricevere* una cliente, non *come si compone* il suo giorno: quello è la **Fase 3**.
- **`copertura-catalogo.ts`** conta ancora le giornate di ogni variante, ed è giusto finché il motore
  legge di là. Si sposta con la pagina, alla Fase 7.
- **Il generatore** (`engine-rules.service.ts`) ha una sua lettura delle giornate per sapere «cosa
  c'è già» quando genera. È dichiarata nella sentinella, non spostata: è la Fase 7.
- **Le famiglie doppione non sono chiuse** e le clienti non sono state spostate: è la Fase 9.

## Le due cose aperte che non riguardano il paniere

1. **La somma degli allergeni** è pronta e sospesa. Sono 2751 ricette che non dichiarano i solfiti
   pur avendoli (aceto balsamico, aceto di mele, uvetta, albicocche secche): gli scatenanti sono
   stati letti uno per uno e sono **tutti veri**. Si fa dopo aver rilanciato
   `npm run diag:allergeni-mancanti` col deploy nuovo, per vedere quanti tag falsi erano già scritti
   in catalogo (usciranno nella sezione «gli allergeni dichiarati che non risultano»).
2. **58 riferimenti rotti** oggi, su sei varianti con 13 clienti attive che vedono un pasto vuoto.
   La chiave esterna li rende impossibili da domani, ma quelli di oggi restano lì finché non si
   rifanno quei giorni.

## Nota

Da qui in avanti le consegne del paniere non hanno la revisione avversariale con subagent: è una
scelta di costo di Simone, dichiarata anche nei messaggi di commit. Le parti che decidono restano
coperte da prove e mutazioni.
