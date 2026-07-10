# Metabole — Sequenza delle schermate (onboarding → app)

Documento di riferimento per lo sviluppo (frontend e backend). Descrive la **sequenza esatta** del
flusso di attivazione, cosa raccoglie ogni schermata e a quale **segnale del motore** serve.

Fonte di verità del frontend: `Metabole_Prototipo_Navigabile.html` (array `F`, costruito così:
3 pagine iniziali + `surveyFlow` + 6 pagine finali → totale **28 passi**). Il `surveyFlow` è
`intro sezione + domande` per ognuna delle 5 sezioni, nell'ordine
**Mente → Vita → Agenda → Gusto → Corpo**, seguito dalla pagina colore.

I 5 segnali del motore: **Mente (Testa), Vita, Agenda, Gusto, Corpo**. Le risposte del test
inizializzano questi segnali (vedi `Metabole_Coach_AI_e_Sondaggio.md` e
`Metabole_Specifica_Backend_Sviluppatore.md`).

---

## Sequenza completa (28 passi)

| # | Schermata | Tipo | Dati raccolti / azione | Segnale |
|---|---|---|---|---|
| 1 | **Benvenuto** | intro | Gaia si presenta. Pulsante "Entra in MetaboleAI" | — |
| 2 | **Crea il tuo account** | form | Nome, Cognome, Indirizzo (Via e n°, CAP, Città, Provincia), Email, Password, **Codice referral (refcod, facoltativo)**, oppure Apple/Google | — |
| 3 | **Facciamo conoscenza** | intro | Gaia elenca i 5 punti; 5 card colorate (Mente/Vita/Agenda/Gusto/Corpo) | — |
| 4 | **Intro sezione MENTE** (1/5) | intro sezione | Gaia introduce la sezione | — |
| 5 | **Come vuoi essere seguita?** | domanda | Frequenza follow: ogni giorno / quando serve / solo su richiesta | Mente |
| 6 | **Che tipo sei?** | domanda | Carattere: seguo bene / vado spronata / persevero da sola / tendo a mollare | Mente |
| 7 | **Intro sezione VITA** (2/5) | intro sezione | Gaia introduce la sezione | — |
| 8 | **La tua vita e il lavoro** | domanda | Lavoro, tempo per cucinare, dove pranzi nei feriali | Vita |
| 9 | **Che percorso preferisci?** | domanda | 3 pasti / 5 pasti / con integratori / digiuno intermittente | Vita |
| 10 | **Intro sezione AGENDA** (3/5) | intro sezione | Gaia introduce la sezione | — |
| 11 | **Periodi senza dieta** | domanda | Vacanze/feste/eventi/pause: periodi in cui non seguire la dieta | Agenda |
| 12 | **Intro sezione GUSTO** (4/5) | intro sezione | Gaia introduce la sezione | — |
| 13 | **Il tuo regime alimentare** | domanda | Onnivoro / Vegetariano / Vegano | Gusto |
| 14 | **Stile che preferisci** | domanda | Mediterranea / Proteica / Low-carb / Flessibile | Gusto |
| 15 | **Cibi che non ami** | domanda | Testo libero (esclusioni) | Gusto |
| 16 | **Intro sezione CORPO** (5/5) | intro sezione | Gaia introduce la sezione | — |
| 17 | **Chi sei** | domanda | Età, Altezza, Sesso (Nome già preso in registrazione) | Corpo |
| 18 | **Il tuo punto di partenza** | domanda | Peso, Vita, Fianchi (misure iniziali) | Corpo |
| 19 | **Intolleranze o allergie** | domanda (multi) | Nessuna / Glutine / Lattosio / Frutta secca / Altro | Corpo |
| 20 | **La tua salute** | domanda | Patologie, Farmaci → **dato sanitario: visibile solo al nutrizionista** | Corpo |
| 21 | **Il tuo obiettivo** | domanda | Kg da perdere, entro quante settimane, cm da perdere (guardrail sostenibilità) | Corpo |
| 22 | **Scegli il colore della tua app** | personalizzazione | Colore tema app (diverso dai colori delle sezioni) | — |
| 23 | **Il tuo percorso è pronto** | riepilogo | Percorso consigliato + Coach + Nutrizionista + data prima visita | — |
| 24 | **Scegli il tuo piano** | commerciale | Piano mensile (€99) / Percorso 3 mesi | — |
| 25 | **Riepilogo e pagamento** | pagamento | Metodo di pagamento, conferma | — |
| 26 | **Quando vuoi iniziare?** | data inizio | Data di partenza del piano | — |
| 27 | **Tutto pronto** | conferma | Menu visibile 2 giorni prima dell'inizio; poi → **Home** | — |
| 28 | **Il tuo menu è pronto** | consegna | Primi 2 giorni di menu; il resto dopo i check-in; → **Menu** | — |

---

## Note per il backend

- **Ordine sezioni del test**: Mente → Vita → Agenda → Gusto → Corpo (il Corpo/obiettivo è volutamente
  l'ultimo). Ogni sezione ha una schermata intro (non salva dati) seguita dalle sue domande.
- **refcod (passo 2)**: collega il cliente al commerciale di riferimento (CRM/provvigioni). Facoltativo;
  se il cliente arriva da un link `?ref=CODICE` va precompilato.
- **Dati sanitari (passo 20)**: cifrati, accessibili solo a cliente e suo nutrizionista (GDPR).
- **Obiettivo (passo 21)**: applicare il guardrail di sostenibilità (rate kg/settimana) come nel motore.
- **Consegna menu (passi 26–28)**: il piano parte da una data scelta; il menu diventa visibile
  2 giorni prima; all'avvio si consegnano solo i primi 2 giorni, il resto si sblocca con i check-in.
- **Gaia / voce**: è UX frontend (testo + audio TTS), non impatta il modello dati. I testi delle voci
  stanno in `tools/genera_voci_gaia.mjs` (chiavi audio) e negli MP3 in `audio/`.

## Dove guardare nel codice (frontend)

Nel file `Metabole_Prototipo_Navigabile.html`:
- `var SURVEY = [...]` — le domande del test (con il tag `sec` assegnato via `SECMAP`).
- `var SEC = {...}` e `var SECORD = ['testa','vita','agenda','gusto','corpo']` — sezioni, colori, ordine.
- `var surveyFlow` — assembla intro-sezione + domande nell'ordine di `SECORD`.
- `var F = [benvenuto, account, facciamo].concat(surveyFlow).concat([percorso, piano, pagamento, data, attesa, menu])` — la sequenza completa dei 28 passi.
- `function render()` — mostra `F[state.step]`; le intro di sezione usano `introHTML`, le domande `qh(...)`.
