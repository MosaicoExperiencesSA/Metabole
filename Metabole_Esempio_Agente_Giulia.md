# Esempio — l'agente AI in azione (Giulia, 6 giorni / 3 cicli)

Simulazione della dieta **mediterranea** personalizzata per **Giulia Rossi**. Serve a vedere come
ragiona l'agente con la cadenza **a 2 giorni** (stessi menu, cottura diversa), l'umore, un evento e una
segnalazione.

**Setup cliente**
- Regime: mediterranea · stagione: **Estate** · porzioni **standard** (niente fame).
- Obiettivo: −6 kg / −8 cm in 18 settimane (ritmo sostenibile).
- Esclusioni: **intollerante al lattosio**, **allergica alla frutta secca**, **non mangia funghi**.
  → l'agente propone solo menu sicuri (latticini "senza lattosio", niente frutta secca; d'estate i
  funghi non ci sono comunque).

---

## Ciclo 1 · giorni 1–2 — stato NORMALE

L'agente massimizza *efficacia × gradimento*. Stessi menu per i 2 giorni, **cotti in modo diverso**.

| Pasto | Menu (uguale nei 2 giorni) | Giorno 1 (ricetta) | Giorno 2 (ricetta) |
|---|---|---|---|
| Colazione | Yogurt greco *senza lattosio*, avena e pesche | Overnight oats con pesche (freddo) | In ciotola con pesche a pezzi e avena |
| Pranzo | Farro con zucchine | Insalata fredda di farro con zucchine (da portare) | Farro saltato in padella con zucchine e olio evo |
| Cena | Pollo con zucchine | Pollo a fettine in padella con zucchine trifolate | Pollo al forno con erbe e zucchine grigliate |

- Check-in: umore **sereno**; seguito **sì / sì**; misure a fine ciclo.
- **Esito ciclo:** peso **−0,3 kg**, cm **−0,5** → *perso / perso*. L'agente rinforza questi menu.

## Ciclo 2 · giorni 3–4 — stato CONFORTO (umore basso)

Check-in del giorno 3: umore **triste**. L'agente passa a **Conforto**: compone il ciclo coi menu
**più amati** da Giulia (pasta al pomodoro, branzino), anche se meno "dimagranti", per risollevarla.

| Pasto | Menu (più amato) | Giorno 3 | Giorno 4 |
|---|---|---|---|
| Colazione | Pane integrale, olio evo e pomodoro | Bruschetta (pane tostato, olio, pomodoro) | Pan con tomate (pomodoro grattugiato) |
| Pranzo | Pasta al pomodoro fresco e basilico ★★★★★ | Con basilico fresco | Con pomodorini e olio a crudo |
| Cena | Branzino con pomodori | Branzino al cartoccio | Branzino in padella con prezzemolo |

- Seguito: **giorno 3 sì**, **giorno 4 no** (Giulia salta). Esito ciclo: **n.d.** (non seguito pieno).
- **Segnalazione → COACH** (`mood_risk` + `low_adherence`): umore basso e un giorno non seguito. La
  coach interviene con un messaggio motivazionale. *(Nessun tema clinico → il nutrizionista non è
  coinvolto.)*

## Ciclo 3 · giorni 5–6 — stato RIENTRO + PRE-EVENTO

Due fattori insieme: viene **dopo un Conforto** (→ Rientro) e in agenda c'è un **matrimonio tra 3
giorni** in cui Giulia non vuole "fare dieta" (→ Pre-evento). L'agente compone un ciclo **più proteico
ed efficace**, per rimetterla in linea e farla arrivare leggera all'evento.

| Pasto | Menu (proteico/efficace) | Giorno 5 | Giorno 6 |
|---|---|---|---|
| Colazione | Yogurt greco *senza lattosio* con pesche | Frullato di yogurt e pesche | Yogurt con pesche a pezzi |
| Pranzo | Ceci con pomodori (legumi) | Insalata fredda di ceci con pomodori (da portare) | Ceci saltati con aglio, olio e pomodori |
| Cena | Orata con fagiolini | Orata al forno con erbe e limone, fagiolini al vapore | Orata all'acqua pazza con fagiolini saltati |

- Check-in: umore **risalito**; seguito **sì / sì**.
- **Esito ciclo:** peso **−0,4 kg**, cm **−0,6** → *perso / perso*. Rientro riuscito.

---

## Cosa ha fatto l'agente (riassunto)

- **Stessi menu per 2 giorni, cotti diversamente** in ogni ciclo (varietà senza cambiare la base).
- **Ciclo 1 Normale:** menu efficaci e graditi → cala.
- **Ciclo 2 Conforto:** umore triste → menu più amati per non farla mollare; il giorno non seguito +
  umore basso → **avvisa la coach**.
- **Ciclo 3 Rientro + Pre-evento:** più proteico ed efficace → rientro e preparazione all'evento.
- **Sicurezza sempre prima di tutto** (niente lattosio/frutta secca/funghi); **obiettivo peso** come
  bussola; **piacere** come leva di aderenza; **segnalazioni** quando le cose non vanno.

*(Le kcal restano interne al bilanciamento, non sono mostrate a Giulia. Tutte le soglie — giorni di
conforto, giorni di pre-evento, pesi efficacia/gradimento — sono in config_param.)*
