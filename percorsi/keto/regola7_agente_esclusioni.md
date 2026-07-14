# Percorso KETO — Agente Esclusioni → base personalizzata (Regola 7)

**La prima personalizzazione vera.** Come già fatto per la **Mediterranea**, un **agente AI** parte dalla **copia della base Keto approvata** (la base personale del cliente) e **rimuove ciò che il cliente non può o non vuole mangiare**: allergie, intolleranze, cibi non graditi (più cultura/fede se indicati). **Ciò che resta è la BASE PERSONALIZZATA di quel cliente.**

```
BASE KETO approvata ──clona──► base personale (copia integra)
                                     │
                          Agente Esclusioni  ◄── profilo cliente (allergie, intolleranze, non graditi, fede/cultura)
                                     │  rimuove / sostituisce
                                     ▼
                          BASE PERSONALIZZATA del cliente  ✅ prima personalizzazione
```

---

## 1. Identità dell'agente
- **Nome:** Agente Esclusioni (Personalizzazione Base) — lo stesso ruolo usato per la Mediterranea.
- **Dove lavora:** sulla **base personale** del cliente (mai sulla base ufficiale, che resta intatta).
- **Cosa fa:** applica il profilo del cliente e produce la base personalizzata, pronta per le regole successive.
- **Motore/tipo:** agente deterministico con regole + gruppi di equivalenza (Regola 4); nessuna invenzione di piatti.

## 2. Input (dal profilo cliente / onboarding)
- **Allergie** (es. pesce, frutta a guscio, uova, latte…).
- **Intolleranze** (es. lattosio, istamina…).
- **Cibi non graditi** (gusto personale: "non mangio funghi", "no maiale").
- **Cultura/fede** (es. no maiale, no crostacei) e **opzione veg/vegana**.
- *(La keto in sé, le grammature e le kcal restano quelle della base approvata.)*

## 3. Logica di esclusione (in ordine di severità)

| Caso | Azione dell'agente |
|---|---|
| **Allergia** | **Blocco duro**: rimuove ogni piatto che contiene l'alimento **o sue tracce/derivati**. Nessuna sostituzione "vicina" nello stesso allergene. Se serve, sostituisce con un **gruppo di equivalenza diverso** (Regola 4). |
| **Intolleranza** | Rimuove/limita l'alimento; **sostituisce** con alternativa tollerata dello stesso ruolo (es. lattosio → latticini senza lattosio o latti vegetali). |
| **Non gradito** | **Preferisce la sostituzione** con un alimento dello stesso gruppo di equivalenza (mantiene kcal e struttura); rimuove solo se non gradisce l'intero gruppo. |
| **Cultura/fede** | Esclude le categorie indicate (es. no maiale/crostacei); sostituisce con gruppi ammessi. |
| **Veg/vegano** | Tiene solo piatti con proteine vegetali/uova/latticini secondo il livello scelto; sostituisce le proteine animali con tofu/tempeh/uova/formaggi ammessi. |

**Principio:** prima **sostituire** (per non impoverire la varietà), poi **rimuovere** se non c'è alternativa sicura. Le sostituzioni usano **solo** i gruppi di equivalenza della Regola 4 e restano **dentro la keto** e **alle stesse kcal**.

## 4. Output
- La **base personalizzata** del cliente: sottoinsieme (eventualmente ricomposto con varianti sicure) della base approvata, **coerente keto**, senza allergeni/non tollerati/non graditi.
- Conserva la divisione per pasto (colazioni/pranzi/cene/spuntini/merende) e le kcal.
- È il **punto di partenza** delle regole di personalizzazione successive (grammature per fabbisogno, n° pasti, obiettivo, stato/gradimento…).

## 5. Sicurezza e casi limite (escalation al nutrizionista)
- Se le esclusioni **svuotano una categoria** (es. restano troppo pochi pranzi) → **non inventa**: segnala e **passa al nutrizionista** per integrare la base o proporre alternative.
- **Allergie gravi** → verifica tracce/contaminazioni; in dubbio, blocco + escalation.
- Combinazioni critiche (es. veg + più allergie) → revisione nutrizionista prima dell'uso.
- Ogni esclusione/sostituzione è **loggata** (audit) e resta **isolata** al singolo cliente e al prodotto Keto.

## 6. Cosa NON cambia
- La **base approvata** resta intatta e condivisa.
- Nessun mescolamento con altri percorsi.
- L'agente **non crea** piatti nuovi fuori dai gruppi validati; **non** altera kcal/keto.

---

## Esempio
Cliente: **allergia alla frutta a guscio**, **intollerante al lattosio**, **non gradisce il maiale**.
- Rimuove piatti con noci/mandorle/nocciole e derivati (COL01 burro d'arachidi, SP03 mandorle, ME06 burro di mandorle… → sostituiti con semi/olive/uovo sodo dove possibile).
- Sostituisce latticini con versioni senza lattosio o latti vegetali (COL09 yogurt → yogurt senza lattosio; formaggi → stagionati naturalmente privi di lattosio).
- Sostituisce il maiale con pollo/manzo/pesce nei piatti che lo prevedono (CE04, CE11, CE18… → equivalenti gruppo carne/pesce).
- **Risultato:** base personalizzata keto, senza frutta a guscio, senza lattosio, senza maiale, a pari kcal.

---

**Stato:** 🟡 logica definita, da validare col nutrizionista (regole di sostituzione sicura per allergeni). Nessun deploy.
→ impatto [Sviluppo]: implementare l'**Agente Esclusioni** che, alla creazione della base personale, filtra i piatti per allergeni/intolleranze/non graditi/fede usando i **tag alimento/allergene** e i **gruppi di equivalenza** (Regola 4); output = base personalizzata per `client_id` (isolata); log delle esclusioni; escalation al nutrizionista se una categoria resta sotto soglia.
