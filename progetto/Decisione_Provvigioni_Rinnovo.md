# Provvigioni sul rinnovo — la decisione che sblocca la voce #10

**Per:** Simone (e Antonio) · **Da:** Sviluppo · **Data:** 6 agosto 2026
**Sblocca:** monitoraggio a pagamento dopo il mantenimento + tutti gli abbonamenti ricorrenti
(`progetto/Metabole_Piano_Stripe_Ricorrente.md`, Parte A punto 3).

---

## ✅ Deciso il 6/8 (Simone) — la scelta fra a/b/c è chiusa

**Nutrizionista: 0% su Mantenimento e Monitoraggio**, sia sul primo addebito sia sui rinnovi. Il
motivo regge: il lavoro del nutrizionista su questi due prodotti è tutto a monte, nel catalogo, ed
è già remunerato dai percorsi; sul singolo mese di mantenimento non c'è una prestazione clinica
nuova. Sui **percorsi** (1/3/6 mesi) il 15% resta com'è.

**Coach: la quota sui rinnovi NON cambia** → **opzione (b)**, provvigione piena a ogni rinnovo.
Parole di Simone: «la quota coach sui rinnovi non cambia».
È il modello *residual*: la coach guadagna finché la cliente resta, quindi ha interesse a farla
restare — che in mantenimento è esattamente il comportamento che serve, perché le clienti in
mantenimento non protestano, spariscono. Coi numeri qui sotto: €13,05 al mese alla coach, €15,26
a Metabole, **€183 per cliente all'anno**.

✅ **Tutte le domande sono chiuse** (6/8). Restano qui sotto per memoria delle ragioni: (sono le «due varianti» più sotto, che con la (b)
pesano più di prima):

1. ✅ **DECISA (Simone, 6/8): per sempre.** Il residual non scade: finché la cliente si rinnova,
   la coach incassa. Su una cliente che resta tre anni sono €470 alla coach, contro i €157 che
   avrebbe fruttato un residual a 12 mesi.
   Regge perché **la decisione 2 ne è il contrappeso**: si paga solo finché quella coach è ancora
   la coach assegnata. La rendita è legata al **rapporto**, non al contratto — se la coach smette
   di seguire la cliente, o la cliente viene spostata, il pagamento si ferma da solo. Senza quel
   vincolo, «per sempre» sarebbe stato un assegno in bianco.
   ⚠️ Da tenere d'occhio nei numeri, non nel codice: il mantenimento lascia a Metabole €15,26 al
   mese per cliente **per sempre**, non €28,31 dal secondo anno. È la cifra su cui calcolare
   quanto si può spendere in acquisizione.
2. ✅ **DECISA (Simone, 6/8): sì.** La provvigione sul rinnovo si paga **solo se quella coach è
   ancora la coach assegnata** alla cliente. Chiude il caso di chi se ne va, o da cui la cliente
   è stata spostata, e continuerebbe a incassare su una persona che non segue più.
   In codice è una condizione in `generateCommissions`, non un'architettura.

Decise entrambe la sera del 6/8, prima di scrivere una riga di ricorrente: era il momento giusto,
perché dopo il primo rinnovo pagato sarebbero diventate una revisione di compensi già erogati.
**Il codice ora può partire senza altre domande sulle provvigioni.**

---

## ⚠️ I numeri qui sotto sono su €29: i prezzi veri sono altri (6/8 sera)

Simone ha fissato il listino **dopo** che questo documento era scritto:

| Prodotto | Prezzo | Come si vende |
|---|---:|---|
| **Mantenimento** | **€49/mese** | abbonamento **o mese singolo** |
| **Monitoraggio** | **€19/mese** | solo abbonamento, anche per sempre |

Le **decisioni** restano valide (sono percentuali e condizioni, non importi). Cambiano i conti:

- **Mantenimento €49** · coach 45% = €22,05 · Stripe ≈ €0,99 → **a Metabole €25,96/mese**,
  cioè €311 all'anno per cliente invece dei €183 calcolati su €29. Il residual «per sempre»
  pesa meno di quanto sembrasse quando l'abbiamo deciso.
- **Monitoraggio €19** · coach 45% = €8,55 · Stripe ≈ €0,54 → **a Metabole €9,91/mese**.
  Qui la percentuale è da riguardare: è un prodotto che dura anni e chiede pochissimo lavoro
  ricorrente, e il 45% se ne porta via quasi metà. **È l'unico numero ancora aperto.**

Il percorso della cliente, per memoria: peso raggiunto → mantenimento **per quanti mesi vuole**
→ monitoraggio **anche per sempre**. Nessuno dei due ha una scadenza imposta.

---

## Il problema in una riga

Oggi `generateCommissions` gira su **ogni pagamento approvato**, senza distinguere il primo
acquisto dal rinnovo. Con l'addebito ricorrente ogni mese arriva un pagamento nuovo: senza una
regola, **si pagano provvigioni piene ogni mese, per sempre**.

Non è un bug da correggere in fretta: è una scelta di modello, e va presa prima di scrivere il
codice, perché cambia cosa il codice deve fare.

---

## I numeri, aggiornati alla decisione

Mantenimento **€29/mese**. Coach **45% = €13,05**, nutrizionista **0%**. Commissione Stripe su
carta europea: circa **€0,69** (1,5% + €0,25).

| | primo mese | dal 2° mese | 12 mesi di una cliente | provvigioni pagate in 12 mesi |
|---|---:|---:|---:|---:|
| **(a) solo al primo addebito** | €15,26 | €28,31 | **€326,67** | €13,05 |
| **(b) piena a ogni rinnovo** | €15,26 | €15,26 | **€183,12** | €156,60 |
| **(c) metà sui rinnovi** (€6,53) | €15,26 | €21,78 | **€254,84** | €84,88 |

*(la colonna "12 mesi" è quello che resta a Metabole al netto di provvigioni e Stripe, prima di
ads e piattaforma)*

Togliere il 15% al nutrizionista ha reso l'opzione (b) molto più sostenibile di prima: il residual
pieno passa da €131 a **€183** per cliente all'anno. La forbice fra la scelta più prudente e la più
generosa scende da ~190 a **~143 euro per cliente**.

---

## Le tre opzioni, con il loro rovescio

**(a) Provvigione solo sul primo addebito.** Margine massimo, modello semplice: la provvigione
paga l'**acquisizione**, che è il lavoro che la coach ha effettivamente fatto.
*Il rovescio:* dal secondo mese la coach continua a seguire quella cliente — check-in, chat,
sblocchi misure — **gratis**. Il rischio non è che protesti: è che smetta di occuparsene, e le
clienti in mantenimento sono proprio quelle che si perdono in silenzio.

**(b) Provvigione piena a ogni rinnovo.** Modello "residual": la coach guadagna finché la cliente
resta, quindi ha tutto l'interesse a farla restare — ed è esattamente il comportamento che serve
in mantenimento. Con il nutrizionista a zero, restano €15,26 al mese: non più proibitivo.

**(c) Provvigione ridotta sui rinnovi** (metà: coach €6,53). Riconosce che il lavoro sul rinnovo
c'è ma è minore di quello di acquisizione — che è la verità. *Il rovescio:* è un compromesso, e va
spiegato bene alle coach, altrimenti si legge come un taglio.

---

## Due varianti che contano più della scelta fra a/b/c

**Residual a scadenza.** Provvigione sui rinnovi **per i primi 12 mesi**, poi zero. Tiene la coach
agganciata nel periodo in cui la cliente può ancora mollare, senza pagare per sempre su una
cliente che ormai si rinnova da sola.

**Provvigione solo a coach ancora assegnata.** Il rinnovo genera provvigione **solo se quella
coach segue ancora la cliente**. Chiude il caso della coach che se ne va o viene riassegnata e
continuerebbe a incassare. Conviene metterla comunque, qualunque opzione scegliate: è una riga di
condizione, ed evita una discussione futura.

---

## Da fare subito, indipendentemente da a/b/c

I campi provvigione sono **per piano** e si impostano dal **Negozio** in backoffice
(`commission_nutritionist_pct` / `commission_nutritionist_cents`). I due piani interessati sono
**«Mantenimento Metabole»** (€29, `period: maintenance`) e **«Menu di rientro (8 giorni)»** (€29,
nascosto dallo shop, del Monitoraggio). Vanno messi a **0** entrambi i campi del nutrizionista.

⚠️ Nota: quei due piani nascono dal seed **senza importi di provvigione**, quindi il default è già
0 per tutti i ruoli. Se in Negozio non sono mai stati compilati a mano, oggi il mantenimento non
paga provvigioni **a nessuno** — coach compresa. Vale la pena verificarlo prima di decidere,
perché cambia la domanda da "quanto tagliamo" a "quanto mettiamo".

Comando di verifica sulla shell di Render:

```
npx ts-node --transpile-only -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.plan.findMany({where:{OR:[{period:'maintenance'},{period:'8d'}]},select:{name:true,priceCents:true,commissionCoachPct:true,commissionCoachCents:true,commissionNutritionistPct:true,commissionNutritionistCents:true}}).then(r=>{console.table(r);return p.\$disconnect()})"
```

---

## Cosa serve al codice, una volta deciso

Poco, ed è additivo:

1. sul `Plan`, gli importi di provvigione **per il rinnovo** accanto a quelli esistenti (zero =
   opzione a; uguali = opzione b; metà = opzione c);
2. in `generateCommissions`, distinguere il primo pagamento dal rinnovo — l'informazione arriva
   già dallo webhook Stripe (`invoice.paid` con `billing_reason`);
3. se scegliete il residual a scadenza, un contatore dei rinnovi già remunerati sulla Subscription.

Nessuna di queste tocca i pagamenti una-tantum già in produzione: i piani senza prezzo ricorrente
continuano a funzionare esattamente come oggi.

*Sono numeri e conseguenze, non un consiglio: il modello di remunerazione delle coach è una scelta
vostra, e dipende da cose che sapete voi — quanto pesa il rinnovo sul lavoro reale di una coach, e
quanto volete che il mantenimento sia un prodotto di margine o di fidelizzazione.*
