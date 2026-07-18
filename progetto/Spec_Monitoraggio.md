# Spec — livello "Monitoraggio" (da costruire, per Simone)

Nuovo livello proposto da Antonio (17/07), modello aggiornato. **Per ora è solo nel diario del percorso** come terza opzione; la funzione si costruisce dopo.

## Cos'è
Un **paracadute di retention gratuito e a tempo**: la cliente che finisce il percorso e non vuole né rinnovare né pagare il mantenimento resta agganciata a Gaia per un mese. Gaia la sorveglia e, se riprende peso, le vende gli 8 menu di rientro (€29). Poi la ri-converte a un piano a pagamento.

## Come funziona
1. **Stato "Monitoraggio":** **gratuito**, dura **al massimo 1 mese**. Gaia **non eroga menu**; chiede periodicamente le **misure** (soprattutto il peso).
2. **Trigger di rientro:** se il peso **sale di +3 kg** rispetto al peso di riferimento (es. dopo una vacanza), Gaia propone i suoi **8 menu di rientro** = gli 8 giorni di menu che su quella cliente hanno fatto perdere di più (dal suo storico personale, ordinati per calo).
3. **I menu di rientro si pagano SEMPRE €29** (dal primo, non c'è rientro gratuito). Recupero atteso: 3 kg in **4–6 giorni**.
4. **Se la cliente NON paga i menu → il monitoraggio si interrompe.** "Interrompe" = Gaia smette di sorvegliare e chiedere misure, ma il **profilo si CONGELA, non si cancella** (a differenza del purge della prova). Lo storico resta salvato.
5. **Alla fine del mese (o alla ripresa dopo un rientro):** Gaia chiede cosa fare — restare/riavviare monitoraggio, **percorso di dimagrimento** (a pagamento) o **mantenimento €29/mese**.
6. **Riaggancio caldo:** quando la cliente torna, Gaia riparte dallo storico che ha già (non da zero).

## Punti aperti da decidere (Antonio/Simone)
- **Il pagamento di un rientro (€29) fa ripartire un nuovo mese di monitoraggio gratuito?** (Proposta: sì → crea un loop pulito: paghi €29 → menu + un altro mese di sorveglianza → eventuale nuova ricaduta → paghi ancora.)
- Peso di riferimento del monitoraggio = ultimo peso "buono" a fine percorso.
- Soglia trigger +3 kg parametrizzabile.

## Dati / logica che servono
- Timer monitoraggio: durata max 30 giorni; stato attivo/congelato.
- Selezione **8 menu migliori** per cliente: dallo storico (ClientMenuPool / pesi appresi / risultati per ciclo), ordinati per calo ottenuto.
- Prodotto "menu di rientro" a €29 (one-time per rientro, sempre a pagamento).
- Gate: rientro erogato solo dopo pagamento; se non paga → congela profilo, esci dal monitoraggio.
- Eventi funnel: `monitoraggio_started`, `monitoraggio_rientro_offerto`, `monitoraggio_rientro_pagato`, `monitoraggio_rifiutato_congelato`, `monitoraggio_scaduto`, `monitoraggio_converted` (a dimagrimento/mantenimento).

## Nota di prodotto (Antonio)
- Livello **gratuito** all'ingresso, **max 1 mese** (scartata l'ipotesi €19: non far scappare chi si vuole trattenere). Il ricavo arriva dai **menu di rientro €29** (ogni volta) e dalla ri-conversione a piano pagante.
- Monetizza nel momento di massima motivazione (la cliente ha appena ripreso peso). Costo marginale ~zero (menu digitali dal suo storico).
- **Tono:** presentare i menu di rientro come *"il tuo kit di rientro, pronto quando ti serve"* — supportivo, mai punitivo ("paga o sei fuori").
