# Da riprendere — 14/8/2026

> Scritto la sera del 13/8, a giornata chiusa, per la sessione nuova. **Ordine di lettura**: questo
> file → `CLAUDE.md` (le regole di lavoro e le trappole) → `Decisioni_Simone_20260813.md` §12-§16
> (le decisioni di ieri) → la pagina Lavori nel backoffice (lo stato vivo). Per Vera:
> `HANDOFF_Vera_Sessione.md` PRIMA di toccare `backend/src/vera/` — metà delle scelte strane lì
> dentro sono difetti già pagati.

## Le regole ferree (valgono sempre)

1. **Verifica nel codice, non nei documenti.** Se divergono, ha ragione il codice — e lo dici.
2. **File condivisi** (`schema.prisma`, `REGISTRO.md`, `COMMIT.txt`, `voci-iniziali.ts`): rileggi
   dal Mac e applica sopra. MAI sovrascrivere con una tua copia.
3. **Mai comandi git sulla cartella montata** (lascia index.lock). **Mai archivi nel repo.**
4. **Ogni consegna**: COMMIT di parte (`COMMIT_parte_<argomento>.txt`) + append a `COMMIT.txt` +
   voce in `REGISTRO.md` (in cima) + Summary e Description in chat per la push di Simone.
5. **Le decisioni si scrivono in un documento PRIMA del codice.**
6. **Test nuovi visti ROSSI prima che passino.** Catena sul Mac (la lancia Simone):
   `npm run prisma:tipi && npm run typecheck && npx jest` (+ `npm run build` nel backoffice se toccato).
7. **I lavori si chiudono nel file**: `voci-iniziali.ts` ha il campo `fatta: true` — il caricamento
   spunta in pagina le voci che il file dichiara finite, MAI il contrario.

## Stato al 13/8 sera

**Baseline: 2672 test verdi su 184 suite** verificati sul Mac, typecheck a zero (restano i 2 errori
pre-esistenti di `prisma/approve-diets.ts` e `dedupe-diets.ts` col tsc completo).

⚠️ **UN BATCH NON ANCORA VERIFICATO/PUSHATO**: il fix «il saluto davanti non spiazza» («Ciao Vera,
hai la lista…?») + la voce 237. È nel working tree, 305 verdi su Vera in locale, ma la catena
completa sul Mac non è girata. PRIMA COSA della sessione: farla girare (~2675 attesi) e push.
Summary: `Vera: il saluto davanti non spiazza («Ciao Vera, …»)`.

**In produzione da ieri**: OTA 2.1.8 (scheda allergie in home, esclusioni nel profilo), pagina
Colazioni (2653 ricette; blocchi confermati: ~986 salate + ~1195 dolci; restano ~470 senza
proposta per Lucia, coi pulsanti «Selezione → salate/dolci»), tutti i ROSSI della pagina Lavori
chiusi, «serve la visita» automatico (criteri Nocanty §15), campagna allergie PRONTA e non lanciata,
`ai_assistant_enabled` ACCESO da Simone, Vera: battesimo robusto (2ª persona), «togli lo spuntino»,
famiglie a secco («hai/crea la lista dei…»), email conflitto ai capi, report mensile automatico.
Nocanty ha già dettato i formaggi molli (15 voci nel dizionario).

## STAMATTINA ALLE 11 — LA CAMPAGNA (promemoria automatico alle 10:55 nella VECCHIA chat)

Shell di Render (`~/project/src/backend`), nell'ordine, prima in prova e letti riga per riga:
1. `npm run chiedi:allergie` → attese 3 (Maria/Carboidrati, Mariastella/Favismo, Patrizia/…),
   poi `CONFERMA=1 npm run chiedi:allergie` (manda anche la push vera).
2. `npm run avvisa:allergie` → attesi ~45, poi `CONFERMA=1 npm run avvisa:allergie`.
⚠️ Chi non ha aggiornato l'app riceve la push ma il tocco non apre scheda/dialogo, e la notifica
vale «già chiesto». ⚠️ Verificare prima che l'OTA 2.1.8 risulti sui telefoni (doppio riavvio).

## La coda, in ordine

1. **Crudo/cotto (Decisioni §16 — deciso, solo da scrivere, A MENTE FRESCA: tocca i numeri nel
   piatto)**: default crudo nella ricerca per nome di `valori-nutrizionali`, domanda in
   `ricetta-dettata` sopra il 30% di scarto, import delle 44 righe del PDF di Nocanty
   («comparazione_nutrizionale_crudo_cotto»), poi l'indice glicemico (§10: confermato di default).
2. **§15.2 punto 1**: la domanda è stata tradotta e girata a Nocanty (percentuale standard + tetto
   della correzione calorica). Quando risponde: campo `kcalAdjustPct` in `kcal-need.service`,
   DOPO il deficit e PRIMA del pavimento 1200.
3. **Voce 237**: chat di Vera ridimensionabile (`backoffice/src/pages/Vera.tsx`, oggi
   min(72vh,640px); trascinamento + altezza ricordata).
4. **«A colazione qualcosa di salato»** (azione 3, frase 2): si accende quando le conferme di Lucia
   bastano — i tag `piatto:salato` ci sono già, manca il filtro di slot per-cliente e la frase in
   `capisci.ts` (⚠️ rileggere PRIMA `GET /vera/corpus`).
5. **«Più proteine»** (azione 3, frase 3): decisione di Simone — banda assoluta o spostamento
   relativo.
6. **Voce 235 parte app**: `pastiEsclusi` visibile nel profilo dell'app (va con la prossima OTA).
7. **Azione 6** (esclusioni a livello di DIETA nel motore): il pezzo grosso — `ProductRule` +
   `buildScoringContext`/`evaluateMeals`. Mai di sera.
8. Grandi lavori di Vera dalla visione di Simone: correggere i valori nutrizionali a voce,
   correggere i protocolli su approvazione del capo.

## Controlli sparsi

- `npm run conta:allergie` fra qualche giorno: la popolazione 3 (24) deve scendere da sola.
- 19/8: rimuovere `traccia-diet-family` (tre file).
- Alla 2.2.0: iOS deployment target 15 (via `scripts/install-ios.mjs`).
- Le voci doppie di Vera in pagina (se ci sono ancora) si spuntano a mano, non si rilancia il carico.
