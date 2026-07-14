# Metabole — E1 (Agente Esclusioni, R8): decisioni (per Simone)

Risposta a `Metabole_E1_Agente_Esclusioni_Domande.md`. Le proposte di default sono corrette e sicure: **le confermo tutte**, con qualche affinamento. Q1 e Q2 (bloccanti) sono sciolte.

---

## Q1 — Riconoscimento allergene/alimento → **Opzione B (tag allergeni). Confermato.**
Sì ai **tag allergeni normalizzati** sulle ricette. Il match sul testo libero (Opzione A) è **vietato per le allergie**: troppo rischioso.
- **Lista:** i **14 allergeni UE** (glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta a guscio, sedano, senape, sesamo, solfiti, lupini, molluschi). Non aggiungiamo altro ora.
- **Chi tagga:** il **nutrizionista dal backoffice** (UI la predisponi tu).
- **Affinamento (per far prima):** al taggaggio, proponi un **pre-tag automatico** dedotto dagli `ingredients` (keyword → allergene) che il nutrizionista **conferma o corregge**. Riduce il lavoro manuale, ma la responsabilità resta sua (nessun auto-tag "silenzioso": deve confermare).
- **Gate di sicurezza:** un prodotto **non è attivabile per i clienti** finché le sue ricette non sono **taggate** e i gruppi di equivalenza **approvati**. Mettilo come check nel backoffice.

## Q2 — Derivati e tracce → **derivati via tag. Confermato.**
Sì: **un tag = alimento + tutti i suoi derivati** (allergia al `latte` ⇒ blocca burro/formaggi/panna/yogurt perché tutti taggati `latte`). Per l'allergia **basta la presenza del tag** per bloccare.
- **Tracce:** campo separato **rimandato a dopo l'MVP**. Per ora il tag principale basta.

## Q3 — Sostituzione ricetta vs ingrediente → **Opzione A. Confermato.**
Per l'MVP l'agente **filtra le ricette** (tiene solo quelle sicure): non genera piatti nuovi. La varietà arriva dalle **varianti già a catalogo** (salmone→sgombro sono già ricette). La generazione automatica di nuovi piatti (Opzione B) la rimandiamo: ogni variante andrebbe rivalidata dal nutrizionista.

## Q4 — Contenuto della base personale (`ClientMenuPool`) → **filtro su `recipeIds`. Confermato.**
`recipeIds` = tutte le ricette approvate del prodotto **meno** quelle non sicure per il cliente. Il motore compone le giornate pescando da qui (rispettando slot e kcal). Filtro sulle **ricette**, non sui template-giornata (più flessibile).

## Q5 — Veg/vegano e religione → **veg/vegano ora, religione dopo. Confermato.**
Usiamo `regime` (onnivoro/vegetariano/vegano) già raccolto. **Cultura/religione (halal/kosher…) rimandata** a una fase successiva con campo dedicato.
- **Nota prodotto:** il sito mostra icone kosher/halal come *supporto del nutrizionista*, non come filtro automatico del motore. Va bene per l'MVP (il nutrizionista gestisce a mano i casi religiosi), ma teniamolo a mente per non promettere un filtro che ancora non c'è.

## Q6 — Blocco + escalation (`diet_blocked`) → **confermato, con dettaglio sugli slot**
- **Granularità:** se **un solo slot principale** (colazione/pranzo/cena) resta senza opzioni sicure → si apre **`diet_blocked` a coach + nutrizionista**, la dieta **non parte**, il cliente vede il messaggio rassicurante. **Spuntini e merende** (opzionali, fuori dal bilancio) **non bloccano**: se scoperti, si omettono senza escalation.
- **Testo del messaggio al cliente** (IT ufficiale; da tradurre nelle lingue dell'app):
  > "Stiamo perfezionando il tuo menu insieme al tuo nutrizionista per renderlo **sicuro e su misura per te**. Ti avvisiamo appena è pronto."
  (No tempi precisi da promettere; tono caldo, niente allarme.)

## Q7 — Quando gira l'agente → **confermato entrambi**
- Alla **fine dell'onboarding** (scelta stile + assegnazione nutrizionista).
- Quando il cliente **aggiorna allergie/intolleranze/gusti**.
- **Pulsante "rigenera base"** per il nutrizionista: sì.
- **Aggiunta:** quando il nutrizionista **approva una nuova versione della base** del prodotto, segnala che le basi personali di quel prodotto sono da **rigenerare** (per l'MVP basta un flag/lista, non serve rigenerazione automatica di massa).

## Q8 — Soglia minima di varietà → **≥3 per slot principale, in `config_param`. Confermato.**
- **≥3 opzioni sicure per slot principale** (colazione/pranzo/cena) perché la dieta parta senza escalation.
- **Spuntini/merende:** soglia più bassa o nulla (sono opzionali) — parametro separato in `config_param`.
- Tutto in `config_param` così il nutrizionista capo lo cambia senza deploy.

---

## In sintesi (via libera a E1)
Puoi partire: **tag allergeni (14 UE) taggati dal nutrizionista** con pre-tag assistito, **derivati via tag**, **filtro ricette** (no generazione), **base personale = recipeIds sicuri**, **veg/vegano ora**, **blocco se un pasto principale è scoperto** con il messaggio sopra, run a fine onboarding/aggiornamento profilo + pulsante rigenera, **≥3 per slot in config_param**. Tutto additivo, testabile, isolato per prodotto.
Unico gate nuovo da aggiungere: **prodotto non attivabile per i clienti finché ricette non taggate + gruppi approvati.**
