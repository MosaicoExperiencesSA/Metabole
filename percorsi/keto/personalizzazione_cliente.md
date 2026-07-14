# Percorso KETO — Personalizzazione per cliente

Fine della fase "base": la **base Keto è approvata** (`base_keto_da_approvare.md`) ed è **immutabile e condivisa**.
Da qui in poi le regole non toccano più la base: **creano la personalizzazione di ogni singolo cliente**.

## Principio
Ogni cliente che sceglie **Keto** riceve una **BASE PERSONALE** = **copia della base Keto approvata**, dedicata a lui. Le regole di personalizzazione (che seguiranno, una alla volta) **modellano la sua copia**, senza mai modificare la base ufficiale né mischiarsi con altri clienti o altri percorsi.

```
BASE KETO (approvata, unica)
      │  clona
      ▼
BASE PERSONALE del cliente  ──► regole di personalizzazione ──► menu del cliente
```

## Cosa NON cambia mai
- La **base approvata** resta intatta (ogni sua modifica ripassa dal nutrizionista, con versione).
- L'**isolamento** per prodotto: una base personale Keto contiene solo piatti Keto.

## Dimensioni che le regole di personalizzazione potranno impostare
*(placeholder: si riempiono con le prossime regole, una per una)*
- **Fabbisogno calorico / grammature** del cliente (le porzioni dei piatti della sua copia).
- **Esclusioni**: allergie, intolleranze, cibi non graditi → rimozione o sostituzione (gruppi di equivalenza della base).
- **Preferenze/gusti**: proteine/verdure preferite, opzione veg, cultura/fede.
- **Numero pasti** al giorno e presenza di spuntini/merende.
- **Obiettivo** e ritmo.
- **Stato/eventi** (agente dieta) e **gradimento** (learning), nel tempo.

## Registro delle regole di personalizzazione
| # | Regola | Cosa fa sulla base personale | Stato |
|---|---|---|---|
| 6 | **Metodi di cottura** (`regola6_metodi_cottura.md`) | per ogni cibo 3–5 metodi (forno/griglia/cartoccio/umido/vapore…) a **kcal invariate** → nuovi pasti; il cliente sceglie il metodo preferito | 🟡 da validare |
| 7 | **Agente Esclusioni → base personalizzata** (`regola7_agente_esclusioni.md`) | un agente AI toglie/sostituisce allergie, intolleranze, non graditi, fede/veg dalla copia della base → **prima personalizzazione vera** (base personalizzata del cliente) | 🟡 da validare |
| 8 | **Agente Monitoraggio (ciclo bigiornaliero)** (`regola8_agente_monitoraggio.md`) | ogni 2 giorni (stesso menu, 2 cotture diverse) registra **misure (obblig.)** ed **esito peso/cm** + **gradimento (opz., default 5★)** nella tabella personale del cliente | 🟡 da validare |
| 9 | **Agente Adattamento (scelta menu successivo)** (`regola9_agente_adattamento.md`) | legge esito+gradimento: 📈 salito → ripesca il **menu che ha fatto perdere di più** (ranking personale); ➖/📉 → **nuovo menu** dalla base personalizzata; registra decisione/esito nello storico personale | 🟡 da validare |
| 10 | **Menu di partenza differenziati** (`regola10_menu_partenza_differenziati.md`) | ogni cliente parte da un **menu/ordine diverso** (seme personale da `client_id`), anche a pari percorso e stessa data d'inizio | 🟡 da validare |

---
**Stato:** pronto a ricevere le regole di personalizzazione. Nessun deploy.
→ impatto [Sviluppo]: alla scelta "Keto", clonare la base approvata in una base personale del cliente; le regole seguenti operano solo su quella copia.
