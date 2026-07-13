# MetaboleAI — DIRETTIVA: replica esatta del prototipo nella web app

Per il team **Sviluppo** (Simone + la sua AI). Decisione presa: **il prototipo è la versione finale
dell'app cliente**. La web app deve **replicarlo 1:1**. Non reinventare, non "migliorare", non
parafrasare: **copiare esattamente**. Unica eccezione: il **sistema di pagamento**, che resta quello
della web app (già connesso alle API reali).

---

## 0. La regola d'oro

> **Fonte di verità unica: `docs/Metabole_Prototipo_Navigabile.html`.**
> Ogni schermata, testo, colore, ordine, popup e comportamento della web app deve **coincidere** con
> il prototipo. Se qualcosa nella web app diverge dal prototipo, **vince il prototipo** e si allinea la
> web app (mai il contrario).

**Unica eccezione — pagamento:** il checkout/abbonamento resta l'integrazione **Stripe già presente**
nella web app (API vere). Nel prototipo il pagamento è simulato: quando arrivi a quella schermata,
sostituisci la simulazione con il flusso Stripe reale, **ma la grafica e i testi attorno restano
quelli del prototipo**.

---

## 1. Cosa deve combaciare (checklist vincolante)

- [ ] **Le 5 sezioni** del questionario, in quest'ordine: **Mente · Vita · Agenda · Gusto · Corpo**.
- [ ] **I colori delle sezioni** (esatti, vedi §3).
- [ ] **I contenuti** di ogni schermata (testi, elenchi, card) — **verbatim** dal prototipo.
- [ ] **Le pagine** e il loro **ordine** (vedi §4: 34 schermate onboarding + Home).
- [ ] **Quello che Gaia dice** (voce) — dalle clip/`tools/genera_voci_gaia.mjs` (vedi §5).
- [ ] **Quello che Gaia scrive** (bolle/testi a schermo) — dal prototipo, con l'effetto "a macchina da scrivere".
- [ ] **La dashboard** (Home + sezioni: Menu, Percorso, Obiettivi, Contatti, Agenda, Shop, Profilo…).
- [ ] **I popup** (misure obbligatorie, check-in del mattino, fogli/sheet).
- [ ] **La disposizione** delle pagine e la **navigazione** (vedi §6).

---

## 2. Le fonti esatte (dove copiare, senza inventare)

1. **Struttura, layout e testi scritti** → il codice di `docs/Metabole_Prototipo_Navigabile.html`
   (leggilo e copia le stringhe **così come sono**).
2. **Quello che Gaia dice (audio)** → `tools/genera_voci_gaia.mjs` (**49 frasi**, una per chiave) e i
   file `audio/*.mp3` già generati. La chiave di una domanda è `q_<titolo-in-minuscolo>`; le altre hanno
   chiavi dedicate (benvenuto, registrazione, facciamo, colore, privacy, elaboro, percorso, coachvideo,
   nutrivideo, anteprima, piano, …).
3. **Colori, palette, sezioni** → i valori esatti in §3 (presi dal prototipo).

Regola: **niente testo o colore "a memoria"**. Se non è nel prototipo o nello script voce, **non
esiste**.

---

## 3. Valori esatti — colori & sezioni

**Sezioni del questionario (ordine `SECORD` = testa, vita, agenda, gusto, corpo):**

| Sezione | Tab | Colore | Sfondo tenue (pagine sezione) |
|---|---|---|---|
| La mente | Mente | `#6C4CD6` | `#F3EFFB` |
| La vita | Vita | `#2F80ED` | `#EDF3FE` |
| L'agenda | Agenda | `#E8543C` | `#FDF0EC` |
| Il gusto | Gusto | `#E8A11B` | `#FEF7E8` |
| Il corpo | Corpo | `#12A386` (brand) | `#EAF7F2` |

**Palette tema app (Profilo → scelta colore), 6 colori + "Auto":**
`#F2B807` (giallo) · `#E23B3B` (rosso) · `#E86FA6` (rosa) · `#2F80ED` (blu) · `#12A386` (verde/brand) ·
`#F2820A` (arancione) · **Auto** (colore nuovo ogni 2 giorni). Brand di default: **`#12A386`**.
La variabile CSS del tema è `--brand`.

---

## 4. Ordine esatto delle schermate onboarding (34 → Home)

1. Benvenuto (landing: MetaboleAI, card assistente Gaia, Accedi/Registrati, prove sociali)
2. In cosa siamo diversi (5 punti)
3. Crea il tuo account
4. Facciamo conoscenza (le 5 aree)
5. **[intro sezione] La mente**
6. Perché vuoi iniziare adesso?
7. Come vuoi essere seguita?
8. Quale caratteristica ti contraddistingue quando prendi un impegno?
9. **[intro sezione] La vita**
10. La tua vita e il lavoro
11. Che percorso preferisci?
12. **[intro sezione] L'agenda**
13. Periodi senza dieta
14. **[intro sezione] Il gusto**
15. Il tuo regime alimentare
16. Stile che preferisci *(lista prodotti dinamica dall'API; voce generica; caratteristiche al tocco)*
17. Cibi che non ami
18. **[intro sezione] Il corpo**
19. Come vuoi essere chiamata? *(Nome + **Età** + **Sesso: Uomo/Donna**, sempre visibili)*
20. Il tuo punto di partenza *(**Peso · Altezza · Vita · Fianchi**)*
21. Intolleranze o allergie
22. La tua salute *(patologie/farmaci → nutrizionista)*
23. Il tuo obiettivo *(slider peso + tempo, vita/fianchi; guardrail sostenibilità)*
24. Scegli il colore della tua app *(palette §3)*
25. **Trattamento dei dati personali** *(GDPR + consenso; voce: "Manca solo la tua approvazione…")*
26. [speciale] Sto cucendo il tuo percorso *(countdown ~10s)*
27. Il tuo percorso è pronto
28. La tua coach, Sara
29. Il tuo nutrizionista, dott.ssa Marini
30. Un assaggio del tuo menu
31. Scegli il tuo piano ⟶ **QUI il pagamento reale (Stripe della web app)**
32. Riepilogo
33. Quando vuoi iniziare?
34. Tutto pronto, Giulia! *(widget)* → **Home (app attiva)**

Il contatore "Passo N di 34" è **dinamico** (numero di schermate); se cambia il flusso, si aggiorna da sé.

---

## 5. Voce e testo di Gaia

- Ogni schermata ha una frase di Gaia: **scritta** (bolla, con effetto typewriter) e **parlata** (mp3).
- I testi parlati sono in `tools/genera_voci_gaia.mjs` (chiavi = §2). Le clip sono in `audio/`.
- Il testo scritto e quello parlato **coincidono** (a volte lo scritto ha grassetti; il parlato usa la
  pronuncia fonetica di "MetaboleAI" = *Metàbol Èi Ài*).
- Se manca una clip, l'app fa fallback alla sintesi vocale del browser, ma la **frase resta identica**.

---

## 6. Dashboard e navigazione (post-onboarding)

- **Nav bar (solo icone), ordine:** **Home · Percorso · Obiettivi · Contatti · Agenda**. Lo **Shop** è
  nelle icone dell'header (non nella tab bar). La tab attiva è in un quadrato teal rialzato.
- **Header comune** su tutte le schermate: banda teal ad angoli arrotondati con "METABOLEAI" + titolo +
  icone (notifiche, da-completare, shop, profilo).
- **Schermate (funzioni `S.*` nel prototipo):** `home`, `percorso`, `obiettivi`, `contatti`, `agenda`
  (calendario), `menu`, `ricetta`, `shop`, `profilo`, `notifiche`, `allert`.
- **Home:** "IL MENU DI OGGI" (carosello pasti + Spesa), "PROSSIMO APPUNTAMENTO", "GAIA · LA FRASE DI
  OGGI", + sezione "In arrivo" (eventi).
- **Popup:** misure obbligatorie (bloccante al 2° giorno del ciclo), check-in del mattino; fogli/sheet
  per notifiche/allert. Tutto come nel prototipo.

---

## 7. Metodo consigliato per la sua AI

1. **Apri e studia** `docs/Metabole_Prototipo_Navigabile.html` schermata per schermata (è un'unica SPA
   autonoma, tutto il vero è lì dentro: `SEC`, `SURVEY`, funzioni `S.*`, testi, popup).
2. **Replica in React** componente per componente, copiando **le stringhe esatte** e i colori esatti.
   Dove il prototipo usa dati finti (nomi, misure), collega i **dati reali** del backend.
3. **Non toccare** ordine, testi, colori, popup. L'unico punto dove sostituisci la logica è il
   **pagamento** (Stripe reale al passo 31).
4. **Verifica affiancando**: apri il prototipo e la web app fianco a fianco (vedi
   `Metabole_Confronto_App.html`) e controlla **ogni** schermata: devono essere indistinguibili
   (a parte i dati reali).

---

## 8. Criteri di accettazione (fatto = quando…)

- Ogni schermata dell'onboarding (1→34) e ogni sezione della dashboard è **identica** al prototipo per
  layout, testi, colori, ordine.
- Le 5 sezioni e i loro colori coincidono (§3).
- Gaia dice e scrive **esattamente** le frasi del prototipo/script voce.
- I popup e la navigazione coincidono.
- Il **pagamento** funziona con Stripe reale, dentro la grafica del prototipo.

---

## 9. PROMPT PRONTO da incollare all'AI di Simone

```
Tratta il file docs/Metabole_Prototipo_Navigabile.html come la SPECIFICA DEFINITIVA e la fonte di
verità unica dell'app cliente. Il tuo compito è allineare la web app React perché sia una replica
1:1 del prototipo: stesse schermate, stesso ordine, stessi testi (verbatim), stessi colori, stesse
sezioni (Mente/Vita/Agenda/Gusto/Corpo), stessa navigazione (Home·Percorso·Obiettivi·Contatti·Agenda,
Shop nell'header), stessi popup, stessa dashboard, stesse frasi di Gaia (scritte e parlate — i testi
parlati sono in tools/genera_voci_gaia.mjs, le clip in audio/).

Regole:
1. Non reinventare e non migliorare: se la web app diverge dal prototipo, allinea la web app al prototipo.
2. Copia le stringhe e i colori ESATTI dal prototipo, mai a memoria.
3. Dove il prototipo usa dati finti, collega i dati reali del backend.
4. UNICA eccezione: il pagamento. Mantieni l'integrazione Stripe reale già presente nella web app, ma
   la grafica e i testi attorno al checkout devono restare quelli del prototipo (schermata "Scegli il
   tuo piano").
5. Non modificare l'ordine delle schermate né i testi di Gaia.

Procedi schermata per schermata seguendo l'ordine del documento Metabole_Direttiva_Replica_Prototipo.md
(§4). Alla fine, verifica affiancando prototipo e web app: devono essere indistinguibili, a parte i
dati reali e il pagamento vero. Aggiorna progetto/REGISTRO.md marcando [Sviluppo] ad ogni schermata
allineata.
```

## In una riga

Il prototipo `docs/Metabole_Prototipo_Navigabile.html` **è** l'app finale: replicalo 1:1 (sezioni,
colori, testi, pagine, Gaia, dashboard, popup, navigazione), copiando le stringhe esatte; l'**unica**
cosa che prendi dalla web app è il **pagamento Stripe reale**.
