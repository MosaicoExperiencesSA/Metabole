# Percorso KETO — Agente Monitoraggio (ciclo bigiornaliero) (Regola 8)

Man mano che il cliente **prova i menu**, l'agente **registra due cose** nella sua **tabella personale**:
1. **Misure** (obbligatorie) — dicono se peso/cm sono **scesi**, **rimasti invariati** o **saliti**.
2. **Gradimento dei piatti** (opzionale) — quanto gli è piaciuto.

Il tutto su base **bigiornaliera** (ogni 2 giorni), perché **i menu sono ogni 2 giorni**.

---

## 1. Il ciclo di valutazione (bigiornaliero)
- L'unità di valutazione è il **ciclo di 2 giorni** = un menu.
- Nei **due giorni** l'agente propone lo **stesso menu** ma con **due metodi di cottura diversi** (dalla **Regola 6**, a **kcal invariate**): es. giorno 1 *salmone al forno*, giorno 2 *salmone alla griglia*.
- Così, a parità di calorie e ingredienti, l'esito sul peso/misure è confrontabile e il cliente ha varietà.

```
Ciclo N (2 giorni):
  Giorno 1 → menu M, metodo A
  Giorno 2 → menu M, metodo B   (stesse kcal, cottura diversa — Regola 6)
  Fine ciclo → misure (obblig.) + gradimento (opz.) → riga nella tabella personale
```

## 2. Dati raccolti a fine ciclo

| Dato | Obbligatorio? | Regola |
|---|---|---|
| **Misure** (peso e/o cm) | **Sì** | senza misure il ciclo non si chiude; l'app le richiede |
| **Gradimento piatti** (1–5 ★) | No | se il cliente **non lo inserisce → default 5 ★** |

**Esito misure** (calcolato dall'agente confrontando con il ciclo precedente):
- 📉 **Sceso** (peso e/o cm in calo)
- ➖ **Invariato**
- 📈 **Salito** (peso e/o cm in aumento)

## 3. Tabella personale del cliente (cosa scrive l'agente)

| Ciclo | Giorni (dal–al) | Menu | Cottura g1 | Cottura g2 | Peso inizio | Peso fine | Δ peso | Δ cm | Esito | Gradimento (★) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 14/07–15/07 | M-01 | forno | griglia | 78,0 kg | 77,6 kg | −0,4 | −1 | 📉 Sceso | 5 (default) |
| 2 | 16/07–17/07 | M-02 | vapore | cartoccio | 77,6 kg | 77,6 kg | 0,0 | 0 | ➖ Invariato | 4 |
| … | … | … | … | … | … | … | … | … | … | … |

- La tabella è **personale e isolata** (per `client_id`, prodotto Keto).
- Ogni riga = **un ciclo di 2 giorni** = un menu con i suoi 2 metodi di cottura.
- Il **gradimento** è per piatto; in tabella l'agente riporta anche la media del ciclo (default 5 se assente).

## 4. Regole ferme
- **Misure obbligatorie**: il ciclo si chiude solo con le misure; se mancano, l'app sollecita e l'agente tiene il ciclo "aperto".
- **Gradimento opzionale**: se non inserito → **5 ★**. Mai penalizzare il cliente per il non-inserimento.
- **Menu stabile per 2 giorni**, **cottura diversa** tra g1 e g2 (Regola 6), **kcal invariate**.
- L'agente in questa fase **registra e basta**: non modifica ancora i menu (l'adattamento sarà una regola successiva). Nessuna invenzione, nessun consiglio clinico.
- Dati sanitari → cifrati, accesso solo cliente + suo nutrizionista (come da regole progetto).

## 5. A cosa serve (aggancio alle regole successive)
La tabella personale (esito misure + gradimento, ciclo per ciclo) è la **materia prima** per la personalizzazione dinamica: le prossime regole useranno questi dati per **tenere/scartare** menu e cotture, correggere le porzioni/kcal e far intervenire il nutrizionista quando serve.

---

**Stato:** 🟡 logica definita, da validare col nutrizionista (soglie "sceso/invariato/salito", frequenza misure). Nessun deploy.
→ impatto [Sviluppo]: **Agente Monitoraggio** con **ciclo bigiornaliero**; schermata misure a fine ciclo (**obbligatoria**) + gradimento (opzionale, default 5★); tabella personale per `client_id` (cifrata) con Δ peso/Δ cm ed esito; abbinare a ogni ciclo lo **stesso menu con 2 metodi di cottura** (Regola 6).
