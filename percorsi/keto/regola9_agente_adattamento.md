# Percorso KETO — Agente Adattamento (scelta del menu successivo) (Regola 9)

L'agente legge la **tabella personale** (Regola 8: esito misure + gradimento) e **decide il menu del ciclo successivo**. Impara ciclo dopo ciclo cosa funziona **per quel singolo cliente** e registra tutto in modo personale.

---

## 1. La regola di decisione (a fine ciclo)

| Esito misure del ciclo | Decisione dell'agente | Come sceglie |
|---|---|---|
| 📈 **Ha preso peso/cm** | Ripropone il **menu che gli ha fatto perdere di più** | dal **ranking personale** dei menu per efficacia (Δ peso migliore); a parità, quello con **gradimento più alto** |
| ➖ **Invariato** | Propone un **nuovo menu** | dalla base personalizzata, non usato di recente, con **gradimento alto** e cottura preferita |
| 📉 **È sceso** | Propone un **nuovo menu** | mantiene lo slancio con varietà; dalla base personalizzata, gradimento alto |

> Logica di fondo: **se sale → sfrutta ciò che ha già funzionato** (exploit del menu migliore del cliente); **se scende o è fermo → esplora un nuovo menu** (varietà, aderenza, gradimento). Sempre a parità di keto e kcal target.

## 2. "Il menu che ha fatto perdere di più"
L'agente tiene per ogni cliente un **ranking personale dei menu** in base al **Δ peso/cm** ottenuto quando li ha usati:

| Rank | Menu | Volte usato | Δ peso medio | Gradimento medio |
|---|---|---|---|---|
| 1 | M-05 | 2 | −0,6 kg | 5 ★ |
| 2 | M-01 | 3 | −0,4 kg | 5 ★ |
| 3 | M-08 | 1 | −0,2 kg | 4 ★ |
| … | … | … | … | … |

- In caso di **peso in aumento**, l'agente pesca il **rank 1** (il più efficace per quel cliente).
- A parità di efficacia, sceglie quello con **gradimento più alto** (aderenza).
- Il ranking si **aggiorna a ogni ciclo** con i nuovi dati.

## 3. Scelta di un "nuovo menu" (invariato / sceso)
- Attinge **solo** dalla **base personalizzata** del cliente (Regola 7: già senza allergeni/non graditi).
- **Evita** i menu usati negli ultimi cicli (varietà) e i piatti con **gradimento basso**.
- Applica i **metodi di cottura** preferiti (Regola 6) — 2 cotture diverse nei 2 giorni (Regola 8).
- Mantiene **kcal target** e struttura keto.

## 4. Cosa registra (per ogni cliente, in modo personale)
Aggiunge alla tabella personale, per ogni ciclo:

| Ciclo | Esito precedente | Decisione | Menu scelto | Motivo | Δ peso ottenuto | Gradimento |
|---|---|---|---|---|---|---|
| 3 | 📈 salito | ripesca migliore | M-05 | rank 1 personale | −0,5 kg | 5 ★ |
| 4 | 📉 sceso | nuovo menu | M-11 | varietà, grad. alto | −0,3 kg | 4 ★ |
| … | … | … | … | … | … | … |

Così si costruisce lo **storico di apprendimento personale**: cosa funziona, cosa piace, cosa evitare — isolato per `client_id`, prodotto Keto.

## 5. Sicurezza e limiti (escalation al nutrizionista)
- **Aumento ripetuto** su più cicli (es. ≥2–3 cicli 📈 anche col menu migliore) → **segnalazione al nutrizionista** (l'agente non forza, non taglia kcal di testa sua).
- **Plateau prolungato** (troppi ➖ di fila) → nutrizionista valuta il ricalcolo (sarà eventualmente una regola dedicata su porzioni/fabbisogno).
- **Cali troppo rapidi** o anomalie → allerta clinica al nutrizionista.
- L'agente **non inventa** menu né piatti: sceglie solo tra base personalizzata + ranking; **non modifica** grammature/kcal senza il nutrizionista.
- Dati sanitari cifrati; accesso cliente + suo nutrizionista.

## 6. Flusso completo (Regole 6→9)
```
base personalizzata (R7)
   └─ ciclo 2 giorni: stesso menu, 2 cotture (R6+R8)
        └─ fine ciclo: misure obbligatorie + gradimento (R8)
             └─ Agente Adattamento (R9):
                  📈 salito   → ripesca il menu migliore del cliente (ranking)
                  ➖ invariato → nuovo menu (base personalizzata)
                  📉 sceso    → nuovo menu (varietà)
             └─ registra decisione + esito nello storico personale
```

---

**Stato:** 🟡 logica definita, da validare col nutrizionista (soglie, gestione aumenti ripetuti/plateau, cali rapidi). Nessun deploy.
→ impatto [Sviluppo]: **Agente Adattamento** che, a fine ciclo, applica la regola di decisione (📈 ripesca menu top del ranking personale · ➖/📉 nuovo menu dalla base personalizzata), mantiene un **ranking menu per client_id** (Δ peso + gradimento), registra decisione/esito nello **storico personale** cifrato, ed **escala al nutrizionista** su aumenti ripetuti/plateau/cali anomali; nessuna modifica autonoma di kcal/grammature.
