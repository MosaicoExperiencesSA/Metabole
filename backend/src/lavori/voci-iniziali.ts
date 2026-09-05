/**
 * LE VOCI DI PARTENZA DELLA PAGINA «LAVORI» — una lista sola, letta da due posti.
 *
 * Stava dentro `prisma/carica-lavori.ts`. È qui perché dal 13/8 la stessa lista serve anche al
 * pulsante «Carica le voci nuove» nella pagina: ⚠️ se il pulsante ne avesse una copia, fra un mese la
 * shell e la pagina caricherebbero due elenchi diversi — ed è la stessa ragione per cui la conta
 * delle allergie e la campagna usano `common/da-ricontattare.ts` invece di due query gemelle.
 *
 * ⚠️ Aggiungere una voce qui NON la fa comparire in produzione: serve un rilascio. Le voci nate
 * dall'uso si scrivono dalla pagina, che è più veloce di noi.
 *
 * ⚠️ Lo STORICO (le 481 righe estratte dal REGISTRO) resta nello script e non entra qui: vive in un
 * file JSON accanto a lui, che in `dist/` non c'è. Un pulsante che dipende da un file che in
 * produzione può non esserci è un pulsante che fallisce proprio il giorno che serve.
 */

export type Voce = {
  chiave: string; titolo: string; dettaglio: string; categoria: string; ordine: number;
  /** ⚠️ Il rosso della pagina: «finché questa non si chiude, dietro c'è una fila ferma». Non «urgente». */
  blocca?: boolean;
  /**
   * IL LAVORO È FINITO (richiesta di Simone, 13/8 sera). Il caricamento SPUNTA la voce in pagina
   * se è ancora aperta — mai il contrario: una spunta tolta a mano non viene riaperta dal file.
   * Così il file resta l'unico posto da aggiornare quando una consegna chiude un lavoro.
   */
  fatta?: boolean;
  /**
   * ⚠️ **Spunta se c'è, ma NON crearla.**
   *
   * Serve a un caso solo, e nasce dalla voce 224: il 13/8 le voci di Vera sono finite due volte nel
   * file, con chiavi diverse per le stesse cose. Il doppione è stato tolto da qui, ma se il
   * caricamento era già girato in mezzo quelle righe sono rimaste **in pagina**, aperte, a
   * duplicare voci che esistono già con un'altra chiave.
   *
   * Marcarle `fatta: true` e basta le spunterebbe — ma se in pagina non ci fossero, il caricamento
   * le **creerebbe**: tre voci nuove già spuntate, cioè spazzatura scritta per pulire spazzatura.
   * Con questo campo il file può dire «questa non è un lavoro, è una riga da chiudere: se la trovi
   * spuntala, altrimenti non è mai esistita».
   */
  soloSeEsiste?: boolean;
  /**
   * QUANDO È NATO IL PUNTO — data e ora, in ISO locale (`'2026-08-19T12:07'`).
   *
   * Richiesta di Simone, 19/8: «voglio che mi segni nell'elenco lavori la data e ora di creazione di
   * quel punto altrimenti non capisco nulla». ⚠️ `createdAt` non risponde: le voci del file entrano
   * tutte insieme al clic su «Aggiorna dal rilascio», quindi cento voci nate in due settimane
   * risulterebbero create nello stesso minuto.
   *
   * ⚠️ **Si scrive solo dove la data si sa davvero** — dal REGISTRO, dal commit o dal testo della
   * voce stessa. Dove non si sa si lascia vuoto e la pagina dice «in elenco dal …», che è un fatto
   * diverso: inventare una data plausibile per riempire una colonna è il modo più veloce di rendere
   * inutile tutta la colonna.
   */
  nata?: string;
  /**
   * La priorità **iniziale**, solo per le voci nuove.
   *
   * ⚠️ **Non riallinea mai una voce già in elenco.** La priorità la dà Simone dalla pagina: un file
   * che gliela riscrive a ogni rilascio gli toglierebbe di mano l'unica leva che ha chiesto — e in
   * silenzio, che è la parte peggiore. Qui serve a un caso solo: una voce che nasce da una revisione
   * mia entra **bassa**, perché l'ha decisa lui il 19/8 («se trovi qualche cosa lo aggiungi in lista
   * con priorità bassa»), non perché io la ritenga meno importante.
   */
  priorita?: 'alta' | 'neutra' | 'bassa';
};

/**
 * Le categorie: servono a separare il lavoro FERMO da quello da fare. In un elenco misto una
 * decisione clinica in attesa sembra codice non scritto.
 */
export const NOCANTY = 'Aspetta Nocanty';
export const SIMONE = 'Aspetta Simone';
export const CODICE = 'Da fare — codice';
export const MANUTENZIONE = 'Manutenzione';
export const DATI = 'Dati e catalogo';
/**
 * ⚠️ **«Aspetta il paniere» è una categoria, non un rinvio generico** (27/8). Il rifacimento del
 * catalogo (`progetto/PIANO_Panieri_Ricette.md`) rimescola le ricette: un lavoro che si misura sul
 * catalogo di oggi, fatto adesso, andrebbe rifatto dopo — e lasciarlo in «Da fare» lo fa sembrare
 * dimenticato invece che sospeso. Chiuderlo sarebbe peggio: si perderebbe.
 */
export const PANIERE = 'Aspetta il paniere';

export const VOCI_INIZIALI: Voce[] = [
  {
    chiave: 'equivalenze-un-nome-un-gruppo',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-09-04T16:00',
    titolo: '\u2705 Gruppi di equivalenza: da 2848 a 1105, un nome un gruppo \u2014 UNIONE FATTA',
    dettaglio:
      'Lo script `ripara:equivalenze-omonime` \u00e8 stato lanciato in produzione da Simone il 4/9, dopo la '
      + 'prova a vuoto. I numeri della prova a vuoto, che \u00e8 quello che lo script si preparava a fare:\n\n'
      + '```\n'
      + 'Gruppi in tabella                      2848\n'
      + 'Legati a una dieta (diventano globali) 2821\n'
      + 'Nomi che compaiono piu di una volta     257\n'
      + 'Righe che spariscono                   1743\n'
      + 'Restano                                1105\n'
      + 'Famiglie ferme (pesi diversi)             0\n'
      + '```\n\n'
      + '\u2705 **La riserva pi\u00f9 grossa \u00e8 caduta, e l\u2019ha detta il tabulato.** Il blocco \u00abN alimenti che '
      + 'stavano SOLO in gruppi in bozza entrano in gruppi approvati\u00bb **non \u00e8 stato stampato**, e si stampa '
      + 'solo se \u00e8 maggiore di zero: nessun alimento mai validato \u00e8 entrato nel motore. Tutte e 257 le '
      + 'famiglie escono \u00abapprovato\u00bb perch\u00e9 quei gruppi erano gi\u00e0 stati approvati **in blocco** dal '
      + 'pulsante del wizard, dieta per dieta \u2014 lo stesso pulsante che questa consegna ha tolto.\n\n'
      + '\u2705 **Zero famiglie ferme**: nessun conflitto fra tabelle di pesi, e la tabella dei grassi firmata '
      + 'da Nocanty \u00e8 passata intatta.\n\n'
      + '\u26a0\ufe0f **QUELLO CHE RESTA DA GUARDARE, e sono decisioni di nutrizione, non di pulizia.**\n\n'
      + '\u00b7 **Tre elenchi molto lunghi**, che adesso sono tre righe sole in pagina: \u00abCereali integrali\u00bb '
      + '**66 alimenti** (da 171 gruppi), \u00abVerdure a foglia verde\u00bb 46 (da 82), \u00abProteine vegetali\u00bb 45 '
      + '(da 36). \u26d4 Il primo dice al motore che quinoa, grano saraceno e riso si scambiano con **farro e '
      + 'orzo**, che hanno il glutine; il terzo mette **seitan** insieme a tofu e tempeh. Chi il glutine lo ha '
      + 'dichiarato \u00e8 protetto dalle intolleranze, chi non lo ha dichiarato riceve lo scambio.\n'
      + '\u00b7 **1105 non sono 1105 gruppi diversi**: dentro ci sono i sinonimi che la normalizzazione non tocca '
      + 'apposta \u2014 \u00abVerdure **cru**cifere\u00bb e \u00abVerdure **cro**cifere\u00bb sono un refuso e sono 70 gruppi in '
      + 'due, e la frutta secca ha **sette** nomi (\u00abFrutta secca\u00bb, \u00ab\u2026 e semi\u00bb, \u00abSemi e \u2026\u00bb, \u00ab\u2026 '
      + 'oleosa\u00bb, \u00ab\u2026 proteica\u00bb, \u00abNoci e semi\u00bb, \u00abSemi oleosi\u00bb). Si uniscono **a mano** dal backoffice, '
      + 'una decisione per volta: allargare la normalizzazione unirebbe anche \u00abBevande vegetali\u00bb e '
      + '\u00abBevande vegetali **non zuccherate**\u00bb, che sono due gruppi diversi apposta.\n'
      + '\u00b7 Da oggi la domanda dell\u2019accorpamento impedisce che se ne creino altri: \u00e8 la met\u00e0 che tiene '
      + 'pulito, e senza di lei fra sei mesi la pagina sarebbe di nuovo com\u2019era.\n\n'
      + '\u26a0\ufe0f **Il tabulato della SCRITTURA non l\u2019ho letto**: i quattro conti finali (famiglie unite, gruppi '
      + 'cancellati, righe di sostituzione ripuntate, gruppi resi globali) li stampa lo script alla fine, '
      + 'anche se si interrompe a met\u00e0. Se divergono da 257 / 1743, questa riga va corretta.',
  },
  {
    chiave: 'allergeni-formaggi-e-pescato-mancanti',
    fatta: true,
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-09-04T16:00',
    titolo: '⛔ Il vocabolario degli allergeni non conosce taleggio, robiola, fontina — né «seppie»',
    dettaglio:
      'Trovato **misurando** il cancello del regime, il 4/9, e non è un difetto del cancello: è un '
      + 'buco in `menu/exclusions.ts`, che è la porta degli **allergeni**.\n\n'
      + '`exclusionKeys([\'latticini\'])` non riconosce: `philadelphia`, `robiola`, `crescenza`, '
      + '`taleggio`, `fontina`, `asiago`, `emmental`, `caciotta`, `skyr`. E il vocabolario del pesce '
      + 'non riconosce `frutti di mare` né `seppie`.\n\n'
      + '⛔ **Vuol dire che una cliente allergica al latte può ricevere un piatto col taleggio**, e una '
      + 'allergica ai molluschi un piatto con le seppie: `hitsExclusion` non li vede, quindi il piatto '
      + 'non le viene tolto. È più grave del motivo per cui li ho trovati.\n\n'
      + '⚠️ **Non si è corretto insieme alla consegna del 4/9, ed è voluto**: allargare il vocabolario '
      + 'degli allergeni cambia i menu di tutte le clienti che hanno dichiarato quell\'allergia, e va '
      + 'fatto misurando prima (`npm run diag:allergeni-mancanti`), con la sua consegna. Farlo salire '
      + 'a bordo di un\'altra vorrebbe dire scrivere su ventitremila ricette senza avere i numeri — è '
      + 'la stessa regola del 31/8 sui latti vegetali.\n\n'
      + '⚠️ Nel frattempo il cancello del regime ha il **suo** elenco, in `menu/regime-del-candidato.ts`, '
      + 'che vale solo lì: è l\'unico posto dove un elenco largo è la scelta prudente, perché un falso '
      + 'positivo toglie una proposta e non mette niente nel piatto.\n\n'
      + '\u26d4 **E il 4/9 l\u2019unione ha messo la prova nero su bianco**: fra i gruppi che restano c\u2019\u00e8 '
      + '\u00abMolluschi\u00bb, approvato, con dentro `vongole, cozze, polpo, calamari, **seppie**, capasante, polpa '
      + 'di granchio, calamaretti`. Le seppie stanno in un gruppo che si chiama Molluschi e il vocabolario '
      + 'degli allergeni non le riconosce come molluschi: chi \u00e8 allergica non si vede togliere quei piatti. '
      + 'Non \u00e8 un difetto nato oggi, ma da oggi \u00e8 scritto dove si legge.'
      + '\n\n✅ **LO STRUMENTO C\'È (5/9): `npm run diag:vocabolario-allergeni`**, sola lettura, col giudizio in `catalog/vocabolario-allergeni.ts` e le sue prove. Tre conti: le parole candidate (taleggio, robiola, crescenza, fontina, asiago, emmental, caciotta, skyr, philadelphia, scamorza, burrata, provola, squacquerone, quark, montasio, groviera, gouda…; seppie, capasante, frutti di mare, lumache, fasolari, telline, cannolicchi; canocchie, cicale di mare, granseola) con quante ricette le hanno **senza il tag**; le forme «senza ‹allergene›» col tag lo stesso; e quanto divergono i due vocabolari.\n⛔ **E la divergenza è più grossa di taleggio e seppie, misurata sul codice**: sul **pesce** i tag conoscono **15 parole** e le esclusioni **67** — cernia, spigola, dentice, sardine, bottarga, sushi… Una ricetta con la cernia oggi non porta il tag `pesce`: la porta delle esclusioni la toglie, quella dei tag (la base personale di chi ha allergie) no. E i vocabolari sono **tre**, non due: `piatto-di-cosa.ts` ha il suo per carne e pesce. ⚠️ «edam» non è fra i candidati: sta dentro «edamame».\n▶️ **Con i numeri si decide l\'unificazione** — un vocabolario solo da cui i tag e le esclusioni leggono — e la riparazione dei tag mancanti (aggiungere, mai togliere, come `ripara:allergeni-chiave`).'
      + '\n\n✅ **CHIUSA NEL CODICE il 5/9: i vocabolari sono UNO.** Non un elenco allungato a mano (era la risposta di sempre, e Simone ha ragione: «continuiamo ad avere questo problema»): da oggi `EU_ALLERGENS` legge **anche tutte le parole di `INTOLERANCE_MAP`** (`conLeEsclusioni` in `catalog/allergens.ts`, con `CHIAVE_ESCLUSIONE` che dice quale chiave delle esclusioni corrisponde a ogni allergene UE). Una parola aggiunta alle esclusioni vale da sola anche per i tag, e una prova (`vocabolario-allergeni.spec`, «nessuna parola sta SOLO nelle esclusioni») lo tiene fermo. Taleggio, robiola, crescenza, fontina, asiago, emmental, caciotta, skyr, philadelphia, squacquerone, quark, montasio, groviera, gouda, latticello, caseina, formaggino, fiocchi di latte, provolone; seppie, capasante, frutti di mare, lumache, fasolari, telline, cannolicchi; canocchie, cicale di mare, granseola; e la meringa fra le uova: stanno nelle esclusioni, quindi in tutti e due. «Frutti di mare» vale crostacei **e** molluschi anche nella chat. ⚠️ Due radici corte tolte apposta: «edam» (dentro edamame) e «tellin» (dentro tortellini, trovato dal tabulato).\n▶️ **Resta un comando, una volta sola**: `npm run ripara:allergeni-mancanti` (sola lettura) e poi `CONFERMA=1 npm run ripara:allergeni-mancanti`: **aggiunge** i tag che la deduzione unificata trova e la ricetta non ha (misurati il 5/9: 224 sulle parole candidate + 616 sul pesce — sardine 140, dentice 132, spigola 66…), **mai toglie**, salta le ricette toccate a mano (registro `catalog.recipe.allergens.set`) e non tocca `allergensReviewed`. Dopo, `diag:vocabolario-allergeni` tabella 1 deve dare zero — e da lì in poi la notte, quando ne nasce una, la porta unica la tagga da sola. ⚠️ Il terzo vocabolario (`piatto-di-cosa.ts`, carne e pesce per il regime) resta suo, dichiarato: là un falso positivo toglie una proposta, non mette niente nel piatto.',
  },
  {
    chiave: 'attiva-un-piano-non-e-nei-permessi',
    categoria: CODICE,
    fatta: true,
    ordine: 0,
    nata: '2026-09-04T23:55',
    titolo: '✅ «Attiva un piano» adesso è una casella dei Permessi, non un ruolo',
    dettaglio:
      'Simone, 4/9: *«va gestito nei ruoli»*. Controllato, ed è vero.\n\n'
      + '· il pulsante nella scheda cliente sta dentro un `if (isAdmin)` scritto a mano '
      + '(`ClientDetail.tsx`);\n'
      + '· la rotta sotto — `POST /admin/purchases` — è protetta da **`@Roles(\'admin\')`**, cioè dal '
      + 'ruolo, non da una casella;\n'
      + '· la classe ha `@RequirePage(\'purchases\')`, ma quella è la chiave della **pagina Acquisti** '
      + 'in sola vista: governa chi vede l\'elenco, non chi attiva un piano.\n\n'
      + '⛔ Quindi quel potere non si può dare al capo nutrizionista senza farne un admin, né '
      + 'togliere a un admin. ⚠️ È il gemello rovesciato del difetto del 3/9: lì 29 caselle spengono '
      + 'il menu e non la porta, qui c\'è **una porta senza nessuna casella**.\n\n'
      + '**Serve, e sono i tre passi di `CLAUDE.md`, tutti e tre:** la chiave `attiva_piano` in '
      + '`permissions/pages.ts` coi default di ruolo · l\'etichetta in `labels.ts` · la guardia '
      + '`@RequirePage(\'attiva_piano\', \'manage\')` sulla rotta **e** il pulsante che legge quella '
      + 'casella invece di `isAdmin`, con `@Roles` sotto come rete.\n\n'
      + '⚠️ **Una decisione di Simone dentro**: la finestra legge anche `GET /admin/purchases/plans`, '
      + 'oggi `@Roles(\'admin\',\'sales\')`. Dando la casella a qualcun altro, quella lettura risponde '
      + '**403** e la finestra si apre vuota.\n\n'
      + '✅ **CHIUSA il 4/9 sera**, coi tre passi: la chiave `attiva_piano`, l\'etichetta, e la '
      + 'guardia `@RequirePage(\'attiva_piano\', \'manage\')` sulla scrittura **più** il pulsante che '
      + 'legge la casella invece del ruolo. ✅ E **la stessa chiave sulla lettura dei piani**, in sola '
      + 'vista: senza, il permesso sarebbe un interruttore che non accende niente.\n\n'
      + '⛔ **La consegna sposta il cancello, non lo apre**: il default resta **solo admin**, '
      + 'esattamente com\'era. ⚠️ E la chiave **non eredita** da `purchases` — quella in sola vista ce '
      + 'l\'hanno coach, coordinatrici e nutrizioniste, quindi ereditare vorrebbe dire **darla a '
      + 'tutte**: l\'ereditarietà serve a «separare una schermata non toglie accesso a nessuno», non '
      + 'a darne. Una prova tiene ferme tutte e due le cose.\n\n'
      + '⚠️ Il conto delle chiavi senza guardia resta **43**, su **67** invece che su 66: la chiave '
      + 'nuova nasce **con** la guardia che la legge.',
  },

  {
    chiave: 'due-sessioni-si-sovrascrivono',
    fatta: true,
    categoria: SIMONE,
    ordine: 0,
    nata: '2026-09-04T23:59',
    titolo: '⛔ Due sessioni che committano file interi si cancellano a vicenda: successo TRE volte il 4/9',
    dettaglio:
      '⛔ **Misurato, non dedotto.** Il 4/9 `origin/main` è passato di mano tre volte fra due '
      + 'sessioni che lavoravano in parallelo — `ad7272d`, `1cb87fa`, `57ae018` — e ogni volta chi '
      + 'committava per secondo ha ricommesso **file interi** costruiti su una base precedente.\n\n'
      + '**Cosa è costato, in ordine di gravità:**\n'
      + '· ⛔ **`57ae018` ha cancellato i due cancelli appena messi** su `catalog.service.ts`: '
      + 'l\'elenco ingredienti vuoto non bloccava più, e il regime smentito non chiedeva più '
      + 'conferma. Più lo script `ripara:allergeni-chiave` da `package.json` e il `catch` che fa '
      + 'rispondere Vera. **La CI di `origin/main` era rossa** — sette test — e la voce esiste anche '
      + 'per questo: *le prove hanno salvato i due cancelli, e senza sarebbero spariti in silenzio*.\n'
      + '· ⛔ **Mezza giornata di lavoro buttata**: la creazione della ricetta nuova dal menu a mano '
      + 'è stata scritta due volte, da due sessioni, e la seconda se n\'è accorta solo alla consegna. '
      + 'Quella copia è stata gettata.\n\n'
      + '⚠️ **Non è un problema di chi scrive**, ed è il motivo per cui questa voce è di Simone e non '
      + 'di codice: due sessioni sullo stesso repository si accorgono l\'una dell\'altra **solo** '
      + 'leggendo `origin/main`, e fra la lettura e la consegna passa il tempo del lavoro.\n\n'
      + '**Le strade, da scegliere:** **(a)** dire a ogni sessione, all\'inizio, su cosa lavora '
      + 'l\'altra — costa una riga e chiude il caso del doppione; **(b)** dividere per file o per '
      + 'area, così due consegne non toccano mai lo stesso sorgente; **(c)** lasciare com\'è e '
      + 'contare sulle prove, che oggi hanno funzionato — ⛔ ma hanno funzionato perché quel pezzo '
      + 'una prova ce l\'aveva: quello che nessuna prova guarda sparirebbe senza un rumore.'
      + '\n\n✅ **CHIUSA — Simone, 5/9: «Ho chiuso l\'altra, controlla cosa ha fatto e poi basta».** Controllato: i suoi commit sono tutti su `origin/main` (colazioni con carne e pesce con le tre porte, ricetta nuova dal menu, spunta «verificata», email di «Piano bloccato», Vera che chiede metodo e allergeni, righe di paniere che seguono il pasto, gruppi di equivalenza globali e uniti), e sul Mac non ha lasciato **niente di non committato** (`find -newer .git/refs/heads/main`: solo i miei due file). Da oggi una sessione sola; le regole del 4/9 (fetch prima di scrivere e di consegnare, md5 contro `origin/main`) restano.',
  },

  {
    chiave: 'chiave-vale-in-due-copie',
    fatta: true,
    categoria: CODICE,
    ordine: 0,
    blocca: false,
    nata: '2026-09-04T23:30',
    titolo: '⛔ «Melograno» risulta con il GLUTINE: «questa chiave vale?» ha due copie, e una non legge la regola del 4/9',
    dettaglio:
      '⛔ **Misurato il 4/9, ed è una prova che gira** (`catalog/allergeni-porta-unica.spec.ts`):\n'
      + '```\n'
      + 'melograno sgranato   →  oggi risulta con GLUTINE\n'
      + 'melagrana fresca     →  oggi risulta con LATTE\n'
      + 'piselli sgranati     →  oggi risulta con LATTE\n'
      + '```\n'
      + 'Quindi **oggi una celiaca non riceve la vellutata di melograno**, e chi è intollerante al '
      + 'lattosio non riceve i piselli sgranati.\n\n'
      + '⚠️ **La regola che lo evita è già scritta**: `SOLO_A_INIZIO_PAROLA`, il riquadro del 4/9, '
      + '239 occorrenze su 24 mila ricette. Solo che la legge **una porta e non l\'altra**: '
      + '`menu/exclusions.ts` risponde a «questa chiave combacia?» con **tre** filtri (omonime, '
      + 'frasi, inizio di parola), e `catalog/allergens.ts` ha una **seconda copia** che ne conosce '
      + 'due. ⛔ E i tag allergene **vengono scritti** sulle ricette: non è un suggerimento che '
      + 'qualcuno legge, è una riga che toglie il piatto.\n\n'
      + '⛔ **E i panieri non c\'entrano** (domanda di Simone, 4/9): il paniere decide quali piatti '
      + 'finiscono nel pool, gli allergeni scritti decidono **quali di quelli vengono tolti** a chi è '
      + 'allergica. Sono due filtri in fila, e il secondo lo attraversano tutte comunque sia fatto il '
      + 'pool.\n\n'
      + '⚠️ È lo stesso difetto che il commento di `dentroUnaFraseCheNonE` dichiara di aver chiuso '
      + 'venti righe sopra — *«due elenchi che rispondono alla stessa domanda un giorno si '
      + 'contraddicono»* — e che si era richiuso da solo un piano più in là: sulla **funzione** '
      + 'invece che sull\'elenco.\n\n'
      + '✅ **LA MISURA C\'È: `npm run diag:chiave-doppia`** (sola '
      + 'lettura). Dice quante ricette perdono un allergene accendendo la porta unica, con **tre '
      + 'numeri che non vanno confusi**: quante cambiano l\'elenco *dedotto*, quante ce l\'hanno '
      + '*scritto* in catalogo (è quello su cui si decide), e quante di quelle portano la **spunta di '
      + 'conferma**. ⚠️ Il conto sta nel **modulo puro** e non nello script: da quel numero dipende '
      + 'una decisione sul catalogo, e un giudizio che decide non sta in un file di `prisma/` che '
      + 'nessun test guarda.\n\n'
      + '✅ **MISURATO SUI DATI VERI IL 4/9, e Simone ha letto le otto coppie una per una: tutte e '
      + 'otto «no».** 190 ricette su 23 726, tutte col tag **scritto** e tutte con la spunta.\n'
      + '```\n'
      + 'melograno  → glutine  63     dorata (zucca)       → pesce   17\n'
      + 'melagrana  → latte    58     sgranato             → latte    6\n'
      + 'sgranati   → latte    43     melograna            → latte    1\n'
      + '(edamame)                    sgranocchiate        → glutine  1\n'
      + '                             corata (di coniglio) → pesce    1\n'
      + '```\n'
      + '⛔ **Diciassette piatti di carne risultavano contenere pesce** perché la zucca è «dorata», e '
      + 'quarantatré piatti di **edamame** risultavano contenere **latte** perché i fagioli sono '
      + '«sgranati».\n\n'
      + '✅ **LA PORTA UNICA È CHIUSA (4/9 sera)**: `suggestAllergens` chiama `chiaveCombacia` di '
      + '`menu/exclusions.ts`, e la copia non c\'è più. Da adesso nessuna ricetta nuova nasce con '
      + 'quei tag.\n\n'
      + '▶️ **RESTA DA LANCIARE LA RIPARAZIONE, ed è il gesto che scrive:**\n'
      + '```\n'
      + 'npm run ripara:allergeni-chiave\n'
      + 'CONFERMA=1 npm run ripara:allergeni-chiave\n'
      + '```\n'
      + '⛔ **Correggere la funzione non riporta indietro quello che è già scritto** (lezione dell\'1/9 '
      + 'sul riconoscitore della carne): quelle 190 continuano a togliere il piatto finché non si '
      + 'riscrivono.\n\n'
      + '⚠️ **Si toglie SOLO l\'allergene falso, mai si riscrive l\'elenco**, e le ricette su cui '
      + 'qualcuno ha scelto gli allergeni **a mano** (`catalog.recipe.allergens.set` nel registro) '
      + 'non si toccano affatto: escono in un elenco a parte. ⛔ Il perché l\'ha misurato una '
      + 'revisione avversariale — su «zucca dorata + salsa Worcestershire» il tag «pesce» sono **le '
      + 'acciughe**, e dagli ingredienti non si distingue dal falso della zucca.\n\n'
      + '⚠️ E `allergensReviewed` **non** si azzera: `personal-base.service.ts` scarta le ricette '
      + 'senza quella spunta, quindi azzerarla toglierebbe 190 piatti dalle basi personali — cioè si '
      + 'scambierebbe un allergene falso con nessun piatto.'
      + '\n\n▶️ **LA RIPARAZIONE È PRONTA E MISURATA A VUOTO (4/9 sera).** `npm run ripara:allergeni-chiave` su tutto il catalogo — **27 070 ricette, attive e spente**:\n'
      + '```\n'
      + 'Con almeno un allergene falso SCRITTO      215\n'
      + '  di quelle, con la spunta di conferma     190\n'
      + 'Non toccate perche qualcuno le ha toccate    0\n'
      + '```\n'
      + '⚠️ **Quello zero è la riga che conta**: su nessuna di quelle ricette una persona aveva scelto gli allergeni a mano (`catalog.recipe.allergens.set`). Sono **tutte** scritture della macchina, e non c\'è **nessun caso ambiguo** — la protezione «dove ha messo le mani una nutrizionista non si tocca niente» non ha niente da proteggere.\n'
      + '**Il gesto che scrive:** `CONFERMA=1 npm run ripara:allergeni-chiave`.\n'
      + '⚠️ Toglie **solo** l\'allergene falso: sull\'edamame toglie il latte e lascia la soia. E **non** azzera `allergensReviewed` — azzerarla toglierebbe 215 piatti dalle basi personali, cioè scambierebbe un allergene falso con nessun piatto.'
      + '\n\n✅ **RIPARATA IL 4/9 SERA: 215 ricette scritte.** `CONFERMA=1 npm run ripara:allergeni-chiave` ha tolto l\'allergene falso — e solo quello — a tutte e 215.\n'
      + '⚠️ Qualche riga di quelle, per capire cosa era in gioco: «Ossobuco di tacchino» e «Stracotto di Vitello» non risultano più contenere **pesce** (la zucca era «dorata»); «Edamame al vapore con sale marino» non risulta più contenere **latte** (i fagioli erano «sgranati»); «Mix Noci & Melograno» non risulta più contenere **glutine**.\n'
      + '✅ **E lo zero della riga «non toccate» ha retto**: nessuna di quelle ricette aveva gli allergeni scelti a mano, quindi non è stata tolta nessuna protezione vera.',
  },

  {
    chiave: 'chiavi-dichiarate-che-nessuno-legge',
    categoria: CODICE,
    ordine: 1,
    nata: '2026-09-03T11:00',
    titolo: '▶️ 29 caselle di permesso su 65 spengono il menu e non la porta — adesso la pagina lo DICE',
    dettaglio:
      '**Misurato il 3/9**, mentre si chiudeva `togliere-una-chiave-non-basta-se-c-e-un-hub`: '
      + '`BACKOFFICE_PAGES` dichiara **66** chiavi e solo **23** compaiono in un `@RequirePage`. Le '
      + 'altre **43** governano la voce di menu e basta: la rotta dietro è protetta da `@Roles`, o '
      + 'da niente. ⚠️ Qui c\'era scritto «65 e 22»: erano i numeri del pomeriggio, e la sera stessa '
      + '`menu_a_mano` e `diet_descriptions` sono nate **con** la loro guardia — le chiavi salgono, '
      + 'quelle guardate salgono, e le 43 restano 43. `chiavi-senza-guardia.spec.ts` li tiene fermi '
      + 'tutti e tre; questa riga no, ed era rimasta indietro.\n\n'
      + '⛔ **È il difetto di `assignments`, che `CLAUDE.md` racconta come chiuso.** *«Una chiave '
      + 'dichiarata e non letta da nessuno è un interruttore che non accende niente.»* Il 13/8 ne '
      + 'erano state tolte due; il conto dice che il caso non era due.\n\n'
      + '✅ **STRADA (c) FATTA, 3/9 sera: le 43 non sono più un elenco unico.** Erano quattro casi '
      + 'diversi sotto un nome solo, e *mescolarli porta a correggere quello sbagliato*. Adesso la '
      + 'classificazione sta **nel codice** (`MOTIVO_SENZA_GUARDIA` in `permissions/pages.ts`), non '
      + 'più solo in questa voce:\n'
      + '· ⛔ **buco — 29.** La casella sembra un cancello e non lo è, su dati o poteri veri: '
      + '`audit_logs`, `users`, `permissions`, `roles`, `engine_config`, `health_documents`, '
      + '`escalations`, `chat`, `posta`, la contabilità, e ⚠️ i tre che **cambiano dati clinici** — '
      + '`change_allergies`, `change_diet_type`, `change_fasting_window`. Spegnere «Documenti '
      + 'sanitari» a un ruolo toglie la voce e **non** chiude il `GET`.\n'
      + '· ⚠️ **figlia — 9.** L\'API vera sta sotto la chiave del genitore, che una guardia ce '
      + 'l\'ha: qui la casella è di interfaccia **per progetto**, e va detto — non è un buco, è una '
      + 'scelta.\n'
      + '· ⚠️ **grantor — 2.** `diet_workspace` e `creation_validation`: nessuna guardia, ma '
      + 'spegnerli **chiude** le API che concedono.\n'
      + '· ⚠️ **innocua — 3.** `dashboard`, `notifications`, `charts`: sola lettura del proprio '
      + 'perimetro, non c\'è nessuna porta.\n\n'
      + '✅ **E la pagina Permessi lo dice.** Sotto il nome delle 29 righe col buco compare una nota '
      + 'gialla — *«questa casella governa la voce di menu, non l\'API»* — più il conto in cima, che '
      + 'serve a farle **cercare**: sono note piccole in una tabella che scorre. ⚠️ Solo i buchi: '
      + 'segnalare anche le figlie e i grantor rifarebbe l\'elenco unico che questa classificazione '
      + 'esiste per sciogliere, e un avviso su una cosa che va bene insegna a non leggere gli '
      + 'avvisi.\n\n'
      + '⛔ **E la classificazione dev\'essere LETTA da qualcuno**, o sarebbe l\'interruttore che non '
      + 'accende niente rifatto un piano più sopra — dentro la consegna che quel difetto misura. Il '
      + 'giro è tenuto fermo da una prova: `pages.ts` la dichiara · il servizio la manda · la pagina '
      + 'la mostra. ⚠️ E il numero **si accorcia agganciando le guardie, mai riclassificando**: '
      + 'spostare una chiave da `buco` a `figlia` per far scendere il conto è la stessa cosa che '
      + 'spegnere l\'avviso, e una mutazione lo prova.\n\n'
      + '▶️ **RESTA LA STRADA (b), ed è di Simone**: agganciare `@RequirePage` alle 29, una per una. '
      + '⛔ Va fatta **a piccoli passi, non in blocco**, e tocca i permessi di persone vere: la '
      + 'guardia legge `role_page_permission`, e per una chiave che nessuno leggeva le righe possono '
      + 'non esserci — chi oggi entra senza problemi domani prenderebbe 403.\n\n'
      + '⛔ **COSA COSTA DAVVERO LA STRADA (b) — misurato nella notte fra il 3 e il 4/9, provando a '
      + 'scrivere la diagnostica che la rendesse guardabile prima. La diagnostica è stata scritta e '
      + '**buttata**, e quello che ha misurato vale più di lei:**\n'
      + '· ⛔ **Non è una decisione per chiave, sono due.** `@RequirePage` prende un livello, e se '
      + 'non glielo si dà lo sceglie dal metodo HTTP (GET → `view`, il resto → `manage`). Nel '
      + 'progetto il livello è scritto a mano in **54 punti** — in `catalog.controller` ci sono '
      + '`@Post` fissati a `\'view\'` apposta, «il requisito manage bloccherebbe chi ha il catalogo '
      + 'in sola lettura». Quindi per ogni chiave si decide **anche** a che livello.\n'
      + '· ⛔ **La matrice da sola non sa quanto costa una chiave, e sbaglia di molto.** `users` sta '
      + 'su una rotta `@Roles(\'admin\')`: la matrice dice «sette ruoli fuori», il costo vero è '
      + '**zero** — quei sette prendono 403 già oggi. `lead_acceptance`: cinque stampati, zero veri. '
      + 'Il conto giusto è **matrice ∩ `@Roles` della rotta**, e non c\'è nessun modo meccanico di '
      + 'legare una chiave alla sua rotta — sono chiavi che nessuno legge, è la definizione. Il '
      + 'confronto lo fa chi apre il controller, che va aperto comunque.\n'
      + '· ⚠️ **E fatto il conto per bene, le chiavi che la matrice non chiude a nessuno sono UNA su '
      + '29**: `posta`. Che è la propria casella di posta (`me/mailbox`, `@Roles` su tutto lo staff, '
      + 'e già limitata a `user.sub` dentro il servizio): agganciarla non chiude niente a nessuno, e '
      + 'metterla **a livello di classe** romperebbe `PUT`/`POST`/`DELETE` per tutti, perché '
      + '`posta:manage` non ce l\'ha nessuno. Non esiste il gruppo delle «gratis»: si va una per '
      + 'una davvero.\n\n'
      + '⛔ **E DUE COSE CHE NON SAPEVAMO, che vanno guardate PRIMA di ogni singolo aggancio:**\n'
      + '· ⛔ **La guardia vale per chiunque sia autenticato, CLIENTI COMPRESE**, e nella matrice il '
      + 'ruolo `client` non ha nessuna casella accesa. Ci sono rotte **senza `@Roles`** che sono '
      + 'proprio quelle delle clienti: `threads` (i messaggi della chat, «l\'accesso è verificato '
      + 'thread per thread nel service») e `documents` (il download decifrato, «cliente (propri) o '
      + 'staff sanitario»). Agganciare `chat` o `health_documents` **a livello di classe** chiude '
      + 'fuori tutte le clienti, e nessun avviso lo direbbe.\n'
      + '· ⛔ **Su una rotta senza `@Roles` il fail-open si rovescia.** `page.guard.ts` resta '
      + 'permissivo su un errore di lettura **solo se sotto c\'è ancora un `@Roles`** (correzione '
      + 'del 17/8); dove la guardia è l\'unico cancello, un singhiozzo del database diventa 403 per '
      + 'tutti. Prima dell\'aggancio quella rotta il singhiozzo non lo sentiva: agganciando si '
      + 'aggiunge un modo nuovo di restare fuori.\n\n'
      + '▶️ **Quindi l\'ordine sensato non è «dalle dieci sui dati sensibili»**, ma: prima le rotte '
      + 'che hanno già un `@Roles` stretto (dove la matrice non toglie niente a nessuno), e per '
      + 'ognuna, prima di scrivere il decoratore, la domanda «questa rotta la usano anche le '
      + 'clienti?».\n\n'
      + '⛔ **Quello che NON va fatto** è spegnere l\'avviso togliendo le chiavi: la voce di menu '
      + 'serve, e toglierla darebbe a tutti quello che oggi si può almeno nascondere.'
  },

  {
    chiave: 'togliere-una-chiave-non-basta-se-c-e-un-hub',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-09-02T22:10',
    titolo: '✅ La pagina Permessi dice quando spegnere una casella NON chiude la porta',
    dettaglio:
      'Trovato il 2/9 dalla revisione avversariale sull\'ereditarietà. Non era un difetto del '
      + 'codice — è il progetto di `PAGE_GRANTS`, scritto per far sì che «bastino poche voci di menu '
      + 'per gestire tutto» — ma **non era scritto da nessuna parte nella pagina**, e chi la usa non '
      + 'poteva indovinarlo.\n\n'
      + '⛔ **Il caso.** Simone spegne `recipes` alla nutrizionista. Lei continua a chiamare le API '
      + 'delle ricette, perché ha «Gestione dieta» (`diet_workspace`) e quell\'hub concede '
      + '`diets_catalog` **+ `recipes`**. Dalla schermata sembra spento, e non lo è.\n\n'
      + '✅ **CHIUSA il 3/9 con la prima strada: la pagina lo DICE.** Le celle che mentono portano '
      + 'un\'etichetta gialla che nomina la porta e cosa fare, la riga di un hub dice «apre anche: '
      + 'Catalogo diete, Ricette», e un riassunto in cima fa cercare i badge in una tabella che '
      + 'scorre. ⚠️ Il verdetto lo calcola il **backend**, con lo stesso modulo del guardiano '
      + '(`porta-aperta-lo-stesso.ts`): rifarlo nel backoffice sarebbe la seconda copia della stessa '
      + 'regola, che è il difetto costato l\'incidente dell\'ereditarietà.\n\n'
      + '⛔ **E i casi non erano due, ma quattro.** La revisione avversariale sulla consegna:\n'
      + '· ⛔ **Il ruolo personalizzato.** `resolveRole` mette il **ruolo di base** in `user.role`, '
      + 'quindi il guardiano cerca la riga di «Nutrizionista» anche per «Nutrizionista junior», '
      + 'mentre la colonna che si vede — e il menu — usano la chiave personalizzata. Spegnere una '
      + 'casella lì toglie la **voce di menu** e lascia aperte le API. La prima stesura calcolava su '
      + 'righe e default che il guardiano non guarda mai, quindi su quella colonna produceva **zero '
      + 'avvisi**: *garantiva silenzio proprio dove è più facile sbagliarsi*, e tacere in modo '
      + 'credibile è peggio che tacere. Ora c\'è un\'etichetta sua («vale Nutrizionista»), e un '
      + 'ruolo personalizzato costruito su `admin` si salta del tutto — il guardiano gli dice sì '
      + 'prima di leggere qualunque cosa.\n'
      + '· ⚠️ **La riga mai creata.** Se `syncDefaults` è andato storto all\'avvio (`onModuleInit` '
      + 'assorbe il proprio errore con un `warn`) sono **decine per ruolo** — misurate: 52 per la '
      + 'nutrizionista, 33 per la coach. Segnalarle una per una spegnerebbe l\'unico segnale che la '
      + 'pagina ha, e lì non c\'è nessun permesso su cui agire: il valore sta nel codice. Si dicono '
      + 'con **un numero**, a parte, e un numero grande dice che il problema è l\'avvio.\n\n'
      + '⚠️ **Il perimetro è dichiarato, e non è «tutto».** Restano fuori le **43 chiavi su 64 che '
      + 'nessuna `@RequirePage` legge**: lì la casella governa il menu e non la porta, perché '
      + 'l\'endpoint è protetto dal solo `@Roles`. È lo stesso difetto raccontato in `CLAUDE.md` a '
      + 'proposito di `assignments` e `engine_reviews`, vivo su decine di chiavi — e ha una voce sua '
      + '([[chiavi-dichiarate-che-nessuno-legge]]). Il banner nomina le tre vie che copre invece di '
      + 'promettere di coprirle tutte.\n\n'
      + '⛔ **La seconda strada resta aperta e resta di Simone**: spegnere una chiave la spegne '
      + '**davvero**, cioè una negazione esplicita batte l\'hub. Cambia il significato della matrice '
      + 'per tutti — oggi «spento» vuol dire «non te lo do io», non «non ce l\'hai» — e la pagina '
      + 'adesso lo spiega invece di deciderlo al posto suo.\n\n'
      + '🧪 Diciannove mutazioni su diciannove uccise. ⚠️ Due erano sopravvissute e hanno fatto '
      + 'cambiare il **codice**, non le prove: un parametro `role` che non cambiava nessuna risposta '
      + '(tolto, così quella mutazione non si può nemmeno scrivere) e due cancelli ridondanti nello '
      + 'stesso `if`. E una terza è annotata come non uccidibile da sola: `DEFAULT_ESPLICITI` e '
      + '`DEFAULT_PERMISSIONS` oggi si coprono a vicenda, quindi sbagliare una delle due chiavi non '
      + 'cambia nessuna risposta — scritto nella prova invece di fingere.'
  },
  {
    chiave: 'interruttore-ricette-semplici-in-app',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-09-02T19:20',
    titolo: '✅ Tolto dal Profilo dell\'app l\'interruttore «ricette semplici» — resta da mandare l\'OTA',
    dettaglio:
      'Il 2/9 la preferenza «ricette semplici» è stata **tolta dal motore** (decisione di Simone, '
      + 'dopo il caso Patrizia del 31/8). ⛔ L\'interruttore nel Profilo dell\'app è rimasto un '
      + 'giorno di più: la cliente lo accendeva e non succedeva niente — un interruttore che non '
      + 'accende nulla, la cosa che `CLAUDE.md` dice di non lasciare in giro. ⚠️ E quando a premerlo '
      + 'è la **cliente** è peggio di una chiave di permesso morta, perché lei ci conta.\n\n'
      + '✅ **CHIUSA il 3/9 per la parte di codice**: via il componente `SimpleRecipesPref` e il suo '
      + 'montaggio da `app/src/pages/Profilo.tsx`. Al posto suo resta scritto **perché** è stato '
      + 'tolto — senza, fra sei mesi qualcuno lo rimette credendo a una dimenticanza.\n\n'
      + '⛔ **`prefersSimpleRecipes` NON è stato tolto dal DTO** (`profile/dto/update-profile.dto.ts`), '
      + 'ed è una scelta, non una dimenticanza: le app **già installate** mandano quel campo a ogni '
      + 'salvataggio, e un DTO che non lo accetta più risponde **400** — la cliente non salverebbe '
      + 'più il profilo, nome e allergie comprese, per un campo che non serve a nessuno. Si pulisce '
      + 'quando le versioni vecchie non sono più in giro, ed è un altro giro.\n\n'
      + '⚠️ **Le due metà vanno in direzioni opposte, e una prova sola le tiene ferme tutte e due** '
      + '(`profile/interruttore-ricette-semplici-tolto.spec.ts`): l\'interruttore non c\'è più '
      + 'nell\'app, **e** il DTO accetta ancora il campo. Con una controprova su un campo inventato, '
      + 'o la seconda passerebbe anche a campo tolto.\n\n'
      + '⚠️ **Il valore in banca dati si tiene**: dice a chi quella preferenza interessava, e non si '
      + 'ricrea. Se un giorno la funzione torna, quella è l\'unica lista che c\'è.\n\n'
      + '▶️ **Resta a Simone: mandare l\'OTA.** Finché non esce, chi ha la versione vecchia '
      + 'l\'interruttore continua a vederlo — e a premerlo a vuoto.'
  },
  {
    chiave: 'stesso-piatto-spuntino-e-merenda',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: false,
    nata: '2026-09-02T18:40',
    titolo: '⛔ Lo stesso piatto allo spuntino E alla merenda della stessa giornata: la composizione non lo vieta',
    dettaglio:
      'Trovato dalla revisione avversariale del 2/9, misurando un\'altra cosa. Dalla Fase 2 (1/9) '
      + '`poolPerSlot` allarga il pool ai **gemelli**: `morning_snack` e `afternoon_snack` escono con '
      + 'la stessa identica lista, perché una merenda deve poter servire lo spuntino e viceversa. È '
      + 'giusto — ma da lì in poi **nessuno vieta che la stessa ricetta finisca in tutti e due**.\n\n'
      + '⛔ `DayComboService.enumerate` è un prodotto cartesiano puro, e né `rank` né `greedy` '
      + 'penalizzano un `recipeId` ripetuto fra due slot. `coppiaDellaGiornata` guarda solo '
      + 'pranzo/cena, e fra **giornate** diverse, non dentro la stessa.\n\n'
      + '```\n'
      + '[{breakfast:c1},{morning_snack:sm1},{lunch:p1},{afternoon_snack:sm1},{dinner:d1}]\n'
      + '```\n\n'
      + 'Lo stesso piatto alle 10:30 e alle 17:00, e la cliente lo legge in due righe della stessa '
      + 'giornata.\n\n'
      + '⚠️ **Quanto capita dipende da quanto è largo il pool**: con un paniere pieno è raro, su una '
      + 'cliente con molte esclusioni no. ✅ **Lo strumento c\'è: `npm run diag:piatto-doppio`** '
      + '(sola lettura, non corregge niente), col conto e il **verdetto** in '
      + '`menu/piatti-doppi-nella-giornata.ts` e le sue prove. ⚠️ Il verdetto sta nel modulo e non '
      + 'nello script: da questo numero dipende dove va la correzione, e un giudizio in un file di '
      + '`prisma/` che nessun test guarda è il tabulato dei panieri dell\'1/9, che diceva «⛔ non '
      + 'spostare» in cima e «✅ si può spostare» dodici righe sotto. **Resta da lanciarlo sui dati '
      + 'veri** — qui in sandbox il database non c\'è.\n\n'
      + '⚠️ **Il conto separa le cause**, e non le somma in un totale unico: spuntino↔merenda (che '
      + 'nasce dall\'allargamento), pasti principali (che nasce da un\'altra parte) e misto. Un '
      + 'numero che mette insieme due cause è un numero che non si può usare.\n\n'
      + '**La soglia dichiarata è il 5%** (`QUOTA_CHE_CAMBIA_LA_STRADA`): sotto, una guardia a valle '
      + 'costa meno di un vincolo dentro il prodotto cartesiano, che ne moltiplica le combinazioni '
      + 'da scartare; sopra, è una cosa che le clienti vedono e la sceglie chi compone la giornata, '
      + 'coi vincoli di kcal e macro davanti. ⚠️ È un numero di prodotto, non una costante tecnica: '
      + 'si sposta, ma sapendo perché era lì.\n\n'
      + '⛔ **E il verdetto guarda i GEMELLI, non il totale, sulle sole giornate che hanno tutti e '
      + 'due i pasti.** Sono i due difetti che la revisione avversariale ha trovato nella prima '
      + 'stesura dello strumento, e tutti e due mandavano dalla parte sbagliata con la faccia di un '
      + 'numero preciso: (1) decidere sul totale voleva dire dire «correggi `dayCombo`» su un '
      + 'campione con **zero** doppioni fra gemelli e sessanta fra gli altri pasti; (2) mettere al '
      + 'denominatore **tutte** le giornate diluisce il tasso di quanto è grande la fetta a tre '
      + 'pasti — su una giornata da tre il doppione fra gemelli è **impossibile**, non raro, e con '
      + '800 giornate da tre e 200 da cinque di cui 30 col doppione il tasso vero è il 15% mentre il '
      + 'totale dice 3%.\n\n'
      + '⚠️ **E sotto le cento giornate a rischio non si dà un verdetto** (`campione troppo '
      + 'piccolo`): tre giornate con un doppione fanno il 33%, e su tre casi quel 33% sta insieme '
      + 'sia a «sotto soglia» sia a «capita quasi sempre».\n\n'
      + '⛔ **E non si risolve togliendo l\'allargamento**: quello serve, e toglierlo rimetterebbe '
      + 'una merenda a non poter servire uno spuntino — cioè il difetto che la Fase 2 ha chiuso.\n\n'
      + '▶️ **MISURATO SUI DATI VERI IL 4/9, e il verdetto è «non ancora».** Lanciato con `GIORNI=30` '
      + 'e poi con `GIORNI=180`. Il secondo ha risposto una cosa che vale più del verdetto: chiesti '
      + '180 giorni, **trovati 46** (`2026-07-20 → 2026-09-03`). Non è che il campione è piccolo — '
      + 'è **finito**: indietro non c\'è altro, quelle sono tutte le giornate di menu che esistono.\n'
      + '· 219 giornate, 37 clienti · **66** con spuntino **e** merenda (le uniche dove il doppione è '
      + 'possibile) · **1** doppione, fra i gemelli: «Tonno in olio con maionese», il 3/9.\n'
      + '⚠️ 66 su 100, quindi lo strumento **non dà un verdetto**, ed è giusto così: un caso su 66 '
      + 'sembra raro, ma è esattamente il campione su cui quella soglia esiste per non far dire '
      + '«raro» con la faccia di una misura.\n'
      + '▶️ **Si rimisura a fine settembre.** 66 giornate a rischio in 46 giorni fanno ~1,4 al '
      + 'giorno: per arrivare a 100 mancano tre settimane scarse di esercizio, meno se entrano '
      + 'clienti nuove. Il comando è lo stesso, e da lì la scelta si fa in un minuto.\n'
      + '✅ **E lo strumento adesso lo dice da sé** (4/9): quando la giornata più vecchia trovata è '
      + 'dopo l\'inizio della finestra chiesta stampa «alzare GIORNI non serve, il campione è '
      + 'FINITO» e stima quanti giorni di esercizio mancano. ⛔ Prima diceva «alza GIORNI e '
      + 'rilancia» **anche quando indietro non c\'era altro**, cioè mandava a rilanciare a vuoto e '
      + 'poi a decidere lo stesso senza il numero — con tutti gli elementi per accorgersene in mano '
      + '(il periodo chiesto e quello trovato, che erano diversi).',
  },
  {
    chiave: 'la-e-nel-nome-tronca-in-silenzio',
    categoria: 'Da fare — codice',
    ordine: 0,
    // ⚠️ Bloccante finché il nome imparato poteva essere un piatto che nessuno aveva nominato.
    blocca: false,
    nata: '2026-08-31T18:10',
    fatta: true, // chiusa il 3/9
    titolo: '✅ «Biscotti d\'Avena e Banana» diventa «Biscotti d\'Avena»: chiusi il primo nome, i nomi composti e la coda del quando',
    dettaglio:
      'Trovato **misurando**, il 31/8, mentre si chiudeva il difetto del «senza glutine». Non era stato '
      + 'segnalato da nessuno, ed è più pericoloso di quello che era stato segnalato.\n\n'
      + '```\n'
      + 'a patrizia sostituisci Biscotti d\'Avena e Banana con Gallette di riso\n'
      + '  → { da: ["Biscotti d\'Avena"], a: ["Gallette di riso"] }\n'
      + '```\n\n'
      + '⛔ **«e Banana» sparisce senza una parola.** La regola scritta non vieta quel piatto: vieta '
      + '**tutti** i «Biscotti d\'Avena». E l\'anteprima mostra una frase plausibile — «al posto di '
      + '"Biscotti d\'Avena" metto "Gallette di riso"» — quindi basta un «confermo».\n\n'
      + '⚠️ È **esattamente** il difetto che `vera/elenco-alimenti.ts` è nato per chiudere, un piano '
      + 'più sotto. Là la regola è scritta: *«o si legge tutto, o non si è capito»*, e `leggiElenco` '
      + 'infatti su questo pezzo torna `null`. Ma `chiedeUnaSostituzioneAElenchi` risponde **false** '
      + '(nessuna virgola, nessun «o»), quindi il ramo a elenchi non si apre e si ripiega su '
      + '`sostituzioniNelMessaggio` → `nomeAlimento`, che si ferma alla congiunzione e non lo dice a '
      + 'nessuno. La guardia c\'è, il caso le passa accanto.\n\n'
      + '⚠️ **Non basta spezzare su «e»**, ed è scritto nel cappello di `elenco-alimenti.ts`: «e» '
      + 'dentro un nome è comunissimo — «Biscotti d\'Avena **e** Banana», «sale **e** pepe», «erbe **e** '
      + 'spezie». Spezzare sempre trasformerebbe il nome di un piatto in due alimenti inventati, cioè '
      + 'rifarebbe lo stesso errore al contrario.\n\n'
      + '**Le due strade, da scegliere con Simone:**\n'
      + '1. ⭐ **Dire di no.** Quando `nomeAlimento` si ferma su una congiunzione e dopo c\'è ancora '
      + 'roba, `sostituzioniNelMessaggio` non risponde: Vera chiede *«"Biscotti d\'Avena e Banana" è '
      + 'un piatto solo o due cose?»*. Onesto, e coerente con «niente troncamenti silenziosi». Costa '
      + 'una domanda in più su frasi che oggi passano (sbagliate).\n'
      + '2. **Guardare il catalogo**: se il pezzo intero combacia con una ricetta esistente è un nome '
      + 'solo, se combaciano i due pezzi separati sono due. Più comodo per chi scrive, ma fa dipendere '
      + 'la lettura di una frase da cosa c\'è in catalogo in quel momento — la stessa frase, domani, '
      + 'si può capire in un altro modo.\n\n'
      + '⚠️ Il pezzo catturato è **tutta la coda** («... con le gallette **a colazione**»), quindi il '
      + 'confronto «quante parole ho letto contro quante ce n\'erano» non si può fare qui come lo fa '
      + '`leggiElenco`: direbbe «non ci arrivo» a metà delle frasi normali. ⛔ E **non basta passare da '
      + '`senzaCodaDiAmbito`**, che è quello che avevo scritto qui nella prima stesura: misurato in '
      + 'revisione, quella funzione conosce «a tutti», «vale per tutte», «regola generale» — e su '
      + '«sostituisci il pane con le gallette **a colazione**» restituisce la frase **identica**. Serve '
      + 'un modo di separare la coda di contesto dal nome, e oggi non c\'è. Chi prende questa voce '
      + 'parta da qui e non da quella riga, che era sbagliata.\n\n'
      + '⚠️ **E si perde da tutte e due le parti**: nella frase vera anche «Biscotti senza glutine **e '
      + 'banana**» diventa «Biscotti senza glutine». Il troncamento è simmetrico.\n\n'
      + '⚠️ Nota di contorno, misurata sulla frase vera dello screenshot: «a patrizia sogari» tutto '
      + 'minuscolo **non** viene letto come nome di cliente (con le maiuscole sì). Quindi quel messaggio, '
      + 'anche adesso che non risponde più «non ci arrivo», chiede comunque a chi. È un terzo difetto, '
      + 'separato dai due di questa voce.\n\n'
      + '\u2705 **CHIUSA il 2/9 con la strada 1** (⭐), quella che questa voce consigliava: quando il '
      + 'nome di partenza si ferma su una congiunzione e **dopo c\'è ancora una parola**, '
      + '`sostituzioniNelMessaggio` non risponde. Meglio una domanda in più che una regola scritta su '
      + 'un piatto che nessuno ha nominato.\n'
      + '\u2705 **E IL 3/9 È CHIUSA LA FAMIGLIA PIÙ GROSSA: il nome composto nella forma '
      + 'rovesciata.** «metti la crema **di** mandorle al posto del burro» imparava **«mandorle»**, '
      + '«il petto di tacchino» **«tacchino»**, «i cracker ai cereali» **«cereali»**: in italiano '
      + 'quei nomi sono ovunque, e la cliente riceveva l\'ultima parola del piatto.\n'
      + '✅ **Corretta la LETTURA, non messa una guardia**: `codaDellaFrase` si fermava su `ARTICOLI`, '
      + 'che tiene insieme due cose che risalendo si comportano al contrario — «**le** gallette», '
      + 'dove l\'articolo apre il nome, e «crema **di** mandorle», dove il «di» sta **dentro**. Adesso '
      + 'chiudono il nome solo gli articoli veri (partitivi compresi: «**della** ricotta») e chi '
      + 'scrive; le preposizioni no.\n'
      + '⛔ **E ci sono voluti due tentativi sbagliati, tutti e due trovati da una revisione '
      + 'avversariale, mai dalle mie prove.** (1) Il 2/9 sera una **guardia** («se il nome sembra '
      + 'tagliato, non rispondere») spegneva **ventuno frasi normali su trentasette** — tolta, e al '
      + 'suo posto è nato `frasi-normali-che-devono-passare.spec.ts`, il corpus che mancava. (2) Il '
      + '3/9 mattina il confronto sui verbi era **per prefisso**, e mangiava alimenti veri: '
      + '«**prov**ola», «**punt**arelle», «**passa**ta di pomodoro» — che è un ingrediente di questo '
      + 'catalogo — «**lev**istico», «**dai**kon» smettevano di essere capiti. ⚠️ La regola era già '
      + 'scritta venti righe sopra, in questo stesso file: *«chi allunga questo elenco controlli '
      + 'prima i nomi del catalogo»*. Adesso il confronto è per **parola intera**.\n'
      + '⚠️ **E i partitivi sono articoli**: lasciati fuori, «per Anna **della** ricotta» imparava '
      + '«Anna della ricotta» — il nome della cliente dentro al piatto. Come l\'articolo elidato '
      + 'attaccato («per Anna **un\'**insalata di farro»), che non combacia con nessun elenco e '
      + 'si riconosce con la stessa regex di `senzaArticoloAttaccato`, apostrofo tipografico compreso.\n'
      + '⚠️ **Resta aperta la coda di contesto sul secondo nome**: «sostituisci il pane con le '
      + 'gallette **a colazione**» impara «gallette a colazione». Il pezzo dopo «con» non è delimitato '
      + 'da niente, e una riga del corpus lo tiene fermo con una regex **ancorata** invece di '
      + 'nasconderlo — con `/gallette/i` non si vedeva. Si chiude quando si saprà separare la coda, '
      + 'non con una guardia.\n'
      + '⚠️ **E un saluto davanti al nome ci finisce dentro** («ciao Anna Maria buongiorno gallette»): '
      + 'scritto con `it.failing`, cioè verde finché il difetto c\'è e **rosso il giorno che qualcuno '
      + 'lo corregge**. La cura non è allungare un elenco di saluti: è capire dove **comincia** il '
      + 'nome.\n'
      + '\u26d4 **E la prima stesura della guardia aveva il difetto dentro**: per sapere se dopo la '
      + 'congiunzione restava qualcosa cercava la stringa, e su «il pane e» trovava la «e» **dentro '
      + '«pane»** — rispondendo «troncato» a una frase che finisce lì. L\'ha presa la prova che teneva '
      + 'fermo proprio quel caso. Adesso conta le parole.\n\n'
      + '\u2705 **CHIUSA il 3/9 anche sulla CODA DEL QUANDO** (`food-swaps/coda-di-quando.ts`), che '
      + 'era l\'ultimo pezzo aperto: «sostituisci il pane con le gallette **a colazione**» imparava '
      + '«gallette a colazione», un nome che non combacia con nessuna ricetta — la sostituzione non '
      + 'succedeva mai, dietro un\'anteprima plausibile. Il taglio è su **tutt\'e quattro** i pezzi '
      + '(i due della forma diretta e i due di quella rovesciata) e anche dentro `leggiElenco`, '
      + 'perché bastava una «o» per cambiare ramo e cambiare esito.\n\n'
      + '⛔ **NON è una regola generale: è un elenco chiuso di code intere, preposizione compresa**, '
      + 'e la preposizione è tutta la difficoltà. «**a** colazione» è un orario; «**da** colazione», '
      + '«**per la** colazione» sono **categorie merceologiche** (biscotti, cereali, barrette), e '
      + '«zuppa **del** giorno», «arrosto **della** domenica» sono piatti. Le prime due stesure li '
      + 'tagliavano: «togli i biscotti da colazione» diventava «togli **tutti** i biscotti», merenda '
      + 'compresa. ⚠️ Non un silenzio — **cibo tolto dal piatto di qualcuno senza che l\'abbia '
      + 'chiesto**, cioè l\'errore che questo file dichiara essere il più caro.\n\n'
      + '⛔ **E un taglio che lascia una preposizione appesa non si fa affatto**: «l\'insalata **di** '
      + 'tutti i giorni» diventava «l\'insalata di», che `chiaveAlimento` riduce a «insalata» — una '
      + 'regola su tutta l\'insalata, di nuovo per eccesso. Fra il difetto vecchio (la coda dentro al '
      + 'nome) e uno nuovo più caro, si tiene il vecchio.\n\n'
      + '⛔ **E se togliere la coda rende il pezzo illeggibile, si torna a com\'era**: «il **tè** a '
      + 'colazione» resta «tè» (sotto i tre caratteri), «lo **snack** a metà mattina» resta «snack» '
      + '(che è in `NON_ALIMENTI`). Senza il ripiego, una lettura sporca ma presente diventava un '
      + '**silenzio** — e negli elenchi un pezzo solo fa cadere tutto.\n\n'
      + '⛔ **E VA DETTO COSA COSTA IL TAGLIO, perché la prima stesura scriveva il rovescio.** '
      + '«sostituisci il pane **a colazione** con le gallette» chiede una regola ristretta a un '
      + 'pasto; tolta la coda si impara `pane → gallette` **senza orario**, cioè più larga. Prima il '
      + 'nome restava «pane a colazione» e la riga nasceva **inerte**. Si fa lo stesso perché la riga '
      + 'nasce `da_verificare` — una proposta che una persona guarda, che non tocca nessun menu da '
      + 'sola — e la sua `nota` porta la **frase intera**, dove l\'orario si legge. ⛔ E non si scrive '
      + '`FoodSwap.mealSlot`: la colonna c\'è ma **non la legge nessuno**, e riempirla darebbe a una '
      + 'riga l\'aria di essere ristretta a un pasto mentre vale su tutti.\n\n'
      + '✅ Misurato: i **1246 nomi** dei tre cataloghi (606 distinti) passano dal separatore senza '
      + 'perdere niente (`coda-di-quando-contro-il-catalogo.spec.ts`), ⚠️ e quella prova oggi passa '
      + '**a vuoto** — il rischio vero sta nella frase, non nel catalogo: è una rete per il futuro, '
      + 'ed è scritto lì. **21 prove di mutazione**, tutte prese, e **due revisioni avversariali**: '
      + 'la prima ha trovato tre regressioni, la seconda altre quattro. Nessuna delle due l\'hanno '
      + 'trovata le mie prove.\n\n'
      + '⚠️ **Cosa resta, scritto come sentinelle `it.failing` e non in un commento**: la coda **in '
      + 'mezzo** alla frase («...con le gallette a colazione **o i cracker**») resta dentro al nome; '
      + '«il latte **della mattina**» non si taglia perché «del/della + momento» è indistinguibile da '
      + 'un nome di prodotto; «il tè» cade sotto il minimo di tre caratteri; e «sostituisci le '
      + 'gallette con le gallette a colazione» — lo stesso piatto a un altro orario — diventa un '
      + 'silenzio, perché i due lati combaciano. Le prime tre si chiudono capendo meglio la frase; '
      + 'l\'ultima si chiude il giorno che una regola potrà portarsi dietro il pasto.',
  },
  {
    chiave: 'fase0-panieri-la-misura-che-manca',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: false,
    nata: '2026-08-31T16:40',
    titolo: 'Panieri — la misura della Fase 0: piatti, attivi e rotti per ogni variante',
    dettaglio:
      '`progetto/PIANO_Panieri_Ricette.md` §9 elenca due cose bloccanti prima di aprire la Fase 1. Una '
      + 'è la firma del capo nutrizionista (arrivata il 31/8). L\'altra è questa misura, e il piano dice '
      + 'anche quando basta: *«se "attivi" ≥ 60 per pasto su tutte le celle, si procede senza cambiare '
      + 'niente»*.\n\n'
      + '✅ Lo strumento c\'è: `npm run diag:fase0` (sola lettura), col conto in '
      + '`engine-rules/misura-fase0.ts` e le sue prove. ⚠️ Il conto **non** vive nello script: da quel '
      + 'verdetto dipende se la Fase 6 è zero consegne, cioè la stima di tutto il piano, e una cosa che '
      + 'decide non sta in un file di `prisma/` che nessun test guarda. Resta da lanciarlo sui dati veri.\n\n'
      + '⛔ **Tre cose che la revisione ha smontato, e che vanno sapute leggendo il tabulato.**\n\n'
      + '· Il verdetto guardava **solo** la soglia sugli attivi: una variante con trenta riferimenti '
      + 'rotti e i pasti pieni usciva ✅, mentre il §9 chiede tre numeri («piatti / attivi / **rotti**») '
      + 'e la Fase 1 pretende che i rotti vadano a zero. Adesso i rotti entrano nel verdetto.\n'
      + '· Le clienti si contavano da `client_cycle`: lì `status` è **sempre** `active` (il filtro non '
      + 'filtrava niente), le righe sono cicli di **due giorni** (una cliente da tre mesi ne vale una '
      + 'quarantina, e se ha cambiato dieta compare su due), e si materializzano solo quando lo staff '
      + 'apre una certa schermata (una cliente vera poteva contare zero). Un numero insieme gonfiato e '
      + 'bucato, stampato come decisivo. Adesso si contano le clienti **distinte** con una giornata in '
      + '`menu_day` negli ultimi 30 giorni.\n'
      + '· I totali sommavano i conteggi **per variante**: col catalogo condiviso la stessa ricetta si '
      + 'conta una volta per ogni variante che la nomina, quindi su 306 varianti il totale usciva di un '
      + 'ordine di grandezza sopra le ricette vere — e sotto c\'era scritto che quel numero era «quanto '
      + 'vale la differenza fra le due porte», che si misura in **ricette**. Adesso si stampano tutti e '
      + 'due, dichiarando che rispondono a due domande diverse.\n\n'
      + '⚠️ **Due verdetti, non uno**: su tutte le varianti, e sulle sole varianti che hanno clienti '
      + 'sopra. Il denominatore vero non è 306 — il §2.3 dice che le magre senza clienti spariscono da '
      + 'sole chiudendo le famiglie doppione. Se il primo è «no» e il secondo «sì», il piano non cambia.\n\n'
      + '⛔ **Il caveat del 4, portato dentro**: `slotAttesi` sul 4 risponde tre pasti, mentre '
      + '`slotsForMeals` del wizard conosce una giornata da quattro **con la merenda**. Oggi non capita '
      + '(zero diete a quattro in catalogo, il 4 tolto dal DTO), ma se torna questo conto va rifatto '
      + 'prima di rileggerlo — una cosa che oggi non capita non è una cosa che non può capitare.'
      + '\n\n▶️ **MISURATO IL 4/9 con `diag:fase0`, e quello che manca è finito.** 318 varianti (306 approvate), **26 618 ricette diverse** nominate, **23 316 attive**, **3 273 spente**, **29 inesistenti**. Stati: 237 complete, 68 rotte, 13 magre.\n'
      + '⛔ **144 varianti su 318 non arrivano a 60 piatti attivi su almeno un pasto**, ma di quelle **una sola ha clienti sopra**: la 16:8 · flexible · omnivore · dimagrimento · 3 pasti, che a **pranzo ha 12 piatti attivi** per **1 cliente**. Le altre 143 sono le magre senza clienti che il §2.3 dice che spariscono chiudendo le famiglie doppione. ⚠️ **Il numero che decide i tempi è 1, non 144.**\n'
      + '⛔ **E i riferimenti rotti sono 84, su 68 varianti**: da soli bastano a fermare la Fase 1, che mette la chiave esterna. Sono concentrati — Keto e Detossinante ne hanno 3 a testa — e **cinque varianti coi rotti hanno clienti sopra** (Mediterranea 3 pasti con 4 clienti, Flessibile 5 pasti con 3, Keto con 2, Flessibile 3 pasti con 2, Pescetariana con 2).\n'
      + '▶️ **Quindi la Fase 1 aspetta due cose sole, e sono finite**: i 29 piatti che non esistono più (le 84 righe che li nominano) e la variante magra con una cliente sopra. Non è «rifare il catalogo».',
  },
  {
    chiave: 'i-latti-vegetali-spariscono-a-chi-serve',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-31T20:30',
    titolo: '✅ «latte di cocco» non conta più come latte: i sostituti vegetali tornano nel piano di chi ha l\'allergia',
    dettaglio:
      'Trovato il 31/8 misurando, prima di scrivere la somma degli allergeni. Verificato su **tutte e '
      + 'due le porte** — il tag della ricetta (`suggestAllergens`) e il filtro che toglie il piatto dal '
      + 'piano (`hitsExclusion`), che leggono le stesse liste:\n\n'
      + '```\n'
      + 'latte di cocco      → latte              tolto a chi esclude il latte\n'
      + 'latte di soia       → soia, latte        tolto a chi esclude il latte\n'
      + 'latte di mandorla   → latte, frutta a guscio\n'
      + 'burro di arachidi   → arachidi, LATTE    tolto a chi esclude il latte\n'
      + 'burro di mandorle   → latte, frutta a guscio\n'
      + 'burro di cacao      → latte\n'
      + 'burro di sesamo     → sesamo, LATTE\n'
      + 'noce moscata        → frutta a guscio    tolta a chi è allergico alle noci\n'
      + 'noce di cocco       → frutta a guscio\n'
      + '```\n\n'
      + '⛔ **È il contrario della protezione.** I latti vegetali e i burri di frutta secca sono '
      + 'esattamente quello che una cliente allergica al latte deve poter mangiare — e sono proprio i '
      + 'piatti che il motore le toglie. La noce moscata è una spezia, non frutta a guscio: '
      + '`diag:fase0` la trova in **423** ricette.\n\n'
      + '⚠️ **E non si vede.** Un allergene di troppo non produce nessun errore: produce un menu più '
      + 'povero, su una persona che ha già meno scelta di tutte le altre, e che non ha modo di sapere '
      + 'che quel piatto esisteva. È la forma di difetto che questo progetto ha imparato a temere di '
      + 'più — quella che sbaglia in silenzio dalla parte che sembra prudente.\n\n'
      + '**Come si chiude**: `PAROLE_CHE_NON_SONO` funziona sulla singola PAROLA («bovino» per '
      + '«vino»), e qui la parola è identica alla chiave — «latte di cocco» contiene «latte» e basta. '
      + 'Serve un elenco di **frasi** (chiave → frasi che la contengono ma non sono lei), letto da '
      + 'tutte e due le porte: una copia sola, come `hitsExclusion`.\n\n'
      + '⛔ **Elenco chiuso e giustificato voce per voce, non una regola tipo «burro di X»**: `burro '
      + 'chiarificato` e `ghee` SONO latte, e `panna vegetale` e `formaggio vegano` restano fuori '
      + 'apposta — molti prodotti in commercio contengono caseinato, cioè proteina del latte. ⚠️ Qui '
      + 'l\'errore si fa nella direzione opposta e arriva davvero addosso a qualcuno: si toglie '
      + 'un\'esclusione solo dove si sa.\n\n'
      + '⚠️ **Prima i numeri**: `npm run diag:allergeni-mancanti` stampa, per ogni allergene, gli '
      + 'ingredienti che lo fanno scattare e su quante ricette. `exclusions.ts` ha una regola scritta '
      + 'apposta — le omonime nascono dalla diagnostica, non a mente — e vale anche qui.\n\n'
      + '⛔ **Bloccava la somma degli allergeni** (decisione 1, la via di mezzo): sommare prima di '
      + 'chiuderlo voleva dire scrivere questi falsi su ventitremila ricette.\n\n'
      + '✅ **CHIUSA il 31/8 sera.** `FRASI_CHE_NON_SONO` in `menu/exclusions.ts` — elenco chiuso di '
      + 'frasi, non una regola — letto da **tutte e quattro** le porte. ⛔ Le porte erano quattro e non '
      + 'due, e le altre due sono peggio: `lattosio.ts` e `sostituzioni-sicure.ts` non tolgono un '
      + 'piatto, **sostituiscono un ingrediente**, e su «latte di cocco» rispondevano «sostituisci con '
      + 'latte senza lattosio» — un derivato del latte **aggiunto** a un piatto che non ne aveva, su '
      + 'una cliente che il latte non può berlo. Il delattosato le proteine del latte le contiene '
      + 'tutte.\n\n'
      + '⛔ **`burro vegetale` è stato tolto dall\'elenco in revisione**: la margarina in commercio '
      + 'contiene spesso siero di latte. Era l\'unica riga che avrebbe lasciato passare un allergene '
      + 'vero, scritta dalla stessa mano che tre righe più su teneva fuori la panna vegetale per lo '
      + 'stesso motivo.\n\n'
      + '⚠️ **Restano dichiarati tre limiti**, misurati e scritti nel file invece che scoperti dopo: '
      + 'un qualificatore in mezzo riapre il falso («latte intero di cocco»); le sei chiavi sono '
      + 'asimmetriche e si allungano solo quando la diagnostica nomina un nome vero; e chi le nomina è '
      + '`npm run diag:allergeni-mancanti`, **non** `diag:esclusioni` — quello raccoglie solo la chiave '
      + 'dentro una parola più lunga, e «latte» in «latte di cocco» comincia una parola.\n\n'
      + '⚠️ **E il passato non è ripulito**: le ricette che hanno già il tag falso scritto in catalogo '
      + 'ce l\'hanno ancora. Si vedono rilanciando `diag:allergeni-mancanti` — saliranno nella sezione '
      + '«gli allergeni dichiarati che non risultano» — e si tolgono con un passo suo, che è l\'unico '
      + 'caso in cui questa consegna toglie un allergene invece di aggiungerlo.',
  },
  {
    chiave: 'allergeni-deducibili-i-due-numeri',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: false,
    nata: '2026-08-31T15:20',
    titolo: 'Panieri — i due numeri promessi a Nocanty: quante ricette si fermerebbero sugli allergeni dedotti',
    dettaglio:
      'Il foglio firmato il 31/8 (`progetto/Metabole_Allergeni_Firma_Nocanty.md`) promette al capo '
      + 'nutrizionista, al §5, **due numeri prima di scrivere una riga di codice di produzione**: quante '
      + 'ricette si fermerebbero sulla deduzione automatica e quante sono già in regola. Se il primo '
      + 'fosse alto, la proposta si rivede insieme.\n\n'
      + '✅ Lo strumento c\'è: `npm run diag:allergeni-deducibili` (sola lettura) e il modulo puro '
      + '`catalog/allergeni-deterministici.ts`. Resta da **lanciarlo sui dati veri**: qui in sandbox il '
      + 'database non c\'è.\n\n'
      + '⛔ **E il numero va letto, non riportato.** Misurato dalla revisione sulle 273 ricette vere del '
      + 'repo con le 306 righe di tabella dei seed: **si ferma l\'82%**. Ma i nomi che fermano di più non '
      + 'sono «trancio misto» — sono `insalata` (20), `zucchine` (13), `pomodoro` (11), `riso` (10), '
      + '`albumi` (10). Cioè quel numero misura soprattutto **quanto è indietro la tabella alimenti** '
      + '(306 righe contro 7831 nomi di ingrediente usati dalle ricette), non quanto sono scritte male '
      + 'le ricette. Portato a Nocanty così com\'è, gli farebbe bocciare l\'Opzione A per la ragione '
      + 'sbagliata. Per questo lo script stampa **tre** numeri e non due: si fermano · passano · si '
      + 'fermerebbero solo perché la riga in tabella non c\'è.\n\n'
      + '✅ **DECISO il 31/8 (sera): la via di mezzo**, scritta in `progetto/DECISIONI_Panieri.md` §1. '
      + 'Gli allergeni sono la **somma** di quelli dedotti dagli ingredienti e di quelli suggeriti '
      + 'dall\'AI (mai l\'AI da sola dove la deduzione dice di più), e una ricetta con un ingrediente '
      + 'non riconosciuto **non si ferma per tutte**: entra in catalogo e resta fuori **solo dai '
      + 'panieri di chi ha dichiarato quell\'allergia**, finché non la guarda qualcuno. ⚠️ Il catalogo '
      + 'parte alla velocità dell\'opzione C, e nessun allergene incerto arriva addosso a chi quel\n'
      + 'allergene ce l\'ha davvero.\n\n'
      + '⚠️ **La decisione ancora aperta, da prendere con Simone**: il riconoscimento passa da '
      + '`abbinaPerRicetta`, che è tarato sulle CALORIE — torna «non lo so» quando due righe vanno bene '
      + 'uguale, e non abbina un nome a cui manca una parola della riga («riso» non arriva a «riso '
      + 'basmati»). Per le calorie quella prudenza è giusta: `riso integrale` e `riso bianco` sono due '
      + 'numeri diversi. Per gli **allergeni** quell\'ambiguità non esiste — qualunque riso dà la stessa '
      + 'risposta. Il modulo eredita una prudenza che sul suo problema non serve, e ci ferma sopra delle '
      + 'ricette. O si tara il riconoscimento sulla domanda giusta, o si accetta una coda più lunga.\n\n'
      + '⛔ **Difetto trovato dalla revisione e chiuso**: `ingredientNames` scarta in silenzio gli '
      + 'elementi senza `name` leggibile, quindi `[{name:\'pollo\'}, {nome:\'gamberi\'}]` usciva con '
      + '`allergeni: []` — un elenco con dentro i gamberi che dichiara di non contenere niente. Adesso è '
      + 'un arresto (`elementi_illeggibili`). ⚠️ Non era ipotetico: `engine-rules.service.ts` scrive '
      + '`ingredients` come arriva dall\'AI, senza controllare la forma dei singoli elementi.\n\n'
      + '⚠️ **Resta aperto e dichiarato**: essere in tabella non vuol dire conoscerne gli allergeni. Su '
      + 'un «pesto pronto» che avesse la sua riga la deduzione direbbe «nessun allergene» con la stessa '
      + 'faccia. È il limite n° 2 del foglio, e si chiude dichiarando gli allergeni **sull\'alimento** — '
      + 'non allungando un elenco di parole.'
      + '\n\n▶️ **MISURATO IL 4/9: si fermano 19 956 su 23 726 (84,1%), passano 3 770 (15,9%).**\n'
      + '⛔ **Ma il sospetto era giusto: quella coda è la TABELLA, non le ricette.** Col criterio largo passerebbero 11 732 (49,4%) — cioè **7 962 ricette si fermano solo perché quell\'alimento non ha la sua riga**. La tabella ha **373 righe**; i nomi di ingrediente che fermano almeno una ricetta sono **8 129**.\n'
      + '⛔ **E il primo della lista non è nemmeno un alimento: «sale e pepe» ferma 3 577 ricette.** Con «sale pepe» (251) e «sale iodato» (201) fanno **quattromila ricette bloccate da un condimento che allergeni non ne ha**. Dietro: peperoncino 503, noce moscata 429, vaniglia in polvere 427, rosmarino 371, origano 334.\n'
      + '⚠️ **La curva è ripida all\'inizio**: i primi 10 nomi sbloccano **1 625** ricette, i primi 250 ne sbloccano **5 525** (27,7% della coda). La coda si chiude riempiendo la tabella, non riscrivendo le ricette — ed è questo che va portato a Nocanty, non il solo 84%.\n'
      + '⛔ **E una cosa che vale già oggi, indipendentemente dai panieri: 456 ricette dichiarano MENO di quello che hanno.** 471 guadagnerebbero **solfiti** — mix di frutta secca, uvetta, datteri — e sono già in catalogo, già «confermate», e a una cliente sensibile ai solfiti oggi risultano sicure. (194 ne perderebbero uno, quasi tutte latte: menu più poveri, non un rischio.)\n'
      + '⚠️ **Il limite del §4.2 è misurato e resta aperto**: 505 ricette (13,4%) passano avendo dentro un ingrediente dal nome di **preparazione** — «brodo vegetale», «hummus di ceci». La riga in tabella c\'è, quindi il sistema **non si ferma**: dice «nessun allergene» con la stessa faccia.',
  },
  {
    chiave: 'diagnostica-erogazione-muta',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T09:00',
    titolo: 'La diagnostica dell\'erogazione smette di tacere: le sospensioni in scheda, e un verdetto per ognuna delle 19 uscite',
    dettaglio:
      '⛔ **Il 23/8 una cliente vera è rimasta ferma per ore**, e i due strumenti che dovevano dirlo '
      + 'hanno taciuto tutti e due:\n\n'
      + '· `npm run diag:cliente` rispondeva «idonea» mentre il cancello era una **richiesta di pausa '
      + '17→23/8 auto-approvata**: le sospensioni non le mostrava affatto;\n'
      + '· `npm run prova:erogazione` stampava nove cancelli e poi «NESSUN giorno erogato», senza che '
      + 'niente lo spiegasse. `deliverIfEligible` ha **diciannove** uscite a mano vuota, molte '
      + 'silenziose: il tabulato ne guardava nove, e si fermava proprio dove stava la risposta.\n\n'
      + '✅ **Le sospensioni si leggono una volta sola** (`clients/sospensioni-di-una-cliente.ts`) e la '
      + 'usano in due: la scheda in back office e lo script. Periodi veri con l\'origine, richieste '
      + 'anche già decise con chi ha deciso, storico della card, periodi dichiarati tenuti separati.\n\n'
      + '✅ **E il verdetto li guarda**: rami nuovi per «sospesa» e «visita clinica scaduta». ⛔ La prima '
      + 'stesura aggiungeva la tabella e lasciava la conclusione a «idonea» — cioè il difetto dov\'era, '
      + 'creduto chiuso. ⚠️ E «in corso» non vuol dire «ferma»: nell\'ultimo giorno sospeso la finestra '
      + 'di rientro è aperta e il motore eroga il menu del giorno di rientro.\n\n'
      + '✅ **Un verdetto ✓/⛔ per ognuna delle 19 uscite**, con i numeri e con il valore **grezzo** dei '
      + 'tre parametri. Le domande passano dalle stesse porte del motore: il cancello della pausa '
      + 'confrontava `end_date` con l\'**istante**, quindi dalle 00:00 rispondeva diversamente dal '
      + 'servizio. Sentinella: `menu/una-porta-per-i-cancelli.spec.ts`.\n\n'
      + '⛔ **`Number(\'\')` fa ZERO, non NaN**: una casella svuotata diventava uno zero silenzioso, e '
      + 'su `menu_days_delivered` lo zero spegne l\'erogazione **per tutte** da un\'uscita muta. Ora si '
      + 'ripiega e lo si scrive; `update` rifiuta il vuoto e i soli spazi. Stesso silenzio su '
      + '`getBool`, dove costa di più (una casella vuota su `payment_method_card_enabled` toglie un '
      + 'metodo di pagamento dal carrello).\n\n'
      + '⛔ **Una diagnosi mia ritirata**: avevo scritto che con `menu_visible_days_before_return` a '
      + 'zero «la finestra non si apre mai» e che era la forma del giallo del 23/8. Misurato in '
      + 'revisione: falso — il giorno del rientro `pausaAppenaFinita` eroga lo stesso, quindi si perde '
      + 'un giorno d\'anticipo, non il menu. La correzione resta, la diagnosi è scritta come ipotesi '
      + 'ritirata invece che cancellata.',
  },
  {
    chiave: 'giallo-finestra-di-rientro',
    fatta: true,
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    nata: '2026-08-24T09:30',
    titolo: '✅ Chiusa il 27/8: il giallo del 23/8 non si è ripetuto',
    dettaglio:
      '✅ **CHIUSA il 27/8. Simone: «non è capitato, chiudi».** L\'attesa era la risposta giusta per la '
      + 'forma di questo problema — un caso solo, non riprodotto, con tre ipotesi già smontate — e ha dato '
      + 'il risultato che l\'attesa doveva dare: **nessun secondo caso**. ⚠️ E se dovesse ricapitare non si '
      + 'ricomincia da capo: `npm run prova:erogazione -- <email>` dà un verdetto ✓/⛔ per ognuna delle diciannove '
      + 'uscite, e la riga ⛔ dice quale cancello ha fermato l\'erogazione. È quello strumento che ha reso '
      + 'sicuro aspettare, ed è il motivo per cui questa voce si chiude senza sapere cosa fosse.\n\n'
      + '## Il testo di prima\n\n'
      +
      '✅ **RISPOSTA DI SIMONE, 25/8: «completiamo tutta la struttura e vediamo se si ripete».** '
      + 'Questa voce quindi **non aspetta più una decisione**: aspetta un secondo caso, o nessuno.\n\n'
      + '⚠️ **È la risposta giusta per la forma che ha questo problema.** Un caso solo, non '
      + 'riprodotto, con tre ipotesi già smontate: continuare a cercarlo a tavolino è il modo in cui '
      + 'si scrivono correzioni per difetti che non esistono — e il 23 e il 24 due ipotesi ragionate '
      + 'sono già andate a vuoto proprio così.\n\n'
      + '⛔ **Quello che rende sicura l\'attesa è che adesso si legge.** `npm run prova:erogazione -- '
      + '<email>` dà un verdetto ✓/⛔ per **ognuna** delle venti uscite, coi numeri e col valore grezzo '
      + 'dei parametri: **se ricapita, la riga ⛔ dice quale**. ⚠️ «Ognuna» è vero **dal 25/8**: la '
      + 'ventesima — le esclusioni non sostituibili — era una frase fissa senza ✓ e senza ⛔, l\'unica '
      + 'delle venti, e l\'ha trovata la revisione avversariale. Un\'attesa fondata su un tabulato che '
      + 'ha un buco proprio dove si aspetta è un\'attesa che non finisce. Senza quel tabulato aspettare voleva dire '
      + 'aspettare di non capire una seconda volta. ⚠️ E se sono tutte ✓, allora è il tabulato a '
      + 'essere incompleto e si estende prima di cercare altrove.\n\n'
      + '## I fatti, per chi lo ritrova\n\n'
      + '⚠️ **Fatti misurati il 23/8 (~9:04 UTC)**: codice nuovo deployato, cliente con piano IN CODA '
      + 'che partiva il 24/8, pausa 17→23/8, pesata del 23/8, anticipo 1. Tutti i cancelli stampati ✓ '
      + 'tranne «pausa attiva ⛔», erogazione uscita VUOTA, zero log, zero blocchi. Subito dopo, '
      + 'troncando la pausa a ieri, la **stessa** `deliverIfEligible` ha erogato 24 e 25.\n\n'
      + '⛔ **Non è spiegato, e non si spiega a tavolino**: su questo caso due ipotesi ragionate sono '
      + 'già andate a vuoto il 23/8, e una terza (il parametro dell\'anticipo a zero) l\'ha smontata la '
      + 'revisione il 24/8 misurandola — con l\'anticipo a zero si perde un giorno d\'anticipo, non il '
      + 'menu, perché il giorno del rientro `pausaAppenaFinita` eroga lo stesso.\n\n'
      + '✅ **Quello che è cambiato è che adesso si legge**: `npm run prova:erogazione -- <email>` dà '
      + 'un verdetto ✓/⛔ per ognuna delle 19 uscite, con i numeri e con il valore grezzo dei '
      + 'parametri. **Se ricapita, la riga ⛔ dice quale.** E se sono tutte ✓, allora è il tabulato a '
      + 'essere incompleto, e va esteso prima di cercare altrove.\n\n'
      + 'Spiegazioni ancora sul tavolo, nessuna esclusa: la finestra di rientro non ancora in '
      + 'produzione in quel momento; `mancaLaPesataDelRientro` (che però manda una push, quindi una '
      + 'traccia la lascia); `menu_days_delivered` a zero o vuoto (uscita davvero muta); date '
      + 'dell\'evento e della richiesta di pausa in disaccordo — che è proprio quello che la sezione '
      + 'SOSPENSIONI nuova renderebbe visibile.',
  },
  {
    chiave: 'tabella-ig-import',
    nata: '2026-08-13',
    titolo: 'Indice glicemico: trascrizione VERIFICATA contro la tabella vera — resta solo da lanciare',
    dettaglio:
      'PDF del 13/8 (Linus Pauling / International Tables 2008): IG con min e max, affidabilità, macro per 100 g, stato e fonte. Il codice c\'era già da allora — `prisma/dati-ig.ts` (96 righe trascritte) e `npm run importa:ig` (anteprima, scrive solo con `CONFERMA=1`). ⚠️ **Il 18/8 Simone ha caricato il file originale in xlsx e ho confrontato riga per riga: 96 righe su 96, ZERO differenze** su nome, categoria, stato, IG, IG min, IG max, kcal, proteine, carboidrati, grassi, fibre e affidabilità. Era la verifica che mancava: 96 righe di dati clinici trascritti a mano, e un refuso su una kcal sarebbe finito in quello che Gaia dice alle clienti. ⚠️ Il crudo/cotto **è sciolto**, ed è la ragione per cui l\'import è sbloccato: ogni riga porta lo **stato esplicito**, e la pasta lì è BOLLITA (158 kcal/100 g) — usare il valore da crudo sbaglierebbe di due volte e mezzo. Si carica **confermato** (`verifiedById` = capo nutrizionista, `verifiedAt` valorizzato), perché «vuoti = da confermare» finirebbe in una coda che nessuno ha chiesto. Le tre sorti di una riga: nome nuovo → si crea; nome già in tabella **senza** IG → si aggiunge **solo** l\'IG (⚠️ le macro esistenti non si toccano: potrebbero essere state curate a mano); nome già in tabella **con** IG → non si tocca niente. ⛔ **Resta solo da lanciarlo in produzione**: `npm run importa:ig` per l\'anteprima, poi `CONFERMA=1`.',
    categoria: DATI,
    ordine: 20,
    blocca: false,
    // ⚠️ CHIUSA: Simone l'ha lanciata sulla shell di Render e in pagina risulta fatta. Restava
    // aperta **solo in questo file**, e il 19/8 gliel'ho ripresentata come se aspettasse ancora lui
    // — «la tabella IG quante volte te la devo dare?». Il file non è lo stato: lo stato è la
    // pagina, e quando i due divergono il file racconta lavoro che non esiste.
    fatta: true,
  },
  {
    chiave: 'vera-regola-dieta-scoperte',
    titolo: 'Le clienti che un divieto di dieta lascerebbe senza un pasto: l\'elenco arriva al capo — verificato il 18/8',
    dettaglio:
      'Decisione di Simone (13/8): chi resta scoperta si salta e si segnala al capo con nome e cognome. ⚠️ **Verificata chiusa il 18/8 rileggendo il codice**: la voce era rimasta aperta ma il lavoro c\'era già. `applica-proposta.ts:213` calcola l\'elenco **nel momento in cui il capo approva** — non dopo, non in una coda — e lo mette nel messaggio che sta leggendo: «⚠️ N clienti resterebbero senza un pasto e per loro il divieto NON vale: …». Finché quell\'elenco non arriva, la regola *sembra* applicata a tutte. ⚠️ E se il conto si rompe **non si finge un elenco vuoto**: si scrive nei log e lo si dice, perché «non lo so» non è «nessuno». La regola vale comunque: perdere la scrittura per un conteggio non partito sarebbe il guasto peggiore.',
    categoria: CODICE,
    ordine: 16,
    fatta: true, // verificata il 18/8: era già implementata
  },
  {
    chiave: 'vera-azione-3-variante-piano',
    titolo: 'Vera: azione 3 — la variante di piano per una cliente (tutti e tre i meccanismi)',
    dettaglio:
      'Chiusa il 14/8, tutte e tre le frasi che Simone aveva chiesto il 13/8. «Togli lo spuntino» → `ClientProfile.pastiEsclusi`, kcal ridistribuite sui pasti rimasti. «Rifai con più proteine» → `ClientProfile.proteinMinPct`, che vince SOLO sul minimo della dieta. «A colazione qualcosa di salato» → `vera/colazioni.ts`, che pesca dal pool per tag `piatto:salato` (il codice c\'è; resta SPENTA finché Lucia non ha confermato abbastanza colazioni — è la voce `colazioni-dolce-salato`, non questa). ⚠️ In tutti e tre i casi si toccano solo i giorni futuri non ancora aperti, e la cliente NON si sposta di dieta.',
    categoria: CODICE,
    ordine: 17,
    blocca: false,
    fatta: true, // chiusa il 14/8: spuntino + proteine + colazione salata
  },
  {
    chiave: 'nocanty-solfiti',
    blocca: true,
    titolo: 'L\'elenco dei solfiti da escludere',
    dettaglio:
      'Oggi l\'esclusione testuale ha solo la parola letterale «solfiti», dichiarato nel codice e in un test. I solfiti non si scrivono negli ingredienti: stanno nel vino, nell\'aceto balsamico, nella frutta disidratata, in certi salumi. Quell\'elenco decide quali piatti si tolgono dal piatto di una cliente, e in eccesso si sbaglia facilmente. Handoff allergie §1.2.',
    categoria: NOCANTY,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'nocanty-soglia-visita',
    blocca: true,
    titolo: 'Quando far partire «serve la visita» in automatico',
    dettaglio:
      'Allergia dichiarata → richiesta di visita: il MODO di rispondere ora c\'è (via libera clinico, 13/8), la soglia è materia clinica. Handoff §8.',
    categoria: NOCANTY,
    ordine: 20,
    fatta: true, // risposta di Nocanty del 13/8: implementata (Decisioni §15)
  },
  {
    chiave: 'nocanty-freno-forte',
    blocca: true,
    titolo: 'Il «freno forte» per le allergie non confermate',
    dettaglio:
      '`allergieDichiarateIl` c\'è e si scrive, ma nessun comportamento parte da lì. Forma minima e sicura proposta: personal-base segnala la cliente come da rivedere e nella scheda compare «allergie non confermate». ⚠️ Non bloccare il piano di 315 clienti perché un campo nuovo è vuoto.',
    categoria: NOCANTY,
    ordine: 30,
    fatta: true, // risposta di Nocanty del 13/8: implementata (Decisioni §15)
  },
  {
    chiave: 'nocanty-scala-passi',
    titolo: 'La scala dei passi: 6.000 sedentaria → 12.000 molto attiva',
    dettaglio:
      '+5% ogni due settimane, tetto a +40% (decisione dell\'8 del 12/8). Per chi ha problemi cardiaci, articolari o è in gravidanza prescrivere passi è materia clinica.',
    categoria: NOCANTY,
    ordine: 40,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'nocanty-peso-efficacia',
    titolo: 'Il peso dell\'efficacia nei menu (`menu_select_w_eff`)',
    dettaglio:
      'Con i pesi di default un piatto a 5★ ora pareggia un piatto efficacissimo bocciato a 1★ (prima vinceva sempre l\'efficacia). È una manopola dei Parametri, e la gira lei.',
    categoria: NOCANTY,
    ordine: 50,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'nocanty-kcal-conferma',
    titolo: '§15.2 punto 1 — la correzione kcal a termine, dettata all\'assistente',
    dettaglio:
      'Chiusa dalla risposta di Nocanty del 13/8 («riduci le kcal del 10% per 7 giorni e poi riprendi col normale ritmo, e vorrei farlo anche dalla mia assistente») e dalla consegna del 14/8: `ClientProfile.kcalAdjustPct` esisteva già, si è aggiunta la DURATA (`kcalAdjustUntil`, migrazione additiva, NULL = per sempre come prima) e Vera la detta a voce con l\'anteprima dei due numeri prima di scrivere. ⚠️ Sotto la soglia minima di sicurezza si ferma: quella conferma si dà dalla scheda.',
    categoria: NOCANTY,
    ordine: 60,
    fatta: true, // risposta 13/8 + consegna 14/8: kcalAdjustUntil e la dettatura a voce
  },
  {
    chiave: 'deploy-allergie-idoneita',
    blocca: true,
    titolo: 'Deploy: migrazione + backend su Render, poi backoffice su Vercel',
    dettaglio:
      '⚠️ L\'ordine conta: migrazione → backend (deve reggere l\'app vecchia) → backoffice → OTA. Le migrazioni del 13/8 sono additive.',
    categoria: SIMONE,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'conta-allergie',
    blocca: true,
    titolo: 'Lanciare `npm run conta:allergie` sulla shell di Render',
    dettaglio:
      'È in sola lettura e non scrive niente. ⚠️ Va letto PRIMA di decidere qualsiasi campagna: se la terza popolazione è la maggioranza, quella non è una campagna ma una pagina del questionario che non raccoglie. Blocca il §7.',
    categoria: SIMONE,
    ordine: 20,
    // ⚠️ CHIUSA: lanciata, e l'esito è arrivato (le 21 clienti da ricontattare). Stessa storia della
    // tabella IG: restava aperta solo qui.
    fatta: true,
  },
  {
    chiave: 'ota-2-1-8',
    titolo: 'OTA dell\'app: si riparte da 2.1.8',
    dettaglio:
      '⚠️ Non prima che il backend sia in produzione e verificato, e il numero di versione non si riusa mai.',
    categoria: SIMONE,
    ordine: 30,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'decisione-blocco-percorso',
    titolo: 'Percorso senza via libera clinico: NON si blocca, i problemi clinici vanno in testa',
    dettaglio:
      'Chiusa dalla risposta di Simone del 13/8: «se ci sono problemi clinici vanno in testa a tutte le richieste di Vera per il nutrizionista». Quindi niente blocco — bloccare vorrebbe dire sospendere piani attivi a clienti paganti — ma priorità: `guidaGiornata` conta le segnalazioni CLINICHE a parte e le mette come prima riga del quadro, prima della coda del capo, delle domande aperte e delle sostituzioni. Consegnato il 14/8.',
    categoria: SIMONE,
    ordine: 40,
    fatta: true, // risposta 13/8 + consegna 14/8: le cliniche in testa a guidaGiornata
  },
  {
    chiave: 'whatsapp-numero',
    fatta: true,
    titolo: '✅ Chiusa il 27/8: il numero WhatsApp dedicato «al momento non serve» (Simone)',
    dettaglio:
      '✅ **CHIUSA il 27/8. Simone: «al momento non serve».** Non è un rinvio a settembre come il 14/8: '
      + 'esce dall\'elenco.\n\n'
      + '⛔ **E la prima stesura di questa chiusura diceva una cosa falsa**, trovata in revisione la sera '
      + 'stessa: «il codice dice da sé cosa manca». Non lo diceva — «WhatsApp» compariva nel backend solo '
      + 'in una parentesi incidentale, e la descrizione del passo 2 viveva **soltanto qui dentro**. Siccome '
      + 'l\'elenco che si incolla in chat esporta **solo le voci aperte**, chiuderla avrebbe fatto sparire '
      + 'il passo 2 — cioè esattamente quello contro cui questa voce argomentava fino a ieri: *«i lavori a '
      + 'metà che escono dall\'elenco tornano come sorprese»*. ✅ Adesso è vero: il passo mancante è scritto '
      + 'nel docblock di `mail.service.ts`, accanto al passo 1 che lo aspetta. La decisione di Simone resta; '
      + 'la motivazione l\'ho dovuta rifare.\n\n'
      + '## Il testo di prima\n\n'
      + '📅 **RISPOSTA DI SIMONE, 14/8: «lasciamolo in sospeso per ora, lo affrontiamo a settembre».** '
      + 'Non aspetta più una decisione: aspetta il mese. Resta in elenco perché il passo 1 senza il '
      + 'passo 2 è un lavoro **a metà**, e i lavori a metà che escono dall\'elenco tornano come '
      + 'sorprese.\n\n'
      + 'È la parte lenta delle credenziali via WhatsApp: il passo 1 (link al posto della password) è '
      + 'fatto dal 7/8, il resto aspetta il numero — non il codice.',
    categoria: SIMONE,
    ordine: 60,
  },
  {
    chiave: 'par7-ridomanda-chat',
    titolo: '§7 — la ri-domanda sulle allergie in chat con Gaia',
    dettaglio:
      '⚠️ Non si comincia senza aver letto l\'output di `conta:allergie`. Modello da copiare: `menu/data-inizio-chat.ts` (non «Conosciamoci»). Trappole già mappate: un solo flusso aperto per volta, scadenza a un\'ora (si riapre, non si riprende), niente pulsanti in chat, risposte libere da far confermare, transazione + audit perché è un dato sanitario.',
    categoria: CODICE,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'visita-calendario',
    titolo: '«Serve una visita» adesso lo sa anche la coach: l\'attività si apre da sola',
    dettaglio:
      'Chiusa il 18/8. La nutrizionista sceglieva «serve una visita», scriveva la nota obbligatoria e salvava: da lì in poi la decisione era sul profilo, la nota nella lista note, le segnalazioni cliniche chiuse — e ⚠️ **la visita non la fissava nessuno**. L\'unico modo perché succedesse qualcosa era che qualcuno si ricordasse di riaprire quella scheda, su una decisione **clinica**. ⚠️ **Scartato l\'appuntamento creato da solo**: un appuntamento vuole un orario, e l\'orario dipende dall\'agenda della nutrizionista e da quando può la cliente — scriverne uno a caso vuol dire metterne in calendario uno che qualcuno dovrà disdire. E c\'è un secondo cancello che lo rende impossibile: `prenotazioni.service` lascia prenotare **solo chi una visita l\'ha comprata** (Simone, 12/8), quindi per chi non ce l\'ha la strada non finisce con un orario ma con un acquisto. Ora nasce un\'**attività della coach** (`visita_da_fissare`), come per la finestra del digiuno: è il posto dove in questo progetto una cosa da fare diventa lavoro di qualcuno. ⚠️ Nel testo c\'è **quante visite le restano**, ed è il numero che cambia la telefonata: senza, la coach propone un orario e la cliente si sente rispondere dall\'app «serve prima acquistarla dal negozio» — una figura fatta fare a lei su una cosa che sapevamo già. ⚠️ Tre stati: ne ha · non ne ha · **non lo so** (se il credito non si è potuto contare non si scrive né l\'uno né l\'altro). ⚠️ Il **motivo clinico non si copia** nell\'attività: la nota è già nella lista note con autore e ora, e due copie di un dato sanitario divergono — si dice dov\'è. ⚠️ `refId` è il **giorno della decisione** (`serve_visita:AAAA-MM-GG`, fuso aziendale): due salvataggi dello stesso giorno sono la stessa cosa, una valutazione nuova domani apre la sua. **Correzione della sera stessa**: prima era l\'id della nota, e con una nota creata a ogni salvataggio non poteva collidere mai — quindi risalvare apriva una seconda attività e mandava una seconda push, il contrario di quello che il commento prometteva. ⚠️ L\'attività passa da `apriAttivita`, che è il punto unico da cui nascono le attività **e** da cui parte la push alla coach: una seconda strada avrebbe creato un tipo che non avvisa nessuno, e non si sarebbe visto perché in elenco ci sarebbe stato lo stesso. ⚠️ Sotto `catch`, con l\'errore nei log: un\'attività non aperta è un lavoro in più, un\'eccezione qui sarebbe una decisione clinica che non si salva. E nel backoffice la nutrizionista **legge se è successo**: «Ho aperto un\'attività alla coach» oppure «l\'attività c\'era già da oggi: l\'ho aggiornata» — senza, non avrebbe modo di distinguere «l\'ho detto a qualcuno» da «l\'ho scritto e basta». ⚠️ **E «c\'era già» è un successo, non un errore**: nella prima versione il backoffice traduceva quel caso in «NON risulta aperta», che dal momento in cui `refId` è diventato il giorno è il **secondo salvataggio normale**. ⚠️ La push però nasce con l\'attività e non riparte: se nel frattempo è stata assegnata una coach, la scheda lo dice. 11 test nuovi. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 20,
    fatta: true, // 18/8
  },
  {
    chiave: 'coda-da-validare-b-c',
    nata: '2026-08-13',
    categoria: CODICE,
    fatta: true, // chiusa il 28/8
    titolo: 'Coda «Da validare»: l\'aumento delle calorie lo autorizza il nutrizionista, e resta scritto in scheda',
    dettaglio:
      '✅ **CHIUSA il 28/8, tutte e due le metà.** Era aperta dal 13/8 e ferma da settimane su un numero '
      + 'che doveva dare Nocanty — «di quanto si alzano le calorie» — e quel numero non serve più. Simone, '
      + '27/8: *«Vera lo chiede al nutrizionista che risponde, e la sua risposta si salva nelle note della '
      + 'scheda cliente (aumento calorie autorizzato da… il…)»*.\n\n'
      + '✅ **(1) La nota.** Ogni cambio di calorie lascia una riga nelle note della scheda: *«Aumento '
      + 'calorie autorizzato da Dr.ssa Bini il 28/08/2026: da 1600 a 1760 kcal/giorno (+10% per 7 giorni, '
      + 'fino al 04/09/2026). Motivo: «…»»*. ⚠️ Scritta in `impostaKcal` e **non** nell\'azione della coda: '
      + 'le porte che cambiano le calorie sono tre — la card in scheda, Vera che detta la correzione, e da '
      + 'oggi la coda — e tutte e tre passano di lì. Scrivendola solo su una, la stessa decisione presa da '
      + 'un\'altra porta non lascerebbe traccia dove la coach la cerca.\n\n'
      + '⛔ **Il verso lo dice il TARGET, non il segno della percentuale**: togliere 200 kcal di deficit alza '
      + 'il piatto senza nessuna percentuale positiva. La nota legge `targetPrima → targetDopo`, che è il '
      + 'numero che arriva nel piatto (`nutritionist/nota-kcal.ts`).\n\n'
      + '✅ **(2) L\'aumento arriva davvero nel piano** — il difetto vecchio, quello per cui «Presa visione» '
      + 'scriveva `reviewOutcome`, un campo che nessuno leggeva. Nella finestra di «Correggi…» c\'è ora '
      + '**«Alza le calorie»**: il nutrizionista scrive di quanto e per quanti giorni, e la percentuale '
      + 'passa da `impostaKcal` — con il perimetro, la soglia di sicurezza, lo storico `kcal_override`, '
      + 'l\'audit, l\'avviso ai capi e la rigenerazione dei giorni futuri. ⚠️ **Non reimplementa niente**: è '
      + 'la stessa porta della scheda, chiamata da dove la decisione si prende davvero.\n\n'
      + '⚠️ **E il livello 2 non esiste** (315 diete a livello 1): per questo si passa dalla correzione '
      + 'percentuale e non da `levelDelta`, come già scritto qui il 18/8.\n\n'
      + '⚠️ **`action.menu` arriva finalmente davanti a chi decide**: il motore scriveva `increase_calories` '
      + 'sulle decisioni in cui proponeva di alzare le calorie, e quel valore finiva soltanto nel payload di '
      + 'una notifica (`notifications.service`) — cioè viaggiava e non cambiava niente. ⚠️ La prima stesura di '
      + 'questa riga diceva «non lo leggeva nessuno»: **falso**, e l\'ha smentito la revisione. Ora la finestra '
      + 'lo dice — e lo dice soltanto: non preseleziona niente, perché un modulo che parte già compilato è un '
      + 'modulo che si conferma senza leggere.\n\n'
      + '⛔ **Il difetto più insidioso, evitato in scrittura**: `impostaKcal` normalizza a `null` quello che '
      + 'non riceve, quindi passando solo la percentuale un **deficit imposto** dal nutrizionista settimane '
      + 'prima sarebbe sparito in silenzio — cioè «alza del 10%» ne avrebbe alzate molte di più. Si rilegge '
      + 'e si riscrive uguale, e c\'è un test che lo tiene fermo.\n\n'
      + '⚠️ **Il cartello in pagina è cambiato con il codice**: diceva che «in nessuno dei due casi» il piano '
      + 'veniva toccato, ed era vero fino al 27/8. Lasciarlo avrebbe fatto premere un pulsante a chi ha '
      + 'appena letto che non fa niente.\n\n'
      + '## Come ci si è arrivati\n\n'
      + '⚠️ **Voce corretta il 18/8 rileggendo il codice**: diceva «restano le consegne B e C», ma la **B era '
      + 'già stata consegnata il 12/8** — le azioni per causa vivono in `engine/causa-decisione.ts`. La **C** '
      + 'era «Conferma applica la proposta»: ✅ il 19/8 Simone ha scelto di rinominare il pulsante in **«Presa '
      + 'visione»** invece di farlo applicare, perché un clic di presa visione non deve cambiare il piano di '
      + 'una persona. Quella scelta regge ancora: l\'aumento non lo applica un clic di lettura, lo scrive '
      + 'qualcuno che digita un numero e un motivo.',
    ordine: 30,
  },
  {
    chiave: 'vera-verifica-mac',
    blocca: true,
    titolo: 'Vera Consegna 2: `npm run typecheck` e `app.module.spec` nel terminale del Mac',
    dettaglio:
      '⚠️ Prima serve `npx prisma generate`: il client generato sul Mac è più vecchio dello schema, e senza rigenerarlo il type-check mostra errori che non esistono.',
    categoria: MANUTENZIONE,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'rimuovi-traccia-diet-family',
    titolo: 'La trappola su `dietFamily` è stata tolta: aveva finito il suo lavoro',
    dettaglio:
      'Tolta la notte fra il 18 e il 19/8, e i file erano tre: `src/prisma/traccia-diet-family.ts`, il suo `.spec` e l\'aggancio in `prisma.service.ts`. ⚠️ **La data era un modo di dire una condizione** — «quando il colpevole è stato trovato e corretto» — e la condizione era vera dall\'11/8. **E la risposta resta scritta**, che è la parte che conta e che la trappola stessa chiedeva di non perdere: **nessuno riscriveva `dietFamily`**. Le `ops` di `updateClient` venivano costruite e **mai eseguite**, perché mancava il `$transaction`: le operazioni di Prisma sono pigre. La dieta spostata cinque volte da tre persone non tornava indietro — non era mai partita, e l\'audit raccontava una modifica che non c\'era perché la calcola dai valori **richiesti**. La lezione, che vale più della trappola: quando l\'audit racconta una modifica e il database non la conosce, la domanda non è «chi la sovrascrive» ma «quella scrittura viene eseguita?». Il commento resta in `prisma.service.ts`, dove la trappola stava.',
    fatta: true, // 19/8
    categoria: MANUTENZIONE,
    ordine: 20,
  },
  {
    chiave: 'ios-target-15',
    titolo: 'iOS: il deployment target sale a 15.0, e lo rimette lo script',
    dettaglio:
      'Fatto il 16/8, come avevi detto («alla prossima pubblicazione, la 2.2.0, lo facciamo»). Capacitor genera 13.0; dalla primavera 2027 App Store Connect rifiuta gli upload costruiti su un minimo così basso — è una scadenza, non un\'opinione. ⚠️ Sta in `scripts/install-ios.mjs` e non fatto a mano in Xcode, per la stessa ragione di tutto il resto di quel file: `ios/` viene rigenerato e ogni cosa che vive solo nel progetto Xcode sparisce con lui, senza dare nessun errore — la build passa lo stesso. ⚠️ Si tocca anche il PODFILE: se `platform :ios` resta a 13.0, CocoaPods costruisce i pod per 13 mentre l\'app dichiara 15, ed è il tipo di disallineamento che fa saltare un pod la sera sbagliata. ⚠️ E lo script VERIFICA il proprio risultato: se resta anche un solo target sotto il minimo esce con errore, invece di dire «fatto».',
    categoria: MANUTENZIONE,
    ordine: 30,
    fatta: true, // fatta il 16/8, prima della 2.2
  },
  {
    chiave: 'aggiornamenti-grossi',
    titolo: 'Aggiornamenti grossi: React 18, Vite 5, Prisma 6, Capacitor 6',
    dettaglio: 'Da fare in una sessione tranquilla, non insieme ad altro. ✅ **Chiusa il 20/8: erano già tutti e quattro fatti.** Simone: «c\'è altro che puoi fare?» — e siccome poche righe prima avevo detto che questa era l\'unica voce di codice rimasta mia, sono partito per aggiornare React. ⛔ **React è già alla 18.3.1**, in `app/` e in `backoffice/`; Vite alla **5.4.6**, Prisma alla **6.10.0**, Capacitor alla **6.1.2**. Stavo per aggiornare una libreria a una versione su cui è già. ⚠️ La voce è del 13/8, quando quelli erano i bersagli: sono stati raggiunti strada facendo, dentro altri lavori, e nessuno è tornato a spuntarla. **È la quarta volta in due giorni** che una voce descrive come da fare un lavoro finito — dopo «Schermate app 30», «Vera: rifare i giorni futuri» e il commento bugiardo in `applica-proposta.ts`. ⚠️ *Il costo non è la voce aperta: è che ci si mette a farla.* Le prime tre le ho scoperte leggendo il codice prima di scrivere; questa l\'ho scoperta con `package.json` aperto e le mani già sulla tastiera. ⛔ **Non l\'ho allargata ai major successivi** (React 19, Vite 6, Capacitor 7 esistono): sarebbe un\'altra decisione, non questa — e la voce diceva «una sessione tranquilla, non insieme ad altro», che vale per quella nuova esattamente come valeva per questa.',
    categoria: MANUTENZIONE,
    ordine: 40,
    fatta: true,
  },
  /**
   * ⚠️ QUI C'ERA UNA SECONDA COPIA delle voci di Vera, trascritta il 13/8 dall'altra sessione mentre
   * questa scriveva le sue consegne. Le stesse cose con chiavi diverse (`vera-moduli-dashboard` e
   * `vera-dashboard`, `ai-assistant-enabled` e `vera-ai-assistant-enabled`, …): al primo
   * `carica:lavori` sarebbero diventate quattro righe doppie in pagina — e «due righe per la stessa
   * decisione sono il modo in cui una lista comincia a non essere creduta», che è l'avvertenza
   * scritta proprio sopra quel blocco.
   *
   * Restano le versioni con il dettaglio lungo, qui sotto: dicono anche PERCHÉ, e una voce che non
   * dice perché, in tre settimane, non si sa più se è ancora vera.
   */
  {
    chiave: 'varianti-3-pasti',
    titolo: 'Generare le varianti a 3 pasti e digiuno per le famiglie esistenti',
    dettaglio:
      'Il codice è pronto dal 17/7: restano i DATI. Si aprono le famiglie nel wizard, si spuntano «3 pasti» e «Digiuno intermittente», «Genera tutte le varianti» (aggiunge solo le mancanti), poi validare e pubblicare. Le vecchie diete «Digiuno intermittente (16:8)» a 5 pasti vanno archiviate a mano.',
    categoria: DATI,
    ordine: 10,
    fatta: true, // risposta di Simone in pagina: generate, il team ci sta lavorando (due settimane per variante)
  },
  // ── Vera, l'assistente della nutrizionista (consegne 1-3a + contratto richieste, 12-13/8) ──
  {
    chiave: 'vera-citazione-incollato',
    titolo: 'Vera: il testo INCOLLATO non comanda l\'assistente',
    dettaglio:
      'Chiuso. `separaCitazione` (`capisci.ts`) divide quello che la nutrizionista scrive di suo pugno da quello che ha incollato, e `nuovoGiro` lo usa PRIMA di capire: se dentro la citazione c\'è qualcosa di azionabile e fuori no, l\'agente lo dice e si ferma (`testi.dallaCitazione`). ⚠️ È il cancello che impedisce a un messaggio scritto da qualcun altro di comandare chi ha il potere di scrivere regole su persone vere. Specifica §9.1.',
    categoria: CODICE,
    ordine: 210,
    fatta: true, // verificato nel codice il 16/8: separaCitazione in uso in nuovoGiro
  },
  {
    chiave: 'vera-dashboard',
    titolo: 'Dashboard «quello che aspetta me»: c\'è anche il pool sotto soglia — il quarto modulo',
    dettaglio:
      'La §13.3 chiedeva quattro moduli per la nutrizionista: proposte ferme dal capo, domande di dizionario senza risposta, sostituzioni da verificare e **pool sotto soglia**. I primi tre c\'erano; il quarto no, e la voce diceva «prima va deciso QUANDO calcolarlo», perché contare il pool di 315 clienti a ogni apertura della pagina sembrava caro. ⚠️ **Non lo è, e la ragione è che il pool non è della cliente: è della DIETA.** Le esclusioni sono sue, il pool no — e le diete sono poche. Si leggono i pool **una volta per dieta**, poi il conto per ogni cliente è aritmetica in memoria: la domanda si può fare a ogni apertura, invece che in un lavoro notturno con un numero vecchio di ore. Nuovo `vera/clienti-pool-scoperto.ts` (modulo puro) che riusa `calcolaPool` — non una sua copia, perché due conti della stessa cosa prima o poi divergono e nessuno se ne accorge. ⚠️ **Tre stati, non due**: una cliente **senza dieta** non è una cliente a posto, è una di cui non sappiamo niente, e finisce in `nonValutabili` con una chip sua («N da guardare a mano»); se il conto si rompe la risposta è `null` e la chip dice «pool non calcolato». Contare le non valutabili fra le sane darebbe un numero rassicurante e falso, che è il modo più efficace di non guardare più quel riquadro. ⚠️ Solo clienti con abbonamento **attivo**, e la cache della dieta è per **profilo identico** (senza, sarebbero 315 interrogazioni per un numero in un riquadro). Il tetto per giro è dichiarato: `esaminate` dice sempre quante ne ha davvero guardate. 9 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 211,
    fatta: true, // 18/8
  },
  {
    chiave: 'vera-azioni-raggio-largo',
    titolo: 'Vera: azioni a raggio largo — resta solo la regola su un TIPO DI DIETA (azione 6)',
    dettaglio:
      'Superata. Azione 3 (variante di piano) e azioni 4-5 (ricette dettate, coi macro presi dalla tabella nutrienti e mai inventati, che passano dalla coda del capo) sono fatte. Dell\'elenco originale resta solo l\'azione 6, «nella mediterranea non deve comparire più il tonno», che ha una voce sua con l\'analisi già fatta: `vera-esclusione-di-dieta`. Questa si chiude per non contare due volte la stessa cosa aperta.',
    categoria: CODICE,
    ordine: 212,
    fatta: true, // superata: resta l\'azione 6, che è vera-esclusione-di-dieta
  },
  {
    chiave: 'vera-registro-allargato',
    titolo: 'Vera: il registro mostra tutto ciò che cambia sulle sue clienti',
    dettaglio:
      'Chiuso. `registro-allargato.ts` fonde tre fonti in una riga sola (`unisciRegistro`): le azioni dell\'assistente (`AzioneVera`), le modifiche di scheda (`AuditLog`) e le sostituzioni concordate in chat (`FoodSwap`), tutte filtrate sul perimetro delle sue clienti. Nessuna tabella nuova: lettura e fusione, come diceva la specifica §13.2.',
    categoria: CODICE,
    ordine: 213,
    fatta: true, // verificato nel codice il 16/8: unisciRegistro in registro.service
  },
  {
    chiave: 'vera-frase-presentazione',
    titolo: 'Vera: cambiare la frase di presentazione («ti va di battezzarmi tu?»)',
    dettaglio:
      'Testo dettato da Simone il 13/8: «La prima cosa da fare.... io non ho un nome, ti va di battezzarmi tu? Dimmi il mio nuovo nome.. (se non ti viene in mente niente, dimmi «scegli tu»)». Sta in vera-chat.ts → testi.presentazione. ⚠️ Cambiandola si rompe un test che cerca «come vuoi chiamarmi»: agganciarlo a una parola che resta.',
    categoria: CODICE,
    ordine: 214,
    fatta: true, // riscritta il 13/8 sera: via il «battezzarmi»
  },
  {
    chiave: 'vera-modello-seconda-passata',
    titolo: 'Vera: il modello come seconda passata quando il riconoscitore non capisce',
    dettaglio:
      'Oggi capisci.ts è deterministico, con 16 casi di prova. AiService (Anthropic) c\'è già. La proposta: quando capisci torna null, chiedere al modello una PROPOSTA — che resta una proposta, mostrata e confermata come tutte le altre. ⚠️ Dopo, mai al posto: la scrittura non deve cambiare strada. Serve un sì di Simone perché cambia il costo e il comportamento. ⚠️ AGGIORNATA IL 17/8, con le prove: quel giorno Vera si è rotta TRE volte in una giornata (il nome a inizio frase alle 11:02, la domanda che fa la pastiglia alle 11:52, il refuso «sostitusci» alle 13:41) e tre volte si è aggiunta un\'espressione regolare a mano. La forma precisa della proposta — il modello TRADUCE nella forma canonica, `capisci` DECIDE, la riscrittura si mostra prima di eseguire, `daScartare` gira PRIMA (una domanda col punto interrogativo non arriva nemmeno al modello) — sta in `progetto/NOTA_Vera_Seconda_Lettura.md`, con le tre cose che possono andare storte e cosa le ferma. ⛔ CONSEGNATA il 17/8. `vera/seconda-lettura.ts`, modulo puro. La parte che conta è la GUARDIA: il modello può riordinare le parole della frase, non aggiungerne — ogni parola piena della riscrittura deve venire dalla frase (confronto per radice, così «sostitusci» passa) o essere una delle parole della FORMA, che sono un elenco chiuso. ⚠️ E i numeri si controllano a parte, perché il filtro delle parole scarta quelle sotto le tre lettere: «riduci le calorie a Giulia» → «riduci le calorie del 30% a Giulia» ci passava in mezzo, e `capisci` le percentuali le legge. Trovato da un test, non a ragionamento. Interruttore `vera_seconda_lettura` (nel seed, non solo nel codice): spento, il comportamento è quello di prima.',
    categoria: CODICE,
    ordine: 215,
    fatta: true, // 17/8: sì di Simone la mattina, consegnata la sera — `vera/seconda-lettura.ts`
  },
  {
    chiave: 'vera-ai-assistant-enabled',
    titolo: 'ai_assistant_enabled è «false» in produzione: accenderlo o no',
    dettaglio:
      'Il parametro spegne il ramo AI della chat con le clienti. Vera non ne dipende (il suo riconoscitore è deterministico), ma finché è spento non si può appoggiare niente al modello — compresa la seconda passata qui sopra.',
    categoria: SIMONE,
    ordine: 216,
    fatta: true, // acceso da Simone il 13/8 sera dalla pagina Parametri (con AI_API_KEY su Render)
  },
  {
    chiave: 'vera-dizionario-comune-conflitto',
    titolo: 'Dizionario promosso a comune: il capo conferma sapendo chi ne ha una sua diversa',
    dettaglio:
      'Chiusa dalla risposta di Simone del 13/8 («chiedi conferma al nutrizionista capo attraverso Vera») e dalla consegna del 14/8. Le voci CONVIVONO — la personale vince sempre sulla comune, nessuno viene sovrascritto — e prima del sì il capo legge CHI ne ha già una sua diversa, con nome e differenze, e cosa NON succede. Confronto per radice; chi ce l\'ha identica non compare. Vedi `conflitti-dizionario.ts`.',
    categoria: NOCANTY,
    ordine: 217,
    fatta: true, // risposta 13/8 + consegna 14/8: conflitti-dizionario.ts
  },

  // ── Vera, Consegna 4 (13/8): quello che è nato scrivendo l'avviso, il report e il corpus ──
  {
    chiave: 'vera-report-invio-mensile',
    titolo: 'Vera: il report del mese va anche MANDATO, non solo aperto',
    dettaglio:
      'Il report c\'è (`GET /vera/report`, pulsante nella pagina Assistente per il capo) e si ricalcola ogni volta. Manca la spedizione del 1° del mese al capo nutrizionista: notifica in-app + email. ⚠️ Finché non parte da solo, lo legge chi si ricorda di aprirlo — cioè, dopo la prima settimana, nessuno.',
    categoria: CODICE,
    ordine: 220,
    fatta: true, // il 1° del mese ai capi, notifica + email — cron 'veraReportMensile' (13/8 sera)
  },
  {
    chiave: 'vera-notifica-conflitto-canale',
    titolo: 'Vera: l\'avviso di conflitto sanitario oggi è solo in-app',
    dettaglio:
      'Una regola confermata sopra un vincolo dichiarato avvisa SUBITO i capi nutrizionisti, ma solo con una notifica dentro il backoffice. Se il capo non entra quel giorno, l\'avviso «subito» diventa un avviso «quando capita». Da decidere se aggiungere l\'email — è una scelta di Simone, non di codice.',
    categoria: SIMONE,
    ordine: 221,
    fatta: true, // 13/8 sera: email aggiunta accanto all'in-app, deciso da Simone
  },
  {
    chiave: 'vera-corpus-prima-del-rilascio',
    titolo: 'Le frasi che l\'assistente non ha capito si vedono nella sua pagina',
    dettaglio:
      'Chiuso il 16/8. `GET /vera/corpus` esisteva dal 12/8 e non lo apriva nessuno: era un endpoint, non un posto — e un rituale che nessuno ha l\'abitudine di fare non è un rituale. Ora le frasi non capite compaiono nella pagina dell\'assistente, sotto la chat, dalla più ripetuta, con quante volte e se si è arresa. ⚠️ Il riquadro NON compare quando non ce ne sono (stessa regola di «quello che aspetta me») ed è chiuso di default: è manutenzione, non una cosa che aspetta qualcuno. ⚠️ Le frasi si mostrano COM\'È STATO SCRITTO: ripulirle butterebbe via esattamente l\'informazione che serve, cioè come le viene di dirlo. ⚠️ La lettura sta sotto `catch`: se si rompe non compare il riquadro, non si rompe la pagina.',
    categoria: MANUTENZIONE,
    ordine: 222,
    fatta: true, // chiusa il 16/8: il corpus è in pagina, non più solo un endpoint
  },
  {
    chiave: 'vera-dizionario-alimento-nuovo',
    titolo: 'Vera si accorge quando il dizionario è invecchiato, e lo chiede',
    dettaglio:
      'Chiuso, per una strada diversa da quella immaginata. L\'idea era chiamare `famiglieCheForsePrendono` quando una ricetta viene pubblicata; la strada scelta è il rovescio e funziona meglio: `dizionario.famiglieDaAggiornare` guarda le famiglie contro il catalogo di ADESSO, e `manutenzioneDizionario` porta la domanda in chat — una famiglia per volta, ULTIMA nella coda di `cosaTiPorto`, quando non c\'è niente di più urgente. ⚠️ Al momento della pubblicazione la domanda sarebbe arrivata a chi pubblica (spesso non la nutrizionista che ha scritto la regola) e mentre sta facendo altro. Vedi `dizionario-invecchiato.ts`.',
    categoria: CODICE,
    ordine: 223,
    fatta: true, // verificato nel codice il 16/8: famiglieDaAggiornare in cosaTiPorto
  },
  {
    chiave: 'vera-lavori-doppioni-caricati',
    titolo: 'Le tre voci di Vera doppie in pagina si spuntano dal file, senza crearne di nuove',
    dettaglio:
      'Il 13/8 le voci di Vera sono finite due volte in `voci-iniziali.ts` — due sessioni, chiavi diverse per le stesse cose. Il doppione è stato tolto dal file, ma il caricamento era già girato in mezzo: in pagina restano `vera-moduli-dashboard`, `ai-assistant-enabled` e `dizionario-promossa-a-comune`, aperte, a duplicare voci che esistono già con un\'altra chiave (`vera-dashboard`, `vera-ai-assistant-enabled`, `vera-dizionario-comune-conflitto`). ⚠️ Marcarle `fatta: true` e basta non bastava: se in pagina **non** ci fossero, il caricamento le **creerebbe** — tre voci nuove già spuntate, cioè spazzatura scritta per pulire spazzatura. Nuovo campo `soloSeEsiste` su `Voce`: il file può dire «questa non è un lavoro, è una riga da chiudere — se la trovi spuntala, se non c\'è non è mai esistita». Non si cancella niente, si spunta: in pagina può esserci sopra il commento di qualcuno. E queste righe non compaiono fra i «testi da allineare», che sarebbe rumore. Basta premere «Aggiorna dal rilascio» dopo il prossimo deploy. 4 test.',
    categoria: MANUTENZIONE,
    ordine: 224,
    fatta: true, // 18/8
  },

  {
    chiave: 'vera-dizionario-cibi-diversi',
    titolo: 'Vera chiede quando non conosce una parola — e cosa resta fuori, scritto',
    dettaglio:
      'Chiusa dalla risposta di Simone del 13/8: «deve chiedere quando un cibo o un gruppo non lo conosce, fa domande al nutrizionista guidandolo in modo da apprendere di cosa si tratta». È quello che fa: una parola che il dizionario non ha ferma il giro e diventa una domanda (`famigliaASecco` → `imparaFamiglia`), e la risposta si impara. ⚠️ Resta scritto il limite noto, che NON è un difetto ma una scelta: l\'assistente non propone da sola la burrata accanto alla mozzarella, perché sono due parole diverse per cose simili e nessuna euristica sui nomi le lega. Proporre troppo insegna a rispondere di no senza leggere. Si chiuderebbe solo con una tabella di famiglie merceologiche, che oggi non esiste.',
    categoria: CODICE,
    ordine: 225,
    fatta: true, // risposta 13/8: chiede quando non conosce — il limite resta scritto
  },

  // ── Vera, azioni 4 e 5 fatte il 13/8: quello che è restato fuori ──
  {
    chiave: 'vera-azioni-3-e-6',
    titolo: 'Vera: dell\'elenco 3-6 resta l\'azione 6 (regola su un tipo di dieta)',
    dettaglio:
      'Superata, stessa ragione della voce gemella: l\'azione 3 è chiusa dal 14/8 (spuntino, cambio dieta, più proteine, giornata dettata) e le ricette pure. L\'azione 6 vive in `vera-esclusione-di-dieta`, che ha l\'analisi del contenitore (`ProductRule` con un codice nuovo, letto dove si costruisce il pool) e l\'avvertenza che è l\'unico pezzo di Vera che tocca il percorso del pasto di domani, su 315 clienti.',
    categoria: CODICE,
    ordine: 226,
    fatta: true, // superata: confluita in vera-esclusione-di-dieta
  },
  {
    chiave: 'vera-ricetta-allergeni',
    titolo: 'Vera propone gli allergeni della ricetta appena approvata, e li scrive se il capo conferma',
    dettaglio:
      'Approvare una ricetta la accende ma NON conferma gli allergeni: `allergensReviewed` resta false e `collegaRicetta` si rifiuta di metterla in una giornata — quindi il capo aveva una ricetta accesa e invisibile, e lo scopriva dal fatto che non compariva da nessuna parte. Chiuso il 16/8: subito dopo il sì, Vera mostra gli allergeni letti dagli ingredienti con la PAROLA che li ha fatti scattare («Pesce — da “orata”»), e li scrive solo se lui conferma, da `CatalogService.setRecipeAllergens` (la porta del pulsante in scheda). ⚠️ Tre asimmetrie volute: il «sì» scrive subito perché conferma una lista già letta, mentre un elenco dettato si RILEGGE prima di scriverlo; «sì, aggiungi anche il sesamo» AGGIUNGE ai suggeriti invece di sostituirli (leggerlo come elenco perderebbe pesce e glutine); e un allergene che non era fra i suggeriti si accetta lo stesso, perché `suggestAllergens` può non vederci qualcosa e aggiungerne uno di troppo costa una ricetta, dimenticarne uno costa una cliente. Vale anche per una MODIFICA che cambia gli ingredienti: la conferma di prima parlava di un altro piatto. Decisione in `progetto/NOTA_Vera_Allergeni_Ricetta_Nuova.md`.',
    categoria: CODICE,
    ordine: 227,
    fatta: true, // chiusa il 16/8
  },
  {
    chiave: 'vera-ricetta-crudo-cotto',
    titolo: 'Crudo o cotto: se la tabella ha due stati non si sceglie il primo — si chiede',
    dettaglio:
      'Chiusa il 18/8. Nocanty aveva risposto «file caricato in claude», e il file è arrivato: la scheda **«Crudo ↔ cotto»** dà la misura del problema — **farro perlato: 353 kcal da crudo, 127 da bollito, rapporto 0,36×**. ⚠️ Dire il numero sbagliato non è un\'imprecisione, sbaglia di quasi **tre volte**, e sbaglia sempre nello stesso verso (il crudo pesa più del cotto a parità di grammi). Cosa faceva prima: `ValoriNutrizionaliService.cerca` prendeva **la prima riga che combacia col nome**, quindi con due righe «riso bianco» — una crudo e una bollita — quale rispondeva lo decideva l\'ordine di lettura del database. Nessun errore, nessuna riga rossa, un numero plausibile e sbagliato. Nuovo `nutrient-facts/stato-alimento.ts`: se lo stato è **scritto nella domanda** («riso bollito») sceglie quella riga; se non c\'è e gli stati sono diversi **non sceglie**, e chi risponde dice «dipende» invece di un numero. ⚠️ Il confronto è **per parola**: «crudo» dentro «crudité» non è uno stato. ⚠️ Righe con lo **stesso** stato non sono ambigue — sono duplicati, e trattarle come ambigue avrebbe fatto rispondere «dipende» a una domanda che non dipende da niente. Vale su tutt\'e due le porte: la chat di Gaia (l\'istruzione entra fra i dati e il numero **non** entra fra quelli ammessi, così la guardia in uscita lo ferma comunque) e la ricetta dettata a Vera. ⚠️ **E per strada ne è saltato fuori uno più vecchio e più grave**: `calcolaMacro` raccoglieva gli alimenti fuori tabella in `mancanti` — con un commento sopra che spiegava perché contano — e `raccontaMacro` **non li diceva mai**. Chi dettava una ricetta con dentro un alimento che non abbiamo leggeva un totale kcal **più basso del vero**, e niente glielo diceva. Ora si dicono, e ⚠️ separati dagli ambigui: «non ce l\'ho» e «ce l\'ho due volte» portano a due azioni diverse — aggiungere una riga alla tabella, oppure dire se lo pesa crudo o cotto. 29 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 228,
    fatta: true, // 18/8
  },

  // ── Vera: le due decisioni che restano prima di finirla (13/8) ──
  {
    chiave: 'vera-variante-cosa-significa',
    titolo: 'Vera, azione 3: «variante di piano» = cambiare i pasti futuri, oppure spostare di dieta',
    dettaglio:
      'Chiusa dalla risposta di Simone del 14/8: «la nutrizionista o detta le nuove combinazioni e crea dei menu specifici guidata da Vera, oppure sceglie una diversa dieta; tutto quanto già erogato non cambia salvo diversa istruzione, e alla domanda di Vera “da quando” se risponde “da subito” si corregge il menu dal giorno dopo — quello già fatto, compresa la data odierna, resta fisso». Fatti tutti e due i meccanismi il 14/8: il cambio dieta con la domanda «da quando», e la giornata dettata a parole.',
    categoria: SIMONE,
    ordine: 229,
    fatta: true, // risposta 14/8 + le due consegne dello stesso giorno
  },
  {
    chiave: 'vera-esclusione-di-dieta',
    titolo: 'L\'esclusione a livello di DIETA esiste nel motore — verificato il 18/8, era già fatta',
    dettaglio:
      '«Nella mediterranea non deve comparire più il tonno». ⚠️ **Verificata chiusa il 18/8 rileggendo il codice**: la voce era rimasta aperta ma il lavoro c\'era già. `vera/regola-dieta.ts` (`RULE_CODE_ESCLUSIONI`, `terminiVietati`, `ricetteVietate`) tiene il divieto in `ProductRule` (`{dietId, ruleCode, params: { termini }}`), e agisce in **due punti**: il **filtro a monte** in `menu.service.buildScoringContext:1483-1489` toglie le ricette vietate dal pool, così non vengono nemmeno prese in considerazione; e la **guardia** su `evaluateMeals:808`, che è il punto obbligato di ogni erogazione — lì si evita di servirle. ⚠️ Il termine si cerca nel **nome E negli ingredienti**: senza, «insalata di riso» col tonno dentro sarebbe passata e il divieto sarebbe stato una decorazione. ⚠️ Uno slot che resterebbe **vuoto** non si svuota (decisione di Simone, 13/8): quella cliente resta com\'era e finisce nell\'elenco delle «scoperte» che il capo legge nel momento in cui approva — una giornata senza un pasto è peggio del piatto che si voleva togliere. Anche i **giorni già preparati e non ancora aperti** si rifanno (`applica-proposta.ts:157-190`), con il tetto sul numero di clienti dichiarato invece che silenzioso.',
    categoria: CODICE,
    ordine: 230,
    fatta: true, // verificata il 18/8: era già implementata
  },
  // ── 13/8 pomeriggio: colazioni, battesimo di Vera, campagna allergie a tutti ──
  {
    chiave: 'colazioni-dolce-salato',
    nata: '2026-08-13',
    titolo: 'Colazioni: la pagina «dolce o salata» è su — servono le conferme di Lucia',
    dettaglio:
      'Pagina nuova «Colazioni» nel backoffice (dal menu, sotto Allergeni ricette): il sistema propone dolce/salato dagli ingredienti delle sole ricette di colazione, Lucia conferma — anche in blocco. Il tag scritto È la conferma (`piatto:dolce`/`piatto:salato`), gli incerti restano senza proposta e li decide lei. ⚠️ L\'azione di Vera «a colazione qualcosa di salato» resta SPENTA finché le conferme non bastano: una colazione senza tag non partecipa. Decisione in `Decisioni_Simone_20260813.md` §12. ✅ **Chiusa il 19/8 sera dalla risposta di Simone**: «ci sta lavorando, va bene così chiudiamo il punto». ⚠️ La pagina e il meccanismo ci sono; quello che resta è il lavoro di Lucia sulle conferme, che non è un punto di software e non ha bisogno di una riga in elenco per essere ricordato — lo dice la pagina stessa, con quante ne restano.',
    categoria: CODICE,
    ordine: 232,
    fatta: true,
  },
  {
    chiave: 'vera-battesimo-scaduto',
    titolo: 'Vera: il battesimo non si perde più con la scadenza del dialogo',
    dettaglio:
      'Dagli screenshot di Simone (13/8): il saluto chiedeva il nome, ma lo stato scadeva in 2 ore e dopo la scadenza OGNI risposta cadeva su «non ci arrivo» — per sempre. Ora il battesimo è una condizione sui dati (nome non ancora scelto): «ti chiamerò Vera» funziona anche il giorno dopo. E l\'estrattore non prende più la prima parola («Ciao ti chiamerò Vera» l\'avrebbe battezzata «Ciao»). Bonus: «annulla» a vuoto risponde «non c\'era niente in corso». Finestra della chat portata a ~640px.',
    categoria: CODICE,
    ordine: 233,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'campagna-allergie-a-tutti',
    titolo: 'Campagna allergie: push a TUTTI i 48 (decisione Simone) — si lancia il 14/8 alle 11',
    dettaglio:
      'Due script, nell\'ordine: `chiedi:allergie` (i 3 da codificare, dialogo con Gaia — ora manda anche la PUSH vera, prima c\'era solo la campanella in app) e il nuovo `avvisa:allergie` (gli altri 45: i 24 mai risposto vengono portati alla scheda in home, i 21 già a posto ricevono l\'informativa sul profilo). Tutti e due prima in prova, letti riga per riga, poi CONFERMA=1. ⚠️ Solo DOPO Render + OTA. Decisione in `Decisioni_Simone_20260813.md` §13.',
    categoria: SIMONE,
    ordine: 234,
    fatta: true, // lanciata da Simone il 14/8 alle 11:00 — sua conferma, non il codice
  },
  {
    chiave: 'pasti-esclusi-in-scheda',
    titolo: 'Gli spuntini tolti dall\'assistente si vedono in scheda E nel profilo dell\'app',
    dettaglio:
      '«Togli lo spuntino» (azione 3, 13/8 sera) scrive `ClientProfile.pastiEsclusi` e il motore lo rispetta, ma NESSUNA scheda lo mostrava: né backoffice né app. Lo stesso buco che avevano le allergie — un dato che agisce e non si vede è un dato che prima o poi qualcuno contraddice senza saperlo, e qui quel qualcuno era la cliente stessa che scriveva alla coach «mi manca un pasto». Chiuso il 14/8: il backoffice aveva già la riga, ora `/me/nutrition` manda `pastiEsclusi` (sempre un elenco, mai `null`) e il profilo dell\'app lo dice a parole — «Lo spuntino del mattino», mai il codice del motore — con la nota che risponde all\'unica domanda che quella riga fa nascere: le kcal di quel pasto sono ridistribuite sugli altri. Sola lettura: si cambia solo dettandolo all\'assistente. Modulo puro `app/src/lib/spuntiniEsclusi.ts`, 6 test app + 4 backend.',
    categoria: CODICE,
    ordine: 235,
    fatta: true, // chiusa il 14/8: backoffice (11/8) + profilo dell'app
  },
  {
    chiave: 'vera-famiglia-a-secco',
    titolo: 'Vera: «hai la lista dei formaggi molli?» e «crea la lista» funzionano',
    dettaglio:
      'Dalla prova di Nocanty (13/8, 17:47): il dizionario delle famiglie esisteva solo DENTRO una regola. Ora la consultazione («hai la lista dei…?» — l\'unica domanda che merita risposta, il filtro delle domande resta per le azioni) mostra l\'elenco, e «crea/rifai la lista dei…» apre l\'apprendimento a secco, che si chiude senza toccare nessuna cliente.',
    categoria: CODICE,
    ordine: 236,
    fatta: true, // consegnata la sera stessa
  },
  {
    chiave: 'vera-chat-dimensionabile',
    titolo: 'Vera: la finestra della chat si deve poter ridimensionare',
    dettaglio:
      'Richiesta di Simone (13/8 sera, dagli screenshot delle prove di Nocanty): oggi la chat è a altezza fissa (min(72vh, 640px), alzata ieri da 460). Renderla dimensionabile — trascinamento del bordo inferiore (CSS resize/handle) e altezza ricordata tra una visita e l\'altra. Pagina `backoffice/src/pages/Vera.tsx`.',
    categoria: CODICE,
    ordine: 237,
    fatta: true, // 14/8: bordo inferiore trascinabile, altezza ricordata (localStorage) — Vera.tsx
  },
  {
    chiave: 'vera-guida-giornata',
    titolo: 'Vera guida la giornata: «hai segnalazioni per me?» + campanella del capo sulla proposta nuova',
    dettaglio:
      'Richiesta di Simone (14/8 mattina, dallo screenshot: la domanda cadeva su «non ci arrivo»). Intento `segnalazioni` in `capisci.ts` (forme ancorate: «avvisi Giulia che…» resta un\'istruzione); il quadro si compone dalle tabelle di origine — segnalazioni CLINICHE IN TESTA (risposta di Simone in pagina Lavori), poi le altre, la coda del capo, le domande aperte, le sostituzioni, e la campanella (avvisi non letti, senza contare due volte le code) — e subito dopo Vera porta la prima cosa da fare. Una fonte rotta si dice («non lo so» ≠ «nessuno»). E il capo riceve la notifica `vera_proposta_in_coda` quando il team gli mette una proposta in coda (solo in-app; il conflitto sanitario resta l\'unico con email, e non fa doppia campanella). Decisione in `progetto/NOTA_Vera_Guida_Giornata.md`.',
    categoria: CODICE,
    ordine: 238,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'gaia-colazione-dolce-salata',
    titolo: 'Gaia: sul cambio colazione chiede «dolce o salata?» e filtra per i tag di Lucia',
    dettaglio:
      'Richiesta di Simone (14/8, dallo screenshot della chat di Antonio). Sul cambio della COLAZIONE senza preferenza detta, Gaia chiede il gusto e cerca nel pool certificato solo fra le colazioni taggate `piatto:dolce`/`piatto:salato` (le conferme di Lucia: senza tag non si partecipa), a pari calorie e con ingredienti diversi (le regole del cambio piatto). «Fa lo stesso» = senza filtro; due risposte non capite = senza filtro; niente dentro le calorie = si dice il gusto chiesto e si passa alla nutrizionista. «Una colazione proteica» NON fa la domanda. Decisione in `progetto/NOTA_Gaia_Colazione_Dolce_Salata.md`.',
    categoria: CODICE,
    ordine: 239,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-cambio-dieta-cliente',
    titolo: 'Vera: «sposta Giulia sulla keto» — il cambio di dieta per una cliente, con «da quando?»',
    dettaglio:
      'Risposta di Simone (14/8, pagina Lavori) sulla variante di piano: la nutrizionista «sceglie una diversa dieta». Intento `cambio_dieta` (letto PRIMA della regola di dieta), dieta cercata nel catalogo (zero → nomi disponibili; più d\'una → si chiede), domanda «da quando?» («da subito» = rifaccio da domani; «lascia i giorni già preparati» = la nuova entra coi prossimi menu — flag `dietChangeKeepDeliveredDays` sulla porta della scheda), conferma, scrittura via `updateClient` (permesso `change_diet_type`, rierogazione già dentro, oggi e il passato MAI toccati). Registro `variante_cliente`. Decisione in `progetto/NOTA_Vera_Variante_Piano.md`.',
    categoria: CODICE,
    ordine: 240,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-menu-dettati',
    titolo: 'Vera: la nutrizionista DETTA le combinazioni e crea menu specifici per una cliente',
    dettaglio:
      'Il secondo meccanismo della variante di piano (risposta di Simone, 14/8), fatto con la lettura B decisa da lui: si detta a parole e il sistema traduce. ⚠️ Il rischio della B — «pasta al pomodoro» sono cinque ricette con calorie diverse — si chiude con la regola di casa: una sola combacia → si propone; più d\'una → si CHIEDE, con le kcal accanto; nessuna → si dice. Si cerca solo nel pool certificato della cliente, si mostra il totale contro l\'obiettivo e sopra il ±15% NON si scrive; si tocca un giorno solo, e solo se non è ancora stato aperto. Decisione in `progetto/DECISIONE_Menu_Dettati.md`.',
    categoria: CODICE,
    ordine: 241,
    fatta: true, // 14/8: giornata-dettata.ts (puro) + flusso in vera-chat.service
  },
  {
    chiave: 'coach-task-push-escalation',
    titolo: 'Attività coach: push alla creazione + alla manager delle coach se restano da fare 24h dopo la scadenza',
    dettaglio:
      'Richiesta di Simone (14/8, dagli screenshot della pagina Attività coach). Oggi NESSUNA attività manda push (solo «piano in scadenza» e «ripresa peso» fanno campanella in-app). Da fare: (1) alla creazione l\'attività arriva alla coach anche via push, rispettando le preferenze; (2) se resta «da fare» 24 ore DOPO la scadenza (dueDate — confermato da Simone: «da quando andava fatta») va alla manager delle coach, una volta sola per attività (serve l\'idempotenza: campo `escalatedAt` o dedupe). Nell\'app coach ci sono già dashboard Attività e pagina Notifiche: nessun lavoro app.',
    categoria: CODICE,
    ordine: 242,
    fatta: true, // 14/8: push in ensureTask + escalateAttivitaScadute nel giro del cron (senza migrazione: la notifica è la memoria)
  },
  {
    chiave: 'menu-pasto-mancante-dal-ciclo',
    titolo: 'Il pasto che manca a una giornata si prende dalle settimane successive dello stesso ciclo',
    dettaglio:
      'Regola chiesta da Simone (14/8): «se settimana 2 digiuno intermittente giorno 2 mi manca la cena vado a cercare la cena nelle settimane successive con le giuste caratteristiche». Prima dell\'11/8 una giornata monca si serviva com\'era; dall\'11/8 si scartava intera. Ora, PRIMA di scartare, si ripara: stesso slot, dalle altre giornate della STESSA dieta e livello, guardando avanti per prime (poi indietro), mai un doppione nella giornata, e a parità comanda il target calorico. Le caratteristiche sono garantite dalla provenienza: il piatto è del catalogo di quella dieta, quindi esclusioni/allergeni/stagionalità restano a valle. Se resta monca, la scala di prima (gemella → segnalazione) vale identica. Ripiego dichiarato: log + evento `diet_day_repaired`. ⚠️ Il catalogo va comunque completato. Modulo puro `menu/ripara-giornata.ts`; decisione in `progetto/NOTA_Pasto_Mancante_Dalle_Settimane_Successive.md`.',
    categoria: CODICE,
    ordine: 243,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-porta-i-girati-di-gaia',
    titolo: 'Vera porta le domande che Gaia gira alla nutrizionista, e la risposta parte da lì',
    dettaglio:
      'Richiesta di Simone (14/8): «anche queste notifiche devono arrivare attraverso l\'assistente, poi le lasciamo anche lì, ma da una parte o dall\'altra il nutrizionista risponde». La segnalazione resta dov\'è e si aggiunge una porta: `passaAllaNutrizionista` apre anche una richiesta Vera `girata_da_gaia` con chiave `gaia:<escalationId>` (idempotenza E legame, senza colonne nuove). Vera la porta in chat con la sua domanda (non l\'elenco di alimenti delle allergie); la risposta dettata arriva davvero alla cliente nel thread `nutritionist` (creato se non c\'è, firmato da chi ha dettato) e CHIUDE la segnalazione; «la vedo io» chiude la domanda senza scrivere; se la segnalazione è già stata chiusa dalla pagina la domanda non si fa più. Decisione in `progetto/NOTA_Vera_Porta_I_Girati_Di_Gaia.md`.',
    categoria: CODICE,
    ordine: 244,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-cambi-da-verificare-in-chat',
    titolo: 'Vera porta i cambi concordati in chat e li fa verificare a voce (✓/✗)',
    dettaglio:
      'Decisione di Simone (14/8): la **A** — a voce passano solo ✓ e ✗, i grammi restano in scheda. Vera porta una riga per volta (ordinata per VOLTE, non per data: chiesta tre volte non è un caso), con cliente, piatto, da/a, quantità e quante volte; «va bene» la valida, «no» la annulla e tiene il motivo SOLO se lo dice lei (Vera non lo chiede: in scheda oggi il rifiuto non chiede niente). ⚠️ Il cuore della decisione: un numero dettato — anche dentro un sì, «sì, ma metti 30 g» — NON vale come conferma, non scrive niente e manda in scheda, perché 70 ml di panna sono ~200 kcal contro i ~630 di 70 g di olio. La scrittura passa da `FoodSwapsService.aggiorna`, lo stesso metodo del pulsante in scheda, e la riga si rilegge prima di scrivere (una collega può averla già guardata). Decisione in `progetto/DECISIONE_Verificare_Cambi_A_Voce.md`.',
    categoria: CODICE,
    ordine: 245,
    fatta: true, // consegnata il 14/8
  },
  {
    chiave: 'assistente-del-coach',
    titolo: 'Un assistente per il coach — NON SERVE (chiarito da Simone il 14/8)',
    dettaglio:
      '⚠️ Voce chiusa il giorno stesso in cui è nata: «non serve un assistente per le coach, alle coach devono solo arrivare le notifiche». Era una lettura mia troppo larga dello screenshot di «Attività coach». Le notifiche alla coach ci sono già e sono della stessa mattina (voce 242): push alla creazione di ogni attività ed escalation alla manager se restano da fare il giorno dopo la scadenza. L\'assistente resta della nutrizionista.',
    categoria: CODICE,
    ordine: 246,
    fatta: true, // non si fa: chiarimento di Simone, 14/8
  },
  {
    chiave: 'kcal-correzione-a-termine',
    titolo: 'La correzione calorica ha una durata: «−10% per 7 giorni e poi riprendi»',
    dettaglio:
      'Risposta di Nocanty al §15.2 punto 1 (13/8): «la percentuale la inserisco io nella scheda e memorizzi il mio cambiamento, esempio riduci le kcal del 10% per 7 giorni e poi riprendi col normale ritmo». La percentuale c\'era già dall\'11/8 (§15.5): mancava la durata. Campo nuovo `kcalAdjustUntil` (migrazione additiva, NULL = come prima), scadenza guardata al momento del calcolo (nessun cron azzera niente), ultimo giorno compreso, confronto per GIORNO. Il valore non si cancella alla scadenza: si spegne, e la spiegazione lo dice («fino al 21/8» / «è scaduta: si è tornati al ritmo normale»). Togliere la correzione toglie anche la data. Decisione in `progetto/NOTA_Correzione_Kcal_A_Termine.md`.',
    categoria: CODICE,
    ordine: 247,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-detta-correzione-kcal',
    titolo: 'Vera: «riduci le kcal del 10% a Giulia per 7 giorni» dettato a voce',
    dettaglio:
      'La seconda metà della richiesta di Nocanty: «questa cosa vorrei farla anche dalla mia assistente». Il campo e la scadenza esistono dal 14/8 (voce 247) proprio perché la dettatura possa scriverli senza inventarsi una seconda strada. ⚠️ Tocca i numeri nel piatto: intento in `capisci.ts`, anteprima con il target PRIMA e DOPO (`kcalNeed.estimate` in simulazione), conferma, e la scrittura passa dalla porta che c\'è già (`impostaKcal`, coi suoi permessi, lo storico in `kcal_override` e il rifiuto sotto soglia). A mente fresca.',
    categoria: CODICE,
    ordine: 248,
    fatta: true, // 14/8: intento correzione_kcal + anteprima col numero vero + porta impostaKcal
  },
  {
    chiave: 'dizionario-promossa-conferma-capo',
    titolo: 'Dizionario promosso a comune: il capo conferma vedendo chi ne ha già una sua diversa',
    dettaglio:
      'Domanda di Nocanty (13/8) e risposta di Simone: «chiedi conferma al nutrizionista capo attraverso Vera». La convivenza RESTA (la voce personale vince sempre sulla comune, confermato) e nessuno viene sovrascritto; quello che cambia è che prima del sì il capo legge chi ha già una sua versione diversa, con nome e differenze (alimenti in più nella comune, alimenti che ha solo lei) — e la frase dice anche cosa NON succede: «le loro restano e continuano a valere». Confronto per radice (`chiaveAlimento`), chi ce l\'ha identica non compare. Decisione in `progetto/NOTA_Dizionario_Promosso_Conferma_Capo.md`.',
    categoria: CODICE,
    ordine: 249,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-piu-proteine',
    titolo: '«Rifai con più proteine»: la quota proteica minima di UNA cliente',
    dettaglio:
      'La terza frase dell\'azione 3, decisa da Simone il 14/8 (opzione A del foglio `progetto/DECISIONE_Piu_Proteine.md`). La banda proteica esisteva già ma solo per DIETA (`menu_daycombo_protein_min`, pagina Regole motore): ora `ClientProfile.proteinMinPct` (migrazione additiva, NULL = vale la dieta) vince sul minimo — e SOLO sul minimo, il massimo resta della dieta. Vera la detta con l\'anteprima in percentuale («dal 20% al 30%»), lo scatto di scorta è +10 punti quando il numero non è detto, il tetto è 60%, e si rifanno solo i giorni futuri non ancora aperti. ⚠️ La banda è una penalità morbida nel ranking di DayCombo, non un filtro: un minimo alto non può lasciare una cliente senza cena.',
    categoria: CODICE,
    ordine: 250,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'lavori-pulsante-spunte',
    titolo: 'Lavori: il pulsante del rilascio mostrava solo le voci da AGGIUNGERE, non quelle da spuntare',
    dettaglio:
      'Trovato il 14/8 sera, sul vivo: tre consegne finite, zero voci nuove da aggiungere e tre da spuntare — la pagina rispondeva «non c\'è niente di nuovo da caricare» e **non mostrava nemmeno il pulsante Conferma**. Le spunte si sono dovute fare dalla shell di Render. Il server mandava già `spuntate` e `chiuse`: era la pagina a guardare solo `aggiunte`. ⚠️ Il nome del pulsante era parte del difetto — «Carica le voci nuove» diceva metà di quello che fa — ed è diventato «Aggiorna dal rilascio». Ora il riepilogo mostra le due liste separate (cosa aggiungerei, cosa spunterei, coi titoli e non con le chiavi) e ripete sempre che una voce già spuntata non viene mai riaperta.',
    categoria: CODICE,
    ordine: 251,
    fatta: true, // trovata e chiusa la sera stessa
  },
  {
    chiave: 'allergeni-reviewed-non-si-azzera',
    titolo: 'Cambiare gli ingredienti ora AZZERA gli allergeni confermati: gli allergeni vincono sulle modifiche',
    dettaglio:
      'Trovato nel codice il 16/8 scrivendo la voce 227, chiuso il 18/8 con la risposta di Simone: **«gli allergeni vincono sempre sulle modifiche; in caso venga data una sostituzione incompatibile va segnalato»**. Il difetto: `catalog.updateRecipe` scriveva `ingredients` **senza toccare** `allergensReviewed`. Una ricetta con gli allergeni confermati a cui qualcuno cambiava gli ingredienti restava `allergensReviewed: true` — con la firma di **prima**, data su un piatto diverso. Nessun errore, nessuna riga rossa, e `collegaRicetta` la lasciava entrare nelle diete perché il campo diceva di sì. Una conferma è una firma su un contenuto: cambiato il contenuto, la firma non vale più. ⚠️ **Decade sui NOMI degli ingredienti, non su qualunque salvataggio**, ed è il modo di applicare «vincono sempre» che protegge davvero: una quantità non può introdurre né togliere un allergene (80 g o 100 g di farina hanno lo stesso glutine), mentre azzerare per un peso corretto **toglierebbe il piatto dai menu** senza aggiungere un grammo di sicurezza. Quello che cambia gli allergeni è cosa c\'è dentro: un ingrediente aggiunto, tolto o rinominato. ⚠️ Il confronto è fra **insiemi di nomi** normalizzati: l\'ordine non conta (spostare una riga nel form non è una modifica), e stesso numero con uno scambiato **conta** — una scorciatoia sulla lunghezza della lista avrebbe lasciato passare farina→mandorle. ⚠️ E se gli ingredienti non si leggono, si azzera: su un campo di sicurezza «non ho capito» vale «non è confermato», mai il contrario. ⚠️ **Non è retroattivo**: vale dalla prossima modifica, quindi il catalogo non si svuota di colpo e la coda di «Allergeni ricette» si riempie al ritmo con cui qualcuno tocca le ricette. Chi salva lo **legge**: la pagina Ricette dice che la ricetta non entra più nei menu nuovi, dove si riconferma, e che i menu già consegnati non cambiano — e resta nel registro modifiche, perché chi un domani si chiede «perché questa ricetta è sparita dai menu?» deve trovare la risposta. **Sulla seconda metà della risposta** («sostituzione incompatibile va segnalato»): verificato, è già vero su tutt\'e due le porte — il dialogo di Gaia ferma il sostituto che tocca un allergene dichiarato e **passa la mano a una persona** (`sostituzione-chat.service.ts:795-802, 902`), e il pulsante «non gradisco» dell\'app sceglie i sostituti passando da `evaluateMeals`, che è il punto obbligato dove allergeni ed esclusioni si applicano. 15 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 252,
    fatta: true, // 18/8
  },
  {
    chiave: 'app-dati-che-non-legge',
    nata: '2026-08-16',
    titolo: 'App: restano DUE dati che il server manda alla cliente e nessuna schermata mostra (erano sei)',
    dettaglio:
      'Trovati il 16/8 con un giro sistematico su tutte le rotte `/me/*`, cercando il difetto già pagato tre volte in questo progetto — un dato che agisce e non si vede. **Chiusi:** i traguardi raggiunti e il guardrail del calo rapido (16/8); il popup delle valutazioni, che ricostruiva l\'elenco da `/me/menu` e riproponeva piatti già votati invece di leggere `GET /me/ratings/pending` (voce 269, 18/8); e il 18/8 gli ultimi due piccoli — **`since` di `/me/measurement-gate`**, che il backend manda da sempre e nessuno leggeva: il riquadro diceva «App in pausa», uno stato senza storia, e ora dice **da quanto** il menu è fermo («da ieri», «da 5 giorni», «da 2 settimane»), ⚠️ tacendo quando la data non c\'è invece di scrivere «da 0 giorni» — e **`thighsCm`**, la circonferenza cosce che lo staff poteva registrarle e che lei non avrebbe mai visto: il campo c\'era in banca dati, nel form del backoffice e nella risposta di `GET /me/measurements`, e si fermava all\'interfaccia TypeScript dell\'app. ⚠️ Ora la vede **e la può scrivere**: mostrarla soltanto avrebbe lasciato un dato sul suo corpo che governa solo lo staff. Niente barra «verso il tuo obiettivo» per le cosce, perché un `targetThighsCm` non esiste e inventarlo sarebbe una migrazione per una cosa che nessuno ha chiesto: una barra senza traguardo misura la distanza da niente. **⛔ RESTANO I DUE GROSSI, e quelli sì sono SCHERMATE NUOVE — vanno disegnate prima di scriverle: 1)** `GET /me/progress` non lo chiama nessuno — media mobile, chili persi, PROIEZIONE della data obiettivo, giorni di stallo — eppure il calcolo gira e lo leggono il motore e l\'allarme di stallo della coach: agisce su di lei ed è l\'unica a non vederlo. **2)** `GET /me/cycle` mai chiamato: le due cotture del ciclo, le stelle di gradimento (che decidono cosa il motore le ripropone) e l\'esito del ciclo precedente. **3) ✅ CHIUSO il 18/8** — `totalSafe` e `certificate` da `/me/personal-base`. ⚠️ La nota diceva «schermata nuova, va disegnata prima»: **era sbagliata**. Non serviva una schermata, serviva una riga nel Profilo **subito sotto le allergie** — perché è lì che nasce la domanda a cui quel numero risponde: ha appena letto le sue allergie e «le teniamo fuori dai menu sempre», e la domanda che segue è «e allora cosa mi resta?». Ora legge «148 ricette del catalogo sono state certificate sicure per te: il motore pesca solo da lì», con sotto, piccolo, il numero e la firma del certificato — la prova che la personalizzazione è avvenuta, che è la cosa che il prodotto promette. ⚠️ Tre stati: pronta → il numero; bloccata → il testo del socio; lettura fallita → **niente**, perché «0 ricette certificate sicure per te» detto per un errore di rete sarebbe falso e spaventoso. ⚠️ E «pronta con 0 ricette» non è pronta. Restano quindi **DUE**, e quelli sì sono schermate. ⚠️ **L\'analisi è FATTA, la sera del 18/8: `progetto/DECISIONE_Due_Schermate_App.md`** — non va rifatta. Dentro c\'è la scoperta che cambia la domanda sul primo dei due: `Obiettivo.tsx:465` calcola la barra «verso il tuo obiettivo» sull\'**ultima misura**, mentre `/me/progress` la calcola sulla **media mobile** — cioè non è una schermata mancante, sono **due risposte alla stessa domanda** sulla stessa cliente, e la seconda è quella che leggono il motore e l\'allarme della coach. Il lavoro vero è **togliere il conto locale**, non aggiungere una pagina. E sul secondo, due trappole trovate nel codice: ⚠️ `GET /me/cycle` **scrive** (`clientCycle.update/create` a ogni chiamata), e ⚠️ il campo `gradimento` **non è il gradimento** — è il minimo fra le ricette del ciclo del massimo delle loro stelle, con **default 5 quando una ricetta non è mai stata valutata**: mostrarlo come «il tuo gradimento» rifarebbe il difetto delle tre stelle inventate (voce 270) dentro una schermata. ⛔ Il foglio finisce con **cinque decisioni** (la proiezione della data obiettivo si mostra? i giorni di stallo? cosa del ciclo? il GET che scrive si separa?): il codice si scrive dopo.',
    categoria: CODICE,
    ordine: 253,
    // ⚠️ CHIUSI TUTTI E DUE il 19/8: `Obiettivo.tsx` legge `/me/progress` (e la barra non si
    // calcola più in locale sull'ultima pesata — era quello il lavoro vero), `Menu.tsx` legge
    // `/me/cycle` con le cotture e l'esito precedente, col `gradimento` lasciato fuori e la lettura
    // separata dalla scrittura.
    fatta: true,
  },
  {
    chiave: 'vera-handoff-sessione',
    titolo: 'Vera: il passaggio di consegne sta in progetto/HANDOFF_Vera_Sessione.md',
    dettaglio:
      'La chat in cui Vera è stata costruita (12-13/8) è diventata troppo lunga. Tutto quello che serve per riprenderla da un\'altra sessione — cosa c\'è, dove sta, le regole di lavoro, le trappole già pagate e le decisioni aperte — è in `progetto/HANDOFF_Vera_Sessione.md` (308 righe, verificato il 18/8). ⚠️ Va letto **prima** di toccare `backend/src/vera/`: metà delle scelte che sembrano strane lì dentro sono difetti già pagati una volta. Spuntata il 18/8: non è un lavoro da fare, è un cartello, e il cartello c\'è. Resta in elenco perché si legga.',
    categoria: MANUTENZIONE,
    ordine: 231,
    fatta: true, // 18/8 — il file esiste, questa voce è un cartello
  },
  {
    chiave: 'digiuno-catalogo-per-finestra',
    titolo: 'Digiuno: il catalogo servito lo decide la FINESTRA (Sonia riceveva un pasto al giorno)',
    dettaglio:
      'Trovato il 17/8 con `npm run diag:digiuni`: la variante `fasting: true` del catalogo ha tre slot FISSI (pranzo, merenda, cena) — è di fatto la variante «salta la colazione» e nessun campo lo dice — e l\'erogazione toglie da lì gli slot della finestra scelta. Chi salta la cena restava col SOLO PRANZO: Sonia (`<email di Sonia>`), il 45% delle sue calorie, e ⚠️ non lo segnalava niente, perché la rete di `dayComboPools` ferma la giornata vuota e non quella monca. Ora `pickDietFor` chiede un catalogo che ABBIA i pasti che la finestra promette (`catalog/struttura-per-digiuno.ts`, modulo puro): si spostano sul 5 pasti solo «salto la cena» e «salto il pranzo», che sono le due rotte. ⚠️ NON «il digiuno usa sempre il 5 pasti»: nel catalogo digiuno pranzo+merenda+cena valgono il 100% della giornata e nel 5 pasti il 70%, quindi le cinque clienti che stanno bene avrebbero perso un terzo delle calorie in silenzio. ⚠️ La scelta conta i pasti, non elenca le finestre: una riga nuova in `FINESTRE_DIGIUNO` è già coperta. La finestra è stata aggiunta a tutti e cinque i chiamanti di `pickDietFor`. 14 test, nessuna migrazione. Foglio: `progetto/NOTA_Digiuno_E_Riempimento_Varianti.md`.',
    categoria: CODICE,
    ordine: 254,
    fatta: true, // 17/8: consegnata; da confermare con `npm run diag:digiuni` dopo il deploy
  },
  {
    chiave: 'digiuno-porzioni-non-si-scalano',
    titolo: 'Le porzioni si scalano sul fabbisogno: Sonia dal 65% al 100%',
    dettaglio:
      'Chiusa il 18/8 con la decisione di Simone — **«va riproporzionato il pasto correggendo le quantità in base al fabbisogno»**, cioè la strada C del foglio `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`. Il buco: le ricette nascono dimensionate su una quota della giornata di catalogo (`menu_daycombo_kcal_target`, 1500), l\'erogazione punta al **fabbisogno**, e quando la finestra del digiuno toglieva dei pasti quello che restava **non si ingrandiva** — chi salta la cena riceveva il 65%, chi salta cena e colazione il 45%. Nuovo `menu/porzione-scalata.ts`: fattore **uniforme** con un **tetto per tipo di pasto** (principali ×1,8, colazione ×1,6, spuntini ×1,25, tutti in `config_param`). ⚠️ I tetti per tipo e non uno solo: a ×1,6 uno spuntino da 160 kcal diventa 256 e non è più uno spuntino. ⚠️ E chi non è al tetto cresce **della stessa percentuale** di chiunque altro non sia al tetto — il rapporto fra colazione e pranzo lo ha deciso la dieta, non noi. (Sulla giornata di Sonia: 509/200/891 con la regola giusta, 478/193/929 con la ridistribuzione «in proporzione al margine» che avevo scritto per prima e che un test ha bocciato.) ⚠️ **Non si rimpicciolisce mai**: scalare all\'ingiù toccherebbe il menu di tutte le clienti sotto i 1500 kcal, ed è una decisione clinica diversa da quella presa. ⚠️ La scalatura è **l\'ultimo passo prima della misura**: la giornata la riscrivono la ripetizione bigiornaliera, le «ricette semplici» e il cambio dei piatti non graditi, e tutti e tre ricostruiscono i pasti campo per campo — scrivendo il fattore prima, lo butterebbero via senza un errore. ⚠️ E `daily_kcal_below_target` cambia significato: da oggi vuol dire «resta corta **anche col moltiplicatore al tetto**», più raro e più grave. Toccati insieme: **kcal già scalate** nello snapshot (l\'app somma i totali da lì, in tre schermate: scrivere il fattore a parte le avrebbe rese sbagliate in silenzio), `kcalBase` e `porzione` accanto per non perdere l\'origine, la **lista della spesa** (sommava le grammature di catalogo: la cliente comprava il cibo della porzione piccola e a metà settimana finiva), la riga «porzione più abbondante ×1,8» nel menu dell\'app e la pastiglia «×1,8» nella scheda del backoffice. ⛔ **Cosa resta e va detto:** ~~la scheda ricetta mostra le grammature di catalogo~~ — **chiusa il 18/8 passandole giorno e slot, voce 280**; i giorni **già erogati** non si riscrivono (`menuDay.upsert` ha `update: {}`), quindi vale dai giorni nuovi; il kit di rientro copia `meals` così com\'è; e ⚠️ **i pezzi restano un problema aperto** — ×1,5 di una mela è una mela e mezza, e il numero vero esce così com\'è invece di essere arrotondato di nascosto: accettarlo o togliere le ricette a pezzo dalla scalatura è una decisione da prendere con la nutrizionista. 29 test nuovi. Nessuna migrazione. ⚠️ **E la revisione della notte ha trovato il caso vicino, corretto subito**: il cambio di **piatto** (`swapDislikedDishes`) scrive una sostituzione in cui `from` e `to` sono **nomi di ricetta**, non di ingrediente — dandola a `ingredientiEffettivi` senza dire niente, il suo ripiego «se non trovo l\'origine aggiungo il sostituto» faceva comparire nel carrello una riga che si chiama **«Riso e lenticchie»** in mezzo a farro e zucchine, e un pallino con lo stesso nome in fondo agli ingredienti della scheda. Adesso chi chiama sceglie (`seNonTrovato`): la chat `aggiungi` (le serve a non negare che quell\'alimento esista), la spesa e la scheda `salta`. Il ripiego era stato scritto per **un solo consumatore**, e spostare la funzione senza rileggerlo lo ha trasformato in un\'istruzione di acquisto.',
    categoria: CODICE,
    ordine: 255,
    fatta: true, // 18/8
  },
  {
    chiave: 'digiuno-finestra-mai-chiesta',
    titolo: 'Digiuno senza finestra: la domanda non era mai stata fatta — ora è un\'attività della coach',
    dettaglio:
      'Una cliente ha `pathType: intermittent_fasting` e `fastingWindow` **vuota**. ⚠️ Prima di tutto il resto: **il motore non è rotto**. Senza finestra non si salta nulla e riceve il 16:8 classico, che è il valore di scorta sensato — «dovrebbe ricevere tutti e cinque i pasti» era una frase del mio primo script, non una promessa fatta a lei (falso positivo corretto il 17/8). Il difetto è più difficile da vedere: la finestra decide **quali pasti mangia**, e per lei l\'ha decisa un valore di scorta. **La domanda non le è mai stata fatta.** Il questionario la fa, obbligatoria, dal 5-11/8 (`showIf` sul digiuno): chi si iscrive oggi la sceglie. Restavano fuori le clienti di prima. ⛔ Ho scartato di farla chiedere a Gaia: «quali pasti preferisci saltare?» arrivato a freddo, a chi mangia così da mesi, è una domanda che si risponde male — la risposta giusta dipende da come sta e da cosa le hanno detto in visita. Non è un dato da riempire, è **una conversazione da avere**, e il progetto ha già il posto dove una cosa da fare diventa lavoro di una persona: le attività della coach. Fatto: **1)** nuova attività «Chiedi a [nome] quali pasti salta nel digiuno», generata dal cron notturno per chi è in digiuno senza finestra **e ha un abbonamento attivo** (aprire un\'attività su chi ha finito il percorso mesi fa è il modo più rapido di insegnare alla coach a ignorare la colonna), con `refId` **fisso**: si chiede una volta sola, e se la coach la segna fatta non torna. ⚠️ Il testo dice **cosa succede intanto** — «NON è ferma e non è rotta, riceve tutti i pasti della sua dieta» — perché «manca la finestra» letto da solo suona come un guasto, e una coach che chiama allarmata una cliente che sta bene fa più danno del dato mancante. **2)** Nel backoffice la finestra vuota non si legge più «li decide la dieta», che sembrava una scelta: ora è «⚠️ mai chiesta — intanto riceve tutti i pasti della dieta». Tre stati, non due. **3)** Nell\'app, la card della finestra compariva coi pallini tutti spenti e nessuna spiegazione: ora dice che la domanda non c\'era quando si è iscritta, che intanto non le manca niente, e a cosa serve dirlo. ⚠️ E NON promette che le calorie del pasto saltato finiscono negli altri: non è vero finché la voce 255 è aperta. 8 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 256,
    fatta: true, // 18/8
  },

  {
    chiave: 'piani-attivi-scelta-per-date',
    titolo: 'Due piani attivi: la scheda mostrava quello IN CODA come piano corrente',
    dettaglio:
      '⚠️ La causa vera del caso Lorena, trovata il 17/8 e più precisa della prima ricostruzione: `pickMainSubscription` faceva `find(s => s.status === \'active\')` su una lista `createdAt desc`, quindi fra due righe attive vinceva **la più recente** — che era il piano in coda dal 25/08. La scheda scriveva «Inizio piano: 25/08» e la matita, che usa la stessa funzione, ha spostato quella riga: chi l\'ha aperta ha corretto una data sbagliata. Con lo stesso difetto, senza bisogno di `queued`: `menu.service` faceva `findFirst` **senza `orderBy`** (e da lì escono «piano concluso?» e fino a che giorno arrivano i menu: dipendeva dall\'ordine delle righe nella tabella), `pause.service` ordinava per `createdAt desc` (i giorni di pausa sommati al piano in coda: concessi e mai ricevuti), `coach.service` costruiva una `Map` che tiene l\'ultima riga. Ora la scelta è una funzione sola (`commerce/abbonamento-in-corso.ts`): chi eroga oggi, e fra due sovrapposti quello che finisce più tardi — ⚠️ non «cominciato prima», perché la cliente ha pagato fino alla fine del secondo. ⚠️ Le date sono obbligatorie nel tipo, e il compilatore ha trovato subito un cast in `clients.service` che le buttava via. 18 test, nessuna migrazione. Foglio: `progetto/NOTA_Chi_Sta_Erogando_Adesso.md`.',
    categoria: CODICE,
    ordine: 257,
    fatta: true, // 17/8: consegnata, test visti rossi prima
  },
  {
    chiave: 'queued-stato-abbonamento',
    titolo: '«In coda» è uno STATO — prima metà consegnata il 18/8: lo stato esiste e le letture lo capiscono',
    dettaglio:
      'La causa che resta dopo la voce 257. Un piano messo in fila si scrive `active` con inizio nel futuro, e da questa scelta discende tutto: il database non può vietare due attivi (due attivi sono legittimi), la scheda mostra due «Attivo» identici, e la matita non sa che sta disfacendo una coda. Migrazione **additiva** (un valore in più nell\'enum), `finalizeApproval` scrive `queued`, e un lavoro giornaliero dentro `daily` promuove a `active` i `queued` la cui data è arrivata. ⚠️ **CORREZIONE del 18/8: il censimento del 17/8 diceva 47 letture e ne mancavano parecchie — rifatto, sono circa NOVANTA.** Quello vecchio diceva: **47 letture** di `status: \'active\'` su `Subscription` — 27 «solo active», 15 «anche queued», 5 da decidere (`coach-tasks:201`, `coach:104`, `commerce:1408`, `commerce:1431`, `dashboard:148`), più 5 filtri fatti in memoria. Il pattern: ogni query che filtra **anche sulle date** è solo-active; ogni query che chiede «ha già comprato / ha convertito» va estesa a `queued`, e sono quelle già scritte `status: { in: [\'active\',\'pending\'] }`. ⚠️ Il vincolo in banca dati **non** va nella stessa consegna dello stato: prima lo stato vive e si vede che nessuno è finito nel posto sbagliato. Decisione di Simone (17/8): un piano in coda **conta** come «ha un piano» nelle schermate dello staff, perché è un contratto. ✅ **CONSEGNATA il 18/8 la prima metà**: migrazione additiva, il vocabolario delle quattro domande in `commerce/stati-abbonamento.ts` (⚠️ le letture non chiedevano tutte la stessa cosa: «chi eroga oggi», «ha un piano», «ha già comprato», «c\'è qualcosa in ballo» — finché la coda si scriveva `active` le quattro risposte coincidevano per caso), tutte le letture aggiornate, e `abbonamento-in-corso.ts` che riconosce **le due forme** della coda (lo stato nuovo e le righe vecchie `active` con la partenza nel futuro). ⚠️ **Nessuno scrive ancora `queued`**: la scrittura, la promozione giornaliera e il vincolo sono in `stato-in-coda-scrittura`.',
    categoria: CODICE,
    ordine: 258,
    fatta: true, // prima metà, 18/8 — la scrittura è in `stato-in-coda-scrittura`
  },
  {
    chiave: 'matita-avvisa-sovrapposizione',
    titolo: 'La matita delle date dice cosa sta per rompere',
    dettaglio:
      'Se la data nuova fa sovrapporre questo piano a un altro non concluso, si chiede conferma **con le parole giuste** e si registra chi ha confermato. ⚠️ **Conferma e non divieto**: chi gestisce le schede a volte deve davvero forzare, e un divieto secco si aggira facendo peggio (una riga a mano nel database, che non lascia traccia). §4b di `progetto/NOTA_Due_Piani_Attivi_Lorena.md`. ✅ CONSEGNATA il 17/8 sera: `clients/sovrapposizione-piani.ts` (modulo puro) dice quali piani lo spostamento farebbe sbattere e compone la frase; `updatePlanStart` la restituisce come **409**, cioè lo stesso meccanismo dell\'altro avviso della stessa matita («con questa data il piano risulta già finito»), e la pagina non ha avuto bisogno di una riga: il suo 409 era già generico. ⚠️ La frase dice **tre** cose, e sono le tre che il 16/8 non c\'erano: contro cosa si va a sbattere col NOME, quando quello arriva o finisce, e cosa succede alla cliente — «i menu glieli darà uno solo dei due (quello che finisce più tardi) e i giorni dell\'altro scorreranno senza che riceva niente», che è la conseguenza vera secondo `attivoInCorso`, non un generico «attenzione». ⚠️ Il giorno del passaggio di testimone **è** una sovrapposizione (fine compresa): è il giorno in cui arrivano due menu. ⚠️ Una fine assente è un piano **aperto** e si sovrappone a tutto quello che viene dopo; un `cancelled`/`expired`/`pending` non conta (un pending è un carrello), e nemmeno un `active` con la fine già passata. ⚠️ **Chi supera l\'avviso finisce nel registro** (`sovrapposizioneConfermata` nell\'audit, coi piani coinvolti): senza quella riga, fra un mese una sovrapposizione si rilegge come un difetto del software invece che come una decisione presa. 18 test (15 sul giudizio e sulla frase, 3 sul collegamento: il 409 non scrive niente, `conferma: true` scrive e registra, una data innocua non chiede niente).',
    categoria: CODICE,
    ordine: 259,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'kcal-giornata-sotto-target-segnale',
    titolo: 'Una giornata sotto il fabbisogno usciva identica a una giusta: ora lo dice',
    dettaglio:
      'Trovato il 17/8 scrivendo il foglio delle porzioni (voce 255), ed è la Consegna 1 di quel foglio — quella che non aspetta nessuna decisione. `menu_kcal_balance_tolerance_pct` (default 15%) esisteva già ma era usata come **filtro** e non come **controllo**: `DayCombo` scarta le combinazioni fuori banda e, quando non ne resta nessuna, torna `null`; da lì `deliverIfEligible` compone col selettore per-slot ed **eroga comunque, senza una riga di log**. Una giornata al 65% del fabbisogno — Sonia, finestra «salto la cena» — usciva identica a una giusta. ⚠️ Nello stesso file, per i **pasti** mancanti, il segnale era stato costruito il 17/8 (`fasting_meals_missing` + `diag:digiuni`): per le **calorie** non esisteva l\'equivalente, ed è la stessa domanda sullo stesso codice. Ora un modulo puro (`menu/giornata-sotto-target.ts`) dà il giudizio e `deliverIfEligible` scrive un `logger.warn` con la giornata peggiore e un `analyticsEvent` **`daily_kcal_below_target`** con tutte: target e sua provenienza (fabbisogno o livello), tolleranza, kcal e quota del target per giornata, slot non erogati, finestra, `pastiEsclusi`, dieta. ⚠️ **Non blocca niente**, come `fasting_meals_missing`: una giornata scarsa è meglio di nessun menu, e il rimedio (le porzioni scalate, strada C) non è nelle mani di chi apre l\'app. ⚠️ **Un evento per erogazione, non uno per giorno**: `deliverIfEligible` gira a ogni apertura dell\'app, e un evento per giornata farebbe contare le aperture invece delle giornate. ⚠️ Il controllo sta **dopo** la ripetizione bigiornaliera, le «ricette semplici» e il cambio dei piatti non graditi — sono tre passaggi che riscrivono la giornata, e prima di loro i pasti non sono ancora quelli che la cliente riceverà. ⚠️ La soglia è la STESSA che il motore usa per comporre, e non una costante nuova: due soglie sulla stessa domanda divergerebbero in un pomeriggio (è già successo il 17/8 fra il motore e `diag:digiuni`). 22 test, nessuna migrazione.',
    categoria: CODICE,
    ordine: 260,
    fatta: true, // 17/8 sera: consegnata, test visti cadere per mutazione (10 sul giudizio, 1 sul collegamento)
  },
  {
    chiave: 'annullamento-permesso-dedicato',
    titolo: 'Il × per annullare un piano non si vedeva dal capo nutrizionista',
    dettaglio:
      'Il pulsante è nato il 17/8 con `@Roles(\'admin\')`, «come lo storno e la cancellazione di un acquisto, che sono i suoi vicini di casa per gravità». La gravità era giusta, il cancello no: chi gestisce i piani ogni giorno è il **capo nutrizionista**, e dalla sua utenza il × non compariva nemmeno. ⚠️ L\'unica strada era entrare come admin — cioè fare la cosa grave con l\'utenza sbagliata, e nel registro dell\'annullamento resta scritto «admin» invece del nome di chi ha deciso. Ora la rotta chiede la chiave della matrice `cancel_subscription` in gestione (`@RequirePage`), **di default solo admin**: gli altri li abilita Simone dalla tabella dei permessi, senza un rilascio. È lo stesso passaggio fatto l\'11/8 per «Entra come» (`impersonate`). ⚠️ Nel backoffice il pulsante era legato a `isAdmin`, che in quella pagina vuol dire «vede la pagina Permessi» e non «è admin»: cambiare solo il backend non l\'avrebbe fatto comparire a nessuno. ⚠️ Il permesso nasce con `view: true` e non solo `manage`, perché `getForRole` filtra su `canView` e un `manage` senza `view` non arriverebbe mai al frontend. 5 test **sui decoratori**, che è l\'unico posto dove «chi può bussare» si vede senza avviare l\'applicazione (la lezione di `chat/guardie-rotte.spec.ts`).',
    categoria: CODICE,
    ordine: 261,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'pastiglie-piano-inizio-o-fine',
    titolo: 'Due piani attivi, due pastiglie identiche: ora dicono chi eroga e chi è in coda',
    dettaglio:
      'L\'ultimo pezzo visibile del caso Polidoro. In scheda cliente le pastiglie dei piani scrivevano tutte «Piano · Attivo» più la **data d\'inizio**: con due righe attive erano indistinguibili, e l\'unica differenza stava nel tooltip — che a sua volta poteva mostrare un «+7 giorni» calcolato per la finestra dei menu, non una fine vera. Ora `getDetail` manda per ogni abbonamento `inCorso` e `inCoda`, calcolati con `commerce/abbonamento-in-corso.ts` (`staErogando`/`eInCoda`), e la pastiglia dice **«In coda · dal 25/08»** oppure **«Attivo · fino al 25/08»**. ⚠️ La data mostrata cambia perché è quella che serve a distinguerli: di chi eroga interessa **fino a quando** arrivano i menu, della coda **da quando** partirà. ⚠️ Il giudizio NON è stato riscritto nel browser: sarebbe stata la quinta definizione di «chi sta erogando» (le altre le usano motore, pause, coach e `pickMainSubscription`), e il 17/8 due definizioni della stessa domanda sono divergite nello spazio di un\'ora. ⚠️ La fine si scrive solo se esiste: senza scadenza la pastiglia dice «senza scadenza» invece di inventare una data. 4 test sul contratto che il DTO consuma (i due flag non possono essere veri insieme; un `active` con la fine passata non risulta in corso). ⛔ Il DTO stesso e la pagina restano senza test: `getDetail` non ha spec e il backoffice non ha infrastruttura di test.',
    categoria: CODICE,
    ordine: 262,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'gusti-dalla-scheda-ripuliti',
    titolo: 'I gusti scritti dalla scheda passavano diritti in banca dati (quarta volta)',
    dettaglio:
      'Stessa riga, quarta ripetizione: `latte` che non si espandeva (8/8), `frutta_a_guscio` (12/8), il tag `"Carne .ceci"` che non escludeva niente (17/8). ⚠️ Ogni correzione ha coperto **il percorso da cui era arrivata la segnalazione**, e questo — la scheda della nutrizionista — era quello rimasto fuori: `updateClient` riempie `profileData` **ciecamente** per tutte le `PROFILE_FIELDS`, e la scheda manda una stringa spezzata sulle **sole virgole**. Ora `dislikedFoods` passa da `filtraSpezie` (che **spezza prima di classificare**) e `intolerances` perde i **non-alimenti** (`altro`, `other`, `nessuna`…) come nel questionario. ⚠️ **Due liste, due regole**: un\'intolleranza NON si spezza (è un codice o un termine clinico, «frutta a guscio» non va spaccata) e il cancello spezie non la tocca, perché quella è sicurezza e non gusto. ⚠️ **Le spezie scartate si dicono a chi ha premuto Salva** (`avvisiSpezie` nella risposta, mostrato nel banner della scheda): la risposta della PATCH prima si buttava via, e un «Scheda aggiornata.» che nasconde una riga non scritta fa riscrivere la stessa riga la volta dopo. ⚠️ E la **bonifica** (`npm run pulisci:spezie`) ora passa dalla stessa funzione: prima valutava il termine INTERO, quindi «pepe, ceci» le sfuggiva — ora spezza, e ripulisce anche le liste che cambiano solo forma, che sono le clienti per cui il difetto era invisibile. 10 test su cosa arriva davvero nell\'upsert, visti cadere per mutazione (2 e 2). Nessuna migrazione.',
    categoria: CODICE,
    ordine: 263,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'gaia-chiude-le-conversazioni-lasciate-a-meta',
    titolo: 'Gaia ripeteva la stessa domanda all\'infinito a chi non rispondeva: ora la chiude lei',
    dettaglio:
      'Segnalato da Simone il 18/8 con la chat di una cliente sotto gli occhi: tre volte di fila «Certo [nome], vediamo insieme. Quale alimento vuoi cambiare?», il 10/8 alle 13:07, l\'11/8 alle 16:00 e ancora — e in mezzo **nessuna risposta**. ⚠️ Ma non era Gaia che insisteva, e la ricostruzione conta perché cambia il rimedio: **nessun cron scrive quel messaggio**, lo scrive il pulsante «Sostituisci» della home (`POST /me/threads/sostituzione`). Erano tre **aperture**: la cliente tocca, legge — nel messaggio c\'è anche il menu del giorno, che è metà del motivo per cui uno lo tocca — e se ne va. Lo stato del dialogo scade dopo un\'ora (`SCADENZA_FLUSSO_MS`), quindi l\'apertura dopo riparte da zero e **non sa** di aver già chiesto. Ora una domanda rimasta senza risposta per 24 ore la chiude Gaia: «capisco che l\'argomento non sia più di tuo interesse, chiudo qui — se cambi idea tocca «Sostituisci» quando vuoi». ⚠️ Chiude il **tempo**, non un altro tocco del pulsante: la strada alternativa (alla terza apertura rispondere con la chiusura) le direbbe «capisco che non ti interessa più» **nell\'istante in cui sta chiedendo**. E chiudendo a tempo la seconda domanda identica non arriva nemmeno. ⚠️ Nessuna tabella nuova: il marcatore **è la riga** — il messaggio di chiusura non porta `meta.sost`, quindi chiude il dialogo e insieme impedisce di richiudere la stessa conversazione domani notte. ⚠️ Due guardie sul primo giro dopo il rilascio, che trova tutto l\'arretrato: finestra di **30 giorni** all\'indietro (svegliare qualcuno per una domanda di marzo non è chiudere una conversazione, è aprirne una) e **tetto di 100 per giro, dichiarato nell\'esito** — un tetto silenzioso fa sembrare finito un giro che ne ha lasciate indietro cento. Soglia in `config_param` (`chat_chiusura_silenzio_ore`, 24). Passo del cron notturno, non dei `reminders` che girano ogni dieci minuti: questo scrive alla cliente. 26 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 277,
    fatta: true, // 18/8
  },
  {
    chiave: 'generatore-catalogo-monitoraggio',
    titolo: 'Il generatore di ricette: un battito a ogni giro, `diag:catalogo`, e il riquadro in cima alle Ricette',
    dettaglio:
      'Due domande di Simone del 18/8, e la seconda è quella che conta. La prima: «come facciamo a sapere se sta lavorando?». La riga nel registro (`engine_rule.preset.generate_catalog`) la lasciava solo la generazione **riuscita**, quindi ⚠️ i tre motivi per cui un giro finisce a mani vuote avevano lo **stesso aspetto — nessuna riga**: catalogo completo (tutto bene), AI fuori uso o credito finito (si riproverà, o mai più), e ⛔ **cron spento su Render** (non gira, e non lo dice nessuno). Il terzo è quello che fa danno, perché un cron che non parte non lascia traccia da nessuna parte. Fatto: **① un battito** `cron.genera_catalogo` scritto **sempre**, col motivo e con l\'errore, in un `try` a parte (perdere una generazione per un battito sarebbe il rimedio peggiore del male); **② `npm run diag:catalogo`**. La seconda domanda è arrivata subito dopo: **«non ho capito da dove vedo se le ricette vengono create»** — e aveva ragione: ⚠️ **una shell non è vedere**, e una diagnostica che nessuno lancia è una diagnostica che non esiste. Quindi **③ un riquadro in cima alla pagina Ricette** con le stesse informazioni, dove si guardano già: ultimo giro ed esito, ricette nate negli ultimi 7 giorni, quante aspettano gli allergeni (**col collegamento**, perché finché sono lì non entrano in nessuna dieta), giri ed errori, settimane rimaste. ⚠️ Il giudizio sta in `stato-generatore.ts` con cinque esiti distinti — `mai_partito`, `lavora`, `niente_da_fare`, `errore`, `fermo` — e **«mai partito» non è «tutto a posto»**: dice di andare a guardare su Render, non nel codice. ⚠️ «Fermo» vince sull\'esito: se l\'ultimo giro è di tre giorni fa, che sia andato bene non importa più. ⚠️ E questo riquadro **non sparisce quando va tutto bene**, a differenza degli altri: la domanda a cui risponde è «sta lavorando?», e un riquadro che compare solo quando c\'è un problema risponde «non lo so» proprio a chi viene a controllare. 12 test. Nessuna migrazione.',
    categoria: MANUTENZIONE,
    ordine: 279,
    fatta: true, // 18/8
  },
  {
    chiave: 'dashboard-moduli-nessuno-fisso',
    titolo: 'Dashboard: nessun modulo è fisso, i predefiniti si riconoscono e c\'è «Ripristina default»',
    dettaglio:
      'Risposta di Simone del 18/8, parola sua: «non esistono blocchi fissi in dashboard, tutti sono attivabili o spegnibili e si possono riorganizzare; solo che abbiamo quelli di default che nella lista moduli sono evidenziati da un colore diverso, poi se un utente si è perso preme il pulsante (ripristina default) e noi provvediamo». ⚠️ È la risposta giusta al problema dei blocchi fissi, e vale la pena dirla: invece di **togliere** a qualcuno la possibilità di spegnere un riquadro «perché poi non lo ritrova più», gli si dà **la strada di ritorno**. Un pulsante che rimette le cose a posto vale più di un divieto — e sapere che una scelta si può disfare cambia quanto si è disposti a provarla. Le prime due parti c\'erano già (tutti i moduli si accendono, si spengono e si trascinano); mancavano le altre due. Fatto: i **predefiniti** hanno il bordo colorato e la scritta «predefinito» nell\'elenco attivo, e la pastiglia colorata fra quelli da aggiungere; nuovo pulsante **«Ripristina default»** in cima al riquadro. ⚠️ Il pulsante **chiede conferma con se stesso** («Sicuro? Premi di nuovo») invece che con un pop-up: spegne e riaccende moduli, e un clic per sbaglio disferebbe la disposizione che qualcuno si è costruito.',
    categoria: CODICE,
    ordine: 278,
    fatta: true, // 18/8
  },
  {
    chiave: 'niente-email-clienti-nel-repository',
    titolo: 'Le email di otto clienti erano nei file del repository (e il repository è pubblico)',
    dettaglio:
      'Trovata il 18/8 controllando \'altro\': gli indirizzi di **otto clienti reali** erano scritti in **21 file versionati** — registri, handoff, commenti del codice e tre file di test — arrivati lì un po\' per volta, ogni volta con la buona ragione di «così si capisce di chi si parla». ⚠️ Il problema non è l\'email da sola: accanto c\'erano **nome, finestra del digiuno, fabbisogno calorico, cibi non graditi**. Email + nome + dato sulla salute è la categoria che il GDPR protegge di più (art. 9), su un repository **pubblico**. ⚠️ E ci ho messo del mio: il 17/8 sera ho scritto io un indirizzo in `COMMIT_parte_bonifica_solo_email.txt`, seguendo la convenzione che trovavo nei file senza fermarmi a chiedermi se fosse giusta. Fatto: le 37 occorrenze sostituite con il **nome di battesimo** (Sonia, Maria, Giusy, Patty, Simona, Lorenzo, Gioia, Ilaria), i comandi d\'esempio con un segnaposto (`cliente@esempio.it` negli script, `<email di Nome>` dove serve sapere di chi si parla), e via anche i **cognomi** dei clienti (\'Lorena Polidoro\' → \'Lorena\'). ⚠️ **Ripulire i file non toglie il dato dallo storico**: `git log -p` ce l\'ha ancora. Le due strade che chiudono davvero sono **rendere privato il repository** (immediata, un clic) o **riscrivere lo storico** con `git filter-repo` (invasiva: cambia tutti gli hash, chi ha un clone deve riclonare) — ⛔ è una scelta di Simone. Nuovo `common/email-nei-file.ts` + una guardia che passa in rassegna i file versionati e **diventa rossa** se un indirizzo di un dominio di posta vero rientra: la regola non deve dipendere dalla memoria di nessuno. 8 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 276,
    fatta: true, // 18/8
  },
  {
    chiave: 'lavori-testo-non-aggiornato',
    titolo: '«Aggiorna dal rilascio» non riscrive il testo delle voci già in elenco: adesso lo dice',
    dettaglio:
      'Nato da una domanda di Simone del 18/8 — «la lista lavori la stai tenendo allineata?» — e la risposta onesta era **sì per il file, no per la pagina**. `caricaVociIniziali` fa due cose: **crea** le voci mancanti e **spunta** quelle che il file dà per finite. Il **testo** no: quando nel file un titolo o un dettaglio cambiano — e succede a ogni giro, perché una voce si riscrive quando si scopre la causa vera — in pagina resta la versione di prima, e chi legge crede di leggere l\'ultima parola. Era un aggiornamento che non arriva e nessuno lo dice: la stessa famiglia di tutto il resto. ⚠️ **Non si riscrive di nascosto**, perché la pagina è **lo stato vivo** e una voce può essere stata corretta a mano dal backoffice: si **mostra**. Il riepilogo del pulsante ora elenca le voci il cui testo nel rilascio è più recente, dicendo che qui non viene riscritto — e il messaggio «non c\'è niente da allineare» non compare più quando invece c\'è qualcosa da sapere. 3 test. ⚠️ Se poi si vuole che il file **riscriva** anche il testo, quella è la voce 275: serve prima decidere cosa fare di una voce corretta a mano in pagina.',
    categoria: CODICE,
    ordine: 274,
    fatta: true, // 18/8
  },
  {
    chiave: 'lavori-file-riscrive-il-testo',
    titolo: 'Il rilascio ora riscrive il testo delle voci — tranne quelle corrette a mano da qui',
    dettaglio:
      'Chiusa il 18/8. ⚠️ **La domanda era scritta male**, e Simone l\'ha detto («non capisco la domanda»): era posta da dentro il codice invece che dal caso vero. Il caso vero è questo — la pagina tiene **la sua copia** del testo di ogni voce, e «Aggiorna dal rilascio» aggiungeva e spuntava senza toccare il testo di quelle già in elenco. Una voce si riscrive **a ogni giro**, perché si riscrive quando si scopre la causa vera di un difetto: in pagina restava la ricostruzione sbagliata, e chi la leggeva credeva di leggere l\'ultima parola. ⚠️ **L\'esempio che l\'ha deciso**: la bonifica delle email del 18/8 ha ripulito il file, e nell\'estratto della pagina l\'indirizzo di una cliente era ancora lì. Ora il testo si riscrive — ⛔ **tranne** dove l\'ha scritto una persona dal backoffice: quelle non si toccano e si dicono a parte, perché una correzione fatta a mano che sparisce al rilascio dopo, in silenzio, sarebbe lo stesso difetto spostato di un metro (ed è la pagina che serve a non farlo succedere altrove). Colonna nuova `testo_a_mano`, additiva con default: nessuna riga esistente cambia comportamento. ⚠️ `updatedAt` **non bastava**, ed è il motivo per cui serve una colonna: lo muovono anche la spunta e la risposta, quindi una voce spuntata sarebbe risultata «toccata a mano» e avrebbe smesso di aggiornarsi — il difetto sarebbe tornato, solo più difficile da vedere. ⚠️ Si riscrivono **solo titolo e dettaglio**: `categoria` e `ordine` restano dove qualcuno li ha messi in pagina, perché riscriverli sposterebbe le voci sotto gli occhi di chi le sta guardando. Il riepilogo del pulsante ora dice tutt\'e due le cose: quali aggiorna e quali lascia stare. 3 test. Migrazione additiva `20260818120000_lavoro_testo_a_mano`.',
    categoria: CODICE,
    ordine: 275,
    fatta: true, // 18/8
  },
  {
    chiave: 'catalogo-una-taglia-sola',
    titolo: 'La taglia del catalogo si calcola sulla mediana del fabbisogno delle clienti',
    dettaglio:
      'Chiusa il 18/8 con la risposta di Simone: **«la taglia calorica va calcolata sulla base del fabbisogno della cliente»**. Il difetto, verificato nel codice e non dedotto dai numeri: il generatore scriveva ogni pasto come `menu_daycombo_kcal_target × quota`, e quel parametro era un numero **fisso** (1500, 1600-1800 in tre preset), mentre l\'erogazione punta al **fabbisogno**. ⇒ ⚠️ chi ha un fabbisogno sopra ~1765 kcal (1500 ÷ 0,85, il bordo della banda) riceveva giornate fuori banda **per costruzione, tutti i giorni** — e per lei nessun moltiplicatore di porzione cambia il fatto che le ricette sono scritte più piccole. Ora `tagliaPerIlCatalogo` prende il fabbisogno delle clienti **in corso** che quel preset descrive (stesso regime, obiettivo, struttura di pasti) e ne fa la **mediana**. ⚠️ **La mediana e non la media**, ed è tutto il modulo: una cliente a 3200 in mezzo a dieci a 1600 sposterebbe la media a 1745 e il catalogo con lei — dieci persone riceverebbero piatti pensati per una. La mediana è la persona in mezzo, e non si lascia spostare da un caso estremo. ⚠️ **Tre stati**: senza nessuna cliente calcolabile resta la taglia del preset **e si dice il motivo**, perché un numero calcolato sul nulla ha lo stesso aspetto di un numero calcolato bene. ⚠️ E si conta **quante restano fuori banda anche con la taglia scelta**, in tutt\'e due i versi — chi sta molto sopra riceve poco, chi sta molto sotto riceve troppo, e contare solo i primi farebbe sembrare che alzare la taglia non costi niente. È il numero che dice se serve una **seconda taglia** (`Diet.levels` nasce per quello, e il livello 2 non è mai stato usato): la domanda resta aperta, ma da oggi ha una cifra davanti invece di un\'impressione. ⚠️ **Vale solo per le bozze nuove**: le diete già approvate e i menu già erogati non cambiano, e la taglia arriva nel piatto quando la nutrizionista **approva** il catalogo generato — cioè con una persona in mezzo. Interruttore in `config_param` (`catalogo_taglia_dal_fabbisogno`, acceso): se qualcosa non torna si spegne senza un rilascio, e si torna al numero del preset. 12 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 273,
    fatta: true, // 18/8
  },
  {
    chiave: 'diag-porzioni-retroattiva',
    titolo: '`npm run diag:porzioni`: misura le giornate GIÀ erogate, senza aspettare che qualcuno apra l\'app',
    dettaglio:
      'Nata da un\'esecuzione vera: `diag:kcal` legge gli **eventi** che l\'erogazione scrive quando eroga, quindi risponde solo per chi ha aperto l\'app dopo il rilascio del segnale — e alla prima prova, giustamente, non sapeva niente (voce 271). Questa guarda invece i **giorni già in banca dati** e risponde subito. ⚠️ Il giudizio **non è riscritto**: chiama `giornateSottoTarget`, la stessa funzione del motore, e il target lo calcola `KcalNeedService`, la stessa classe che usa l\'erogazione — allo script si passa solo la porta per leggere i `config_param`. Due risposte diverse sarebbero un difetto, non un metodo diverso: è la lezione del 17/8, quando motore e `diag:digiuni` si sono contraddetti in un pomeriggio. Stampa per cliente il **perché** (finestra del digiuno, spuntini tolti, o «è il catalogo»), la **quota peggiore**, il **fattore necessario** e se il tetto che stai provando basta — cioè i numeri con cui si rispondono le due domande cliniche della voce 255. ⚠️ Dice **due limiti** invece di lasciarli dedurre: si confrontano giornate già erogate col fabbisogno di **oggi** (se peso o obiettivo sono cambiati, il numero di ieri è misurato col metro di adesso — va bene per scegliere un tetto, non per dire a una cliente cosa ha mangiato), e le clienti **senza fabbisogno calcolabile** (mancano sesso, età, altezza o peso) si contano a parte, perché per loro il motore usa le kcal del livello e da lì non si vede: non è un ✓, è un «non lo so». `TETTO=`, `GIORNI=` e `SOLO=<email>` come le altre. Nessuna scrittura, nessuna migrazione. ⚠️ **Corretta il 18/8 dopo la prima lettura in produzione**, due cose: la colonna «col tetto» giudicava contro il **100%** e non contro la **banda** — con `TETTO=1.6` una cliente al 60% arriva al 96% e leggeva «NON basta», facendo sembrare quel tetto peggiore di quanto sia; e mancavano i numeri che spiegano il caso (**target**, **kcal della giornata più corta**, **sesso**), senza i quali non si capisce se una giornata è corta per la finestra o perché il catalogo è dimensionato più in basso del fabbisogno di quella persona. ⚠️ La prima lettura vera, su 84 giornate e 18 clienti, ha detto proprio questo: **quattro dei cinque casi sono «nessuna esclusione: è il catalogo»**, cioè il moltiplicatore di porzione lì non è la cura giusta.',
    categoria: MANUTENZIONE,
    ordine: 272,
    fatta: true, // 18/8
  },
  {
    chiave: 'diag-kcal-tre-stati',
    titolo: '«Nessuna giornata sotto il fabbisogno ✓» diceva ✓ anche quando non lo sapeva',
    dettaglio:
      'Trovato **alla prima esecuzione in produzione**, il giorno dopo aver scritto `diag:kcal` (voce 268): zero eventi, e lo script ha stampato «Nessuna giornata sotto il fabbisogno negli ultimi 14 giorni ✓». ⚠️ Quel ✓ non era vero, era **«non lo so»**: il segnale scatta **all\'erogazione**, e l\'erogazione gira quando la cliente apre l\'app — senza consegne nella finestra, zero eventi non dice niente sulle calorie di nessuno. Una diagnostica che mostra la faccia del «va tutto bene» quando non sa è il difetto di famiglia di questo progetto, fatto con le nostre mani e a ventiquattr\'ore di distanza dalla riga che lo denuncia. Ora gli stati sono **tre**, e il numero che li distingue è quante **giornate sono state erogate** nella finestra: nessuna erogazione → «non lo so, e non vuol dire che le calorie siano a posto»; erogazioni ma nessun evento → ✓ **col numero delle erogazioni accanto**, che è la prova che il controllo ha avuto occasione di scattare; eventi → la tabella. ⚠️ E la seconda metà: la scrittura dell\'evento era dentro un `.catch(() => undefined)`, quindi un errore di scrittura sarebbe stato **indistinguibile da un ✓**. Ora degrada come prima ma **lo scrive nei log** — e lo stesso è stato fatto al gemello `fasting_meals_missing`, che aveva lo stesso silenzio. Un test in `menu.service.spec` tiene fermo che il menu si eroga lo stesso e che l\'avviso esce: spegnendolo cade.',
    categoria: CODICE,
    ordine: 271,
    fatta: true, // 18/8
  },
  {
    chiave: 'popup-valutazioni-gia-date',
    titolo: 'Il popup «Com\'è andata ieri?» richiedeva le stelle dei piatti già votati',
    dettaglio:
      'Punto 6 della voce 253 (il giro sistematico sulle rotte `/me/*` del 16/8): `GET /me/ratings/pending` esiste dal principio — torna i pasti degli ultimi tre giorni **ancora senza valutazione** — e **non la chiamava nessuno**. Il popup si costruiva l\'elenco da `/me/menu`, cioè dal menu del giorno, e chiedeva le stelle di **tutti** i piatti di ieri. ⚠️ Si vedeva su due strade: chi valuta un piatto da un\'altra schermata se lo ritrova nel popup, e chi apre l\'app da un **secondo dispositivo** ricomincia da capo, perché il «già visto» di oggi vive nel `localStorage` di quel telefono mentre le valutazioni stanno sul server. Ora l\'elenco lo dice il server. ⚠️ Il filtro sul giorno **resta**: la rotta torna tre giorni, il popup ne chiede uno — portare in primo piano anche l\'altro ieri non è una correzione, è una domanda in più a una persona, e va decisa. ⚠️ Lo stesso piatto in due pasti dello stesso giorno si chiede **una volta sola**: la valutazione è unica per `(cliente, ricetta, giorno)`, e chiederla due volte vorrebbe dire far rispondere due volte per scrivere una riga sola, con la seconda risposta che cancella la prima senza dirlo. Regola in un modulo puro (`app/src/lib/valutazioni-da-chiedere.ts`) con 5 test, visti cadere per mutazione. ⚠️ Arriva alle clienti solo con la prossima pubblicazione o OTA.',
    categoria: CODICE,
    ordine: 269,
    fatta: true, // 18/8
  },
  {
    chiave: 'aderenza-senza-stelle-scrive-tre',
    titolo: 'Le stelle mai date non orientano più il motore',
    dettaglio:
      'Chiusa nella notte fra il 18 e il 19/8 con la decisione di Simone: **quel 3 va escluso dal gradimento**. La parte su **cosa si scrive** resta com\'era (sua risposta del 18/8: «se il cliente non specifica metti 3 stelle»), e dal 18/8 il popup marca quei voti col tag `stelle_non_date`. ⚠️ Quel 3 **non è un\'opinione**: è un valore di scorta dell\'app, e finiva nel segnale «gradimento» con cui il motore decide cosa riproporle — una cliente che diceva soltanto «non l\'ho seguita» risultava aver dato **tre stelle** a quel piatto, e se lo rivedeva davanti con la faccia di uno che le era piaciuto. Ora i voti marcati restano fuori da **tre letture**, quelle in cui le stelle **orientano il motore**: il punteggio del pool (`menu.service`, cioè cosa le viene proposto), il gradimento del ciclo (`cycle.service.menuGradimento`) e i segnali del motore (`engine/signals-collector`). ⚠️ **Si filtra nella query e non in memoria**: filtrando dopo bisognerebbe leggere i tag ovunque, e il primo posto che se ne dimentica torna a contare il valore di scorta senza che si veda. ⚠️ **Restano com\'erano** i «piatti più apprezzati» del report e le schermate dello staff — scelta di Simone: là il numero è il resoconto di quello che è stato scritto, non una decisione su cosa arriverà nel piatto. ⚠️ **E i voti senza tag contano**: sono quelli scritti prima del 18/8, e non c\'è modo di sapere quali fossero valori di scorta — trattarli come «non dati» butterebbe via la storia di chi le stelle le ha date davvero. ⚠️ Il prezzo, detto: per chi non valuta quasi mai il motore ha **meno segnale** e torna a scegliere per varietà e calorie invece che per gusto — non peggio di prima, perché prima sceglieva **col segnale sbagliato**, ma diverso. Modulo `menu/stelle-che-contano.ts`, 6 test.',
    fatta: true, // 19/8, notte
    categoria: SIMONE,
    ordine: 270,
  },
  {
    chiave: 'diag-kcal-sotto-target',
    titolo: '`npm run diag:kcal`: quante giornate escono sotto il fabbisogno, e con che tetto si coprono',
    dettaglio:
      'Il segnale `daily_kcal_below_target` esiste dal 17/8 (voce 260) e da allora accumula: mancava il posto dove **leggerlo**. Questa diagnostica di sola lettura lo mette in tabella — cliente, perché le manca (finestra del digiuno, spuntini tolti da Vera, o nessuno dei due), **quota peggiore** della giornata, **fattore necessario**, e quante giornate. ⚠️ Serve a rispondere **con dei numeri** alle due domande cliniche ancora aperte del foglio delle porzioni (voce 255): `TETTO=1.6 npm run diag:kcal` dice quante clienti quel tetto copre e quante restano corte, e di quanto — cioè trasforma «che tetto diamo?» e «cosa si fa quando non basta?» da domande di principio in due conteggi. `GIORNI=` allarga la finestra, `SOLO=<email>` guarda una cliente sola. ⚠️ Si prende l\'evento **più recente** per cliente: quello vecchio racconta una situazione già cambiata. ⚠️ E dice a voce alta il limite che conta: **chi non compare non è detto che stia bene** — vuol dire che in quella finestra non le è stata erogata una giornata sotto banda, o non le è stata erogata affatto (`deliverIfEligible` gira quando la cliente apre l\'app). ⚠️ Segnala a parte le clienti sotto target **senza** digiuno e **senza** spuntini tolti: lì il moltiplicatore di porzione non c\'entra niente, è il catalogo che non ha giornate nella banda, e la strada è `diag:varieta`. Nessuna scrittura, nessuna migrazione.',
    categoria: MANUTENZIONE,
    ordine: 268,
    fatta: true, // 18/8
  },
  {
    chiave: 'esclusioni-con-negazione',
    titolo: 'Le esclusioni scritte come frasi ora vengono dette a chi le scrive, invece di sparire',
    dettaglio:
      'Chiusa il 18/8 con la risposta di Simone: **«le esclusioni devono essere un elenco, ogni parola deve essere seguita da una virgola, aiutiamo le clienti a scrivere in modo corretto»** — la strada 2. Il campo dei cibi non graditi accetta **frasi** e il motore legge **alimenti**: quello che si scrive in mezzo si perdeva in silenzio. I due casi veri, trovati in produzione: ⚠️ **«pesce tranne salmone, tonno»** — come termine intero non esclude niente (il pesce continua ad arrivare), e spezzato sulla virgola rende escluso il **tonno**, che è l\'opposto di quello che aveva scritto: lo elencava fra le eccezioni. E **«Non mi piace la cicoria»**, una frase intera salvata come alimento. Nuovo `common/esclusioni-scritte-bene.ts`: riconosce le **eccezioni** (`tranne`, `eccetto`, `a parte`, `salvo`, `ma non`, …), le **frasi** (`non mi piace`, `non mangio`, `odio`, `niente`, …) e le voci **troppo lunghe**, e torna la frase da mostrare a chi sta scrivendo. ⚠️ **Non corregge niente**, ed è la scelta che conta: su «pesce tranne salmone» la correzione più ovvia — tenere la prima parola — escluderebbe **tutto il pesce, salmone compreso**, cioè di nuovo il contrario. Chi ha scritto la frase è l\'unica persona che sa cosa intendeva, e a lei si **chiede**. Sulle frasi invece il suggerimento c\'è («Volevi scrivere «cicoria»?»), perché lì non è indovinare. ⚠️ Il messaggio dice **cosa succede davvero** («così com\'è non toglie niente dal menu»), non «formato non valido»: chi legge «formato non valido» corregge la forma, chi legge «il pesce continuerà ad arrivarti» capisce cosa sta perdendo. E chiude sempre con **come si scrive**, o è un rimprovero. ⚠️ Una parola di eccezione dentro un\'altra parola non conta («marmellata» non contiene «ma»): senza il confronto per parola l\'avviso avrebbe segnalato mezzo catalogo al primo giro. Attivo su **quattro porte**: profilo in app (la cliente si vede tornare il testo nel campo, così corregge invece di riscrivere), pulsante «non gradisco» dell\'app, scheda del backoffice e scheda coach in app — e ⚠️ l\'avviso delle spezie e questo **si sommano** invece di zittirsi a vicenda, che è un difetto già pagato il 17/8. ⚠️ Il controllo vive nel **backend** e non nell\'app: sarebbe stata la seconda copia di una regola, e il giorno che divergono l\'app direbbe una cosa e il motore ne farebbe un\'altra. ⛔ Resta fuori il **questionario**, che è la porta d\'ingresso vera. 28 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 267,
    fatta: true, // 18/8
  },
  {
    chiave: 'bonifica-spezie-solo-email',
    titolo: 'La bonifica dei cibi esclusi si può applicare a una cliente per volta',
    dettaglio:
      '`npm run pulisci:spezie` scriveva **tutto o niente**, e alla prima esecuzione in produzione (17/8) è bastata la prima anteprima per far vedere perché non basta: due clienti in elenco, una da sistemare subito e una da guardare a mano (la lista con «pesce tranne salmone, tonno», voce 267). La scelta era fra applicare anche quella o non applicare niente. Ora c\'è `SOLO=<email>` — anche più email separate da virgola — che vale sia in anteprima («guarda solo questa») sia con `CONFERMA=1` («applica solo a queste»). ⚠️ E un\'email che non corrisponde a nessun profilo **viene detta**: senza, un refuso darebbe «nessuna spezia da ripulire ✓», cioè la faccia del «va tutto bene» su un lavoro che non è stato fatto. I conteggi in stampa contano i profili **in esame**, non tutti.',
    categoria: MANUTENZIONE,
    ordine: 266,
    fatta: true, // 18/8
  },
  {
    chiave: 'revisione-serata-17-8',
    titolo: 'La revisione delle cinque consegne del 17/8: sette rilievi, tre seri',
    dettaglio:
      'Fatta rileggere la serata da un revisore prima di chiudere la giornata, come dice la regola — e ha trovato sette cose, tutte in codice che compilava e passava i test. ⚠️ **Le tre serie: 1)** la matita contava il **passaggio di testimone** come sovrapposizione (piano A finisce il 25/08, piano B parte il 25/08), ma quella è la coda che `finalizeApproval` costruisce da sola mettendo l\'inizio alla fine del piano in corso: l\'avviso del caso Lorena sarebbe scattato su **ogni rinnovo**, anche risalvando la stessa data — e un avviso che compare sempre è uno che si impara a cliccare via. Ora toccarsi non è sovrapporsi. **2)** Il form della scheda rimanda TUTTI i campi a ogni salvataggio, quindi la pulizia dei gusti riscriveva le intolleranze di una cliente quando una coach correggeva il telefono, col log modifiche che lo attribuiva a lei: ora si pulisce solo ciò che è **davvero cambiato**, la stessa regola di `allergies` e `fastingWindow`. **3)** Togliendo `@Roles(\'admin\')` dall\'annullamento è caduta la premessa del fail-open di `PageGuard` («tanto `@Roles` resta applicato»): un blip del database e una cliente loggata poteva chiamare `POST /admin/subscriptions/:id/cancel` — che non verifica proprietà — e annullare il piano di chiunque. Ora il fail-open vale **solo se la rotta ha ancora un `@Roles`**, altrimenti chiude (vale anche per `impersonate`, aperta dall\'11/8). **Le altre quattro:** i due avvisi della matita si zittivano a vicenda (confermato il primo, il secondo non si vedeva: ora si chiedono in una domanda sola); il giorno era confrontato in **UTC** e non nel fuso aziendale (fra mezzanotte e le due, avvisi fantasma); la scheda coach **in app** ignorava `avvisiSpezie` esattamente come faceva il backoffice prima; un campo mancava nel tipo di `pulisci-spezie.ts`. 10 test nuovi, fra cui quattro sul fail-open del guardiano. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 265,
    fatta: true, // 17/8 notte
  },
  {
    chiave: 'gusti-altre-porte-di-scrittura',
    titolo: 'Vera vince sempre su Gaia: la spezia dettata dalla nutrizionista si scrive (ma il tag si spezza lo stesso)',
    dettaglio:
      'Chiusa il 18/8 con la risposta di Simone alla domanda «se la nutrizionista detta una spezia, cosa si fa?»: **«Vera vince sempre su Gaia»**. Le due porte di Vera — `vera-chat.service.scriviRestrizione` (una cliente) e `applica-proposta.applicaRestrizione` (una coorte) — **non** passano da `filtraSpezie`: chi detta è la professionista che firma le diete, e una sua parola non viene scartata. ⚠️ **Ma l\'altra metà di quella funzione resta, e la distinzione è tutto il lavoro**: `filtraSpezie` fa due cose diverse — **scartare** (una decisione di prodotto, e Vera la vince) e **spezzare** (correggere la forma di un dato perché continui a funzionare). «pepe, ceci» scritto in una riga sola non compare in nessun piatto e da lì in poi non esclude più niente — è il caso del 17/8 con `"Carne .ceci"` — e sulla coorte quel danno si moltiplica per N profili. Confondere le due metà avrebbe dato a Vera il potere di scrivere un tag rotto. ⚠️ E il pool che si stringe resta **detto**: la chat mostra l\'anteprima (`raccontaPool`) prima che scriva, quindi la nutrizionista sceglie sapendo cosa resta — che è la differenza fra accettare una conseguenza e non vederla. ⛔ Restano aperte le altre due porte del censimento: `menu.service.substituteDisliked` con `scope: forever` (ha il cancello spezie ma non spezzava — ⚠️ ora però ha davanti il controllo delle esclusioni scritte male, voce 267) e `sostituzione-chat.service.aggiungiAiNonGraditi` di Gaia, a rischio basso perché il valore è un nome di ingrediente del catalogo. E resta il testo grezzo che finisce nel report PDF della cliente (`plan-report.service.ts:250`). 2 test.',
    categoria: CODICE,
    ordine: 264,
    fatta: true, // 18/8
  },

  {
    chiave: 'vera-coda-approvazioni',
    titolo: 'Vera fa approvare il catalogo una riga per volta: allergeni, ricette, combinazioni',
    dettaglio:
      'Richiesta di Simone del 18/8: «se ci sono ricette da approvare, combinazioni da approvare, allergeni da approvare, vanno tutti inviati a vera che aiuta il nutrizionista a verificare uno per uno». Le tre code esistevano già — sono i tre contatori della pagina di validazione — ma si svuotavano con tre pulsanti che agiscono **in blocco** sull\'intera dieta: ⚠️ un pulsante che verifica sessanta piatti in un colpo non verifica niente. Ora si dice «approvazioni» (o si clicca la pastiglia in cima alla pagina di Vera) e la coda arriva una riga per volta, **con dentro cosa si sta approvando**: ingredienti, alimenti del gruppo, pasto e calorie — perché una domanda che dice solo il nome si risponde «sì» senza guardare. ⚠️ **Gli allergeni vengono prima dell\'accensione e mai insieme sulla stessa ricetta**: finché sono da guardare, la domanda «la accendo?» non compare. ⚠️ Quella domanda non è nuova: è quella della voce 227, che la coda CHIAMA invece di rifarla. ⚠️ «Non lo so» è un **salta**, non un no. ⚠️ Il **no non scrive niente** e dice dove si cambia davvero. ⚠️ Si avanza perché la riga è stata guardata, non perché la scrittura ha detto sì. Scritture dalle porte di sempre: `updateRecipe`, `setRecipeAllergens`, `EquivalenceService.approve`.',
    categoria: CODICE,
    ordine: 265,
    fatta: true, // 18/8
  },
  {
    chiave: 'catalogo-settimane-incomplete',
    titolo: 'Il generatore riempie le settimane a metà invece di rispondere «c\'è già»',
    dettaglio:
      'Simone, 18/8: «le ricette ovviamente vanno sempre a riempimento delle settimane incomplete». Era già la regola del cron, ma la stessa domanda si rispondeva in due punti con due criteri: per il cron «magra» = un pasto con meno di sette piatti **diversi**, per il pulsante *genera* «fatta» = esiste una giornata con quel numero. ⚠️ Il conto delle settimane mente: quattro giornate nella settimana 2 fanno «due settimane fatte», e da lì quella settimana resta a metà **per sempre**. Ora la risposta sta in un modulo solo (`settimana-magra.ts`) che chiamano tutti e due; il generatore legge le giornate e non solo il giorno più alto; la settimana da fare è la prima magra; «c\'è già» si dice solo quando è davvero piena. ⚠️ Col rovescio a test: se la settimana chiesta è piena non si tocca niente.',
    categoria: CODICE,
    ordine: 266,
    fatta: true, // 18/8
  },

  {
    chiave: 'ordine-menu-difetti',
    titolo: 'Ordine del menu: i cinque difetti del foglio del 18/8 — chiusi',
    dettaglio:
      'Foglio `progetto/DIFETTI_Ordine_Menu.md`. ⚠️ Il più grave era **perdita di dati silenziosa**: `menuOrder` passava dalla `clean` comune alle preferenze, che deduplica con un `Set` — giusto per le rotte, ma i **titoli dei gruppi** vivono nella stessa lista, e due gruppi omonimi producevano due righe identiche: la seconda spariva e i due gruppi diventavano uno, senza un errore. Ora `backend/src/users/ordine-menu.ts` deduplica solo le rotte, fa `trim` e taglia a 64 **lato server** (⚠️ la casella ha `maxLength={24}`, ma il limite del browser non è un limite). Poi: l\'**icona segue le voci e non il titolo** (rinominare un gruppo la faceva sparire); via un `?? true` che non scattava mai; il **gruppo vuoto** lo dice nell\'editor invece di sembrare un salvataggio fallito. ⚠️ E il pezzo sotto a tutti: **il backoffice non aveva test** — aggiunti vitest, il passo «Test» in CI e `menuOrder.spec.ts` (14 casi).',
    categoria: CODICE,
    ordine: 267,
    fatta: true, // 18/8
  },
  {
    chiave: 'ordine-menu-difetti-minori',
    nata: '2026-08-18',
    titolo: 'Ordine del menu: resta solo il difetto 6, le righe morte nelle preferenze',
    dettaglio:
      'Il difetto **6**, l\'ultimo dei sette. ⚠️ La numerazione viene dalla rilettura del 18/8 mattina ed è raccontata nella voce del `REGISTRO.md` di quel giorno: il foglio `progetto/DIFETTI_Ordine_Menu.md` che alcuni testi citavano **non esiste nel repository** (corretto la sera stessa, rileggendo). ✅ **Il 7 è chiuso la sera del 18/8**: `conNascosteAlLoroPosto` rimette le voci che questa persona non vede **dove le aveva messe**, invece che in fondo all\'ultimo gruppo — prima venivano tenute (giusto) ma spostate (sbagliato), quindi il giorno che il permesso arrivava la pagina ricompariva in coda al menu e nessuno collegava le due cose. ⚠️ Si lavora sulla **lista salvata** e non sulla vista, perché la vista le voci nascoste non le contiene nemmeno; l\'ancora è preferibilmente una **rotta** e non un titolo, perché due gruppi possono chiamarsi uguale e un\'ancora ambigua rimetterebbe la voce nel gruppo sbagliato; se prima di lei non c\'è nessuna rotta sopravvissuta ci si aggancia al titolo, e se non c\'è nemmeno quello la riga torna in cima. 8 test (22 in tutto nel file). **Resta il 6:** una voce **tolta dal software** resta nelle preferenze di chi l\'aveva ordinata — in lettura viene saltata, ma la riga consuma una delle 80 disponibili finché la persona non risalva. Si chiuderebbe riscrivendo indietro l\'ordine ripulito in lettura, ⚠️ ma è **una scrittura che nessuno ha chiesto**: non ne vale la pena finché il tetto degli 80 non dà fastidio, ed è la stessa ragione per cui era stato lasciato aperto. ✅ **Chiuso il 20/8, e non con la scrittura che la voce temeva.** Simone: «i punti aperti di codice perché non li fai?» — domanda giusta, e la risposta era che «non conviene finché il tetto degli 80 non dà fastidio» è **un\'assunzione mai misurata**, cioè un\'opinione travestita da conclusione. ⚠️ Rileggendo il codice il rimedio è un altro: una rotta salvata che non compare nella vista può essere due cose **diverse**, e finivano nello stesso mucchio — **nascosta** (la pagina esiste, questa persona non ha il permesso → va tenuta dov\'era, è il difetto 7) e **morta** (la pagina non esiste più → consuma una riga per sempre). Distinguendole, la riga morta si toglie **nel momento in cui la persona salva comunque**: nessuna scrittura in più, e il posto liberato è vero. La voce aveva ragione sul rimedio che proponeva e torto sulla conclusione. ⚠️ E la rete: **senza l\'elenco delle rotte non si toglie niente** — un difetto lì cancellerebbe l\'ordine di tutti, e «non lo so» deve costare meno di «ho indovinato».',
    categoria: CODICE,
    ordine: 268,
    fatta: true,
  },

  {
    chiave: 'tabella-capo-valori-mancanti',
    titolo: 'I valori nutrizionali che mancavano: integrati e approvati dal capo (18/8)',
    dettaglio:
      'Il capo nutrizionista ha mandato la tabella completa dei 57 alimenti, tutte le righe «Confermato». ⚠️ Confronto riga per riga prima di toccare niente: **58 differenze, tutte nella stessa direzione** (un buco da noi, un valore da lui), **zero contraddizioni**. Entrano i sei IG che mancavano (borlotti 28, kiwi 52, latte parz. scremato 32, avocado 10, mandorle 15, noci 15) e i valori per 100 g di dieci righe; le note che dicevano «la riga resta senza indice» sono state riscritte, perché accanto a un numero si smentivano da sole. ⚠️ **«Non si applica» non è «non lo so»**: 14 alimenti senza carboidrati hanno N.D. nella sua colonna, e adesso Gaia lo DICE invece di tacere (con zero numeri autorizzati). ⚠️ La tendina in backoffice aveva tre opzioni: salvare una di quelle righe avrebbe riscritto «non lo so» sopra la sua firma — aggiunta la quarta. ⚠️ E il prezzo della firma: da adesso il seed non governa più quelle righe, quindi cambiare un numero nel file non lo cambia più in produzione. `tabella-capo.spec.ts` (61 test) rifà da solo il confronto. ⛔ **Resta da lanciare** `npm run seed:nutrienti` in produzione (gira comunque a ogni deploy).',
    categoria: DATI,
    ordine: 269,
    fatta: true, // 18/8
  },

  {
    chiave: 'stato-in-coda-scrittura',
    titolo: 'Il piano «in coda» adesso si scrive davvero — e dodici letture che dicevano il falso',
    dettaglio:
      'La SECONDA metà della voce 258, chiusa il 19/8. `finalizeApproval` scrive `queued` invece di `active` con la partenza nel futuro, e un passo notturno (`promuoviCodeArrivate`, **primo** del `daily` perché tutti gli altri leggono lo stato) fa partire le code arrivate. ⚠️ **Ma la parte grossa della consegna non è quella**: la revisione avversariale ha trovato che il 18/8 le letture erano state adeguate solo in parte — **dodici punti** confrontavano ancora `status === \'active\'` a mano, e con la scrittura nuova avrebbero fatto danno in silenzio. Il peggiore: `menu.service.menuStatus`, che a una cliente appena pagante con partenza lunedì scriveva «**il tuo piano è terminato, riattiva un piano dal Negozio**» il giorno stesso del pagamento. Poi: l\'erogazione perdeva i due giorni di anteprima; il calcolo della coda non vedeva le code (due piani pagati sovrapposti — il caso Lorena riaperto dalla scrittura nuova); l\'abbonamento Stripe in coda non compariva nel profilo e **la disdetta rispondeva 404** (paga e non può uscire); i giorni di «porta un\'amica» e quelli di pausa si perdevano; scheda cliente, diagnostiche, contatori e check-in tacevano. ⚠️ E **cinque punti scrivevano** la data d\'inizio decidendo ognuno per sé: ora la domanda «attivo o in coda?» ha una risposta sola (`statoPerInizio`). ⚠️ Tre difetti erano **più vecchi della voce**: l\'`actorId: \'system\'` viola la chiave esterna su `user` e il registro non si scriveva (**lo stesso difetto era in produzione da settimane** su `commerce.payment.approve` di tutti i pagamenti con carta: chiuso lo stesso giorno, voce `audit-attore-che-non-esiste`); chi comprava il rinnovo in anticipo **smetteva di ricevere menu** perché la finestra si misurava sulla data del profilo, che l\'acquisto in coda riallinea al piano NUOVO (dal 10/8); la data scelta dopo il pagamento da una cliente **di ritorno** non muoveva l\'abbonamento. ⚠️ Una coda arrivata a scadenza **senza mai partire non si promuove**: da attiva-e-finita prenderebbe, nella stessa notte, il report di fine percorso e la cancellazione della personalizzazione — cose che non si tornano indietro. Resta `queued`, si grida nei log e si vede in `npm run diag:coda`. 3590 test verdi (229 suite), tre ronde di revisione avversariale e due di mutation testing. Nessuna migrazione. **Resta**: il vincolo in banca dati, e le quattro decisioni del foglio `HANDOFF_2026-08-19.md`.',
    categoria: CODICE,
    ordine: 270,
    fatta: true, // 19/8
  },

  {
    chiave: 'ingredienti-nomi-liberi',
    nata: '2026-08-19T17:20',
    priorita: 'bassa',
    titolo: 'I nomi liberi degli ingredienti: l\'abbinamento è acceso, resta il lavoro a mano sulla lista corta',
    dettaglio:
      'Dal primo giro di `npm run diag:crudo-cotto` in produzione (19/8). Gli ingredienti usati nelle ricette **attive** e sconosciuti alla tabella nutrienti sono **7831**. ⚠️ Il numero non si legge come «mancano 7831 righe»: guardando i primi si capisce cosa sono davvero. Ci sono gli **aromi** — aglio (3888 ricette), sale (3296), limone (3146), pepe nero (1755), prezzemolo fresco — che nel conto delle calorie pesano zero e la tabella non li avrà mai tutti. E soprattutto ci sono le **varianti dello stesso nome**: «olio extravergine» (2771), «olio extravergine d oliva» (2486), «olio extravergine oliva» (1237) sono lo stesso olio scritto in tre modi, e in tabella «olio extravergine di oliva» c\'è (3025 ricette lo trovano). ⛔ **La causa è che le ricette generate dall\'AI usano nomi liberi**, e nessuna tabella potrà coprirli: riempire l\'elenco è una battaglia che si perde a ogni generazione nuova. Le strade sono altre, e sono decisioni: (a) **normalizzare in lettura** — un dizionario di sinonimi che porta le tre scritture dell\'olio alla stessa riga, come già si fa per le allergie; (b) **vincolare la generazione** a un elenco chiuso di ingredienti, che è il modo di non avere il problema ma restringe le ricette; (c) **niente**, e si accetta che il conto dei macro salti gli aromi (che è quasi sempre giusto) e ogni tanto un ingrediente vero. ✅ **Fatta la (a) il 19/8, e il danno era più piccolo di come l\'avevo raccontato**: le ricette generate portano le calorie calcolate dall\'**AI**, non sommate dalla tabella — la somma la fa solo Vera quando la nutrizionista detta, e lì quello che manca si dichiara e blocca. Il danno vero era che **Gaia diceva «non ce l\'ho» su alimenti che ci sono**. L\'abbinamento ha **due** regole: le paroline non contano («olio extravergine d oliva» = «olio extravergine di oliva») e la ricetta può aggiungere solo **qualificatori innocui** («spinaci freschi» → «spinaci»). ⚠️ La terza che sembrava ovvia — «manca solo una parolina» — il test l\'ha bocciata prima della produzione: se manca una parola della tabella, quella parola **distingue**. ⚠️ E la prima versione della seconda regola era **sbagliata** e l\'ha mostrato il giro in produzione: accettava qualunque parola in più, e faceva diventare «semi di zucca» la zucca (531 ricette, venti volte le calorie) e «olio di cocco» l\'olio d\'oliva. Ora l\'elenco dei qualificatori è **chiuso**: si legge e si discute, mentre «tutto il resto è innocuo» sbaglia in silenzio. ⛔ **Resta la (b)** — vincolare la generazione a un elenco chiuso di ingredienti — che non si fa: impoverisce le ricette e non sistema le 19347 già generate. ⛔ E resta il lavoro **a mano** sulla lista 3b della diagnostica: le prime 32 righe le ha compilate la nutrizionista il 19/8 (`npm run importa:alimenti`), e «olio extravergine» da solo si chiude con **un sinonimo**, non con una regola. ✅ **E il 19/8 sera `npm run diag:ricerca` ha prodotto la lista 3b in ordine di urgenza, per caso**: cercava le trappole della ricerca e ha trovato che i nomi che le fanno scattare sono tutti nomi **che in tabella non ci sono**. In testa, con quante volte compaiono negli ingredienti delle ricette attive: melanzane/melanzana (1025), olive denocciolate (385 fra denocciolate/denocciolati/snocciolate/snocciolati), melagrana (72), cipollotto (55), piselli sgranati (37), coda di pescatrice (32), datterini (22), fagiolini (15), spinacino (11). ⚠️ Sono alimenti **veri e comuni**, non casi limite, e finché mancano il conto della ricetta li salta e Gaia non ne sa parlare. `QUANTI=60 npm run diag:ricerca` le mostra tutte e quaranta. ✅ **E il 19/8 sera è arrivata la tabella per correggere a mano** (risposta di Simone su questa voce: «crea una tabella dove possiamo correggere a mano»). ⚠️ **Non è una pagina nuova e non è una tabella nuova**: «quali alimenti ci mancano» è **una** domanda, e la risposta arrivava già da due parti — le clienti che li chiedono a Gaia e le ricette che li usano. Due elenchi divergono al primo giorno e fanno lavorare due volte sullo stesso nome. Quindi la riga è la stessa (`nutrient_lookup_miss`) e porta due numeri che **non si sommano** — `times` (quante volte l\'hanno chiesto) e `ricette` (quante ricette attive lo usano) — perché sono unità diverse e un totale inventato farebbe ordinare l\'elenco su un numero che non vuol dire niente. Un passo notturno lo ricalcola dalle ricette attive, ⚠️ **senza toccare `status`**: se una persona ha già detto «non è un alimento» o ha già scritto la riga, l\'automatismo non glielo riapre. Nella pagina **Valori nutrizionali** l\'elenco dice **perché** il conto non sa contarlo — non in tabella · solo da cotto · senza stato, che si chiudono in tre modi diversi — e, quando l\'abbinamento saprebbe dove portare quel nome, offre il pulsante **«è olio extravergine di oliva»**: un clic e il nome diventa un **sinonimo** di quella riga. ⛔ Lo decide una persona: l\'elenco suggerisce, non applica. ⚠️ Il tetto (300 righe scritte, 200 mostrate) **si dichiara**: un tetto in silenzio si legge come «è tutto qui». ⚠️ E l\'elenco **cala**: un nome che nessuna ricetta usa più torna a zero da solo. ✅ **Chiusa il 19/8 sera**: la risposta di Simone («crea una tabella dove possiamo correggere a mano») è consegnata, e con lei la lista in ordine di urgenza dentro la pagina Valori nutrizionali. ⚠️ Il lavoro **a mano** non finisce qui — ma non è più un punto di elenco: è un elenco vero, in pagina, che dice quante righe restano e cala da solo man mano che si chiudono. *Una voce di lavoro che descrive un lavoro continuo resta aperta per sempre, e a forza di restare aperta smette di dire qualcosa.*',
    categoria: SIMONE,
    ordine: 300,
    fatta: true,
  },

  {
    chiave: 'scheda-ricetta-crudo-o-cotto',
    nata: '2026-08-19T16:10',
    // ⚠️ Bassa per la regola del 19/8: la priorità la dà Simone, non io.
    priorita: 'bassa',
    titolo: 'Le grammature delle ricette sono a crudo, e adesso il codice lo rispetta',
    dettaglio:
      'Dalle domande arrivate alla nutrizionista sul **grano saraceno** (19/8). Crudo ~343 kcal, cotto ~92: ⚠️ quasi **quattro volte** — chi pesa dalla parte sbagliata non ha un\'imprecisione, ha un altro pasto. È lo stesso guasto del farro (voce 228). ✅ **Fatto lo strumento** (`npm run diag:crudo-cotto`): dice quali alimenti sono in tabella **senza stato** e usati nelle ricette (Gaia lì dice un numero senza dire da che parte), quali sono usati e **fuori tabella**, e quanti sono già a posto — ordinati per quante ricette attive li usano, che è una priorità oggettiva e non un giudizio clinico. ⚠️ Non indovina nessuno stato: «il grano saraceno delle ricette sarà cotto» è una supposizione, e metterla in banca dati vuol dire far dire a Gaia un numero deciso da chi non è nutrizionista — l\'elenco lo riempie lei dalla pagina Alimenti. ⛔ **Ma il buco vero è a monte**: la scheda ricetta scrive «80 g di grano saraceno» e la grammatura non porta con sé lo stato. Riempire la tabella toglie il numero sbagliato; **dirlo nella scheda toglie la domanda**, che è dove nasce. ✅ **CHIUSA il 19/8 con la convenzione di Simone: «diamo per assodato che gli ingredienti siano a crudo in tutte le ricette, come si fa nei libri».** Nessuno dei tre modi serviva: una convenzione sola vale più di un campo su diciannovemila ricette, ed è quella che una persona si aspetta. Ora la scheda dell\'app lo **dice** sotto gli ingredienti, il form del backoffice lo dice a chi li scrive, e ⚠️ il codice la **rispetta**: `scegliPerRicetta` prende la riga a crudo o a secco, e se in tabella c\'è **solo il cotto** non conta niente e lo dichiara — nella tabella verificata sono 37 righe su 96, e sono le più pesanti del piatto (pasta, riso, quinoa, legumi, patate). ⚠️ Contare «80 g di quinoa» con la riga bollita scriveva **96 kcal dove ce ne sono ~284**, dentro `Recipe.kcal`, che è il campo su cui il motore calcola le giornate. La ricetta dettata a Vera adesso **non si scrive** finché quella riga manca: meglio fermarsi che scrivere un numero tre volte più basso del vero. ⚠️ «Senza stato» non è «cotto», è «non lo so»: si conta e si dichiara, perché rifiutare anche quelle bloccherebbe quasi ogni ricetta.',
    categoria: SIMONE,
    ordine: 299,
    fatta: true, // 19/8
  },

  {
    chiave: 'giorni-da-rifare-tre-definizioni',
    nata: '2026-08-19T15:40',
    // ⚠️ Bassa per la regola del 19/8 («se trovi qualche cosa lo aggiungi con priorità bassa»).
    priorita: 'bassa',
    titolo: '«Quali giorni si possono rifare» ha tre risposte, e una delle tre esclude oggi',
    dettaglio:
      'Trovato il 19/8 rileggendo il codice per verificare la voce sul divieto di dieta. La stessa domanda — «quali menu futuri posso ancora rifare?» — è scritta in **tre posti**: `registro.service.menuDaRifare` (per una cliente), `vera/menu-da-rifare.ts` `giorniDaRifare` (per una dieta, filtrando sui piatti vietati) e `vera/togli-spuntino.ts` `giorniDaRifarePerPasti` (per gli spuntini). Tutte e tre dicono «futuri e mai aperti», ⚠️ **ma il confine di oggi è diverso**: le prime due includono la giornata di oggi se non è stata aperta (`date >= mezzanotte`), la terza la esclude (`date > adesso`). ⚠️ La conseguenza si vede su una cliente che non ha ancora aperto il menu di oggi: se la nutrizionista le toglie lo spuntino, **oggi lo spuntino ce l\'ha ancora**; se le vieta un alimento, oggi cambia. Nessuno dei due comportamenti è scritto come scelta — sono due `where` scritti in momenti diversi. ⛔ La domanda per Simone e la nutrizionista è quale sia quello giusto: rifare la giornata di oggi che non ha ancora aperto è più coerente, ma è anche il giorno in cui potrebbe aver già fatto la spesa. ✅ **CHIUSA il 19/8. Simone: «meglio rifare la giornata di oggi».** Adesso la risposta è **una sola** — `siPuoRifare` in `vera/menu-da-rifare.ts` — e la usano tutti e tre i punti, con il confine (`daQuandoSiPuoRifare`) scritto una volta. ⚠️ Il confine è la **mezzanotte di oggi** e non «adesso»: `MenuDay.date` è una data senza ora, e confrontarla con l\'istante corrente fa sparire la giornata di oggi appena passa mezzanotte, cioè sempre. ⚠️ E la regola vera resta intatta: un giorno **già aperto** non si rifà mai, perché magari ci ha già fatto la spesa — decide `viewedAt`, non il calendario. Due mutazioni provate (confine a domani, giorno già aperto rifatto) e tutte e due fanno fallire i test.',
    categoria: SIMONE,
    ordine: 298,
    fatta: true, // 19/8
  },

  {
    chiave: 'allergeni-bozze-invisibili',
    nata: '2026-08-19T14:20',
    titolo: '«4612 aspettano gli allergeni» e la pagina era vuota: le bozze che nessuno poteva rivedere',
    dettaglio:
      'Segnalazione del nutrizionista, girata da Simone il 19/8. **Tre strati dello stesso difetto, e il primo da solo bastava.** ⚠️ **1)** Il generatore crea le ricette come **bozze** (`active: false`, «non entra nel motore finché non approvata») e la pagina Allergeni chiamava `GET /recipes?includeInactive=false`: le 4612 non entravano nemmeno nella query — riceveva mille ricette **attive** in ordine alfabetico, già confermate quasi tutte. La pagina Ricette chiede `includeInactive: true` e infatti conta 19347: due pagine sullo stesso catalogo con due domande diverse. ⚠️ **2)** Il filtro «Da rivedere» girava **in memoria** sulle mille righe già scelte dal tetto: con 4612 sparse su 19347 pescava in una fetta arbitraria — testualmente il difetto che `listRecipes` racconta di aver chiuso l\'11/8 per la pagina Ricette, «una ricetta che c\'è ma non compare è peggio di un errore». Ora è una condizione del database. ⚠️ **3)** E comunque non si sarebbero potute confermare: `getRecipe` risponde **404 su una ricetta non attiva** — giusto, la usa la cliente dall\'app — e ci passavano sia i suggerimenti sia il salvataggio, cioè le due cose che lavorano **esattamente** sulle bozze. ✅ **Due decisioni di Simone, prese il 19/8: (a)** confermare gli allergeni **fa entrare la ricetta in catalogo** (prima restava bozza, e nessuna schermata diceva quante fossero in quello stato: un secondo cancello senza porta è un magazzino) — ⚠️ ma solo la ricetta **mai confermata prima**, perché una archiviata a mano è archiviata di proposito; **(b) conferma in blocco**, perché il generatore scrive ~4600 ricette a settimana e una per una sono diciannove ore per svuotare un mucchio che nel frattempo si è riempito. ⚠️ Il blocco scrive gli allergeni **riconosciuti dagli ingredienti** e ricalcolati adesso, mai un elenco vuoto. ⛔ **Resta aperta la domanda vera**, che è di prodotto e non di software: con la conferma in blocco il cancello prima del piatto di una cliente è il **riconoscitore automatico**, non una persona. Va bene finché il riconoscitore è buono: nessuno ha ancora misurato quanto lo è.',
    categoria: CODICE,
    ordine: 296,
    fatta: true, // 19/8
  },

  {
    chiave: 'allergeni-quanto-e-buono-il-riconoscitore',
    nata: '2026-08-19T14:25',
    // ⚠️ Bassa perché l'ha deciso Simone («se trovi qualche cosa lo aggiungi con priorità bassa»),
    // non per il suo peso: è la voce che decide se il cancello sugli allergeni tiene.
    priorita: 'bassa',
    titolo: 'Quanto è buono il riconoscitore di allergeni? Da oggi è lui il cancello, e non l\'ha mai misurato nessuno',
    dettaglio:
      'Nasce dalla decisione del 19/8 sulla conferma in blocco. Da oggi migliaia di ricette entrano in catalogo con gli allergeni **dedotti dagli ingredienti** (`suggestAllergens`, per parole chiave) e un nutrizionista che dice «di queste mi fido», non che le guarda una per una. ⚠️ È una scelta ragionevole — l\'alternativa era una coda ferma per sempre — **ma sposta il cancello**: prima davanti al piatto di una cliente allergica c\'era una persona, adesso c\'è un elenco di parole chiave. E quanto sia buono quell\'elenco **non l\'ha misurato nessuno**. ⛔ Il lavoro è misurarlo, non riscriverlo: prendere un campione di ricette confermate a mano dal nutrizionista e confrontarle con quello che il riconoscitore avrebbe detto — quante volte non vede un allergene che c\'è (il caso che fa male) e quante ne vede uno che non c\'è (impoverisce il menu e basta). Con quel numero si decide se il blocco va bene com\'è, se serve una soglia («in blocco solo le ricette senza ingredienti ambigui»), o se certi allergeni restano sempre a mano. ✅ **Chiusa il 19/8 sera dalla risposta di Simone**: «testato col nutrizionista, dice che è ok». ⚠️ **Va scritto con precisione cosa è stato verificato e cosa no**, perché è la differenza fra un punto chiuso bene e uno chiuso in fretta: quello che c\'è è il **giudizio di chi conosce le ricette**, non la misura che questa voce chiedeva — il confronto fra un campione confermato a mano e quello che il riconoscitore avrebbe detto, con i due numeri separati (quante volte non vede un allergene che c\'è, quante ne vede uno che non c\'è). ⛔ Il primo dei due è quello che fa male, e resta non misurato. Chiudere sulla parola di chi sa è una decisione legittima; crederla una misura no. Se un giorno un allergene passa, si riparte da qui.',
    categoria: SIMONE,
    ordine: 297,
    fatta: true,
  },

  {
    chiave: 'lista-lavori-priorita-e-data',
    nata: '2026-08-19T13:30',
    titolo: 'La lista lavori dice da quando esiste un punto, e Simone gli può dare la priorità',
    dettaglio:
      'Due richieste dello stesso messaggio del 19/8 — «pensavo di chiudere la lista lavori ma invece che diminuire aumentano» — e una ragione sola: l\'elenco non si riusciva più a governare. **1) Priorità Alta / Neutra / Bassa**, tre pulsanti su ogni riga che salvano al clic (se servisse aprire-cambiare-salvare, dopo tre voci si smetterebbe di darla). ⚠️ **Non è il rosso**: `blocca` è un fatto verificabile — dietro c\'è una fila ferma — la priorità è un giudizio, e sono due colonne separate proprio perché si possa dire «lo so che ferma la coda, aspetta lo stesso». ⚠️ Il default è **neutra** e non bassa: una voce nuova non è meno importante, è una voce su cui nessuno si è pronunciato. **2) Da quando esiste il punto**: ⚠️ `createdAt` non risponde, perché le voci del file entrano tutte insieme col rilascio e cento voci nate in due settimane risulterebbero create nello stesso minuto — una data falsa è peggio di una assente. Quindi «Aperta il …» quando la data si sa, «In elenco dal …» in corsivo quando si ha solo quella del caricamento, e l\'ora si stampa solo se la sappiamo. ⚠️ Il rilascio **aggiunge** la data mancante e non la riscrive mai; la priorità invece vale solo alla nascita, perché riscrivere il giudizio di Simone a ogni rilascio gli toglierebbe di mano l\'unica leva che ha chiesto.',
    categoria: CODICE,
    ordine: 295,
    fatta: true, // 19/8
  },

  {
    chiave: 'lista-lavori-file-e-pagina',
    nata: '2026-08-19T13:10',
    // ⚠️ BASSA perché l'ha deciso Simone il 19/8 («se trovi qualche cosa lo aggiungi in lista con
    // priorità bassa»), non perché io la ritenga poco importante: la priorità la dà lui.
    priorita: 'bassa',
    titolo: 'Il file e la pagina Lavori divergono: adesso il rilascio lo DICE (resta da decidere se allinearli da solo)',
    dettaglio:
      'Trovato il 19/8 nel modo peggiore: ho fatto a Simone il punto della situazione leggendo `voci-iniziali.ts` invece della pagina, e gli ho ripresentato come aperte la **tabella IG** e la **conta allergie** — due cose che aveva già lanciato lui sulla shell di Render. La sua risposta: «la tabella IG quante volte te la devo dare?». ⚠️ **Il file non è lo stato**: lo stato è la pagina, e il file può solo *chiudere* una voce, mai riaprirla. La conseguenza è che il file resta indietro in silenzio ogni volta che qualcosa si chiude fuori da una consegna — e chi legge il file (io, in ogni sessione nuova) crede di leggere l\'elenco vero. ⚠️ Vale anche al contrario: in pagina ci sono voci scritte a mano da Simone («Moduli fissi in dashboard», «Schermate app 30 e 27-28», «Vera: rifare i giorni futuri») che nel file non esistono, quindi non ricevono né la data di nascita né le riscritture del rilascio. Il pulsante «Copia per Claude» risolve il caso singolo — basta incollarmelo — ma è un gesto che va ricordato ogni volta, e le cose che vanno ricordate ogni volta prima o poi non si ricordano. ✅ **Fatta la strada (a) il 19/8**: «Aggiorna dal rilascio» adesso **dice** quali voci il file crede aperte e la pagina ha già chiuso (col titolo, non con la chiave), e quante voci vivono **solo in pagina** perché scritte a mano. ⚠️ Non corregge niente, di proposito: quale delle due versioni vinca è una decisione di prodotto, e un automatismo che togliesse una spunta messa a mano sarebbe il difetto peggiore di quello che risolve. È la stessa scelta già fatta per i testi cambiati — meglio saperlo che crederle allineate. ⛔ **Resta aperta la (b)**, se un giorno servisse: un `npm run allinea:lavori` che rigenera il file dalla pagina. ⚠️ Fa vincere la pagina su un file che sta nel repository e si legge nei commit, quindi non si fa finché il segnale della (a) non si dimostra insufficiente — e adesso, per la prima volta, si può misurare invece di supporre. ✅ **Chiusa il 19/8 notte, e la (b) si è fatta — ma non come era scritta.** La (b) diceva «un `npm run allinea:lavori` che rigenera il file dalla pagina», e ⛔ quella non si è fatta: farebbe vincere la pagina su un file che sta nel repository e si legge nei commit. Si è fatto il verso opposto e più utile: **l\'allineamento gira da solo a ogni rilascio** (`preDeployCommand`, con un `|| true` intorno perché la contabilità dei nostri compiti non deve far fallire il deploy di un\'app che serve delle clienti), e il file può **chiudere per titolo** anche le voci scritte a mano dal backoffice. ⚠️ La spinta è una frase di Simone: «non devo spuntare io le voci, fallo tu» — e aveva ragione, perché un pulsante da premere dopo ogni consegna *è un lavoro*, e il 19/8 è costato tre indagini su tre punti già fatti. ⛔ Il patto resta quello di sempre: il file può creare e chiudere, **mai riaprire**, mai togliere una spunta, mai riscrivere un testo corretto a mano — e chiudere per titolo solo se il titolo combacia con **una riga sola**.',
    categoria: CODICE,
    ordine: 294,
    fatta: true,
  },

  {
    chiave: 'quattro-decisioni-19-8',
    titolo: 'Il mantenimento sulla tendenza, il «tranne» che diventa una telefonata, e due frasi che dicevano il falso',
    dettaglio:
      'Quattro risposte di Simone del 19/8, chiuse in giornata. **1)** `hasReachedObjective` — che decide se offrirle il **Mantenimento** — guardava l\'ultima pesata: proporlo perché una mattina la bilancia ha detto 69,8 con la media a 70,6 vuol dire venderlo **un attimo prima che il peso risalga**. Ora passa dalla stessa risposta di tutto il resto (`percentuale-obiettivo.ts`). **2)** «Pesce tranne salmone» diventa un\'**attività della coach** (voce 267, chiusa): l\'avviso mentre scrive c\'era dal 18/8 e ⚠️ non corregge — la correzione più ovvia toglierebbe tutto il pesce, salmone compreso — quindi la domanda la fa una persona. ⚠️ Solo le frasi con un\'**eccezione**, le uniche che possono fare l\'opposto; e il riferimento è l\'**impronta dell\'elenco**, così la domanda torna se lo riscrive e non si ripropone se ne hanno parlato. **3)** Nella coda «Da validare», «Conferma» e «Correggi» facevano la stessa cosa — scrivere «ho letto» — mentre la proposta del motore **non viene mai applicata**: il pulsante adesso si chiama **«Presa visione»**, con una riga che dice cosa fanno tutti e due. ⛔ Applicarla davvero resta bloccato sul numero di Nocanty. **4)** Il **Report** resta sul peso **misurato** (è un documento firmato che lei può portare dal medico) ⚠️ ma adesso **dice perché** può non coincidere con l\'app: senza quella riga sarebbero due numeri diversi sulla stessa persona, cioè il difetto tolto da tutto il resto lo stesso giorno. 233 suite, 3635 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 293,
    fatta: true, // 19/8
  },

  {
    chiave: 'due-dati-app',
    titolo: 'I due dati che la cliente non vedeva, e la percentuale che rispondeva in cinque modi',
    dettaglio:
      'Consegnata il 19/8, con le cinque decisioni del foglio `DECISIONE_Due_Schermate_App.md` arrivate da Simone: percentuale sulla **media mobile del server**, proiezione della data e giorni di stallo **fuori** dall\'app, del ciclo si vedono **cotture + esito precedente**, `getActiveCycle` **separato** in lettura e scrittura. ⚠️ Il foglio aveva contato quattro punti che calcolavano la percentuale ognuno per conto suo; la revisione ne ha trovato **un quinto, il peggiore**: i **traguardi**, calcolati sul peso di stamattina mentre la barra — nella **stessa schermata** — usa la media mobile. Si poteva leggere «-5 kg: che traguardo!» sopra una barra che dice 43%, e «Obiettivo raggiunto! 🎉» per una pesata sotto il target con la tendenza ancora sopra — ⚠️ e un traguardo **si scrive una volta sola e non si corregge il giorno dopo**. Ora il conto è uno (`signals/percentuale-obiettivo.ts`), con un **tetto alla finestra** (`moving_average_window` non ha né minimo né massimo nei Parametri, e sopra 120 i chiamanti tornerebbero a divergere). ⚠️ Il prezzo è scritto in pagina: «sulla media degli ultimi giorni, non sul peso di stamattina», perché senza quella riga la cliente pesa 300 g in meno, la barra non si muove e la schermata sembra rotta. **Il ciclo**: una scheda nel Menu con le cotture di questi giorni e com\'è andato quello chiuso; ⚠️ la schermata **non scrive più**; ⛔ il «gradimento» resta fuori — è il minimo del massimo delle stelle con **default 5**, cioè le tre stelle inventate rifatte in una schermata. ⚠️ La revisione ha trovato anche che le **cotture potevano essere inventate** da un ripiego e che «precedente» non voleva dire precedente. 232 suite, 3627 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 291,
    fatta: true, // 19/8
  },

  {
    chiave: 'percentuale-obiettivo-punti-rimasti',
    nata: '2026-08-19',
    fatta: true,
    titolo: '✅ Chiusa il 27/8: anche il fabbisogno calorico ragiona sulla tendenza (erano quattro punti)',
    dettaglio:
      '✅ **CHIUSA il 27/8. Simone: «il fabbisogno deve utilizzare la media mobile».** Era l\'ultimo dei '
      + 'quattro punti che rispondevano in modo diverso alla domanda «quanto pesa adesso», e il più pesante: '
      + 'da lì escono le kcal che una cliente si trova nel piatto.\n\n'
      + '⛔ **E la revisione ha trovato che l\'effetto ha il SEGNO OPPOSTO a quello che avevo scritto.** Il '
      + 'peso entra due volte — nel metabolismo basale (più pesante → più calorie) e nel ritmo di calo verso '
      + 'l\'obiettivo (più pesante → più deficit → **meno** calorie) — e nel regime più comune, dimagrimento '
      + 'con un obiettivo e una data, **domina il secondo**: `∂target/∂peso = 10·PAL − 1100/settimane`, '
      + 'positiva solo oltre ~78 settimane di orizzonte. ⚠️ Vuol dire che la media mobile è **prociclica**: '
      + 'chi cala in fretta ha la media sopra l\'ultima pesata e si vede tagliare ancora. Negli altri regimi '
      + '(mantenimento, deficit di default, deficit imposto, tetto che morde) il segno si ribalta. **Non è un '
      + 'dettaglio di implementazione: è una conseguenza clinica**, e il numero per giudicarla lo dà '
      + '`npm run diag:fabbisogno-media`, cliente per cliente, prima di accendere.\n\n'
      + '⚠️ **Con la finestra dei Parametri a 1 il fabbisogno torna esattamente a com\'era**: se questa '
      + 'correzione facesse più danni che bene si spegne senza un rilascio. Un cambio clinico senza '
      + 'interruttore è un cambio che si può solo subire.\n\n'
      + '⚠️ **E due cose sono state chiuse di rimbalzo**: il servizio del fabbisogno **non aveva nessun test** '
      + '(la suite intera restava verde cambiandogli sotto il peso), e le pesate più vecchie di **novanta '
      + 'giorni** adesso non contano — una cliente rientrata dopo mesi si vedeva calcolare il fabbisogno sulla '
      + 'media fra il peso di tre mesi fa e quello di oggi, cioè quattro chili sotto il vero, e cento kcal al '
      + 'giorno di troppo.\n\n'
      + '## Come ci si è arrivati\n\n'
      + 'Trovati dalla revisione del 19/8, e lasciati fuori dalla consegna dei due dati **di proposito**: non erano fra i quattro del foglio, e cambiarli è una decisione clinica più che di software. **Chiusi il 19/8, dalle risposte di Simone:** `commerce.hasReachedObjective` — che decide se offrirle il **mantenimento** — è passato alla media mobile, perché proporglielo perché una mattina la bilancia ha detto 69,8 con la media a 70,6 vuol dire venderglielo un attimo prima che il peso risalga; e `reports.service` **resta di proposito sul peso misurato** (il Report è un documento firmato su un periodo, e «il peso a quella data» è un fatto verificabile che lei si può portare dal medico) ⚠️ **ma adesso lo dichiara**, con una riga sotto i numeri: due numeri diversi sulla stessa persona senza nessuno che dica perché erano esattamente il difetto tolto da tutto il resto del prodotto quel giorno. **Chiuso anche `plan-report.service` il 19/8**, e la scoperta ha cambiato la domanda: non alimenta il PDF firmato, alimenta la **schermata Report dentro l\'app** (`app/src/pages/Report.tsx`), quella che lei apre a fine piano. Lì scriveva «−4,2 kg da oggi» sull\'ultima pesata mentre la pagina Obiettivo della stessa app, due schermate più in là, ne diceva un altro sulla media mobile: due numeri sulla stessa persona dentro la stessa app. Simone ha scelto la **media mobile**, e ⚠️ cambia anche la decisione che ci sta sotto — `objectiveReached` sceglie se offrirle il Mantenimento o un piano-obiettivo, ed è la stessa domanda di `commerce.hasReachedObjective`, passata alla tendenza lo stesso giorno. ⚠️ Restano **misurati** i confronti A→B del periodo e i traguardi: raccontano cosa è successo, e la storia di una persona non si ridisegna con una media. **Resta** `menu/kcal-need.service` (`kgToLose`, che è un ingrediente del fabbisogno). ⛔ Il `kcal-need` non si tocca senza la nutrizionista: `kgToLose` entra nel **fabbisogno calorico**, e cambiarne la base cambia quante calorie mangia ogni cliente — è una decisione clinica, non di software. È l\'ultimo punto rimasto.',
    categoria: CODICE,
    ordine: 292,
  },

  {
    chiave: 'coda-ultimi-due-buchi',
    titolo: 'I due punti della coda senza test, e le scadenze che rispondevano in due modi',
    dettaglio:
      'Coda della voce 258, chiusa il 19/8. Nell\'handoff (§4.4) era scritto che due letture erano state corrette **senza un test dedicato**, e che non era una dimenticanza: stava lì perché un giorno qualcuno le avrebbe rilette chiedendosi se erano coperte. **1)** I compiti G0…G7 della prova si contano dal giorno d\'inizio, quindi ci si arriva solo a partenza avvenuta: se lì lo stato dice ancora `queued` vuol dire che la promozione notturna è in ritardo — e intanto quella cliente **sta ricevendo i menu**. Col solo `active` il riquadro la contava fra le «prove attive» e la coach non trovava nessuna riga di lavoro: un numero e una lista che si contraddicono fanno smettere di fidarsi di tutti e due. **2)** `trial_measures_ok` (il punto A del report A→B) non nasceva per una prova in coda, e il funnel del lancio contava meno prove col punto A di quelle vere — ⚠️ differenza invisibile ovunque tranne che nel grafico, mesi dopo. **3)** Le **scadenze in arrivo**: la dashboard della coach le conta comprese le code, l\'appunto in Calendario — stesso identico evento — no. ⚠️ Due schermate che rispondono diversamente alla stessa domanda tolgono credito a tutte e due. 4 test, e in tutti il finto Prisma **filtra come il database vero**: un doppio che risponde uguale a chiunque chieda avrebbe fatto passare i test anche sul codice sbagliato — è successo a metà dei test scritti quel giorno, prima di accorgersene. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 290,
    fatta: true, // 19/8
  },

  {
    chiave: 'messaggio-quotidiano-riga-a-caso',
    titolo: 'Il messaggio quotidiano si decideva su una riga a caso',
    dettaglio:
      'Trovato il 19/8 rifacendo **col grep** il censimento dei `findFirst` su `Subscription`, cioè applicando la lezione della giornata invece di fidarsi di quello che si ricordava. `generateDailyForClient` decideva se mandare «il tuo piano di oggi» con un `findFirst` **senza `orderBy`**: con una riga sola non si vedeva, ma due righe sulla stessa cliente sono legittime — una eroga, una è in coda — e senza ordinamento il database ne restituisce **una a caso**. Bastava uscisse quella sbagliata perché il messaggio quotidiano sparisse a una cliente che il piano ce l\'ha, e tornasse il giorno dopo senza che nessuno capisse perché. ⚠️ È lo stesso difetto del caso Lorena (`abbonamento-in-corso.ts`, 11/8), nella schermata che si guarda ogni mattina — e la scrittura di `queued` lo rendeva **più probabile**, non meno: le righe candidate sono di più. Ora `findMany` + `attivoInCorso`, la stessa funzione dell\'erogazione e della pausa. ⚠️ Il secondo test mette la coda **per prima** di proposito: se qualcuno tornasse a prendere «la prima riga», si vedrebbe. ⚠️ Restano due `findFirst` senza `orderBy` su `Subscription`, ed è giusto così: cercano un `pending` per rispondere «c\'è già una richiesta non pagata?», e quella domanda non dipende da quale riga esce. 2 test, nessuna migrazione.',
    categoria: CODICE,
    ordine: 289,
    fatta: true, // 19/8
  },

  {
    chiave: 'grafici-contabilita-dodici-mesi',
    titolo: 'I grafici della contabilità mostravano un punto solo',
    dettaglio:
      'Segnalazione di Simone del 19/8, con lo screenshot: «il dato numerico va bene ma il grafico dovrebbe darmi l\'anno». I tre grafici — Incassi, Costi, Utile per mese — leggevano la serie del **periodo selezionato**, che è un mese: un pallino con sotto scritto «ago 26», e nemmeno la freccia ▲▼, perché il confronto è col punto precedente e il punto precedente non c\'era. Ora la serie è quella degli **ultimi dodici mesi** che finiscono col mese scelto. ⚠️ **Finestra mobile e non anno solare** (scelta sua): a gennaio l\'anno solare avrebbe riportato lo stesso difetto — un punto e undici caselle vuote. ⚠️ **I numeri grandi restano del mese**: «come è andato agosto» e «come sta andando» sono due domande diverse, e prima avevano la stessa risposta. ⚠️ Una **seconda chiamata** e non un campo nuovo nell\'API — l\'endpoint sa già rispondere su un intervallo qualsiasi e riempie i mesi vuoti da solo — e la serie vive in uno **stato suo**: dentro `report` sarebbe tornata al mese solo. ⚠️ E le **etichette dell\'asse si diradano** (`lib/etichetteAsse.ts`, 6 test): dodici «ago 26» su una scheda da 320 px diventano una riga grigia illeggibile, e un\'etichetta illeggibile è come un\'etichetta assente — solo che sembra messa apposta. Al massimo sei, **contando all\'indietro dall\'ultima**, che è il mese dei numeri grandi in cima. Si dirada l\'etichetta, non il dato: linea e tooltip restano su tutti i punti. Nessuna modifica al backend.',
    categoria: CODICE,
    ordine: 288,
    fatta: true, // 19/8
  },

  {
    chiave: 'audit-attore-che-non-esiste',
    titolo: 'L\'attore che non esiste: i pagamenti con carta non lasciavano una riga di registro',
    dettaglio:
      'Trovato il 19/8 rivedendo la promozione delle code, ed è più vecchio di quella voce. `AuditLog.actorId` è una **chiave esterna su `user`**, ma chi scrive nel registro non sempre ha un utente per le mani e ci mette una stringa che spiega chi è stato: `\'stripe-webhook\'` sull\'audit `commerce.payment.approve` di **tutti i pagamenti con carta**, `\'public\'` sul lead che arriva dal form del sito. L\'INSERT viola il vincolo, `AuditService` assorbe l\'eccezione — ed è giusto, un pagamento non deve fallire per una riga di registro — ⚠️ **ma la riga si perdeva in silenzio**: lo si scopre il giorno in cui si va a leggere il registro di un pagamento, cioè quando serve. ⚠️ **Scartato l\'elenco di stringhe da riconoscere**: il giorno che qualcuno ne inventa una nuova siamo daccapo, ed è quello che è successo fra la prima e la seconda. Ora, se l\'INSERT fallisce e un attore c\'era, si riprova **una volta sola** senza attore, tenendo nel `metadata` chi diceva di essere (`attoreNonUtente`) e lasciando un `warn` — un ripiego che non si vede diventa la norma. ⚠️ Se l\'attore non c\'era non si riprova: il guasto è un altro. Le righe perse **non tornano**. 3 test, nessuna migrazione.',
    categoria: CODICE,
    ordine: 287,
    fatta: true, // 19/8
  },

  {
    chiave: 'coda-vincolo-e-code-scadute',
    titolo: 'Piani sovrapposti: il cron non li crea più. Restano due strade che allungano al buio',
    dettaglio:
      'Quello che resta della voce 258, e il 19/8 sera è cambiato il verdetto. **1) Il vincolo in banca dati** che vieta due piani che erogano insieme: ⛔ **non si mette, e la ragione è una risposta di Simone** — la matita della data d\'inizio oggi permette di sovrapporre due piani *apposta*, con un avviso e una conferma («conferma e non divieto: un divieto secco si aggira cambiando la riga a mano nel database»), e lui ha deciso di **tenerla**. Un vincolo secco la trasformerebbe in un errore in backoffice. ⚠️ E c\'è di peggio: il vincolo farebbe fallire anche **il cron notturno** e **la concessione di una pausa** — cioè un piano pagato che non parte, e un\'operatrice che non riesce a concedere una pausa promessa. *Un vincolo che rompe la cassa e il cron non protegge, sposta il danno.* ✅ **Quindi si è fatto quello che il vincolo doveva ottenere, dove serviva davvero: il cron non crea più sovrapposizioni.** `promuoviCodeArrivate` guardava `id`, `status` e `startDate` e **non le altre righe della cliente**: bastava che il piano precedente si fosse allungato dopo (una pausa, un rinnovo Stripe) e la notte scriveva due piani attivi insieme — il caso Lorena firmato da un automatismo. Ora una coda che finirebbe addosso a un altro piano **non si promuove**, resta `queued` (la cliente continua a ricevere i menu del piano in corso) e si vede in `npm run diag:coda`, che ha una sezione nuova. ⚠️ **Toccarsi non è sovrapporsi**: la coda che parte il giorno in cui finisce il piano prima è il passaggio di testimone normale, ed è il caso più frequente — c\'è un test apposta, perché senza il controllo nuovo avrebbe spento **ogni** rinnovo, in silenzio. ⚠️ E la regola di sovrapposizione è **quella della matita**, importata: due funzioni che rispondono alla stessa domanda divergono, e il giorno che divergono l\'avviso in scheda e il cron raccontano due storie diverse sulla stessa cliente. ⛔ **RESTANO DUE STRADE CHE ALLUNGANO AL BUIO, e sono due domande per Simone**: (a) **la pausa** — `pause.service` somma i giorni alla fine del piano in corso **senza guardare se dietro c\'è una coda già pagata**: è esattamente ciò che nel caso Lorena ha portato il piano #2 al 01/09. Cosa deve fare una pausa che sbatterebbe contro la coda: allungare comunque e **spostare in avanti anche la coda**, rifiutarsi, o allungare e avvisare? (b) **il rinnovo Stripe** — `handleInvoicePaid` riscrive `endDate` alla fine del periodo pagato, incondizionatamente: se dietro c\'è una coda, la scavalca. ⚠️ Nessuna delle due oggi fa danno in produzione (`diag:coda`: zero sovrapposizioni), e da stasera il cron non le trasforma più in due piani attivi — ma restano due modi in cui una data si allunga senza che nessuno lo dica. **2) Le code arrivate a scadenza senza mai partire**: `promuoviCodeArrivate` non le promuove — da attive-e-finite prenderebbero il report di fine percorso, la chiusura CRM e (sulle prove) la cancellazione della personalizzazione, e nessuna delle tre si torna indietro — quindi restano `queued` e si vedono in `diag:coda`. ⛔ Cosa farne è una decisione di Simone, una per una: rimborso, partenza posticipata, o piano nuovo. Oggi in produzione non ce n\'è nessuna. ✅ **Chiusa il 19/8 sera dalla risposta di Simone**: «non ci sono anomalie di questo tipo, l\'unica esistente è stata corretta, quindi se ora vanno in coda il punto è chiuso». ⚠️ E la stessa sera è arrivato il resto: il cron non le crea più (e quando ne trova una **apre una segnalazione**, invece di lasciarla ferma in silenzio), la pausa fa scorrere la coda, il rinnovo Stripe che scavalca lo scrive. Il vincolo in banca dati **non si mette**, ed è una decisione: la matita deve poter sovrapporre due piani apposta.',
    categoria: CODICE,
    ordine: 286,
    fatta: true,
  },

  {
    chiave: 'scheda-ricetta-porzione',
    titolo: 'La scheda della ricetta con le grammature di QUESTA cliente, non quelle di catalogo',
    dettaglio:
      'La coda della voce 255, chiusa il 18/8. `GET /recipes/:id` rispondeva con la ricetta di **catalogo** perché non sapeva di quale giorno si parlasse: chi ha la porzione ingrandita leggeva «Pranzo 891 kcal» nel menu, apriva la ricetta e trovava gli ingredienti per 495. Due numeri che si contraddicono sotto gli occhi della stessa persona, e fino a oggi a turare il buco era una **frase** — «pesa gli ingredienti per 1,8 volte» — cioè un conto a mano chiesto a chi sta cucinando. Ora la richiesta porta **giorno e slot** e il server risponde con le grammature già scalate. ⚠️ **Il fattore NON si passa**: l\'app ce l\'ha, ma accettarlo vorrebbe dire che il telefono decide quanto cibo compare nella scheda — si rilegge dallo snapshot di quella cliente, che è l\'unico posto dove è stato deciso, e il giorno si legge sempre come **proprio** (`user.sub`). ⚠️ **Scala il server e non l\'app**: la regola di arrotondamento è `quantitaScalata`, la stessa della lista della spesa — riscriverla di là sarebbero due risposte alla stessa domanda, e il giorno che la nutrizionista chiedesse di arrotondare i pezzi la lista e la scheda direbbero due numeri diversi. ⚠️ **E la scalatura è a richiesta, non automatica**: finché non esce l\'OTA le clienti hanno l\'app che dice ancora «pesa per 1,8 volte», e riceverle già scalate le farebbe pesare ×3,24. Chi non manda `giorno` riceve esattamente quello che riceveva prima — c\'è un test che tiene ferma proprio questa riga. ⚠️ Tre stati, e il terzo è quello che fa male: se la giornata non si trova — o il piatto compare due volte con fattori diversi e non sappiamo in quale pasto siamo — la scheda resta di catalogo **e lo dice**, rimettendo l\'istruzione di pesare a mano. `PORZIONE_DA_DIRE` (1,05) è la soglia sotto la quale non si scala e non si dice niente, ed è **la stessa** che decide la riga nel menu: un test per parte tiene fermo il numero, perché se divergessero gli ingredienti cambierebbero senza che nessuno spieghi perché. 15 test nuovi. Nessuna migrazione. ⛔ **Della voce 255 restano**: i **giorni già erogati** (`menuDay.upsert` ha `update: {}`) — verificato: sono al massimo `menu_days_delivered` giorni per cliente, quindi il buco si chiude da sé nel giro di un paio di giorni, non è un arretrato; il **kit di rientro**, che copia `meals` così com\'è; la **lista della spesa già in cache** (chiusa a sua volta la sera stessa, voce 281); e ⚠️ **i pezzi**, che è una decisione della nutrizionista.',
    categoria: CODICE,
    ordine: 280,
    fatta: true, // 18/8
  },

  {
    chiave: 'lista-spesa-si-rifa',
    titolo: 'La lista della spesa si rifà a ogni apertura: quello che si conserva sono le spunte',
    dettaglio:
      'Chiusa il 18/8, ed è più vecchia della voce 255. `shoppingList` teneva una riga per `(cliente, dal, al)` e, se la trovava, **la restituiva così com\'era**: nessuno la invalidava mai. Quindi tutto quello che cambia la giornata **dopo** che la lista è nata non arrivava nel carrello — le **porzioni scalate** del 18/8 (chi aveva già la lista continuava a comprare il cibo della porzione piccola), il **piatto cambiato in chat** con Gaia, le «ricette semplici», il piatto non gradito sostituito in erogazione, e la **grammatura corretta in backoffice** dalla nutrizionista. ⚠️ E non lo diceva nessuno: la lista *sembrava* la lista di quei giorni — il difetto di famiglia del progetto, dentro l\'unica schermata che si guarda spingendo un carrello. ⚠️ **Scartata la strada delle date** («se un giorno è stato toccato dopo che la lista è nata, rifalla»), e per due motivi che bastano da soli: `ShoppingList.updatedAt` lo muove **anche la spunta** (è la lezione della voce 275), e `MenuDay.updatedAt` lo muove `deliverIfEligible`, che gira a **ogni apertura dell\'app** — il confronto sarebbe stato sempre vero o sempre falso, e sbagliato in silenzio. Ora la lista si **ricalcola** a ogni lettura (costa la query sulle ricette dei sette giorni, cioè quello che costava comunque la prima volta) e la riga in tabella smette di essere una copia: diventa il posto dove vive l\'unica cosa che il server non sa ricostruire, cioè **cosa hai già messo nel carrello**. ⚠️ Si **scrive solo se è cambiato qualcosa** (`stessaLista`, che confronta per contenuto e non per ordine): la lista si rilegge molte volte al giorno e una scrittura per lettura muoverebbe `updatedAt` senza che sia successo niente. ⚠️ La **quantità non si conserva** insieme alla spunta: se il piatto è cresciuto, i 120 g diventano 216 anche su una riga già spuntata — chi ha già comprato lo vede e decide, tenere il numero vecchio vorrebbe dire nasconderle che gliene serve di più. Modulo puro `menu/lista-della-spesa.ts` (aggrega, conserva le spunte, confronta), 13 test. Nessuna migrazione. ⛔ **Della voce 255 resta solo la decisione sui pezzi**: il kit di rientro è stato chiuso la sera stessa (voce 282).',
    categoria: CODICE,
    ordine: 281,
    fatta: true, // 18/8
  },

  {
    chiave: 'kit-rientro-riporziona',
    titolo: 'Il kit di rientro non ricopia le giornate: le riporziona sul fabbisogno di adesso',
    dettaglio:
      'Chiusa il 18/8, e con lei si chiude la voce 255 tranne la decisione sui **pezzi**. `monitoring.generateRientroMenus` — i menu che arrivano da soli a fine pausa se il peso è risalito — sceglie i giorni che su quella cliente avevano funzionato meglio e li **ricrea nei giorni successivi copiando `meals` così com\'è**. ⚠️ È l\'unico posto del progetto dove una giornata di ieri diventa una giornata di domani **senza passare da `deliverIfEligible`**, e copiarla di peso sbaglia in due modi: **1)** una giornata scritta prima del 18/8 non ha nessun fattore, quindi il kit rimetterebbe nel futuro una giornata al 65% — e ⚠️ **nessuno la aggiusterebbe più**, perché l\'erogazione compone solo le date che non esistono ancora e il suo `upsert` ha `update: {}`: il rimedio delle porzioni scalate le passerebbe accanto senza vederla; **2)** una giornata scalata mesi fa porta un fattore dimensionato su un fabbisogno che oggi non è più il suo. ⚠️ E il modo sbagliato di rimediare è **scalare quello che è già scalato**: 891 × 1,8 fa 1603, cioè ×3,24 sulla ricetta — si torna sempre alla porzione di catalogo prima di riscalare, ed è per questo che `kcalBase` esiste. ⚠️ `porzione` si **toglie** e non si mette a 1: l\'app distingue «assente» da «presente», e un `porzione: 1` direbbe alla cliente che qualcosa è stato deciso sulla sua porzione quando non è vero. ⚠️ **Senza fabbisogno calcolabile non si tocca niente** — riportare la giornata al catalogo «perché non sappiamo» le rimpicciolirebbe il piatto in silenzio, e «non si rimpicciolisce mai» è la regola con cui la strada C è stata decisa — **ma si scrive nei log**, perché chi legge deve sapere che quelle porzioni sono quelle di allora. La scalatura passa da `porzioniScalate`, la stessa funzione dell\'erogazione: se domani i tetti cambiano, il kit di rientro cambia con lei. Modulo puro `menu/riporziona-giornata.ts` (8 test) + il primo test di `generateRientroMenus`, che non ne aveva nessuno (3). `MonitoringModule` importa `MenuModule` per `KcalNeedService` (nessun ciclo). Nessuna migrazione.',
    categoria: CODICE,
    ordine: 282,
    fatta: true, // 18/8
  },

  {
    chiave: 'esclusioni-questionario',
    titolo: 'Le esclusioni scritte come frasi: adesso l\'avviso c\'è anche nel QUESTIONARIO',
    dettaglio:
      'Chiusa il 18/8 sera. La regola («le esclusioni devono essere un elenco, ogni parola seguita da una virgola, aiutiamo le clienti a scrivere in modo corretto» — Simone, 18/8) era arrivata su **quattro porte**: profilo in app, pulsante «non gradisco», scheda backoffice, scheda coach. ⚠️ **Restava fuori proprio il questionario, che è la porta d\'ingresso vera**: è lì che quasi tutte le esclusioni vengono scritte la prima volta, e «pesce tranne salmone» scritto lì non toglieva niente dal menu senza che nessuno glielo dicesse. ⚠️ **Qui non si scarta e non si blocca**, ed è la differenza con le altre quattro: là la voce non viene salvata e il testo torna nel campo, perché lei è a un dito da quel campo; qui siamo dentro il **cancello del carrello**, e fermare il questionario per una frase scritta male vuol dire lasciare una cliente in mezzo al percorso. Si salva quello che ha scritto, si dice cosa succede davvero, e si dice **dove correggerlo** (Profilo → Cibi esclusi). ⚠️ Si guarda quello che arriva **prima** del filtro spezie, come fa il profilo: una frase scritta male non è un problema di spezie. ⚠️ Il campo di risposta è **suo** (`aiutoEsclusioni`) e non dentro `avvisiEsclusioni`: quella lista l\'app la mostra sotto il titolo «Allergie e intolleranze», e questa non è né l\'una né l\'altra — così l\'app pubblicata, che il campo nuovo non lo conosce, non mostra una frase sotto il cartello sbagliato. Le parole restano quelle del server (`common/esclusioni-scritte-bene.ts`), che è l\'unico posto dove la regola vive. 3 test. Nessuna migrazione. ⚠️ Arriva alle clienti con la **prossima pubblicazione o OTA**.',
    categoria: CODICE,
    ordine: 283,
    fatta: true, // 18/8
  },

  {
    chiave: 'sostituzioni-non-scalate',
    titolo: 'Le sostituzioni di Gaia arrivano nel carrello e nella scheda ricetta',
    dettaglio:
      'Aperta e chiusa la notte del 18/8: l\'ha trovata la revisione, ed era un difetto **precedente** alle consegne della sera — sono state loro a renderlo visibile. ⚠️ **La lista della spesa non applicava le sostituzioni**: `aggregaSpesa` leggeva gli ingredienti per `recipeId` e ignorava `pasto.substitutions`, quindi chi aveva concordato «carote → biete» con Gaia comprava le carote (per giunta scalate ×1,8) e zero biete — un errore che non si vede nell\'app e si vede al banco frigo. ⚠️ **E la scheda ricetta faceva lo stesso**: mostrava l\'ingrediente di catalogo a chi ne aveva un altro nel piatto. ⚠️ La funzione giusta **esisteva già** — `ingredientiEffettivi` — ma stava **dentro `sostituzione-chat.service.ts`**, cioè dentro un servizio che si porta dietro audit, config, segnalazioni e Vera: chi aveva bisogno solo di quella regola non poteva chiamarla senza tirarsi dietro tutto il resto, e infatti non la chiamava. **Una funzione difficile da chiamare è una funzione che qualcuno dimenticherà**: adesso vive da sola in `menu/ingredienti-effettivi.ts`, senza dipendenze, e la importano tutti e tre i posti che rispondono alla stessa domanda. ⚠️ **Prima si sostituisce, poi si scala**: invertendo si scalerebbe un ingrediente che quella cliente non ha più. ⚠️ E serviva separare due cose che sembravano una: `pastoDelGiorno` trova il pasto **anche quando non c\'è nessun moltiplicatore**, perché un piatto non scalato può avere lo stesso una sostituzione — chiedendo solo la porzione, la scheda continuava a mostrare le carote. ⚠️ Terza cosa, nell\'app: sul piatto scalato la riga della sostituzione **non dice più le grammature** ma solo «carote → biete». `fromQty`/`toQty` sono scritte una volta sola, al momento dell\'accordo in chat, e sono di catalogo: su un pranzo ×1,8 quella riga diceva «100 g → 120 g» due righe sopra a una scheda che dice 216 e a una riga che dice «nella ricetta trovi già le tue quantità» — tre numeri per la stessa cosa, e chi cucina ne sceglie uno. ⚠️ Non si scalano nell\'app: la regola di arrotondamento vive nel server e riscriverla di là sarebbe la terza copia. 9 test nuovi. Nessuna migrazione.',
    fatta: true, // 18/8, notte
    categoria: CODICE,
    ordine: 284,
  },

  {
    chiave: 'sostituzioni-numeri-altrove',
    nata: '2026-08-18',
    titolo: 'Le grammature delle sostituzioni fuori dall\'app: Gaia, la scheda coach e i passi della ricetta',
    dettaglio:
      'Coda della voce 284, aperta dalla revisione della notte del 18/8. Nell\'app la riga della sostituzione sul piatto scalato non dice più le grammature, perché sono quelle di **catalogo** e la scheda ricetta ne dice altre. ⚠️ **Ma il numero nasce in chat**, e lì non è cambiato niente: Gaia dice «a pranzo metti 120 g biete al posto di 100 g carote» mentre nella ricetta ce ne sono 216 — e la chat è il posto dove la cliente ha detto «sì» e dove torna a controllare (`menu/sostituzione-chat.ts`, sei frasi). ⚠️ Stessa cosa nella **tabella «cambi in chat» del backoffice** (`ClientDetail.tsx`): la nutrizionista che approva o corregge la grammatura ragiona su 120 g mentre nel piatto ce ne sono 216, e da quando l\'app quel numero non lo mostra più, quello del backoffice è rimasto l\'unico «ufficiale» accanto a quello della ricetta. `pasto.porzione` è disponibile in tutti quei punti: non è un dato che manca, è un dato che non si legge. ⚠️ E c\'è un terzo pezzo: la scheda ricetta adesso dice «biete» negli **ingredienti** e «carote» nei **passi di cottura** (`cookingMethods[].steps`, che escono dal catalogo intatti) — riguarda solo le ricette generate dal motore, che i passi ce li hanno. ✅ **CHIUSA il 19/8. Simone ha scelto: il numero del PIATTO.** Gaia e la tabella del backoffice dicono adesso la grammatura scalata sul fabbisogno di quella cliente — l\'unica che può usare in cucina — e l\'arrotondamento passa dalla **stessa** `quantitaScalata` della scheda ricetta e della lista della spesa: due arrotondamenti diversi darebbero «216 g» di là e «215 g» di qua, che si legge come un errore di misura invece che come una regola. ⚠️ In banca dati i numeri restano **di catalogo**: sono quelli scritti sul menu, e il piatto viene scalato al momento di mostrarlo — salvarli già scalati vorrebbe dire scalarli due volte (120 → 216 → 389), e nessuno se ne accorgerebbe finché una cliente non cucina. Il fattore viaggia accanto ai numeri e si applica **solo quando si parla**. ⚠️ Sotto il 5% non si scala niente: è la soglia che decide anche la riga «porzione più abbondante» nel menu, e scalare comunque farebbe dire alla chat un numero che da nessun\'altra parte compare. ⚠️ Nel backoffice si dice anche **che il piatto è scalato**, col numero di catalogo accanto: chi apre il catalogo trova 120 g e deve capire perché qui ne legge 216, invece di pensare a un errore. **Il terzo pezzo — i passi di cottura — si chiude in un altro modo**: ⚠️ i passi **non si riscrivono**, perché cambiare una parola dentro una frase dà «la porro» e «biete tagliate a rondelle», cioè italiano sbagliato e istruzioni sbagliate — la stessa ragione per cui su «pesce tranne salmone» non correggiamo noi. Si **dice**, sopra i passi: «qui sotto trovi ancora «carote»: al loro posto usa «biete»». ⚠️ E solo per gli alimenti **nominati davvero** nei passi, cercati come parola e non come sottostringa: una nota che avverte di un ingrediente che lì non c\'è insegna a saltare le note.',
    categoria: CODICE,
    ordine: 285,
    fatta: true, // 19/8
  },

  /**
   * ⚠️ LE TRE RIGHE DOPPIE DEL 13/8 (voce 224). Non sono lavori: sono duplicati rimasti in pagina
   * con una chiave diversa da quella delle voci vere — che sono, nell'ordine,
   * `vera-dashboard`, `vera-ai-assistant-enabled` e `vera-dizionario-comune-conflitto`.
   * `soloSeEsiste` fa in modo che il caricamento le spunti se le trova e non le inventi se non ci
   * sono. ⚠️ Non si CANCELLANO, si spuntano: in pagina può esserci sopra un commento di qualcuno.
   */
  /**
   * ⚠️ **Sta QUI, PRIMA delle tre righe doppie del 13/8 e non in mezzo a loro**: il commento che le
   * introduce dice «sono, nell'ordine, …» e infilarne una quarta che non c'entra romperebbe quella
   * frase. Un commento che introduce la voce sbagliata manda a leggere altro.
   *
   * ⚠️ **La riga del seed rimasta aperta in pagina** (27/8). Il difetto è chiuso dal 20/8 sera — la
   * voce vera è `seed-nutrienti-firma-falsa`, spuntata — ma in pagina è rimasta **un'altra riga**,
   * arrivata col caricamento dai documenti del 20/8 e con il titolo di allora. Nessuno la puntava,
   * quindi restava rossa e dichiarava di bloccare del lavoro che non blocca da una settimana.
   * ⛔ E il titolo che porta è l'accusa **sbagliata**: la firma non era falsa (quelle righe il capo
   * nutrizionista le aveva guardate il 18/8). Motivo in più per chiuderla: finché sta lì, il primo
   * che la legge riapre un'indagine su un'accusa già ritirata.
   */
  {
    chiave: 'seed-deploy-riga-in-pagina',
    titolo: '⛔ Il seed gira a OGNI deploy, riscrive le righe non confermate e le firma: la firma è falsa',
    dettaglio: 'Riga rimasta in pagina dal caricamento del 20/8: la voce vera ha la chiave `seed-nutrienti-firma-falsa`, ed è chiusa dal 20/8 sera. ⚠️ Il titolo qui sopra porta anche l\'accusa sbagliata («la firma è falsa»), ritirata la sera stessa.',
    categoria: MANUTENZIONE,
    ordine: 903,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'vera-moduli-dashboard',
    titolo: 'Doppione del 13/8 — vedi «Vera: i moduli in dashboard "quello che aspetta me"»',
    dettaglio: 'Riga duplicata rimasta in pagina: la voce vera ha la chiave `vera-dashboard`. Chiusa il 18/8.',
    categoria: MANUTENZIONE,
    ordine: 900,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'ai-assistant-enabled',
    titolo: 'Doppione del 13/8 — vedi «`ai_assistant_enabled` è "false" in produzione»',
    dettaglio: 'Riga duplicata rimasta in pagina: la voce vera ha la chiave `vera-ai-assistant-enabled`. Chiusa il 18/8.',
    categoria: MANUTENZIONE,
    ordine: 901,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'dizionario-promossa-a-comune',
    titolo: 'Doppione del 13/8 — vedi «Voce di dizionario promossa a comune»',
    dettaglio: 'Riga duplicata rimasta in pagina: la voce vera ha la chiave `vera-dizionario-comune-conflitto`. Chiusa il 18/8.',
    categoria: MANUTENZIONE,
    ordine: 902,
    fatta: true,
    soloSeEsiste: true,
  },

  {
    chiave: 'ricerca-per-sottostringa',
    titolo: 'Gaia trovava «mela» dentro «melanzane»: la ricerca ora va a parole intere',
    dettaglio:
      'Trovata dalla revisione avversariale del 19/8 sera. ⚠️ **Non era un difetto nuovo**: è come la ricerca degli alimenti ha sempre funzionato — per rispondere a «quante calorie ha X?» si cercano i nomi della tabella **dentro** il testo della domanda, come pezzi di testo, e i pezzi di testo si incastrano dove non dovrebbero. ⛔ Il danno era che Gaia rispondeva con le calorie di **un altro alimento**, con un numero plausibile che nessuno contesta. ⚠️ **La ragione per cui non l\'avevo corretta subito era falsa**, e va scritto: avevo detto «a parole intere si perdono i plurali», ed è falso — «melanzana» non è dentro «melanzane», «mela» non è dentro «mele». *Una ragione falsa fa scegliere per il motivo sbagliato, ed è peggio di una scelta sbagliata.* La ragione vera era che lo stesso meccanismo che sbaglia è quello che salva: «pomodorini» trova «pomodori» esattamente come «melanzane» trova «mela». **Quindi ho fatto la misura, non la correzione** (`npm run diag:ricerca`, che confronta i due modi usando il codice di produzione e non una sua copia). ✅ **Il numero, dalla produzione del 19/8 sera: 40 trappole, e tutte e 40 possono scattare** — «melanzane/melanzana»→mela (1025 usi), «denocciolate»→nocciola (385, cioè le olive denocciolate contate come nocciole a 628 kcal), «melagrana»→grana (72, il melograno diventa il parmigiano), «cipollotto»→pollo (55), «pescatrice»→pesca (32), «surgelato/congelato»→gelato (45), «datterini»→datteri (22, 18 kcal contro 280), «fagiolini»→fagioli (15, 31 contro 300). ⚠️ E quelle **giuste** erano tre in tutto: «pomodorini», «pomodorino» → pomodori e «spinacino» → spinaci. Circa **1700 usi sbagliati contro 231 giusti**. ⚠️ Sulle domande vere invece il cambio non toglieva e non aggiungeva niente: in tutta la storia della chat ci sono 210 messaggi di clienti e **una sola** domanda nutrizionale — la trappola era **carica ma non ancora scattata**. ✅ **Simone ha scelto le parole intere il 19/8 sera, e sono in produzione dalla consegna dopo.** Perdere i tre casi buoni non è un danno: quando Gaia non trova «pomodorini» dice «non ce l\'ho» e il termine finisce fra i mancanti, che è **il modo in cui la tabella cresce guidata dalle domande vere** — un «non lo so» si vede e diventa una riga, «44 kcal» detto dalla mela non si vede. ⚠️ **I due modi restano tutti e due nel codice** perché `diag:ricerca` continua a confrontarli: il giorno che la tabella si riempie, la stessa misura dirà se il pezzo di parola è tornato a valere qualcosa. ⚠️ **Resta aperto quello che la misura ha scoperto per caso**: quei 40 nomi non sono in tabella (melanzane, fagiolini, datterini, cipollotto, pescatrice, olive denocciolate…) — è la lista 3b, e sta nella voce dei nomi liberi degli ingredienti.',
    categoria: SIMONE,
    ordine: 610,
    nata: '2026-08-19T22:30',
    priorita: 'bassa',
    fatta: true,
  },

  {
    chiave: 'misure-come-si-prendono',
    titolo: 'Come si prendono le misure: la cliente non lo sa, e per settimane le abbiamo promesso un video che non c\'era',
    dettaglio:
      'Trovato il 19/8 sera cercando tutt\'altro (la voce sulle schermate 30 e 27-28). La pagina delle **misure di partenza** del questionario diceva a ogni cliente: «Se non sai come prenderle, **guarda il video toccando il pulsante**». ⛔ Il pulsante non c\'è e il video non c\'è — in tutta l\'app non esiste nessun `<video>`, nessun asset, nessun handler. La frase veniva dal prototipo, dove le schermate 28-29 erano due video di presentazione: ⚠️ quei video **li ha annullati Simone il 17/07**, e il testo che li citava è rimasto in produzione per settimane. ⚠️ *Un difetto di testo non è un difetto minore quando il testo è una promessa*, e questa stava nel punto più delicato del questionario — le prime misure di una persona. Chi cercava il pulsante e non lo trovava pensava di aver sbagliato lei. ✅ **La bugia è tolta il 19/8 sera**, e al suo posto c\'è una cosa vera: «scrivimelo in chat: te lo spiego io» — la chat c\'è e le risponde una persona. C\'è anche un test che impedisce ai testi del questionario di promettere di nuovo un video o un pulsante che il prodotto non ha. ⛔ **Resta la domanda vera, e non è di software**: vita e fianchi si possono misurare in modi diversi e la differenza è di centimetri, cioè di quello che poi il motore legge come progresso. Come vogliamo dirglielo — un disegno, tre righe di testo scritte dalla nutrizionista, un video vero — lo decidono Simone e Lucia. Finché non è deciso, la chat regge: è lenta ma è onesta.\n\n✅ **CHIUSA il 20/8: il video c\'è.** Simone ha girato e caricato il video di come si prendono vita e fianchi; l\'ho compresso (15,6 MB → 2,1 MB, perché un video che non parte su rete mobile è un video che non c\'è) e messo **nel popup delle misure** dell\'app, sopra i campi Vita e Fianchi. Si apre solo al tocco: chi sa già come si fa non si trova un video che parte da solo. ⛔ **E questa voce è rimasta scritta come se non fosse successo niente per dodici ore**, finché Simone non me l\'ha dovuto dire due volte. È lo stesso difetto che la voce racconta — un testo che promette una cosa che il prodotto non ha più — fatto da me sull\'elenco dei lavori invece che sul questionario. Una voce che descrive male la realtà è peggio di una voce che non c\'è: la prima fa perdere tempo a chi la legge.',
    categoria: SIMONE,
    ordine: 620,
    nata: '2026-08-19T23:40',
    priorita: 'bassa',
    fatta: true,
  },

  /**
   * ⚠️ LE TRE VOCI SCRITTE A MANO IN PAGINA CHE OGGI RISULTAVANO APERTE SU LAVORI GIÀ FATTI.
   *
   * Hanno `chiave: null` in banca dati — le ha scritte Simone dal backoffice — quindi il file non le
   * ha mai viste. Il 19/8 sera mi sono costate tre indagini: ogni volta sono partito per fare il
   * lavoro e ogni volta era già fatto. Da stasera il caricamento le può **chiudere per titolo**
   * (`soloSeEsiste`), che è l'unica cosa che identifica una riga scritta a mano.
   *
   * ⛔ Chiudere, mai creare: se in pagina il titolo non c'è, per il caricamento non esiste.
   */
  {
    chiave: 'pagina-schermate-30-27-28',
    titolo: 'Schermate app 30 (assaggio menu) e 27-28 (video onboarding)',
    dettaglio:
      'Chiusa il 19/8 sera. ⚠️ Erano **due cose già annullate**, e la voce le teneva vive da sola: l\'assaggio del menu (30) non è mai esistito nel codice ed era stato superato da «Conosciamoci» il 13/8; i video erano le schermate **28-29** (non 27-28: la voce mescolava due numerazioni) e li ha annullati Simone il **17/07**. ⚠️ Cercandoli è saltato fuori un difetto vivo: la pagina delle misure di partenza prometteva a ogni cliente «guarda il video toccando il pulsante», e il pulsante non c\'era — corretto lo stesso giorno.',
    categoria: CODICE,
    ordine: 950,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'pagina-vera-giorni-futuri',
    titolo: 'Vera: rifare i giorni futuri non ancora aperti quando il capo approva un divieto di dieta',
    dettaglio:
      'Chiusa il 19/8 sera, ma **era già fatta dal 18/8**: il rifacimento sta in `applica-proposta.ts`, tetto compreso. ⚠️ Non si vedeva per colpa di un commento venti righe sopra il codice che lo fa, che diceva «si rifanno in un secondo momento» e rimandava a una voce di elenco lavori **mai esistita**. *Un commento che descrive come da fare un lavoro fatto è una trappola.* Corretto, e aggiunti i tre test che mancavano sul tetto dei 200 (la regola si scrive comunque · 200 non è «oltre» · il tetto conta le persone, non le giornate).',
    categoria: CODICE,
    ordine: 951,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'pagina-moduli-dashboard',
    titolo: 'Moduli fissi in dashboard',
    dettaglio:
      'Chiusa il 19/8 sera, e **il nucleo era già fatto dal 18/8**: nessun modulo fisso, tutti accendibili, spegnibili e trascinabili, i predefiniti col bordo colorato, il pulsante «Ripristina default» con conferma. ⚠️ Rileggendo la richiesta fino in fondo («se un utente **si è perso** preme il pulsante») è emerso che il pulsante rimetteva **solo i moduli**: chi si era perso spegnendo il portafoglio o la tabella clienti non recuperava niente. Ora rimette tutta la home — moduli, blocchi, grafici e scorciatoie — in una scrittura sola. ⛔ L\'ordine del menu no: ha il suo pulsante nel suo riquadro.',
    categoria: CODICE,
    ordine: 952,
    fatta: true,
    soloSeEsiste: true,
  },

  /**
   * ⚠️ UNA VOCE SOLA PER DUE COSE, e non è pigrizia: le fa la stessa persona, sulla stessa tabella,
   * nella stessa mezz'ora. Due voci separate farebbero crescere l'elenco senza aggiungere una
   * decisione — e un elenco che cresce a ogni consegna smette di dire quanto lavoro c'è davvero.
   */
  {
    chiave: 'tabella-alimenti-igiene',
    titolo: '✅ Gli stati mancanti li mette la nutrizionista mano a mano — deciso da Simone il 25/8',
    fatta: true,
    dettaglio:
      '✅ **RISPOSTA DI SIMONE, 25/8: «lasciamoli così, li sistema mano a mano che li trova la '
      + 'nutrizionista. Non è un problema».** ⚠️ Ed è una risposta migliore di quella che stavo per '
      + 'proporre — un elenco preparato a tavolino da confermare in blocco: così le righe si '
      + 'correggono quando qualcuno le sta **già guardando**, che è l\'unico momento in cui la '
      + 'domanda «questo alimento crudo o cotto?» ha davanti la persona che sa rispondere.\n\n'
      + '✅ **E adesso la matita TIENE.** Era la cosa che bloccava questa voce: scrivere «non si '
      + 'applica» non bastava perché il seed lo azzerava al primo deploy (`state: r.state ?? null`). '
      + 'Corretto il 21/8 — il seed scrive solo i campi che ha — e verificato il 25/8 sul database '
      + 'vero: `npm run ripara:stati` ha rimesso undici stati e il deploy successivo non li ha '
      + 'toccati.\n\n'
      + '✅ **Il punto 2 era già caduto il 20/8**: «spinaci freschi» c\'è, a 31 kcal crudo — '
      + 'l\'ipotesi dello stato vuoto era giusta ma l\'import ha creato la riga.\n\n'
      + '⚠️ **Cosa resta in giro, scritto perché non spaventi chi legge il diag** (misurato il 25/8 '
      + 'con `npm run diag:crudo-cotto`): in lista 2 restano diciassette nomi senza stato. Sedici '
      + 'vengono dal seed e **non hanno mai avuto** uno stato — `latte intero`, `arancia`, `kiwi`, '
      + '`zucchero`, `bresaola`, `cioccolato fondente` — quindi non è il difetto del `?? null` che si '
      + 'ripete: si vedevano coperti dagli undici. Il diciassettesimo è `anacardi`, che nel seed e nei '
      + 'due fogli non c\'è. ⚠️ **Ma «nata da un\'altra parte» era una frase mia senza una misura '
      + 'sotto**, e la revisione l\'ha ristretta: `anacardi` sta in `prisma/dati-ig.ts` (la tabella IG '
      + 'del capo del 13/8) **con lo stato `tostato`**, e `importa:ig` le righe mancanti le crea '
      + 'scrivendo lo stato. Quindi o quella riga non viene da lì, o viene da lì e qualcosa le ha '
      + 'tolto uno stato che quell\'import scrive: è una domanda aperta, piccola, e sta scritta come '
      + 'domanda. Si dividono in due famiglie — «non '
      + 'si applica» (olio, zucchero, latte, yogurt, cioccolato, tonno al naturale) e «crudo e basta» '
      + '(arancia, kiwi, pesca, ananas, anguria, prosciutto crudo, bresaola) — ma **sono esempi, non '
      + 'la divisione**: quella la fa la nutrizionista dalla matita, non una regola e non io. *Non si '
      + 'deduce, si dichiara.*\n\n'
      + '⚠️ **Il prezzo di questa scelta, detto una volta**: finché nessuno tocca l\'olio (3682 '
      + 'ricette), la prima riga di «Alimenti da correggere» sarà sempre lui. Non fa danno: è un '
      + 'posto in cima occupato.\n\n'
      + '## Il testo di quando la voce è nata\n\n'
      + 'Due lavori di mezz\'ora sulla tabella alimenti, tutti e due nati guardando la pagina vera il 20/8. **1) Le cinque righe che non hanno uno stato, e non devono averlo.** In cima all\'elenco «Alimenti da correggere» stanno `olio extravergine di oliva` (3025 ricette), `olio evo` (1706), `miele` (1331), più sale e zucchero: risultano «Senza stato». ⚠️ Ma all\'olio lo stato **non si applica** — crudo o cotto è la stessa cosa, 899 kcal restano 899. ⛔ Finché restano vuote fanno due danni invisibili: ogni ricetta dettata a Vera con l\'olio si porta dietro «la tabella non dice se il valore è a crudo» (*un avviso che compare sempre non è un avviso*, e compare sull\'ingrediente più usato del catalogo), e quelle righe occupano i primi posti dell\'elenco **nascondendo quelle da correggere davvero**. ✅ Dal 20/8 il valore c\'è: matita → campo Stato → «non si applica». Cinque righe. ⚠️ **Non si deduce, si dichiara**: nessuna regola indovina quali alimenti non hanno stato, e una che ci provasse sbaglierebbe sul primo caso nuovo in silenzio. **2) «spinaci freschi»: 1350 ricette che non si abbinano.** In elenco risulta «Non in tabella», e non dovrebbe: la regola dice che «freschi» è innocuo quando la riga è a crudo, e gli spinaci in tabella ci sono. ⚠️ L\'ipotesi è che la riga «spinaci» abbia lo **stato vuoto** — dal 19/8 sera «fresco» si accetta solo se combacia con lo stato della riga, e con lo stato vuoto non combacia niente. ⛔ **Ma è un\'ipotesi, e il 20/8 mi ha già morso due volte ragionare su dati immaginati invece che letti**: si legge con `NOME=\'spinaci freschi\' npm run diag:crudo-cotto`, che spiega passo per passo dove finisce quel nome e perché. Se è lo stato vuoto, è un campo — e lo stesso vale probabilmente per «prezzemolo fresco» (1207), «basilico fresco» (826) e «timo fresco» (670), che però sono aromi e pesano zero: quelli si tolgono dall\'elenco, non si correggono.\n\n✅ **20/8 sera — l\'import è andato, e questa voce si è ristretta.** `npm run diag:crudo-cotto` dopo il caricamento dei 277 alimenti: **286 alimenti hanno la riga a crudo** (lista 4), che è la lista che conta. E **«spinaci freschi» c\'è**, a 31 kcal crudo: l\'ipotesi dello stato vuoto era giusta, ma non serve più indagarla — l\'import ha creato la riga.\n\n⛔ **Resta il punto 1, ed è ancora il primo dell\'elenco**: `olio extravergine di oliva` (3024 ricette) e `miele` (1333) risultano «senza stato», più sale e zucchero. ⚠️ E adesso si sa **perché** sono senza stato — il seed li azzera a ogni deploy, vedi `seed-nutrienti-firma-falsa` — quindi scrivere «non si applica» dalla matita **oggi non basta**: al primo deploy tornerebbe vuoto. Questa voce aspetta quella.\n\n⚠️ Sulla lista 1 di `diag:crudo-cotto` una nota per non spaventarsi: delle 19 righe «solo da cotto», quindici sono corrette così — «ceci cotti», «riso integrale cotto», «quinoa cotta»: è la **ricetta** a dire cotto, quindi il valore da cotto è quello giusto. Le altre quattro — `pane di segale (da cotto)`, `zucca (da cotto)`, `ceci (da cotto)`, `lenticchie (da cotto)` — hanno il nome vecchio come sinonimo **apposta**, perché Gaia risponda «dipende» invece di dare un numero solo.',
    categoria: SIMONE,
    ordine: 615,
    nata: '2026-08-20T08:10',
  },

  {
    chiave: 'mese-confine-provvigioni',
    titolo: 'Provvigioni: controllare se il confine di mese sbagliato è già costato qualcosa',
    dettaglio:
      'Il difetto è **chiuso** (20/8): la parte economica prendeva il mese e il giorno nel fuso del **server** — su Render `TZ` non è impostata, quindi UTC — invece che in quello di Roma. Fra mezzanotte e le 02:00 del primo del mese, a Roma è mese nuovo e per il server no. ⛔ Tre conseguenze: **1)** una provvigione accreditata in quelle due ore veniva contata nel **mese precedente**, e per chi ha un tetto di guadagno quel mese era già pieno — l\'importo veniva tagliato e, siccome l\'eccedenza non slitta (decisione dell\'11/8), **perso**, senza una riga a registro e senza un errore; **2)** la finestra prelievi «dal 1 al 7» risultava chiusa nelle prime due ore del giorno 1 e aperta in quelle del giorno 8; **3)** la pagina «Compensi staff» filtrava il mese con un confine diverso da quello con cui il tetto aveva contato le stesse righe. ⚠️ È **lo stesso difetto già chiuso il 7/8 sulle misure** (la pesata delle 00:30 che sovrascriveva quella del giorno prima): sulle date delle clienti era stato corretto, sui soldi no — e il fuso giusto stava già in `common/date-only.ts`. ⛔ **Quello che resta è una misura, non un lavoro**: sapere se è già successo a qualcuno. Un comando, sola lettura, dalla shell di Render: `npm run diag:mese-confine`. Dice quante provvigioni sono nate nella fascia spostata e — la domanda che conta — se il tetto ha mai tagliato qualcosa lì vicino (lo legge dall\'audit, l\'unico posto dove un taglio lascia traccia). Se stampa zero tagli, il punto si chiude in trenta secondi; se ne stampa qualcuno, quei soldi si recuperano con «Ricalcola provvigioni» sul pagamento indicato.\n\n✅ **CHIUSA la sera del 20/8.** Simone ha lanciato `npm run diag:mese-confine`: **nessun taglio del tetto** (\'il tetto non ha mai morso\') e **zero righe** scritte nella fascia spostata, su sei righe di compenso in tutto. La domanda che poteva costare soldi a qualcuno è chiusa: il difetto era reale e corretto, ma non ha fatto in tempo a colpire nessuno. ⚠️ Resta vero il motivo per cui valeva la pena guardare: se le provvigioni fossero state cento invece di sei, la stessa misura non sarebbe stata gratis.',
    categoria: SIMONE,
    ordine: 616,
    nata: '2026-08-20T10:40',
    fatta: true,
  },

  {
    chiave: 'ricalcolo-e-tetto-mensile',
    fatta: true,
    titolo: '✅ Chiusa il 27/8: il ricalcolo può ripagare quote tagliate in un mese chiuso — e adesso lo DICE',
    dettaglio:
      '✅ **DECISO da Simone il 27/8: la strada «a».** Il comportamento non cambia — il ricalcolo è un '
      + 'pulsante che preme un admin, e se lo preme è perché vuole pagare. ⚠️ **Quello che cambia è che '
      + 'adesso lo dice a chi preme**: la conferma del pulsante in `Acquisti.tsx` nomina il caso per intero '
      + '(«il tetto mensile si misura su QUESTO mese, non su quello del pagamento»), e il docblock di '
      + '`ricalcolaProvvigioni` non parla più di una domanda aperta ma di una decisione con la data.\n\n'
      + '⛔ **Il difetto non era il comportamento: era il silenzio.** Una decisione di prodotto — '
      + '«l\'eccedenza del tetto si perde», 11/8 — che si disfa con un clic senza che chi clicca lo sappia '
      + 'è un difetto anche quando il codice fa esattamente quello che deve. ⚠️ E la strada «b» resta '
      + 'possibile il giorno che servisse: l\'audit `provvigione.tetto_mensile` tiene la traccia di ogni '
      + 'taglio con importo, mese e riferimento. Sta scritto nel docblock perché non si ricominci a cercarlo.\n\n'
      + '## Il testo di prima\n\n'
      +
      '⚠️ **LA RISPOSTA DEL 20/8 RISPONDEVA A UN\'ALTRA DOMANDA — e quella è già fatta.** Simone ha '
      + 'scritto: *«il ricalcolo provvigioni lavora solo sulle provvigioni della rete coach, non su '
      + 'quella dei nutrizionisti»*. ⛔ Il codice invece percorreva **tutte e due** le catene: su un '
      + 'pulsante che muove soldi, la differenza fra quello che il proprietario crede che faccia e '
      + 'quello che fa **è** il difetto, quale che sia la versione migliore. ✅ Corretto il 20/8, con '
      + '`ricalcolo-solo-coach.spec.ts` che lo tiene fermo. ⚠️ Quello che era già stato pagato ai '
      + 'nutrizionisti **resta pagato**: questa funzione non ha mai tolto niente a nessuno, adesso '
      + 'quelle righe non le guarda.\n\n'
      + '⛔ **MA LA DOMANDA APERTA È UN\'ALTRA, e vale anche sulla sola catena coach.** Chiuderla '
      + 'con quella risposta sarebbe stato darsi ragione da soli.\n\n'
      + '**La domanda, in una riga:** il tetto di guadagno è mensile e l\'eccedenza **si perde** '
      + '(decisione dell\'11/8). «Ricalcola provvigioni» però misura il tetto sul mese **in cui lo '
      + 'premi**: una quota tagliata ad agosto, se il ricalcolo gira a settembre, **viene pagata** '
      + 'sotto il tetto di settembre.\n\n'
      + '· **a)** va bene così — è un\'azione volontaria di un admin, e se la preme è perché vuole '
      + 'pagare. Allora si scrive nel messaggio del pulsante, e la voce si chiude.\n'
      + '· **b)** no — il ricalcolo deve escludere le quote già tagliate da un tetto di un mese '
      + 'ormai chiuso. Si può fare: l\'audit `provvigione.tetto_mensile` tiene la traccia di ogni '
      + 'taglio con importo, mese e `ref`.\n\n'
      + '⚠️ **Non la scelgo io**, e non per prudenza generica: togliere o dare soldi a una persona '
      + 'non è una decisione di chi scrive il codice. Finché non è deciso, il codice ne applica una '
      + 'implicita — la a) — senza che chi clicca lo sappia, ed è il solo motivo per cui questa voce '
      + 'esiste. Sta scritto anche nel docblock di `ricalcolaProvvigioni`.\n\n'
      + '## Il testo di quando la voce è nata\n\n'
      + 'Una domanda, non un difetto — ma è una decisione tua e finché non la prendi il codice ne applica una implicita. Il **tetto di guadagno** è mensile e l\'eccedenza **si perde** (decisione dell\'11/8: non slitta, non diventa accantonamento). ⛔ Il pulsante **«Ricalcola provvigioni»** però misura il tetto sul mese **in cui lo premi**, non su quello del pagamento: una quota tagliata ad agosto, se il ricalcolo gira a settembre, **viene pagata** sotto il tetto di settembre. Non è un errore di programmazione — è letteralmente cosa vuol dire «aggiungi il mancante» — ma è il modo in cui una decisione di prodotto si disfa con un clic, senza che chi clicca lo sappia. ⚠️ Le due strade: **a)** lasciarlo così (il ricalcolo è un\'azione volontaria di un admin, e se la preme è perché vuole pagare), e allora basta che il messaggio del pulsante lo dica; **b)** far escludere al ricalcolo le quote già tagliate da un tetto di un mese ormai chiuso — si può fare, l\'audit `provvigione.tetto_mensile` tiene la traccia di ogni taglio con importo, mese e `ref`. ⚠️ Non l\'ho scelto io: togliere o dare soldi a una persona non è una decisione di chi scrive il codice. Per intanto sta scritto nel docblock di `ricalcolaProvvigioni`.',
    categoria: SIMONE,
    ordine: 617,
    nata: '2026-08-20T11:20',
  },

  {
    chiave: 'allergie-fuori-dalla-guardia',
    titolo: '⚠️ Le allergie non entrano nella guardia che compone il menu: da decidere come chiuderla',
    dettaglio:
      '⛔ **Il fatto.** `evaluateMeals` — la funzione che i commenti del motore chiamano «la sicurezza» (§2/§7) — costruisce l\'elenco delle esclusioni da **intolleranze** (bloccanti) e **cibi non graditi** (sostituibili). Le **allergie** non ci sono: si leggono solo per la regola del delattosato. E la prima riga della funzione è `if (!intolerances.length && !dislikes.length) return …`, cioè una cliente che ha dichiarato **soltanto allergie** esce di lì senza che si sia guardato niente. ⚠️ Le allergie SONO controllate altrove — nelle sostituzioni di Gaia («su questo non si media»), nel pool delle ricette semplici, e nella base personale, che usa perfino i tag confermati dal nutrizionista. Tre punti su quattro: quello che manca è proprio la composizione del menu. ⚠️ **E i tag allergene confermati** (`Recipe.allergens`, quelli che un nutrizionista ha guardato uno per uno) **il motore dei menu non li legge affatto**: li legge solo la base personale. ⛔ **Perché non l\'ho corretto io.** Aggiungere le allergie all\'elenco bloccante non è una riga: `violations` fa **fermare l\'erogazione** (`return []` più escalation). Se una dieta assegnata contiene l\'allergene di una cliente, da domattina quella cliente **non riceve il menu** invece di riceverne uno sbagliato. Può darsi che sia giusto — ma è una decisione clinica, e chi scrive il codice non la prende da solo. ✅ **Il numero da cui si decide**: `npm run diag:allergeni-piatto` (sola lettura) dice quante clienti e quali piatti, negli ultimi 14 giorni e a venire, per parola chiave **e** per tag. Se è **zero**, le diete assegnate sono già scelte bene e la rete di sicurezza si aggiunge senza cambiare niente a nessuno. Se **non è zero**, quelle righe sono piatti che stanno arrivando adesso a persone che hanno dichiarato un\'allergia.\n\n✅ **CHIUSA la sera del 20/8.** Simone ha lanciato la diagnostica: **9 clienti con allergie dichiarate, 8 senza intolleranze** — cioè otto persone per cui la guardia usciva senza guardare niente — e **zero pasti** con il loro allergene negli ultimi 14 giorni e a venire. Le diete assegnate erano già scelte bene, quindi la rete di sicurezza si è potuta aggiungere senza togliere il menu a nessuno: le allergie entrano nell\'elenco bloccante come le intolleranze, e i **tag allergene confermati** sulla ricetta adesso li legge anche il motore (prima solo la base personale). ⚠️ Resta una scelta di prodotto non presa, scritta nel codice: un allergene con una sostituzione sicura fa erogare il piatto con la sostituzione annotata, esattamente come per un\'intolleranza. La variante più severa — «un allergene non si sostituisce mai» — si fa togliendo una riga, ma è una decisione clinica.',
    categoria: SIMONE,
    ordine: 600,
    nata: '2026-08-20T17:40',
    fatta: true,
  },

  {
    chiave: 'che-giorno-e-oggi-trenta-punti',
    fatta: true,
    titolo: '✅ «Che giorno è oggi» non si calcola più a mano: diciassette punti chiusi, e il guardiano adesso vieta la causa',
    dettaglio:
      'Misurato il 20/8, non stimato: `grep` su `setHours(0,0,0,0)` e `Date.UTC(d.getUTCFullYear(), …)` trova **una trentina di punti** che si calcolano «oggi» per conto loro. Su Render il processo sta a UTC, quindi fra mezzanotte e le 02:00 in Italia tutti rispondono **ieri**. ⚠️ È lo stesso difetto chiuso il 7/8 sulle misure (la pesata delle 00:30 che sovrascriveva quella del giorno prima) e il 20/8 sui soldi: `common/date-only.ts` esiste apposta, e la maggior parte di questi punti è di prima e non è mai stata ricontrollata. ⛔ **Non li ho corretti tutti in blocco, di proposito**: fra questi ci sono `commerce/stati-abbonamento.ts` e `common/piano-attivo.ts`, che decidono se un piano sta erogando **oggi** — cambiare quel confine tocca chi riceve il menu domattina, e non è una cosa da fare a trenta file insieme senza guardarli uno per uno. ⚠️ Due cron girano dentro la fascia: `reminders` e `genera-catalogo` (ogni 10 minuti) e `measures-nudge` (ogni 2 ore, quindi anche alle 22:00 UTC = mezzanotte a Roma). Il giro giornaliero grosso invece è alle 05:00 UTC, fuori pericolo. ✅ **Già corretti** (20/8, quattro consegne): il mese dei soldi; la scadenza dell\'attività «Misure non inserite», che nasceva con la data di ieri; **gli stati abbonamento e `piano-attivo`** — cioè se una cliente sta ricevendo i menu, il difetto che le diceva «non hai un piano» all\'una di notte del giorno in cui il percorso comincia; **`privacy/cancellazione`**, dove una revoca inviata di notte faceva scadere il termine un giorno prima di quello promesso nella mail; **`menu/correzione-kcal`**, dove «per 7 giorni» ne durava sei se il nutrizionista la scriveva dopo mezzanotte; **`pause.service`**, che rimandava di un giro il menu di rientro. ✅ E **`coach-tasks`** (20/8): «oggi» e «una data salvata» erano mescolati nella stessa funzione `day()` — è il motivo per cui il difetto non si vedeva — e ora sono due, `oggiPiu` e `giornoPiu`; un\'attività aperta all\'una di notte nasceva con la scadenza di oggi invece che di domani, cioè con un giorno di lavoro già bruciato. ✅ E il giro del 20/8 pomeriggio: **`menu/senza-glutine`**, **`vera/*`** (⚠️ «domani» dettato a Vera all\'una di notte finiva su **oggi**: la nutrizionista dice domani e la cliente se lo trova nel piatto stamattina), **`monitoring`**, **`clients`**, **`commerce`**. ⚠️ **`menu/data-inizio-chat` NON era da correggere**: usa già `toDateOnly()` da prima, l\'avevo messo in elenco senza guardarlo — una voce che descrive male la realtà, cioè esattamente la cosa che continuo a trovare negli altri. ⛔ **Restano** solo i posti dove un giorno spostato cambia un grafico e non quello che una persona riceve: `reports`, `marketing/lifecycle`, `agents`, `dashboard`, `analytics`, `crm`. Il perimetro già guardato lo tiene fermo `common/il-giorno-si-chiede.spec.ts`, che legge il sorgente. ⚠️ **E resta la metà grossa**: il giorno di una data **salvata** si continua a leggere in UTC ovunque, di proposito — `Subscription.startDate` è un `DateTime` con istanti veri dentro, e rileggerli a Roma sposterebbe di un giorno i piani già venduti fra le 22:00 e le 24:00 UTC. Si misura con `npm run diag:giorno-piani` e poi si decide.\n\n✅ **20/8 sera — la misura che mancava è arrivata, e dice VIA LIBERA.** `npm run diag:giorno-piani`: 40 abbonamenti, 78 date guardate, **18** con un orario diverso da mezzanotte UTC e **zero** che cambierebbero giorno se lette a Roma. ⚠️ Era l\'unica cosa che teneva ferma la metà grossa del lavoro: temevo che rileggere a Roma spostasse di un giorno i piani già venduti fra le 22:00 e le 24:00 UTC. **Non ce n\'è nessuno.** Quindi la seconda metà — il giorno di una data SALVATA — si può fare, e adesso è un lavoro normale invece che una scommessa. ⚠️ Resta grosso: sono decine di punti, e vanno fatti a gruppi con una misura per gruppo, non tutti insieme. La diagnostica va rilanciata prima di ogni gruppo: zero oggi non è zero fra un mese, perché ogni piano nuovo scrive una data nuova.\n\n✅ **20/8 sera — chiuso anche l\'ultimo gruppo della prima metà, e la frase che diceva cosa restava era sbagliata.** Diceva: «restano fuori l\'analitica, i report, il marketing e gli agenti — dove un giorno spostato cambia un grafico, non quello che una persona riceve». ⛔ Guardandoli davvero era **sbagliata in cinque punti su sei**, ed era scritta a memoria invece che misurata — la stessa cosa che `il-giorno-si-chiede.spec.ts` esiste per impedire.\n · **`marketing/lifecycle`** non cambia un grafico: `dayRange(offset)` decide **a chi parte una email oggi**. Alle 00:30 italiane una cliente la riceveva con un giorno di ritardo. ✅ Corretto.\n · **`agents/agent-orchestrator`** decide se un agente giornaliero **ha già girato oggi**: alle 00:30 rispondeva di no e lo rimetteva in coda. ✅ Corretto.\n · **`reports/plan-report`** aveva **due domande in una funzione sola** (`day0`, chiamata sia su `new Date()` sia su `sub.startDate`) — lo stesso miscuglio di `coach-tasks.day()`, e il motivo per cui il difetto non si vedeva. ✅ Sdoppiata in `oggiGiorno()` e `giornoDelDato()`.\n · **`dashboard` e `crm` non avevano niente da correggere**: li avevo elencati senza guardarli.\n · **`analytics/serie-giornaliera` era già giusto**, col commento che lo spiega.\n · Resta un solo `setHours(0,0,0,0)`, dentro il **generatore dei dati dimostrativi**: lì il giorno esatto non lo legge nessuno.\n⚠️ **Resta la metà grossa** — il giorno di una data **salvata** — che adesso ha il via libera (`diag:giorno-piani`: zero date che cambierebbero giorno) ed è un lavoro normale invece che una scommessa. `common/date-only.ts` ha ora `giornoDelDato(d)`, l\'altra metà di `aGiorno`, che non dipende da come è configurata la macchina. ⚠️ Va fatta a gruppi con una misura per gruppo, e la diagnostica va rilanciata prima di ogni gruppo: zero oggi non è zero fra un mese.'
      + '\n\n⛔ **CENSIMENTO DEL 24/8 — otto punti VERI, che sbagliano già adesso.** Trovati cercando '
      + 'la famiglia del cambio d\'ora (voce `notte-in-cui-le-lancette-tornano-indietro`, chiusa: là il '
      + 'difetto era nei test). Questi no: sbagliano ogni notte fra mezzanotte e le due, o nella prima '
      + 'ora del mese. In ordine di danno:\n\n'
      + '· ⛔ **`onboarding.service.ts:595`** — `startDate.setHours(0,0,0,0)` su `new Date()`. Chi '
      + 'finisce il questionario in quella fascia si vede il **peso di partenza archiviato al giorno '
      + 'prima**. E `measurement` ha la chiave unica `(cliente, data)` con `upsert … update: {}`: se per '
      + 'quel giorno una misura esiste già, **il peso dichiarato sparisce in silenzio**. ⚠️ È il difetto '
      + 'raccontato in testa a `date-only.ts`, chiuso ovunque tranne che lì — e sulla stessa colonna '
      + '`signals.service` scrive con `toDateOnly()`: **due definizioni di giorno sulla stessa chiave '
      + 'unica**. ⚠️ Tocca anche la regola «Non ha seguito», che riconosce la misura del questionario '
      + 'dalla sua data.\n'
      + '· `agenda/agenda.controller.ts:81-83` — il primo giorno degli orari liberi è **ieri**.\n'
      + '· `agenda/prenotazioni.service.ts:101-104` — i due estremi usano due definizioni di giorno '
      + 'diverse: **29 giorni invece di 30**, e la cliente non vede l\'ultimo prenotabile.\n'
      + '· `coach/coach.service.ts:348` — il calendario della coach comincia da **ieri**.\n'
      + '· `commerce/piano-prova.ts:36` — il «primo giorno accettabile» è **ieri**, quindi la cliente può '
      + 'scegliere una partenza già passata e il controllo non scatta. ⚠️ È la voce '
      + '`giorno-nel-fuso-del-processo-piano-prova`, che con questo censimento smette di essere teorica.\n'
      + '· `agents/agent-runner.service.ts:74` — il tetto di spesa mensile conta il **mese scorso**: un '
      + 'agente esaurito resta bloccato nella prima ora del mese nuovo.\n'
      + '· `commerce/crm.service.ts:1321` — la dashboard commerciale mostra l\'incasso del mese scorso.\n'
      + '· `dashboard/dashboard.service.ts:147` e `analytics/analytics.service.ts:64` — «Nuovi questo '
      + 'mese» e i kg persi nel mese, stesso scarto.\n\n'
      + '⚠️ **E cinque punti che sbagliano solo sul portatile** (`TZ=Europe/Rome`; su Render `TZ` non è '
      + 'impostata e li nasconde), stessa forma dei due corretti il 24/8: `agenda.service.ts:300` — che è '
      + 'la **copia non corretta di `creaFerie`, settanta righe più su nello stesso file** — '
      + '`reports/plan-report.service.ts:156-160`, `commerce/commerce.service.ts:1723`, '
      + '`referral/referral.service.ts:285`, `pause/pause.service.ts:508`.\n\n'
      + '⚠️ Un punto **non risolto**: `signals/stats.ts:60` (`etaDate`) somma giorni a `from`, e il '
      + 'risultato finisce in un\'etichetta mese/anno — ma **nessun chiamante** in `src`. Non so se sia '
      + 'viva o residua, e non l\'ho dedotto.\n\n'
      + '✅ **CHIUSA IL 25/8 — tutti e tredici i punti del censimento, più quattro che il censimento non '
      + 'aveva trovato.** Ognuno guardato e corretto uno per uno, non a `sed`.\n\n'
      + '⛔ **Il peggiore era `onboarding.service`**, ed era peggio di come lo raccontava il censimento: '
      + 'non solo il peso di partenza archiviato al giorno prima, ma **perso**. `measurement` ha la '
      + 'chiave unica `(cliente, data)` scritta in `upsert … update: {}`, e sulla stessa colonna '
      + '`signals.service` scrive con `toDateOnly()`: due definizioni di giorno sulla stessa chiave. Se '
      + 'per il giorno sbagliato una misura c\'era già, il peso dichiarato non entrava e nessuno se ne '
      + 'accorgeva. ⚠️ **E nessun test lo vedeva** perché il finto di `prisma.measurement` non esisteva: '
      + 'la scrittura sta in un `try/catch` best-effort, quindi falliva in silenzio a ogni test. Un finto '
      + 'che manca non fa fallire niente — fa passare tutto.\n\n'
      + '✅ **I quattro punti in più**, trovati rifacendo il `grep` con la regola larga invece che con le '
      + 'formule note: `clients/finestra-menu.ts` (la finestra dei menu della coach conservava l\'ora '
      + 'corrente ed era confrontata con una colonna DATE: **55 giorni alle 09:00, 56 alle 00:10**, lo '
      + 'stesso menu nella stessa giornata), `menu/sostituzione-chat.service.ts` (la finestra che decide '
      + 'se alla cliente parte «parlane con la tua coach»), `coach-tasks/kcal-restano-corte.ts` (la '
      + 'scadenza dell\'attività), `menu/plateau.ts` (`getDay()` decideva **in che giorno della '
      + 'settimana** una cliente in plateau riceve i piatti che ama — un giorno che si dice a voce).\n\n'
      + '✅ **Tre funzioni nuove in `date-only.ts`, perché la stessa riga era copiata a mano**: `oggiPiu` '
      + '(oggi ± N, giorno di Roma), `giornoPiu` (una data salvata ± N, giorno UTC), `istantePiuGiorni` '
      + '(una scadenza ± N, l\'ora resta quella). Le prime due stavano in `coach-tasks.service` da '
      + 'agosto: fuori di lì erano riscritte con `setDate` in sei punti. Più `inizioDiOggi` (l\'**istante** '
      + 'in cui è cominciato oggi, per chi filtra timestamp), `confineMeseGiorni` (i confini di mese per '
      + 'una colonna DATE) e `meseDopo` («più un mese» con una definizione sola).\n\n'
      + '⛔ **E il guardiano adesso vieta la causa, non le sue forme.** `il-giorno-si-chiede.spec.ts` '
      + 'vietava `setHours(0,0,0,0)`, e per questo non vedeva `new Date(d.getFullYear(), …)`: **sette** '
      + 'dei tredici punti. La seconda stesura aggiungeva una `RegExp` per quella forma, e la revisione '
      + 'l\'ha bucata in cinque modi in dieci minuti. Adesso la regola è una sola e larga: **dentro il '
      + 'perimetro non si leggono né si scrivono campi di calendario nel fuso del processo**, mai — '
      + '`getDate`, `getMonth`, `getFullYear`, `getHours`, `getDay` e i `set*` corrispondenti. Le versioni '
      + '`…UTC…` restano permesse. Il perimetro è passato da 24 file a 41, e tutti e 41 passano la regola '
      + '**senza nessuna eccezione dichiarata**. ⚠️ Il buco che resta, dichiarato: `new Date(2026, 8, 1)` '
      + 'con tre numeri scritti a mano non lo prende nessuna `RegExp`.\n\n'
      + '✅ **La misura si può fare**: `npm run diag:giorno-a-mano` (sola lettura) conta i pesi di '
      + 'partenza archiviati al giorno sbagliato — e quanti sono **spariti** — le iscrizioni contate nel '
      + 'mese sbagliato e gli incassi finiti nel mese prima, con nomi e importi. ⚠️ Zero non vuol dire '
      + '«non è mai successo»: vuol dire «non è successo alle persone che ci sono adesso».\n\n'
      + '⚠️ **Quattro cose trovate dalla revisione, prima della consegna, e vale la pena scriverle**: '
      + '(1) la prima correzione di `coach.service` **girava** il difetto invece di chiuderlo — metteva '
      + 'un giorno (`toDateOnly`) dove serviva un istante, e un appuntamento dell\'01:30 sarebbe sparito '
      + 'dal calendario di chi lo guarda all\'01:00; (2) il commento su `agenda.controller` diceva che '
      + 'l\'anteprima «partiva da ieri», **falso**: `orariLiberi` risaliva già l\'estremo sinistro, il '
      + 'difetto vero era solo il destro (29 giorni invece di 30); (3) il commento su `pause.service` '
      + 'dichiarava un difetto che su una colonna DATE non può esistere; (4) `benvenuto-conosciamoci.spec.ts` '
      + 'costruiva «oggi» **con la formula vietata**, e finché anche il prodotto sbagliava i due errori si '
      + 'annullavano: corretto il prodotto, `npm run test:notte` è diventato rosso. Un test che si calcola '
      + 'oggi da solo non prova il prodotto, prova la macchina.\n\n'
      + '✅ **E due difetti veri usciti dalla revisione, che non c\'entravano col fuso**: il ripiego del '
      + 'rinnovo in `commerce.service` faceva `+1 mese` **traboccando** (31 gennaio → 3 marzo invece di 28 '
      + 'febbraio), e siccome ogni rinnovo riparte dalla scadenza precedente i giorni regalati si '
      + 'sommavano; e l\'analitica confrontava `Measurement.date` (colonna DATE) con confini di mese a '
      + '**istanti** — invisibile a Roma, ma con `APP_TIMEZONE` a ovest ogni misura del primo del mese '
      + 'sarebbe finita nel mese prima.\n\n'
      + '⛔ **Resta aperta la metà grossa, e non è questa voce**: il giorno di una data **salvata** si '
      + 'continua a leggere in UTC (`giornoDelDato`), di proposito e con la misura in mano '
      + '(`diag:giorno-piani`: zero date che cambierebbero giorno). ✅ Mentre '
      + '`data-inizio-giorno-o-istante` — dove `planStartDate` non diceva se conteneva un giorno o un '
      + 'istante — è chiusa dal 28/8: il campo adesso lo dichiara (`planStartOrigine`).',
    categoria: CODICE,
    ordine: 618,
    nata: '2026-08-20T12:10',
  },

  /* ─────────────────  20/8 sera — la revisione delle misure  ───────────────── */

  {
    chiave: 'test-col-difetto-del-fuso',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: true, // chiusa il 23/8 — e sotto i test rotti c'erano due difetti di prodotto
    titolo: '⛔ La suite è verde 22 ore su 24 e rossa 2: i test hanno il difetto del fuso',
    dettaglio:
      '⛔ **Alle 00:02 di Roma del 21/8 la suite è diventata rossa**: 13 test in 6 file, tutti con una '
      + 'differenza di **esattamente 86.400.000 ms** — un giorno.\n\n'
      + '    Expected: 1787270400000\n'
      + '    Received: 1787356800000\n\n'
      + '⚠️ I test calcolano «domani» con `setHours(0,0,0,0)` o `new Date().toISOString().slice(0,10)` — '
      + 'il giorno **UTC** — mentre il codice, curato durante il 20/8, risponde col giorno di **Roma**. '
      + 'Fra mezzanotte e le 02:00 italiane le due risposte differiscono di un giorno.\n\n'
      + '⛔ **È il difetto che abbiamo passato la giornata a togliere dal codice, rimasto dentro i test '
      + 'che lo verificano.** Un test che si ricalcola da sé la cosa che sta verificando non la '
      + 'verifica: la ripete — e quando il codice cambia fuso, il test resta indietro **senza dirlo**.\n\n'
      + '⚠️ **Perché blocca:** se un deploy capita in quella fascia la CI fallisce senza motivo '
      + 'apparente, e chi ci sbatte contro perde un\'ora prima di capire che non è colpa sua. È '
      + 'successo davvero: la consegna 78 è rimasta ferma per questo.\n\n'
      + '✅ Corretti tre file — `coach-tasks/apri-attivita`, `menu/sostituzione-chat.service`, '
      + '`nutritionist/nutritionist.service` — e i rossi sono passati da 13 a 8.\n'
      + '⛔ **Restano tre file**: `privacy/privacy.service`, `menu/data-inizio-chat.service`, '
      + '`coach-tasks/compiti-prova-in-coda`. Non toccati **di proposito**: sono test su date con '
      + 'fixture intrecciate, era l\'una di notte, e **rendere verde un test in fretta è il modo di '
      + 'fargli smettere di verificare**.\n\n'
      + 'La correzione è sempre la stessa: il test chiede il giorno **alla stessa porta del codice** '
      + '(`aGiorno`, `giornoLocale`, `toDateOnly` in `src/common/date-only.ts`), non se lo ricalcola. '
      + '⚠️ E vale la pena aggiungere un controllo che legga i sorgenti dei test come fa '
      + '`il-giorno-si-chiede.spec.ts` col codice: finché la regola vale solo per metà del progetto, '
      + 'l\'altra metà la romperà di nuovo.\n\n'
      + '---\n\n'
      + '✅ **CHIUSA il 23/8 — e i test rotti erano la parte piccola.**\n\n'
      + 'Primo fatto: la misura fatta a mano il 21/8 era **sbagliata**. Rifatta con un orologio finto '
      + '(`npm run test:notte`, che gira la suite come se fossero le 00:30 di Roma) i file rossi erano '
      + '**quattro**, non tre: si era aggiunto `notifications/notifications.service`, perché niente '
      + 'impediva di riscrivere il difetto. ⚠️ E la prima versione dell\'orologio finto contava **8 '
      + 'file invece di 4**, perché falsificava l\'ora dentro `beforeEach`, cioè dopo che i moduli '
      + 'erano già caricati: una misura sbagliata manda a correggere codice che funziona.\n\n'
      + '⛔ **Secondo fatto: due dei quattro non erano test rotti. Era il PRODOTTO.**\n\n'
      + '· **La finestra di blocco della data d\'inizio, dichiarata di 24 ore, ne durava 22** (23 '
      + 'd\'inverno). Contava le ore fino alla mezzanotte **UTC** del giorno d\'inizio, ma il piano '
      + 'parte alla mezzanotte di **Roma**, due ore prima. Sbagliava nel verso che costa: nelle ultime '
      + 'due ore utili il pulsante nel profilo era acceso e Gaia si offriva di spostare, e la data si '
      + 'muoveva **dentro** la finestra che il blocco esiste per proteggere — con i menu già sbloccati '
      + 'e magari la spesa già fatta. E lo stesso conto risponde a `oreMancanti`, il numero che la '
      + 'cliente **legge**: le diceva due ore in più di quelle che aveva.\n\n'
      + '· **`statoPerInizio` riceveva un GIORNO e lo confrontava come un ISTANTE.** Quattro dei cinque '
      + 'punti che scrivono la data d\'inizio le passano `toDateOnly(...)`, cioè la mezzanotte UTC del '
      + 'giorno di Roma — che sono **le 02:00 italiane**. Fra la mezzanotte e le due, «comincio oggi» '
      + 'risultava nel futuro e il piano nasceva `queued`: niente menu fino alla passata notturna '
      + 'dopo, cioè **un giorno intero**. ⚠️ È il difetto che la voce 258 dichiarava chiuso: la porta '
      + 'era davvero una sola, ma le si passava la cosa sbagliata. Ora c\'è `statoPerGiornoDiInizio` '
      + 'accanto a `statoPerInizio`, e il confronto per istante resta dov\'è **giusto** (la coda che '
      + 'eredita l\'ora di scadenza del piano in corso).\n\n'
      + '· **E un test verde per la ragione sbagliata**: il dedup «una notifica al giorno» era provato '
      + 'con una riga finta **senza data**, e passava solo perché `Intl.DateTimeFormat.format(undefined)` '
      + 'formatta *adesso*. Si è visto solo fermando l\'orologio, perché `Intl` legge il clock del '
      + 'sistema e i finti timer di jest non lo toccano.\n\n'
      + '⛔ **Il guardiano non è un test che legge i sorgenti: è la CI che gira la suite a quell\'ora.** '
      + 'Un elenco di file dichiarati «guardati» avrebbe coperto i quattro di ieri, non il quinto di '
      + 'domani. Il passo `Test · all\'ora pericolosa` nella CI copre tutto, sempre; '
      + '`common/lora-pericolosa-si-gira.spec.ts` tiene fermo che quel passo ci sia e che l\'orologio '
      + 'sia puntato su un istante in cui i due giorni divergono **davvero** — lo calcola su quattro '
      + 'giorni dell\'anno, compresi i due del cambio dell\'ora, invece di cercarlo scritto.\n\n'
      + '⛔ **E la revisione avversariale ha trovato che la prima stesura era peggio del difetto.** '
      + 'Quattordici rilievi, di cui due bloccanti:\n\n'
      + '· `statoPerGiornoDiInizio` rileggeva la data salvata **nel fuso di Roma** — la porta che '
      + 'quello stesso file vieta centoventi righe più su. Su un valore con dentro un\'ora (e ce ne '
      + 'sono: il DTO del profilo accetta un ISO completo, e la coda eredita la scadenza del piano in '
      + 'corso) anticipava **fino a 24 ore**, cioè riapriva la forma ambigua che la voce 258 esiste '
      + 'per chiudere. Ora la regola sta in un posto solo, `istanteDiPartenza` in `date-only.ts`, e '
      + 'un valore che **non** è un giorno lo rende com\'è invece di fingere;\n'
      + '· **quattro dei cinque punti corretti non erano provati da niente.** Mutandoli tutti e '
      + 'quattro, la suite restava verde su 4729 test su 4730. Adesso ognuno ha il suo caso alle 00:30 '
      + '— questionario, matita della scheda, «Conosciamoci», approvazione del bonifico — e il quinto '
      + '(la coda) ha il caso **contrario**, che la coda deve restare in coda fino all\'ora di '
      + 'scadenza.\n\n'
      + '⚠️ E tre dei rilievi erano su test che **dichiaravano** di verificare qualcosa e non lo '
      + 'facevano: il guardiano dell\'orologio restava verde con la riga commentata via e con '
      + '`doNotFake` tolto del tutto; il test che vietava la «costante −2h» sceglieva l\'unico istante '
      + 'invernale che non la distingue; e il commento che diceva «ci pensa `cancellazione.spec.ts`» '
      + 'era falso — quel file non aveva **nessun** caso fra le 22:00 e le 24:00. Tutti e tre corretti '
      + 'e rimutati.\n\n'
      + '⚠️ L\'orologio finto sposta **l\'ora, non il calendario**: la prima stesura fissava una data '
      + 'assoluta, e dal 2 settembre (vedi la voce sotto) avrebbe detto «rotta di giorno, sana di '
      + 'notte» — il contrario del vero, per sempre.\n\n'
      + '⛔ **E la seconda ronda ne ha trovati altri tre bloccanti**, tutti sulla parte nuova: '
      + 'l\'euristica «mezzanotte UTC esatta = un giorno» sbagliava sul caso **più comune di tutti** '
      + '— `subscriptionEnd` produce proprio mezzanotte UTC esatta, quindi la scadenza che una coda '
      + 'eredita ci passava dentro; il guardiano non guardava mai il valore di `now`, quindi '
      + '`test:notte` poteva diventare un doppione di `test` restando verde; e il quinto punto che '
      + 'scrive (Gaia) era l\'unico rimasto senza una prova che dicesse che ora è. ✅ Corretti: '
      + 'l\'euristica è stata **tolta** dove la provenienza non si sa (l\'approvazione del bonifico '
      + 'torna al confronto fra istanti, e il difetto che le resta è scritto in un test e in una voce '
      + 'a parte), e usata solo dove si sa.\n\n'
      + '4750 test verdi (301 suite) alle 00:30 e alle 01:59 di Roma; ogni correzione verificata per '
      + 'mutazione, guardiani compresi. ⚠️ **La suite non è verde a tutte le date**: dal 2 settembre '
      + 'due file cadono da soli e la notte del 25 ottobre altri tre — sono le due voci qui sotto, '
      + 'misurate e non corrette. Nessuna migrazione.',
  },
  {
    chiave: 'giorno-cancellato-che-non-torna',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-23T18:30',
    titolo: '⛔ Un giorno di menu cancellato «per rifarlo» può non tornare MAI: la cliente trova «menu in preparazione» per sempre',
    dettaglio:
      '⛔ **Trovato in revisione il 23/8, ed è in produzione dal 13/8.** La regola di dieta di Vera '
      + '(«nella mediterranea niente tonno») rifà i menu già preparati **cancellandoli**, contando '
      + 'che l\'erogazione li ricomponga al giro dopo. Non è vero:\n\n'
      + '`deliverIfEligible` (`menu/menu.service.ts:771-786`) legge l\'**ultimo** giorno in calendario '
      + 'e, se è più avanti di oggi, **esce**: `if (last.date > today) return [];`. E i giorni nuovi li '
      + 'appende **dopo l\'ultimo**. Quindi un giorno cancellato **in mezzo** non viene ricomposto né '
      + 'oggi né mai: resta un buco, e quel giorno la cliente apre l\'app e trova «menu in '
      + 'preparazione».\n\n'
      + '⚠️ **Come ci si arriva:** `giorniDaRifare` cancella un **sottoinsieme** (solo i giorni che '
      + 'contengono davvero il piatto vietato, decisione giusta del 13/8) — ed è proprio il '
      + 'sottoinsieme che lascia in piedi un giorno più avanti. Gli altri percorsi di Vera che toccano '
      + 'i menu (proteine, pasti) cancellano **tutta** la coda non aperta e quindi non ci sbattono.\n\n'
      + '✅ **Il modo giusto è già scritto**, con il commento che descrive questo identico guasto: '
      + '`menu.service.redeliverFutureDays` cancella, **rieroga subito** e **rimette i giorni com\'erano** '
      + 'se la rierogazione non produce niente («un menu vecchio è meglio di nessun menu»), dicendo a '
      + 'chi chiama che la modifica non è arrivata nel piatto.\n\n'
      + '⚠️ **Nella regola per la singola cliente è già chiuso** (23/8): si cancella dal primo giorno '
      + 'colpito **in avanti**, e se in mezzo c\'è un giorno già aperto non si tocca niente e lo si '
      + 'dice. Ma `vera/applica-proposta.ts:200` — la regola di **dieta**, che tocca molte clienti in '
      + 'una volta — ha ancora il difetto originale. ⛔ Lì la toppa della coda non basta: bisogna '
      + 'passare dal motore, e `applica-proposta.ts` prende `prisma` e basta **di proposito** (non '
      + 'deve poter far fallire un\'approvazione). Va deciso come: o `MenuModule` esportato a Vera con '
      + 'gli occhi aperti, o un passo notturno che ricompone i buchi.\n\n'
      + '⚠️ **Da guardare anche all\'indietro**: chi ha già approvato una regola di dieta dal 13/8 '
      + 'potrebbe avere clienti con un giorno mancante in calendario. Si trova cercando i `MenuDay` '
      + 'con un salto di data nel futuro.\n\n'
      + '---\n\n'
      + '✅ **CHIUSA IL 24/8, ed era più larga di così.** Misurando i punti che cancellano `MenuDay` '
      + 'sono venuti fuori **sei**: tre sono code per costruzione (le rigenerazioni intere del '
      + 'motore), e **tre** erano rotti, non uno:\n\n'
      + '· la **regola di dieta** — quella scritta qui sopra, dal 13/8;\n'
      + '· **«togli lo spuntino»** — cancellava i giorni che contengono lo spuntino, sparsi;\n'
      + '· **«cambia le proteine»** — cancellava i giorni `viewedAt: null` e lasciava in piedi quelli '
      + 'letti: oltre al buco, l\'erogazione restava ferma **del tutto** finché quel giorno non '
      + 'passava. Era il peggiore dei tre.\n\n'
      + '⛔ **E la riga qui sopra che dice «le proteine e i pasti cancellano tutta la coda e quindi non '
      + 'ci sbattono» era FALSA** — l\'avevo scritta io il 23/8 senza verificarla, ed è finita anche '
      + 'in un commento nel codice consegnato. Il codice era giusto, la ragione scritta accanto no: '
      + 'chi legge una ragione falsa ci costruisce sopra invece di andare a guardare.\n\n'
      + 'Adesso la regola sta scritta **una volta sola** (`vera/menu-da-rifare.ts`, `codaDaRifare`): '
      + 'si cancella dal primo giorno colpito in avanti, tutto; se dentro la coda c\'è un giorno già '
      + 'aperto non si tocca niente **e si dice quale giorno**. I colpiti arrivano come **predicato** '
      + 'e non come secondo elenco, così sono un sottoinsieme per costruzione: la prima stesura, con '
      + 'due array, davanti a un universo incompleto rispondeva «coda vuota, fatto» — la risposta più '
      + 'tranquillizzante possibile davanti al difetto che deve chiudere.\n\n'
      + '⚠️ **Non è servito esportare `MenuModule` a Vera**, che era la strada temuta: la coda si '
      + 'calcola con una query in più (i calendari **interi** delle sole clienti colpite — quella '
      + 'filtrata per dieta e per «mai aperto» non vede né i giorni letti né quelli rimasti da una '
      + 'dieta precedente, cioè proprio le righe che restano in fondo). `applica-proposta.ts` continua '
      + 'a prendere `prisma` e basta.\n\n'
      + '⚠️ **Guardia**: `menu/una-porta-per-i-giorni.spec.ts` — ogni file che cancella `MenuDay` va '
      + 'dichiarato con la ragione per cui è una coda, e la forma esatta del difetto (`deleteMany` con '
      + '`viewedAt: null` dentro) è vietata senza eccezioni. ⚠️ **Dal 26/8 la sentinella riconosce anche '
      + 'i due nomi nuovi** (`apertoDallaClienteIl: null` e `...CHE_SI_POSSONO_RIFARE`): un guardiano '
      + 'che pinza solo il nome vecchio resta verde mentre il difetto torna sotto quello nuovo.\n\n'
      + '⛔ **RESTA APERTO IL PASSATO** — voce `buchi-gia-aperti-nei-menu`.\n\n'
      + '⚠️ **E UNA CORREZIONE A QUELLO CHE HO SCRITTO IO IERI.** Sopra è scritto «un buco, e quel '
      + 'giorno la cliente apre l\'app e trova menu in preparazione», come se fosse successo a molte. '
      + 'Non l\'avevo misurato. Le cancellazioni sparse toccavano **solo i giorni non ancora "visti"**, '
      + 'e `viewedAt` viene messo dall\'app su tutti i giorni futuri appena la cliente la apre (voce '
      + '`visto-non-vuol-dire-aperto`): quindi con ogni probabilità quei percorsi **non hanno quasi '
      + 'mai cancellato niente**, e i buchi veri sono pochi. Il difetto era reale e andava chiuso — '
      + 'ma l\'allarme era più grande del danno, e l\'ho scritto in tre file prima di contarlo. '
      + '«Misura prima di decidere» vale anche quando la misura fa scendere il numero.',
  },
  {
    chiave: 'visto-non-vuol-dire-aperto',
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T13:00',
    titolo: '✅ FATTA il 26/8: «visto» non voleva dire «aperto» — adesso c\'è il segnale vero, e «non lo so» si dice',
    dettaglio:
      '✅ **CHIUSA il 26/8 (consegna 99).** Due colonne nuove su `menu_day`: `aperto_dalla_cliente_il` '
      + '— il segnale vero, che l\'app manda quando la cliente sta guardando **quel** giorno — e '
      + '`aperture_tracciate`, che dice se di quel giorno **possiamo saperlo** (si copia da '
      + '`client_profile.aperture_dal` alla nascita della giornata). ⛔ **E la cosa che chiude davvero '
      + 'il difetto non è la colonna: è il QUARTO ESITO.** `codaDaRifare` adesso risponde `niente` / '
      + '`coda` / `bloccata` / **`non_lo_so`**, e ogni percorso che parla lo racconta. Senza quel '
      + 'quarto esito la correzione avrebbe **spostato** il difetto invece di chiuderlo: il giorno del '
      + 'rilascio nessuna riga è tracciata, quindi Vera avrebbe detto «nei giorni già preparati non ce '
      + 'n\'era: non ho toccato niente» — *testualmente la frase del bug*, falsa nello stesso identico '
      + 'caso, con un campo nuovo sotto.\n\n'
      + '⚠️ **Le due domande sono state separate**: «questo giorno è colpito?» (contiene il piatto '
      + 'vietato / lo spuntino / è toccato dalle proteine) e «lo posso cancellare?» (l\'ha aperto, o '
      + 'non lo sappiamo). Prima erano una sola, e filtrare i colpiti su «mai aperto» faceva sparire '
      + 'proprio i giorni di cui bisognava parlare. ⚠️ E la coda adesso **parte dopo l\'ultimo giorno '
      + 'intoccabile** invece di bloccarsi: se lei ha aperto il menu di oggi che ha il piatto vietato e '
      + 'domani ce l\'ha anche, domani si rifà e oggi si **dice** (`lasciatiIndietro`).\n\n'
      + '⚠️ **Toccati insieme, e sono i punti che una prima stesura aveva dimenticato**: il kit di '
      + 'rientro e il ripristino di `redeliverFutureDays` (creavano/rimettevano righe senza le due '
      + 'colonne: giornate «non lo so» per sempre, e un giorno davvero aperto che tornava indietro '
      + 'come non aperto); la **lista della spesa**, che mette in mano alla cliente sette giorni futuri '
      + 'e non ne segnava nessuno — cioè **il caso che la regola cita per giustificarsi**, «magari ci '
      + 'ha già fatto la spesa», ed era l\'unico scoperto; il messaggio di **annulla nel backoffice**; '
      + 'la **giornata dettata per domani**, che rispondeva «potrebbe averla già vista» quando la '
      + 'ragione vera era «non lo so»; le **ore del digiuno**, che riducevano la coda a un numero e '
      + 'dicevano «non c\'erano giornate da rifare» (il caso Lorena, di nuovo).\n\n'
      + '⚠️ **Cosa resta, e va detto**: per un paio di giorni dopo il rilascio — e per ogni cliente, '
      + 'per la durata del suo cuscinetto di giornate **dopo** che la sua app si è aggiornata — la '
      + 'risposta è «non lo so» e i rifacimenti automatici non partono. Si degrada sempre verso «non '
      + 'tocco»: nessuno perde un menu, si perde un automatismo, e la coach lo fa a mano da «Rigenera '
      + 'menu». ⚠️ `npm run diag:visto` adesso misura anche questo (quante righe non tracciate, quante '
      + 'clienti mandano il segnale): è il numero da guardare per sapere se sta ripartendo. ⛔ E chi '
      + 'guarda l\'app di una cliente con «Entra come» **non le apre i giorni**: senza quel controllo '
      + 'una coach che dà un\'occhiata al menu di Anna gliel\'avrebbe reso intoccabile.\n\n'
      + 'Mutazioni provate e tutte uccise: togliere «non lo so» dal `siPuoCancellare`, spostare il '
      + 'confine della coda, azzerare `lasciatiIndietro`, rimettere il filtro nella query dei colpiti, '
      + 'togliere `apertureTracciate` dall\'erogazione e dal kit di rientro, togliere il freno e il '
      + 'controllo «Entra come» dall\'app.\n\n'
      + '## La decisione, il 25/8\n\n'
      + '✅ **RISPOSTA DI SIMONE, 25/8: la strada 2.** Non si allarga la semantica di `viewedAt` '
      + 'proteggendo solo i giorni già arrivati (strada 1): si fa il **segnale vero**, «questa cliente '
      + 'ha aperto il menu di QUESTO giorno». ⚠️ È la più cara delle due — tocca l\'app, non solo il '
      + 'backend — ed è quella giusta: la strada 1 avrebbe rimesso in funzione il rifacimento '
      + 'automatico **al prezzo** di poter cambiare il menu di domani a chi l\'aveva letto e ci aveva '
      + 'fatto la spesa. Un guadagno pagato da chi si è organizzato.\n\n'
      + '⛔ **PRIMA DI SCRIVERE CODICE, IL NUMERO**: `npm run diag:visto` dice quanti giorni futuri '
      + 'risultano già «visti», su quante clienti, e quanti sono menu **di domani**. In sola lettura. '
      + 'Serve a sapere quanto vale il rifacimento automatico che oggi non parte, cioè quanto lavoro '
      + 'a mano questa correzione toglie davvero.\n\n'
      + '⚠️ **La forma, in tre pezzi.** *(a)* Un campo nuovo — **non** `apertoIl`, che è già preso: '
      + 'in `vera/menu-da-rifare.ts` vuol dire «la data del giorno già consegnato», e lo leggono '
      + '`vera-chat.service.ts` e il collaudo, cioè **gli stessi file** che questo lavoro andrebbe a '
      + 'toccare. Due significati e un nome, nello stesso sottosistema, è il modo in cui questa '
      + 'correzione ne genererebbe un\'altra. Serve un nome che dica la cosa: `apertoDallaClienteIl`. '
      + 'E accanto a `viewedAt`, non al posto suo: `viewedAt` continua a voler dire «gliel\'abbiamo mostrato», che è una cosa vera e '
      + 'che qualcuno legge; **due domande, due campi**. *(b)* L\'app lo scrive quando la cliente apre '
      + '**quel** giorno, non quando riceve la lista. *(c)* Solo allora i percorsi che oggi filtrano '
      + '`viewedAt` — i divieti dettati a Vera, gli spuntini, le proteine, la regola di dieta — '
      + 'passano al campo nuovo. ⚠️ Finché l\'app vecchia gira, `apertoIl` sarà NULL per tutti: il '
      + 'ripiego deve essere «non lo so» → **non tocco**, che è il comportamento di oggi, non '
      + '«non aperto» → rifaccio. Il contrario toglierebbe il menu di mano a chi ha una versione '
      + 'vecchia dell\'app.\n\n'
      + '✅ **Nel frattempo le frasi erano già state corrette** (24/8): Vera non diceva più «ha già '
      + 'aperto il menu del 25» ma «il menu del 25 le è già arrivato in app». ⚠️ Dal 26/8 quella '
      + 'prudenza non serve più e la frase è tornata a dire la cosa vera — «il menu del 25 l\'ha già '
      + 'aperto in app» — perché adesso il dato la sostiene.\n\n'
      + '## Come è nata, il 24/8\n\n'
      + '⛔ **Trovato in revisione il 24/8, leggendo il motore.** `MenuDay.viewedAt` si chiama «visto» e '
      + 'in tutto il progetto viene letto come «l\'ha aperto». Non è quello che ci scrive dentro:\n\n'
      + '· `MenuService.getMenu` restituisce all\'app gli ultimi 30 giorni **visibili**, futuri '
      + 'compresi, e subito dopo chiama `segnaVisti`, che li marca **tutti**;\n'
      + '· i giorni nuovi, dal **secondo ciclo in poi**, nascono `visibleFrom: today` — visibili '
      + 'subito (`visibleFrom: last ? today : visibleFrom`).\n\n'
      + '⛔ Quindi **appena la cliente apre l\'app, tutti i suoi giorni futuri risultano «visti»**. '
      + 'Non perché li abbia guardati: perché erano nella lista.\n\n'
      + '⚠️ **La conseguenza è che «rifai i giorni già preparati» è di fatto morto** su ogni percorso '
      + 'che filtra `viewedAt` (i divieti dettati a Vera — compresa la correzione del caso Lorena del '
      + '23/8 — gli spuntini, le proteine, la regola di dieta). Fra la generazione dei giorni e la '
      + 'prima apertura dell\'app passano minuti: dopo, la nutrizionista detta «niente pesce» e legge '
      + '«Nei giorni già preparati non ce n\'era: non ho toccato niente» mentre il branzino è nel menu '
      + 'di domani. La frase è falsa e non lo sembra — il modo peggiore in cui una funzione può '
      + 'essere rotta.\n\n'
      + '**IL NUMERO PRIMA DELLA DECISIONE**: `npm run diag:visto` dice quanti giorni futuri risultano '
      + 'già «visti», su quante clienti, e in particolare quanti menu **di domani**. In sola lettura.\n\n'
      + '**Deciso da Simone il 24/8 — per adesso non si tocca la semantica**, e le frasi si '
      + 'correggono: Vera non dice più «ha già aperto il menu del 25» ma «il menu del 25 le è già '
      + 'arrivato in app», e indica «Rigenera menu» dicendo che quello rifà **anche** il giorno già '
      + 'ricevuto. Nessun rischio di togliere un menu di mano a nessuno; il prezzo è che il '
      + 'rifacimento automatico resta quasi sempre a vuoto, e va fatto a mano dalla scheda.\n\n'
      + '⚠️ **Le due strade che restano aperte, quando ci sarà il numero:**\n'
      + '1. proteggere solo i giorni **già arrivati** (oggi e passati) e tornare a rifare i futuri: '
      + 'la funzione riprende a funzionare, ma si rischia di cambiare il menu di domani a chi l\'aveva '
      + 'letto e ci aveva fatto la spesa;\n'
      + '2. un segnale vero «ha aperto QUESTO giorno», che è la cosa giusta ma tocca anche l\'app.',
  },
  {
    chiave: 'buchi-gia-aperti-nei-menu',
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T11:00',
    titolo: '✅ I buchi nei calendari si riempiono da soli con le giornate nuove — deciso da Simone il 25/8',
    dettaglio:
      '✅ **RISPOSTA DI SIMONE, 25/8: «i buchi si riempiono con le nuove».** Non serve una riparazione a '
      + 'parte: la prossima erogazione compone **le date che mancano**, invece di accodare dopo '
      + 'l\'ultima.\n\n'
      + '⛔ **Quello che faceva prima, e perché era un cancello chiuso.** L\'erogazione guardava la data '
      + 'più alta in calendario: `if (ultima > oggi) return []`. Una cliente con una giornata vuota oggi '
      + 'e una riga in fondo al calendario risultava «servita», e non riceveva più niente **finché quella '
      + 'data non passava** — giorni di «menu in preparazione» senza che niente lo dicesse.\n\n'
      + '✅ **Adesso**: `giornateDiSeguito` conta le giornate **consecutive da oggi** (i giorni in '
      + 'sospensione si saltano senza contarli, perché lì il menu manca di proposito), e il buffer si '
      + 'apre quando quelle non bastano; `dateDaComporre` sceglie **quali date** comporre saltando '
      + 'quelle che ci sono già, quelle sospese e quelle oltre la fine del piano.\n\n'
      + '⚠️ **Non si cancella e non si riscrive NIENTE**: si scrive solo dove non c\'è. Era la ragione '
      + 'per cui questa voce diceva «la riparazione non è automatica di proposito» — rigenerare vuol '
      + 'dire rifare giornate che qualcuna può aver già letto, magari dopo la spesa. Riempire un vuoto '
      + 'non è rifare niente.\n\n'
      + '⚠️ **E la prima erogazione di un piano cominciato nel passato parte da OGGI** (`daOggi = max(oggi, '
      + 'inizio)`), non dalla data d\'inizio: prima componeva giornate per giorni già passati, che '
      + 'occupavano il posto di quelle vere.\n\n'
      + '⚠️ `npm run diag:buchi-menu` resta, in sola lettura: serve a **guardare** se ne sono rimasti, '
      + 'non a ripararli. E i tre casi stanno in `menu.service.spec.ts` — solo domani in calendario, '
      + 'giornate davanti complete (il buffer c\'è ancora), buco in mezzo.\n\n'
      + '## Il testo di prima\n\n'
      + '⛔ Il codice è a posto da oggi (`giorno-cancellato-che-non-torna`), ma **i buchi già aperti non '
      + 'si richiudono da soli**: chi ha una giornata vuota davanti continuerà a vedere «menu in '
      + 'preparazione» quel giorno, e chi ha l\'ultimo giorno oltre oggi non riceve più niente finché '
      + 'quella data non passa.\n\n'
      + '**Il numero prima della decisione**: `npm run diag:buchi-menu` sul database vero elenca le '
      + 'clienti con un salto di data nel calendario da oggi in avanti, le sospensioni escluse (lì i '
      + 'giorni mancano di proposito), e mette per prime quelle con l\'erogazione ferma. È in sola '
      + 'lettura. Il conto dei buchi ha i suoi test (`menu/buchi-nel-calendario.spec.ts`): uno script '
      + 'che sbagliando risponde «nessun buco» chiuderebbe la domanda invece di aprirla.\n\n'
      + '⚠️ **La riparazione non è automatica di proposito**: rimettere a posto un buco vuol dire '
      + 'cancellare la coda dal buco in avanti, cioè rimescolare giornate che qualcuna potrebbe già '
      + 'aver letto — magari dopo la spesa. Con pochi nomi si fa a mano dalla scheda («Rigenera '
      + 'menu»); se sono tanti serve una decisione di Simone e Lucia su cosa si accetta di perdere.',
  },
  {
    chiave: 'niente-pesce-vuol-dire-niente-pesce',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-23T16:40',
    titolo: '«Niente pesce» ora vuol dire niente pesce: 67 voci, i giorni già preparati si rifanno, e Vera spiega cosa ha vietato',
    dettaglio:
      '⛔ **Il caso Lorena Polidoro (23/8)**: regola «niente pesce», e le arrivano un branzino e poi un '
      + 'tonno. Tre difetti diversi sotto lo stesso sintomo:\n\n'
      + '1. **La regola non era mai arrivata al profilo** (campo «Cibi non graditi» vuoto: risolto a '
      + 'mano da Simone). ⚠️ Da capire ancora DOVE si è persa nel dialogo con Vera — il percorso '
      + '«solo per lei» scrive subito, quindi o il dialogo si è fermato alla domanda sull\'ambito, o '
      + 'la risposta è finita in coda approvazioni: si vede dal registro di Vera.\n\n'
      + '2. **L\'elenco del motore per «pesce» aveva 12 voci** — con la tabella delle specie passata '
      + 'da Simone ne mancavano trenta che nei menu si chiamano col loro nome (aringa, nasello, '
      + 'cernia, spigola, verdesca, storione…) più i derivati che non si chiamano pesce (stoccafisso, '
      + 'bottarga, surimi, colatura). Ora sono **67**, controllate parola per parola: «carpa» ha '
      + 'l\'omonima «carpaccio», «razza» ha «terrazza», «rombo» ha «stromboli»; «cappone» (è anche il '
      + 'pollo), «fragolino» (radice = fragoline), «sarda» (alla sarda), «carpione» (marinatura di '
      + 'verdure) sono rimasti FUORI col motivo scritto. ⚠️ E il test dei piatti innocenti ha trovato '
      + 'un falso positivo **preesistente**: «orata» sta dentro ogni participio in «-orata» — una '
      + '«torta decorata», una «cipolla dorata» sparivano da settimane a chiunque escludesse il '
      + 'pesce. Ora ha le sue omonime.\n\n'
      + '3. **La regola per la singola cliente non toccava i giorni già preparati**: scriveva sul '
      + 'profilo e valeva solo per i menu futuri, mentre il branzino già in calendario restava lì. '
      + 'Richiesta di Simone: *«se Vera crea la regola, va applicata su tutto, perché è del '
      + 'nutrizionista assegnato»*. Ora usa la STESSA regola della regola di dieta (`giorniDaRifare`): '
      + 'si rifanno solo i giorni futuri, mai aperti, che contengono davvero un piatto vietato — e la '
      + 'risposta di Vera dice quanti. ⚠️ E se il controllo si rompe, la regola resta scritta e il '
      + 'guasto si dice.\n\n'
      + '⛔ **Trovata anche la NONA copia del confronto**: `ricetteVietate` (regola di dieta, pool, '
      + 'scoperte, rifacimento) usava un `includes` a mano — senza radice né omonime. Con l\'elenco '
      + 'nuovo avrebbe rifatto i giorni col carpaccio di manzo e lasciato passare «triglie» al '
      + 'plurale. Ora passa da `hitsExclusion`, la porta unica: un divieto si comporta uguale da '
      + 'qualunque strada entri.\n\n'
      + '⚠️ **E Vera adesso SPIEGA cosa ha vietato**: «\"pesce\" per il motore vuol dire tonno, '
      + 'salmone, branzino, orata, merluzzo, sgombro e altre 60 voci». Vale per ogni categoria (latte, '
      + 'legumi…): senza, l\'unico modo di scoprire quanto è largo un divieto era vedere cosa '
      + 'sparisce dai piatti.\n\n'
      + '⛔ **E la revisione avversariale ha trovato un bloccante mio, più vecchio della consegna.** '
      + '«Rifare un giorno» voleva dire solo cancellarlo, contando che l\'erogazione lo ricomponesse. '
      + 'Ma `deliverIfEligible` si ferma se in calendario c\'è già un giorno **più avanti di oggi**, e '
      + 'i nuovi li appende **dopo l\'ultimo**: cancellare un giorno in mezzo lascia un buco che **non '
      + 'si richiude mai** — la cliente apre l\'app in quel giorno e trova «menu in preparazione», per '
      + 'sempre. ⚠️ È un difetto che la **regola di dieta ha dal 13/8**: voce '
      + '`giorno-cancellato-che-non-torna`, da chiudere lì con `redeliverFutureDays`, che esiste già e '
      + 'sa rimettere i giorni com\'erano se la rierogazione non produce niente. Qui si cancella dal '
      + 'primo giorno colpito **in avanti** (come già fanno le proteine e i pasti di Vera), così '
      + 'l\'ultimo torna indietro e l\'erogazione riparte; e se in mezzo c\'è un giorno **già aperto** '
      + 'non si tocca niente **e lo si dice**, con la strada da prendere.\n\n'
      + '⛔ **E il caso Lorena vero non era coperto**: con «pesce» già sul profilo (come l\'ha messo '
      + 'Simone a mano) ridettare la regola usciva subito con «erano già tutti esclusi» **senza '
      + 'guardare i giorni** — cioè l\'unica strada per rimediare era l\'unica che non ripuliva niente. '
      + 'Ora i giorni si guardano sempre.\n\n'
      + '⚠️ **Tre voci tolte o corrette in revisione**, con lo stesso criterio con cui ne erano già '
      + 'state scartate altre: **«razza»** (razza chianina/piemontese: chi esclude il pesce perdeva la '
      + 'bistecca), **«sarde»** (prefisso di «Sardegna»), e le omonime di **«orata»** — otto parole '
      + 'contro una famiglia **aperta** («insaporata», «odorata», «ristorata»…). Da lì la regola '
      + 'nuova `SOLO_A_INIZIO_PAROLA`, che chiude la famiglia intera invece di rincorrerla. ⛔ E il '
      + 'giro della **radice** non consultava le omonime: erano **strutturalmente impossibili** per '
      + '`trigli`, `palomb`, `gallinell`, `ricciol` — e un mio commento indicava proprio quella come '
      + 'la via d\'uscita. Adesso esiste.\n\n'
      + '⚠️ E la composizione **taceva**: uno slot che resterebbe a zero per un divieto di dieta si '
      + 'teneva il pool intero — piatti vietati compresi — senza una riga da nessuna parte, mentre il '
      + 'ramo gemello delle esclusioni della cliente lo scrive da sempre.\n\n'
      + '⚠️ Da misurare in produzione dopo il rilascio: `npm run diag:esclusioni` dice quante ricette '
      + 'l\'elenco nuovo toglie davvero — e va chiesto su **triglia, palombo, gallinella, ricciola**, '
      + 'non solo su «riccioli». ✅ Sui 273 piatti dei cataloghi del repo toglie **una ricetta in più** '
      + 'e **zero** falsi positivi. 49 test nuovi sull\'elenco + 6 su Vera; ogni pezzo verificato per '
      + 'mutazione. Nessuna migrazione.',
  },
  {
    chiave: 'via-libera-non-arrivava-al-cliente',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: true,
    nata: '2026-08-23T14:05',
    titolo: '⛔ «Può proseguire» non arrivava al cliente: il menu restava fermo per sempre',
    dettaglio:
      '⛔ **Trovato su una persona vera, il 23/8.** Sulla scheda di Gianluca: «Valutazione clinica — '
      + 'Può proseguire · 23/08/2026», con la nota della nutrizionista. Nella sua app, nello stesso '
      + 'momento: «Menu dopo la visita — il menu sarà pronto dopo la visita con il nutrizionista».\n\n'
      + '⛔ **La decisione e il blocco erano due campi diversi, e nessuno dei due chiamava l\'altro.** '
      + 'Il pulsante scrive `idoneita`; il gate del menu, il popup misure e la card leggevano **solo** '
      + '`screeningFlag`, che lo mette il questionario in registrazione. E `screeningFlag` **non lo '
      + 'riazzerava nessuno** — non la valutazione, non la visita, non uno script: cercato in tutto il '
      + 'backend e in `prisma/`. Quindi il via libera clinico, per il cliente, non cambiava '
      + '**assolutamente niente**, e sarebbe restato così per sempre.\n\n'
      + '⚠️ È il caso peggiore fra i possibili: non un errore, non un avviso — due schermate che '
      + 'raccontano due cose diverse alla stessa ora, e quella che il cliente vede è quella sbagliata. '
      + 'Lui aspetta una visita che non serve più; la nutrizionista pensa di aver fatto. Nessuno dei due '
      + 'ha modo di accorgersene se non parlandosi. ⚠️ E la card non aveva **nessun** test: il ramo '
      + '`awaiting_visit` di `menuStatus` non era toccato da niente. È il motivo per cui il difetto è '
      + 'arrivato a una persona invece che a una suite rossa.\n\n'
      + '✅ **La regola adesso sta in un posto solo** (`clients/via-libera-clinico.ts`), e il blocco lo '
      + 'crea lo screening ma a toglierlo è la decisione:\n'
      + '· nessuna decisione → bloccato, non l\'ha guardato nessuno;\n'
      + '· **«Può proseguire»** → libero, e resta libero;\n'
      + '· **«Serve una visita»** → la nutrizionista scrive **entro quando** (campo nuovo, obbligatorio). '
      + 'Fino a quel giorno **compreso** i menu arrivano; dal giorno dopo il percorso si ferma.\n\n'
      + '⚠️ `screeningFlag` **non si tocca**: è un fatto sanitario dichiarato in registrazione, non uno '
      + 'stato da cancellare. Quello che cambia è la risposta alla domanda, non la storia clinica.\n\n'
      + '✅ **E la data arriva a tutti quelli che devono saperla**: nel titolo dell\'attività della coach '
      + '(quindi dentro la push, che parte quando la nutrizionista salva), come **riga di calendario** '
      + 'della coach nel giorno della scadenza (di tutto il giorno, non un appuntamento a un\'ora '
      + 'inventata), nella nota clinica, in scheda cliente, e **al cliente**: un avviso con la data '
      + 'prima che scada, e una card che dice **da quando** e **perché** dopo. Un blocco che non si '
      + 'spiega sembra un guasto.\n\n'
      + '⛔ **La seconda revisione avversariale ha trovato che la prima stesura prometteva e non '
      + 'faceva** — due bloccanti e sei rilievi seri, tutti chiusi:\n'
      + '· il blocco fermava **la card ma non l\'erogazione**: i giorni continuavano a generarsi, il '
      + 'menu restava visibile e nemmeno la card compariva. Ora `deliverIfEligible` si ferma a visita '
      + 'scaduta (i giorni già consegnati non si ritirano: può averci fatto la spesa);\n'
      + '· la riga di calendario **non è mai comparsa**: filtrava le attività per stati che non '
      + 'esistono (`open/in_progress`; i veri sono `todo/done/skipped`) e il test asseriva la stessa '
      + 'stringa sbagliata. Ora legge il **profilo** (`serve_visita` + data), che è anche più giusto: '
      + 'l\'attività si chiude quando la visita è fissata, il blocco cade solo quando la nutrizionista '
      + 'rivaluta, e fra i due momenti la scadenza è ancora vera;\n'
      + '· le scadenze sarebbero finite **nell\'agenda della cliente** («Fissa la visita per Anna» '
      + 'alle 02:00, come prossimo appuntamento): ora entrano solo col flag che passa il calendario '
      + 'dello staff;\n'
      + '· la `dueDate` dell\'attività era diventata la scadenza clinica (fino a 180 giorni): '
      + 'l\'escalation al manager sarebbe scattata **dopo** il blocco dei menu invece del giorno dopo '
      + 'l\'inerzia, e l\'attività finiva in fondo all\'elenco. Tornata a «domani»; la scadenza della '
      + 'visita viaggia nel titolo e in calendario;\n'
      + '· l\'avviso in app sulla pagina Menu stava in un ramo **irraggiungibile**; il promemoria '
      + 'usciva anche su piani scaduti («i menu arrivano normalmente» sotto «il tuo piano è '
      + 'terminato»); la scadenza salvata si rileggeva nel fuso invece che com\'è scritta (un giorno '
      + 'di scarto con un `APP_TIMEZONE` a ovest); e i due campi nuovi non erano provati da niente — '
      + 'due mutazioni sopravvivevano a 4783 test. Tutto chiuso e rimutato.\n\n'
      + '⚠️ **Lo script-toppa è stato buttato**: per lanciarlo su Render serviva comunque un rilascio, '
      + 'cioè non faceva risparmiare niente — e spegnendo `screeningFlag` avrebbe **zittito anche il '
      + 'guardrail del motore**, prendendo da solo la decisione clinica che la voce '
      + '`motore-dopo-il-via-libera` lascia a Lucia. Il caso urgente si è risolto con una riga di SQL '
      + 'dalla shell (Gianluca, 23/8) — con lo stesso effetto collaterale sul motore, segnato per il '
      + 'ripristino post-rilascio.\n\n'
      + '⚠️ **Il confine è un GIORNO, letto nel fuso di Roma.** «Entro il 30» vuol dire che il 30 si '
      + 'mangia (scelta di Simone). Con un confronto fra istanti — la scadenza salvata `…T00:00:00Z` '
      + 'contro adesso — il blocco sarebbe scattato **due ore prima** della mezzanotte vera, cioè un '
      + 'giorno di menu tolto a qualcuno. Provato alle 00:30 e in ora solare.\n\n'
      + '⚠️ **Cosa resta fuori, e perché**: il guardrail del motore (voce `motore-dopo-il-via-libera`, '
      + 'domanda per Lucia) e le `serve_visita` scritte prima di oggi, che senza data restano bloccanti '
      + '— dare loro una finestra aperta vorrebbe dire sbloccare a posteriori delle persone che nessuno '
      + 'ha più guardato.\n\n'
      + '4791 test verdi (303 suite) alle due ore, 113 backoffice, 165 app; ogni pezzo verificato per '
      + 'mutazione — compresi i due che alla prima stesura non lo erano. ⚠️ **Porta una migrazione** '
      + '(`idoneita_visita_entro`, additiva). ⚠️ **Dopo il rilascio**: rimettere `screening_flag = true` '
      + 'al cliente sbloccato a mano il 23/8.',
  },
  {
    chiave: 'mai-valutata-eroga-lo-stesso',
    categoria: 'Da fare — prodotto',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T16:40',
    fatta: true,
    titolo: '✅ Una cliente in screening MAI valutata riceve i menu lo stesso — Simone ha deciso: si prosegue, e Vera chiede a Lucia ogni 7 giorni',
    dettaglio:
      'Scoperto per caso chiudendo il via libera clinico (23/8): il cancello sull\'**erogazione** per '
      + 'il percorso supervisionato **non è mai esistito**. `deliverIfEligible` non ha mai guardato '
      + '`screeningFlag`: il «Menu dopo la visita» viveva solo nella card dell\'app, e i giorni si '
      + 'generavano comunque — la card compariva di rado **proprio perché i menu c\'erano** '
      + '(`menuStatus` risponde «disponibile» appena trova un menu visibile, e il ramo del percorso '
      + 'supervisionato viene dopo). Quindi: mangia, e nessuno la sta guardando.\n\n'
      + '✅ **Risposta di Simone, 25/8**: *«Se il cliente è supervisionato va mandata notifica a Lucia '
      + 'di controllarlo ogni 7 giorni attraverso Vera. Se dichiara patologie il nutrizionista dalla '
      + 'scheda decide se fissare un appuntamento ed entro quando; se dice, esempio, appuntamento il '
      + 'mese prossimo, nel frattempo il paziente procede.»* ⛔ Cioè **non si chiude niente**: il '
      + 'rimedio al «nessuno la sta guardando» non è fermare la cliente — è far arrivare la domanda a '
      + 'chi deve rispondere, e continuare a farla arrivare finché non risponde.\n\n'
      + '✅ **Consegnato il 25/8**: `clients/promemoria-supervisione.ts` (puro, 14 test) decide se una '
      + 'domanda va aperta oggi; il passo notturno `supervisione` del cron la apre su Vera e la '
      + '**riapre ogni 7 giorni** finché una decisione non c\'è. ⚠️ L\'idempotenza è sulla '
      + '**finestra** e non sul giorno: il cron può girare due volte la stessa notte e la domanda '
      + 'resta una, ma la settimana dopo torna — una domanda senza risposta non deve spegnersi. Il '
      + 'testo dice **da quanti giorni aspetta**, che **nel frattempo la cliente mangia**, e le due '
      + 'strade concrete («Può proseguire» / «Serve una visita entro il…»): una domanda che dice «c\'è '
      + 'una cliente in screening» è una notifica, una che dice cosa fare si chiude in trenta secondi. '
      + 'Il passo è in `config_param` (`supervision_reminder_days`, 7), non nel codice.\n\n'
      + '⚠️ **`npm run diag:supervisione`** dice quante sono adesso, in che stato, e da quanto aspetta '
      + 'chi aspetta di più: «ogni 7 giorni una domanda» è un buon rimedio con dieci persone e un '
      + 'rumore di fondo con duecento, e la differenza non si indovina. ⛔ Se lì compare un numero a '
      + 'tre cifre, il problema non è il promemoria: è che qualcosa non si sta lavorando.',
  },
  {
    chiave: 'motore-dopo-il-via-libera',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T15:10',
    fatta: true,
    titolo: '✅ Dopo il «può proseguire» il motore prosegue — e ogni 7 giorni Vera ricorda a Lucia di guardare',
    dettaglio:
      'Col via libera clinico del 23/8 il gate del menu chiede **la decisione** e non lo screening: una '
      + 'cliente con «Può proseguire» riceve i menu. ⚠️ Ma `engine.service.checkGuardrails` era rimasto '
      + 'com\'era: leggeva `screeningFlag` **da solo**, e quel campo non lo riazzera nessuno — non la '
      + 'valutazione clinica, non la visita, non uno script (cercato in tutto il backend e in '
      + '`prisma/`). Quindi per quella cliente il motore continuava a non decidere in autonomia **per '
      + 'sempre**, e la nutrizionista era convinta di averla sbloccata: lo stesso difetto del 23/8, '
      + 'visto dall\'altra porta.\n\n'
      + '✅ **Risposta di Simone, 25/8**: *«il motore prosegue facendo un promemoria ogni 7 giorni a '
      + 'Lucia di controllare la situazione»*.\n\n'
      + '✅ **Consegnato il 25/8**: il guardrail passa da `statoSupervisione` invece che dal flag, e si '
      + 'apre **solo sul via libera**. ⛔ Gli altri due stati restano fermi, di proposito: **mai '
      + 'valutata** (nessun clinico l\'ha ancora guardata: che i menu vadano avanti non vuol dire che '
      + 'un motore possa cambiarle le calorie prima che qualcuno legga cosa ha dichiarato) e **serve '
      + 'una visita** (una nutrizionista ha guardato e ha detto che serve: il motore non prende il '
      + 'posto della visita che lei ha chiesto). ⚠️ Le due sbagliano in versi opposti, ed è il criterio '
      + 'con cui è stata scelta la riga: un guardrail chiuso di troppo costa **una decisione in più** '
      + 'alla nutrizionista, uno aperto di troppo costa un cambio di calorie deciso da un motore su '
      + 'una persona che nessuno ha valutato.\n\n'
      + '⚠️ Il promemoria che accompagna la decisione è lo stesso della voce '
      + '`mai-valutata-eroga-lo-stesso`: un passo del cron notturno che apre una domanda su Vera e la '
      + 'riapre ogni 7 giorni finché la decisione non c\'è.',
  },
  {
    chiave: 'chat-si-aprono-sull-ultimo-messaggio',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-23T14:30',
    titolo: '✅ Tutte le chat, Gaia e Vera comprese, si aprono sull\'ultimo messaggio',
    dettaglio:
      'Richiesta di Simone, 23/8: aprendo una conversazione si parte dal **primo** messaggio e bisogna '
      + 'scorrere fino in fondo per vedere l\'ultimo. Vale per tutte: la chat con la coach, quella con '
      + 'la nutrizionista, Gaia nell\'app e Vera nel backoffice.\n\n'
      + '⚠️ È il difetto che si nota di più man mano che una conversazione cresce: alla decima riga è '
      + 'un fastidio, alla centesima la chat sembra ferma a mesi fa. E chi risponde da telefono si '
      + 'trova a scorrere prima di poter leggere la domanda a cui deve rispondere.\n\n'
      + '⚠️ Da fare in **un posto solo** se possibile: oggi le liste di messaggi sono almeno quattro '
      + 'componenti diversi, e quattro copie della stessa riga di scorrimento sono quattro punti in cui '
      + 'domani una si comporta diversamente dalle altre.\n\n'
      + '✅ **CHIUSA il 25/8, dopo aver misurato invece di supporre**: tre delle sei liste scorrevano '
      + 'già. Quella che non scorreva **affatto** era la card «Conversazioni» in scheda cliente — cioè '
      + 'proprio dove una coach apre la chat di una cliente per rispondere, e doveva scorrere tutto per '
      + 'arrivare alla domanda.\n\n'
      + '⚠️ **Un posto solo per progetto** (`lib/scorri-in-fondo.ts`, gemelli in app e back office: '
      + 'sono due build separate, senza un pacchetto in comune). ⛔ E si sposta la **scatola** '
      + '(`scrollTop = scrollHeight`), non `scrollIntoView` su un segnaposto: quello scorre anche tutti '
      + 'gli antenati, e dentro una pagina lunga come la scheda cliente avrebbe fatto saltare la pagina '
      + 'intera. Dove invece è la pagina a scorrere — Gaia a schermo pieno, la chat della coach in app '
      + '— `scrollIntoView` resta, ed è scritto perché.\n\n'
      + '⚠️ Due rilievi della revisione: il segnaposto vecchio andava **tolto** (con la stessa ref '
      + 'attaccata a due nodi, React tiene l\'ultimo — un div alto zero — e lo scorrimento moriva in '
      + 'silenzio); e nel foglio dell\'app la dipendenza era il **numero** dei messaggi, quindi '
      + 'passando da Gaia alla coach con dodici messaggi ciascuna la lista restava a metà.\n\n'
      + '⛔ **RIAPERTA E RICHIUSA IL 31/8**, con due schermate di Simone: la pagina dell\'assistente si '
      + 'apriva su messaggi del **26/8** mentre la conversazione finiva il **31/8 alle 09:39**. Il codice '
      + 'per scorrere c\'era da sei giorni, ed è per questo che la voce era stata chiusa: **c\'era e non '
      + 'serviva a niente**.\n\n'
      + '⚠️ La causa è una riga che non c\'entra con lo scorrimento: `if (loading) return <Spinner />`. '
      + 'Chi carica scrive prima i messaggi e spegne il caricamento **dopo** (in mezzo c\'è un secondo '
      + '`await`, il registro): nel disegno in cui i messaggi arrivano al posto della scatola c\'è ancora '
      + 'la rotellina, il `ref` è `null`, e l\'effetto scorre il nulla. Quando la scatola compare '
      + 'l\'effetto non riparte, perché i messaggi non sono cambiati.\n\n'
      + '⛔ La lezione, che vale oltre le chat: **una lista che si apre in cima non è la prova che manchi '
      + 'il codice per scorrerla.** Il rimedio non è aggiungere `loading` alle dipendenze pagina per '
      + 'pagina — è non dipendere più dal momento: `agganciaInFondo` scorre **quando la scatola si '
      + 'attacca**, che è l\'istante in cui esiste per certo. La scheda cliente si allinea per prudenza '
      + 'e non per un incidente: lì i due aggiornamenti cadono nello stesso disegno, ma dipende da come '
      + 'React raggruppa — e basta un `await` in più, un domani, perché diventi la pagina '
      + 'dell\'assistente.',
  },
  {
    chiave: 'orologio-numeri-tagliati',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-23T08:05',
    titolo: '✅ Nell\'orologio del digiuno i numeri delle ore si vedono a metà — corretto',
    dettaglio:
      'Segnalato dalla capo nutrizionista il 23/8 alle 08:05, con la schermata: *«non si vedono i numeri '
      + 'dell\'orologio»*. Nello screenshot il **00** in cima è tagliato a metà, il **12** in basso '
      + 'idem, e quelli ai lati (`6`, `18`) escono solo in parte — si legge «8» e «0(».\n\n'
      + '⚠️ Non è solo estetica: i numeri sono l\'unica cosa che dice **a che ora** corrisponde il punto '
      + 'del cerchio in cui si trova la lancetta. Senza, il disegno mostra «quanto manca» ma non «quando», '
      + 'e la finestra 12:00–20:00 scritta sotto resta l\'unico riferimento vero — cioè l\'orologio non '
      + 'sta facendo il suo lavoro.\n\n'
      + 'Probabilmente è il `viewBox` dell\'SVG che sta stretto sul cerchio senza lasciare margine alle '
      + 'etichette, oppure un `overflow: hidden` del contenitore. Si guarda in `app/src/components/OrologioDigiuno.tsx`.\n\n'
      + '✅ **CHIUSA il 25/8, ed era la prima ipotesi**: il `viewBox` era `0 0 260 260` mentre le '
      + 'etichette vivono a raggio **128** dal centro. Il «00» in cima cadeva a y = 2, cioè con mezzo '
      + 'glifo fuori dal riquadro; il «12» in basso a 262; il 6 e il 18 ai lati a x = 2 e 258, tagliati '
      + 'nel senso della larghezza. Adesso il riquadro ha **14 unità di aria per lato** e la larghezza '
      + 'sullo schermo cresce con lui, così il cerchio non rimpicciolisce (nella miniatura della home '
      + 'le etichette non si disegnano nemmeno: sarebbe stato spazio pagato per niente).\n\n'
      + '⛔ **E la metà che si dimentica**: il quadrante si TRASCINA, e la conversione dito → disegno '
      + 'partiva da zero. Allargando il riquadro senza toccarla, il dito si sarebbe spostato di 14 '
      + 'unità su un anello spesso 16 — cioè la cliente trascina e la finestra non si muove, o si '
      + 'muove storta. ⚠️ Le misure sono state portate in `app/src/lib/orologio.ts` **perché si '
      + 'possano provare**: i test dell\'app girano senza DOM, e un numero chiuso in un `.tsx` non lo '
      + 'esegue nessuno — che è esattamente il motivo per cui quel taglio è arrivato a una persona '
      + 'vera invece che a un test rosso. Adesso 11 test guardano il glifo dentro il riquadro e la '
      + 'conversione del tocco (quella vera, non una sua copia scritta nel test — lo aveva rilevato la '
      + 'revisione).',
  },
  {
    chiave: 'digiuno-ore-troppo-facili-da-cambiare',
    categoria: 'Da fare — prodotto',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T08:05',
    fatta: true,
    titolo: '✅ Le ore del digiuno si cambiano una volta a settimana — e la nutrizionista può correggerle da Vera',
    dettaglio:
      'Segnalato dalla capo nutrizionista il 23/8: *«dovrebbe essere più difficile modificare le ore '
      + 'per digiunare, così puoi ogni giorno modificarlo»*. Le cinque durate (14:10, 16:8, 18:6, '
      + '20:4, 23:1) erano cinque pulsanti, e la cliente poteva passare dall\'una all\'altra quando '
      + 'voleva. ⚠️ Un protocollo cambiato ogni giorno non è un protocollo, e i numeri che la '
      + 'nutrizionista guarda per capire se sta funzionando diventano la media di cinque cose '
      + 'diverse.\n\n'
      + '✅ **Le tre domande, risposte da Simone il 25/8**: *«Sì, posso cambiare solo una volta a '
      + 'settimana; per cambi ulteriori va richiesto al nutrizionista — attraverso Vera il '
      + 'nutrizionista può correggere.»*\n\n'
      + '✅ **Consegnato il 25/8.** (1) Il limite vale sul **protocollo**, non sullo spostamento della '
      + 'lancetta: le ore sono un fatto clinico, spostare la finestra di un\'ora perché stasera si '
      + 'cena fuori non lo è, e lì resta il limite di uno al giorno che c\'era già. ⛔ Colonna nuova '
      + '(`fasting_protocol_changed_at`) e non `fastingChangedAt`: riusando quella, spostare la '
      + 'finestra di mezz\'ora avrebbe bloccato le ore per una settimana — un limite che scatta su un '
      + 'gesto che non c\'entra è un limite che nessuno capisce. (2) Il rifiuto dice **da quando** si '
      + 'può rifare **e** che la nutrizionista lo fa subito: questa voce avvertiva che *«un attrito '
      + 'messo male fa sembrare l\'app una cosa che non ti lascia fare»*, e un divieto che offre una '
      + 'strada è una spiegazione, uno che non ne offre è un muro.\n\n'
      + '⛔ **E la strada è stata costruita, perché non c\'era.** Dal 21/8 la tendina della finestra è '
      + 'fuori dalla scheda staff — la finestra la deriva l\'orologio della cliente — e in tutto il '
      + 'backend **nessuno** poteva cambiare il protocollo di qualcun altro. Mettere il limite senza '
      + 'aprire la porta avrebbe mandato una cliente da una persona che non può farci niente: un '
      + 'cancello chiuso, con in più una frase che le fa credere il contrario. Adesso da **Vera**: '
      + '*«metti Giulia a 18:6»*, *«passala su avanzato»*, *«cambia il digiuno di Giulia»* (e se non '
      + 'dice a quale, si chiede). L\'anteprima mostra **le ore in chiaro e quanti pasti** avrà la '
      + 'sua giornata — «23:1» è un codice, «un pasto solo al giorno» è la cosa che si sta decidendo '
      + '— e la scrittura passa dalle **stesse due funzioni** della cliente (`decidiCambio` e '
      + '`scriviLOrologio`), estratte apposta: una seconda stesura avrebbe messo le ore nuove e '
      + 'lasciato i pasti di prima.\n\n'
      + '⚠️ **Quello che la nutrizionista scavalca sono i LIMITI, non la realtà**: se la finestra di '
      + 'oggi si è già aperta, le ore nuove partono da domani anche per lei — la cliente ha già '
      + 'mangiato con quelle di stamattina, e disfare un pasto fatto è la cosa che questo modulo '
      + 'promette di non fare da quando esiste. E l\'audit dice **chi ha agito**: senza, il registro '
      + 'avrebbe raccontato che la cliente ha cambiato le sue ore da sola proprio nel caso in cui non '
      + 'poteva farlo.\n\n'
      + '⚠️ La soglia è in `config_param` (`fasting_protocol_change_days`, 7): Lucia può portarla a 14 '
      + 'senza un rilascio. ⚠️ **L\'ORARIO non si detta a Vera**, ed è una scelta: dove sta la '
      + 'finestra nella giornata di una persona — quando lavora, quando cena — lo sa lei, e lo sposta '
      + 'dall\'app.',
  },
  {
    chiave: 'pesata-strana-chiedi-conferma',
    categoria: 'Da fare — prodotto',
    ordine: 4,
    nata: '2026-08-28T11:40',
    fatta: true, // chiusa il 3/9
    titolo: 'Quando digita un peso che non torna, l\'app non le chiede niente',
    dettaglio:
      '✅ **CHIUSA il 3/9.** Il guardrail sulle pesate impossibili c\'era dal 28/8, ⚠️ ma agiva tutto '
      + '**dopo**: il numero si salvava, il fabbisogno si sospendeva, e per riparare un tasto premuto male '
      + 'serviva una telefonata della coach. Adesso la domanda si fa **mentre il numero si scrive**, che è '
      + 'il momento in cui lo stesso errore costa un tocco.\n\n'
      + '✅ **La domanda**: «La pesata che abbiamo prima di questa è del 26/08/2026: eri 73 kg. Hai scritto '
      + '113 kg: sono 40 kg in 8 giorni. È giusto?», con **Sì, è giusto** e **Correggo**. ⛔ **Non è un '
      + 'cancello**, in nessun ramo: se dice sì il numero si salva identico e il guardrail fa il suo giro '
      + 'come prima; se la rotta cade, tarda oltre cinque secondi o risponde storto, si salva e basta. *Una '
      + 'cliente non deve restare fuori dalla sua app perché una rotta di cortesia è caduta.*\n\n'
      + '✅ **Tutt\'e tre le porte da cui si scrive un peso**: l\'invio e la correzione in «Il tuo obiettivo», '
      + 'e — ⚠️ la più a rischio, trovata in revisione — il **muro delle misure** («App in pausa», «Serve la '
      + 'tua pesata»), cioè il punto in cui digita di fretta per far ripartire il menu. Più il modale '
      + '«Correggi misura» del backoffice, dove la porta accetta 25–400 kg ed è quindi il punto in cui una '
      + 'pesata impossibile può *nascere*, dalle mani di chi la sta sistemando.\n\n'
      + '✅ **La regola resta una sola**: `backend/src/signals/pesata-da-confermare.ts` chiama '
      + '`saltiImpossibili` di `peso-incoerente.ts` con le soglie dei Parametri, e ai frontend arriva la '
      + '**frase già fatta** — nessuna soglia nel browser, altrimenti la schermata direbbe «va bene» un '
      + 'istante prima che il guardrail apra la segnalazione. ⛔ E **non è il browser a dire che la domanda '
      + 'è stata fatta**: niente `confermato: true` al salvataggio, perché un browser lo può affermare '
      + 'sempre e la segnalazione direbbe al nutrizionista una ragione falsa.\n\n'
      + '⛔ **Tre cose trovate dalla revisione, e vanno scritte perché erano tutt\'e tre pronte a partire.** '
      + '1) `pesoIncoerente` è il salto **peggiore dei novanta giorni**, non quello appena scritto: il '
      + 'riquadro «questa pesata è lontana dalle precedenti» sarebbe uscito a **ogni pesata normale per tre '
      + 'mesi** dopo una coppia rotta — anche già guardata e chiusa — e per tutto quel tempo avrebbe coperto '
      + 'l\'allarme del calo rapido. Ora c\'è `pesateDaVerificare`, che dice se il salto tocca la riga '
      + 'appena scritta. 2) `fetch` non ha un timeout suo: una richiesta **appesa** (non fallita: appesa, il '
      + 'modo più comune in cui una rete mobile smette di funzionare) teneva `busy`, e `busy` spegne anche '
      + 'le caselle — campi grigi per il timeout di sistema, senza poter salvare né correggere. Ora c\'è un '
      + 'tetto di cinque secondi. 3) Nel «Cambia misure» si poteva scrivere 73, aprire il «Sei sicuro?», '
      + 'cambiare in 113 e premere «Sì, sostituisci»: il 113 passava con una conferma data su un altro '
      + 'numero. Adesso ricontrolla il punto che scrive.\n\n'
      + '⚠️ E la frase alla cliente **non dice «l\'ultima volta che ti sei pesata»**: esce anche mentre '
      + 'corregge la pesata di oggi, e lì l\'ultima volta che si è pesata è stamattina. ⚠️ Sotto i 35 kg e '
      + 'sopra i 250 non si chiede niente, perché il DTO dirà comunque di no: chiedere conferma e poi '
      + 'smentirla è il modo peggiore di contraddirsi.\n\n'
      + '25 prove di mutazione, tutte prese.',
  },
  {
    chiave: 'target-sospeso-chi-non-lo-sa',
    categoria: 'Da fare — codice',
    ordine: 4,
    nata: '2026-08-28T12:10',
    fatta: true, // chiusa il 28/8
    titolo: 'Tre punti mostrano un target calorico che il motore non sta usando',
    dettaglio:
      '✅ **CHIUSA il 28/8, il giorno stesso in cui è nata.** Dal blocco sulle pesate incoerenti il '
      + 'fabbisogno può essere **sospeso**: `computeTargetKcal` risponde `null` e i menu usano il livello '
      + 'della dieta. ⚠️ Il calcolo però continua a produrre un target, e tre punti lo mostravano — o lo '
      + 'scrivevano — come se fosse quello nel piatto.\n\n'
      + '✅ **1) Vera che giudica una giornata dettata** (`anteprimaGiornata`): prendeva `prima.target` e ci '
      + 'misurava contro il ±15%, cioè rispondeva «ci sta dentro» con un metro che non è quello servito. '
      + 'Adesso **non giudica e non scrive**, e dice **quali** pesate non tornano — un «non posso» senza il '
      + 'come è un vicolo cieco per chi quella pesata la correggerebbe in trenta secondi.\n\n'
      + '✅ **2) L\'anteprima della correzione kcal**: diceva «il suo target passa da 1620 a 1460» e chiedeva '
      + 'conferma. Adesso avvisa che oggi quei due numeri non sono nel piatto — ⚠️ e lascia confermare lo '
      + 'stesso: la prescrizione è valida e varrà quando le pesate saranno sistemate. Sospendere anche la '
      + 'scrittura sarebbe stato togliere una cura per un problema di dati.\n\n'
      + '✅ **3) `impostaKcal`, che SCRIVE**: il rifiuto sotto soglia diceva «il menu scenderebbe a X '
      + 'kcal/giorno» — falso, non ci scende, perché non sta usando quel numero; e `targetPrima`/'
      + '`targetDopo` finivano nello storico clinico senza dire che quel giorno non contavano. Adesso lo '
      + 'dicono il rifiuto, il motivo dello storico, la nota in scheda e la risposta a chi ha premuto '
      + '(compresa la coda del motore).\n\n'
      + '⛔ **E una quarta cosa, trovata mentre si sistemavano le altre tre**: l\'anteprima di Vera chiamava '
      + '`simulaKcal(..., null, pct)` — e `null` vuol dire «togli il deficit». Mostrava il «dopo» **senza il '
      + 'deficit imposto dal nutrizionista**, cioè un numero più alto del vero, proprio per farlo '
      + 'confermare. Adesso passa `undefined`, che è «non lo sto nominando», e c\'è un test che lo tiene '
      + 'fermo.\n\n'
      + '⛔ **E il secondo giro di revisione ne ha trovati altri due, chiusi anche quelli.** (a) La '
      + '**segnalazione clinica** e la **notifica ai capi** che partono quando si scende sotto soglia '
      + 'dicevano «900 kcal/giorno» su una cliente che quel giorno mangiava il livello della sua dieta — su '
      + 'un canale che sveglia un capo nutrizionista. (b) Vera, **dopo il sì**, buttava via la risposta di '
      + '`impostaKcal` e chiudeva con «Fatto: scende a 1460 kcal al giorno»: l\'ultima frase smentiva '
      + 'l\'avviso di trenta secondi prima, e il registro archiviava la stessa coppia prima/dopo senza '
      + 'marcatore mentre lo storico delle calorie la marcava.\n\n'
      + '⛔ **E una promessa che era falsa, riscritta invece che aggiustata di nascosto.** Dicevamo «varrà '
      + 'quando le pesate saranno sistemate»: ⚠️ la scadenza di una correzione a termine si calcola **da '
      + 'oggi** e non si sposta, quindi «−10% per 7 giorni» su una cliente sospesa può **scadere senza '
      + 'essere mai stata applicata**. Spostare la scadenza da soli sarebbe allungare una prescrizione '
      + 'clinica: si dice a chi la scrive, che può scriverla senza durata o far correggere prima la pesata. '
      + '✅ **E l\'altra metà è stata chiusa davvero**: correggere una pesata dal backoffice adesso **rifà i '
      + 'giorni futuri** (prima non li rifaceva nessuno), quindi appena la pesata sbagliata è sistemata la '
      + 'correzione arriva nel piatto.\n\n'
      + '⛔ **E un difetto ereditato, vivo e fondante**: `impostaKcal` distingueva «non l\'ho scritto» da '
      + '«toglilo» con `\'deficitKcal\' in input`. ⚠️ Con `target: ES2023` i campi del DTO diventano '
      + 'proprietà proprie dell\'istanza: **via HTTP la chiave c\'è sempre**, col valore `undefined`. Cioè '
      + 'la correzione della consegna precedente era vera solo per i test, che passano oggetti letterali. '
      + 'Adesso il confine è `!== undefined`, che si comporta allo stesso modo nei due mondi.\n\n'
      + '⚠️ **Quello che NON è stato toccato, e perché**: la barra «verso il tuo obiettivo» che vede la '
      + 'cliente in app, e il «−X kg dal via». Sono calcolati sulla stessa media, quindi su pesate '
      + 'contraddittorie dicono una cosa non vera — ma sono **la sua storia**, non una decisione clinica, e '
      + 'nascondergliela per un errore di battitura sarebbe punire lei di un problema nostro. La strada '
      + 'giusta è chiederle conferma **quando digita**, che è la voce `pesata-strana-chiedi-conferma`.'
  },
  {
    chiave: 'taglia-catalogo-due-silenzi',
    categoria: 'Da fare — codice',
    ordine: 6,
    nata: '2026-08-28T12:10',
    fatta: true, // chiusa il 28/8
    titolo: 'Il dimensionamento del catalogo non distingue «non lo so» da «non mi fido»',
    dettaglio:
      '✅ **CHIUSA il 28/8, il giorno stesso in cui è nata.** `tagliaPerIlCatalogo` chiama il fabbisogno '
      + 'su tutte le clienti di quella taglia e ne fa la **mediana**; le risposte vuote cadevano fuori in '
      + 'silenzio. ⚠️ E da oggi le ragioni sono **due**: mancano sesso, età, altezza o un peso da cui '
      + 'partire, oppure le pesate di quella cliente non stanno in piedi fra loro e il fabbisogno è '
      + '**sospeso**. Con poche clienti per taglia la mediana si sposta e nessuno lo sa — *un dato che '
      + 'agisce e non si vede*.\n\n'
      + '✅ Adesso il log dice le due cose **separate** («2 senza i dati del profilo, 1 con le pesate da '
      + 'verificare, su 14»), perché portano a due gesti diversi: completare un profilo, oppure andare a '
      + 'correggere una pesata. Un numero solo manda a fare la cosa sbagliata su metà delle clienti. ⚠️ E '
      + 'quando non cade fuori nessuno non si scrive niente: *un avviso che compare sempre non è un '
      + 'avviso*.\n\n'
      + '⛔ **E qui la prima stesura di questa voce diceva una cosa falsa, smentita dalla revisione.** '
      + 'Diceva «la cliente col fabbisogno sospeso non pesa **più** sulla mediana»: non ci pesava già '
      + 'prima, perché `computeTargetKcal` rispondeva `null` anche su di lei. **La mediana non cambia di un '
      + 'kcal**, e l\'unica cosa che questa voce cambia davvero è la riga di log. ⚠️ Spacciare per '
      + 'correzione un comportamento che c\'era già è il modo in cui un verbale di lavoro smette di valere. '
      + 'La regola di escluderle però adesso è **riscritta qui** (passando da `computeTargetKcal` a '
      + '`estimate`), quindi qui va tenuta ferma: c\'è un test che lo fa.\n\n'
      + '⚠️ E un **errore di lettura** si conta a parte, non fra i profili incompleti: mandare qualcuno a '
      + 'completare un profilo che è già completo è una ragione falsa proprio nella riga che esiste per '
      + 'dare la ragione giusta.\n\n'
      + '⚠️ **Non costa una query in più**: si chiama `estimate` invece di `computeTargetKcal`, che è lo '
      + 'stesso metodo più due controlli. Cambia solo che la risposta si legge intera, invece di buttarne '
      + 'via la metà che dice perché.'
  },
  {
    chiave: 'pesate-lontane-buco-del-ritmo',
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    fatta: false,
    nata: '2026-08-28T10:10',
    titolo: '▶️ Al rientro si riparte dal peso di prima (fatto): resta la soglia d\'allarme, che è clinica',
    dettaglio:
      'Il guardrail sulle pesate impossibili chiede **due condizioni insieme**: salto ≥ 10 kg **e** '
      + 'ritmo ≥ 7 kg/settimana. Quindi venti chili sbagliati dopo **venticinque giorni** senza '
      + 'pesarsi fanno 5,6 kg/settimana e **non scattano** — ed è proprio la cliente del kit di '
      + 'rientro, quella che sospende, sta ferma un mese e torna.\n\n'
      + '✅ **RISPOSTA DI SIMONE, 3/9: «Quando uno rientra noi consideriamo sempre il peso del giorno '
      + 'prima dell\'inizio di quel momento e non dei piani precedenti».**\n\n'
      + '✅ **Fatto, ed è una cosa diversa da quella che questa voce chiedeva.** Il fabbisogno non '
      + 'media più le pesate del rientro con quelle dei piani precedenti: la media si fa sulle sole '
      + 'pesate del periodo nuovo, quante che siano, e finché non ce n\'è nessuna vale il '
      + '**riferimento** — l\'ultima pesata prima di quel momento, alla lettera. '
      + '(`signals/peso-al-rientro.ts`, `signals/quando-comincia-il-periodo.ts`.)\n\n'
      + '⛔ **«Rientro» vuol dire una SOSPENSIONE VERA, e la prima stesura sbagliava.** Ci aveva '
      + 'messo dentro anche `planStartDate`, che **si riscrive a ogni rinnovo dalla coda**: la '
      + 'regola si sarebbe accesa su ogni cliente in rinnovo continuo, che non è rientrata da '
      + 'niente. ⚠️ *Un rinnovo non è un rientro.* Adesso conta solo la fine di una sospensione da '
      + '**vacanza** (`mode: pause_period` **e** `type: vacation`), e le pause **annullate** non '
      + 'contano — togliendo una sospensione in corso l\'evento non si cancella, si accorcia a ieri, '
      + 'e da fuori somiglia a una appena finita. Sono tutte e due lezioni già scritte in '
      + '`pause.service.ts`, e le ho dovute reimparare.\n\n'
      + '⛔ **E UNA REGOLA CHE SIMONE NON HA DETTO ERA FINITA NEL CODICE.** La prima stesura, sotto '
      + 'tre pesate dal rientro, passava dalla media all\'**ultima pesata** — legando un '
      + 'comportamento clinico alla casella `moving_average_window`, che è una taratura di '
      + 'smoothing e si muove per ragioni sue. L\'ha smontata una revisione avversariale. *Se una '
      + 'regola non è stata detta, non si scrive.*\n\n'
      + '▶️ **QUELLO CHE RESTA APERTO, ed è il motivo per cui questa voce non si chiude.** La '
      + 'risposta di Simone dà il **riferimento**, non una **soglia d\'allarme**. Una prima stesura '
      + 'aveva aggiunto un secondo ramo che giudicava il salto attraverso un rientro sul solo salto '
      + 'in chili, dicendosi «nessuna soglia nuova: riuso quella dei Parametri». ⛔ Non era vero: '
      + 'togliere la condizione sul ritmo **è** cambiare la regola, e `peso-incoerente.ts` scrive '
      + 'per esteso che la versione senza era già stata provata e buttata — *«dieci chili in due '
      + 'mesi suonerebbero, ed è un percorso riuscito, non un errore»*. ⚠️ E il fabbisogno sarebbe '
      + 'diventato `null` **senza che nessuno lo sapesse**: la coda della coach e la segnalazione al '
      + 'nutrizionista leggono `saltoPeggiore`, non quel ramo.\n\n'
      + '**La domanda, adesso stretta, per Nocanty:** *sopra quanti chili, attraverso una '
      + 'sospensione senza pesate in mezzo, si smette di fidarsi del numero?* ⚠️ Serve un numero '
      + 'solo, e va con una seconda decisione: chi lo deve sapere quando scatta — perché oggi quel '
      + 'ramo non arriverebbe a nessuno.'
  },
  {
    chiave: 'kit-rientro-quale-peso',
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-28T10:00',
    titolo: '✅ Il kit di rientro riporziona sull\'ultima pesata, come il suo trigger',
    dettaglio:
      'Il kit di rientro partiva quando **l\'ultima pesata** superava il riferimento di N chili, e '
      + 'le giornate copiate venivano riporzionate sul **fabbisogno**, che dal 27/8 si calcola sulla '
      + '**media mobile**. Due numeri diversi nella stessa esecuzione, sulla stessa persona, nello '
      + 'stesso istante.\n\n'
      + '✅ **RISPOSTA DI SIMONE, 3/9: «Sì esatto»** — la strada b: anche le porzioni partono '
      + 'dall\'ultima pesata.\n\n'
      + '✅ **Fatto**: `generateRientroMenus` chiama `computeTargetKcal(clientId, '
      + '{ sullUltimaPesata: true })`. ⚠️ La porta è **esplicita e sta fuori da `simulazione`**: '
      + 'quell\'oggetto è per le anteprime del backoffice — «chi simula lo vede, chi decide no» — e '
      + 'infilarci una scrittura avrebbe reso falsa quella riga senza che nessuno se ne accorgesse.\n\n'
      + '⛔ **E il verso dell\'effetto era raccontato al contrario**, in due commenti, finché una '
      + 'revisione avversariale non l\'ha misurato. Il target **non cresce col peso in tutti i '
      + 'regimi**: la derivata è `10·PAL − 1100/settimane`, cioè **negativa** nel regime dominante '
      + '(dimagrimento con obiettivo e data, tetto che non morde) — lì vedere la cliente più pesante '
      + 'vuol dire darle **meno** calorie. Nei regimi a derivata positiva lo scarto vale una '
      + 'ventina di kcal al giorno. ⚠️ Quindi il motivo della correzione è la **coerenza fra trigger '
      + 'e porzioni**, non «porzioni più grandi a chi è risalita»: quella frase era comoda e falsa.\n\n'
      + '⚠️ **Quello che resta aperto, e non è di questa voce**: se il guardrail delle pesate '
      + 'incoerenti scatta, `computeTargetKcal` rende `null` e il kit copia le giornate **senza '
      + 'riporzionarle** — comprese quelle di prima del 18/8, che tornano nel futuro al 65% e non le '
      + 'aggiusta più nessuno. È un difetto preesistente, e va guardato con `riporziona-giornata.ts` '
      + 'davanti.'
  },
  {
    chiave: 'pathtype-non-protetto',
    categoria: CODICE,
    ordine: 5,
    fatta: true, // chiusa il 28/8
    nata: '2026-08-27T22:00',
    titolo: '⛔ Una coach può mettere chiunque a digiuno intermittente: `pathType` non è protetto da nessun permesso',
    dettaglio:
      '✅ **CHIUSA il 28/8.** `pathType` e `mealsPerDay` sono entrati in `DIET_TYPE_FIELDS`, insieme, e '
      + 'quell\'elenco adesso governa **tutte e tre** le cose che stanno in quel punto: il controllo del '
      + 'permesso, la lettura del profilo e il prima/dopo del registro. Erano tre liste scritte a mano che '
      + 'dovevano restare d\'accordo, ed è la forma in cui i buchi come questo sopravvivono. ⚠️ **Restano '
      + 'fuori il DTO e `PROFILE_FIELDS`**, che da lì non si possono unire: un campo nuovo aggiunto là e '
      + 'non qui sarebbe scoperto uguale. C\'è un test che tiene la direzione che conta (tutto quello che è '
      + 'protetto dev\'essere anche scrivibile) e un rimando scritto nel DTO — il resto è attenzione, e va '
      + 'detto invece che dichiarato risolto.\n\n'
      + '⛔ **E LA PREMESSA DI QUESTA VOCE ERA IMPRECISA, l\'ha trovato la revisione.** Diceva «una coach '
      + 'non può cambiare vegetariana→vegana ma può mettere a digiuno chiunque»: il default del 9/8 dà '
      + '`change_diet_type` **anche a coach e coordinatrice**, proprio perché la coach i pasti li deve '
      + 'poter spostare. Il buco vero era che i due campi stavano **fuori dalla guardia**: li cambiava '
      + 'chiunque potesse aprire la scheda, permesso o no, e per nessuno finivano nel registro o nei menu.\n\n'
      + '⚠️ **Una cosa da guardare prima di considerarla finita**: `syncDefaults` non tocca mai le righe '
      + 'già scritte, quindi in produzione la riga della coach può essere ferma al default vecchio '
      + '(spenta). In quel caso da oggi la coach i pasti non li sposta più — e il 9/8 era stato deciso il '
      + 'contrario. ✅ `npm run diag:permesso-tipo-dieta` (sola lettura) dice chi ce l\'ha davvero e dove '
      + 'il database non è d\'accordo col codice.\n\n'
      + '⚠️ **Due conseguenze volute, e valgono per TUTTI, permesso o no**: cambiare i pasti o il percorso '
      + 'adesso (a) finisce nel registro come cambio di tipo di dieta e (b) **rifà i giorni futuri**. La '
      + 'seconda è una correzione a sé: una '
      + 'cliente portata da cinque pasti a tre si teneva i menu a cinque già consegnati — lo schermo diceva '
      + 'una cosa e il piatto un\'altra. ⚠️ E il messaggio del rifiuto dice **cosa** stava cambiando: '
      + '«Cambiare il tipo di dieta» davanti a una coach che ha appena spostato i pasti sembra un guasto, '
      + 'non un permesso.\n\n'
      + '⚠️ L\'etichetta del permesso nel backoffice adesso nomina i pasti e il digiuno: chi assegna le '
      + 'caselle deve sapere che dietro quella c\'è anche «mettere una cliente a digiuno intermittente».\n\n'
      + '## Com\'era\n\n'
      + '⛔ **Difetto già in produzione, staccato il 27/8 da dove era sepolto.** Stava scritto in fondo alla voce '
      + 'del digiuno, dentro un changelog di quaranta righe: cioè in un posto dove nessuno lo avrebbe mai letto '
      + 'come un lavoro da fare. Un difetto nominato dentro il racconto di un altro lavoro è un difetto che non '
      + 'esiste.\n\n'
      + '⚠️ **Il fatto**: `clients.service.ts` protegge il cambio del tipo di dieta con il permesso '
      + '`change_diet_type`, ma `DIET_TYPE_FIELDS` contiene **solo** `regime`, `dietStyle` e `dietFamily`. '
      + '`pathType` no — ed è il campo che decide se una cliente fa 3 pasti, 5 pasti o **digiuno intermittente**.\n\n'
      + '⛔ **La conseguenza, detta in chiaro:** una coach non può passare una cliente da vegetariana a vegana, '
      + 'ma **può metterla a digiuno intermittente**. Delle tre è la modifica più clinica: cambia quanti pasti '
      + 'mangia al giorno, e il digiuno ha controindicazioni che le altre due non hanno.\n\n'
      + '⛔ **E NON È SOLO `pathType`: `mealsPerDay` ha lo stesso buco.** Il primo decide digiuno sì/no, il '
      + 'secondo decide 3 o 5 pasti — e nessuno dei due è in `DIET_TYPE_FIELDS`. Nominare solo il primo '
      + 'farebbe chiudere metà porta e scrivere «fatto»: chiusa quella, una coach potrebbe comunque portare '
      + 'una cliente da 5 pasti a 3 senza avere il permesso. Vanno insieme, ed è ancora una riga sola.\n\n'
      + '✅ **Misurato il 27/8, e la strada è libera**: `updateClient` ha **tre** chiamanti — il `PATCH` dello '
      + 'staff e i due percorsi di Vera. ⚠️ Il questionario **non** passa da `profile.service` come diceva '
      + 'la prima stesura di questa riga: scrive il profilo per conto suo (`onboarding.service`), e la '
      + 'cliente dall\'app passa da `profile.service.updateProfile`. La conclusione non cambia — '
      + '**aggiungere i due campi a `DIET_TYPE_FIELDS` non può bloccare l\'onboarding** — ma la ragione '
      + 'scritta era sbagliata, ed è quella che il prossimo copia. ⚠️ La prima stesura di questa voce '
      + 'mandava a misurare proprio quella cosa, e faceva sembrare rischiosa una correzione che non lo è — '
      + 'una prudenza inventata costa quanto una sicurezza inventata: tutte e due mandano a guardare dalla '
      + 'parte sbagliata.',
  },
  {
    chiave: 'data-inizio-giorno-o-istante',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T03:20',
    fatta: true, // chiusa il 28/8
    titolo: '`planStartDate` contiene due cose diverse — un giorno o un istante — e dal valore non si distinguono',
    dettaglio:
      '✅ **CHIUSA il 28/8, e non con un\'euristica migliore: facendo dire al campo da dove viene.**\n\n'
      + '⚠️ `planStartDate` conteneva **il giorno scelto** («comincio il 23», dal questionario, dalla matita '
      + 'della scheda, dalla chat con Gaia, da «Conosciamoci») oppure **la scadenza del piano in corso** — un '
      + 'istante, scritto dal ramo della coda dell\'approvazione bonifico. ⛔ L\'euristica del 23/8 '
      + '(«mezzanotte UTC esatta = un giorno») era stata **provata e buttata**: la scadenza di un piano '
      + 'partito da un giorno produce **proprio** mezzanotte UTC esatta, quindi sbagliava sul caso più '
      + 'comune di tutti e faceva nascere piani `active` con la partenza nel futuro — invisibili al giro '
      + 'che promuove le code, che cerca i `queued`.\n\n'
      + '✅ **Adesso c\'è `planStartOrigine`**: `giorno` o `coda`, scritto in **tutti e cinque** i punti. Una '
      + 'colonna accanto e non due colonne di date, perché `planStartDate` la leggono venti punti e '
      + 'sdoppiarla vorrebbe dire venti letture da tenere d\'accordo: chi legge la data e non gliene importa '
      + 'continua come prima, chi deve **decidere** legge anche da dove viene. ⚠️ Si valorizza anche nel ramo '
      + 'della coda, dove il valore è un istante: un campo che si dichiara solo dove fa comodo torna ambiguo '
      + 'alla prima riga scritta dal ramo che se ne dimentica.\n\n'
      + '✅ **Il difetto delle due ore è chiuso**: fra la mezzanotte e le 02:00 italiane una cliente che '
      + 'pagava avendo scelto di cominciare **oggi** nasceva `queued`, e i menu le arrivavano alla passata '
      + 'notturna dopo — un giorno intero più tardi. Il test che lo fissava come «difetto noto» adesso dice '
      + 'il contrario, e la suite gira anche con l\'orologio fermo alle 00:30 di Roma, cioè **dentro** quella '
      + 'finestra.\n\n'
      + '⚠️ **Le righe vecchie non hanno la provenienza, e non si indovina**: `null` vuol dire «non lo so», e '
      + 'su «non lo so» resta il confronto fra istanti — il comportamento di prima. Nessuna data già scritta '
      + 'cambia significato il giorno del deploy, e il buco si chiude man mano che le date vengono '
      + 'riscritte. ⛔ Se «non lo so» valesse «giorno», la migrazione trasformerebbe anche le **scadenze dei '
      + 'piani in coda**, che partirebbero fino a due ore prima: per quelle due ore due piani '
      + 'erogherebbero insieme.\n\n'
      + '⚠️ Migrazione additiva senza default: `20260828120000_da_dove_viene_la_data_di_inizio`.'
  },
  {
    chiave: 'notte-in-cui-le-lancette-tornano-indietro',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: true,
    nata: '2026-08-23T02:05',
    titolo: '⛔ La notte in cui finisce l\'ora legale i menu si spostano di un giorno',
    dettaglio:
      '⛔ **Misurato il 23/8 con l\'orologio finto, non temuto.** Girando la suite come se fossero le '
      + '00:30 del **25 ottobre 2026** — la notte in cui le lancette tornano indietro, cioè un giorno '
      + 'di **25 ore** — cadono **tre file in più** rispetto a qualunque altra ora:\n\n'
      + '· `menu/menu.service.spec.ts` — cinque casi di erogazione, tutti con lo stesso scarto: '
      + '`Expected -1 / Received +1`. Uno dice «buffer: ha già un menu per un giorno futuro → non eroga '
      + 'altro» e ne eroga **quattro**;\n'
      + '· `menu/menu-measurement-gate.spec.ts` — «2° giorno del ciclo nel futuro → non bloccante» '
      + 'risulta **bloccante**: cioè il popup delle misure comparirebbe a chi non lo deve vedere;\n'
      + '· `menu/data-inizio-chat.service.spec.ts` — i quattro casi della finestra di blocco.\n\n'
      + '⚠️ **Le prove che dice non sono l\'ora:** alle 10:00 dello stesso giorno tutti e tre sono '
      + 'verdi, e la notte di **marzo** (quando le lancette vanno avanti) pure. È il giorno da 25 ore a '
      + 'romperli, e si vede solo in autunno.\n\n'
      + '⛔ **La forma del difetto è quasi certamente `+ n * 86_400_000`** su una mezzanotte locale: '
      + 'sommare 24 ore a una mezzanotte di Roma il 25 ottobre non dà la mezzanotte del 26, dà le 23:00 '
      + 'del 25. È il cugino del difetto chiuso oggi — un giorno trattato come una quantità fissa '
      + 'invece che come una domanda al fuso — e vive negli stessi file.\n\n'
      + '⚠️ **Cosa succederebbe davvero, e quando:** i menu della notte del 25 ottobre si spostano di un '
      + 'giorno, il gate delle misure blocca chi non deve, e la finestra di 24 ore sul cambio data '
      + 'sbaglia. Non è ipotetico e ha una data: **domenica 25 ottobre 2026**. Non è oggi, ma è segnato '
      + 'sul calendario.\n\n'
      + '⚠️ **Non corretto insieme al resto di proposito**: è un\'altra famiglia di casi, dentro '
      + 'l\'erogazione dei menu, e va guardata sapendo cosa ogni fixture vuol dire. Rendere verde un '
      + 'test in fretta è il modo di fargli smettere di verificare.\n\n'
      + 'Si riproduce con `ORA_FINTA=2026-10-24T22:30:00.000Z npm run test:notte`, e il controllo che '
      + 'dimostra che è l\'ora e non la data è `ORA_FINTA=2026-10-25T10:00:00.000Z npm run test:notte`.\n\n'
      + '✅ **CHIUSA il 24/8 — e l\'ipotesi scritta qui sopra era SBAGLIATA nella parte che conta.** '
      + 'Diceva «i menu della notte del 25 ottobre si spostano di un giorno, il gate delle misure blocca '
      + 'chi non deve». **Non è vero: il difetto era nei TEST, non nel prodotto.** Misurato caso per '
      + 'caso — e in due file su cinque riscrivendo le fixture con date a mano, senza orologio: quella '
      + 'notte il motore eroga i giorni giusti, il gate blocca chi deve, il rientro cade nel giorno '
      + 'giusto. **Nessuna cliente rischiava niente il 25 ottobre.** Una voce sbagliata non si cancella: '
      + 'si riscrive dicendo che era sbagliata.\n\n'
      + '⚠️ **E i file erano CINQUE, non tre**: si sono aggiunti `menu/rientro-dalla-sospensione.spec.ts` '
      + 'e `pause/modalita-viaggio-sospende.spec.ts`, nati con le consegne del 23/8 — la stessa riga '
      + 'copiata in un file nuovo, che è il modo in cui una famiglia di difetti si allarga.\n\n'
      + '**La forma vera del difetto**: `Date.now() + n * 86_400_000` su un **istante**. Non è la '
      + 'mezzanotte locale come diceva l\'ipotesi: alle 00:30 di un giorno da 25 ore, sommare '
      + 'ventiquattr\'ore non arriva a domani — resta lo stesso giorno. Quindi «un menu per un giorno '
      + 'FUTURO» ne preparava uno per **oggi**, e il test si stupiva che il motore erogasse. La '
      + 'correzione: si parte da `aGiorno(new Date())` (mezzanotte UTC) e si somma lì, dove i cambi '
      + 'd\'ora non esistono. Provata su **526.080 istanti** e quattro fusi di processo: zero errori, '
      + 'contro 1.664 della versione vecchia.\n\n'
      + '⚠️ In `data-inizio-chat.service.spec.ts` l\'helper era **già giusto**: lì quattro fixture '
      + 'deducevano «dentro le 24 ore» da «domani», e quella notte domani dista **24 ore e mezza**. Il '
      + 'servizio rispondeva «si può ancora spostare» ed era **letteralmente vero**. Adesso il blocco si '
      + '**dichiara** (`oreBlocco: 25`) invece di dedurlo. ⚠️ Verificato con dieci mutazioni del '
      + 'prodotto che l\'insieme dei test uccisi è **identico** a prima all\'ora ordinaria e più grande '
      + 'alle 00:30: il morso non è stato tolto.\n\n'
      + '⛔ **E la revisione ha bocciato la prima stesura della correzione, per il difetto che questa '
      + 'voce esiste per chiudere**: ci avevo aggiunto un `oreMancanti > 0` che rendeva il file rosso '
      + '**mezz\'ora al giorno, tutti i giorni** (dopo le 23:30 quella distanza si arrotonda a zero). '
      + 'Tolto. Più tre ragioni false nei commenti: «fra 23 e 25 ore a seconda della stagione» (dipende '
      + 'dall\'**ora**, ed è fra 0 e 25), e lo stesso esempio copiato in quattro file dove tre volte '
      + 'descriveva un caso di un altro file.\n\n'
      + '✅ Verificato: **5018 test in 314 suite** verdi alle 00:30 del 25/10/2026, a mezzogiorno dello '
      + 'stesso giorno, alle 00:30 del 29/3/2027 (giorno da 23 ore), il 31/12, il 29/2/2028, e a **ogni '
      + 'ora del giorno** su un giorno qualunque — con `TZ` a UTC e con `TZ=Europe/Rome`. Tutti e 14 i '
      + 'casi che cadevano sono ancora uccisi da almeno una mutazione del prodotto.',
  },
  {
    chiave: 'sospensioni-non-si-sovrappongono',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-25T11:00',
    titolo: '✅ Le sospensioni non si sovrappongono più, e la coach le può incatenare',
    dettaglio:
      'Richiesta di Simone (25/8): *«se c\'è già una sospensione in corso o programmata il sistema deve '
      + 'dare come data inizio della nuova sospensione il primo giorno utile, e non far sovrapporre le '
      + 'sospensioni»*, e *«il giorno di rientro in modo che la coach (non la cliente) possa fare le '
      + 'sospensioni continue»*.\n\n'
      + '⛔ **Il buco vero era dall\'app, e non lo guardava nessuno.** `requestPause` controllava solo se '
      + 'c\'era una richiesta `pending`, e la tregua dei 15 giorni cerca solo le vacanze finite **prima** '
      + 'della nuova: una sospensione **in corso** o **già programmata** era invisibile a tutti e due. La '
      + 'cliente poteva sovrapporne una, e il piano le si allungava **due volte per la stessa vacanza**. '
      + 'Stessa cosa dal «Periodo (più giorni)» del suo Calendario.\n\n'
      + '⛔ **E dal back office il problema era l\'opposto**: si rifiutava *qualunque* modalità viaggio '
      + 'ancora aperta, anche su date che non si toccano — la guardia guardava l\'**esistenza**, non la '
      + 'sovrapposizione. È per questo che la coach non poteva incatenarle.\n\n'
      + '✅ **Adesso**: `pause/primo-giorno-utile.ts` risponde a «da quando si può cominciare» per tutte e '
      + 'quattro le porte, con un parametro solo — zero giorni di tregua per la coach (consecutive '
      + 'permesse), i quindici del parametro per la cliente. Ogni rifiuto **dice la data** da cui si può '
      + 'partire, invece del solo «ce n\'è già una». La card mostra una riga «la prossima può cominciare '
      + 'dal …» con il pulsante «Aggiungine un\'altra», e i campi continuano a mostrare la sospensione in '
      + 'corso — che resta l\'unico modo per correggerla o toglierla.\n\n'
      + '⛔ **La revisione ha trovato tre BLOCCANTI, tutti aperti da questa consegna**, e valgono da '
      + 'raccontare:\n'
      + '· **spostare una vacanza ne creava una seconda.** La card si precompila con le date in corso, '
      + 'quindi cambiarle è il gesto naturale per spostarla: aperte le consecutive, quel gesto '
      + '**aggiungeva**. Riprodotto: vacanza 4→13 settembre spostata a ottobre = due eventi, due '
      + 'registri, **+20 giorni** di scadenza per una vacanza di dieci, nessun avviso. ✅ La distinzione '
      + 'la fa adesso chi preme (`aggiungi`), perché è l\'unico che la sa; senza quel campo vale la regola '
      + 'di sempre.\n'
      + '· **«Aggiungine un\'altra» + Salva a vuoto TOGLIEVA la sospensione in corso**: il pulsante svuota '
      + '«Riprende il», e senza quella data il salvataggio cadeva nel ramo «togli» — menu ripartiti in '
      + 'mezzo alla vacanza, con un banner verde che diceva «nessuna sospensione».\n'
      + '· **il messaggio alla cliente prometteva una data che il controllo poi rifiutava**: proponeva con '
      + 'la tregua della coach (zero) e rifiutava con quella della cliente (quindici). «Puoi cominciare '
      + 'dal 31/08» → chiedi il 31/08 → «ne mancano 15». Un vicolo cieco costruito da noi.\n\n'
      + '✅ **E quattro cose gravi che c\'erano già**: l\'**approvazione** di una richiesta lunga non aveva '
      + 'nessuna guardia (richiesta in attesa + modalità viaggio messa nel frattempo = **+36 giorni** per '
      + '25 di vacanza); la **tregua guardava solo indietro**, quindi si aggirava mettendo la nuova PRIMA '
      + 'di una già programmata; il **profilo** rispecchiava l\'ultima sospensione scritta invece di '
      + 'quella che ferma i menu — e da lì Gaia dava il menu «pre-evento» a una cliente in vacanza; e '
      + 'dall\'app si poteva chiedere una pausa **nel passato**, che non ferma niente e allunga il piano.\n\n'
      + '⚠️ E **tre test cancellati per collateralità** riscrivendo un gruppo — il ripiego quando la '
      + 'scadenza non si muove, il tetto dei 20 giorni, il rientro non dopo la partenza — rimessi. Un test '
      + 'cancellato per sbaglio non lascia traccia: la suite resta verde.\n\n'
      + '⚠️ **Quello che NON è cambiato**, e va saputo: la cliente vede le sospensioni della coach in '
      + 'Agenda (elenco pause e «giorni no-diet»), **col cestino accanto** — può cancellare quella messa '
      + 'dalla coach, e restano il profilo e i giorni già aggiunti alla scadenza. E quando la coach la '
      + 'toglie, la cliente legge la parola inglese «closed» in una pastiglia. Sono due difetti veri, '
      + 'misurati il 25/8 e non toccati qui perché non erano la richiesta.',
  },
  {
    chiave: 'giorno-nel-fuso-del-processo-piano-prova',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-23T01:10',
    titolo: '✅ `validaDataInizio` chiede il giorno invece di calcolarlo (e il primo giorno accettabile non è più ieri)',
    dettaglio:
      '`commerce/piano-prova.ts:34` — `soloGiorno(d) = new Date(d.getFullYear(), d.getMonth(), d.getDate())` '
      + '— è la mezzanotte del **processo**, non `toDateOnly`. È la stessa formula che '
      + '`il-giorno-si-chiede.spec.ts` vieta come `setHours(0, 0, 0, 0)`, solo scritta in un altro modo, '
      + 'e `commerce/piano-prova.ts` non è nel perimetro di quel guardiano.\n\n'
      + '⚠️ Su Render `TZ` non è impostata, quindi il processo sta a UTC e il risultato è la mezzanotte '
      + 'UTC — **il giorno UTC**, non quello di Roma. Da lì passano due cose: la data d\'inizio scelta '
      + 'in fondo al questionario di «Conosciamoci», e il rifiuto «quel giorno è già passato». Fra la '
      + 'mezzanotte e le 02:00 italiane il giorno UTC è ancora ieri, quindi una cliente che a quell\'ora '
      + 'sceglie **oggi** sta in realtà scegliendo una data che il sistema considera di ieri.\n\n'
      + '⚠️ **Non è rotto oggi** e per questo non blocca: `statoPerGiornoDiInizio` (23/8) su un valore '
      + 'che non è mezzanotte UTC esatta torna al confronto per istanti, cioè al comportamento vecchio, '
      + 'e su Render il valore mezzanotte UTC lo è. Ma è giusto **per com\'è configurata la macchina**, '
      + 'non per come è scritto il codice: basta un `TZ` su Render, o girarlo altrove, e cambia. Ed è la '
      + 'definizione del difetto che non si riproduce.\n\n'
      + 'Da fare: portare `soloGiorno` su `toDateOnly`/`aGiorno`, misurare quante date esistenti '
      + 'cambierebbero giorno (come si è fatto con `diag:giorno-piani`), e mettere `commerce/piano-prova.ts` '
      + 'nel perimetro di `il-giorno-si-chiede.spec.ts`.\n\n'
      + '✅ **CHIUSA il 25/8**, dentro la consegna che chiude tutto il censimento delle date. '
      + '`soloGiorno` è diventata `giornoScelto`, che distingue le due domande: una **stringa di sola '
      + 'data** (quella che manda il calendario dell\'app) vale alla lettera via `toDateOnly`, un '
      + '**istante** diventa il giorno di Roma via `aGiorno`. Il limite dei dodici mesi si sposta con '
      + '`setUTCMonth` su una mezzanotte UTC. `commerce/piano-prova.ts` è nel perimetro del guardiano.\n'
      + '⚠️ **Per il chiamante vero non cambia niente**, verificato in revisione: `Benvenuto.tsx` manda '
      + '`AAAA-MM-GG` da un `<input type="date">` il cui `min` è già calcolato su Roma, quindi il valore '
      + 'scritto in `Subscription.startDate` è identico a prima e `statoPerGiornoDiInizio` non cambia '
      + 'risposta. Quello che cambia è il **rifiuto**: alle 00:30 una partenza di ieri adesso viene '
      + 'respinta, come si voleva.',
  },
  {
    chiave: 'gaia-domande-a-numeri',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-25T15:00',
    titolo: '✅ Gaia non si perde più: tre domande a numeri (menu → pasto → alimento)',
    dettaglio:
      'Richiesta di Simone (24/8), guardando una chat vera: *«questa domanda non funziona, Gaia si '
      + 'perde, miglioriamola così: (domanda uno) su quale menu vuoi lavorare? 1 oggi 2 domani 3 '
      + 'dopodomani (in base a quanti ne vede); (domanda due) di quale pasto parliamo? 1 Colazione 2 '
      + 'spuntino… (in funzione del numero di pasti); e con lo stesso principio l\'elenco dei cibi, in '
      + 'modo che la cliente scriva dei numeri»*.\n\n'
      + 'Prima l\'apertura era **una** domanda con tutta la giornata incollata sotto — «colazione: '
      + 'Ricotta fresca con prugne secche reidratate e pane di segale · pranzo: … · cena: …» — e la '
      + 'richiesta di **scrivere a mano** il nome di uno fra quindici alimenti. Una parola diversa da '
      + 'quella della ricetta e si ricominciava; al secondo tentativo si passava alla coach. ✅ Adesso '
      + 'sono tre domande corte, ognuna con l\'elenco vero di quella cliente. ⚠️ **Le domande con una '
      + 'risposta sola non si fanno**: chi vede solo il menu di oggi non si sente chiedere «su quale '
      + 'menu», e chi ha un pasto solo va dritto agli alimenti. ⚠️ **Le parole continuano a '
      + 'funzionare**: «domani», «a pranzo», «le carote» portano avanti come prima — i numeri sono la '
      + 'strada facile, non l\'unica.\n\n'
      + '⛔ **La revisione ha trovato otto difetti, tre gravi.** (1) Il numero si risolveva cercando '
      + 'il **nome** in tutta la giornata: con l\'olio evo (o il pane, o i pomodorini) in due pasti, il '
      + '«3» scelto sul pranzo faceva scrivere la sostituzione **sulla colazione**. Ora si risolve per '
      + '**posizione dentro il pasto scelto**. (2) Al passo del pasto si era perso `soloIlPastoNominato` '
      + '— la riga nata dalla conversazione del 12/8 — e «a pranzo vorrei cambiare le carote» '
      + 'rispondeva della colazione. (3) Un numero **fuori elenco** scivolava nella ricerca per parole: '
      + '«non trovo «7» fra gli ingredienti», e alla seconda **la richiesta passava alla coach** — a '
      + 'chi aveva solo sbagliato a contare.\n\n'
      + '⚠️ Accolti anche: la valvola che lascia passare una **FAQ vera** durante il dialogo era '
      + 'rimasta appesa al passo vecchio (chi toccava «Sostituisci» e poi chiedeva «quando si sblocca '
      + 'il prossimo menu?» si sentiva rispondere «non ho capito»); le **spezie** finivano in elenco '
      + 'come opzioni valide per poi essere rifiutate (e il rifiuto CHIUDE la conversazione); un '
      + 'ingrediente ripetuto compariva due volte; e il taglio a dieci alimenti non era dichiarato — '
      + 'ora l\'elenco dice sempre che si può rispondere anche a parole.\n\n'
      + '🔍 5222 test in 322 suite verdi (TZ UTC e Roma), build pulito, ogni pezzo nuovo provato alla '
      + 'mutazione. Nessuna migrazione, nessun dato nuovo: lo stato del dialogo vive nel messaggio e '
      + 'scade in un\'ora, quindi al deploy l\'unica esposizione sono le conversazioni in volo — che '
      + 'con uno stato vecchio si comportano come prima.',
  },
  {
    chiave: 'colonna-in-sospensione',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-25T10:00',
    titolo: '✅ Pipeline: la colonna «In sospensione», dove sostano le clienti mentre i menu sono fermi',
    dettaglio:
      'Richiesta di Simone (24/8): «creiamo in pipeline, tra acquisto e senza possibilità economiche, '
      + 'un nuovo stato "In sospensione" dove sostiamo i clienti durante la sospensione e li '
      + 'riportiamo in Acquisto una volta che riprendono il percorso».\n\n'
      + 'Prima una cliente in vacanza per venti giorni restava in «Acquisito», in mezzo a chi sta '
      + 'seguendo: chi apre la board non vedeva la differenza fra chi è ferma di sua volontà e chi è '
      + 'sparita — e sono due telefonate diverse. ✅ Adesso la scheda si parcheggia da sola quando la '
      + 'sospensione **è in corso** (subito, se comincia oggi; dal giro notturno se comincia più in '
      + 'là) e torna **esattamente dove stava** quando i menu ripartono. ⚠️ Non genericamente in '
      + '«Acquisito»: chi era in «Prima visita» non deve retrocedere di quattro colonne per essere '
      + 'andata in ferie — il ripiego su «Acquisito» c\'è solo se quella colonna non esiste più. E se '
      + 'nel frattempo una coach l\'ha trascinata altrove, **quella mano vince**.\n\n'
      + '⛔ **La revisione ha trovato otto difetti, tre gravi.** (1) Il rientro **non aveva rete**: '
      + 'era attaccato al passo del `travel_return`, cioè dopo tre controlli scritti per il '
      + 'marketing, quindi lo script `sblocca:sospensione`, la cliente che si cancella l\'evento dal '
      + 'Calendario e un cron fermo tre giorni lasciavano la scheda parcheggiata **per sempre**. Ora '
      + 'c\'è una spazzata notturna che fa la domanda giusta: «c\'è ancora una sospensione oggi?». '
      + '(2) Su una board vera la colonna nasce **in fondo** (il seed la mette dopo l\'ultima quando '
      + 'il posto è occupato), e lì `avanzaStatoSeIndietro` **rifiutava** di archiviare una scheda '
      + 'parcheggiata: il piano scade davvero anche in vacanza, e la coach non avrebbe mai ricevuto '
      + '«piano finito da 7 giorni senza rinnovo» — la telefonata che fa rinnovare. (3) Si '
      + 'parcheggiava **chiunque**, prova gratuita compresa: un periodo senza menu lo può creare '
      + 'qualunque cliente dal Calendario, e parcheggiata quella scheda diventava una «cliente» — '
      + 'contatore pubblico, conversione del cruscotto e **campagne di chi ha comprato**. Ora si '
      + 'parcheggia solo da «Acquisito» in poi.\n\n'
      + '⚠️ Accolti anche: il parcheggio **a mano** (trascinamento sulla board) non si ricordava da '
      + 'dove veniva; la memoria non si azzerava al rinnovo; annullando una vacanza **futura** si '
      + 'sparcheggiava chi era ferma per un\'altra; nel back office la scheda in sospensione portava '
      + 'il badge ambra **«Lead»** e perdeva il chip «giorni alla fine del piano»; e due script di '
      + 'diagnostica dicevano il falso (`diag:acquisti-pipeline` segnalava ogni vacanza come «ha '
      + 'incassato ma non è acquisito»).\n\n'
      + '⛔ **E una cosa che si rompeva in silenzio**: in quattro punti «cliente» voleva dire '
      + '**letteralmente** `stage === \'paid\'` — il contatore pubblico delle clienti seguite, il '
      + 'badge cliente/lead, i filtri delle campagne, l\'elenco Clienti. Parcheggiando una scheda '
      + 'altrove, una cliente che paga diventava **un lead** per il marketing: le email di chi non ha '
      + 'ancora comprato, mandate a una in ferie col piano pagato. Adesso «cliente» è un elenco '
      + '(`STAGE_DA_CLIENTE`) e sta in un posto solo.\n\n'
      + '🔍 5201 test in 322 suite verdi (TZ UTC e Roma), build veri di backend e backoffice, ogni '
      + 'pezzo nuovo provato alla mutazione. ⚠️ **Al rilascio**: la migrazione la applica Render; la '
      + 'colonna la crea il seed all\'avvio e nasce **in fondo alla board** — va trascinata dove la '
      + 'vuoi (fra «Acquisto» e «Senza possibilità economiche»): nessun automatismo legge quell\'ordine. '
      + '⚠️ Le sospensioni **già in corso** al momento del rilascio si parcheggiano da sole al primo '
      + 'giro notturno.',
  },
  {
    chiave: 'stato-tolto-e-acqua-per-unita',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T19:30',
    titolo: '✅ Via la tendina «Stato»: comandano le date · l\'acqua si legge nell\'unità di lei · il rientro si segna da solo',
    dettaglio:
      'Due richieste di Simone (24/8 sera).\n\n'
      + '**1) «Va tolto il campo stato che crea confusione.»** La tendina aveva tre voci — in '
      + 'partenza / in vacanza / rientrato — e chiedeva a chi salva una cosa che il calendario sa '
      + 'già. Peggio: le due metà potevano **contraddirsi** (una vacanza di luglio salvata «in '
      + 'partenza» ad agosto scriveva sul profilo uno stato falso, e uno stato senza date non '
      + 'fermava niente pur sembrando di sì). Adesso si sospende **quando ci sono le due date**, lo '
      + 'stato sul profilo si ricava da quelle, e per togliere una sospensione si svuotano le date.\n\n'
      + '⚠️ **E il rientro non si dichiara più a mano.** L\'evento `travel_return` — quello che accende '
      + 'la campagna di rientro del marketing e il tono «bentornata» di Gaia — nasceva SOLO se '
      + 'qualcuno tornava sulla scheda giorni dopo a cambiare la tendina: per le sospensioni nate '
      + 'dall\'app o dal Calendario non nasceva **mai**. Ora lo segna il giro notturno il giorno del '
      + 'rientro, per tutte le porte (`PauseService.surveillanceTick`).\n\n'
      + '**2) L\'acqua in scheda si legge come la legge lei**: via il commentino sotto ogni numero, '
      + 'colonne **DATA · QUANTITÀ · UNITÀ · OBIETTIVO**, e quantità e obiettivo nell\'unità di quel '
      + 'giorno con le stesse regole dell\'app (obiettivo in bottiglie **intere**, quantità a mezzi se '
      + 'la giornata è mista). ⚠️ La spunta ✓ continua a confrontare i **bicchieri**, che sono il dato '
      + 'salvato: i due numeri accanto possono sembrare in disaccordo con lei (obiettivo 9 bicchieri, '
      + 'lei ne beve 8 contando a bottiglie da 1 L → «2 · bottiglie da 1 L · 2» senza spunta), e il '
      + '`title` di ogni cella porta i numeri veri.\n\n'
      + '⛔ **La revisione ha bocciato la prima stesura in quattro punti, tutti corretti.** (a) '
      + '`input.state` veniva **ignorato**: un back office con la pagina aperta da stamattina manda '
      + 'ancora quel campo, e nella card vecchia scegliere «Rientrato/a» **lasciando le date piene** '
      + 'era il modo documentato di chiudere una vacanza — ignorandolo, quella stessa mossa faceva '
      + 'l\'**opposto** (sospensione confermata, menu fermi, scadenza allungata). Adesso quel '
      + 'salvataggio si ferma e dice «ricarica la pagina». (b) Il giro notturno guardava **tutti** i '
      + '`pause_period`: un ricovero segnato come «Altro» dal Calendario sarebbe diventato un rientro '
      + 'dalle vacanze, e una sospensione **annullata** (che non si cancella, si accorcia a ieri) '
      + 'avrebbe fatto partire la mail di rientro da una vacanza mai fatta. (c) Il tono «bentornata» '
      + 'di Gaia era legato al campo sul profilo, che solo la card scrive: si accendeva **solo** per '
      + 'le pause della card, cioè non per quelle nuove — ora comanda l\'evento. (d) Le date sul '
      + 'profilo non le azzerava nessuno: la card restava precompilata con la vacanza di agosto e '
      + 'ogni Salva finiva contro «questa vacanza è già finita».\n\n'
      + '🔍 5167 test in 320 suite verdi (TZ UTC e Roma), 117 nel backoffice, build veri; ogni pezzo '
      + 'nuovo provato alla mutazione. ⚠️ **Al rilascio**: chi ha il backoffice aperto col bundle '
      + 'vecchio prende l\'errore «ricarica la pagina» finché non ricarica — è voluto, ed è meglio di '
      + 'un Salva che fa il contrario di quello che dice.',
  },
  {
    chiave: 'acqua-unita-e-tabelle-a-dieci-righe',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T17:30',
    titolo: '✅ Sospensioni: anche «Vede» accende qualcosa · l\'acqua dice in che unità · quattro tabelle alte dieci righe',
    dettaglio:
      'Tre richieste urgenti di Simone (24/8), tutte sulla scheda cliente.\n\n'
      + '**1) «La visualizzazione e gestione della modalità viaggio deve essere configurabile dalla '
      + 'pagina permessi.»** La chiave `travel_mode` c\'era già dal 23/8, con le sue **due** caselle in '
      + 'Permessi — ma aveva una guardia sola (`manage` sulla PATCH) e la card leggeva solo quella: '
      + '⛔ **«Vede» spuntato da solo non accendeva niente**, quindi dare a una coach la sola lettura '
      + 'delle sospensioni era impossibile. È lo stesso difetto raccontato in testa a '
      + '`permissions/pages.ts` (`assignments`), ricomparso dentro una chiave che quel difetto lo '
      + 'cita. Adesso «Vede» apre la card in **sola lettura** — le date, il motivo, lo storico: quello '
      + 'che serve per rispondere a «perché a questa cliente non arriva il menu?» — con '
      + '`@RequirePage(\'travel_mode\',\'view\')` sul `GET :id/sospensioni`, e «Gestisce» apre il modulo. '
      + 'L\'etichetta in Permessi diventa **«Sospensioni»**, come si chiama la card dal 24/8.\n\n'
      + '**2) L\'unità dell\'acqua, sulla riga.** ⚠️ La premessa della richiesta («è personalizzabile '
      + 'dalla cliente per ogni giornata») non era esatta: il selettore in app (dal 17/7) è **una '
      + 'preferenza del profilo**, che vale per tutte le giornate e si può cambiare quando si vuole. '
      + 'Il dato salvato è sempre in bicchieri da 250 ml. Quindi leggere il passato con la preferenza '
      + 'di **oggi** avrebbe raccontato in bottiglie giornate contate a bicchieri, il giorno in cui lei '
      + 'tocca il selettore. Ora l\'unità si scrive **sulla riga del giorno** (`water_log.unit`, '
      + 'migrazione additiva e nullable) al momento del tap, come si fa già con l\'obiettivo dei passi: '
      + 'da oggi ogni giornata sa come è stata contata, e in scheda si legge «12» con sotto «3 '
      + 'bottiglie da 1 L». ⛔ Le giornate di prima dicono **«unità non registrata»**, non «bicchieri»: '
      + 'non gliel\'abbiamo mai chiesto, e scriverlo sarebbe inventare. L\'elenco delle unità sta in '
      + '`common/unita-acqua.ts` (era copiato a mano in tre punti di `users.service.ts`), e un test '
      + 'confronta quella tabella con la copia dell\'app: se domani là la bottiglia da 1 L valesse 5 '
      + 'bicchieri, la stessa giornata si leggerebbe in due modi diversi.\n\n'
      + '**3) Quattro tabelle alte dieci righe** (acqua, passi, pesate, umori): fino a **60** righe '
      + 'l\'una spingevano fuori pagina tutto quello che sta sotto. `components/tabella-scorrevole.tsx` '
      + '**misura** le prime dieci righe vere invece di scrivere un\'altezza a occhio — nelle pesate una '
      + 'riga corretta dalla cliente ne porta con sé una seconda, e un numero fisso avrebbe tagliato a '
      + 'metà l\'ultima. Se le righe ci stanno tutte, nessun limite e nessuna barra; l\'intestazione '
      + 'resta in cima mentre si scorre.\n\n'
      + '⛔ **E la revisione ha bocciato la prima stesura in tre punti.** (1) La riga dell\'acqua '
      + '**raccontava giornate mai esistite**: l\'unità è una preferenza di profilo e la riga si '
      + 'ricorda quella dell\'ultimo tap, quindi otto bicchieri la mattina più un tap serale a '
      + 'bottiglie diventavano «3 bottiglie da 1 L» — di bottiglie ne aveva bevuta una. Ora la '
      + 'conversione si fa **solo quando i conti tornano**; se la giornata è mista si dice «a fine '
      + 'giornata contava in bottiglie da 1 L». (2) Il 403 sull\'elenco veniva **ingoiato**: un ruolo '
      + 'personalizzato (menu costruito su `customRoleKey`, guardia sul ruolo **base**) avrebbe letto '
      + '«Nessuna sospensione» su una cliente sospesa in quel momento — non un errore, una bugia. Ora '
      + 'c\'è l\'avviso che dice dove si accende. (3) La tabella scorrevole **non era raggiungibile da '
      + 'tastiera** (niente `tabIndex`: dieci pesate su sessanta e nessun modo di arrivare alle altre) '
      + 'e **non rimisurava** quando una riga cambiava altezza senza cambiare numero — cioè la pesata '
      + 'corretta dalla cliente, la riga che il componente cita come motivo per esistere. ⚠️ Accolti '
      + 'anche: la `min-width` della regola dell\'11/8 riportata a mano (incapsulando la tabella, '
      + '`.card:has(> table.grid)` non la prende più), il filetto sotto l\'intestazione incollata '
      + '(`border-collapse` non lo porta con sé), il ritentativo senza `unit` se l\'app OTA arriva '
      + 'prima del backend, e il conto delle dieci righe estratto in `lib/altezza-righe.ts` perché '
      + 'fosse provabile (4 test).\n\n'
      + '⚠️ **Una porta che questo permesso NON copre, dichiarata**: le *richieste* di pausa che '
      + 'arrivano dall\'app si approvano dalla card sotto, che resta sui suoi ruoli (`sales` compreso). '
      + 'Agganciarla a `travel_mode` — che di default ce l\'ha solo l\'admin — chiuderebbe da domani le '
      + 'approvazioni a tutte le coach che le fanno oggi. ✅ **Simone, 24/8: l\'approvazione resta come '
      + 'oggi.** Scritto nel codice, così chi guarda quella rotta sa che è una scelta e non una svista.\n\n'
      + '⛔ **Al deploy**: la migrazione la applica Render. ⚠️ L\'unità si registra **dai tap fatti con '
      + 'l\'app aggiornata**: sui telefoni con la versione vecchia le giornate continuano ad arrivare '
      + 'senza unità (e quella già scritta non viene cancellata). ⚠️ E dopo il rilascio va acceso in '
      + 'Permessi il «Vede» a chi deve leggere le sospensioni senza poterle cambiare.',
  },
  {
    chiave: 'motivo-della-sospensione',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T15:00',
    titolo: '✅ Una sospensione adesso dice anche PERCHÉ, la card si chiama «Sospensioni» e lo storico nasce chiuso',
    dettaglio:
      'Tre richieste di Simone (24/8) sulla card in scheda cliente. **1)** «Quando la coach o la '
      + 'nutrizionista inseriscono una pausa facciamo mettere anche una motivazione così ci resta '
      + 'salvata»: fino a oggi una sospensione diceva **da quando a quando** e **da quale porta era '
      + 'nata**, e non perché — chi apriva la scheda tre mesi dopo, o doveva decidere sulla vacanza '
      + 'successiva (la «tregua»), leggeva venti giorni di menu fermi senza sapere se era un viaggio '
      + 'di lavoro, un ricovero o un esame. Colonna `note` su `Event` (migrazione additiva e '
      + 'nullable), obbligatoria **solo quando si sospende davvero**: non per il rientro, non per '
      + 'svuotare lo stato, non per uno stato senza date. **2)** Il titolo passa da «Modalità viaggio '
      + '(piani estate)» a **«Sospensioni»**. **3)** Lo storico è comprimibile e **nasce chiuso**: '
      + 'sono fino a quattro tabelle, e aperte spingevano fuori schermo la parte che si usa tutti i '
      + 'giorni.\n\n'
      + '⛔ **La revisione ha trovato che così la card si ROMPEVA per chi la usa di più.** Stato e date '
      + 'si precompilano dal profilo, il motivo no: la coach che riapriva la scheda per **allungare** '
      + 'una vacanza — o che ripremeva Salva senza toccare niente — si prendeva un 400 «scrivi il '
      + 'motivo», e al secondo tentativo scriveva qualcosa di nuovo che **sovrascriveva** quello di '
      + 'prima. Cioè l\'opposto di «così ci resta salvata». Adesso il campo si precompila da quello '
      + 'già salvato.\n\n'
      + '⚠️ Altri cinque rilievi accolti: **la persistenza non aveva nessun test** — togliendo del '
      + 'tutto la scrittura di `note` la suite restava verde su 5114 — e adesso ce ne sono tre che '
      + 'mordono; una **ragione scritta era falsa** («questa funzione la chiamano anche altre strade»: '
      + '`setTravel` è l\'unico chiamante); i commenti dicevano che `NULL` = «prima del 24/8», mentre '
      + 'restano senza motivo **anche le pause nate dalle altre porte** (app, approvazione, '
      + 'Calendario); ✅ e il **Calendario in app un motivo ce l\'ha già** — la cliente scrive un testo '
      + 'libero che finisce in `label` — e nessuno lo leggeva: adesso la scheda lo mostra. Infine '
      + 'l\'accordion aveva un `<h3>` dentro un `<button>` (HTML non valido, e il modello è '
      + 'l\'inverso), e da chiuso contava «N periodi» invece di dire la cosa per cui quella sezione '
      + 'esiste: **se è sospesa adesso**.\n\n'
      + '⛔ **Al deploy**: la migrazione la applica Render. ⚠️ Chi ha il backoffice aperto col bundle '
      + 'vecchio manda il salvataggio **senza** motivo e riceve l\'errore finché non ricarica la '
      + 'pagina — l\'errore è parlante, ma il giorno del rilascio succede.',
  },
  {
    chiave: 'modifica-ricetta-dagli-allergeni',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T10:30',
    titolo: '✅ «Allergeni ricette»: si può correggere il piatto prima di confermarlo',
    dettaglio:
      'Richiesta di Simone (24/8): «prima di approvare, il nutrizionista può anche correggerla». '
      + 'Nella colonna Azioni compare **«Modifica ricetta»**, che apre lo stesso popup del catalogo '
      + '(nome, regime, pasto, kcal, difficoltà, stagioni, ingredienti, cottura, «Dove è usata»).\n\n'
      + '⚠️ **Il pulsante di prima si chiama adesso «Allergeni», e non è cosmesi**: si chiamava '
      + '«Modifica» quando la ricetta era già confermata e «Rivedi» quando no — due nomi per lo '
      + 'stesso riquadro, e uno dei due era proprio la parola che serviva al popup nuovo.\n\n'
      + '⛔ **Un difetto trovato in revisione, e non era del pulsante nuovo.** Dentro il popup, '
      + '«Dove è usata → Collega a una dieta» chiedeva dieta, settimana e giorno e poi **falliva**: '
      + 'il server rifiuta di collegare una ricetta archiviata o con gli allergeni non confermati — '
      + 'cioè praticamente **ogni riga di quella pagina**. E il messaggio d\'errore rimandava ad '
      + '«Allergeni ricette», che è la pagina in cui si è già. Adesso il divieto si legge **prima**, '
      + 'al posto del pulsante, e dice quale delle due condizioni manca. ⚠️ Vale anche nel catalogo: '
      + 'era rotto anche lì, su qualunque bozza.\n\n'
      + '⚠️ Altri due rilievi della stessa revisione: salvando dal popup si può cambiare **regime** e '
      + '**attiva/archiviata**, quindi la riga può uscire dall\'elenco — e la sua spunta restava, '
      + 'facendo confermare in blocco (e **entrare in catalogo**) una ricetta che nessuno vedeva più. '
      + 'Ora la spunta si toglie al salvataggio. E i due tipi «ricetta» delle due pagine sono '
      + 'diventati uno solo.\n\n'
      + 'Nessuna chiave di permesso nuova: il popup chiede `recipes.manage`, che quella pagina già '
      + 'usava per il cestino e per la conferma in blocco.',
  },
  {
    chiave: 'pipeline-non-ha-seguito',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T11:00',
    titolo: '✅ Pipeline: chi non ha mai inserito una misura non è «Percorso concluso»',
    dettaglio:
      'Richiesta di Simone (24/8): «se una persona attiva un piano e non inserisce le misure nemmeno '
      + 'una volta, a piano scaduto non deve andare in Piano concluso, ma in **Non ha seguito**, una '
      + 'colonna nuova in fondo». Le due colonne rispondono a due domande diverse, ed è la ragione '
      + 'per cui vale la pena separarle: chi ha finito si richiama per rinnovare, chi non ha mai '
      + 'messo un peso non ha finito niente — non ha nemmeno cominciato — e la telefonata è un\'altra.\n\n'
      + '⛔ **La prima stesura era verde e non sarebbe servita a niente.** Diceva «la misura scritta '
      + 'dal questionario non salva nessuno, perché è di prima che il piano cominci»: **falso nel '
      + 'caso normale**, perché chi finisce il questionario attiva «Conosciamoci» lo stesso giorno. '
      + 'Con la finestra più larga su tutti i piani, quella riga automatica copriva anche i mesi '
      + 'dopo: una cliente che aveva cominciato subito **non sarebbe mai più** potuta finire in '
      + 'questa colonna, nemmeno dopo tre mesi pagati senza una pesata. La colonna si sarebbe '
      + 'riempita solo con chi aveva **posticipato** l\'inizio, cioè per un fatto che non c\'entra '
      + 'niente con l\'aver seguito. Trovato in revisione avversariale, misurato.\n\n'
      + '**La regola vera** (decisa da Simone il 24/8): nessuna misura fra `menu_visible_days_before_start` '
      + 'giorni **prima** dell\'inizio e la fine del piano, **esclusa** quella datata al giorno di '
      + '`onboardingCompletedAt` (è quella scritta dal questionario). La finestra comincia prima '
      + 'perché è la stessa di `menu/misura-di-partenza.ts`, quella in cui il prodotto *chiede* la '
      + 'pesata per sbloccare i menu: accusare chi si è pesata il giorno che gliel\'abbiamo chiesto '
      + 'sarebbe stato l\'errore peggiore dei due. ⛔ **Il prezzo, scritto perché si sappia**: se una '
      + 'cliente si è pesata *davvero* il giorno del questionario e mai più, quella pesata non la '
      + 'salva — sotto è la stessa riga, e nessun campo distingue le due cose.\n\n'
      + '⚠️ **Retroattivo entro la finestra dei 7–120 giorni** (scelta di Simone): chi era già in '
      + '«Percorso concluso» e non ha misure si sposta la prima notte. È il motivo per cui la colonna '
      + 'sta in FONDO — `avanzaStatoSeIndietro` non retrocede mai. ⛔ **Ma non scavalca una persona**: '
      + 'se in «Percorso concluso» ce l\'ha messa una coach (`stageDates.byUserId` diverso da '
      + '`sistema`), la scheda resta dov\'è.\n\n'
      + '⚠️ Altri due rilievi accolti dalla stessa revisione. **1)** L\'`order: 11` scritto a mano '
      + 'poteva **pareggiare** con una colonna aggiunta dall\'admin (che nasce a `max+1`, cioè 11 su '
      + 'una board di default) o finire prima di `path_ended` dopo un riordino: un pareggio blocca lo '
      + 'spostamento **in silenzio**, e la colonna sarebbe rimasta vuota per sempre. Ora il seed la '
      + 'crea in fondo alla board di *adesso* se il posto è occupato, e due test tengono ferme le due '
      + 'proprietà (ordine dopo `path_ended`, `isSystem: true`) — prima rompendole la suite restava '
      + 'verde su 5013 test. **2)** Quando si ripiega su «Percorso concluso», avviso alla coach e '
      + 'audit seguono **dove la scheda è finita davvero**, non dove volevamo mandarla: prima una '
      + 'push mandava a cercare una cliente in una colonna che su quella board non c\'era.\n\n'
      + '⚠️ Aggiunti anche al catalogo degli avvisi staff `client_path_ended` (che dall\'8/8 non '
      + 'c\'era, quindi la coach lo riceveva e **non poteva spegnerlo**) e `client_path_not_followed`. '
      + 'E `npm run diag:percorsi-conclusi` adesso dice quale delle due colonne, chiedendolo alla '
      + 'stessa funzione del motore.\n\n'
      + '⛔ **Al deploy**: il seed crea la colonna da sé (è di sistema). Poi `npm run diag:pipeline-stati` '
      + 'per controllare che sia davvero **dopo** «Percorso concluso» sulla board vera.',
  },
  {
    chiave: 'grassi-fattore-conversione-nocanty',
    categoria: NOCANTY,
    ordine: 0,
    blocca: false,
    nata: '2026-08-24T12:00',
    fatta: true,
    titolo: '✅ I grassi nei cambi in chat: Nocanty ha risposto il 24/8, ed è dentro il prodotto dal 25/8',
    dettaglio:
      '⚠️ **La domanda era aperta dal 20/8.** Il difetto misurato: Gaia proponeva i cambi **a pari '
      + 'grammatura**, e sui grassi non regge — 70 ml di panna → 70 g di olio portano un piatto da '
      + '500 kcal a ~890 (**+77%**), su una cliente in deficit. Il controllo che c\'era '
      + '(`grammaturaAmmessa`, un terzo/il triplo) guarda il **rapporto fra le quantità**, non le '
      + 'calorie: 70 → 70 è un rapporto di 1 e passava senza dire niente. Ed era cieco esattamente '
      + 'sul caso che conta. ⛔ E il codice non poteva calcolarselo: degli ingredienti conosce nome, '
      + 'quantità e unità, e in tutto il prodotto non esiste nessuna tabella di composizione.\n\n'
      + '✅ **Risposta di Nocanty, 24/8**: *«Confermo la proposta: Strada B per il gruppo "Oli e '
      + 'grassi da condimento" (che copre la quasi totalità dei casi) e Strada A (gestione manuale '
      + 'con inoltro al nutrizionista) per tutte le altre categorie di grassi più complesse o '
      + 'disomogenee»*, con la tabella dei grammi equivalenti a 100 g di olio EVO (fonte **CREA / '
      + 'USDA**). Suo esempio: 70 g di panna (285) → **25 g di olio** (100).\n\n'
      + '✅ **Consegnato il 25/8**: (1) `menu/grassi-equivalenti.ts`, puro e provato sui suoi numeri '
      + '— legge i pesi, converte, e con `sembraUnGrasso` riconosce un grasso **anche senza la '
      + 'tabella**, così un gruppo in bozza o rinominato fa passare la mano invece di tornare in '
      + 'silenzio alla pari grammatura; il peso si cerca per nome **esatto** («burro di arachidi» non '
      + 'eredita il 120 del burro); (2) i numeri vivono **sul gruppo di equivalenza** '
      + '(`members.fattori`: campo Json già esistente, **nessuna migrazione**) e li mantiene lui dal '
      + 'back office, riga «nome = grammi», con la colonna «Pesi» in elenco e una conferma prima di '
      + 'cancellarli, perderne anche uno solo o rinominare il gruppo; (3) **Gaia** converte in un '
      + 'punto solo (`conSostituto`): prima proposta, secondo giro e sostituto scelto dalla cliente; '
      + 'le coppie che in cucina non reggono (panna → olio in vellutate e salse, regola sua) non si '
      + 'fanno da sole; senza il numero non si propone niente e la richiesta va a lei **col motivo '
      + 'vero**, che sono tre frasi diverse e non una; (4) **anche il motore e il pulsante dell\'app**: '
      + '`burro → olio evo` per le intolleranti al lattosio era scritto senza quantità, 30 g '
      + 'diventavano 30 invece di 25 — **+20% di lipidi ogni giorno**, sulla strada automatica. Lì la '
      + 'sostituzione **resta comunque** (serve a rendere sicuro il piatto) ma la quantità si '
      + 'converte dove il numero c\'è, e dove non c\'è si conta e si scrive nel log; (5) '
      + '`npm run diag:grassi` dice **quali nomi del catalogo** restano senza peso e in quante '
      + 'ricette.\n\n'
      + '⚠️ **Due giri di revisione avversariale, dieci difetti veri chiusi**, fra cui: la richiesta '
      + 'girata che **spariva** quando esisteva una segnalazione già *risolta* (Gaia diceva «l\'ho '
      + 'girata alla tua nutrizionista» e non arrivava niente da nessuna delle due porte); il secondo '
      + 'giro che teneva la quantità dell\'alimento di prima (52 g di olio invece di 25); i pasti '
      + 'saltati per la cucina **contati e mai letti**, con una ragione falsa alla cliente; la '
      + 'correzione della nutrizionista che reintroduceva la pari grammatura; l\'unità che restava '
      + '«ml» su una conversione fatta in grammi.\n\n'
      + '⚠️ **Resta a Nocanty**: la tabella ha **13 righe** e il catalogo nomina più grassi. Ogni '
      + 'nome senza peso è un cambio che Gaia non fa e che finisce sul suo tavolo — `npm run '
      + 'diag:grassi` dice quali sono e quanto valgono. ⛔ E i nomi ambigui (**panna da cucina, panna '
      + 'leggera, panna vegetale**) sono prodotti diversi: o hanno un numero loro, o restano fuori. '
      + 'Non si ereditano dalla panna fresca. ⚠️ **Il seed va girato in produzione** per creare il '
      + 'gruppo: finché non c\'è, Gaia passa la mano su tutti i cambi di grasso (sicuro, ma è lavoro '
      + 'non fatto).',
  },
  {
    chiave: 'test-che-scadono-il-2-settembre',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: true,
    nata: '2026-08-23T00:40',
    titolo: '⛔ Il 2 settembre due suite diventano rosse da sole: dei test hanno la data scritta a mano',
    dettaglio:
      '⛔ **Misurato, non temuto.** Con `ORA_FINTA=2026-09-02T10:00:00.000Z npm run test:notte` — cioè '
      + 'la stessa suite girata come se fosse il 2 settembre, in pieno giorno — **due file sono rossi**:\n\n'
      + '· `coach/coach.service.spec.ts` — «la scadenza mostrata è quella del piano CHE EROGA»: si '
      + 'aspetta `2026-09-01`, e da quel giorno riceve `2026-11-01`;\n'
      + '· `monitoring/monitoraggio-abbonamento.spec.ts` — «alla prima pesata FISSA il riferimento»: il '
      + 'periodo finto risulta scaduto e il servizio lo chiude invece di fissare il peso.\n\n'
      + '⚠️ Dal **1 ottobre** se ne aggiunge un terzo, `agenda/agenda.service.spec.ts` («il controllo '
      + 'arriva fino a SERA dell\'ultimo giorno»), che rifiuta il periodo di ferie come già passato.\n\n'
      + '⛔ **È un difetto diverso da quello del fuso, ed è peggiore in un modo:** quello si vedeva due '
      + 'ore al giorno e poi passava; questo, dal 2 settembre, **non passa più**. Una CI rossa per '
      + 'sempre è una CI che si smette di guardare, e allora il primo difetto vero arriva in produzione '
      + 'in mezzo al rumore.\n\n'
      + '⚠️ **Non corretto insieme al fuso di proposito**: sono tre file di test con fixture di date '
      + 'intrecciate e ognuno chiede di capire cosa la sua data vuol dire prima di spostarla. Rendere '
      + 'verde un test in fretta è il modo di fargli smettere di verificare — la stessa ragione per cui '
      + 'il 21/8 questi quattro non erano stati toccati alle due di notte.\n\n'
      + 'La correzione è la stessa famiglia: la data della fixture si costruisce **da adesso** con la '
      + 'porta giusta, invece di essere scritta a mano in un giorno che poi arriva. Si verifica con '
      + '`ORA_FINTA=<data> npm run test:notte`.\n\n'
      + '✅ **CHIUSA il 24/8.** I primi due file erano già stati corretti in `e3b7412`; il terzo '
      + '(`agenda/agenda.service.spec.ts`) lo è adesso: il periodo di ferie non è più `2026-09-10 → '
      + '2026-09-20` ma `fra(20) → fra(30)`, contati da `aGiorno(new Date())`, cioè dalla stessa '
      + 'porta che `creaFerie` usa per decidere se un periodo è passato. La suite intera è verde a '
      + '`ORA_FINTA` del 2/9, 1/10, 15/11, 15/3/2027, 1/9/2027, 1/6/2028 e 5/5/2031.\n\n'
      + '⚠️ **E ce n\'era un QUARTO, che la voce non conosceva**: spingendo l\'orologio finto a un '
      + 'anno è saltato fuori `clients/plan-start.spec.ts` («il messaggio dice la data di fine '
      + 'calcolata»), che chiedeva di spostare un piano al `2026-07-11`. Dal **12 luglio 2027** quella '
      + 'data supera il tetto dei 366 giorni e il servizio risponde «Data fuori intervallo (max un '
      + 'anno da oggi)» — cioè il test sarebbe diventato rosso **segnalando un controllo che non è '
      + 'quello che voleva verificare**, che è il modo peggiore di scadere. Corretto allo stesso modo. '
      + '⚠️ La lezione per la prossima volta: la scadenza si cerca spingendo l\'orologio **avanti di '
      + 'anni**, non fino alla prima data nota.\n\n'
      + '⛔ **E la revisione ha trovato che la correzione, da sola, non bastava** — misurato, non '
      + 'temuto: con `TZ=Europe/Rome` (ogni portatile del team; su Render `TZ` non è impostata) i due '
      + 'test sarebbero tornati rossi **otto giorni all\'anno**, perché il codice di produzione somma '
      + 'i giorni con `setDate`/`setMonth`, che lavorano nel fuso del processo e conservano l\'ora di '
      + 'parete. Il 28 marzo 2027 `setDate(+1)` su una mezzanotte UTC rende ancora il 28. Corretti i '
      + 'due punti: `agenda.service.creaFerie` (`+ 86_400_000`) e `commerce.subscriptionEnd` (le '
      + 'varianti `setUTC*`). ⚠️ Era anche un difetto **vero**, non solo dei test: la durata di un '
      + 'piano dipendeva da come è configurata la macchina che la calcola.',
  },
  {
    chiave: 'alimenti-da-correggere-senza-data',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    titolo: '✅ «Alimenti da correggere» dice di quando è l\'elenco, e si può rifare il conto senza aspettare la notte',
    dettaglio:
      '✅ **FATTO il 25/8.** Sotto il titolo dell\'elenco c\'è una riga che dice quando il passo notturno '
      + 'ha rifatto il conto — «Elenco rifatto oggi alle 03:12», «ieri alle 03:12», «il 23/08 alle '
      + '03:05» — e la frase «non è un conto dal vivo: lo riscrive un passo notturno».\n\n'
      + '⚠️ **La data viene dal REGISTRO, non da `updatedAt` sulle righe.** Sono due domande diverse: '
      + '«quando è girato il passo» e «quando è stata toccata questa riga». La seconda cambia anche '
      + 'quando una cliente chiede quel termine a Gaia, e la pagina direbbe «aggiornato due minuti fa» '
      + 'per un elenco vecchio di un giorno. `aggiornaIngredientiScoperti` lascia una riga '
      + '`nutrient_facts.scoperti_aggiornati` coi conti del giro, e se quella riga non si scrive il '
      + 'passo **non muore**: al massimo la pagina non dice la data.\n\n'
      + '⛔ **«Mai calcolato» e «vuoto» non sono la stessa cosa**, e la pagina non li confonde: senza '
      + 'nessuna riga di registro dice «Questo elenco non è mai stato calcolato» invece di far credere '
      + 'che non ci sia niente da correggere. E oltre le 26 ore avvisa che quello che hai caricato dopo '
      + 'non è ancora contato — 26 e non 24 perché ventiquattr\'ore sono la vita normale di un elenco '
      + 'notturno, e un avviso che compare ogni pomeriggio non lo guarda più nessuno.\n\n'
      + '✅ **E il pulsante «Rifai il conto adesso»**, che chiama **lo stesso** passo del cron (non una '
      + 'copia più svelta: due punti che rispondono alla stessa domanda devono essere lo stesso punto). '
      + 'Torna gli esiti veri — «11 righe aggiornate, 1 non si è scritta» — non un «fatto».\n\n'
      + '## Com\'era nata\n\n'
      + 'Nato da uno spavento vero, il 21/8 all\'una: dopo aver caricato 277 alimenti la pagina mostrava '
      + 'ancora `limone`, `cipolla`, `brodo vegetale`, `spinaci freschi` come **«Non in tabella»**, e la '
      + 'domanda di Simone è stata *«stiamo perdendo pezzi invece di farli?»*.\n\n'
      + '✅ **Nessun pezzo perso, e la spiegazione è misurata sul codice, non dedotta.** '
      + '`aggiornaIngredientiScoperti` è un **passo notturno**: calcola l\'elenco e lo **scrive** in '
      + '`nutrient_lookup_miss`. La pagina legge quelle righe scritte, non un calcolo dal vivo. '
      + 'L\'import è girato alle 19:43; il passo notturno non era ancora passato. Infatti '
      + '`npm run diag:crudo-cotto`, che calcola dal vivo, quei quattro non li segnalava già più.\n\n'
      + '⚠️ E il meccanismo che chiude un termine risolto **esiste già** (`risolto`, scritto il 20/8): '
      + 'la mia prima ipotesi — «le domande vecchie non si chiudono mai» — era **sbagliata**, e l\'ho '
      + 'verificata prima di scriverla qui.\n\n'
      + '⛔ **Quello che manca è una riga di testo**: la pagina non dice **di quando** è l\'elenco. Un '
      + 'elenco che può avere fino a ventiquattr\'ore e sembra vivo fa credere che il lavoro appena '
      + 'fatto non sia servito — ed è esattamente quello che è successo. *Un dato che agisce e non si '
      + 'vede.* Basta la data dell\'ultimo aggiornamento accanto al titolo, e — se si vuole — un '
      + 'pulsante per rilanciare il passo adesso invece di aspettare la notte.',
  },
  {
    chiave: 'digiuno-pubblicazione',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    titolo: 'Pubblicare il digiuno intermittente — le fondamenta sono scritte, restano i tre numeri',
    dettaglio:
      '⚠️ **Questa voce era stata aperta prima di misurare qualsiasi cosa, e lo diceva.** Adesso una '
      + 'parte è misurata e una parte è scritta: il testo di prima resta in fondo, perché una voce '
      + 'superata si riscrive dicendo cos\'è cambiato, non si cancella.\n\n'
      + '## ✅ IN PRODUZIONE dal 21/8 — backend, backoffice e app (OTA 2.2.2)\n\n'
      + '⚠️ **Verificato, non dedotto**: il manifest live risponde `"version": "2.2.2"`, e lo zip '
      + 'su GitHub ha lo stesso md5 di quello costruito (`d611875d…`). Backend e backoffice erano già '
      + 'saliti col commit precedente.\n\n'
      + '⛔ **E la scelta dei pasti è sparita del tutto** (Simone, 21/8): non c\'è più né la domanda '
      + 'del questionario, né la tendina della scheda staff, né i pallini nel profilo dell\'app. La '
      + 'finestra la scrive **solo** l\'orologio della cliente; in scheda si legge, non si tocca.\n\n'
      + '## ✅ Scritto e verde il 21/8 (consegna «orologio del digiuno»)\n\n'
      + 'Alla cliente non si chiede più **quali pasti salta** — una domanda astratta — ma **a che ora '
      + 'mangia**. `fastingWindow` resta il dato che il motore legge: non lo sceglie più nessuno a '
      + 'mano, lo **deriva** `menu/orologio-digiuno.ts` (modulo puro, 39 test).\n\n'
      + '⚠️ **La regola, ed è quella su cui avevo sbagliato la prima volta: la DURATA della finestra '
      + 'dice quanti pasti, la POSIZIONE non dice niente.** Il primo modello ancorava i pasti a ore '
      + 'fisse (colazione 08:00, pranzo 13:00…): provandolo, spostare la finestra di un\'ora cambiava '
      + '*cosa* mangi — e il manuale dice l\'opposto («gli orari si traslano liberamente, conta solo il '
      + 'blocco di digiuno»). Con quel modello l\'adattamento graduale — un\'ora al giorno per quattro '
      + 'giorni — sarebbe stato **quattro cambi di dieta di fila**. Il test lo prova su **tutte e 96 '
      + 'le posizioni** della giornata, non su tre casi scelti bene.\n\n'
      + '✅ **La prova che il modello regge**: 16:8 aperta alle 12:00 → **12:15 · 15:55 · 19:30**. Il '
      + 'piano del manuale (pag. 3) dice **12:00 · 16:00 · 19:30**. Non è tarato: esce dalla regola.\n\n'
      + '✅ **E chi digiuna oggi non si muove**: le tre occasioni della 16:8 danno pranzo, merenda e '
      + 'cena, cioè **esattamente** il catalogo digiuno di oggi (`skip_breakfast`, quote .45/.10/.45). '
      + 'Stessa struttura, stesso catalogo, stesso menu.\n\n'
      + '**Tre righe nuove in `FINESTRE_DIGIUNO`** — `skip_morning_snack` (finestra lunga, 4 pasti), '
      + '`skip_breakfast_and_snacks` (finestra stretta, 2), `skip_all_but_dinner` (OMAD, 1). ⚠️ '
      + '`struttura-per-digiuno.ts` **conta i pasti** invece di elencare le finestre, e infatti le ha '
      + 'accettate senza una riga di codice in più. ⚠️ E `skip_all_but_dinner` **non** è '
      + '`skip_breakfast_lunch`: fra le due c\'è la merenda, cioè un pasto intero — c\'è un test '
      + 'apposta perché nessuno le unifichi.\n\n'
      + '⚠️ **La derivazione cerca la riga DENTRO `FINESTRE_DIGIUNO`**, non con una seconda mappa: il '
      + 'giorno che qualcuno corregge una riga là, `finestraPerPasti` la trova da sé. E se un gruppo '
      + 'di pasti in tabella non c\'è torna `undefined` **senza ripiegare su una finestra vicina** — '
      + 'servire tre pasti a chi ne aspetta due è il difetto che a una cliente ha dato un pasto al '
      + 'giorno, e qui è chiuso dal davanti.\n\n'
      + '⚠️ **Il nome dello slot non è il nome che legge la cliente**: con la finestra 08:00-16:00 il '
      + 'motore chiama `lunch` il pasto delle 08:15, e scriverle «Pranzo alle 08:15» sarebbe dirle una '
      + 'cosa falsa. `etichettaPasto` dà «Primo pasto · Spuntino · Ultimo pasto». I nomi esatti li '
      + 'conferma la nutrizionista, e stanno tutti in quella funzione.\n\n'
      + '**Verificato:** suite intera **4179 su 4179**, **otto mutazioni su otto mordono**, e `npm run '
      + 'build` vero (`tsc -b && vite build`) verde su app e backoffice. ⚠️ `giornata-in-tre-forme` ha '
      + 'morso davvero: le tre forme nuove sono ora **dichiarate col motivo**, nel loro file.\n\n'
      + '## ⛔ Cosa ha trovato la revisione (sette cose, due gravi)\n\n'
      + '⛔ **Il difetto peggiore non era nel modulo nuovo: era nell\'averne pubblicato gli effetti '
      + 'senza le cause.** Le tre righe finivano nella **tendina del questionario**, sotto la domanda '
      + '«quali pasti preferisci saltare?», con due etichette che dicono i pasti che RESTANO: «Solo '
      + 'cena» lì si legge «salto solo la cena» e vuol dire **un pasto al giorno**. ⚠️ Il commento '
      + 'della tabella rivendicava già che quelle righe non si scelgono a mano, ma **nessuna riga di '
      + 'codice lo impediva** — una promessa senza guardia. → campo `selezionabile`, e '
      + '`FINESTRE_SELEZIONABILI` accanto a `VALORI_FINESTRA_DIGIUNO`: «cosa si accetta» e «cosa si '
      + 'propone» sono due domande.\n\n'
      + '⛔ **Nell\'app la card tornava con tutti i pallini spenti e nessuna spiegazione** — la voce '
      + '256 rifatta da un\'altra porta — e un tocco qualsiasi sovrascriveva la finestra derivata. '
      + '⚠️ Nel backoffice la `select` si presentava **vuota**, cioè «non impostata» per chi una '
      + 'finestra ce l\'ha: la protezione giusta esisteva venti righe sopra, su `dietFamily`, che è '
      + 'meno clinico.\n\n'
      + '⚠️ **Un difetto già in produzione, trovato di rimbalzo:** la mail del primo giorno riempiva '
      + '«comincia dal tuo **primo** pasto» con `pastoPrincipale`, che la tabella documenta come '
      + 'l\'**ultimo**. A una cliente 16:8 classica dice **già oggi** «comincia dal tuo primo pasto '
      + '(cena)». → campo `primoPasto` accanto, uno per domanda. E la push della 20-4 prometteva «un '
      + 'solo pasto completo» mentre la finestra ne tiene due.\n\n'
      + '⛔ **E un mio test non mordeva**: usava una finestra a un pasto solo, dove il ramo protetto '
      + 'non passa — tolta la protezione, restava verde. Riscritto, rimutato, adesso morde.\n\n'
      + '⚠️ **Due mie affermazioni erano false, corrette invece che cancellate.** «I nomi si prendono '
      + 'dal fondo della giornata»: a quattro pasti la **colazione** prende il posto dello spuntino '
      + 'del mattino, ed è la scelta che decide il catalogo. E «le clienti che digiunano oggi non si '
      + 'muovono»: vero **solo per `skip_breakfast`**. L\'orologio raggiunge **quattro finestre su '
      + 'otto**; le altre quattro — `skip_dinner` (il caso Sonia), `skip_lunch`, '
      + '`skip_breakfast_lunch`, `skip_dinner_breakfast` — al backfill **cambierebbero catalogo e '
      + 'quote**. `finestreRaggiungibili()` lo calcola e un test lo dichiara per nome: *niente tagli '
      + 'silenziosi*.\n\n'
      + '## ✅ Aggiunto il 21/8 sera — «a chi si chiede la finestra» (consegna 81)\n\n'
      + '**Otto colonne** su `ClientProfile` (protocollo, inizio, i due bersagli dell\'adattamento, i '
      + 'due del sonno, l\'ultimo cambio, e **`fastingSceltoIl`**) più la migrazione, tutte additive e '
      + 'nullable: il giorno del deploy in produzione non succede niente di visibile, ed è voluto.\n\n'
      + '⛔ **Il backfill non c\'è più, e non è un pezzo rimandato: è la decisione.** La specifica '
      + 'prevedeva di scrivere d\'ufficio protocollo e orario nel profilo di ognuna, dedotti dalla '
      + 'finestra storica — una traduzione fatta a tavolino, scritta nel profilo di persone vere mentre '
      + 'dormono. Adesso quella traduzione **esiste ancora ma non si salva**: è il valore con cui la '
      + 'pagina si apre. `fastingSceltoIl` NULL vuol dire «non gliel\'abbiamo ancora chiesto» — diverso '
      + 'da «non digiuna» — ed è quel NULL a far atterrare le sei clienti sulla pagina dell\'orologio al '
      + 'primo avvio. ⚠️ La regola **non guarda il calendario**: nessuna data di rilascio nel codice, si '
      + 'guarda se il dato c\'è. Così una riga sola serve le tre porte del §14 — chi digiuna da prima, '
      + 'chi ci passa domani, e chi ci mette lo staff fra sei mesi.\n\n'
      + '⛔ **Dove non so tradurre, non propongo niente.** Cinque clienti su sei sono su «salta la '
      + 'colazione», che l\'orologio riproduce **esatta**: per loro confermare non cambia un pasto. La '
      + 'sesta è su «salta la cena», che l\'orologio non sa fare: la pagina le si apre **vuota**, come a '
      + 'una cliente nuova, e quando sceglie parte la segnalazione. ⚠️ Nessuna eccezione scritta per lei '
      + 'nel codice: proporle la finestra «più vicina» sarebbe stato il suo stesso difetto rifatto da '
      + 'davanti — servire a qualcuno pasti che non ha chiesto perché somigliano ai suoi.\n\n'
      + '⛔ **`skip_lunch` ritirata** (`diag:digiuni`: zero clienti in digiuno). ⚠️ Ritirata, non '
      + 'cancellata: quel conteggio guardava **solo chi digiuna**, e non sapeva dire se il valore fosse '
      + 'rimasto scritto su qualche profilo passato a un altro percorso. → la riga esce dalle tendine e '
      + 'resta leggibile, e `diag:digiuni` adesso conta le finestre **su tutti i percorsi**: se torna '
      + 'zero anche lì, si toglie davvero. *Misura prima di decidere.*\n\n'
      + '**Verificato:** suite intera **4226 su 4226** (+47), **venti mutazioni su venti mordono** (più una controprova: un nome dentro un commento non deve accendere niente, e infatti non l\'accende), '
      + '`npm run build` verde su backend, app e backoffice.\n\n'
      + '## ⛔ Cosa ha trovato la revisione di questo pezzo (otto cose, tre gravi)\n\n'
      + '⛔ **`hidden` non nascondeva niente.** I pulsanti della finestra, nel profilo dell\'app, '
      + 'stavano su un `<div style={{ display: \'grid\' }}>` con `hidden={…}`. `hidden` funziona perché '
      + 'il foglio di stile **del browser** dice `[hidden] { display: none }` — ma uno stile inline è '
      + 'dell\'autore e **vince sempre**. Risultato: a una cliente con finestra derivata i pulsanti '
      + 'restavano a schermo sotto un riquadro che diceva «per cambiarla sposta la tua finestra», e un '
      + 'tocco qualsiasi la sovrascriveva. Esattamente il difetto che il commento sopra prometteva di '
      + 'impedire. → non si nasconde: **non si disegna**, e un test sul sorgente vieta `hidden={` nei due '
      + 'frontend.\n\n'
      + '⛔ **La ragione falsa era rimasta nel backoffice.** La voce conservata in fondo alla tendina '
      + 'portava un suffisso **fisso** — «dagli orari, non si sceglie qui» — per qualunque valore fuori '
      + 'lista. Vero per le tre che l\'orologio calcola; **falso** per `skip_lunch`, che è ritirata: '
      + 'mandava la coach a cercare un orario da spostare che non esiste. La stessa correzione l\'avevo '
      + 'fatta nell\'app e non qui. → un motivo per finestra, e un test che chiede che le derivate '
      + 'dicano «orari» e la ritirata **no**.\n\n'
      + '⛔ **`primoPasto` non era protetto da niente.** Il campo nato ieri per correggere la mail del '
      + 'primo giorno era scritto a mano su otto righe: rimettendoci il valore sbagliato, **tutti e 4216 '
      + 'i test restavano verdi**. Il difetto si poteva rifare in silenzio. → adesso il valore si '
      + '**ricalcola** da `salta` (un test che ricopia gli stessi otto valori non è una rete, è una '
      + 'seconda copia), e lo stesso per `pastoPrincipale`, che era controllato solo per «non è fra '
      + 'quelli saltati» — vero anche per un valore sbagliato.\n\n'
      + '⚠️ **Due commenti raccontavano cose che il codice non fa.** Le colonne del sonno erano '
      + 'descritte come se **da questa consegna** governassero il silenzio delle push: `fastingSleep` non '
      + 'compare da nessun\'altra parte, e quel silenzio oggi è una finestra **globale** uguale per '
      + 'tutte. Un campo dichiarato attivo e mai letto è un pezzo che nessuno implementa più. E il '
      + '«default 23:00/07:00» non esisteva: la colonna nasce NULL apposta, perché «non me l\'ha detto» '
      + 'non è «dorme dalle 23».\n\n'
      + '⚠️ **Il test del messaggio alla nutrizionista non poteva fallire**: passava il testo già '
      + 'tradotto e poi verificava che non ci fossero codici — vincolava la stringa scritta nel test, non '
      + 'la funzione. E l\'unico dato che il chiamante avrà in mano è `skip_dinner`. → la funzione '
      + 'prende il **valore** e traduce lei; un valore che la tabella non conosce si dice, dichiarandolo '
      + 'come codice. E non dice più «la finestra che **aveva**»: può averla scritta la coach cinque '
      + 'minuti prima.\n\n'
      + '⚠️ **Le etichette dei due frontend erano confrontate solo sulle chiavi**: si poteva cambiare '
      + '«Un pasto solo al giorno» in «Mangi solo a colazione» — falso — e la suite restava verde. Ora si '
      + 'confrontano **parola per parola** con la tabella.\n\n'
      + '⚠️ **E una mia giustificazione era già superata**: avevo scritto che una cliente uscita dal '
      + 'digiuno «si porta dietro la finestra». Non più — tutte e due le porte di scrittura la azzerano. '
      + 'Quello che il conteggio può ancora trovare sono le righe rimaste da **prima** di quella '
      + 'correzione, che è un motivo diverso e più piccolo, e sta scritto così.\n\n'
      + '## ✅ Aggiunto il 21/8 — i due metodi di cambio (consegna 82)\n\n'
      + '`menu/cambio-finestra.ts`: quale dei due metodi del manuale si applica, e cosa si scrive. '
      + '⚠️ **Lo decide la direzione, non la distanza.** Più tardi → il digiuno si allunga → è il '
      + '«reset», permesso subito. Più presto → si accorcerebbe → adattamento graduale, un\'ora al '
      + 'giorno, e il piano **lo esegue il sistema** (bersaglio in profilo + un passo per notte) '
      + 'invece di scriverlo a schermo come consiglio.\n\n'
      + '⚠️ La direzione si misura sulla **strada più corta**: le 08:00 sono quattro ore prima delle '
      + '12:00, non venti dopo, e le due letture portano a due metodi opposti. A dodici ore esatte il '
      + 'pareggio cade dalla parte che **allunga** — una parità non deve mai cadere dalla parte che '
      + 'accorcia.\n\n'
      + '⛔ **La revisione ha trovato sei difetti, quattro con la mutazione che sopravviveva.** Il '
      + 'peggiore: *rimandare non annulla*. A finestra già aperta lo spostamento in avanti vale da '
      + 'domani — giusto, un pasto già fatto non si disfa — ma le quattro ore in più **arrivano lo '
      + 'stesso stanotte**, e il sistema rispondeva «sedici ore» a un digiuno di venti. ⚠️ E il test '
      + 'che avevo scritto **cementava il numero sbagliato**: chi l\'avesse corretto avrebbe visto '
      + 'rosso e pensato di aver rotto qualcosa.\n\n'
      + '⛔ La causa era che tre rami rispondevano in tre modi diversi alla stessa domanda. Adesso c\'è '
      + '**una formula sola**: il digiuno va dall\'ultima chiusura (regola vecchia) alla prossima '
      + 'apertura (regola nuova). Da lì esce anche la proprietà che tiene tutto insieme, e che un '
      + 'test verifica su tutti e cinque i protocolli: **il digiuno in corso lo sposta l\'orario, non '
      + 'il protocollo**.\n\n'
      + '⚠️ Altre due: il passo che arriva da `config_param` non era controllato — a zero la cliente '
      + 'leggeva «in **Infinity** giorni apri alle 08:00» e il cron riscriveva lo stesso orario ogni '
      + 'notte per sempre; e la frase era cablata su «da domani» mentre il profilo veniva scritto per '
      + 'oggi.\n\n'
      + '**Verificato:** 4281 test su 4281, **tredici mutazioni su tredici mordono**.\n\n'
      + '## ✅ Aggiunto il 21/8 — le sei push (consegna 84)\n\n'
      + '`menu/push-digiuno.ts` più il tic `POST internal/cron/digiuno-push`, ogni dieci minuti. ⛔ '
      + '**Sei tipi non vuol dire sei notifiche al giorno**: 14:10, 16:8 e 23:1 ne mandano cinque, e '
      + 'ogni push tolta esce col **motivo scritto** — un silenzio senza spiegazione è '
      + 'indistinguibile da un guasto.\n\n'
      + '⛔ **La revisione ha trovato otto cose, e la prima era una regressione mia su una funzione già '
      + 'in produzione**: infilando la rotta nuova nel controller del cron avevo **rubato i decoratori** '
      + 'a `measures-nudge` (in TypeScript si attaccano all\'elemento che segue), e il sollecito misure '
      + 'sarebbe rimasto senza `@Public()` — 401 dal cron di Render, sollecito fermo. ⛔ E la rotta nuova '
      + 'non l\'avrebbe chiamata nessuno: mancava la voce in `render.yaml`. Adesso due test lo '
      + 'impediscono.\n\n'
      + '⛔ Le push arrivavano anche a chi **non ha più un piano** (o è archiviata, che le lascia i '
      + 'token push): sei notifiche al giorno per sempre.\n\n'
      + '⚠️ **Un difetto preesistente chiuso di rimbalzo**: il silenzio notturno dei solleciti misure '
      + 'era in UTC — «fra le 22 e le 8» voleva dire dalla mezzanotte alle dieci italiane. E il finto '
      + '`ConfigParamsService` dei test ignorava il valore di scorta, quindi in ogni test di quel file '
      + 'la guardia notturna era spenta: è il motivo per cui era sopravvissuto tanto.\n\n'
      + '## ✅ Aggiunto il 21/8 — l\'orologio in mano alla cliente (consegna 85)\n\n'
      + 'La pagina `/digiuno` col quadrante che si trascina, e la scheda in home che porta lì chi non '
      + 'ha ancora scelto. ⚠️ Si sposta **solo l\'apertura**: la durata la scelgono i bottoni, come '
      + 'vuole la Regola d\'Oro del manuale.\n\n'
      + '⛔ **La revisione ha trovato otto cose.** Il conto alla rovescia al centro **diceva il '
      + 'falso**: leggeva la finestra in corso di scelta, quindi mentre la cliente trascinava le '
      + 'diceva «stai digiunando» a chi poteva mangiare per altre sei ore — e la push avrebbe detto '
      + 'il contrario. I pallini dei pasti restavano disegnati **nelle ore di digiuno**. Sul telefono '
      + 'toccare una scritta spostava la finestra. Il quadrante era `role="img"`, quindi per chi usa '
      + 'un lettore di schermo non era **impostabile**. E l\'atterraggio automatico **cancellava il '
      + 'check-in** che stava compilando.\n\n'
      + '⛔ E **due test che non guardavano niente**: il flag `large-arc` dell\'arco SVG veniva letto '
      + 'in posizione 6 — la rotazione dell\'asse, sempre zero — e il flag `sweep` non lo guardava '
      + 'nessuno. Portandolo a zero l\'arco gira al contrario e disegna **le ore in cui non può '
      + 'mangiare**, con la suite tutta verde.\n\n'
      + '⚠️ E il **fuso**: l\'app leggeva l\'ora del telefono, il server ragiona in Europe/Rome. Una '
      + 'cliente in viaggio avrebbe letto una cosa sullo schermo e il contrario nella notifica.\n\n'
      + '## ⛔ Una decisione da prendere, tenuta in vista invece che scoperta fra un mese\n\n'
      + '⛔ **Tre finestre si possono ancora scegliere e l\'orologio non sa riprodurle**: «salta la '
      + 'cena», «salta colazione e pranzo», «salta cena e colazione». Conseguenza concreta: una cliente '
      + 'nuova sceglie oggi «Cena» nel questionario, e al primo avvio la pagina le si apre vuota e parte '
      + 'una segnalazione alla nutrizionista **per una scelta fatta cinque minuti prima**. Vale anche '
      + 'quando è la coach a scriverla: il sistema segnala a Lucia quello che Lucia ha appena deciso — e '
      + 'un avviso che arriva sempre non è un avviso.\n\n'
      + '⚠️ Non è un difetto del codice, che fa quello che deve. È una scelta con peso clinico: **o** '
      + 'quelle tre escono dalle tendine come `skip_lunch`, e allora la nutrizionista non può più '
      + 'prescrivere «salta la cena»; **oppure** la segnalazione va ristretta. Fino ad allora il numero è '
      + 'tenuto **scritto in un test**, che chiunque tocchi le tendine deve attraversare.\n\n'
      + '## ⛔ Cosa resta, e di chi è\n\n'
      + '⛔ **I tre numeri di prima restano quelli, e servono ancora**: `npm run diag:digiuni` (quante '
      + 'clienti e con che finestra — ⚠️ serve anche per decidere se `skip_lunch` si può eliminare: '
      + 'con l\'orologio non è disegnabile, sono due finestre corte); `npm run diag:catalogo` e '
      + '`diag:coda` (quante varianti digiuno approvate e complete); `npm run diag:kcal` (quante '
      + 'giornate sotto il fabbisogno).\n\n'
      + '⛔ **Quattro conferme della nutrizionista**, e la prima è la più urgente: chi dichiara una '
      + 'controindicazione **mentre sta già digiunando** — il caso della migrazione — si sospende '
      + 'subito o si aspetta? (Proposta: subito. I due errori sono asimmetrici, e la giornata piena è '
      + 'il comportamento normale del prodotto, non una misura d\'emergenza.) Poi: le tre domande '
      + 'cliniche e la soglia BMI; le quote per pasto prese dal manuale (**36 · 16 · 48** invece di '
      + '45/10/45 — ⚠️ la cena diventa il pasto più grande, è un cambio di forma della giornata); le '
      + 'soglie di durata → quanti pasti; i nomi che legge la cliente.\n\n'
      + '⛔ **Il resto della consegna**, nell\'ordine (✅ campi Prisma + migrazione: fatti; il backfill '
      + 'non c\'è più ed è la decisione, vedi sopra): '
      + '`PATCH /me/digiuno` coi due metodi di cambio; il cron del piano graduale; le sei push; '
      + 'l\'orologio in React e il widget in home; la scheda staff. Il foglio con tutto è '
      + '`Documents/Metabole/Digiuno_Orologio/` — `05_ALLINEAMENTO_21-8.md` per primo.\n\n'
      + '✅ **`pathType` è protetto da `change_diet_type` dal 28/8** — e con lui `mealsPerDay`, che aveva '
      + 'lo stesso buco. Era il difetto qui sotto: una coach non poteva cambiare vegetariana→vegana ma '
      + '**poteva mettere a digiuno chiunque**, che delle tre è la modifica più clinica. Era già in '
      + 'produzione, non introdotto da questa consegna, ed è chiuso in `pathtype-non-protetto`.\n\n'
      + '✅ **Niente rilascio agli store**: `@capacitor/push-notifications` c\'è già, nessun plugin '
      + 'nativo nuovo → **OTA 2.2.1** (sugli store c\'è la 2.2) + deploy backend, che va **per primo** '
      + 'perché la migrazione la applica Render.\n\n'
      + '---\n\n'
      + '*Il testo di quando questa voce è nata, il 21/8, prima di misurare:* quello che c\'è già — '
      + '`menu/finestre-digiuno.ts`, `catalog/struttura-per-digiuno.ts`, le varianti in catalogo, '
      + '`pickDietFor`, l\'attività che chiede la finestra quando manca, le porzioni scalate, '
      + '`diag:digiuni`. E i tre numeri da avere prima di scrivere codice, che sono ancora aperti.',
  },
  {
    chiave: 'seed-nutrienti-firma-falsa',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    titolo: '✅ Il seed azzerava i campi che non ha — corretto, e gli undici stati rimessi il 25/8. (La firma NON era falsa: mi ero sbagliato)',
    dettaglio:
      '⛔ **Trovato misurando, il 20/8 sera, mentre cercavo un\'altra cosa.** L\'import degli alimenti aveva '
      + 'creato «burro» con stato `crudo`; un quarto d\'ora dopo in tabella lo stato era `NULL` e la riga '
      + 'risultava **confermata**. Le date lo dicono senza margine: creata 19:43:36, confermata 19:58:07, '
      + 'modificata 20:12:46. In mezzo è passato `npm run seed:nutrienti`.\n\n'
      + '⚠️ `prisma/seed-valori-nutrizionali.ts` riga 301 scrive `state: r.state ?? null`, e su una riga '
      + '**non ancora confermata** riscrive **tutti** i campi — stato, sinonimi, macro — e poi **la firma**. '
      + 'Ha la guardia giusta per le righe già confermate («un deploy non deve disfare una decisione clinica») '
      + 'e **nessuna guardia per i dati più freschi dei suoi**: una riga creata quindici minuti prima da un '
      + 'import, con uno stato che il seed non ha, viene appiattita e timbrata come verificata.\n\n'
      + '⛔ **E quella firma è falsa.** «Confermato» in questa tabella vuol dire «un nutrizionista ha guardato '
      + 'questo numero». Nessuno ha guardato quelle undici righe: le ha firmate un seed. È lo stesso difetto '
      + 'di famiglia di tutta la giornata — qualcosa che dichiara di sapere una cosa che non sa — e qui è '
      + 'peggio del solito, perché la firma è il campo che decide se la riga esce dalla coda «da confermare», '
      + 'cioè se una persona la guarderà mai.\n\n'
      + '⚠️ **Danno vero, oggi:** undici alimenti comuni (burro, mandorle, noci, mela, pera, fragole, avocado, '
      + 'parmigiano, miele, pane integrale, ricotta) hanno perso lo stato che il foglio aveva compilato, e '
      + 'sono usciti dalla coda senza essere stati guardati. I sinonimi sono stati sostituiti con quelli del '
      + 'seed: la nuova «noci» non ne ha nessuno.\n\n'
      + '## ✅ 25/8 — FATTO SUL DATABASE VERO: `npm run ripara:stati`, undici su undici\n\n'
      + '✅ **Lanciato da Simone la sera del 25/8: `Scritte 11 · saltate 0 · fallite 0`.** Le tre '
      + 'condizioni hanno tenuto tutte — nome, stato vuoto e kcal — quindi ogni riga scritta è quella '
      + 'che lo script conosceva, non un\'omonima.\n\n'
      + '✅ **E l\'esito ha confermato da sé la correzione del titolo**: tutte e undici sono uscite '
      + 'con «✍️ confermata dal capo». La firma non era falsa; mancava la colonna, non lo sguardo.\n\n'
      + '✅ **Verificato dopo, con `npm run diag:crudo-cotto`**: gli undici nomi sono spariti dalla '
      + 'lista «senza stato» e i «già a posto» sono saliti a 297. Quello che resta in quella lista '
      + 'sono righe che uno stato non l\'hanno mai avuto — vedi `tabella-alimenti-igiene`, dove sta '
      + 'la decisione del 25/8 su come si sistemano.\n\n'
      + '## ⛔ E L\'ALTRA METÀ DEL DANNO — I SINONIMI. Misurata, e la risposta è: NON si rimettono\n\n'
      + '⚠️ **Stavo per chiudere questa voce lasciandone fuori metà**, e l\'ha visto la revisione '
      + 'avversariale: il testo qui sopra elencava **due** danni — lo stato azzerato **e i sinonimi '
      + 'sostituiti — e la chiusura parlava solo di stati. Un lavoro dichiarato finito a metà è '
      + 'peggio di un lavoro che resta in lista.\n\n'
      + '✅ **Misurato riga per riga** (fogli del repo contro `VALORI`): i sinonimi persi sono **tre**, '
      + 'e sono tutti e tre su righe di legumi e verdure **da cotto**:\n'
      + '· `ceci` — perso «ceci secchi» — riga a **132 kcal**, cioè `bolliti`;\n'
      + '· `lenticchie` — perso «lenticchie secche» — riga a **109 kcal**, cioè `bollite`;\n'
      + '· `zucca` — perso «zucca gialla» — riga a **18 kcal**, `bollita`.\n\n'
      + '⛔ **E rimetterli sarebbe stato un difetto, non una riparazione.** «Ceci secchi» su una riga '
      + 'con i valori da bollito vuol dire che una ricetta che scrive «ceci secchi» prende **132 '
      + 'kcal invece di 334**: il numero sbagliato di tre volte, che sembra buono — esattamente il '
      + 'difetto che `stato-alimento.ts` esiste per impedire, e lo stesso per cui la prima versione '
      + 'di `ripara:stati` è stata buttata. ⚠️ Quei sinonimi vanno a una riga **a crudo**, che è una '
      + 'riga diversa: se serve, si aggiunge dalla matita alla riga giusta, e non è un ripristino.\n\n'
      + '⛔ **E l\'accusa originale era sbagliata**: «i sinonimi sono stati sostituiti con quelli del '
      + 'seed, la nuova "noci" non ne ha nessuno». Misurato: nel foglio del 20/8 **tutte** le righe in '
      + 'comune col seed hanno `synonyms: []`, «noci» compresa. Non gliel\'ha tolti il seed: non li ha '
      + 'mai avuti. Resta scritto perché una voce sbagliata cancellata è una voce che qualcun altro '
      + 'riscriverà uguale.\n\n'
      + '⛔ **La prima versione dello script è stata buttata, e la ragione vale più dello script.** '
      + 'Leggeva i due fogli del repo e rimetteva lo stato a **chiunque** non ce l\'avesse, '
      + 'accoppiando sul nome. La revisione avversariale l\'ha smontata misurando: avrebbe scritto '
      + '`secco` su `ceci`, che in tabella ha i valori **da bollito** (132 kcal contro 334) — e '
      + '`secco` per il motore vale «a crudo», quindi 80 g di ceci sarebbero diventati 106 kcal '
      + 'invece di 267, **con l\'avviso «stato ignoto» che oggi lo ferma sparito**. Il difetto che '
      + '`stato-alimento.ts` esiste per impedire, introdotto dallo script che ne riparava un altro. '
      + 'E la colonna `state` del foglio 20/8 non è affidabile: `aceto di riso → secco`, '
      + '`acqua filtrata → crudo` mentre `acqua → liquido` — quel foglio dichiara esso stesso che 173 '
      + 'righe su 245 nascono da un riempimento automatico.\n\n'
      + '✅ **Adesso sono undici righe nominate una per una**, con lo stato del foglio e **le kcal con '
      + 'cui devono combaciare**. Scrive solo se valgono tutte e tre le condizioni: nome esatto '
      + '(normalizzato come la ricerca), stato **vuoto** (`NULL` **o** stringa vuota — `POST '
      + '/nutrient-facts` scrive `?? null`, che la stringa vuota non la converte), e **kcal che '
      + 'combaciano**. Le kcal sono l\'impronta della riga: se «burro» non fa più 758, non è la riga '
      + 'che lo script conosce, e non ci scrive. Tutto il resto lo elenca e non lo tocca.\n\n'
      + '⚠️ **Nessuna delle undici diventa «solo da cotto»** — misurato con `normalizzaStato`, non '
      + 'dedotto dai nomi: `crudo`/`cruda`/`fresco` → crudo, `secco` → secco, tutti stati «a crudo». '
      + 'Uno stato «bollito» su una di queste **toglierebbe** l\'alimento dalle ricette.\n\n'
      + '⚠️ **E il seed non le disferà**: `VALORI` non porta `state` per nessuna delle undici — è '
      + 'esattamente il motivo per cui il `?? null` le aveva svuotate — e dal 20/8 il seed scrive '
      + 'solo i campi che ha. Verificato riga per riga.\n\n'
      + '⚠️ **La firma non si tocca**, e non serve: queste undici stanno nella tabella firmata dal '
      + 'capo il 18/8. Quello che mancava era la colonna, non lo sguardo.\n\n'
      + '⚠️ **Rimettere la colonna non è decidere qual è la risposta giusta**: per il miele (e per '
      + 'l\'olio, che nell\'elenco non c\'è) la risposta vera può essere «non si applica», e quella '
      + 'la scrive una persona (voce `tabella-alimenti-igiene`). Lo script lo dice a schermo.\n\n'
      + '✅ E la frase falsa di `ripara:alimenti` («tolto il doppione **senza firma**») è già stata '
      + 'tolta: erano firmate tutte e due.\n\n'
      + 'Le due strade: **a)** il seed non tocca una riga più recente del suo elenco, e non firma mai — la '
      + 'firma la mette una persona; **b)** il seed scrive solo i campi che ha davvero, invece di azzerare '
      + 'quelli che non conosce (`state: r.state ?? null` diventa «se non ce l\'ho non lo scrivo»). ⚠️ Le due '
      + 'non si escludono, e la seconda è quella che vale anche per il prossimo campo che si aggiunge.\n\n'
      + '⛔ **E NON È UNA COSA CHE HA LANCIATO QUALCUNO: gira da sola a ogni deploy.** `render.yaml` riga 57 '
      + 'ha `preDeployCommand: … && npx prisma db seed && …`, e `prisma/seed.ts` chiama `seedValoriNutrizionali`. '
      + 'Si vede dall\'ora dell\'ultima modifica delle undici righe, che cambia a ogni giro: 20:12:46, poi '
      + '20:38:39. ⚠️ Quindi **il prossimo import subirà la stessa cosa al primo deploy successivo**, '
      + 'qualunque cosa importi: non è l\'incidente di una sera, è il comportamento normale. È il motivo per '
      + 'cui questa voce blocca: finché sta così, ogni riga caricata da uno script nasce con una firma falsa '
      + 'e senza lo stato che chi l\'ha compilata aveva scritto.\n\n'
      + '⚠️ E una conseguenza che vale la pena scrivere: **la coda «da confermare» si svuota da sola**. Quel '
      + 'campo esiste per decidere quali righe una persona deve ancora guardare; se un deploy le firma, '
      + 'quelle righe non le guarderà più nessuno. Un lavoro che sparisce dalla lista senza essere stato '
      + 'fatto è peggio di un lavoro che resta in lista.\n\n⚠️ **LA CODA DEL DIFETTO, misurata a fine serata con `npm run diag:crudo-cotto`.** In lista 2 («senza stato, e usati nelle ricette») ci sono **esattamente le undici righe rimesse a posto**, più l\'olio: `olio extravergine di oliva` 3024 ricette, `miele` 1333, `pane integrale` 931, `noci` 748, `parmigiano reggiano` 339, `burro` 295, `mandorle` 200, `avocado` 177, `mela` 114, `pera` 69, `fragole` 67, `ricotta di vacca` 57. Sono senza stato perché **il seed glielo ha azzerato**, e la riga restaurata è quella che lo stato non l\'ha mai avuto.\n\n✅ **Ma quello stato esiste ancora**, in `prisma/dati-alimenti-20-8.ts`: burro `crudo`, mandorle `secco`, noci `secco`, mela `cruda`, pera `cruda`, fragole `crudo`, avocado `crudo`, parmigiano `fresco`, miele `crudo`, pane integrale `secco`, ricotta `fresco`. Non è una deduzione: è la colonna compilata da chi ha fatto il foglio, cancellata da un `?? null`. Si rimette con uno script, **prova a vuoto prima**, riga per riga — sono 12 campi su alimenti usati in oltre 7.000 ricette. ⚠️ Su olio e miele però la risposta è «non si applica», ed è la voce `tabella-alimenti-igiene`: quella la scrive una persona dalla matita, non uno script.\n\n⚠️ **E una frase falsa stampata a schermo, da correggere.** `ripara:alimenti` dice «tolto il doppione **senza firma**», e non era vero: erano firmate tutte e due — la firma della nuova gliela aveva messa il seed. È rimasta dalla versione precedente della regola. Non ha cambiato niente di quello che è successo, ma **una ragione falsa stampata a schermo è la stessa malattia** di tutto il resto di questa voce, e va tolta insieme.\n\n⛔ **CORREZIONE, la sera stessa: il titolo di questa voce era SBAGLIATO, e la parte sbagliata era l\'accusa.** «La firma è falsa» non è vero. Le 57 righe di `VALORI` stanno dentro una funzione che si chiama `firmateDalCapo`, e sopra c\'è scritto: *«TUTTE LE RIGHE QUI DENTRO SONO NELLA TABELLA FIRMATA DAL CAPO NUTRIZIONISTA IL 18/8. La funzione esiste per una ragione sola: il confine dev\'essere visibile.»* Burro, mandorle, noci, mela, pera, fragole, avocado, parmigiano, miele, pane integrale e ricotta sono in quella tabella: **il capo nutrizionista le ha guardate davvero**. ⚠️ Avevo letto la riga della firma e non le quaranta sopra — lo stesso errore degli stati `liquido` e `fresco` di stamattina, e stavolta l\'accusa era al lavoro di una persona. Resta scritto qui: una voce sbagliata cancellata è una voce che qualcun altro riscriverà uguale.\n\n✅ **IL DIFETTO VERO ERA PIÙ STRETTO, ed è corretto.** `state: r.state ?? null` e `synonyms: r.synonyms ?? []` non vogliono dire «non ho questo campo»: vogliono dire **«azzeralo»**. Un seed è una **fonte**, non una fotografia dello stato finale: se non porta un dato quel dato resta com\'era, se lo porta vince lui. ⚠️ Valeva anche per l\'**indice glicemico**, che arriva da `importa:ig` e che il vecchio codice azzerava su ogni riga senza `gi`. Adesso l\'oggetto si costruisce solo con i campi che ci sono (`datiDellaRiga`), e `seed-non-azzera.spec.ts` lo tiene fermo con 8 test e tre mutazioni che mordono — compresa quella che confonde «campo assente» con «campo a zero», che su `sale` (0 kcal) sarebbe stata la prossima.\n\n⛔ **E UN DIFETTO MIO, trovato subito dopo:** lo script con cui aggiorno queste voci aveva attaccato un pezzo di testo **dentro la `chiave`** invece che nel dettaglio, perché in questa voce `categoria` viene subito dopo `chiave`. La chiave è la colonna su cui `carica:lavori` decide se una voce esiste già: con la chiave storpiata avrebbe creato un **doppione** invece di aggiornare. Corretto, e c\'è un test che pretende che ogni chiave sia una parola sola.',
  },
  {
    chiave: 'alimenti-numeri-copiati',
    titolo: '⛔ 173 righe su 245 del foglio alimenti hanno i valori copiati da un altro alimento',
    dettaglio:
      '⛔ **Il foglio dei 245 alimenti compilati non si può caricare.** La prova a vuoto di `npm run importa:alimenti` sui due elenchi insieme (32 righe del 19/8 + 245 del 20/8) ha mostrato che **173 righe su 245 hanno i valori nutrizionali identici a quelli di un altro alimento**. Non sono numeri sbagliati a caso: sono poche righe vere copiate su molti alimenti. **99 alimenti diversi** — tahina, ghee, miele, tempeh, branzino, polpo, fichi secchi, patate dolci, sesamo, olive nere, pangrattato, cacao amaro, stevia — hanno tutti esattamente «25 kcal, 1,5 proteine, 3,5 carboidrati, 2,5 zuccheri, 0,3 grassi, 2,2 fibre». Altri sette gruppi uguali: 19 fra farine e cereali tutti a 250, 15 latticini a 150, 14 fra frutta secca e semi a 600 (compreso «latte di mandorla non zuccherato», che è ~13), 8 pesci e carni a 120, 7 legumi cotti a 130, 7 frutti a 45, 4 legumi secchi a 320.\n\n⚠️ **Il mio controllo non l\'aveva visto, e non per distrazione.** Prima di farne un modulo avevo passato le 245 righe a un controllo di coerenza (Atwater: 4·proteine + 4·carboidrati + 9·grassi ≈ kcal). Ne segnalò **una**, e io dissi che il foglio era buono. Il controllo non aveva sbagliato: guarda **una riga per volta**, e una riga vera copiata resta coerente con sé stessa ovunque la si incolli. Nessun controllo di plausibilità interna può vedere un riempimento — la copia si vede solo mettendo le righe **accanto**.\n\n✅ **Cosa c\'è adesso.** Una guardia (`gemelli-alimenti.ts`) che raggruppa per valori identici e distingue i due casi che sembrano lo stesso: «pomodoro fresco / pomodori freschi / pomodoro pelato» **sono** la stessa cosa scritta in tre modi e passano, «tahina» e «peperone rosso» no. Gira **prima** di leggere la tabella — un import che parte e poi si accorge è un import che ha già scritto — e le scritture stanno in transazione: tutto o niente.\n\n⛔ **Cosa serve, e non lo può fare il codice**: le 173 righe vanno rifatte da chi ha compilato il foglio. È partito l\'Excel `alimenti_da_rifare_20-8.xlsx`, raggruppato per valore copiato, con le colonne da riempire. ⚠️ Le altre 72 righe erano a posto ma restano in attesa: lo script carica tutto insieme o niente, di proposito — mezza tabella caricata è una tabella di cui non si sa più a che punto era.\n\n✅ **CHIUSA la sera del 20/8: il foglio è stato rifatto e ricaricato.** Le 173 righe sono tornate compilate e questa volta il foglio è passato a **sei controlli** prima di diventare un modulo, non a uno: la **guardia dei gemelli** (la funzione vera del motore) dice **zero riempimenti** — restano 13 gruppi di valori identici e sono tutti lo stesso alimento scritto in modi diversi, «pomodorini / pomodoro ciliegia / pomodoro ciliegino», «filetto di merluzzo / merluzzo filetto» — e poi coerenza Atwater, stati riconosciuti dal motore, affidabilità IG, nomi doppi, valori impossibili. I valori distinti di kcal passano da **50 a 127** su 245 righe.\n\n⚠️ **Due cose misurate e NON corrette, scritte perché si sappiano.** **1)** La colonna dei carboidrati non usa sempre la stessa convenzione: 22 righe hanno più fibra che carboidrati (fibra esclusa, come il CREA), ma tre — `tahina`, `lievito nutrizionale`, `burro di arachidi naturale` — sommano oltre 100 g su 100, cioè lì la fibra è **dentro** i carboidrati. Sono 9, 20 e 6 g su alimenti che si usano a cucchiai: non sposta un piano, e non sono numeri miei da aggiustare. **2)** La colonna `category` è rimasta quella del riempimento: 19 alimenti sopra le 150 kcal sono etichettati «verdura» (tahina, miele, ghee, sesamo, tempeh, cacao, paprika). ✅ Non blocca niente — nel backend `category` serve **solo a ordinare l\'elenco** nella pagina Alimenti, non entra nei macro né nel menu — e si correggono dalla matita quando si passa di lì. ⛔ Non le ho indovinate io: dedurre la categoria dal nome sbaglierebbe sul primo caso nuovo, in silenzio, ed è la stessa cosa che ha prodotto il foglio.\n\n⚠️ **Resta un comando da lanciare**: `npm run importa:alimenti` per la prova a vuoto e poi `CONFERMA=1 npm run importa:alimenti`. Le righe nascono **non confermate** — «confermato» vuol dire «un nutrizionista ha guardato questo numero», e chi ha compilato il foglio non lo so.',
    categoria: DATI,
    ordine: 620,
    blocca: true,
    nata: '2026-08-20T18:30',
    fatta: true,
  },

  {
    chiave: 'esclusioni-radice-inizio-parola',
    titolo: 'La radice delle esclusioni toglieva 721 ricette in più: «olive denocciolate» non è frutta secca',
    dettaglio:
      'La mattina del 20/8 avevo aggiunto la ricerca per **radice** alle esclusioni, perché «mandorle» deve scattare anche su «mandorla». Sulle 118 ricette del catalogo del repo le righe in più erano quattro, tutte vere: **zero falsi positivi**, e l\'ho dichiarato sicuro. ⛔ Poi Simone ha lanciato `npm run diag:esclusioni` sul catalogo di **produzione**: su «frutta secca» la radice toglieva **721 ricette in più**, e a leggerle era sempre la stessa cosa — `⚠️ Filetto di sgombro al forno con limone e olive ← radice nocciol`. Uno sgombro con le olive tolto a chi è allergico alle nocciole. La colpevole è una parola sola: **«olive denocciolate»**, che contiene `nocciol`.\n\n⚠️ **Non è mai arrivato un allergene in tavola**: la radice *toglie* piatti, non ne lascia passare uno sbagliato. Ma a una cliente allergica alla frutta secca spariva **ogni piatto con le olive**, e un pool che si svuota così è un piano che non si riesce più a comporre.\n\n⛔ **E la nota che avevo lasciato nel codice indicava la leva sbagliata**: «se toglie roba che non c\'entra, alza `RADICE_MINIMA`». Non funziona: `nocciol` è già **sette** caratteri, alzare la soglia spegnerebbe la radice proprio sulle nocciole — cioè butterebbe via tutti i casi veri per cui esiste. Avevo in mente `polp`/`polpette`, dove il problema era davvero la lunghezza, e ho scambiato quel caso per la regola. **Il difetto non è quanto è lunga la radice: è DOVE combacia.**\n\n✅ **Corretto la sera del 20/8**: la radice conta solo se **comincia una parola**. `mandorl` in «latte di mandorla» sì, `nocciol` in «denocciolate» no. `RADICE_MINIMA` resta e non è ridondante: «polpette» comincia con `polp` a inizio di parola eccome, e il confine da solo non salverebbe le polpette da chi è allergico ai molluschi — due regole, due domande diverse. ✅ Rimisurato: «frutta secca» da **721 a 445** righe in più, e le 445 che restano dicono tutte una parola vera («mandorla», «nocciola», «arachide»). Le olive sono sparite.\n\n⚠️ **E la diagnostica adesso stampa la PAROLA del piatto**, non solo la radice. Prima diceva `← radice nocciol` e basta: per capire da dove venisse **ho dovuto indovinare** che fosse «denocciolate». Un elenco che va letto a mano deve dire il fatto, non il sospetto.',
    categoria: CODICE,
    ordine: 621,
    nata: '2026-08-20T18:50',
    fatta: true,
  },

  /**
   * ⚠️ **Le otto voci qui sotto vengono dal passaggio di consegne del 31/8** (sessione parallela) e
   * sono state messe in coda da Simone, non aperte di iniziativa. La prima è la più grave del
   * gruppo: fare la cosa sbagliata **con sicurezza** è peggio che non farla, perché nessuno
   * ricontrolla.
   */
  {
    chiave: 'vera-risponde-invece-di-creare-la-regola',
    categoria: CODICE,
    titolo: '⛔ Vera dice «fatto» e non ha creato nessuna regola: risponde alla segnalazione e chiude',
    dettaglio:
      '⛔ **Il difetto più grave del gruppo Vera.** La nutrizionista ha scritto «il merluzzo può essere '
      + 'sostituito con orata, salmone o spigola **estendi la regola a tutti**». Vera ha risposto: '
      + '*«Fatto: l\'ho scritta a Dany nella vostra chat, e ho chiuso la segnalazione»*. ⛔ **Non ha creato '
      + 'nessuna regola**: ha mandato un messaggio alla cliente e chiuso l\'escalation. Lei ha riprovato con '
      + '«crea la regola che…» e si è sentita rispondere «non ci arrivo».\n\n'
      + '⚠️ Non è un «non ho capito»: è un **«fatto» falso**. Chi lo legge non ricontrolla, e la regola che '
      + 'doveva valere per tutte le clienti non esiste da nessuna parte.\n\n'
      + '✅ **CHIUSA il 31/8.** Erano **due** difetti sovrapposti, e nessuno dei due era dove sembrava.\n\n'
      + '⛔ **Il primo: con una segnalazione aperta, `parla` non chiama nemmeno `capisci`.** Lo stato dirotta su '
      + '`rispondiAllaGirata`, che di suo guardava solo tre cose («la vedo io», «annulla», la lunghezza): tutto il '
      + 'resto era **per definizione** il corpo della risposta alla cliente. Adesso, se la frase è riconoscibile '
      + 'come un\'azione, Vera **chiede**: «questa mi sembra una regola, non una risposta — la scrivo o la mando?». '
      + '⚠️ Non si dirotta in automatico, perché «puoi sostituire il merluzzo con l\'orata» può essere davvero la '
      + 'risposta a una cliente che l\'ha chiesto: le due cose si distinguono solo sapendo cosa aveva in mente chi '
      + 'scrive.\n\n'
      + '⛔ **Il secondo: la frase non si capiva comunque**, e la causa vera è arrivata da una misura. '
      + '`leggiElenco` rifiutava **ogni alimento con l\'articolo** — «il merluzzo», «le zucchine, le melanzane» — '
      + 'perché il controllo anti-troncamento contava l\'articolo, che `nomeAlimento` toglie di proposito, come '
      + 'una parola persa: **cinque forme normali su sette** cadevano così. Più la forma **passiva** («X può essere '
      + 'sostituito con Y»), che nessun riconoscitore copriva, e la coda «estendi la regola a tutti», che finiva '
      + 'dentro l\'elenco dei pesci.\n\n'
      + '⚠️ **La revisione ha trovato sei rilievi su questa stessa consegna**, tre dei quali riaprivano il difetto: '
      + 'la coda che si mangiava l\'ultima lettera dell\'ultimo alimento («spigol», «lenticchi»), il participio nudo '
      + 'che **invertiva le negazioni** («il merluzzo NON può essere sostituito» diventava una regola), e '
      + 'l\'auto-risposta che scriveva la regola sulla cliente della segnalazione anche quando la frase ne '
      + 'nominava un\'altra. Dodici mutazioni provate, tutte uccise.\n\n'
      + '⛔ **Cosa NON chiude, ed è dichiarato**: la classe delle frasi resta più larga della famiglia coperta. '
      + '«il merluzzo **è sostituibile** con orata», «**al posto del** merluzzo può mettere orata», '
      + '«merluzzo **→** orata, salmone» non si capiscono ancora — e quindi vengono ancora inoltrate alla cliente. '
      + 'Il «fatto» falso però non c\'è più: senza riconoscimento, la frase è trattata come una risposta, che è '
      + 'quello che il testo dice.',
    ordine: 954,
    nata: '2026-08-31T18:00',
    fatta: true,
  },

  {
    chiave: 'vera-nome-cinque-frasi-su-venticinque',
    categoria: CODICE,
    titolo: 'Il nome di Vera: cinque frasi su venticinque non lo riconoscono, ed è il primo incontro',
    dettaglio:
      '`estraiNome` (`src/vera/vera-chat.ts:905`) non riconosce «ti **voglio** chiamare Vera» né «il tuo '
      + 'nome**,** sarà Vera» — la virgola. ⚠️ E soprattutto: **quando il nome c\'è già**, quelle frasi cadono '
      + 'in «non ci arrivo» invece di «mi chiamo già Vera, vuoi cambiarlo?».\n\n'
      + 'Sono cinque frasi su venticinque della pagina «frasi che non ho capito», e cadono nel **primo '
      + 'incontro** fra la nutrizionista e l\'agente: è il momento in cui si decide se fidarsi.\n\n'
      + '✅ **CHIUSA il 31/8.** Il modale in mezzo e «da oggi **sei** Vera» adesso si leggono, e a nome già '
      + 'dato le stesse frasi ricevono «Mi chiamo già Vera. Vuoi che da adesso mi chiami Lucia?» invece di '
      + '«non ci arrivo».\n\n'
      + '⚠️ **«il tuo nome, sarà Vera» funzionava già**: il passaggio di consegne la dava per rotta, la misura '
      + 'diceva il contrario. *Una cosa letta in un foglio si verifica nel codice prima di ripararla.*\n\n'
      + '⛔ **E la revisione ha fermato due difetti che questa consegna stava introducendo**, tutti e due nati '
      + 'dalla stessa causa: un estrattore che non aveva mai avuto bisogno di essere preciso — girava **un '
      + 'turno per account** — messo a decidere, con potere di scrittura, nello stato in cui l\'agente vive '
      + 'tutti gli altri giorni. «ti chiamo **domani**» proponeva di ribattezzarsi «domani», e a un «ok» '
      + 'distratto lo scriveva; «**tu** sei sicura?» battezzava «sicura». Adesso, a nome già dato, il '
      + 'candidato dev\'essere un **nome proprio** (maiuscolo o fra virgolette), i prefissi che non '
      + 'dichiarano una scelta sono spariti, e il ramo sta **dopo** «annulla» e la coda del capo: un '
      + 'riconoscimento che resta un indovinello su una parola non passa davanti a una risposta certa.',
    ordine: 955,
    nata: '2026-08-31T18:00',
    fatta: true,
  },

  {
    chiave: 'chat-nome-cliente-apre-la-scheda',
    categoria: CODICE,
    titolo: 'Nella chat, il nome della cliente apre la sua scheda in un\'altra finestra',
    dettaglio:
      'Chiesto da Simone il 31/8, guardando la chat con Sonia. Oggi il nome in cima alla conversazione è '
      + 'testo e basta (`backoffice/src/pages/Chat.tsx`, l\'intestazione): chi legge una chat e vuole '
      + 'guardare la scheda deve cambiare pagina e cercarla, perdendo la conversazione.\n\n'
      + '✅ **Il dato c\'è già lato pagina**: `Thread.client.id` arriva da `/staff/threads` ed è già usato per '
      + 'il deep-link dalla coda. Nessuna modifica al backend: è un link a `/clienti/:id` con `target="_blank"`, '
      + 'sul modello di `GraficaPdf.tsx` («Apri in una scheda»).\n\n'
      + '⚠️ Due accortezze: `client` può essere nullo (il link si mostra solo quando c\'è), e la scheda cliente '
      + 'sta dietro il permesso `clients`, **diverso** da `chat` — a una coach senza quel permesso il link '
      + 'aprirebbe una pagina «accesso non consentito». Va condizionato al permesso.\n\n'
      + '✅ **FATTA il 31/8**: il nome è un link con `target="_blank"`, mostrato solo a chi ha il permesso '
      + '`clients` — chi non ce l\'ha continua a vedere il nome come prima.',
    ordine: 963,
    nata: '2026-08-31T21:00',
    fatta: true,
  },

  {
    chiave: 'chat-messaggi-numerici-senza-contesto',
    categoria: CODICE,
    titolo: '⛔ Nella chat arrivano «1» e «2» e nessuno capisce di cosa si parla',
    dettaglio:
      'Chiesto da Simone il 31/8: *«se il nutrizionista legge 1 e 2 come fa a capire di cosa si parla? '
      + 'mettiamo un breve riassunto — la signora Romina vuole correggere il pollo nel pranzo di domani»*.\n\n'
      + 'I numeri nascono dalle domande a scelta multipla di Gaia (il cambio piatto in chat, con gli elenchi '
      + 'numerati chiesti da Simone il 24/8). Quando la cliente risponde «1», il messaggio viene **inoltrato** '
      + 'nel thread della coach/nutrizionista con `meta: {forwardedFrom: "ai", motivo: "cambio_piatto"}` — '
      + 'cioè il numero nudo, **senza il testo della domanda**, senza il thread di origine, senza l\'id del '
      + 'messaggio di Gaia.\n\n'
      + '✅ **Il contesto esiste già, e non va inventato**: lo stato del dialogo (`StatoSostituzione`) vive nel '
      + '`meta` del messaggio di Gaia e porta data, pasto, piatto, cibo, e perfino `ultimaDomanda` — «l\'ultima '
      + 'domanda che Gaia ha fatto, parola per parola». E la frase in italiano è già scritta per le '
      + 'segnalazioni: «Cambio in chat: «pollo» → «tacchino» (pranzo di 2026-09-01: Pollo alle erbe, 120 g)».\n\n'
      + '**Da fare:** copiare quella stringa nel `meta` del messaggio inoltrato (più il riferimento al '
      + 'messaggio di Gaia) e mostrarla nella chat sotto/sopra il numero. `listMessages` restituisce già '
      + '`meta`; nella scheda cliente il tipo lo dichiara di già, nella pagina Chat no.\n\n'
      + '⛔ **Il buco da coprire**: nei rami «arresa» (Gaia non ha capito due volte) il messaggio viene girato '
      + '**senza** aprire nessuna segnalazione, quindi quella frase non viene prodotta — ed è proprio il caso '
      + 'più probabile per un «1» orfano. Lì il contesto va composto dallo stato (`ultimaDomanda` + piatto + '
      + 'data), non riusando il testo della segnalazione.\n\n'
      + '✅ **FATTA il 31/8**, e il buco è coperto: `contestoPerLoStaff` compone la riga **dallo stato del '
      + 'dialogo** — «Vuole cambiare «pollo» — pranzo di domani, «Pollo alle erbe». Gaia le aveva chiesto: '
      + '«…»» — e i rami «arresa» adesso portano con sé `ultimoStato` apposta (⚠️ **non** `stato`: quello '
      + 'riaprirebbe un dialogo che è finito). Se lo stato non dice niente, **non si scrive niente**: meglio '
      + 'un numero nudo che una frase plausibile e sbagliata sotto gli occhi di chi decide.',
    ordine: 964,
    nata: '2026-08-31T21:00',
    fatta: true,
  },

  {
    chiave: 'menu-a-mano-cosa-non-copre',
    fatta: true,
    categoria: CODICE,
    ordine: 2,
    nata: '2026-09-03T13:30',
    titolo: '⚠️ Menu scritto a mano: due buchi chiusi la sera stessa, e quello che resta',
    dettaglio:
      'Scritta il 3/9 chiudendo `menu-scritto-a-mano-dalla-scheda`, perché una voce chiusa esce '
      + 'dall\'elenco e con lei uscirebbero questi limiti. Sono **dichiarati**, non scoperti dopo — '
      + 'e i due che mordevano sono stati chiusi la sera stessa.\n\n'
      + '✅ **1. LE PORTE CHE CANCELLANO: chiuse quasi tutte, in un posto solo.** L\'intoccabilità '
      + 'copriva tre porte su nove. Le altre passano tutte da `codaDaRifare`, che rende **tutto '
      + 'quello che sta dopo**: la nutrizionista dettava «niente pesce» a Vera e si cancellava da '
      + 'sola la giornata che aveva appena composto. ⚠️ Adesso le giornate scritte a mano **escono '
      + 'dalla coda** dentro `codaDaRifare` — quindi per **tutti** i chiamanti insieme: i due divieti '
      + 'dettati a Vera, «più proteine», la regola di dieta approvata dal capo (che gira su molte '
      + 'clienti) e i tre script. ⛔ **Non bloccano, si saltano**: un giorno aperto dalla cliente '
      + 'ferma la coda perché la ricomposizione partirebbe da un punto che lei ha in mano; questo '
      + 'resta suo e basta. E il buco in mezzo non è più un problema — dal 25/8 `dateDaComporre` '
      + 'ricompone anche le date interne. ⚠️ La coda dice adesso **quante ne ha tenute**.\n'
      + '⚠️ Resta scoperto `sostituzione-chat.service.ts`, che ricostruisce il pasto campo per campo '
      + 'e perde il marchio — ma scrive `cambioPiatto`, che rende la giornata intoccabile **da un '
      + 'altro segnale**: l\'effetto non cambia, e se la cliente si è fatta cambiare quel piatto la '
      + 'scelta della nutrizionista per quello slot non c\'è più comunque.\n\n'
      + '✅ **2. IL CANCELLO A VALLE: c\'era già, e la prima stesura di questa voce lo diceva male.** '
      + 'Avevo scritto che la giornata a mano «non passa da nessun cancello» e che chiuderlo era '
      + '«una riga». Non è vero: dalla correzione della sera, la scrittura **rivaluta ogni ricetta** '
      + 'con `valutaRicetta` e le stesse `esclusioniDi` che usa `evaluateMeals`, col nome del piatto '
      + 'infilato fra gli ingredienti e le sostituzioni portate fino al pasto scritto. ⚠️ È **la '
      + 'stessa regola**, non una copia — vive in `esclusioni-della-cliente.ts` e la chiamano tutti '
      + 'e due. Quello che resta fuori è la forma: `evaluateMeals` fa anche il merge di '
      + '`subsByRecipe` su una giornata intera, che qui non serve perché si valuta pasto per pasto.\n\n'
      + '⚠️ **3. Il pool è uno scatto, non quello del motore.** Si legge `ClientMenuPool`, come fanno '
      + 'Vera e il cambio piatto in chat; il motore compone da `pool-del-paniere.ts`. Una ricetta '
      + 'entrata in catalogo dopo l\'ultimo «Rifai base ricette» **qui non compare** — e quel '
      + 'pulsante è sulla stessa card, apposta. ⛔ Il giorno che si volesse chiudere davvero, la '
      + 'strada non è copiare il pool del motore qui: è far scrivere `ClientMenuPool` anche a chi '
      + 'cambia il catalogo, che è una voce sua.\n\n'
      + '⚠️ **4. `scrittaAMano` non è un `where`.** Sta dentro `meals`, quindi chi deve saltare i '
      + 'giorni a mano li **carica e filtra in memoria**. Sulla singola cliente non costa niente; su '
      + '`applica-proposta`, che gira per dieta su molte clienti, è una lettura in più per cliente. '
      + 'Il giorno che pesasse è un `ALTER TABLE ADD COLUMN` nullable, sul modello del 1°/9.\n\n'
      + '✅ **5. IL CAMBIO DI TIPO DIETA: chiuso il 3/9 sera.** Era il caso più sgradevole, perché '
      + 'l\'intoccabilità lavorava **contro** la cliente: la nutrizionista compone giovedì col '
      + 'salmone, mercoledì la cliente passa a vegana, e quella giornata la saltiamo **apposta**. '
      + 'Adesso `redeliverFutureDays`, dopo aver erogato, guarda le giornate a mano rimaste contro '
      + 'il regime della dieta **appena erogata** e apre un\'attività alla nutrizionista — il quinto '
      + 'tipo di `TIPI_DELLA_NUTRIZIONISTA`, quindi le arriva anche la push e la vede nella sua '
      + 'Dashboard.\n'
      + '⚠️ **Si segnala, non si cancella**: buttare via il lavoro di una persona senza dirglielo è '
      + 'il difetto che l\'intoccabilità esiste per impedire, e «Branzino di melanzane» è un piatto '
      + 'vegano davvero — `classifica` lo manda nei **dubbi** apposta, e il testo lo dice («forse» '
      + 'invece di «contiene»). E c\'è tempo: quei giorni sono tutti **dopo oggi**, e la scadenza è '
      + 'il giorno **prima** di quella giornata, non un generico domani.\n'
      + '⛔ Il testo dice **che il piatto arriva lo stesso** e **cosa fare**: un avviso che non nomina '
      + 'la conseguenza si legge come una segnalazione di catalogo e si rimanda, e la giornata è '
      + 'intoccabile dal motore — se non la tocca lei non la tocca nessuno.\n'
      + '⚠️ Quello che questo controllo **non** vede: `classifica` guarda carne e pesce. Un passaggio '
      + 'a «senza glutine» o «senza lattosio» no — ma quelli non sono un regime, sono esclusioni '
      + 'della cliente, e passano dal filtro che gira a **ogni** scrittura.\n'
      + '⛔ E aggiungendo il quinto tipo ho ripassato **le quattro condizioni** che '
      + '`avvisi-attivita.ts` avverte di controllare a mano — elenco, ruolo nel controller, permesso '
      + 'di pagina, icona in pagina — invece di aggiungere una riga al conteggio e chiamarlo fatto: '
      + 'quel commento dice per esteso che l\'unico test che si accende è quello che li conta.\n\n'
      + '⚠️ **6. Nessun limite sul passato**: si può scrivere il menu di un giorno già passato. Non '
      + 'fa danno — è uno snapshot — ma non serve a niente.\n\n'
      + '**Quello che resta** è il 3 (il pool è uno scatto), il 4 (`scrittaAMano` non è un `where`) '
      + 'e il 6 (nessun limite sul passato): nessuno dei tre può arrivare nel piatto di qualcuno, e '
      + 'tutti e tre si chiudono da sé il giorno che pesano davvero.'
      + '\n\n✅ **CHIUSA — Simone, 5/9: «accettato così».** I tre limiti che restano (il pool è uno scatto, `scrittaAMano` non è un `where`, nessun limite sul passato) non arrivano nel piatto di nessuno e si riaprono il giorno che uno pesa.',
  },

  {
    chiave: 'menu-scritto-a-mano-dalla-scheda',
    categoria: CODICE,
    titolo: '✅ Il menu scritto a mano dalla scheda cliente — la via d\'uscita che il 31/8 non c\'era',
    dettaglio:
      'Il 31/8, con una cliente senza menu, sarebbe stata la via d\'uscita in cinque minuti. Non '
      + 'esisteva.\n\n'
      + '✅ **CONSEGNATO il 3/9.** Dalla scheda si sceglie una data — una per volta — e per ogni '
      + 'pasto si cerca nel suo paniere. Le tre cose che lo rendono utile invece che pericoloso, '
      + 'come concordato con Simone:\n'
      + '· la ricerca è **filtrata sulle sue esclusioni**, e le incompatibili compaiono **barrate '
      + 'col motivo** — non tolte: chi non sa perché un piatto non c\'è, lo cerca. Servirle richiede '
      + 'di forzare e **scrivere perché** (almeno cinque caratteri: «ok» non è un motivo);\n'
      + '· le **kcal si sommano** mentre scegli, col fabbisogno davanti e la banda della **sua** '
      + 'dieta, non quella globale;\n'
      + '· il giorno scritto a mano è **intoccabile**: «Rigenera menu», il cambio di tipo dieta e la '
      + 'ripartenza dal piano lo saltano. ⚠️ La regola sta in **un posto solo** '
      + '(`vera/menu-da-rifare.ts`, accanto a `siPuoCancellare`): viveva in uno script di `prisma/` '
      + 'che conosceva **una** delle porte che cancellano giornate.\n\n'
      + '⚠️ Più la **chiave di permesso sua** (`menu_a_mano`), nata insieme alla guardia che la '
      + 'legge. Non è `clients`: aprire la scheda di una cliente e **scriverle il menu** sono due '
      + 'poteri diversi.\n\n'
      + '⛔ **E LA REVISIONE AVVERSARIALE HA FERMATO UNA VERSIONE PERICOLOSA.** La prima stesura '
      + 'leggeva `bloccata` e `motivoBlocco` **dal corpo del POST**, cioè dal browser: bastava '
      + 'mandare `{"bloccata": false}` perché un piatto con l\'allergene finisse nel menu senza '
      + 'avvisi, senza conferma e **senza traccia nel registro** — che filtra le forzature proprio '
      + 'su quel campo. E `name` e `kcal` erano anch\'essi del client, dove `kcal` è il numero che '
      + 'l\'app somma da sola in tre schermate. ⚠️ Il commento sopra la scrittura diceva «il '
      + 'giudizio gira anche qui»: era vero per la struttura e **falso sulla sicurezza** — il server '
      + 'non giudicava, ripeteva. *Il client può proporre; non può certificare.*\n\n'
      + '⛔ **Altri cinque difetti della stessa passata**, tutti trovati dalla revisione e nessuno '
      + 'dalle mie prove:\n'
      + '· le **sostituzioni si perdevano** — è la voce 953 rientrata da una porta nuova il giorno '
      + 'dopo averla chiusa. `valutaRicetta` alza una violation **solo se non c\'è un sostituto**: '
      + 'un piatto col latte per un\'intollerante al lattosio esce **non barrato**, con dentro '
      + '«latte → delattosato», e perderla vuol dire scriverle la giornata senza la riga che glielo '
      + 'dice;\n'
      + '· **nessun perimetro**: con `menu_a_mano: manage` — il default della nutrizionista — si '
      + 'scriveva il menu di **qualunque** cliente, e se ne leggevano le esclusioni dai motivi;\n'
      + '· `visibleFrom: date` rendeva la giornata visibile **il giorno stesso**: niente spesa in '
      + 'anticipo, il contrario di quello che il progetto ripete su questo punto;\n'
      + '· gli slot ignoravano la **finestra del digiuno**: a una cliente in 16:8 la schermata '
      + '**pretendeva la colazione** — cioè il difetto `menu-composti-con-un-pasto-in-piu`, citato '
      + 'nel commento come se fosse stato evitato;\n'
      + '· la giornata nasceva **non riscrivibile dalla sua autrice**: per una cliente che non ha '
      + 'mai aperto l\'app `apertureDal` è nullo, quindi «non si sa se l\'ha aperto» era vero '
      + 'subito e chi sbagliava un piatto non poteva più correggerlo. Adesso quello **avvisa e si '
      + 'conferma**, non ferma.\n\n'
      + '⛔ **E la conferma era un vicolo cieco.** Il client calcolava il flag nello stesso clic — '
      + 'quindi non era una conferma — e sbagliava: per una cliente **senza fabbisogno calcolabile** '
      + 'il server chiedeva conferma, il client mandava `false`, e non c\'era **nessun modo di '
      + 'riprovare**. Cioè la giornata non si poteva scrivere, mai, proprio alla cliente appena '
      + 'entrata — il caso del 31/8. Adesso il secondo pulsante compare **dopo** che il server ha '
      + 'detto cosa c\'è da confermare, accanto alla frase che l\'ha detto.\n\n'
      + '🧪 Quattordici mutazioni su quattordici uccise. ⚠️ Tre erano sopravvissute perché le prove '
      + 'guardavano **accanto** al punto: il fixture della ricetta vietata aveva sia il tag sia '
      + 'l\'ingrediente (quindi «il nome non entra più fra gli ingredienti» non si vedeva), non '
      + 'c\'era nessuna ricetta spenta, e togliere la guardia dalla **classe** lasciava la chiave '
      + 'letta lo stesso dal `POST`. Da lì una prova **sui decoratori**, che è l\'unico posto dove '
      + '«chi può bussare» si vede senza avviare l\'applicazione.\n\n'
      + '▶️ **Quello che resta, e sta in `menu-a-mano-cosa-non-copre`.**',
    ordine: 956,
    nata: '2026-08-31T18:00',
    fatta: true,
  },

  {
    chiave: 'vera-vocabolario-quattro-gruppi',
    fatta: true,
    categoria: CODICE,
    ordine: 4,
    nata: '2026-08-31T14:00',
    titolo: '▶️ Il vocabolario di Vera: chiuse le cortesie, restano le liste, la coda e le ricette',
    dettaglio:
      'Dalla pagina «frasi che non ho capito» (25 in 90 giorni), i gruppi rimasti dopo gli elenchi e '
      + 'il nome:\n'
      + '· **liste di catalogo** (5) — «crea la lista dei formaggi molli», «aggiungi equivalenza»;\n'
      + '· **la coda** (3) — «chiudi ilaria», «hai segnalazioni per me?»;\n'
      + '· ✅ **le cortesie** (4) — «ok», «ok ciao», «Quale?», «ok annulla tutto»;\n'
      + '· **le ricette** (2) — sostituire un **piatto**, non un alimento.\n\n'
      + '✅ **LE CORTESIE SONO CHIUSE, 3/9.** Erano quelle che sembravano le meno importanti — e '
      + 'sono quelle che fanno sembrare l\'agente stupido: *«ok» che riceve «non ci arrivo» è la '
      + 'risposta che una persona racconta agli altri.* Adesso `vera/cortesie.ts` le riconosce e '
      + 'ognuna ha una risposta **sua**: un unico «va bene» sarebbe cortese e inutile.\n'
      + '⛔ **E la presa d\'atto dice che non c\'era niente in sospeso.** Chi scrive «ok» a vuoto '
      + 'quasi sempre **crede** di stare rispondendo a una domanda che non vede più: un «va bene» e '
      + 'basta la lascerebbe convinta di aver confermato qualcosa. Stessa cosa per «Quale?», a cui '
      + 'si risponde che manca il contesto e **non** «non ci arrivo»: quella frase è chiarissima.\n\n'
      + '⛔ **La cosa che conta di più è DOVE non intervengono.** Dentro una conferma «ok» vuol dire '
      + '**sì** e lo legge `leggiConferma`: leggerlo là come cortesia vorrebbe dire **buttare via '
      + 'una conferma in silenzio**, cioè una regola che la nutrizionista crede scritta e non lo è. '
      + 'Il modulo si chiama **solo** dal ramo in cui si sa che non c\'è niente in sospeso, e una '
      + 'mutazione che lo sposta dentro la conferma è uccisa.\n\n'
      + '⛔ **E «fermati» è una regola A PARTE, più larga.** Le cortesie si riconoscono **solo da '
      + 'sole** — «ok» dentro «ok togli il tonno» è un intercalare, e prenderlo vorrebbe dire '
      + 'mangiarsi l\'istruzione. «Annulla» vale invece **ovunque** nella frase, perché chi lo '
      + 'scrive vuole che ci si fermi qualunque cosa venga dopo: la frase vera che l\'ha insegnato è '
      + '«lascia stare, ti chiamo Lucia», che whole-phrase sarebbe scivolata fino a far proporre a '
      + 'Vera di ribattezzarsi. ⚠️ Sono due regole diverse, e stanno **vicine nello stesso modulo** '
      + 'coi loro perché invece che sparse: una prova già esistente ha preso il tentativo di '
      + 'unificarle.\n\n'
      + '🧪 Sette mutazioni su sette uccise, e 46 prove sulle forme che arrivano da una tastiera '
      + 'vera — «OK!!», «ok 👍», «grazie ciao», «ci sentiamo» — più l\'elenco di quelle che **non** '
      + 'devono passare.\n\n'
      + '▶️ **QUELLO CHE RESTA.** I tre gruppi sopra, e le **forme di sostituzione** misurate il '
      + '31/8: «il merluzzo **è sostituibile** con orata», «**al posto del** merluzzo può mettere '
      + 'orata o spigola», «merluzzo **→** orata, salmone». Su queste Vera non riconosce niente, '
      + 'quindi — dentro una segnalazione aperta — le **inoltra alla cliente** come risposta. Non '
      + 'dice più «fatto» a vuoto, ma la regola non nasce.\n'
      + '⚠️ Quelle sono lettura di frasi, cioè il terreno su cui questo progetto ha già sbagliato '
      + 'due volte in due giorni (la guardia che spegneva ventuno frasi normali, e il confronto per '
      + 'prefisso che mangiava «provola» e «passata di pomodoro»). Chi le prende parta dal corpus '
      + '`frasi-normali-che-devono-passare.spec.ts` e **misuri prima** quante frasi vere smettono di '
      + 'passare — non dopo.\n\n'
      + '✅ **LE FORME DI SOSTITUZIONE SONO CHIUSE (le due che si possono chiudere), 3/9.** Adesso '
      + 'le forme stanno in un modulo solo — `food-swaps/forme-di-sostituzione.ts` — e le usano '
      + '**tutt\'e due le strade**. ⛔ Il caso che spiega perché serviva: «il merluzzo può essere '
      + 'sostituito con orata **o spigola**» si leggeva e «…con orata» **no** — la forma passiva la '
      + 'conosceva solo il ramo a elenchi, che però risponde `null` quando un elenco non c\'è, e il '
      + 'ramo singolo non la conosceva affatto. **La frase cadeva nel mezzo**, e dentro una '
      + 'segnalazione aperta Vera la inoltrava alla cliente come risposta.\n'
      + '✅ Chiuse: la **passiva** con l\'aggettivo («il merluzzo **è sostituibile** con orata», che '
      + 'è un aggettivo e non un participio — per questo la riga dell\'ausiliare non poteva '
      + 'prenderlo) e «**al posto del** merluzzo può mettere orata», che **apre** la frase invece di '
      + 'stare in mezzo. Più i verbi con cui una persona scrive davvero: «mangia», «scegli», '
      + '«prova», «alterna» — l\'elenco divergeva da quello vicino, e una divergenza fra due elenchi '
      + 'dello stesso dominio è un silenzio su frasi normali.\n\n'
      + '⛔ **LA FRECCIA È RIMASTA FUORI, ed è una decisione misurata.** La prima stesura la '
      + 'leggeva; una revisione avversariale l\'ha provata su **venticinque righe di chat vere con '
      + 'una freccia dentro: sedici diventavano una regola**. «legumi → 3 volte a settimana», «olio '
      + 'evo → 3 cucchiai al giorno», «da eliminare → pane, pasta e riso» (il **rovescio** di quel '
      + 'che c\'è scritto). ⚠️ E non sono regole inerti: a sinistra c\'è un alimento vero di '
      + 'catalogo. La ragione è strutturale — le altre due forme hanno un\'**ancora lessicale** '
      + '(l\'ausiliare, il verbo del mettere) che dice «questa frase è un ordine di sostituzione»; '
      + 'la freccia non ha niente, e in una chat di nutrizione significa anche una frequenza, una '
      + 'quantità, un progresso di peso. **Si riapre quando si saprà distinguere «alimento → '
      + 'alimento» da «alimento → quantità»**: sta scritto come prove che diventano rosse se '
      + 'qualcuno la rimette senza quella regola.\n\n'
      + '⛔ **E DI PASSAGGIO: UN DIVIETO VENIVA ESEGUITO COME ORDINE.** Trovato scrivendo le prove, '
      + 'non rileggendo il codice: in `sostituzione-a-elenchi.ts` `daScartare` girava **dopo** il '
      + 'ramo imperativo, quindi «**mai** sostituire il pane con le gallette» ed «**evita di** '
      + 'sostituire…» arrivavano fino in fondo come ordini — il **contrario** di quanto scritto, nel '
      + 'ramo che *esegue*. Il «non» lo fermava un controllo più a monte; «mai» ed «evita» no.\n'
      + '⚠️ **E la prima correzione costava diciassette frasi normali**: applicava `daScartare` al '
      + 'messaggio intero, e in italiano la negazione sta quasi sempre in un\'altra proposizione — '
      + '«non digerisce il glutine, sostituisci la pasta con il riso» si spegneva. ⛔ Il commento '
      + 'dichiarava quel costo «misurato» e non lo era: adesso la negazione si cerca **nella '
      + 'proposizione che contiene il verbo**, e le diciassette sono nel corpus.\n\n'
      + '⛔ **E il troncamento sulla «e» era tornato dalla porta nuova**: «il pane **e** la pasta '
      + 'possono essere sostituiti con il riso» imparava «pasta». `eUnElenco` conosce la virgola e '
      + 'l\'«o», non la «e» (di proposito: «sale e pepe» è un nome solo) — la guardia giusta era '
      + '`nomeTroncatoSuCongiunzione`, che stava solo sul ramo in avanti.\n\n'
      + '15 prove di mutazione, tutte prese, e **due revisioni avversariali**: la seconda ha trovato '
      + 'la freccia, il troncamento e le diciassette frasi. ⚠️ Nessuna delle tre l\'hanno trovata le '
      + 'mie prove.\n\n'
      + '✅ **E IL GRUPPO «LE RICETTE» È CHIUSO, 3/9 sera.** Misurato: «sostituisci **la ricetta** '
      + 'Pasta al pomodoro con Riso alle verdure» scriveva una regola su un alimento chiamato '
      + '«ricetta Pasta al pomodoro», e «togli la ricetta Pasta al pomodoro **dal menu di ilaria**» '
      + 'un divieto su «ricetta Pasta al pomodoro dal menu di ilaria» — col nome della cliente '
      + 'dentro. ⚠️ Regole **inerti** (nessun alimento si chiama così), ma con un\'anteprima '
      + 'plausibile da confermare: chi aveva scritto restava convinta di aver scritto qualcosa.\n'
      + '✅ Adesso Vera riconosce che si parla di un **piatto** e lo dice: nomina il piatto capito, '
      + 'e indica **dove si fa** — «Menu a mano» nella scheda della cliente, «Ricette» per il '
      + 'catalogo. ⛔ **E non apre una pratica**: la regola su un tipo di dieta nasce come proposta '
      + 'in coda al capo perché cambia il menu di centinaia di clienti; cambiare un piatto nel menu '
      + 'di una persona è un gesto piccolo su una schermata che esiste già, e mettere in coda una '
      + 'cosa che si fa in trenta secondi sposta il lavoro invece di indicarlo.\n'
      + '⚠️ Servono **tutt\'e due** le condizioni — la parola che dice «è un piatto» e un verbo del '
      + 'sostituire o togliere: senza il verbo è un commento, senza la parola è una sostituzione di '
      + 'alimento che si sa fare. ⛔ E «un piatto **di** pasta» è una **porzione**, non una ricetta: '
      + 'la preposizione dopo la parola è tutta la differenza, la stessa lezione di '
      + '`coda-di-quando.ts`. 8 mutazioni su 8 prese.\n\n'
      + '✅ **E IL GRUPPO «LISTE DI CATALOGO» È CHIUSO, 3/9 sera.** ⚠️ Il grosso non erano forme '
      + 'sconosciute: erano **varianti di forme già capite**, e la differenza fra il capire e il non '
      + 'capire era una preposizione o un apostrofo — «crea la lista **dei** formaggi molli» sì, '
      + '«crea una lista **con** i formaggi molli» no; «aggiungi **un\'**equivalenza» sì, «aggiungi '
      + '**una** equivalenza» no. *Una nutrizionista che scrive la stessa cosa in due modi e ne vede '
      + 'funzionare uno non impara la regola: impara che «a volte non funziona».*\n'
      + '⛔ **E una la leggeva male, non solo poco**: «togli le gallette **dalla lista dei formaggi '
      + 'molli**» diventava un **divieto su una cliente** con `vietati: ["gallette dalla lista dei '
      + 'formaggi molli"]` — «togli» è la stessa parola con cui si vieta un alimento, e il '
      + 'riconoscitore dei divieti prendeva tutta la coda. Inerte, ma alla domanda «su quale '
      + 'cliente?» si sarebbe scritto un divieto vero su un termine inventato.\n'
      + '✅ Adesso cambiare una lista si riconosce e Vera **dice la strada che esiste** — «rifai la '
      + 'lista dei formaggi molli», che è la stessa frase che suggerisce da sola quando la mostra. '
      + '⛔ Aggiungere o togliere **una voce sola** resta da fare: si sa creare e mostrare una lista, '
      + 'non modificarla. 9 mutazioni su 9 prese.\n\n'
      + '✅ **E IL GRUPPO «LA CODA» È CHIUSO PER QUELLO CHE SI PUÒ CHIUDERE, 3/9 sera.** «hai '
      + 'segnalazioni per me?» funzionava già; «**chiudi ilaria**» rispondeva «non ci arrivo», che è '
      + '**falso** — la frase si capisce benissimo, ed è la risposta che una persona racconta agli '
      + 'altri. Adesso Vera dice cosa ha capito (e **nomina la cliente**, così si vede subito se ha '
      + 'capito quella sbagliata), dice **perché** non lo fa e **dove** si fa: la coda '
      + '«Segnalazioni» nella Dashboard, con un clic.\n'
      + '⛔ **Chiudere davvero dalla chat NON si fa, ed è una decisione di prodotto — la domanda è '
      + 'pronta.** Una segnalazione chiusa è la traccia che **qualcuno ha guardato**, e resta '
      + 'scritto chi e perché (`signals.service.ts`: «la chiude a mano chi ha guardato, e così resta '
      + 'scritto chi ha guardato»). ⚠️ **Domanda per Simone, una riga:** *una nutrizionista può '
      + 'chiudere una segnalazione scrivendolo a Vera, e in quel caso cosa scriviamo come motivo — '
      + 'la sua frase così com\'è, oppure Vera glielo chiede prima?* Con la risposta il resto è '
      + 'codice.\n'
      + '⚠️ **E quello che resta fuori è misurato**: «ho sentito ilaria, puoi chiudere» non si legge, '
      + 'perché il nome sta **prima** del verbo e in un\'altra proposizione. Cercarlo ovunque nella '
      + 'frase vorrebbe dire indovinare di chi si parla su una cosa che finisce in un registro '
      + 'clinico: si preferisce chiedere. 8 mutazioni su 8 prese.\n\n'
      + '▶️ **Resta** la freccia (e la voce sopra dice a quale condizione si riapre). E due '
      + 'difetti **vecchi** che le forme nuove rendono raggiungibili, scritti come sentinelle: '
      + '`nomePersona` che prende «a colazione» per il nome di una cliente, e le due strade che '
      + 'leggono il lato sinistro in modo diverso — il modulo condivide le **forme**, non il modo di '
      + 'leggere quello che catturano, e su quel lato è il modo che conta.'
      + '\n\n✅ **CHIUSA — Simone, 5/9: «accettato così».** Dei quattro gruppi resta fuori solo la freccia →, tenuta fuori apposta (sedici regole sbagliate su venticinque righe vere) con la condizione per riaprirla scritta nelle prove; e la domanda sulla chiusura delle segnalazioni dalla chat resta una riga da rispondere quando servirà.',
  },

  {
    chiave: 'ai-api-key-da-cambiare',
    categoria: 'Aspetta Simone',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-31T12:00',
    titolo: '✅ Chiave `AI_API_KEY` ruotata',
    dettaglio:
      'La chiave era leggibile in uno screenshot mandato in chat il 31/8. Andava **ruotata** — '
      + 'nuova chiave dal fornitore, `AI_API_KEY` aggiornata su Render, vecchia revocata — perché '
      + 'cancellare l\'immagine non toglie niente a chi l\'ha già vista.\n\n'
      + '✅ **RISPOSTA DI SIMONE, 3/9: «Fatto».**\n\n'
      + '⚠️ Resta come promemoria per la prossima volta, non come lavoro: **una chiave che è finita '
      + 'in uno screenshot è bruciata**, anche se lo screenshot è stato cancellato subito. Non c\'è '
      + 'una versione ridotta di questa risposta.'
  },

  {
    chiave: 'sonia-tre-pasti-gia-erogati',
    categoria: 'Aspetta Simone',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-31T12:10',
    titolo: '✅ I pasti già erogati a Sonia col suo allergene: corretti a mano',
    dettaglio:
      'Trovati il 31/8 con `npm run diag:allergeni-piatto`: pranzo del 25/8 (gamberoni, tag '
      + '`crostacei` confermato) e merenda del 30/8 (albicocche secche senza la sostituzione). Il '
      + 'terzo — la merenda del 28/8 — **era corretto**.\n\n'
      + '✅ **RISPOSTA DI SIMONE, 3/9: «Corretti a mano».**\n\n'
      + '⚠️ Era l\'unica strada: `MenuDay` è uno snapshot e i giorni **passati** non si riscrivono. '
      + 'La strada da cui entravano è chiusa (`swapDislikedDishes`) e per le giornate future già '
      + 'scritte c\'è `npm run rifai:non-sicuri`.\n\n'
      + '⛔ **Quello che questa voce lascia detto**: il difetto è stato trovato da una diagnostica '
      + 'lanciata a mano, non da un controllo che gira da solo. Un allergene arrivato nel piatto di '
      + 'una cliente è la cosa più grave che questo prodotto possa fare, e oggi lo si scopre solo se '
      + 'qualcuno decide di guardare. È una voce che vale la pena aprire il giorno che si vuole che '
      + 'quel controllo suoni da sé.'
  },

  {
    chiave: 'patrizia-keto-col-glutine',
    fatta: true,
    categoria: 'Aspetta Simone',
    ordine: 0,
    blocca: false,
    nata: '2026-08-31T12:20',
    titolo: '▶️ Patrizia: Simone ha deciso di sospenderla — resta il gesto, che è dal backoffice',
    dettaglio:
      'Ci era finita **di rimbalzo da una prova tecnica** il 31/8, non da una scelta clinica: sulla '
      + 'Keto con il glutine fra le allergie. Il piatto era protetto dalle esclusioni — il motore '
      + 'non le serviva glutine — ma la **dieta assegnata** era una decisione che non risultava di '
      + 'nessuno.\n\n'
      + '✅ **RISPOSTA DI SIMONE, 3/9: «Sospendi patrizia».**\n\n'
      + '▶️ **Resta il gesto, e lo fa una persona dal backoffice**, non uno script: la sospensione '
      + 'si inserisce dalla scheda cliente (card delle sospensioni), e da lì la pipeline commerciale '
      + 'la parcheggia in «In sospensione» ricordandosi da quale colonna veniva '
      + '(`stagePrimaSospensione`). ⛔ Non l\'ho fatta io e non con una query: sospendere una cliente '
      + 'vera tocca l\'erogazione, la fatturazione e quello che lei vede in app — e una riga scritta '
      + 'a mano in banca dati salterebbe tutte le cose che quella schermata fa insieme.\n\n'
      + '⚠️ **E vale la pena scrivere il motivo** nel campo che la card chiede (Simone, 24/8): fra '
      + 'sei mesi «sospesa il 3/9» senza una riga di spiegazione è indistinguibile da una '
      + 'sospensione chiesta dalla cliente.'
      + '\n\n✅ **CHIUSA — Simone, 5/9: «Sì, sospesa», dal backoffice.**',
  },

  {
    chiave: 'senza-glutine-catalogo-mezzo-inservibile',
    categoria: DATI,
    titolo: 'Mediterranea senza glutine: su due giornate, sei piatti su dieci non si potevano servire',
    dettaglio:
      'Misurato il 31/8 su Patrizia: su **due giornate da cinque pasti**, **sei piatti su dieci** erano roba '
      + 'che a lei non si poteva servire. ✅ Adesso il motore li sostituisce e la cliente non se ne accorge — '
      + '⚠️ ma il buco nel catalogo resta, e un catalogo mezzo inservibile si vede appena una cliente ha una '
      + 'seconda esclusione. Si misura con `npm run diag:esclusioni`.\n\n'
      + '⚠️ Da leggere insieme al rifacimento del paniere (`progetto/PIANO_Panieri_Ricette.md`): il senza '
      + 'glutine lì diventa un **filtro** sul paniere mediterraneo, e la famiglia si chiude quando quel filtro '
      + 'funziona.',
    ordine: 961,
    nata: '2026-08-31T18:00',
  },

  {
    chiave: 'piano-bloccato-solo-in-app',
    fatta: true,
    categoria: SIMONE,
    titolo: '▶️ «Piano bloccato»: la push c\'è (4/9), resta la domanda sull\'email',
    dettaglio:
      'Per un blocco che **ferma l\'erogazione** l\'in-app era poco: se la cliente non apre l\'app non lo '
      + 'sa, e chi può sbloccare è la nutrizionista, che finché non apriva il backoffice non lo sapeva.\n\n'
      + '✅ **LA PUSH È FATTA (4/9).** Simone: l\'avviso va **alla nutrizionista e alla coach**. '
      + '`apriSegnalazione` adesso prende una porta `push` — la stessa forma di `notifica-utente.ts`, '
      + 'perché `MenuModule` non può dipendere da `NotificationsModule` senza chiudere un anello — e i '
      + 'due punti che aprono un `diet_blocked` gliela passano. Una prova tiene ferma la condizione: '
      + '**ogni** `diet_blocked` passa i canali, o diventa rossa il giorno che qualcuno ne scrive un '
      + 'terzo senza.\n'
      + '⚠️ L\'opt-out del profilo toglie **la push, non la riga in elenco**: la casella promette di non '
      + 'disturbare, non di cancellare un allarme clinico. ⛔ Il percorso gemello (`notificaUtente`, che '
      + 'usa `EscalationRoutingService`) fa l\'opposto — lì l\'opt-out cancella anche la riga. Sono due '
      + 'semantiche dello stesso interruttore, tutte e due vive: è una voce da aprire, non una cosa da '
      + 'uniformare di nascosto.\n\n'
      + '⛔ **E LUNGO LA STRADA È SALTATO FUORI UN DIFETTO CHE ERA IN PRODUZIONE DA AGOSTO.** '
      + '`@Optional() private readonly mail: MailService | null = null` — il tipo **unione** fa emettere '
      + 'a TypeScript `Object` in `design:paramtypes`, Nest non sa cosa iniettare, `@Optional()` '
      + 'inghiotte il fallimento e resta il default. La dipendenza è `null` per sempre, in silenzio. '
      + '`RegistroVeraService` ce l\'aveva dal 13/8: **l\'email di conflitto al capo non è mai partita**, '
      + 'con il codice per mandarla scritto e verde. Corretto in tutti e tre i punti (via l\'unione), e '
      + 'adesso c\'è una sentinella: un parametro `@Optional()` non dichiara un\'unione.\n\n'
      + '▶️ **LA DOMANDA CHE RESTA, ED È DI SIMONE: l\'email.** L\'aveva chiesta insieme alla push, e '
      + 'stanotte non è stata scritta apposta. La strada comoda era `sendNotificationEmail`, che però:\n'
      + '· è il modello delle **clienti**, e il piè di pagina dice «ricevi questa email perché hai '
      + 'attivato le notifiche via email nelle preferenze» — a una nutrizionista è **falso**, e la manda '
      + 'a cercare un interruttore che per lei non esiste (il suo è un altro campo);\n'
      + '· ha `copiaCoach: true`, cioè cerca la coach di chi riceve e la mette in copia;\n'
      + '· ⛔ **scrive il corpo in `email_log`** — cioè **nome della cliente e motivo clinico del blocco** '
      + 'finiscono in una tabella che il backoffice mostra, e il modello è modificabile dall\'admin.\n'
      + 'Quindi la domanda è: *mandiamo l\'email allo staff con un modello suo (senza copia coach, con un '
      + 'testo che dica la verità a chi lo legge), e va bene che il nome della cliente e il motivo del '
      + 'blocco viaggino per posta e restino scritti in `email_log`? Oppure la mail dice solo «una tua '
      + 'cliente ha il piano bloccato, guarda in Dashboard» senza nominare né lei né il motivo?*\n\n'
      + '⚠️ **Due cose misurate da tenere in conto quando si risponde.** (1) L\'avviso parte **dentro la '
      + 'richiesta della cliente** (`deliverIfEligible` gira a ogni apertura dell\'app): con la push si '
      + 'sente poco, con una POST a Brevo senza timeout no. (2) Il ciclo chiudi/riapri non è raro — la '
      + 'nutrizionista corregge le allergie, `resolveBlocks` chiude, la cliente apre l\'app e il blocco '
      + 'si riapre — e ogni riapertura è un avviso: con la push va bene, con l\'email diventano dieci '
      + 'mail identiche in un pomeriggio.'
      + '\n\n✅ **CHIUSA — fatta il 4/9 (`4f4035b`), e questa voce non lo diceva.** Risposta di Simone alla domanda: la mail **con il nome della cliente e il motivo**, e la conseguenza detta — quel corpo finisce anche in `email_log`. Non passa da `sendNotificationEmail` (il modello delle clienti): c\'è `sendStaffAlertEmail`, chiave `staff_alert`, nessuna copia coach, piè di pagina che dice il vero. Due argini misurati: la posta la manda la **nascita** della segnalazione, non ogni riapertura; e un tetto di dieci secondi sulla chiamata a Brevo, per ogni email del progetto. Riletto il 5/9 sulla lista di Simone: era già finita.',
    ordine: 962,
    nata: '2026-08-31T18:00',
  },

  {
    chiave: 'porte-che-scrivono-piatti-senza-controllo',
    categoria: CODICE,
    titolo: 'Le altre due porte che scrivono un piatto nel menu senza passare dal controllo di sicurezza',
    dettaglio:
      '⛔ **Aperta il 31/8, trovata dalla revisione della consegna sullo swap.** Corretta la quarta porta '
      + '(`swapDislikedDishes`: il piatto che sostituisce un non gradito non passava da nessun controllo, ed è così '
      + 'che una cliente con sei allergie ha ricevuto i gamberoni col tag `crostacei` confermato), ne restano **due** '
      + 'che scrivono direttamente in `menuDay.meals` un piatto pescato da `clientMenuPool`, **senza chiamare '
      + '`valutaRicetta`**, e il pasto nasce con `substitutions` vuoto:\n\n'
      + '· `sostituzione-chat.service.ts` — il cambio di piatto proposto da Gaia in chat;\n'
      + '· `vera-chat.service.ts` — la giornata dettata dalla nutrizionista.\n\n'
      + '⚠️ `clientMenuPool` filtra tre cose (`allergensReviewed`, regime, **tag** allergene) e non applica le regole '
      + 'per INGREDIENTE di `solfiti.ts` e `lattosio.ts`. Quindi una ricetta revisionata senza tag `solfiti` ma con le '
      + 'albicocche secche dentro può essere scritta sulla giornata **senza la riga che dice alla cliente cosa non '
      + 'mettere** — che è esattamente la merenda del 30/8, per un\'altra strada.\n\n'
      + '⚠️ **E c\'è una quinta porta, oggi SPENTA**: `buildSimpleSlotPool` (preferenza «ricette semplici», '
      + '`menu_simple_recipes_enabled` a `false`) è ancora scritta nel modo vecchio — `select` senza `allergens` e '
      + 'confronto a parole. Non fa danno adesso, e il suo modo di sbagliare è «cliente ferma», non «piatto '
      + 'pericoloso»: ma il giorno che qualcuno riaccende quel parametro il buco è già lì.\n\n'
      + '**Da fare:** chiamare `valutaRicetta` sul piatto scelto nei due punti, scrivere le sue `subs` sul pasto e '
      + 'rifiutare il candidato se ci sono `violations`. È la stessa riga che il 31/8 è stata aggiunta allo swap. '
      + 'Poi `npm run rifai:non-sicuri` per le giornate già scritte.\n\n'
      + '\u2705 **CHIUSA il 2/9.** Tutte e due le porte adesso chiamano `valutaRicetta` sul candidato, '
      + 'con **il nome come ingrediente** (come fa gi\u00e0 `menu.service`): su una ricetta con l\'elenco '
      + 'povero il riconoscitore non vedrebbe niente, e «Insalata di gamberi e avocado» andrebbe a '
      + 'un\'allergica ai crostacei. Un piatto che **viola** non si propone nemmeno \u2014 n\u00e9 alla cliente '
      + 'in chat n\u00e9 alla nutrizionista \u2014 e le **sostituzioni** che prima venivano buttate viaggiano '
      + 'col candidato fino al pasto scritto.\n'
      + '\u26d4 **E la sostituzione sul nome finto si butta**: le regole per ingrediente non sanno che il '
      + 'nome \u00e8 finto, e sui solfiti producevano «al posto di *Ricotta con albicocche secche* metti '
      + '*albicocche essiccate in casa*» \u2014 una riga che la cliente legge sul piatto che sta per '
      + 'ricevere. Il divieto si tiene, la riga assurda no.\n'
      + '\u26a0\ufe0f **Il campo si scrive solo quando c\'\u00e8 qualcosa**: un `substitutions: []` scritto apposta '
      + '\u00e8 indistinguibile da «nessuno l\'ha guardato».\n'
      + '\u2705 **E LA QUINTA PORTA \u00c8 CHIUSA, il 2/9 \u2014 TOGLIENDOLA.** Prima riparata: i candidati '
      + 'escono dal **pool della sua dieta** (`ctx.slotPool`) e passano da `valutaRicetta` col nome '
      + 'fra gli ingredienti, come le altre quattro; il giudizio in un modulo suo, dove ogni '
      + 'cancello si toglie e si vede cadere (nella prima stesura stava dentro il servizio e '
      + '**quattro mutazioni su cinque sopravvivevano**). Poi la decisione di Simone: *«io lo '
      + 'lascerei spento sai... anzi lo toglierei proprio»*. \u26d4 **Riparare e togliere sono due '
      + 'decisioni diverse**, e la seconda la prende chi fa il prodotto: una funzione che non serve '
      + 'non si tiene spenta «per quando servir\u00e0», perch\u00e9 il codice che non gira invecchia senza '
      + 'che nessuno se ne accorga \u2014 questa era ancora scritta nel modo che aveva fermato il menu '
      + 'di Patrizia **due giorni dopo** essere stata spenta.\n'
      + '\u26d4 **E la riparazione, prima di essere buttata, ha trovato due difetti che nessuno '
      + 'cercava** \u2014 tutti e due veri anche senza di lei. (1) La preferenza si portava dietro le '
      + '**sostituzioni del piatto buttato**: «uvetta \u2192 frutta essiccata in casa» su un piatto che '
      + 'l\'uvetta non ce l\'ha, e `ingredienti-effettivi.ts` quell\'ingrediente lo **aggiunge**. '
      + '(2) Lo stesso piatto poteva finire **allo spuntino e alla merenda** della stessa giornata: '
      + 'dopo `allargaAiGemelli` le due liste sono identiche e la rotazione usa lo stesso indice. Il '
      + 'secondo \u00e8 **aperto per tutte** e sta nella voce `stesso-piatto-spuntino-e-merenda`.\n'
      + '\u26a0\ufe0f **E `poolDalPassato` si costruiva la mappa a mano**, quarta copia di «quali ricette '
      + 'per ogni pasto», gi\u00e0 indietro di una regola: niente allargamento spuntino\u2194merenda per chi '
      + '\u00e8 su «Ritorno in Equilibrio». Adesso passa da `poolPerSlot` come tutti. \u26d4 **Nessuna '
      + 'cliente ci aveva rimesso** \u2014 quel ramo \u00e8 spento e nemmeno dichiarato nei Parametri: era '
      + 'un\'incoerenza fra due modi di costruire lo stesso pool, non un danno.\n'
      + '\u26a0\ufe0f **`prefersSimpleRecipes` resta** in banca dati, nel DTO e nell\'app: toglierlo dal '
      + 'DTO farebbe rispondere **400 a tutte le app installate**, che quel campo lo mandano a ogni '
      + 'salvataggio del profilo. La riga sparisce dall\'app al prossimo rilascio \u2014 voce '
      + '`interruttore-ricette-semplici-in-app`.',
    ordine: 953,
    nata: '2026-08-31T10:30',
    fatta: true,
  },

  {
    chiave: 'esclusioni-chiave-dentro-parola',
    categoria: PANIERE,
    titolo: '▶️ RIAPERTA il 2/9 (i panieri sono accesi): le chiavi dentro una parola più lunga, una per una',
    fatta: true,
    dettaglio:
      '\u25b6\ufe0f **RIAPERTA il 2/9: la condizione che la teneva ferma è caduta.** Il paniere è la sorgente '
      + 'del pool dall\'1/9 alle 05:21, `panieri:confronta` dice che non si è perso niente di indebito, '
      + 'e `diag:orfane` che nessuna ricetta è rimasta senza paniere possibile. Le coppie (chiave, '
      + 'parola) adesso si misurano su un catalogo che non si rimescola più. ⚠️ Il passo 1 è sempre '
      + 'quello scritto qui sotto, e non l\'ha ancora lanciato nessuno.\n\n'
      + '⏸ *Storia: sospesa il 27/8. Simone: «lavoro da fare dopo aver sistemato il paniere, ora non ha senso».* '
      + '⚠️ Ed è la risposta giusta, non un rinvio: l\'elenco delle coppie (chiave, parola) da guardare '
      + 'una per una **si misura sul catalogo di oggi**. Il rifacimento dei panieri rimescola le ricette — '
      + 'ne toglie, ne condivide fra diete diverse — quindi le coppie cambiano sotto, e le risposte date '
      + 'adesso andrebbero ridate. ⛔ **Non si chiude**: ogni riga di quell\'elenco toglie o tiene una '
      + 'protezione su un allergene, e una voce chiusa è una voce che nessuno riapre. Torna «da fare» il '
      + 'giorno che i panieri sono accesi — vedi `progetto/PIANO_Panieri_Ricette.md`.\n\n'
      + '## La domanda, pronta per quel giorno\n\n'
      + '⚠️ **RISPOSTA DI SIMONE, 25/8: «fammi una domanda specifica, non capisco cosa ti serve».** '
      + 'Aveva ragione: la voce raccontava il problema e non chiedeva niente di eseguibile. Ecco la '
      + 'domanda, in due passi.\n\n'
      + '**PASSO 1 — un comando, sola lettura, sulla shell di Render:**\n\n'
      + '    npm run diag:esclusioni\n\n'
      + 'Serve **l\'ultimo riquadro**, quello intitolato «DA LEGGERE UNA PER UNA»: sono poche righe, '
      + 'una per coppia (chiave, parola), e vanno incollate così come escono.\n\n'
      + '⚠️ **Quel riquadro il 25/8 non c\'era**, e la prima stesura di questa voce diceva «incolla la '
      + 'parte finale» quando in fondo c\'era solo la prosa di riepilogo: le righe stavano dentro il '
      + 'blocco di ognuno dei sedici allergeni, dopo un elenco senza tetto. L\'ha trovato la revisione '
      + 'avversariale. Adesso la parte finale **è** l\'elenco.\n\n'
      + '⛔ **E le coppie già decise non ci sono più.** Il conto era **grezzo** e non guardava le due '
      + 'liste che il motore usa davvero: «vino» dentro «bovino» — chiusa il 20/8 — sarebbe tornata in '
      + 'cima all\'elenco, e chi legge l\'avrebbe aggiunta a una lista dove c\'è già. Adesso la '
      + 'diagnostica chiama `coppiaGiaDecisa`, che legge le **stesse** liste del motore, e quelle si '
      + 'contano soltanto. Quindi il 212 di prima è un numero vecchio: quante ne restano davvero lo '
      + 'dice il comando.\n\n'
      + '**PASSO 2 — per ogni riga, una parola sola: SÌ o NO.** La domanda è sempre la stessa:\n\n'
      + '    «<parola>» contiene davvero <allergene>?\n\n'
      + '· **SÌ** → si lascia com\'è (è il caso di «aceto» dentro «sottaceto»: il sottaceto l\'aceto '
      + 'ce l\'ha davvero, e togliere l\'esclusione toglierebbe protezione a chi è sensibile ai '
      + 'solfiti).\n'
      + '· **NO** → si scarta (è il caso di «vino» dentro «bovino»: uno stracetto di bovino magro '
      + 'non c\'entra niente coi solfiti).\n\n'
      + '⚠️ **Basta il SÌ/NO: come si scarta lo decide il codice, e non è sempre lo stesso.** Se le '
      + 'omonime sono poche e note si aggiungono a un elenco chiuso (`PAROLE_CHE_NON_SONO`); se sono '
      + 'una **famiglia aperta** — «orata» dentro decorata, dorata, insaporata, marinata, e tutte '
      + 'quelle che nessuno ha ancora scritto — nessun elenco basterebbe, e vale la regola «solo a '
      + 'inizio di parola» (`SOLO_A_INIZIO_PAROLA`). ⛔ La prima stesura di questa voce offriva **una '
      + 'destinazione sola**, e mandare una famiglia aperta nell\'elenco chiuso è la correzione che il '
      + 'codice stesso dichiara sbagliata: ne avevo scritte otto per «orata» e l\'ha smontata '
      + '«insaporata», che in cucina si scrive davvero.\n\n'
      + '⚠️ **Perché serve una persona e non una regola.** La stessa regola — il confine di parola — '
      + 'darebbe la risposta giusta a «bovino» e **sbagliata** a «sottaceto». Non è una regola: è una '
      + 'lista corta di omonimi, e ogni riga di quella lista **toglie un\'esclusione**. Per questo si '
      + 'scrive solo dopo aver letto la parola in un esito vero, mai per analogia.\n\n'
      + '⚠️ **Le due voci larghe dei solfiti NON c\'entrano con questa domanda, e sono già decise** — '
      + 'lo scrivo perché nella prima stesura di questa voce le avevo tirate dentro, e la revisione '
      + 'avversariale ha misurato che era **falso da un giorno**: `biscotti` è stata **tolta il 24/8** '
      + '(`exclusions.ts`: «⛔ `biscotti` TOLTA il 24/8») e `aceto` resta di proposito, perché serve a '
      + 'far scattare il sostituto. Le ha decise Simone, non aspettano Lucia.\n\n'
      + '## Il testo di quando la voce è nata\n\n'
      + '⚠️ **Difetto più vecchio della radice, e più delicato da correggere.** Il primo giro delle esclusioni cerca la parola chiave **intera** dentro il testo del piatto (`includes`), come fa da mesi. `npm run diag:esclusioni` adesso conta a parte quante volte quella chiave combacia **dentro una parola più lunga**: sono **212**.\n\n⛔ **E qui il confine di parola NON è la correzione**, al contrario della radice. Le due parole viste nell\'esito dicono perché:\n · «**aceto**» dentro «**sottaceto**» → **giusto**: il sottaceto l\'aceto ce l\'ha davvero, e mettere un confine di parola **toglierebbe** protezione a chi è sensibile ai solfiti;\n · «**vino**» dentro «**bovino**» → **sbagliato**: uno stracetto di bovino magro non c\'entra niente con i solfiti.\n\n⚠️ La stessa regola darebbe la risposta giusta a una e sbagliata all\'altra. Quindi non è una regola: è una **lista corta** di parole da guardare una per una. La diagnostica adesso le raggruppa per coppia (chiave, parola) invece di stampare una riga per ricetta — la prima versione ne stampava 212 per far scoprire che erano due parole, e un elenco che costringe a contare a mano è un elenco che non si legge.\n\n⚠️ **Non l\'ho toccato**, e non per prudenza generica: correggere il giro della chiave esatta vuol dire cambiare il comportamento che regge le esclusioni da mesi, e la direzione dell\'errore qui è l\'opposta — si rischia di **togliere** una protezione invece di restituire dei piatti. Si legge l\'elenco raggruppato e si decide parola per parola. ⚠️ È la stessa famiglia di «Gaia trovava mela dentro melanzane», chiusa il 19/8 sulla ricerca: lì la risposta fu «a parole intere», qui non può esserlo.\n\n✅ **CORRETTA il 20/8 sera, invece che chiesta.** Aprire una voce per «bovino» era sbagliato: è una parola, non una decisione di prodotto. In `exclusions.ts` c\'è `PAROLE_CHE_NON_SONO`, una lista corta di parole omonime — `vino` → `bovino, bovina, bovini, bovine` — e «sottaceto» resta escluso com\'era giusto. ⚠️ **Ogni riga di quella lista TOGLIE un\'esclusione**, quindi si scrive solo dopo aver letto la parola in un esito vero, mai per analogia: `bovino` l\'ha nominata la diagnostica. ⛔ **Resta da guardare il resto dei 212**: `npm run diag:esclusioni` adesso li raggruppa per coppia (chiave, parola) invece di stampare una riga per ricetta, quindi sono poche righe da leggere. Quelle che sono come «bovino» si aggiungono alla lista; quelle che sono come «sottaceto» si lasciano stare. ⚠️ E «biscotti» non è nessuna delle due: è una delle **due voci larghe** dei solfiti dichiarate nel codice il 13/8 — insieme ad «aceto» — che si tolgono se Lucia dice che sono eccessive.'
      + '\n\n▶️ **LETTE E CHIUSE IL 4/9.** `diag:esclusioni` in produzione ha dato **dodici** coppie; Simone ha risposto: **dieci NO, due SÌ, una lasciata stare**.\n'
      + '· `grana` e `grano` — melagrana, melograno, sgranati, sgranato, sgranocchiate, 239 occorrenze — nella regola di **posizione**, perché sgranare si coniuga e un elenco chiuso lo rincorrerebbe per sempre. `platter`, `umbrie` e `rapanelli` nella lista **chiusa**: tre parole note.\n'
      + '· I SÌ non si toccano: il sottaceto l\'aceto ce l\'ha, e il fiordilatte è mozzarella di latte. ⛔ **Ed è quest\'ultimo a decidere la forma di tutta la correzione**: `latte` non può usare la regola di posizione, che lascerebbe passare il fiordilatte insieme a «platter».\n'
      + '· ⚠️ **La lasciata stare**: «soffrittata» non è una parola italiana, quindi quel piatto ha un refuso e può essere «soffritto» storpiato (niente uovo) o «frittata» storpiata (uovo eccome). Una ricetta su ventiquattromila, e i due errori non costano uguale: si tiene esclusa.\n'
      + '⚠️ E un falso **dichiarato invece che chiuso**: «granoturco» è mais e comincia una parola, quindi la regola di posizione non lo scarta. Si chiude il giorno che la diagnostica lo nomina.',
    ordine: 622,
    nata: '2026-08-20T19:10',
  },

  {
    chiave: 'pipeline-due-schede-indietro',
    titolo: 'Il rinnovo riporta la scheda a «Acquisito» anche se era più avanti',
    dettaglio:
      '`npm run diag:pipeline-indietro` (20/8 sera): **2 schede su 58** stanno in una colonna precedente a una in cui `stageDates` dice che erano già passate. Una «Acquisito → Prova», una «Da Ricontattare → Prova».\n\n✅ **Il passaggio automatico non può averlo fatto.** `avanzaStatoSeIndietro` rifiuta quando la colonna attuale ha un posto **maggiore o uguale** a quella di destinazione, e «Prova» (posto 4) sta prima di «Acquisito» (posto 6): la porta si è chiusa correttamente. E l\'unica porta che scrive senza guardare (`autoAdvance`) scrive solo `paid`, che è in avanti. ⚠️ Quindi quelle due schede **le ha spostate una persona dalla board**, che è una cosa legittima: la coach sa perché.\n\n⚠️ **Quello che la diagnostica non sa dire è CHI**, e potrebbe: `stageDates` porta il `byUserId` di ogni passaggio. Finché non lo dice, un numero come questo resta ambiguo — «due schede indietro» suona come un difetto e invece è lavoro di qualcuno. È il prossimo miglioramento di quello script, ed è piccolo.\n\n⛔ **Resta però una cosa vera nel codice, misurata e non ancora colpita**: `autoAdvance` scrive lo stato **senza guardare dov\'era la scheda**, e `commerce.service.ts` la chiama a **ogni pagamento sopra lo zero**, non solo al primo. Quindi il rinnovo del mese riporta la scheda a «Acquisito» anche se era a «Prima visita» o «Follow-up» — la cosa esatta che l\'altra porta esiste per impedire, fatta dal punto che la fa più spesso. Oggi non è successo (nessuna delle due schede torna indietro *verso* Acquisito), ma succederà al primo rinnovo di una cliente arrivata più avanti. La regola candidata è scritta nel docblock di `autoAdvance`: «avanza se è indietro, **e risuscita da Percorso concluso**» — chi rinnova dopo aver concluso deve tornare fra le attive, chi è a «Prima visita» e rinnova non deve perdere la visita che ha fatto.\n\n⛔ **VOCE RISTRETTA il 20/8 sera: le due schede non erano un difetto, e non dovevo aprirci una voce.** L\'avevo scritto io stesso nel testo qui sopra — «le ha spostate una persona, ed è legittimo» — e poi l\'ho lasciata aperta lo stesso. Un elenco di lavori che contiene cose che non sono lavori smette di essere un elenco di lavori. ✅ Quello che resta, ed è l\'unica cosa vera, è il comportamento di `autoAdvance` descritto qui sopra: **quello sì va deciso**, ed è una riga di regola. Il titolo adesso dice quello.\n\n✅ CHIUSA il 22/8 — deciso da Simone.\n\n«Sì, il rinnovo è comunque un acquisto, va bene così.» Quindi `autoAdvance` resta com\'è: una scheda che torna ad «Acquisito» quando la cliente paga di nuovo sta dicendo una cosa vera. ⚠️ La conseguenza resta e va saputa: chi rinnova da «Prima visita» o «Follow-up» perde quella posizione sulla board — il passaggio non sparisce (`stageDates` lo tiene con data e autore), la colonna sì. ⛔ La regola candidata («avanza se è indietro, e risuscita da Percorso concluso») è scartata, e resta scritta nel docblock di `autoAdvance` solo perché nessuno la riproponga fra sei mesi come se fosse nuova.',
    categoria: SIMONE,
    ordine: 623,
    nata: '2026-08-20T19:20',
    fatta: true,
  },

  {
    chiave: 'primo-accesso-allineamento',
    titolo: '«Primo accesso effettuato»: la colonna c\'è, restano due schede storiche da spostare',
    dettaglio:
      '✅ La colonna nuova esiste e i passaggi automatici sono a posto: `npm run diag:pipeline-stati` (20/8 sera) mostra «Primo accesso effettuato» al posto 1, fra «Nuovo contatto» e «Questionario completato», e conferma che **tutti** i passaggi automatici possono avvenire nell\'ordine giusto — nessuna colonna sta prima di quella da cui dovrebbe arrivare.\n\n✅ **E l\'allineamento delle schede vecchie è innocuo.** `npm run allinea:primo-accesso` in prova a vuoto: 58 clienti, **43 hanno un accesso o una registrazione nel registro**, e da spostare ce ne sono **due** — tutte e due si chiamano «Test». Le altre 41 sono già lì o più avanti. Si lancia con `CONFERMA=1 npm run allinea:primo-accesso` quando vuoi: sposta due schede di prova.\n\n⚠️ Una cosa vista di sfuggita e che vale la pena sapere: la colonna «Nuovo contatto» ha **86.244 schede**. Sono i lead importati, non clienti — ma è un numero che rende la board di quella colonna inutilizzabile a occhio, e prima o poi va deciso cosa farne.\n\n✅ **CHIUSA il 20/8 sera.** Non è un lavoro: è un comando che sposta due schede di prova. `CONFERMA=1 npm run allinea:primo-accesso` quando vuoi, e se non lo lanci mai non succede niente a nessuno. ⚠️ Resta annotata una cosa sola, che vale la pena sapere ma non è questa voce: la colonna «Nuovo contatto» ha **86.244 schede** (lead importati, non clienti), e a occhio quella colonna è inutilizzabile. Se un giorno diventa un problema si apre allora, con un numero davanti.',
    categoria: SIMONE,
    ordine: 624,
    nata: '2026-08-20T19:25',
    fatta: true,
  },

  {
    chiave: 'clienti-senza-numero-di-pasti',
    titolo: '17 clienti su 56 non hanno il numero di pasti: per loro non si sceglie nessuna dieta',
    dettaglio:
      'Uscito da una misura fatta per un\'altra ragione (`npm run diag:pasti`, 20/8 sera): **24 clienti a tre pasti, 15 a cinque, 17 senza il campo**. ⚠️ `pickDietFor` comincia con `if (!profile.regime || !profile.mealsPerDay) return null`: senza il numero di pasti non c\'è ripiego, non c\'è dieta «larga» — torna **niente**. Probabilmente sono clienti che il questionario non l\'hanno finito, ed è normale che sia così; ma sono **un terzo del totale** e prima di stasera non lo sapeva nessuno. Da guardare: quante di quelle 17 hanno un piano attivo (quelle sì che sono un problema) e quante sono solo iscrizioni ferme.\n\n✅ **E nella stessa misura, una cosa chiusa**: il DTO della scheda cliente accettava `mealsPerDay` = 3, 4 o 5, ma nel catalogo una dieta a **4 pasti** non è mai esistita — le varianti nascono `fasting ? 3 : meals === \'5\' ? 5 : 3`. Una cliente messa a 4 non trovava nessuna variante e `pickDietFor` ricadeva sul «purché sia dello stesso regime», dandole una dieta a 3 o a 5: un numero di pasti diverso da quello scritto sulla sua scheda, senza dirlo a nessuno. **Zero clienti a 4 pasti** in produzione, quindi il `4` è uscito dal DTO e basta — nessuno da spostare, nessuna migrazione.\n\n⚠️ Resta scritto, e non è stato sistemato: la domanda «quali pasti ha una giornata» è in **quattro** funzioni che sul 4 **non dicono la stessa cosa** — `slotsForMeals` restituiva quattro slot con la merenda, le altre tre lo trattavano come un tre, e il generatore non lo conosceva affatto e ricadeva sul cinque. Non lo raggiunge più nessuno, e sistemarlo vorrebbe dire decidere se una giornata da quattro pasti esisterà mai. Se servirà, si ricomincia da lì.\n\n✅ CHIUSA il 22/8 — deciso da Simone.\n\n«Non serve, quando attivano il piano lo chiediamo.» Le 17 senza il campo sono iscrizioni ferme, e il numero di pasti si chiede nel momento in cui serve davvero. ⚠️ Quello che resta vero e scritto: senza `mealsPerDay` `pickDietFor` torna niente, non una dieta larga. Va bene finché quel caso coincide con «non ha ancora un piano»; il giorno che una cliente con un piano attivo si trovasse senza quel campo sarebbe un altro problema, e `npm run diag:pasti` lo conta.',
    categoria: SIMONE,
    ordine: 625,
    nata: '2026-08-20T19:30',
    fatta: true,
  },

  {
    chiave: 'chi-vede-tutte-le-clienti',
    titolo: 'Marketing e Responsabile Marketing: due punti del codice dicono cose diverse su cosa vedono',
    dettaglio:
      'Trovato il 20/8 sera cercando gli elenchi scritti a mano. `const MANAGER_ROLES = [\'admin\', \'head_nutritionist\', \'sales\']` era copiato **identico in quattro servizi** — alert, analytics, dashboard, riassunti delle chat — e in tutti e quattro decide la stessa cosa: se chi guarda vede **tutte** le clienti o solo le sue. ✅ Adesso è una porta sola in `common/perimetro-clienti.ts`, con un test che impedisce che ne rinasca una quinta copia. Il comportamento **non è cambiato**: la consegna sposta e basta.\n\n⛔ **Ma le due risposte non combaciano già adesso.** `perimetroClienti` — la funzione nata l\'11/8 proprio per non avere perimetri copiati — risponde «nessun limite» a **tutto ciò che non è coach e non è nutrizionista**, quindi anche a `marketing` e `head_marketing`. L\'elenco dei quattro servizi no: sono tre ruoli e basta. ⚠️ Per quei due ruoli, quindi, alcune pagine mostrano tutte le clienti e altre no — e non perché qualcuno l\'abbia deciso.\n\n⛔ **Non l\'ho appianata**, e non perché sia difficile: è una decisione su **chi vede i dati delle clienti**, e la prendi tu. Le due strade sono «marketing vede tutto» (allora l\'elenco si allarga) oppure «marketing non vede le clienti» (allora è `perimetroClienti` che va stretta). Il test `perimetro-una-porta-sola.spec.ts` fissa **ruolo per ruolo** cosa rispondono tutte e due oggi, così quando si decide si vede nero su bianco cosa si sta cambiando.\n\n✅ CHIUSA il 22/8 — deciso da Simone.\n\n«Tanto lo definisco dai permessi, chiudi il punto.»\n\n⚠️ Una precisazione, perché la risposta non copre tutto e non voglio lasciarla credere coperta. La pagina Permessi decide QUALI SCHERMATE un ruolo apre; `perimetroClienti` decide QUALI CLIENTI vede dentro quelle schermate. Sono due leve diverse: togliendo a `marketing` una pagina, quella pagina sparisce — ma se un domani gliene si desse una che elenca clienti, `perimetroClienti` continuerebbe a rispondere «nessun limite» mentre i quattro servizi storici rispondono «solo le sue». ⛔ E NON è «resa innocua»: il marketing una pagina con dentro le clienti ce l\'ha GIÀ. `DEFAULT_PERMISSIONS` dà a `marketing` la vista su `crm_leads`, che è la tabella dei lead e passa da `perimetroClienti` — il quale per quel ruolo risponde «nessun limite». Oggi lo ferma soltanto un elenco di ruoli scritto a mano nel controller (`@Roles` su commerce), che la pagina Permessi NON tocca: quindi un utente marketing vede la voce «Gestione lead» nel menu e cliccandoci prende 403. ⚠️ Il giorno che qualcuno aggiunge `marketing` a quel `@Roles` per togliere il 403, si ritrova il reparto marketing dentro l\'intera tabella clienti, in silenzio. `perimetro-una-porta-sola.spec.ts` fissa ruolo per ruolo cosa rispondono oggi tutte e due.',
    categoria: SIMONE,
    ordine: 626,
    nata: '2026-08-20T19:35',
    fatta: true,
  },

  {
    chiave: 'lead-caldo-colonne-di-un-altro-crm',
    titolo: 'Il segmento del funnel si derivava dalle colonne di un altro CRM: dieci colonne su dodici erano ignote',
    dettaglio:
      'L\'elenco delle colonne che contano come «lead caldo» in `funnel-segment.ts` diceva `contacted, interested, recall, appointment, negotiation, trial, paid, won`. ⛔ **Sei di quelle otto in Metabole non esistono**, e **dieci delle dodici colonne vere l\'elenco non le conosceva**. Restavano riconosciute `trial` e `paid`: tutto il resto → **lead freddo**. Una cliente che aveva **già fatto la prima visita** risultava lead freddo in ogni evento del funnel e nelle email del ciclo di vita — cioè riceveva i messaggi pensati per chi non ci ha mai risposto. ⚠️ Non era un errore che si vedeva: era una risposta, sbagliata, data con sicurezza.\n\n✅ **Chiuso il 20/8 con due decisioni di Simone.** *Freddo è solo «Nuovo contatto»*: non più un elenco di colonne calde ma **una sola colonna fredda**, quella in cui una scheda nasce senza che sia successo niente. ⚠️ Ed è il verso giusto proprio per la ragione che ha prodotto il difetto: con un elenco di calde, **ogni colonna nuova nasce fredda** — «Primo accesso effettuato», creata lo stesso giorno, sarebbe nata fredda e nessuno se ne sarebbe accorto. E *«Percorso concluso» è ex cliente*: prima ci si arrivava solo con i soldi spesi **prima** di Metabole, quindi una cliente nata qui e arrivata in fondo al percorso non lo diventava mai — e sono le uniche email che parlano di tornare.\n\n⚠️ Cambia **da adesso in avanti**: gli eventi già scritti tengono il segmento vecchio, quindi nel pannello del funnel si vedrà un gradino il giorno del rilascio. Non è un\'anomalia dei dati, è la data in cui la domanda ha cominciato a essere fatta bene.',
    categoria: CODICE,
    ordine: 627,
    nata: '2026-08-20T19:40',
    fatta: true,
  },

  {
    chiave: 'digiuno-finestre-che-lorologio-non-sa-fare',
    titolo: 'Tre finestre si possono ancora scegliere e l\'orologio non sa riprodurle: o escono dalle tendine, o la segnalazione va ristretta',
    dettaglio:
      '⛔ **Trovato in revisione il 21/8, e tenuto in vista invece che scoperto fra un mese.**\n\n'
      + 'L\'orologio del digiuno sa produrre quattro finestre su otto. Fra quelle che si possono '
      + 'ancora **scegliere** — dal questionario e dalla scheda staff — ce ne sono **tre che non sa '
      + 'riprodurre**: «salta la cena», «salta colazione e pranzo», «salta cena e colazione».\n\n'
      + '⚠️ **Cosa succede in concreto.** Una cliente nuova compila oggi il questionario, sceglie '
      + 'digiuno e risponde «Cena». Al primo avvio la pagina dell\'orologio le si apre **vuota** — '
      + 'giusto, l\'orologio quella finestra non la sa fare — e quando sceglie parte una segnalazione '
      + 'alla nutrizionista. Cioè si segnala una scelta fatta **cinque minuti prima**. E vale anche '
      + 'quando è la coach a scriverla dalla scheda: il sistema segnala a Lucia quello che Lucia ha '
      + 'appena deciso. ⚠️ *Un avviso che compare sempre non è un avviso*, e questo comincerebbe a '
      + 'comparire sempre.\n\n'
      + '⚠️ **Non è un difetto del codice**, che fa quello che deve: la regola «se non so tradurla non '
      + 'la propongo, e lo dico a chi di dovere» è giusta, ed è quella che protegge la cliente su '
      + '«salta la cena» dal ricevere pasti che non ha chiesto. Il problema è che il prodotto '
      + '**continua a offrire** finestre che l\'orologio dichiara intraducibili.\n\n'
      + '⛔ **Le due strade, e hanno peso clinico diverso.** *(a)* Quelle tre escono dalle tendine come '
      + '`skip_lunch` — e allora la nutrizionista **non può più prescrivere «salta la cena»**, che è '
      + 'una limitazione vera e la decide Lucia. *(b)* La segnalazione si restringe a un caso più '
      + 'stretto — ma serve dire quale, senza tornare a guardare il calendario (il «prima del '
      + 'rilascio» è proprio quello che abbiamo tolto perché faceva tre regole al posto di una).\n\n'
      + '⚠️ Fino ad allora il numero è **scritto in un test** (`menu/chiedi-la-finestra.spec.ts`, «TRE, '
      + 'in attesa di decisione»): chiunque tocchi le tendine ci deve passare, invece di scoprirlo '
      + 'dalle segnalazioni. *Niente tagli silenziosi: se si scarta qualcosa, si dice quanto.*\n\n'
      + '⚠️ Entra **bassa** perché nasce da una revisione mia, come da regola del 19/8 — non perché '
      + 'valga poco: diventa urgente il giorno in cui la pagina dell\'orologio va in mano alle '
      + 'clienti, cioè prima del rilascio del pezzo React.\n\n'
      + '✅ **DECISO il 21/8: la (a), «escono dalle tendine».** E il 21/8 stesso sono uscite **tutte** '
      + 'le tendine, non solo quelle tre: la finestra non si sceglie più da nessuna parte, la deriva '
      + 'l\'orologio. Il caso che questa voce descriveva — la segnalazione a Lucia su una scelta fatta '
      + 'cinque minuti prima — non può più nascere, perché non c\'è più la scelta che la faceva '
      + 'nascere.\n\n'
      + '⚠️ Restano **leggibili** tutte e otto, e vale il costo clinico scritto sopra: «salta la cena» '
      + 'non è più prescrivibile. Vedi la voce sulle due porte.',
    categoria: CODICE,
    ordine: 628,
    fatta: true,
    nata: '2026-08-21T08:55',
    priorita: 'bassa',
  },

  {
    chiave: 'allergia-solfiti-sostituzioni',
    titolo: 'Allergia ai solfiti: il tag c\'è, ma il dizionario ne riconosce quattro parole su una dozzina — e le sostituzioni non ci sono',
    dettaglio:
      'Simone, 21/8: «dobbiamo integrare l\'allergia ai solfiti, la nutrizionista mi ha mandato il file con i '
      + 'cibi da sostituire e come sostituirli». **Lavoro in coda, non da fare oggi.** Il file sta in '
      + '`Documents/Metabole/Allergia_Solfiti/Guida_Completa_Allergia_Solfiti.pdf`.\n\n'
      + '## Cosa c\'è già, misurato (21/8)\n\n'
      + '✅ Il tag esiste ed è uno dei 14 UE: `catalog/allergens.ts` riga 25, codice `solfiti`, etichetta '
      + '«Anidride solforosa e solfiti». Quindi la nutrizionista può già taggare una ricetta, e una cliente '
      + 'che dichiara l\'allergia è già protetta **su quello che è taggato**.\n\n'
      + '⛔ **Ma il dizionario che SUGGERISCE il tag ha quattro parole**: `solfiti`, `solfito`, `vino`, '
      + '`aceto di vino`. La guida ne nomina una dozzina di portatori veri, e nessuno di questi verrebbe '
      + 'suggerito: frutta secca disidratata (albicocche, prugne, uvetta), pomodori secchi industriali, '
      + 'patate disidratate, **crostacei** (immersi in bisolfiti contro la melanosi), salsicce e insaccati, '
      + 'carne macinata confezionata, salse pronte (maionese, ketchup, senape), dadi da brodo, aceto '
      + 'balsamico, sidro, birra, succhi da concentrato, conserve di pesce. ⚠️ Il pre-tag **suggerisce** e '
      + 'la nutrizionista conferma (nessun tag automatico): quindi il difetto non è un piatto sbagliato '
      + 'servito in automatico, è che **a chi tagga non viene proposto niente** su una ricetta con l\'uvetta '
      + 'o coi gamberi, e il tag manca in silenzio.\n\n'
      + '## Cosa manca davvero: le SOSTITUZIONI\n\n'
      + '⛔ Il pezzo che la nutrizionista ha mandato non è un elenco di divieti, è un **prontuario di '
      + 'sostituzioni** — e per quello il progetto ha già la forma giusta: `menu/lattosio.ts`, dove '
      + 'l\'intolleranza al lattosio non toglie il latte ma lo sostituisce col delattosato, con scritto '
      + '**perché**. Le sette righe della guida:\n\n'
      + '| con solfiti | al posto |\n|---|---|\n'
      + '| aceto di vino / balsamico | succo di limone fresco, o aceto di mele «senza solfiti aggiunti» |\n'
      + '| vino per sfumare | brodo vegetale casalingo acidulato con limone, o succo di mela acerba |\n'
      + '| dado da brodo industriale | dado vegetale casalingo, o brodo fresco |\n'
      + '| frutta secca industriale | frutta fresca essiccata in casa a bassa temperatura |\n'
      + '| salsicce e insaccati | carne macinata al momento dal macellaio, sale pepe erbe |\n'
      + '| crostacei surgelati | pesce fresco di lisca locale, o crostacei garantiti non trattati |\n\n'
      + '⚠️ **Due di queste sostituzioni cambiano il piatto, non l\'ingrediente** (crostacei → pesce di '
      + 'lisca; insaccati → macinato fresco): non sono equivalenze come il delattosato, e vanno decise da '
      + 'Lucia prima di scriverle. Le altre quattro sono condimenti e si sostituiscono senza toccare il '
      + 'bilanciamento della giornata.\n\n'
      + '⚠️ E **una di esse cade dentro un altro allergene**: «senape» è uno dei 14, e la guida la nomina '
      + 'fra le salse pronte da evitare per i solfiti. Chi tocca questa parte guardi che le due regole non '
      + 'si contraddicano.\n\n'
      + '## Cosa NON è di questo pezzo\n\n'
      + '⛔ La guida parla anche di farmaci (colliri, anestetici con adrenalina, sciroppi col metabisolfito) '
      + 'e di ristorazione. **Fuori perimetro**: qui si decide cosa finisce nel piatto che eroghiamo noi. '
      + 'Metterlo in un menu vorrebbe dire dare un consiglio medico da un\'app di nutrizione.\n\n'
      + '⚠️ Soglia di legge, per chi ci lavorerà: l\'obbligo di dichiarazione in etichetta scatta sopra i '
      + '**10 mg/kg o 10 mg/l** espressi come SO₂ (Reg. UE 1169/2011). Sotto quella soglia i solfiti ci '
      + 'possono essere e **non essere scritti**: è il motivo per cui «leggi l\'etichetta» non basta come '
      + 'risposta, e serve una lista nostra.\n\n'
      + '✅ **CHIUSA il 24/8, con quattro decisioni di Simone.** **1)** Il dizionario dei suggerimenti passa da 4 parole a ~35 (tutti i portatori della guida): prima, su una ricetta con l\'uvetta o i gamberi, a chi tagga non veniva proposto **niente** e il tag mancava in silenzio su 3111 ricette. **2)** Le quattro sostituzioni di condimento — aceto → succo di limone fresco, vino da sfumare → brodo vegetale acidulato, dado industriale → dado casalingo, frutta essiccata industriale → essiccata in casa — si applicano **da sole**, come il delattosato (`menu/solfiti.ts`, sul modello di `lattosio.ts`). **3)** Le due che cambiano il piatto — crostacei e insaccati — **non** si sostituiscono: quei piatti escono, perché un gambero non è un branzino. **4)** `biscotti` è uscita dalle esclusioni (i solfiti nei biscotti dipendono dal produttore, non dal biscotto); `aceto` è **rimasta**, ma ha cambiato mestiere — non toglie più il piatto, lo fa **riconoscere** perché arrivi il limone al posto suo.\n\n'
      + '⛔ **E la revisione avversariale ha trovato undici cose, fra cui che la consegna PEGGIORAVA i casi che diceva di risolvere.** Il difetto peggiore era mio e si annullava da sé: `engine-rules` scrive i tag **suggeriti** su ogni ricetta appena generata, e il motore blocca su un tag anche non confermato — quindi allargando il dizionario nella stessa consegna il tag `solfiti` finiva **proprio sulle ricette che le sostituzioni dovevano salvare**, la sostituzione veniva calcolata e buttata via, e l\'insalata spariva lo stesso. Adesso, e **solo per i solfiti**, il tag non blocca da solo dove la regola per ingrediente sa cosa sostituire — e torna a bloccare se non sappiamo dire niente. ⚠️ Il commento che diceva «suggeriscono e basta, nessun auto-tag» era falso, ed è corretto invece che cancellato.\n\n'
      + '⚠️ Gli altri dieci, tutti misurati: **otto voci su diciassette** della lista che esclude non escludevano niente (astice, aragosta, granchio, «würstel» con la dieresi che è la grafia normale in etichetta, insaccati, macinato confezionato) perché non erano in `exclusions.ts`, e la regola non veniva mai interrogata; **`dado` non scattava su nessuna scrittura realistica** («dado granulare», «brodo di dado»); **i singolari passavano intatti** («albicocca secca», sulla categoria a 2000 mg/kg); **`sulphites` e `sulfites`** — gli alias con cui l\'allergia arriva dagli import — non accendevano la regola, quindi la consegna era spenta proprio per quelle clienti; il **sostituto dell\'aceto era esso stesso nell\'elenco dei vietati** (il succo di limone: la tabella parla dei succhi **concentrati**, non dello spremuto); **«bovino» faceva suggerire i solfiti** perché contiene «vino», e le omonime esistevano da giorni in `exclusions.ts` ma questa strada le ignorava; `birra` era l\'unica parola dell\'elenco senza una riga a monte che la sostenesse, ed è uscita; e **quattro mutazioni restavano verdi**, fra cui quella che riportava il dizionario alle quattro parole di prima — 31 parole nuove senza un test.\n\n'
      + '✅ **DECISA da Simone il 24/8 sera: «dove è previsto vino semplicemente togliamo il vino».** La domanda era: la chiave `vino` è incondizionata, quindi «pere al vino rosso» diventavano pere al brodo vegetale e lo zabaione al marsala pure — il caso che la decisione 3 voleva evitare, passato per la porta dei condimenti. Adesso il vino (e marsala, spumante, prosecco, sidro) **non si sostituisce**: esce dal piatto, e la riga dice «vino bianco → si toglie (niente al suo posto)». ⚠️ La ragione per cui togliere è più sicuro che sostituire: la parola «vino» in un ingrediente non dice se serve a sfumare una padella o se **è** il piatto, e una proposta assurda su un dolce fa perdere fiducia anche nelle sostituzioni giuste. ⚠️ «Aceto di vino» continua a prendere il limone: sostituti e «si toglie» si guardano nello stesso giro, ordinati per lunghezza della chiave.\n\n'
      + '✅ Verificato: build pulito, **5107 test in 315 suite** verdi con `TZ` a UTC e a Roma, e ogni assert nuovo provato alla mutazione. ⚠️ Fuori perimetro di proposito: la guida parla anche di farmaci e ristorazione — lì si darebbe un consiglio medico da un\'app di nutrizione.',
    fatta: true,
    categoria: DATI,
    ordine: 641,
    nata: '2026-08-21T11:20',
    priorita: 'neutra',
  },

  {
    chiave: 'digiuno-due-porte-per-la-finestra',
    titolo: 'La finestra del digiuno la scrivono in due: la scheda staff a mano, l\'orologio per derivazione — e una disfa l\'altra',
    dettaglio:
      '⛔ **Trovato in revisione il 21/8, e va deciso prima che qualcuno ci si scotti.**\n\n'
      + 'Da quando c\'è l\'orologio, `fastingWindow` — cioè **quali pasti riceve** — si **deriva** da '
      + 'protocollo e orario. Ma la scheda cliente del backoffice continua a scriverla **a mano** dalla '
      + 'tendina «Pasti che salta», che era la porta di prima e serve ancora alla nutrizionista.\n\n'
      + '⚠️ Le due porte non convivono: la correzione fatta dalla scheda dura **fino al primo spostamento '
      + 'della cliente**, che ricalcola la finestra dai suoi orari e la riscrive. E non se ne accorge '
      + 'nessuno — il riferimento dell\'attività di verifica non cambia per una traslazione di un\'ora, '
      + 'quindi non nasce nemmeno una segnalazione nuova. *Se due punti rispondono alla stessa domanda, '
      + 'uno dei due deve chiamare l\'altro.*\n\n'
      + '✅ **Intanto i testi delle attività non mentono più**: dicevano «la finestra si corregge dalla '
      + 'scheda», e adesso dicono che i pasti li decide l\'orologio della cliente. Una ragione falsa è '
      + 'peggio di un ordine sbagliato — ma la contraddizione sotto resta.\n\n'
      + '⛔ **Le strade, e la scelta è tua e di Lucia.** *(a)* La scheda staff smette di scrivere la '
      + 'finestra e scrive **protocollo e orario** (le stesse due leve della cliente): una porta sola, e '
      + 'la nutrizionista continua a poter intervenire. *(b)* La scheda resta com\'è e la sua scrittura '
      + '**vince**: allora serve un modo di dire all\'orologio «questa cliente ce l\'ha impostata a mano», '
      + 'o si torna al punto di partenza. ⚠️ La (a) costa meno e toglie una tendina; la (b) tiene alla '
      + 'nutrizionista una leva che l\'orologio non ha (prescrivere una finestra che l\'orologio non sa '
      + 'disegnare, come «salta la cena»), e quella leva oggi serve a una cliente vera.\n\n'
      + '⚠️ Legata alla decisione già in elenco sulle tre finestre ancora scegliibili che l\'orologio non '
      + 'sa riprodurre: è la stessa domanda vista dall\'altra parte.\n\n'
      + '✅ **DECISO E FATTO il 21/8, e più netto della (a).** Simone: «non ha più senso scegliere i '
      + 'pasti, sono campi che devono proprio sparire, e nella scheda cliente devo leggere le fasce». '
      + 'La porta adesso è **una sola** — l\'orologio della cliente — e la scheda staff **legge**: '
      + 'apertura, chiusura, protocollo, gli orari dei pasti, dalla stessa funzione che disegna '
      + 'l\'orologio in app. Sparita la tendina «Pasti che salta», sparita la domanda del questionario, '
      + 'spariti i pallini nel profilo dell\'app.\n\n'
      + '⚠️ **Non bastava togliere il campo dai DTO**: `PROFILE_FIELDS` è il ciclo cieco che scrive sul '
      + 'profilo, e finché `fastingWindow` era in quell\'elenco un chiamante qualsiasi lo scriveva lo '
      + 'stesso. La guardia sta dove si scrive. ⚠️ E anche uno **script** lo scriveva '
      + '(`prisma/sposta-percorso-cliente.ts`): azzerava la finestra e lasciava l\'orologio, che è lo '
      + 'stato peggiore dei due.\n\n'
      + '⛔ **Quello che si è perso, e va detto:** la nutrizionista non può più **prescrivere** una '
      + 'finestra che l\'orologio non sa disegnare («salta la cena»). Era la leva della strada (b), e '
      + 'oggi serve a una cliente vera. Se Lucia la rivuole, la forma giusta è protocollo + orario '
      + 'scritti dalla scheda — non il ritorno della tendina.\n\n'
      + '⚠️ Chi l\'orologio non l\'ha ancora toccato **si legge lo stesso**, in tutte e due le schede: '
      + 'la sua finestra storica sta decidendo quali pasti riceve, e un dato che agisce e non si vede '
      + 'è il difetto peggiore di questo progetto.\n\n'
      + '⚠️ Il permesso «Cambia i pasti del digiuno» non protegge più nessuna porta. Resta nella tabella '
      + 'dei ruoli: chi ce l\'ha oggi va avvisato prima di toglierglielo.',
    categoria: CODICE,
    ordine: 642,
    nata: '2026-08-21T11:40',
    fatta: true,
  },
  {
    chiave: 'digiuno-resta-corta-non-la-guarda-nessuno',
    titolo: 'La terza condizione della verifica digiuno — quella che guarda le calorie vere — non la calcola nessuno',
    dettaglio:
      '⚠️ **Dichiarato invece che lasciato credere** (revisione del 21/8). Il §3 del foglio decisioni dà '
      + 'tre condizioni per aprire la verifica alla nutrizionista, e dice che la terza è **la migliore**: '
      + '`restaCorta`, cioè «anche coi moltiplicatori delle porzioni al tetto, le calorie della giornata '
      + 'non arrivano al fabbisogno». Le altre due guardano il **nome** del protocollo (20:4, 23:1) e il '
      + 'numero di pasti; questa guarda quello che quella cliente **riceve davvero**.\n\n'
      + '⛔ Oggi le prime due ci sono e girano; **la terza non la calcola nessun punto del percorso.** '
      + 'Tre commenti nel codice dicevano «la aggiunge chi chiama», e chi chiama non la aggiungeva: '
      + 'adesso quei commenti dicono che manca, così nessuno la dà per coperta.\n\n'
      + 'Cosa serve per farla: il segnale esiste già — `menu/porzione-scalata.ts` torna `restaCorta`, e da '
      + 'lì esce `daily_kcal_below_target`. Il pezzo mancante è **collegarlo al momento della scelta**: '
      + 'quando la cliente imposta l\'orologio serve la sua dieta e il suo fabbisogno per sapere se con '
      + 'quella finestra ci arriva. ⚠️ In alternativa (forse meglio) la si aggancia **al segnale che già '
      + 'esiste**, cioè quando il motore compone la giornata e vede che resta corta: è più tardi di un '
      + 'giorno, ma è misurato sui menu veri invece che su una previsione.'
      + '\n\n## ✅ FATTA il 22/8 — agganciata al segnale che esisteva già\n\n'
      + '⚠️ **Non al momento della scelta**, che era la strada che avevo scritto per prima: '
      + '`impostaDigiuno` non ha in mano né la dieta né il fabbisogno, e per dirlo dovrebbe rifare '
      + 'il conto del motore. Due conti sulla stessa domanda divergono — è già successo due volte '
      + 'fra il motore e `diag:digiuni`. ✅ Nasce invece **all\'erogazione**, dove `porzione-scalata` '
      + 'torna già `restaCorta` sui pasti veri, dopo la scalatura: costa un giorno di ritardo e in '
      + 'cambio è **misurata** invece che prevista.\n\n'
      + '⚠️ Il riferimento dell\'attività è la **situazione** (finestra + spuntini tolti + dieta + '
      + 'quota arrotondata al 5%), non la data: `deliverIfEligible` gira a ogni apertura dell\'app, e '
      + 'una data lì dentro avrebbe fatto nascere un\'attività al giorno per la stessa identica cosa.\n\n'
      + '⚠️ **Non solo il digiuno**: una giornata corta col moltiplicatore al tetto è corta anche per '
      + 'chi ha degli spuntini tolti, o quando è il catalogo a non avere giornate sostanziose. Il '
      + 'testo dice **quale delle tre**, perché si chiudono in tre modi diversi — e nel terzo caso le '
      + 'porzioni non c\'entrano niente e manda a `diag:varieta`.\n\n'
      + '⛔ **E agganciandola è saltato fuori un difetto più grosso**: `apriAttivitaCoach` dichiarava '
      + 'da sempre «non lancia mai», e dentro **non aveva nessun `try`**. Mettendola nell\'erogazione '
      + 'del menu, un intoppo su `coachTask` avrebbe fatto fallire la consegna del menu della cliente '
      + '— cioè proprio il lavoro vero che quella funzione dice di non voler fermare. Adesso la '
      + 'promessa è mantenuta, torna `non-riuscita`, e lo scrive: se degradi, dillo.',
    categoria: CODICE,
    ordine: 643,
    nata: '2026-08-21T11:45',
    fatta: true,
  },
  {
    chiave: 'esclusioni-fuori-dal-pool',
    titolo: 'Il motore metteva il polpo nel piatto a un\'allergica ai molluschi, poi si fermava da solo — corretto',
    dettaglio:
      'Dalla domanda del 21/8: «Sonia non riceve i menu». `diag:cliente` in produzione: sei allergie dichiarate (crostacei, pesce, solfiti, lupini, molluschi, soia), **zero giornate erogate**, e una segnalazione «Piano bloccato» aperta lo stesso giorno con dentro «Polpo grigliato: contiene Molluschi» e «Bresaola: incompatibile con allergia solfiti».\n\n⛔ **Il blocco ha fatto il suo mestiere: sbagliata era la scelta.** Il filtro a monte esisteva già — `buildScoringContext` toglie dal pool le ricette vietate **sulla dieta** da Vera, «così non vengono nemmeno prese in considerazione» — ma le allergie e le intolleranze **della cliente** in quel filtro non c\'erano: entravano solo nel veto finale, dove una violazione ferma **tutta** la giornata (`return []`). Il motore pescava il polpo mentre nel pool c\'erano altri piatti.\n\n✅ Adesso ci passano anche loro, con **una funzione sola** per il filtro e per la guardia (`menu/esclusioni-della-cliente.ts`, puro): due copie vorrebbero dire un filtro che toglie un insieme di piatti e una guardia che ne vieta un altro, e la differenza fra i due sarebbe una cliente ferma senza che nessuno capisca perché — c\'è un test che verifica proprio che dicano la stessa cosa su ogni ricetta. ⚠️ Escono solo le ricette con una **violazione**: quelle sostituibili restano, e il piatto si eroga con la sostituzione annotata. ⚠️ **Uno slot che resterebbe vuoto non si svuota** (regola dell\'11/8): a fermare la giornata dev\'essere la guardia, che sa dire cosa e perché.\n\n⛔ **E il rimedio a mano non poteva funzionare:** la nutrizionista le ha dato una sostituzione la mattina del 21/8 e «non è stata comunque applicata» — con zero giornate erogate non c\'è nessun piatto su cui applicarla, e la composizione dopo ricadeva sul piatto successivo. Un piatto per volta contro un pool intero.\n\n⚠️ **Da verificare dopo il deploy**, ed è l\'unico pezzo che il codice non può decidere: `npm run diag:cliente` sulla sua email (che in questo repository non si scrive: `email-nei-file.spec.ts`). Se «Piano bloccato» è ancora aperta, il suo pool non ha alternative sicure per quel pasto — e allora il rimedio è il **catalogo**, o le due voci larghe dei solfiti (`aceto` e `biscotti`, dichiarate a parte in `exclusions.ts` apposta per poterle togliere se Lucia dice che sono eccessive).',
    categoria: CODICE,
    ordine: 629,
    nata: '2026-08-21T09:10',
    fatta: true,
  },

  {
    chiave: 'blocco-piano-non-si-zittisce',
    titolo: 'Chiudere «Piano bloccato» ne spegneva il cartello per quattordici giorni — corretto',
    dettaglio:
      'Trovato leggendo il codice il 21/8, e **non è il caso di Sonia** (la sua riga era aperta): è il caso di chiunque venga sbloccata mentre il motore ancora non compone.\n\nLa tregua dell\'11/8 («se ha risolto, basta fino a nuova segnalazione») è giusta per gli allarmi clinici: un avviso che ritorna da solo insegna a chiuderlo senza leggerlo. Ma la riga «Piano bloccato» **non è un avviso**: è ciò che `dietBlock` legge per dire all\'app `blocked`. Zittirla non toglieva un fastidio, toglieva lo **stato** — cliente ancora senza menu, nessuna riga in elenco, e in app «Menu in preparazione, arriverà a breve», che è falso. ⚠️ E `diet_blocked` non ha `severity`, quindi l\'eccezione «si riapre se peggiora» non la salvava mai.\n\n✅ `statoNonAvviso` in `apri-segnalazione.ts`: dentro la tregua non nasce un doppione — quello è il rumore che la tregua evita, giustamente — ma si **riapre la riga risolta** riscrivendoci il motivo di adesso. Lo usano i due punti che aprono il blocco: `menu.service` e `personal-base`. ⚠️ Sì: se la si richiude e il motore ancora non compone, tornerà. È il punto — il rimedio è far comporre il motore, non spegnere l\'unica cosa che lo dice.',
    categoria: CODICE,
    ordine: 630,
    nata: '2026-08-21T09:12',
    fatta: true,
  },

  {
    chiave: 'clienti-nuove-al-capo-nutrizionista',
    titolo: 'Le clienti nuove le prende il capo nutrizionista, finché è una sola — fatto',
    dettaglio:
      'Richiesta di Simone del 21/8, e Sonia ne è la prova: questionario del **7/8** con sei allergie dichiarate, e al 21/8 `diag:cliente` stampava ancora «Nutrizionista: — nessuna —».\n\n⛔ **E QUI AVEVO SCRITTO UNA COSA SBAGLIATA, smentita dalla misura poche ore dopo.** Avevo scritto che le sue segnalazioni cliniche erano «nate senza destinatario»: non l\'avevo misurato, l\'avevo dedotto dal codice. `npm run assegna:nutrizionista` in produzione dice **zero** segnalazioni aperte e orfane su **39** clienti, perché `apriSegnalazione` instrada già al **capo** quando il ruolo non è assegnato. Resta scritta invece che cancellata: *non spacciare un ragionamento per una misura*.\n\n⚠️ Quello che manca davvero è la **presa in carico della cliente**: senza nutrizionista in scheda, nelle liste, nella chat e nei perimetri quella persona non è di nessuno — e delle 39 **sei** hanno lo screening acceso, cioè un percorso in cui il menu parte *dopo la visita col nutrizionista*. ⛔ Resta anche un buco più piccolo, questo sì letto nel codice: le due `escalation.create` **dirette** in `onboarding.service` (screening e obiettivo irreale) non passano da `apriSegnalazione` e nascerebbero orfane; oggi non ce n\'è nessuna aperta.\n\n⚠️ «Il team non si assegna in automatico» resta la regola giusta quando le nutrizioniste sono più d\'una: distribuire i pazienti è una decisione. Con **una sola** non è una decisione, è un passaggio a mano — e quando salta, la cliente resta senza nessuno che risponda di lei.\n\n✅ Chi finisce il questionario senza nutrizionista sul lead va al **capo** (lo stesso destinatario che sceglie già `apri-segnalazione` quando il ruolo non è assegnato), **la coach no**, e mai sovrascrivendo un\'assegnazione esistente. Vale anche per chi **rifà** il questionario, che finiva nel ramo `update` dove l\'assegnazione non c\'era: «non sovrascrivere» e «non riempire il vuoto» sono due cose diverse.\n\n⚠️ Si spegne con `assign_head_nutritionist_by_default`, e la funzione **conta le altre nutrizioniste**: quando quel numero non è più zero la regola ha fatto il suo tempo e lo scrive nell\'audit, invece di restare accesa per sempre. ✅ `npm run assegna:nutrizionista` (sola lettura; `CONFERMA=1` applica) recupera chi è **già** rimasta senza — al 21/8 sono **39** — e riassegna anche le eventuali segnalazioni aperte e orfane. ⚠️ La prima passata dice anche che **«Dr.ssa Bini» esiste già**: la premessa «finché è una sola» è già scaduta, e la decisione se dividere le clienti è di Simone.',
    categoria: CODICE,
    ordine: 631,
    nata: '2026-08-21T09:14',
    fatta: true,
  },

  {
    chiave: 'diag-cliente-quattro-buchi',
    titolo: '`diag:cliente` ha stampato «Nessun piano attivo» a una cliente che un piano ce l\'ha — corretto',
    dettaglio:
      'Su Sonia, il 21/8, con «Conosciamoci» in coda dal 22/8. Il verdetto guardava `status === \'active\'` invece di `STATI_CON_UN_PIANO`: la regola di prima del 19/8, da quando un piano che comincia più avanti nasce `queued`. ⚠️ Una diagnostica che risponde diversamente dal codice manda a cercare il difetto dove non c\'è — ed è la **seconda volta** che succede proprio sulla domanda «perché non riceve il menu?» (la prima fu Giusy, il 13/8).\n\n✅ Corretti nella stessa direzione altri tre buchi: la misura di partenza era `misure === 0` («una pesata qualsiasi, in tutta la storia») invece di `mancaMisuraDiPartenza`, cioè quella **di questo piano**; `planHeldAt` veniva stampato ma **non era nella scala del verdetto**, quindi un piano fermato dal nutrizionista usciva come «Menu in preparazione»; e si leggevano solo le segnalazioni **aperte**, mentre nel caso della tregua quella che decide è una **risolta** (adesso stampa anche quelle degli ultimi 14 giorni, con quanti giorni fa).\n\n✅ Aggiunti i due stati che mancavano e che il codice ha da tempo — **Monitoraggio** e **finestra di visibilità** — e corretta la frase «si sblocca CHIUDENDO la segnalazione»: non è vero, il blocco si ricalcola a ogni composizione, ed è esattamente il malinteso da cui è partita la giornata.',
    categoria: CODICE,
    ordine: 632,
    nata: '2026-08-21T09:16',
    fatta: true,
  },

  {
    chiave: 'blocco-che-rientra-e-motivo-aggiornato',
    titolo: 'Una segnalazione aperta diceva cosa non andava IERI — corretto, e c\'è lo strumento per chiederlo al motore',
    dettaglio:
      'Dopo il deploy della correzione del pool, `diag:cliente` su Sonia mostrava ancora «Piano bloccato» con gli stessi due piatti. La lettura naturale è «non ha funzionato». ⛔ **E sarebbe stata sbagliata:** `ensureDietBlockedEscalation` cominciava con `if (already) return`, quindi una riga già aperta **non veniva mai aggiornata** — sarebbe rimasta identica anche a motore riparato — e nessuno la chiudeva quando la causa spariva (l\'unica chiusura automatica sta in `personal-base`, che è un\'altra strada).\n\n✅ **Due correzioni.** Se i motivi cambiano, il **motivo si riscrive** sulla riga che c\'è, senza doppioni: è la stessa scelta di `sbloccaPiano`, torna il motivo nuovo. E se l\'erogazione produce dei giorni, le segnalazioni «Piano bloccato» **di origine menu** si chiudono da sé con `resolvedAt`. ⚠️ Solo quelle di origine menu: il motivo comincia con una costante condivisa (`MOTIVO_BLOCCO_MENU`) usata dai tre punti che devono riconoscere la stessa riga — chi la apre, chi la aggiorna, chi la chiude. Quelle della base personalizzata sono un\'altra causa, e spegnerle da qui vorrebbe dire spegnere un allarme non verificato.\n\n✅ **E lo strumento che mancava: `npm run prova:erogazione -- <email>`.** Non c\'era modo di chiedere al motore **se compone**: c\'era solo la fotografia di una segnalazione, che poteva essere di ieri. Chiama `deliverIfEligible`, cioè la funzione che parte quando la cliente apre l\'app. ⚠️ **Eroga per davvero**, e lo dice in testa, ma non forza niente: se un cancello è chiuso non succede nulla e viene detto quale. Distingue i tre casi che prima si confondevano: giorni erogati · nessun giorno con un blocco (col motivo, e se è stato aggiornato adesso) · nessun giorno senza blocco, cioè fermo a un cancello.\n\n✅ **Confermato da Simone in produzione**: «ho fatto rigenera menu ed è andato». Il motore compone, la riga era vecchia.',
    categoria: CODICE,
    ordine: 633,
    nata: '2026-08-21T10:20',
    fatta: true,
  },

  {
    chiave: 'tabelle-frecce-anche-in-alto',
    titolo: 'Nelle tabelle a più pagine le frecce stanno solo in fondo: metterle anche in alto — su tutte',
    dettaglio:
      'Richiesta di Simone del 21/8: «dove ci sono le tabelle con più pagine mettiamo anche in alto le '
      + 'frecce per cambio pagina come in basso, metti in nota per dopo da fare su tutte le tabelle».\n\n'
      + '⚠️ **Perché non è un vezzo.** Su una tabella lunga, per cambiare pagina bisogna scorrere fino '
      + 'in fondo, cliccare, e poi risalire in cima a leggere — due volte per ogni pagina. Chi sfoglia '
      + 'venti pagine di clienti fa quaranta viaggi che non servono a niente. E le frecce in fondo si '
      + 'trovano solo se si sa che ci sono: in cima si vedono.\n\n'
      + '⚠️ **Su TUTTE le tabelle, ed è la parte che si sbaglia**: farlo su quella che si aveva sotto '
      + 'mano lascia il backoffice con due comportamenti diversi per la stessa cosa, che è peggio di '
      + 'nessuno dei due. La strada giusta è **un componente solo** — le frecce, il numero di pagina, '
      + 'lo stato «prima»/«ultima» — usato in alto e in basso dalla stessa tabella: due copie dello '
      + 'stesso blocco divergono, e qui divergerebbero **dentro la stessa schermata**.\n\n'
      + '⚠️ E la barra in alto compare **solo se le pagine sono più d\'una**: due righe di comandi '
      + 'attorno a una tabella di sei righe sono rumore.\n\n'
      + '⚠️ Prima di scrivere: censire dove sono le tabelle paginate oggi, perché la paginazione qui non '
      + 'è un componente ma un pezzo ripetuto a mano — il censimento È metà del lavoro.\n\n'
      + '## ✅ FATTO il 21/8 — e il censimento ha smentito la premessa\n\n'
      + '⚠️ **«La paginazione è un pezzo ripetuto a mano» era falso**, e l\'avevo scritto senza '
      + 'guardare. Il componente condiviso c\'era già (`usePagination` + `<Pager>` + `useTabella`), e '
      + 'sei tabelle su trenta la barra in cima ce l\'avevano dall\'11/8. Il lavoro era molto più '
      + 'piccolo di come l\'avevo descritto: *misura prima di decidere*, anche quando si decide solo '
      + 'quanto costa.\n\n'
      + '✅ **Adesso ce l\'hanno tutte e 27**, più `LeadsTable` — l\'unica paginata lato server, dove '
      + 'la conversione 0-based → 1-based è stata estratta in un posto solo (`pagerLead`): con due '
      + 'barre, un `+1` copiato e un `-1` dimenticato le mostrerebbe su pagine diverse.\n\n'
      + '⛔ **Due difetti veri trovati dal censimento, e non erano cosmetici.** `Agenti` e '
      + '`CoperturaCatalogo` chiamavano `useTabella` con un tetto (500 e 200 righe) e **non '
      + 'disegnavano nessuna barra**: le righe oltre il tetto esistevano, si filtravano, finivano '
      + 'nell\'Excel — e a schermo non c\'erano. Su `CoperturaCatalogo`, che è la schermata che dice '
      + '*cosa manca a catalogo*, voleva dire una copertura incompleta letta come completa.\n\n'
      + '⛔ **E la revisione ha trovato che la mia correzione non funzionava.** La card che contiene '
      + 'una tabella scorre dentro di sé (`theme.css`: `overflow: auto` + `max-height`), quindi una '
      + 'barra messa lì come primo figlio **se ne va al primo movimento di rotella** — invisibile '
      + 'proprio per tutto il tempo in cui serve. Avevo cercato l\'`overflow` nel JSX e stava nel '
      + 'CSS: l\'ho scritto giusto in due file e sbagliato in diciannove. ✅ Corretto in **un posto '
      + 'solo**: `<Pager sopra>` è `sticky` (`top`, `left` e `zIndex` sopra l\'intestazione '
      + 'incollata) — e così si sistemano anche le sei di prima, che avevano lo stesso difetto '
      + 'dall\'11/8 senza che nessuno se ne fosse accorto.\n\n'
      + '⚠️ La regola sta in un test (`frecce-anche-in-cima.spec.ts`) che guarda il sorgente: le due '
      + 'barre appaiate, la posizione rispetto alla tabella, e che chi pagina ne disegni una. ⛔ Le '
      + 'prime due stesure erano aggirabili — una rompeva perfino `npm run build` (leggeva i file con '
      + '`fs`, e il backoffice non ha i tipi di Node), un\'altra non vedeva i `<Pager>` con una '
      + 'freccia grassa nelle props, cioè proprio la forma di `LeadsTable`. Sei mutazioni provate una '
      + 'per una.',
    categoria: CODICE,
    ordine: 644,
    nata: '2026-08-21T13:50',
    fatta: true,
  },

  {
    chiave: 'attivita-nutrizionista-in-app',
    titolo: '✅ App staff: la nutrizionista vede le sue attività nella sua dashboard',
    dettaglio:
      '⛔ **La push le arrivava, la sua schermata non ce l\'aveva.** Dal 21/8 quattro tipi di attività '
      + 'nascono addosso alla nutrizionista (digiuno estremo, finestra non traducibile, pasti non '
      + 'serviti, calorie che restano corte) e la push le arriva davvero. Il 22/8 le era stata aperta '
      + 'la pagina **del backoffice** — prima rispondeva 403 — ma l\'app staff no: `NutriDashboard` '
      + 'chiamava `/nutritionist/dashboard`, `validation-queue` ed `escalations`, e '
      + '`/staff/coach-tasks` non lo chiamava nessuno. Il pallino sul tab era dietro `isCoachSide`, '
      + 'che non la comprende. ⚠️ Una notifica che porta a una schermata **vuota** è peggio di un 403: '
      + 'non dice nemmeno che una porta esiste.\n\n'
      + '✅ **CHIUSA il 3/9.** Sezione «Le tue attività» in `NutriDashboard`, **sopra** le priorità '
      + 'cliniche — sono le uniche righe di quella pagina che hanno una **scadenza**, e per cui a lei '
      + 'è già arrivata una notifica sul telefono. Il pallino sul tab adesso comprende anche i suoi '
      + 'ruoli, e la push è tornata a dire «La trovi in Dashboard».\n'
      + '⚠️ **Nessun filtro nell\'app**: l\'endpoint la serve già coi suoi quattro tipi sulle sue '
      + 'clienti (`filtroNutrizionista`). Due regole per la stessa domanda divergono, e questa decide '
      + 'cosa vede una persona.\n'
      + '⛔ **E la frase e la schermata si sono mosse INSIEME**, con una prova che le tiene legate: '
      + 'rimettere la frase senza la sezione rimanderebbe la nutrizionista su una schermata vuota; '
      + 'fare la sezione lasciando la frase vecchia la manderebbe al computer mentre ha la cosa nel '
      + 'telefono. Ciascuna metà, da sola, sta in piedi — ed è per questo che serve una prova che le '
      + 'guarda tutte e due.\n'
      + '⚠️ La scadenza si scrive **sempre**, non solo quando è passata: «per il 5/9» dice cosa fare, '
      + '«in ritardo» dice solo che è tardi.\n\n'
      + '⛔ **QUATTRO COSE LE HA TROVATE LA REVISIONE AVVERSARIALE, e la prima da sola valeva la '
      + 'revisione.**\n'
      + '· **L\'app non compilava.** Togliendo il vecchio `isCoachSide` era rimasta la '
      + 'dichiarazione senza più nessuno che la leggesse, e `app/tsconfig.json` ha '
      + '`noUnusedLocals: true`: TS6133, job «App · build» rosso, build Vercel ferma. ⚠️ **Nessuna '
      + 'delle sei prove se ne accorgeva**, perché leggevano `ui.tsx` come testo invece di '
      + 'compilarlo. Da qui l\'app si typechecka davvero prima di consegnare (`npx tsc -b` in '
      + '`app/` e in `backoffice/`, dipendenze installate).\n'
      + '· ⛔ **La schermata era una vetrina.** Su questi quattro tipi la coach prende 403 '
      + '(`TIPI_DELLA_NUTRIZIONISTA`, regola del 22/8): **è lei l\'unica** che può chiuderli. La '
      + 'sezione gliele mostrava e basta — quindi push, apre la Dashboard, e per il clic doveva '
      + 'tornare nel backoffice, cioè l\'indirizzo che la frase aveva appena smesso di darle; e il '
      + 'giorno dopo `escalateAttivitaScadute` le manda alla manager commerciale. Adesso c\'è il '
      + 'pulsante **«Fatto»**. ⚠️ Niente «Salta», al contrario della coach: saltare «digiuno '
      + 'estremo» o «calorie corte» è una decisione clinica.\n'
      + '· ⚠️ **«…e altre 12» non portava da nessuna parte**: l\'app staff non ha una pagina con '
      + 'tutte le attività, e il backoffice è dietro una chiave che può essere spenta. E l\'ordine '
      + 'è `dueDate asc`, quindi l\'attività **appena notificata** era proprio l\'ultima — il caso '
      + 'della push. Si mostrano tutte.\n'
      + '· ⚠️ **`clientName` poteva arrivare stringa vuota**: era '
      + '`name ?? [nome, cognome].join(\' \') ?? email ?? \'Cliente\'`, e `join` non torna **mai** '
      + 'nullish — con i campi vuoti usciva `\'\'` e i due ripieghi erano codice morto. La riga '
      + 'cominciava con « · per il 05/09». Ora è la funzione pura `nomeDellaCliente`, con le sue '
      + 'prove.\n'
      + '⛔ E le sei prove sono state rifatte: erano **tutte** `toMatch` su testo, e una mutazione '
      + 'da un token (`if (lista.length === 0) return <></>` reso incondizionato) spegneva la '
      + 'sezione lasciandole verdi. La frase della push è backend, quindi adesso si prova '
      + '**chiamando `avvisaAttivitaNuova`** e leggendo il `body` che parte. ⚠️ E la prova che '
      + 'lega le due metà pretende che siano **tutte e due vere**, non che «siano uguali»: '
      + '`false === false` passava, e chi le toglieva entrambe non incontrava resistenza. '
      + 'Dieci prove, e **dieci mutazioni su dieci uccise** sulle due consegne.',
    categoria: CODICE,
    ordine: 660,
    nata: '2026-08-22T09:30',
    fatta: true,
  },
  {
    chiave: 'descrizioni-diete-tabella',
    titolo: '✅ Nutrizionista: tabella per leggere e correggere le descrizioni delle diete (consegnata il 22/8, verificata il 28/8)',
    dettaglio:
      'Richiesta di Simone del 22/8: *«nella parte del nutrizionista manca una tabella dove si '
      + 'vedono e si possono modificare le descrizioni delle diete, che sono poi quelle che si '
      + 'leggono in app come spiegazione»*.\n\n'
      + '⚠️ Prima di scrivere: **censire dove sta oggi quel testo** e chi lo mostra — la stessa '
      + 'spiegazione potrebbe arrivare da più di un campo, e in quel caso la tabella deve dire quale '
      + 'sta correggendo. Il censimento è metà del lavoro (lezione delle frecce, 21/8: la premessa '
      + 'scritta senza guardare era falsa).\n\n'
      + 'Da decidere con Simone: se la modifica è libera o passa dall\'approvazione del capo, come '
      + 'per le diete a catalogo; e se il cambio va storicizzato nel log (probabile sì: è un testo '
      + 'che la cliente legge).\n\n'
      + '✅ **Consegnata il 22/8** (commit `2bacf18`), e **riverificata riga per riga il 28/8** prima '
      + 'di spuntarla — perché una voce chiusa a memoria è una voce che non è stata chiusa. Nel '
      + 'codice ci sono tutti e tre i pezzi: la pagina `DescrizioniDiete.tsx`, la rotta `/descrizioni-diete` '
      + 'con la voce di menu sotto Catalogo, e la scrittura `PATCH /diets/famiglia/product`.\n\n'
      + '⚠️ **Le due domande che avevo lasciato aperte NON le chiudo io.** Erano domande su cosa vuole '
      + 'Simone, non su cosa fa il codice: leggere il comportamento di oggi e chiamarla risposta '
      + 'vorrebbe dire che qualunque domanda di prodotto si chiude da sola guardando il diff. Quello '
      + 'che posso dire è **cosa succede adesso**, e sta scritto nella voce `descrizioni-diete-cosa-resta`.\n\n'
      + 'Per la cronaca, e misurato: sulla rotta che **questa pagina** usa '
      + '(`PATCH /diets/famiglia/product`) la scrittura è una **lista di tre campi** — `clientName`, '
      + '`clientDescription`, `seasonalTag` — e la visibilità da lì non la tocca **nessuno**, capo '
      + 'compreso; la guardia **per campo** (`clientVisible`/`siteVisible`/`recommended`/`objective` '
      + 'al solo capo) è sull\'**altra** rotta, quella per id del pulsante «Scheda cliente» in pagina '
      + 'Diete. ⚠️ E il modale di questa pagina manda solo due dei tre campi: `seasonalTag` non lo '
      + 'scrive mai. Il registro c\'è, ed è **una riga per variante** e non una per famiglia — chi '
      + 'filtra sulla dieta #7 ci trova il suo cambio.\n\n'
      + '⚠️ **Quello che questa pagina NON copre** — la scheda lunga del «?» («In pratica», «Cosa dice '
      + 'la ricerca», le fonti) sta **nel codice dell\'app**, per stile e non per dieta: voce '
      + '`scheda-stile-cablata-nell-app`. Il permesso, il registro best-effort e la domanda '
      + 'sull\'approvazione del capo stanno in `descrizioni-diete-cosa-resta`. ⛔ Chiudere questa voce '
      + 'senza scrivere quelle due sarebbe stato spegnere la spia lasciando acceso il motore.',
    categoria: CODICE,
    ordine: 661,
    nata: '2026-08-22T10:10',
    fatta: true,
  },
  {
    chiave: 'perimetro-nutrizionista-senza-assegnazione',
    titolo: '✅ La nutrizionista NON vede le clienti senza assegnazione: quelle restano del capo (deciso il 25/8)',
    dettaglio:
      'Emerso il 22/8 aprendo la pagina Attività alla nutrizionista. `perimetroClienti` le dà **solo '
      + 'le clienti assegnate a lei**; le clienti senza nutrizionista assegnata sono di fatto del '
      + '**capo**, che vede tutto.\n\n'
      + '✅ **Decisione di Simone, 25/8**: *«il capo nutrizionista sì li deve vedere tutti, gli altri '
      + 'nutrizionisti no, vedono solo quelli assegnati a loro»*. È **quello che il codice già '
      + 'faceva** — e allora perché consegnare qualcosa? Perché finché era solo il comportamento di '
      + 'oggi, chiunque poteva «migliorarlo» in buona fede («così la nutrizionista vede anche le '
      + 'orfane, che è più comodo») e nessuno avrebbe saputo che era una decisione presa. Un '
      + 'comportamento senza una prova che lo tiene è un comportamento in attesa di essere cambiato '
      + 'per sbaglio.\n\n'
      + '✅ **Consegnato il 25/8**: quattro prove in `perimetro-una-porta-sola.spec.ts` che fissano '
      + 'la decisione — il capo senza perimetro, la nutrizionista solo sulle sue, la cliente **senza '
      + 'assegnazione fuori** dal perimetro di qualunque nutrizionista, e la nutrizionista senza '
      + 'scheda `Staff` che vede **zero e non tutte** (sbagliare per difetto si vede subito, per '
      + 'eccesso non si vede affatto).\n\n'
      + '⚠️ **E la divergenza su marketing è stata misurata invece che appianata**: '
      + '`perimetroClienti` risponde «nessun limite» anche a `marketing` e `head_marketing`, mentre '
      + '`vedeTutteLeClienti` no. Ma i punti che chiamano `perimetroClienti` stanno dietro controller '
      + 'i cui `@Roles` **non nominano marketing**; l\'unico raggiungibile da un ruolo marketing è il '
      + 'CRM dei lead, dove «vede tutti i lead» è il mestiere della pagina. Quindi è una differenza '
      + 'di forma, non un accesso in più — e un test lo tiene fermo, così se un domani un endpoint '
      + 'clinico aggiungesse `marketing` fra i suoi ruoli diventerebbe rosso.\n\n'
      + '⚠️ **Resta il passo vero**: con due o più nutrizioniste, «le clienti di nessuno» diventano un '
      + 'buco che nessuno guarda per mestiere — ed è lo stesso momento in cui va spento '
      + '`assign_head_nutritionist_by_default`. Quello è un lavoro di assegnazione, non di perimetro.',
    categoria: SIMONE,
    ordine: 662,
    nata: '2026-08-22T10:15',
    fatta: true,
  },

  {
    chiave: 'markdown-nei-testi-alle-clienti',
    titolo: '✅ Le clienti leggevano «Hai qualche **allergia** alimentare?»: il markdown adesso o si disegna o si toglie',
    dettaglio:
      '⛔ **Trovato il 22/8 guardando la pagina vera**, di rimbalzo da un difetto identico sulle '
      + 'attività della nutrizionista. In tutto il progetto **non esiste nessun renderer markdown** — '
      + 'niente `remark`, niente `marked`, nessun `dangerouslySetInnerHTML` — eppure decine di testi '
      + 'sono scritti col grassetto di markdown e mostrati come testo semplice. Gli asterischi si '
      + 'leggono.\n\n'
      + '⚠️ **Cosa vede una cliente, oggi**: in chat, `Hai qualche **allergia** alimentare?` '
      + '(`chat/allergie-chat.ts`, reso in `app/src/components/ChatSheet.tsx` come `{m.body}`). E poi '
      + '`menu/senza-glutine.ts` (corpo di una notifica), `vera/vera-chat.ts` in una decina di punti, '
      + '`menu/cambio-piatto.ts`, `menu/sostituzione-chat.service.ts`, `vera/allergeni-ricetta.ts`, '
      + '`commerce/annulla-abbonamento.ts`.\n\n'
      + '✅ **Già chiuso, e solo lì**: i sei testi delle **attività** (22/8), tenuti fermi da '
      + '`coach-tasks/niente-markdown.spec.ts`. E la pagina **Lavori** — questa — che aveva lo stesso '
      + 'difetto su 103 voci su 155: adesso il grassetto lo disegna `TestoConGrassetto`, che costruisce '
      + 'elementi React e non HTML, perché il dettaglio di un lavoro si scrive a mano dalla pagina.\n\n'
      + '⛔ **Le due strade, e vanno decise insieme.** *(a)* Si tolgono gli asterischi dai testi, come '
      + 'per le attività: è la strada giusta per tutto quello che finisce anche in una **push** o in '
      + 'una **email**, dove un renderer non ci sarà mai. *(b)* Si usa un renderer come quello della '
      + 'pagina Lavori nelle bolle della chat dell\'app: tiene l\'enfasi dove serve davvero (una '
      + 'parola che la cliente non deve saltare, tipo «allergia»). ⚠️ Non è la stessa risposta per '
      + 'tutti i testi: dipende da quante strade fa quella stringa.\n\n'
      + '⚠️ **Serve prima un censimento**, non una stima: un `grep` di `**` dentro le stringhe del '
      + 'backend, diviso per superficie (chat app · notifiche · email · backoffice). Il censimento è '
      + 'metà del lavoro, come per le frecce delle tabelle il 21/8 — dove la premessa scritta senza '
      + 'guardare si era rivelata falsa.\n\n'
      + '✅ **CHIUSA il 25/8, col censimento fatto davvero**: **755** stringhe contengono `**`, di cui '
      + '**647 nella pagina Lavori** (che il grassetto lo disegna dal 22/8) e **108 altrove** — quasi '
      + 'tutte di Vera. Le due strade sono state applicate come dice la voce, una superficie alla '
      + 'volta.\n\n'
      + '✅ **Si DISEGNA** dove il testo resta dentro una bolla di chat: nell\'app (`ChatSheet`, '
      + '`Assistente`) e — rilievo della revisione — anche nelle **due superfici del back office da '
      + 'cui si leggono le stesse bolle**: la card «Conversazioni» della scheda cliente, che si apre '
      + 'di default proprio sul thread di Gaia, e la pagina Chat. Senza quelle due, coach e '
      + 'nutrizioniste avrebbero continuato a leggere «Hai qualche **allergia** alimentare?» con gli '
      + 'asterischi: la stessa frase della voce, dall\'altra parte del vetro.\n\n'
      + '✅ **Si TOLGONO** dove il testo viaggia dove nessuno lo disegna: il corpo della notifica '
      + '«piano senza glutine», il testo dell\'attività «fissa la visita» (che finisce anche nelle '
      + 'push), il `confirm()` dell\'annullamento abbonamento e — sempre dalla revisione — il **report '
      + 'mensile di Vera**, che non passa da nessuna bolla: esce dal pulsante «Report del mese» dentro '
      + 'un riquadro di testo grezzo, e la capo nutrizionista ci leggeva «**12** regole dettate».\n\n'
      + '⛔ **E adesso c\'è una rete**: `common/asterischi-solo-dove-si-disegnano.spec.ts` elenca i '
      + 'file autorizzati **con il motivo**, e diventa rosso appena un testo nuovo scrive markdown '
      + 'altrove. Tre correzioni della revisione l\'hanno resa vera: cercava riga per riga (un '
      + 'template su più righe — il modo più naturale di scrivere il corpo di una notifica — passava '
      + 'liscio), sbagliava di 148 righe il punto da correggere, e metteva in bianco l\'intero file '
      + 'delle campagne per una maschera `$1***$2` (adesso si permette la **forma**, non il file).',
    categoria: CODICE,
    fatta: true,
    ordine: 663,
    nata: '2026-08-22T11:30',
  },

  {
    // ⚠️ Chiave accorciata in fusione (23/8): quella originale era di 46 caratteri e il guardiano
    // `chiave-e-una-parola.spec.ts` la rifiuta. Si può ancora rinominare senza doppioni perché la
    // versione lunga NON è mai arrivata a un deploy: viveva solo nel file della sessione viaggio,
    // che la collisione delle consegne aveva tenuto fuori dal commit.
    chiave: 'viaggio-sospende-e-rientro',
    titolo: 'Modalità viaggio: sospende davvero, elenca le date, e il rientro arriva con un giorno d\'anticipo',
    dettaglio:
      'Richiesta di Simone del 23/8, dalla card «Modalità viaggio»: *dove vedo le date delle '
      + 'sospensioni?* e *se la vacanza finisce il 24, il 23 le chiedo le misure ed erogo il menu del '
      + '24*. La risposta alla prima domanda era: da nessuna parte — e la card stessa era un equivoco: '
      + 'scriveva tre campi sul profilo e NON fermava niente, mentre l\'app chiama «modalità viaggio» '
      + 'il `pause_period` creato da tutt\'altre porte.\n\n'
      + '✅ **Consegnato**: (1) la porta unica del rientro (`pause/giorno-di-rientro.ts`): in tabella '
      + 'resta l\'ultimo giorno sospeso, l\'interfaccia parla di «Riprende il» = primo giorno di '
      + 'dieta; (2) la **finestra di rientro** (`menu_visible_days_before_return`, 1): il giorno prima '
      + 'si chiede la pesata (in app, e dal giro notturno per chi l\'app non la apre) e si eroga il '
      + 'menu DEL giorno di rientro, composto con lo stato dell\'agente di QUEL giorno; il cancello '
      + 'sopravvive al giorno del rientro (`pausaAppenaFinita`) e il banner dice la data; (3) la card '
      + '**sospende davvero**: crea il periodo, allunga la scadenza dei soli giorni FUTURI, e un '
      + 'registro (`pauseRequest` con l\'etichetta della card, date mai riscritte all\'indietro) '
      + 'impedisce di regalare due volte gli stessi giorni — due giri di revisione avversariale hanno '
      + 'buttato giù le prime due stesure proprio qui; (4) l\'elenco in scheda '
      + '(`GET /admin/clients/:id/sospensioni`): periodi veri con l\'origine, richieste anche decise, '
      + 'storico della card dal registro (con le date, da oggi), periodi dichiarati in onboarding; '
      + '(5) le regole di Simone: **massimo 20 giorni** dall\'interfaccia, **tregua di 15 giorni** fra '
      + 'due vacanze (`pause_min_gap_days`) che FERMA le porte della cliente e AVVISA la coach in back '
      + 'office; (6) permesso nuovo `travel_mode` (solo admin di default: ⚠️ va acceso in Permessi a '
      + 'chi deve usare la card); (7) `npm run sblocca:sospensione` per chiudere una sospensione '
      + 'dalla shell; (8) il kit «Bentornata» non sovrascrive più giornate già erogate.\n\n'
      + '⚠️ **Restano aperte**: il Calendario in app crea sospensioni che NON allungano la scadenza '
      + '(stessa vacanza, soldi diversi a seconda della porta — da decidere); e il motore esce **muto** '
      + 'quando la dieta scelta non ha giornate al livello richiesto (caso Lorena, 23/8: «Digiuno '
      + '16:8» con la variante fasting a 4 settimane ma nessuna erogazione e nessun log — risolto '
      + 'spostandola su Mediterranea, ma il silenzio è un difetto suo).',
    categoria: CODICE,
    ordine: 664,
    nata: '2026-08-23T10:30',
    fatta: true,
  },

  {
    chiave: 'perimetro-commerciale-clienti-assegnate',
    titolo: 'La commerciale cambia il tipo di dieta SOLO alle clienti sue: oggi il perimetro non c\'è, e i cancelli da chiudere sono due',
    dettaglio:
      '⛔ **Trovato il 28/8 misurando, non leggendo il codice.** `npm run diag:permesso-tipo-dieta` in '
      + 'produzione: la casella «Cambia tipo di dieta» è **accesa sul ruolo `sales`**, e il codice a '
      + 'quel ruolo non l\'ha mai data — «⛔ ACCESO E NON PREVISTO». Qualcuno l\'ha accesa a mano, o '
      + 'viene da un default vecchio.\n\n'
      + '✅ **Decisioni di Simone, 28/8.** (1) *«Sì»*: la commerciale **può** cambiare il tipo di '
      + 'dieta — la casella resta accesa. (2) *«Solo di quelle a lei assegnate»*: e **questo oggi non '
      + 'è vero**. (3) *«È la coach la commerciale di riferimento, la coach ha un doppio ruolo»*: '
      + 'quindi il campo di assegnazione **non va inventato**, è `assignedCoachId`.\n\n'
      + '⚠️ **Prima strada, misurata e scartata.** `CrmRecord.ownerId` — il «titolare del lead» — '
      + 'esiste, si vede in tre schermate del backoffice, e **non lo scrive nessun frontend**. '
      + '`npm run diag:titolare-lead`, 28/8: **0 schede su 86325**, e **0 delle 61 schede CRM che '
      + 'hanno un account cliente collegato**. ⚠️ Quelle 61 sono schede CRM, non l\'elenco clienti del '
      + 'backoffice: sono due popolazioni e due tabelle, e vanno rilette dallo stesso metro prima di '
      + 'metterle nella stessa frase.\n\n'
      + '⛔ **«Prende il perimetro coach» NON è una riga, e l\'avevo scritto che lo era.** Due trappole, '
      + 'tutte e due nello stesso file:\n'
      + '· **`isCoachLike` darebbe la cosa sbagliata.** `coachTeamScope` risponde «solo le sue» '
      + '(`[staff.id]`) **solo se il ruolo è letteralmente `coach`**; a chiunque altro dà '
      + '`reteSottoDiMe`, cioè **la rete sotto di lei**. Aggiungere `sales` a quell\'elenco non la '
      + 'limita: le dà le clienti di tutte le persone che ha sotto. È l\'errore **per eccesso**, '
      + 'quello che `perimetro-clienti.ts` dice in testa di non voler mai fare.\n'
      + '· **I cancelli sono due.** `perimetroClienti` decide quali schede si aprono; '
      + '`RUOLI_CHE_VEDONO_TUTTE` — che nomina `sales` — decide **alert**, **analytics** e la '
      + '**dashboard** (⚠️ i riassunti delle chat no: quel controller non ammette `sales`). '
      + 'Chiuderne uno solo lascia la commerciale a vedere gli alert e i numeri di tutte. ⚠️ E i due '
      + 'cancelli non sono sorvegliati allo stesso modo: togliere `sales` da `RUOLI_CHE_VEDONO_TUTTE` '
      + 'fa diventare **rosso** `perimetro-una-porta-sola.spec.ts` in due punti, mentre cambiare '
      + '`perimetroClienti` lo lascia **verde** — quel test riscrive la regola a mano invece di '
      + 'chiamarla. Il cancello più facile da sbagliare è quello che nessuno guarda.\n\n'
      + '⛔ **E la casella «Clienti» non è la porta che sembra.** Nei default `sales` non ha la pagina '
      + '`clients`, e verrebbe da concludere «allora la scheda non la apre». Falso: in tutto il '
      + 'backend **non esiste nessun `@RequirePage(\'clients\')`**. `admin/clients` è protetto dal solo '
      + 'elenco dei ruoli, e `sales` è dentro quell\'elenco. Quindi quella casella governa la **voce '
      + 'di menu**, non l\'API: **tutta** la scheda clinica — lettura, modifica, storico, menu — è già '
      + 'raggiungibile da un account commerciale con la casella spenta. ⚠️ Non «cambia la fretta»: la '
      + 'aumenta.\n\n'
      + '⚠️ **Aspetta un numero**: `npm run diag:commerciale-e-coach` dice quante clienti vedrebbe '
      + 'dopo, quante restano senza nessuna coach, e se i due account (coach e commerciale) sono la '
      + 'stessa persona per il codice (`linkedUserId`) o solo per noi. Se quel numero è zero, il '
      + 'cancello non si chiude: si assegna prima.\n\n'
      + '✅ **FATTO IL 3/9 quello che non aspettava nessuna decisione: il cancello che nessuno '
      + 'guardava adesso è guardato.** Questa voce diceva che i due cancelli non sono sorvegliati '
      + 'allo stesso modo — togliere `sales` da `RUOLI_CHE_VEDONO_TUTTE` fa diventare rossa la '
      + 'sentinella, cambiare `perimetroClienti` la lasciava **verde**. Il motivo: dentro '
      + '`perimetro-una-porta-sola.spec.ts` la regola del perimetro era **riscritta a mano** '
      + '(`ruolo !== \'coach\' && ruolo !== \'coach_coordinator\' && ruolo !== \'nutritionist\'`), '
      + 'quindi la prova confrontava la funzione vera con una **copia della sua regola vecchia**. '
      + '⚠️ Una copia di una regola di perimetro dentro la prova che la sorveglia è esattamente la '
      + 'cosa che quel file esiste per vietare, un piano più sotto.\n\n'
      + '✅ Adesso la prova **chiama `perimetroClienti`** ruolo per ruolo con un finto Prisma di tre '
      + 'righe, e ne fissa anche il campo (`assignedCoachId` / `assignedNutritionistId`). '
      + '⛔ **Dimostrato eseguendo, non sostenendo**: la stessa mutazione (aggiungere `sales` a '
      + '`isCoachLike`, cioè dare alla commerciale il perimetro della sua rete — l\'errore **per '
      + 'eccesso** contro cui questa voce mette in guardia) resta **verde** sulla prova com\'era a '
      + 'HEAD e diventa **rossa** su quella nuova. Quattro mutazioni prese, più quella dimostrazione.\n\n'
      + '⚠️ **E una cosa che si è vista solo chiamandola**: `perimetroClienti` risponde «nessun '
      + 'limite» anche al ruolo `client`. Oggi non è un buco — nessuna rotta che usa il perimetro '
      + 'ammette quel ruolo, lo decidono i `@Roles` — ma è un ripiego **per eccesso** dentro il file '
      + 'che dichiara di volerne fare uno per difetto, ed è scritto come prova invece che come '
      + 'commento.\n\n'
      + '⛔ **Il resto della voce resta aperto e non si muove senza Simone**: quali clienti vede la '
      + 'commerciale, i due cancelli da chiudere insieme, e il numero di `diag:commerciale-e-coach`.'
      + '\n\n▶️ **MISURATO IL 4/9, e il numero che questa voce aspettava è ZERO — il che cambia la risposta.** `diag:commerciale-e-coach`: Giusy Vita (`sales`) ha **0 clienti sue**, **56 con la rete sotto**, su 60 schede.\n'
      + '⛔ Chiudere il cancello oggi vorrebbe dire lasciarla con **zero clienti**, cioè spegnerle il lavoro. E la strada ovvia — metterla fra i ruoli «coach-like» — gliene darebbe **56 su 60**: un cancello che invece di stringere allarga.\n'
      + '✅ **DECISIONE DI SIMONE, 4/9: «tutte le clienti non assegnate ad una coach vanno a Giusy», e vale anche per quelle che verranno**, con un parametro che dice chi è la **coach di riserva** — così il giorno che non è più lei si cambia una casella, non il codice.\n'
      + '▶️ **L\'ordine è: prima le assegnazioni, poi i cancelli.** Oggi le schede **senza nessuna coach sono 4**, e le assegna Simone dal backoffice; i due cancelli (perimetro clienti + alert/analytics/dashboard) si chiudono quando quel numero non è più zero.\n'
      + '⚠️ **Due cose di contorno, misurate**: **2 clienti non hanno nessuna scheda profilo** e non entrano in nessun perimetro, in nessun verso. E **«Dr.ssa Bini» risulta `nutritionist` SOSPESA con 1 cliente**: è la domanda che sta in coda dal 21/8, e adesso ha una risposta.'
      + '\n\n✅ **FATTA (4/9, sera) LA REGOLA «COACH DI RISERVA»** — `common/coach-di-riserva.ts`, gemella della nutrizionista di riferimento. Parametro `coach_di_riserva` (Parametri → «Presa in carico» → tendina di persone, nasce **spento**); chi resta senza coach ci finisce **al questionario**, **quando si toglie la coach a mano** e **ogni notte** (passo `coachDiRiserva` del cron, prima dei compiti coach) — così le porte che non si vedono (importazioni, lead senza coach, le 2 senza scheda) si chiudono insieme. Prima passata a mano: `npm run assegna:coach-di-riserva` (lista) e `CONFERMA=1` (scrive). ⛔ **Scoperto facendolo: dal backoffice le 4 NON si potevano assegnare a Giusy** — `assertStaffRole` rifiuta chi non è `coach` e la tendina carica solo `role=coach`. Ora la riserva è assegnabile a mano, **solo lei**, non tutte le commerciali.\n'
      + '⛔ **Tre cose che la revisione avversariale ha fermato prima che uscissero**: (1) il ponte lead→profilo del 6/8 «riempie solo il vuoto», e con la riserva nel vuoto **la coach che accettava il lead non entrava più** — ora il ponte sostituisce la riserva, e solo lei; (2) la riga di registro dell\'onboarding era scritta prima dell\'upsert, cioè prima di un `throw` possibile — ora si scrive solo se l\'assegnazione c\'è; (3) **i soldi**: `settleChain` sarebbe partito da Giusy (`sales`, in cima alla scala) e le avrebbe pagato **subito e per intero** la quota coach che oggi si accantona. **Deciso per difetto: per i compensi la riserva vale «nessuna coach»**, tutto resta come oggi (accantonato, pagato a chi verrà). ⚠️ Se Giusy deve incassare la quota coach delle clienti di riserva, è una decisione di Simone: si toglie `senzaLaRiserva` in `finance.service.ts`.\n'
      + '▶️ **Cosa resta, nell\'ordine**: Simone imposta la riserva nei Parametri → lancia la prima passata → `diag:commerciale-e-coach` dice che Giusy non ha più zero → si chiudono i due cancelli (`perimetroClienti` + `RUOLI_CHE_VEDONO_TUTTE`), che questa consegna **non tocca**.'
      + '\n\n✅ **CHIUSA IL 4/9 (sera) CON UNA DECISIONE DI SIMONE, non con un cancello: «Lascia tutto com\'è».** Prima di scrivere una riga ho misurato cosa cambiava chiudendo i due cancelli sul suo id: Giusy avrebbe visto **solo** le clienti di riserva — in Clienti, Acquisti, Attività coach, Vera, dashboard, alert e analytics **perdeva le altre 56** (il CRM dei lead no: usa `coachScope`, non `perimetroClienti`). E il secondo cancello (`vedeTutteLeClienti`) senza `sales` non le dava «le sue»: le dava **niente** (`__none__`), perché dashboard, analytics e alert ridisegnano il perimetro da sé con `isCoachLike` invece di chiamare `perimetroClienti` — la copia che quel file dice in testa di non volere. Messe davanti le tre strade (solo le sue ovunque / tutte ma cambia la dieta solo alle sue / tutto com\'è), Simone ha scelto la terza. ⚠️ Quindi: la commerciale **vede e cambia tutto**, come oggi; la casella «Cambia tipo di dieta» resta accesa su `sales`; nessun perimetro. La coach di riserva resta com\'è (chi è senza coach va a Giusy) — era una regola di presa in carico, non di perimetro. ⛔ **Quello che resta vero e non chiuso**, e sta scritto in `perimetro-clienti.ts`: i tre servizi che ridisegnano il perimetro da sé sono ancora tre copie di una domanda di perimetro; il giorno che si dà un perimetro a un ruolo nuovo, prima si portano su `perimetroClienti`.',
    fatta: true,
    categoria: CODICE,
    ordine: 665,
    nata: '2026-08-28T09:00',
  },

  {
    chiave: 'scheda-stile-cablata-nell-app',
    titolo: 'La scheda lunga del «?» sta nel codice dell\'app: una dieta con uno stile nuovo la fa sparire, in silenzio',
    dettaglio:
      '⚠️ **La metà che la tabella «Descrizioni diete» non raggiunge**, scritta qui perché chiudendo '
      + 'quella voce non sparisse con lei. `app/src/onboarding/dietInfo.ts` — «In pratica», «Cosa dice '
      + 'la ricerca», «Da tenere presente», le fonti — è **cablata nel codice dell\'app**, per '
      + '**stile** e non per dieta. Cambiarla richiede un rilascio, e due diete dello stesso stile '
      + 'condividono la stessa scheda.\n\n'
      + '⛔ **Il difetto non è che si cambia con un rilascio: è che si rompe da sola**, e in due modi '
      + 'diversi che vanno tenuti distinti.\n'
      + '· In **registrazione** il pallino «?» accanto al nome **non compare proprio** quando lo stile '
      + 'non è in quel file (`Onboarding.tsx`: `{DIET_INFO[p.style] && …}`). ⚠️ E lì il «?» apre '
      + '**solo** la scheda dello stile: il testo scritto dal backoffice sta in un\'altra fisarmonica '
      + '(«Caratteristiche principali»), e quella fisarmonica resta. ⚠️ Quindi non sparisce **ogni** '
      + 'spiegazione: sparisce quella che porta «cosa dice la ricerca», «da tenere presente» e le '
      + '**fonti** — la parte che dice alla cliente perché dovrebbe fidarsi. È già successo il 6/8 con '
      + 'DASH, Flessibile, Detox e i due percorsi estivi.\n'
      + '· Nel **profilo** il «?» resta se la descrizione è compilata '
      + '(`haInfoDieta = dietDescription || scheda`), ma quello che legge è **metà** di quello che '
      + 'leggono le altre: senza «cosa dice la ricerca» e **senza le fonti**, che sono la parte che '
      + 'rende credibile il popup.\n\n'
      + '✅ **LA PROVA C\'È — strada (a), 3/9.** `engine-rules/scheda-stile-nell-app.spec.ts` legge '
      + '`app/src/onboarding/dietInfo.ts` con `readFileSync` (come fa già '
      + '`signals/unita-acqua.spec.ts` con `app/src/lib/water.ts`) e confronta le schede con gli '
      + 'stili di `SUGGESTED_PRESETS` e `KETO_MEDITERRANEA`. **Quattordici prove.**\n\n'
      + '⛔ **La prima stesura contava solo le CHIAVI, e non bastava.** Una revisione avversariale '
      + 'l\'ha misurata su dieci schede **vuote** (`{ titolo: \'\', cose: \'\', inPratica: \'\' … }`): '
      + 'passavano tutte verdi. Si poteva svuotare «cosa dice la ricerca» — la parte per cui questa '
      + 'voce esiste — senza che nessuno se ne accorgesse. Adesso il lettore apre ogni scheda e '
      + 'guarda i **campi**, con una lunghezza minima **per campo**: «Mediterranea» è un titolo '
      + 'giusto e lungo dodici caratteri, `cosaDiceLaRicerca` in dodici caratteri è un campo non '
      + 'scritto, e una soglia unica avrebbe dovuto scendere al livello del titolo — cioè non '
      + 'vedere più niente.\n\n'
      + '⚠️ Corretti nella stessa passata due difetti del lettore: la chiave era `[a-z_]+`, quindi '
      + 'uno stile `keto2` o `\'summer-holiday\'` avrebbe fatto dire «manca» a una scheda '
      + 'presente; e `indexOf(\'export const DIET_INFO\')` è un match per **prefisso**, che '
      + 'prenderebbe `DIET_INFO_FONTI` se qualcuno la spostasse sopra.\n\n'
      + '⛔ **Dieci mutazioni su dieci uccise** sulle due consegne di giornata; su questa: «uno '
      + 'stile perde del tutto la scheda», «una scheda perde cosa dice la ricerca», «le fonti '
      + 'generali diventano una lista vuota», e ⚠️ **«il lettore prende zero chiavi»** — la '
      + 'mutazione che conta, perché un test che legge un file altrui e trova il vuoto passerebbe '
      + 'verde su nulla.\n\n'
      + '⚠️ **Quello che la prova NON prende, e resta il motivo per cui questa voce è ancora '
      + 'aperta.** (1) Uno stile scritto **a mano** in banca dati: gli stili che la cliente vede '
      + 'arrivano da `GET /onboarding/diet-products`, cioè dal **database**; i preset sono solo il '
      + 'seme, e nessun elenco statico conosce il resto. (2) `STYLE_LABELS` in `Onboarding.tsx` è '
      + 'una **terza** lista, e contiene già `vegan`, `vegetarian`, `balanced`: etichetta sì, '
      + 'scheda no. Sta nel file come **sentinella `it.failing`** — verde finché il difetto c\'è, '
      + 'rossa quando qualcuno aggiunge le tre schede.\n\n'
      + 'Le strade che restano: **(b)** una diagnostica che legge gli stili **pubblicati e '
      + 'visibili** dal database e li confronta col file, che prende il caso (1); **(c)** la scheda '
      + 'passa a database e si scrive dal backoffice come la descrizione — costa una tabella e una '
      + 'schermata, ma toglie il rilascio e **chiude** la distanza invece di sorvegliarla. ⛔ Da '
      + 'scartare invece un ripiego generico per lo stile sconosciuto: «alimentazione equilibrata» sotto una dieta chetogenica è peggio del vuoto, perché sembra una risposta.',
    categoria: CODICE,
    ordine: 666,
    nata: '2026-08-28T09:05',
  },

  {
    chiave: 'descrizioni-diete-cosa-resta',
    fatta: true,
    titolo: 'Descrizioni diete: il permesso è quello di un\'altra pagina, il registro è best-effort, e una domanda è di Simone',
    dettaglio:
      'La tabella è consegnata (22/8) e verificata (28/8). Qui sta quello che **non** copre, perché '
      + 'una voce chiusa esce dall\'elenco e con lei uscirebbero queste tre righe.\n\n'
      + '**1. ⚠️ La domanda che è di Simone, non del codice.** *I testi che la cliente legge li '
      + 'corregge la nutrizionista da sola, o passano dall\'approvazione del capo come le diete a '
      + 'catalogo?* Oggi: **da sola**. Sulla rotta che la pagina usa '
      + '(`PATCH /diets/famiglia/product`) la scrittura è una lista di tre campi — `clientName`, '
      + '`clientDescription`, `seasonalTag` — e **nessuno**, capo compreso, tocca da lì la '
      + 'visibilità. ⛔ Non è una risposta: è il comportamento di oggi, e nessuno l\'ha scelto.\n\n'
      + '**2. ✅ IL REGISTRO: diciotto andate al database sono diventate UNA** (3/9). Erano un '
      + '`await` in ciclo **dopo** la transazione: diciotto finestre in cui il processo può morire '
      + 'lasciando il registro a metà, invece di una. Adesso `logMany` fa una `createMany` sola, e '
      + 'il suo ripiego riga-per-riga scatta solo se quella fallisce — questa voce diceva *«è il '
      + 'verso in cui guardare»*, ed era giusto. ⚠️ Le righe restano **diciotto**, una per variante: '
      + 'è quello che conta per chi filtra il log sulla dieta #7.\n'
      + '⛔ **Resta best-effort, e va detto invece che promesso**: `logMany` assorbe i propri errori '
      + 'come `log`, perché una riga di registro che non passa non deve far fallire un salvataggio '
      + 'clinico. Quello che cambia è la **finestra**, non la garanzia.\n\n'
      + '**3. ✅ LA PAGINA HA LA SUA CHIAVE: `diet_descriptions`** (3/9). Girava su `diets_catalog`, '
      + 'cioè il permesso di **un\'altra pagina**: non si poteva dare a una nutrizionista i testi '
      + 'senza darle il catalogo, né toglierle il catalogo lasciandole i testi.\n'
      + '⛔ **E NON passa da `PAGE_GRANTS`**, che era la scorciatoia contro cui questa voce metteva '
      + 'in guardia: il guardiano prova la chiave concessa **allo stesso livello** della rotta, '
      + 'quindi una riga `diet_descriptions: [diets_catalog]` in *gestione* farebbe passare anche '
      + '`POST /diets`, `PATCH /diets/:id` e `DELETE /diets/:id` — ricreando **al contrario** '
      + 'l\'accoppiamento. Il legame giusto è `INHERIT_DEFAULTS`, che vale **alla nascita** della '
      + 'riga e non è permanente: nessuno perde la pagina, e da lì in poi la figlia vive per conto '
      + 'suo.\n'
      + '⚠️ **E la lettura ha una rotta sua** (`GET /diets/descrizioni`), che rende **solo i campi '
      + 'che la pagina mostra**: finché leggeva da `GET /diets` restava legata al catalogo, e la '
      + 'separazione sarebbe stata a metà — la pagina non si sarebbe aperta lo stesso. Questa voce '
      + 'lo diceva già: *«sarebbe comunque meglio, oggi la pagina si scarica tutto il catalogo per '
      + 'raggrupparlo nel browser»*. ⛔ Non è un\'ottimizzazione: **una rotta che rende tutto dà '
      + 'tutto**, e allora tanto valeva lasciare la chiave del catalogo.\n'
      + '⚠️ La separazione dipende da un dettaglio del guardiano — `getAllAndOverride([handler, '
      + 'class])`, cioè **la chiave del metodo batte quella della classe** — e c\'è una prova sui '
      + 'decoratori che tiene ferma proprio quella. ⛔ E la rotta nuova sta **prima di `@Get(:id)`**: '
      + 'l\'avevo scritta in fondo, dove `:id` l\'avrebbe intercettata leggendo «descrizioni» come '
      + 'un id — la stessa lezione già scritta venti righe sopra per `famiglia/product`, rifatta lo '
      + 'stesso. Adesso c\'è una prova, e ⚠️ la sua prima stesura cercava il decoratore con '
      + '`indexOf` e trovava la **menzione dentro il commento** che spiega la regola: un test che '
      + 'legge un sorgente deve distinguere il codice dalla prosa che lo racconta.\n\n'
      + '⚠️ **E le tre pagine sorelle non sono un modello uniforme**, guardarle senza distinguere '
      + 'porta a copiare la cosa sbagliata: nessuna delle tre è letta da un `@RequirePage`, ma '
      + '`diet_workspace` e `creation_validation` un effetto lato server ce l\'hanno lo stesso — sono '
      + 'i **grantor** di `PAGE_GRANTS`, e chi le ha entra nelle API di `diets_catalog` e `recipes`. '
      + '⛔ `equivalence_groups` invece è di sola interfaccia, cioè lo stesso difetto di `assignments`. '
      + 'Chi accende `diet_workspace` credendo di muovere un menu apre catalogo e ricette.\n'
      + '✅ **LA TRAPPOLA È CHIUSA (2/9), e andava chiusa prima di separare qualunque chiave.** '
      + '`INHERIT_DEFAULTS` prometteva che *«separare una schermata nei Permessi non toglie accesso '
      + 'a nessuno»*, e la promessa **non era mantenuta**: l\'ereditarietà girava una volta sola, '
      + 'all\'avvio, sui **default del codice**, e `syncDefaults` creava le righe mancanti da lì. '
      + 'Una chiave figlia nuova nasceva col **default** del genitore, mai con la sua **riga** — '
      + 'cioè con quello che l\'admin aveva davvero deciso.\n'
      + '⛔ **I due versi, e il secondo è quello che fa male.** A chi Simone aveva acceso '
      + '`diets_catalog` **a mano** la figlia nasceva spenta, e la pagina spariva: si vede subito, '
      + 'qualcuno scrive «non trovo più la voce». A chi l\'aveva **spento** a mano la figlia nasceva '
      + '**accesa**, e la pagina **tornava a chi era stata tolta**: questo non lo segnala nessuno, '
      + 'perché un accesso in più non fa reclamare nessuno.\n'
      + '⛔ **E LA PRIMA CORREZIONE NE COPRIVA UNO SU TRE.** Sistemava `syncDefaults` — chi **crea** '
      + 'la riga — e lasciava scoperti i due punti che risolvono la riga **mancante a tempo di '
      + 'richiesta**: `page.guard.ts` e `permesso-di-ruolo.ts`. Cioè il difetto restava vivo **lato '
      + 'server**, dove non è una voce di menu ma una porta. ⚠️ E non è una finestra teorica: '
      + '`onModuleInit` **assorbe** l\'errore di `syncDefaults` con un `warn`, quindi un singhiozzo '
      + 'del database all\'avvio lascia un\'istanza viva **per sempre** con le righe mancanti. '
      + 'L\'ha trovata la revisione avversariale provandola sul guardiano vero.\n'
      + '✅ Adesso la regola è **una sola** (`catenaDeiGenitori`, in `permissions/'
      + 'eredita-dal-genitore.ts`) e la chiamano tutti e tre: la riga mancante vale quanto la **riga '
      + 'vera** del genitore, e si ripiega sul default solo quando quella riga non c\'è — il primo '
      + 'avvio, un ruolo appena creato. ⚠️ Vale anche per i ruoli personalizzati, che ereditano '
      + 'dalla riga del genitore **di quel ruolo** e non da quella del ruolo di base.\n'
      + '⛔ **E le pagine «hub» NON ereditano.** `diet_workspace` e `creation_validation` sono figlie '
      + 'di `diets_catalog` **e** grantor di `diets_catalog` **+ `recipes`**: ereditare la riga del '
      + 'genitore darebbe loro di aprire una porta che il genitore non apre — cioè «non toglie **e '
      + 'non dà** accesso a nessuno» sarebbe falso proprio sulle due chiavi che lato server contano. '
      + 'Il loro default adesso è **scritto** in `DEFAULT_PERMISSIONS` invece che dedotto dal ciclo, '
      + 'così «non eredita» vale anche di lì: nessun ruolo cambia permesso.\n'
      + '⛔ **Il default scritto apposta per la FIGLIA batte l\'eredità** (`DEFAULT_ESPLICITI`): è la '
      + 'precedenza che il ciclo di `pages.ts` ha sempre avuto, e la prima stesura la rovesciava '
      + 'senza dirlo. Oggi non si vedrebbe — nessuna figlia ha un default suo — ma l\'unico motivo '
      + 'per scriverne uno è renderlo **più stretto** del genitore.\n'
      + '⛔ **E chi eredita lascia una riga in `AuditLog`** (`admin.permissions.inherited`), non solo '
      + 'nei log di Render: un permesso che compare senza che nessuno l\'abbia acceso dev\'essere '
      + 'rintracciabile mesi dopo. ⚠️ Una riga sola con l\'elenco dentro, e solo se qualcosa è stato '
      + 'scritto davvero — l\'istanza che perde la corsa con `skipDuplicates` non deve lasciare una '
      + 'traccia di permessi che non ha creato. Per la stessa ragione `syncDefaults` ora torna '
      + '`esito.count` e non più le righe *proposte*.\n'
      + '⚠️ **E la prova sul ciclo non fa più bloccare la CI.** Con la sola guardia sui già-visti, '
      + 'toglierla non faceva **fallire** la suite: la **bloccava** — giro sincrono, event loop '
      + 'occupato, timeout di Jest che non scatta mai. Adesso c\'è anche un tetto ai salti: una prova '
      + 'che segnala un difetto fermando la CI invece di diventare rossa è peggio di nessuna prova.\n'
      + '⚠️ **Non ripara il passato, previene il futuro**: le righe già scritte non si toccano. Una '
      + 'riga sbagliata dal difetto vecchio è indistinguibile da una scelta dell\'admin, e '
      + 'riscriverla sarebbe decidere al posto suo. ⛔ **Chi vuole sapere se è successo davvero deve '
      + 'guardare la matrice**: le figlie di oggi sono `crm_lead_new`, `crm_import`, `crm_pipeline`, '
      + '`crm_calendar`, `testimonials`, `publisher`, `equivalence_groups`, `allergens`, '
      + '`colazioni`, `roles`, `creation_validation`, `diet_workspace` — su ognuna, un ruolo che ha '
      + 'la figlia diversa dal genitore o l\'ha decisa apposta, o l\'ha ricevuta da questo difetto.\n'
      + '⚠️ **E l\'ereditarietà resta alla NASCITA, non un legame**: dopo, la figlia vive per conto '
      + 'suo. Un legame permanente renderebbe inutile separare la schermata, che è il motivo per cui '
      + '`INHERIT_DEFAULTS` esiste.\n\n'
      + '⚠️ **Per la lettura `PAGE_GRANTS` basterebbe — ma solo a sola vista**, e questo va guardato '
      + 'prima di scriverlo: il guardiano prova la chiave hub **allo stesso livello** della rotta. '
      + 'Una riga `diet_descriptions: [\'diets_catalog\']` fa passare `GET /diets` (livello *vista*), '
      + 'ma se la chiave nuova viene concessa in *gestione* fa passare anche `POST /diets`, '
      + '`PATCH /diets/:id` e `DELETE /diets/:id`. ⛔ Cioè ricrea **al contrario** l\'accoppiamento che '
      + 'questa voce denuncia: dare i testi finirebbe per dare il catalogo. Quindi o la chiave nuova '
      + 'resta a sola vista e la scrittura (`PATCH famiglia/product`, che è *gestione*) trova un\'altra '
      + 'strada, oppure serve davvero una rotta di lettura sua — che sarebbe comunque meglio: oggi la '
      + 'pagina si scarica **tutto** il catalogo per raggrupparlo nel browser.'
      + '\n\n✅ **CHIUSA — Simone, 5/9, sulla domanda 1: «Da sola, va bene così».** I testi che la cliente legge li corregge la nutrizionista senza passare dal capo: da oggi è una decisione, non il comportamento di default. I punti 2 e 3 erano già fatti il 3/9.',
    categoria: CODICE,
    ordine: 667,
    nata: '2026-08-28T09:10',
  },

  {
    chiave: 'generatore-non-vede-il-paniere-unito',
    titolo: 'Il generatore conta gli spuntini e le merende separati: genererà piatti che nel paniere ci sono già — CHIUSA l\'1/9',
    dettaglio:
      '⚠️ **Coda della Fase 2 (1/9).** Da oggi spuntino e merenda pescano dallo stesso paniere: chi '
      + '**sceglie** passa da `slotDaCuiPescare`, e l\'agente dei pasti leggeri conta una cella sola '
      + 'per paniere (`slotCapofila`). ⛔ **Il generatore di `engine-rules.service.ts` no**: quando '
      + 'chiede «cosa c\'è già per questa variante» (`mealSlot: { in: slots }`, riga ~1050) tiene i due '
      + 'pasti divisi, quindi generando spuntini non vede le merende — e ne scrive di uguali, pagando '
      + 'ogni ricetta.\n'
      + '⚠️ Non è un difetto nuovo e non fa male a nessuna cliente: le bozze nascono spente. Costa '
      + 'chiamate all\'AI e tempo di approvazione alla nutrizionista, che è quello che oggi è scarso.\n'
      + '⚠️ È dichiarata come eccezione in `catalog/una-porta-per-gli-slot.spec.ts` e sta nella **Fase '
      + '7** del piano panieri, perché spostare da cosa dipende il generatore va fatto col tabulato '
      + 'della copertura davanti — `npm run diag:spuntini` dà il primo dei due numeri.\n'
      + '✅ **Chiusa l\'1/9, e prima del previsto.** Non è servita la Fase 7 intera: bastava allargare '
      + 'il CONTEGGIO ai due slot gemelli, in `ricetteOrfane` e nelle tre fonti di «cosa c\'è già». '
      + 'La ricetta nuova continua a nascere con lo slot chiesto — il paniere unito dice quante ne '
      + 'servono, non come si chiamano. ⚠️ Misurato su una variante da 5 pasti: le riusate passano da '
      + '25 a 29 e le generate da 10 a **6**. Quattro chiamate all\'AI risparmiate su una variante '
      + 'sola, e il generatore gira su tutte.',
    categoria: CODICE,
    ordine: 668,
    fatta: true,
    nata: '2026-09-01T09:00',
  },

  {
    chiave: 'menu-composti-con-un-pasto-in-piu',
    fatta: true,
    titolo: 'Guardare i menu composti fra lo spostamento su «paniere» e la correzione: qualcuno può aver ricevuto un pasto in più',
    dettaglio:
      '⛔ **Difetto mio, nato con la Fase 1 e corretto l\'1/9.** Con `panieri_sorgente_pool` su '
      + '`paniere`, la composizione bilanciata prendeva il **numero di pasti** della giornata dalle '
      + 'chiavi del pool — cioè dal paniere, che è famiglia × regime e raccoglie anche varianti con '
      + 'una struttura diversa. Una cliente a 3 pasti il cui paniere ne contiene di 5 poteva vedersi '
      + 'comporre 5 pasti: **kcal in più di quelle che le spettano**, senza che niente lo dicesse.\n'
      + '⚠️ Raggiungibile solo dove DayCombo è acceso o il menu a necessità guida il target; dove la '
      + 'giornata la faceva il selettore sul template la struttura è sempre stata quella giusta.\n'
      + '⚠️ **Il codice è corretto** (`menu/struttura-della-giornata.ts`): la struttura la dettano le '
      + 'giornate della sua dieta. Quello che resta è **umano**: `npm run diag:struttura` dice quali '
      + 'varianti erano esposte e quante clienti ci stanno dietro; per quelle vale la pena aprire i '
      + '`menu_day` della finestra fra lo spostamento dell\'interruttore e il rilascio e contare i '
      + 'pasti. Non si corregge da sé: un menu già erogato non si riscrive.'
      + '\n\n▶️ **MISURATO IL 4/9** con `diag:struttura`: **160** varianti hanno un paniere con slot che le loro giornate non hanno, tutte esposte. Di queste **13** hanno servito clienti negli ultimi 30 giorni, per **21 clienti**. L\'interruttore è stato spostato il 1° settembre alle 05:21.\n'
      + '⚠️ Da lì in avanti la struttura la detta la dieta: la correzione c\'è. Quello che **non** è stato guardato è il passato — i `menu_day` composti fra lo spostamento e il rilascio. Sono poche, e la scelta di non guardarlo è dichiarata, non dimenticata.'
      + '\n\n✅ **CHIUSA — Simone, 5/9: «Non si guarda, chiudi».** Un menu già erogato non si riscrive, la correzione c\'è dal 1°/9, e i menu delle 21 clienti nella finestra non si guardano: è una scelta scritta, non una dimenticanza.',
    categoria: CODICE,
    ordine: 669,
    nata: '2026-09-01T10:00',
  },

  {
    chiave: 'tolleranza-kcal-a-25-va-misurata-prima',
    fatta: true,
    titolo: 'Alzare la tolleranza kcal dal 15% al 25% tocca TUTTE le clienti insieme: prima il numero',
    dettaglio:
      '⚠️ **Coda della Fase 4** (1/9). Il piano dei panieri chiede la tolleranza kcal a ±25% '
      + '(`menu_kcal_balance_tolerance_pct`, che ammette fino a 30) perché con un paniere grande le '
      + 'combinazioni buone si trovano lo stesso e la varietà cresce.\n'
      + '⛔ **Ma quel parametro è globale e non riguarda solo i panieri nuovi**: alzarlo sposta la '
      + 'banda di ogni cliente attiva nello stesso momento, comprese quelle che oggi ricevono '
      + 'giornate ben dentro il ±15%. Va misurato prima con `npm run diag:kcal`.\n'
      + '⚠️ E i tetti di porzione restano il limite vero: ×1,8 sui principali, ×1,6 sulla colazione, '
      + '×1,25 sugli spuntini. Una banda più larga non li supera, li rende solo più spesso attivi.\n'
      + '⚠️ Dall\'1/9 esiste anche l\'altra strada, che tocca solo chi ne ha bisogno: la banda si '
      + 'allarga **da sé** quando serve, fino al tetto, e la giornata scrive di quanto '
      + '(`npm run diag:allargamenti`). Prima di alzare il parametro globale vale la pena leggere '
      + 'quel tabulato: se gli allargamenti sono pochi e concentrati su poche diete, il problema '
      + 'non è la banda di tutte — sono i panieri di quelle.'
      + '\n\n✅ **CHIUSA il 4/9: la banda NON si alza, e lo dice il numero.** `diag:kcal` su **100 giornate erogate** in 14 giorni trova **una sola** cliente sotto fabbisogno (quota peggiore 87%), e il tetto ×1,8 la copre già: «1 coperta, 0 ancora corte».\n'
      + '⛔ Alzare `menu_kcal_balance_tolerance_pct` dal 15 al 25 sposterebbe la banda di **tutte** le clienti attive per un caso che il motore risolve da sé. Si resta a 15.\n'
      + '⚠️ Resta non lanciata la controprova con `diag:allargamenti`: se un giorno gli allargamenti risultassero tanti e concentrati, il problema non sarebbe comunque la banda di tutte — sarebbero i panieri di quelle.',
    categoria: CODICE,
    ordine: 670,
    nata: '2026-09-01T11:00',
  },

  {
    chiave: 'pool-serve-ricette-spente',
    titolo: 'Il pool del motore non filtra `active`: ricette archiviate e bozze mai validate finiscono nei menu',
    dettaglio:
      '\u26d4 **\u00a72.4 del piano panieri, aperto dall\'1/9.** `buildScoringContext` chiede le ricette del '
      + 'pool **per id e basta** \u2014 `where: { id: { in: [...poolIds] } }`, senza `active: true`. Una '
      + 'ricetta archiviata a mano, o una bozza che l\'agente notturno ha scritto e che nessuno ha '
      + 'ancora guardato, se sta nel pool arriva nel piatto di una cliente.\n'
      + '\u26a0\ufe0f **La porta di scrittura \u00e8 gi\u00e0 chiusa** (1/9): dalla pagina Panieri una ricetta spenta '
      + 'non si aggiunge pi\u00f9. Resta aperta la lettura, cio\u00e8 quello che \u00e8 gi\u00e0 dentro.\n'
      + '\u26d4 **E la riga che chiude non si scrive prima di aver contato**: filtrare `active: true` nel '
      + 'pool restringe il pool di **tutte le clienti insieme** \u2014 la cella che ha 40 piatti e ne ha 12 '
      + 'attivi domani ne ha 12, e da l\u00ec il motore ripete. \u00c8 la lezione della Fase 1, e c\'\u00e8 il tabulato '
      + 'apposta: `npm run diag:spente` dice quante spente sono nei panieri, **quali caselle '
      + 'scenderebbero sotto soglia** filtrandole, e quanti pasti gi\u00e0 composti ne contengono una.\n'
      + '\u26a0\ufe0f Il verdetto del tabulato \u00e8 la condizione: finch\u00e9 dice \u26d4, prima si riempiono le caselle '
      + 'povere (o si validano le bozze che ci stanno dentro), e solo quando dice \u2705 si tocca il pool.\n'
      + '\u2705 **CHIUSA lo stesso giorno**: il tabulato in produzione ha detto \u2705 \u2014 3566 spente in '
      + 'catalogo, 2730 gi\u00e0 dentro un paniere, **27 celle su 38** toccate dal filtro e **nessuna** sotto '
      + 'soglia; zero pasti gi\u00e0 composti puntavano a una spenta. Quindi le spente escono dal pool '
      + '(`menu/togli-dal-pool.ts`). \u26a0\ufe0f Uno slot fatto **solo** di spente non si svuota, come per i '
      + 'divieti e le esclusioni: una giornata con un buco sarebbe un danno nuovo introdotto da una '
      + 'correzione. Si sente nel log.\n'
      + '\u26d4 **E la chiusura ha trovato dell\'altro: 54 test passavano senza provare niente.** I finti '
      + 'Prisma non rendevano `active`, quindi ogni ricetta risultava spenta, ogni slot si svuotava, la '
      + 'regola lo risparmiava e il pool tornava identico a prima. Ottava volta che un doppio che '
      + 'risponde diversamente dal database vero copre proprio il codice che dovrebbe provare: ora '
      + '`active` mancante **grida** invece di valere «spenta», e i finti passano da '
      + '`menu/come-dal-database.ts`.',
    categoria: CODICE,
    blocca: true,
    fatta: true,
    ordine: 671,
    nata: '2026-09-01T14:00',
  },

  {
    chiave: 'riconoscitore-carne-rilanciare-derivazione',
    fatta: true,
    titolo: 'Il riconoscitore della carne sbagliava: rilanciare `panieri:pesce`, e ricontare le giornate con carne',
    dettaglio:
      '\u26d4 **Difetto mio, trovato e corretto l\'1/9.** `eCarne` confrontava per **sottostringa** un '
      + 'elenco che dichiarava «i tagli e gli animali, non i piatti» e poi conteneva `cotoletta`, '
      + '`tagliata`, `arrosto di`, `hamburger di`, `spezzatino`, `straccetti`, `scaloppin`, '
      + '`macinato di` \u2014 pi\u00f9 `coppa`, `salame`, `gallina`, `quaglia`. Su venti nomi plausibili ne '
      + 'sbagliava **quindici**: «Hamburger di ceci», «Cotoletta di melanzane», «Tagliata di verdure», '
      + '«Coppa di yogurt», «Salame di cioccolato», «Uova di gallina» erano tutti carne.\n'
      + '\u2705 **Corretto**: due livelli \u2014 animali e salumi che valgono sempre, preparazioni che '
      + 'valgono solo senza un segno vegetale \u2014 pi\u00f9 un antidoto **specifico** per le tre parole a '
      + 'doppio senso. \u26a0\ufe0f L\'errore non \u00e8 simmetrico e le prove nemmeno: 16 casi che non devono pi\u00f9 '
      + 'essere carne e **20 che devono restarlo**, perch\u00e9 un falso negativo qui \u00e8 carne nel piatto '
      + 'di una pescetariana.\n'
      + '\u26d4 **MA IL CODICE CORRETTO NON RIPORTA INDIETRO QUELLO CHE \u00c8 GI\u00c0 STATO SCRITTO**, e qui '
      + 'restano due cose da fare a mano:\n'
      + '\u2460 **Rilanciare `npm run panieri:pesce`**: la derivazione della Fase 5 ha gi\u00e0 scritto 9179 '
      + 'appartenenze e ne ha **scartate 1355 come «carne»**. Una fetta di quelle sono hamburger di '
      + 'ceci e cotolette di melanzane \u2014 cio\u00e8 proprio i piatti che una pescetariana deve ricevere. '
      + 'La derivazione **aggiunge e non sostituisce**, quindi rilanciarla \u00e8 sicuro.\n'
      + '\u2461 **Ricontrollare la regola flexitariana** dopo averla accesa: `menu.service` conta le '
      + 'giornate con carne dallo stesso riconoscitore, quindi finora un hamburger di ceci bruciava '
      + 'una delle **due volte a settimana** decise l\'1/9. Dal rilascio il conto \u00e8 giusto; le '
      + 'giornate gi\u00e0 composte no, e non si riscrivono.\n'
      + '\u26a0\ufe0f E `npm run diag:carne-fuori-posto` dice se nei panieri vegani e vegetariani resta '
      + 'ancora carne: quello che resta dopo questa correzione \u00e8 catalogo da guardare, non pi\u00f9 il '
      + 'riconoscitore.'
      + '\n\n✅ **IL RICONOSCITORE È CORRETTO, 4/9.** `diag:carne-fuori-posto` in produzione: otto piatti, **otto falsi**, tutti della stessa forma — il nome di un animale seguito da come è fatto davvero: «prosciutto **vegetale**», «pollo **di tempeh**», «polpo **di ceci**», «branzino **di melanzane**». Famiglia aperta, quindi regola e non elenco: `senzaImitazioni` in `piatto-di-cosa.ts` cancella il nome dell\'animale quando il segno vegetale gli sta **attaccato**, in due forme sole.\n'
      + '⛔ **«con» non vale, ed è la riga che tiene stretta la regola**: «pollo con ceci» è pollo vero, e leggerlo come finto sarebbe carne nel piatto di una pescetariana — l\'unico errore che qui non ci si può permettere.\n'
      + '⚠️ **E ha cambiato la risposta in altri due punti, in meglio**: «prosciutto di tofu» non manda più una persona a guardarlo (era «dubbia», adesso «ok»), e una giornata a mano con «branzino di melanzane» non chiede più la revisione a una nutrizionista.\n'
      + '▶️ **RESTA `APPLICA=1 npm run panieri:pesce`**: il tabulato del 4/9 dice **81 appartenenze da aggiungere** e 1342 piatti scartati perché contengono carne. ⚠️ Quel 1342 è il numero che il riconoscitore corretto cambia: vale la pena rilanciare la diagnostica **prima** di applicare.'
      + '\n\n✅ **CHIUSA — eseguito da Simone il 5/9.** `panieri:pesce` col riconoscitore corretto: **20 appartenenze aggiunte** (righe pescetariane 9318 → 9338, il conto torna), e i piatti scartati perché contengono carne sono scesi da 1342 a **902** — la differenza sono gli hamburger di ceci e le cotolette di melanzane che il vecchio riconoscitore chiamava carne. La regola flexitariana conta le giornate dal rilascio col riconoscitore giusto; quelle già composte non si riscrivono, ed è dichiarato.',
    categoria: CODICE,
    ordine: 672,
    nata: '2026-09-01T16:00',
  },

  {
    chiave: 'ricette-di-pesce-etichettate-vegane',
    titolo: 'In catalogo ci sono ricette di pesce dichiarate «vegane»: una vegana pu\u00f2 ricevere il salmone',
    fatta: true,
    dettaglio:
      '\u26d4 **Misurato l\'1/9 con `diag:carne-fuori-posto`: 175 piatti** con pesce o carne dentro '
      + 'panieri vegani e vegetariani \u2014 salmone, branzino, cozze, gamberi, alici \u2014 e **tutti e 175 '
      + 'hanno il regime «compatibile»**, cio\u00e8 «Salmone al forno con asparagi e limone» \u00e8 dichiarato '
      + '`vegan` in catalogo.\n'
      + '\u26a0\ufe0f **Non l\'hanno causato i panieri**: il paniere fa quello che gli \u00e8 stato detto, e quelle '
      + 'clienti ricevevano gi\u00e0 quei piatti quando il pool veniva dalle giornate. I panieri sono solo '
      + 'il posto dove finalmente si vede.\n'
      + '\u26d4 **E il difetto \u00e8 pi\u00f9 largo del paniere**: un salmone etichettato `vegan` \u00e8 vegano '
      + 'dappertutto \u2014 base personale certificata, tendine del back office, ogni filtro per regime '
      + 'del motore.\n'
      + '\u26a0\ufe0f E spiega perch\u00e9 `panieri:pesce` trovava «pesce 0» negli onnivori: il pesce non \u00e8 nei '
      + 'panieri onnivori, \u00e8 tutto etichettato vegano. Correggere l\'etichetta lo fa comparire dove '
      + 'serve alle pescetariane.\n'
      + '\u2705 **Gli strumenti ci sono, e l\'ordine \u00e8 questo**: \u2460 `npm run regime:contenuto` corregge '
      + 'l\'etichetta \u2014 e corregge **solo** le ricette che hanno il pesce negli INGREDIENTI, non nel '
      + 'nome, perch\u00e9 «Polpo d\'Alghe Nori» \u00e8 un piatto vegano davvero e riscriverlo a macchina '
      + 'sarebbe l\'errore uguale e contrario; \u2461 `npm run panieri:pulisci` toglie dai panieri quello '
      + 'che \u00e8 gi\u00e0 scritto \u2014 serve perch\u00e9 `panieri:riempi` **solo aggiunge** e non toglie mai; '
      + '\u2462 `APPLICA=1 npm run panieri:pesce`; \u2463 `npm run diag:carne-fuori-posto` deve restare col '
      + 'solo mucchio dubbio.\n'
      + '\u26a0\ufe0f La pulizia **conta prima di togliere** e si ferma se una casella scende sotto soglia: '
      + 'si passa sopra solo con `FORZA=1`, dichiarandolo.\n'
      + '\u2705 **E la domanda «da dove sono nate» ha risposta, trovata l\'1/9 nel codice**: il generatore scrive il regime della **richiesta**, non del piatto \u2014 generando per una variante vegana, qualunque cosa risponda il modello nasceva `vegan`. Da oggi un piatto i cui INGREDIENTI il regime chiesto non pu\u00f2 mangiare **non viene scritto**, si conta e finisce nel registro (`scartatiFuoriRegime`). \u26a0\ufe0f Ingredienti e non nome: «Polpo d\'Alghe Nori» \u00e8 vegano davvero.'
      + '\n\n✅ **MISURATO IL 4/9: NON ESISTONO.** `diag:carne-fuori-posto` su 28.513 righe di paniere con ricetta attiva: **zero** col regime incompatibile. Otto piatti segnalati, tutti e otto col regime della ricetta **compatibile** — nessun errore di catalogo.\n'
      + '⛔ **Erano nomi, non ricette**: «Polpo di ceci», «Branzino di melanzane», «Prosciutto vegetale», «Pollo di tempeh». Non c\'era una ricetta di pesce dichiarata vegana: c\'era un riconoscitore che le inventava, corretto nella stessa consegna.\n'
      + '⚠️ L\'ottavo resta scritto: «Polenta ai Funghi Misti» scattava su «champignon, **ostriche**» negli ingredienti — sono i funghi ostrica. Le due parole non sono attaccate, quindi la regola nuova non lo prende: caso singolo, dichiarato.',
    categoria: CODICE,
    blocca: true,
    ordine: 673,
    nata: '2026-09-01T17:30',
  },

  {
    chiave: 'prove-con-le-date-scritte-a-mano',
    titolo: 'Altre prove hanno date scritte a mano e scadranno da sole, come è successo il 2/9 alle 4 di notte',
    dettaglio:
      '\u26d4 **Il 2/9 quattro prove sono diventate rosse senza che nessuno toccasse una riga.** '
      + '`pause/primo-giorno-utile.spec.ts` chiede di aprire una pausa dall\'1/9, e alla mezzanotte '
      + 'fra l\'1 e il 2 quella data \u00e8 diventata passato: il servizio rispondeva «quel periodo \u00e8 gi\u00e0 '
      + 'passato», che \u00e8 la risposta giusta a una domanda che le prove non volevano fare.\n'
      + '\u2705 **Quel file \u00e8 chiuso** (2/9): orologio fermo a mezzogiorno UTC dell\'1/9, per tutto il file '
      + 'e non solo per il gruppo rotto \u2014 le date a mano l\u00ec dentro sono 56 sparse in otto gruppi, e '
      + 'le altre non erano sane, erano solo non ancora scadute. \u26a0\ufe0f Mezzogiorno e non mezzanotte '
      + 'perch\u00e9 la suite gira anche con `TZ=Europe/Rome`, e un istante a cavallo sarebbe due giorni '
      + 'diversi nelle due modalit\u00e0.\n'
      + '\u2705 **E la classe altrove \u00e8 stata misurata, ed \u00e8 vuota** (2/9 sera). Stamattina avevo '
      + 'scritto «resta aperta, non l\'ho misurata» e avevo in mano una dozzina di file sospetti — '
      + '`privacy/cancellazione` (21 date a mano), `agenda/calendario` (20), `common/il-giorno-a-mano` '
      + '(18), `commerce/abbonamento-in-corso` (16), `menu/data-inizio-chat` (12). \u26d4 **Non erano '
      + 'malate**: una data fissa passata a una funzione pura che riceve «oggi» come parametro non '
      + 'scade mai; scadono solo quelle che finiscono davanti a un `new Date()` dentro il codice '
      + 'provato. Fermare dodici orologi a scatola chiusa sarebbe stata la stessa fretta pagata tre '
      + 'volte quel giorno: prima si guarda, poi si ferma.\n'
      + '\u2705 **Come si guarda: `AVANTI_GIORNI=120 npm run test:futuro`** (`test/tempo-avanti.ts`). '
      + 'Sposta avanti **solo `Date`** \u2014 e solo il costruttore senza argomenti e `now()`, cos\u00ec una '
      + 'data scritta a mano resta quel giorno l\u00ec \u2014 lasciando veri i timer, come '
      + '`test/orologio-fermo.ts`: falsificando anche `setTimeout` una suite che aspetta una promessa '
      + 'si blocca, e una suite in timeout assomiglia molto a una che ha trovato un difetto. '
      + '\u26a0\ufe0f **Non \u00e8 una delle quattro modalit\u00e0 obbligatorie e non deve diventarlo**: risponde a '
      + 'una domanda diversa \u2014 non «funziona?» ma «funzioner\u00e0 ancora fra tre mesi?» \u2014 e si lancia '
      + 'quando si scrivono prove con date a mano, o ogni tanto.\n'
      + '\u2705 **Il verdetto: 390 file, 6539 prove, tutte verdi a +120 e a +400 giorni.** Nessun file '
      + 'scade da solo nei prossimi tredici mesi.\n'
      + '\u26d4 **Il misuratore \u00e8 un Proxy, non una sottoclasse, e questa \u00e8 la riga da non perdere.** '
      + 'La prima stesura era `class Orologio extends Date` e dava due file rossi che rossi non erano '
      + '(«Expected constructor: ClockDate, Received constructor: Date» in `profile/imposta-digiuno` e '
      + 'in `notifications`): i timer finti di jest prendono il `Date` globale che trovano e fanno '
      + '`ClockDate.prototype = quello.prototype`, quindi sopra una sottoclasse le date vere smettono '
      + 'di essere `instanceof Date`. Un Proxy non ha un prototipo suo. \u26a0\ufe0f **Un misuratore che '
      + 'inventa guasti \u00e8 peggio di nessun misuratore, perch\u00e9 manda a cercare.**\n'
      + '\u2705 E `pause/primo-giorno-utile.spec.ts` ora ferma l\'orologio con `conOrologioFermo` \u2014 la '
      + 'porta di casa che esisteva gi\u00e0 e che quella notte non avevo usato, scrivendomi a mano un '
      + '`jest.useFakeTimers()` che falsificava anche i timer.\n'
      + '\u26a0\ufe0f **Il punto cieco, detto per intero**: dove l\'orologio \u00e8 gi\u00e0 fermo il futuro non si '
      + 'vede, e sono **454 prove su 6539** in 18 file. \u26d4 Avevo scritto «l\u00ec non c\'era niente da '
      + 'misurare comunque» ed \u00e8 falso: fra quelle 454 ci sono le 49 di `primo-giorno-utile`, cio\u00e8 '
      + 'l\'unico posto che si \u00e8 davvero rotto da solo \u2014 che proprio per questo l\'orologio adesso ce '
      + 'l\'ha fermo. Quelle restano da guardare a mano quando si toccano quei file.',
    categoria: CODICE,
    ordine: 674,
    nata: '2026-09-02T06:00',
    fatta: true,
  },

  {
    chiave: 'ricette-senza-elenco-ingredienti',
    titolo: 'Ricette attive senza elenco ingredienti: passano ogni controllo, perché ogni controllo guarda gli ingredienti',
    dettaglio:
      '\u26d4 **`6a5666fd` «Branzino al forno con verdure rosse e limone» \u00e8 ATTIVA, dentro un paniere, '
      + 'e ha l\'elenco ingredienti VUOTO.** \u00c8 saltata fuori il 2/9 guardando le sei ricette di pesce, '
      + 'e non \u00e8 una stranezza di catalogo: \u00e8 un piatto che una cliente pu\u00f2 ricevere e non pu\u00f2 '
      + 'cucinare.\n'
      + '\u26d4 **E soprattutto \u00e8 il buco della settimana dei panieri.** Il filtro del regime nel '
      + 'generatore, la deduzione degli allergeni e le esclusioni della cliente guardano tutti gli '
      + '**ingredienti**: con l\'elenco vuoto non dicono «attenzione», dicono **«ok»**. \u00c8 il buco '
      + 'esatto da cui erano entrati i 175 piatti con carne o pesce nei panieri vegani.\n'
      + '\u2705 **Il generatore non ne fa pi\u00f9** (2/9): un piatto che torna dal modello senza elenco non '
      + 'viene preso, si riprova fino a tre volte, e un pasto che resta vuoto finisce in '
      + '`pastiIncompleti` invece di sparire in silenzio.\n'
      + '\u26a0\ufe0f **Quelle gi\u00e0 in catalogo restano, e vanno riempite a mano.** `npm run '
      + 'diag:senza-ingredienti` dice quante sono e quali, divise fra «attive e dentro a un paniere» '
      + '(una cliente le pu\u00f2 ricevere) e «fuori dai panieri o spente» (con calma). \u26a0\ufe0f Attenzione '
      + 'al terzo caso che il tabulato separa: l\'elenco che **c\'\u00e8 ma non ha nomi dentro** '
      + '(`[{qty: 100}]`) \u2014 da fuori la ricetta sembra compilata.'
      + '\n\n\u2705 **Dal 4/9 non ne nascono pi\u00f9 nemmeno dalle persone**: la porta di `createRecipe`/`updateRecipe` ferma l\'elenco vuoto e quello senza nomi (vedi la voce `cancelli-alla-porta-delle-ricette`). Resta da riempire quello che c\'\u00e8 gi\u00e0.',
    categoria: CODICE,
    ordine: 675,
    nata: '2026-09-02T19:00',
  },

  {
    chiave: 'senza-glutine-risulta-glutine',
    fatta: true,
    titolo: '\u00abPasta senza glutine\u00bb risulta con il glutine: una celiaca non riceve la pasta fatta per lei',
    dettaglio:
      '\u26d4 **Trovato il 5/9 scrivendo la regola \u00absenza \u2039chiave\u203a\u00bb** per \u00ablievito (senza uova)\u00bb. Quella regola vale per la **chiave** che segue \u00absenza\u00bb: su \u00abpasta senza glutine\u00bb toglie `glutine` ma resta **\u00abpasta\u00bb**, che \u00e8 una chiave del glutine da sola, e il tag si scrive lo stesso. Lo stesso per \u00abpane senza glutine\u00bb, \u00abfarina senza glutine\u00bb, \u00abbiscotti senza glutine\u00bb: sono esattamente i prodotti che una celiaca pu\u00f2 mangiare, e oggi risultano tutti col glutine.\n'
      + '\u26a0\ufe0f **Perch\u00e9 non \u00e8 chiuso di sponda**: la regola giusta \u00e8 per **allergene**, non per chiave \u2014 \u00abse il nome dell\'ingrediente dice \u2039senza \u2039allergene\u203a\u203a, quell\'allergene non si scrive, qualunque parola l\'abbia fatto scattare\u00bb \u2014 e sta in `suggestAllergens`, non in `chiaveVale`. \u26d4 Con una cautela: \u00ablatte senza lattosio\u00bb NON \u00e8 \u00absenza latte\u00bb (le proteine ci sono tutte), quindi il confronto \u00e8 con il nome dell\'allergene e le sue forme (\u00absenza glutine\u00bb, \u00absenza uova\u00bb, \u00absenza latte\u00bb, \u00absenza lattosio\u00bb **no**), scritte una per una.\n'
      + '\u25b6\ufe0f **Prima il numero**: quante ricette hanno un ingrediente con \u00absenza glutine\u00bb (o uova, o latte) nel nome e portano quel tag. Poi la regola con la prova \u00ablatte senza lattosio resta latte\u00bb, poi `ripara:allergeni-chiave` allargato a questo caso.'
      + '\n\n✅ **Il numero lo dà `npm run diag:vocabolario-allergeni`** (5/9), tabella 2: per ogni forma («senza glutine», «gluten free», «senza uova», «senza latte»…) quante ricette hanno quell\'ingrediente e il tag scritto, **separando** quelle in cui il tag viene comunque da un altro ingrediente (pasta senza glutine + pangrattato: il tag è giusto). Il numero che conta è la differenza. «senza lattosio» non è una forma, apposta.'
      + '\n\n✅ **CHIUSA NEL CODICE il 5/9: la regola per ALLERGENE.** `SENZA_PER_ALLERGENE` in `catalog/allergens.ts` (glutine: «senza glutine», «gluten free», «gluten-free», «glutenfree»; uova, latte, soia, frutta a guscio, arachidi, sesamo) e `diceSenza(nome, allergene)`: se il nome dell\'ingrediente lo dice, quell\'allergene non si scrive da quell\'ingrediente, qualunque parola l\'abbia fatto scattare («pasta» compresa). «Pasta senza glutine» + pangrattato resta glutine, dal pangrattato. **«Senza lattosio» non c\'è**, apposta. Misurato il 5/9 prima di scrivere: 186 ricette col tag, 14 giustificate da un altro ingrediente, **172 da togliere**.\n▶️ **Resta un comando, una volta sola**: `npm run ripara:allergeni-chiave` (sola lettura) e poi `CONFERMA=1 npm run ripara:allergeni-chiave` — la riga «senza» sta nello stesso script delle 215 (`allergeniFalsiDaTogliere`, ramo `chiave: \'senza\'`), non ce n\'è uno nuovo.',
    categoria: CODICE,
    ordine: 677,
    nata: '2026-09-05T09:30',
  },

  {
    chiave: 'cancelli-alla-porta-delle-ricette',
    titolo: 'Alla porta che scrive una ricetta: l\'elenco vuoto ferma, il regime che il contenuto smentisce chiede conferma',
    fatta: true,
    dettaglio:
      '\u2705 **Decisioni di Simone del 4/9**, su due difetti misurati: *\u00ab1 deve essere bloccante, non fa salvare la ricetta\u00bb* (l\'elenco ingredienti vuoto) e *\u00ab2 chiede doppia conferma\u00bb* (il regime dichiarato che il contenuto smentisce: pollo in un piatto vegetariano). '
      + 'Il giudizio sta in `catalog/ricetta-che-si-puo-scrivere.ts` (puro, con le prove); la porta \u00e8 **una**, `catalog.service.createRecipe`/`updateRecipe`, e ci passano la pagina Ricette, la finestra \u00abNuova ricetta\u00bb dal menu e Vera. Il backoffice mostra il banner \u00abDa leggere prima di salvare\u00bb e un secondo pulsante \u00abHo letto, salva lo stesso\u00bb: la conferma \u00e8 un secondo clic, non un campo che il codice si mette da solo. La forzatura resta scritta nel registro (`regimeForzato`).\n'
      + '\u26a0\ufe0f **Chiede e non ferma, ed \u00e8 voluto**: in catalogo esistono \u00abPolpo di ceci\u00bb e \u00abBranzino di melanzane\u00bb; bloccare vorrebbe dire non poter pi\u00f9 scrivere met\u00e0 delle imitazioni.\n'
      + '\u26d4 **Il generatore notturno e l\'agente dei pasti leggeri NON passano da qui, e non sono aperti**: il primo ha il suo controllo sull\'elenco vuoto dal 2/9, il secondo (`vaglia`) scarta \u00absenza ingredienti\u00bb e ogni piatto di carne o pesce. Un commento diceva il contrario per deduzione: corretto il 4/9 sera.\n'
      + '\u2705 **Chiuso la sera dello stesso giorno il buco dichiarato la mattina: le UOVA e i LATTICINI in un piatto dichiarato VEGANO.** `classifica` conosce carne e pesce; per latte e uova si chiede alla deduzione degli allergeni, e in un piatto vegano si chiede conferma. Non si poteva la mattina perch\u00e9 chiedeva su \u00abmelagrana\u00bb (caduto con la porta unica delle chiavi) e poi su \u00abricotta di mandorla\u00bb e \u00abuova di lino\u00bb \u2014 chiuso con `derivatoVegetale` in `menu/exclusions.ts`: una **regola di forma** (\u00ab\u2039nome\u203a di \u2039pianta\u203a\u00bb) e non dieci frasi in pi\u00f9, perch\u00e9 \u00e8 una famiglia aperta come \u00ab-orata\u00bb.\n'
      + '\u26d4 **Due cose che la regola di forma NON fa, per due decisioni diverse**: vale solo per i **nomi** di ingrediente e mai per le preparazioni (\u00abfrittata di zucchine\u00bb \u00e8 di uova); e \u00abformaggio vegano\u00bb/\u00abpanna vegetale\u00bb **restano latte** per gli allergeni (decisione del 31/8: il caseinato nei prodotti in commercio) \u2014 il cancello, che chiede e non toglie, li lascia passare da solo.\n'
      + '\u26a0\ufe0f **Il tag gi\u00e0 scritto in catalogo non cambia da solo**: `npm run diag:vegani-con-latte-e-uova` (sola lettura) dice quante ricette vegane chiederebbero conferma oggi e per quale ingrediente \u2014 l\'elenco con cui si allungano le piante di `derivatoVegetale`, o si correggono i piatti dichiarati vegani a torto. I tag falsi per \u00abricotta di mandorla\u00bb si tolgono con `ripara:allergeni-chiave`, come le 215.'
      + '\n\n\u25b6\ufe0f **MISURATO IL 5/9 sul catalogo vero: 7206 ricette vegane attive, 462 chiederebbero conferma.** Letto riga per riga: un centinaio erano **forme che la regola non conosceva** \u2014 \u00ablatte mandorla\u00bb senza il \u00abdi\u00bb (18), \u00abburro di semi di girasole\u00bb (21), \u00abburro di pistacchio\u00bb (13), tahina, walnut, soya, legumi, \u00ab(senza uova)\u00bb, e \u00abgranata semi\u00bb (melograno: `grana` dentro `granata`) \u2014 chiuse in `derivatoVegetale` (forma con e senza \u00abdi\u00bb, piante corte come parole intere: \u00abburro **chia**rificato\u00bb resta burro, l\'ha trovato la prova del 31/8), nelle omonime e con la regola \u00absenza \u2039chiave\u203a\u00bb. \u26d4 **Il resto \u2014 circa 300 \u2014 sono ricette dichiarate vegane A TORTO**: uova sode e strapazzate (85), ricotta (80), stracchino (30), mozzarella (27), parmigiano, mascarpone, grana, pecorino, yogurt greco, e una decina con **calamari, cernia, nasello, acciughe**. Una vegana le riceve oggi: \u00e8 il difetto dei 175 dell\'1/9, nella versione latte-e-uova. **Decisione di Simone (5/9): si rietichettano come allora.**\n'
      + '\u2705 **Fatto**: `classifica` (`etichetta-contro-contenuto.ts`) giudica anche uova e latticini per il regime vegano (`uovaOLatticini`, \u2192 `vegetarian`), cos\u00ec cancello, attivit\u00e0 coach e script hanno **una testa sola**; `npm run regime:contenuto` li conta e con `APPLICA=1` li scrive, poi `panieri:pulisci` li toglie dai panieri vegani. \u26a0\ufe0f Il lancio \u00e8 di Simone, con la lista davanti.',
    categoria: CODICE,
    ordine: 676,
    nata: '2026-09-04T10:00',
  },

  {
    chiave: 'foglio-alimenti-2-9-riempito',
    titolo: 'Il foglio alimenti del 2/9 ha 200 righe su 262 con valori copiati: non si carica',
    dettaglio:
      '\u26d4 **Il foglio compilato del 2/9 (262 righe) non si pu\u00f2 caricare cos\u00ec.** L\'import si '
      + 'ferma da solo \u2014 il controllo `trovaGemelli`, scritto il 20/8 dopo essersi bruciati sullo '
      + 'stesso problema \u2014 e ha ragione: **otto gruppi, 149 righe**, hanno i valori identici a '
      + 'quelli di un altro alimento.\n'
      + '\u26d4 **Il gruppo pi\u00f9 grosso sono 89 righe a «100/5/10/2/3/2»**, e dentro ci sono `sale q b`, '
      + '`vino bianco`, `gorgonzola`, `maionese`, `cioccolato fondente 85`, `branzino`, `lattuga`. Il '
      + 'gorgonzola non fa 100 kcal e il cioccolato fondente ne fa seicento: quei numeri non '
      + 'descrivono quegli alimenti, sono un riempimento per categoria.\n'
      + '\u26a0\ufe0f Gli altri, con dentro la riga che li smaschera: 16 a «350 kcal» fra cui **riso basmati '
      + 'cotto** (il riso cotto ne fa 110); 8 a «310 kcal» fra cui **lenticchie verdi cotte** e '
      + '**piselli surgelati**; 6 a «130/21/0/0/4.5/0» dove il **cipollotto** sta insieme al petto di '
      + 'pollo, con 21 g di proteine e zero carboidrati; 6 a «150/20» con merluzzo, sgombro, tonno e '
      + 'orata tutti uguali; 12 verdure a «25 kcal»; 6 fra parmigiano e grana insieme ai **semi di '
      + 'melagrana**.\n'
      + '\u26a0\ufe0f **I gruppi legittimi il controllo li riconosce gi\u00e0 e li lascia passare**: i dodici modi '
      + 'di scrivere «olio di oliva», le mele, i «grattugiati». Quelli non sono in conto.\n'
      + '\u26d4 **E la mia prima analisi diceva che il foglio era in ottimo stato**, perch\u00e9 guardavo '
      + 'riga per riga \u2014 coerenza fra kcal e macro, celle vuote \u2014 e **una riga copiata resta '
      + 'coerente con s\u00e9 stessa**. La copia si vede solo mettendo le righe accanto. \u00c8 la stessa '
      + 'lezione gi\u00e0 scritta nel commento del 20/8, e l\'ho ripetuta.\n'
      + '\u2705 **Cosa serve**: rifare quelle righe con valori veri. Il resto del lavoro \u00e8 pronto \u2014 il '
      + 'file dati (`prisma/dati-alimenti-2-9.ts`, valori copiati fedelmente e verificati uno per '
      + 'uno contro il foglio), la traduzione degli stati e la nota di chi ha compilato. Appena il '
      + 'foglio \u00e8 sistemato, `npm run importa:alimenti` gira e poi `CONFERMA=1`.',
    categoria: CODICE,
    ordine: 676,
    nata: '2026-09-02T13:00',
  },

  {
    chiave: 'ricetta-verificata-dalla-nutrizionista',
    fatta: true,
    categoria: SIMONE,
    ordine: 3,
    nata: '2026-09-04T11:40',
    titolo: '▶️ La spunta «ricetta verificata»: chiesta da Simone, e prima serve una risposta',
    dettaglio:
      'Richiesta di Simone, 4/9: *«quando vado in modifica devo avere un flag — ricetta verificata — '
      + 'che quando il nutrizionista clicca resta tutto registrato»*.\n\n'
      + '✅ **La forma esiste già nel progetto**, e non va inventata: è quella di '
      + '`clinical_clearance` — *«la chiude a mano chi ha guardato, e così resta scritto chi ha '
      + 'guardato»*. Due colonne sulla ricetta (chi, quando), la spunta nel popup «Modifica ricetta», '
      + 'la riga di registro. ⚠️ Serve una **migrazione**, quindi la applica Simone prima della push.\n\n'
      + '⛔ **E prima serve UNA risposta, perché decide se la spunta vuol dire qualcosa: quando la '
      + 'ricetta viene modificata, la verifica resta o cade?**\n'
      + '· Se **resta**, «verificata» diventa una bugia il giorno che qualcuno cambia gli ingredienti '
      + '— ed è la parola su cui poi si costruiscono gli allergeni.\n'
      + '· Se **cade**, la nutrizionista rifà il lavoro a ogni virgola cambiata, e dopo due volte '
      + 'smette di spuntare.\n'
      + '· La terza strada è che cada **solo** se cambia qualcosa che conta — ingredienti, allergeni, '
      + 'regime — e non se cambia il nome o una grammatura. Costa di più da scrivere, ed è l\'unica '
      + 'che tiene la spunta vera senza far rifare il lavoro.\n\n'
      + '⚠️ **E una domanda più piccola che viene dietro**: la spunta la può mettere solo la '
      + 'nutrizionista, o anche il capo? Oggi la scheda ricetta si apre con `recipes`, che ce l\'hanno '
      + 'in tre ruoli.'
      + '\n\n✅ **CHIUSA — fatta il 4/9 (`4b21463`), e questa voce non lo diceva.** Due colonne (`verified_at`, `verified_by_id`) e il **nome** in schermata sotto la casella, come `clinical_clearance`. La risposta alla domanda è la **terza strada**: la firma cade **solo** se cambiano gli ingredienti (i nomi) o il regime — non su nome, kcal, grammature, stagioni — e la spunta messa nello stesso salvataggio vince sulla decadenza. `verified` si manda solo quando è cambiato: chi corregge un refuso non ri-firma col proprio nome. ⛔ E **non** è `allergensReviewed`: quella la legge il filtro di sicurezza, questa dice «una nutrizionista ha guardato la ricetta intera»; cadono ciascuna per la sua ragione. Chi può metterla: chi apre la scheda ricetta. Riletto il 5/9 sulla lista di Simone: era già finita.',
  },

  {
    chiave: 'carne-e-pesce-nei-pasti-leggeri',
    fatta: true,
    categoria: SIMONE,
    ordine: 1,
    nata: '2026-09-04T12:30',
    titolo: '⛔ Branzino, merluzzo e gamberetti a COLAZIONE: la regola c\'è dal 31/8 e guarda solo i piatti nuovi',
    dettaglio:
      'Simone, 4/9, aprendo «Basso indice glicemico · Onnivoro · Colazione»: *«avevo detto di '
      + 'togliere pesce e carne nelle colazioni e trovo Branzino a colazione?»* — e non è solo il '
      + 'branzino: nella stessa cella ci sono burger di merluzzo, dentice, filetto di trota (due), '
      + 'salmone affumicato.\n\n'
      + '⛔ **La regola esiste dal 31/8 e non è mai stata applicata a quello che c\'era già.** '
      + '`PASTI_SENZA_CARNE_PESCE_VERDURA` copre colazione, spuntino **e** merenda, e '
      + '`vaBeneAColazione` decide bene — ma la legge **un posto solo**: l\'agente che *genera* i '
      + 'piatti leggeri nuovi. Serve a non farne creare altri. I piatti entrati prima non li ha '
      + 'filtrati nessuno, e il motore dal paniere ci pesca.\n\n'
      + '✅ **LO STRUMENTO C\'È (4/9): `npm run diag:colazioni-con-carne`**, sola lettura. Dice quanti '
      + 'sono, in quali celle, con quale parola sono stati riconosciuti — e soprattutto **quanti ne '
      + 'restano** togliendoli. Il giudizio sta in `colazione-senza-carne-e-pesce.ts` con le sue '
      + 'prove, non nello script.\n'
      + '⛔ **Il numero che decide non è quanti escono: è quanti restano.** Sotto '
      + '`MINIMO_PER_CELLA` (8) la cella si **nomina e non si tocca**: una colazione che resta con '
      + 'tre piatti serve lo stesso piatto a giorni alterni, e dopo tre giorni la cliente smette di '
      + 'aprire l\'app. Il branzino a colazione è sbagliato; una colazione che non c\'è è peggio.\n'
      + '⚠️ **Due letture, non una**: il nome (`Branzino al vapore`) e gli ingredienti (`gamberetti '
      + 'sgusciati`, che nel nome non compaiono). `diCosaE` da solo non basta, perché senza '
      + 'grammature risponde «non lo so» — e «non lo so» non è «va bene».\n'
      + '⚠️ **E le VERDURE si contano ma non si tolgono**: la richiesta del 31/8 ne nominava tre, '
      + 'questo ne toglie due. «Avocado toast» e «Crepes con spinaci» sono colazioni normali, e '
      + '`diCosaE` le legge come verdura per via dell\'ingrediente più pesante: toglierle '
      + 'svuoterebbe i panieri di roba giusta.\n\n'
      + '✅ **LE DUE RISPOSTE CI SONO (4/9), e la diagnostica è stata letta davvero.** Simone l\'ha '
      + 'lanciata su Render: 2823 righe da 61 celle. Alla domanda «Keto e Keto-Mediterranea sono '
      + 'un\'eccezione, visto che perdono l\'80%% delle merende (106→26 e 89→26)?» ha risposto '
      + '**«vale per tutte»**; a «le celle mostrate sono tutte in bozza, si puliscono anche quelle?» '
      + '**«bozze o attive»**. Nessuna eccezione di famiglia nel codice: il rimedio resta '
      + '`MINIMO_PER_CELLA`, e le keto restano da riempire con spuntini che non siano carne — lavoro '
      + 'di catalogo, non di codice.\n'
      + '✅ **E il falso positivo trovato leggendo è stato corretto**: l\'ingrediente '
      + '«tuorlo/uova di anatra, quaglia, oca» — che è il modo in cui il catalogo scrive le uova non '
      + 'di gallina — risultava carne. Ora `senzaUovaDi` lo smonta, ma **solo se l\'uovo sta '
      + 'attaccato all\'animale**: «Tagliatelle all\'uovo al ragù di anatra» resta carne.\n\n'
      + '▶️ **RESTA DA FARE, ed è di Simone**: lanciare la diagnostica su Render, **leggere le righe '
      + 'una per una** (se una non c\'entra niente sbaglia il riconoscitore, e allora sbaglia anche '
      + 'dove nessuno lo sta guardando), e poi `APPLICA=1`. ⚠️ Non cancella nessuna ricetta: toglie '
      + 'l\'appartenenza a quella cella, e a pranzo e a cena quei piatti restano dove sono.\n'
      + '⛔ **E resta il cancello a valle**: anche svuotando oggi il paniere, domani qualcuno ce li '
      + 'rimette a mano dalla pagina Panieri. Quello è un lavoro a sé — la pagina ha già il '
      + 'controllo alla scrittura, `riempi-panieri` no.'
      + '\n\n✅ **CHIUSA — fatto il 4/9 (`ad7272d`), e questa voce non lo diceva.** Simone ha lanciato `APPLICA=1 npm run diag:colazioni-con-carne` in produzione, e lo stesso giorno l\'altra sessione ha chiuso **le tre porte** insieme: `riempi-panieri`, la pagina Panieri e l\'agente dei pasti leggeri passano tutte da `fuoriPostoAColazione`. Dalla pagina con «Mostra solo in bozza» era saltato fuori che la pulizia saltava le bozze (`recipe.active`): corretto nello stesso commit, le bozze si tolgono sempre. Riletto il 5/9 sulla lista di Simone: era già finita.',
  },

  {
    chiave: 'menu-a-mano-fuori-dal-paniere',
    fatta: true,
    categoria: SIMONE,
    ordine: 2,
    nata: '2026-09-04T11:00',
    titolo: '\u25b6\ufe0f Entrare nel menu di una cliente: si pesca da tutto il catalogo, resta da creare la ricetta nuova',
    dettaglio:
      'Simone, 4/9: *\u00abinterfaccia dove il nutrizionista pu\u00f2 entrare nel menu della cliente e '
      + 'modificare i pasti presenti uno ad uno selezionando dal catalogo o inserire nuovi piatti\u00bb* \u2014 e '
      + 'poi, pi\u00f9 secco: *\u00abgli manda i menu in chat perch\u00e9 tu non hai pi\u00f9 fatto l\'interfaccia per '
      + 'farli\u00bb*.\n\n'
      + '\u26a0\ufe0f **L\'interfaccia c\'era gi\u00e0** (\u00abScrivi menu a mano\u00bb, consegnata il 3/9) \u2014 gliel\'ho '
      + 'verificato e lui ha risposto *\u00abhai ragione colpa mia non lo avevo visto\u00bb*. Ma pescava **solo '
      + 'dal paniere della cliente**, ed \u00e8 il motivo vero per cui i menu passavano dalla chat: se il '
      + 'piatto giusto stava fuori dal pool, da l\u00ec non si trovava.\n\n'
      + '\u2705 **FATTO (4/9)**: casella \u00abCerca in tutto il catalogo\u00bb nella finestra dei pasti; ogni riga '
      + 'dice se \u00e8 **fuori dal suo paniere**; le incompatibili restano barrate col motivo; il taglio a '
      + '200 righe \u00e8 scritto in chiaro (fuori dal paniere scatta a ogni ricerca corta, dentro non '
      + 'scattava mai).\n'
      + '\u26d4 **E il confine si \u00e8 spostato, non tolto**: da \u00ab\u00e8 nel suo paniere\u00bb a \u00ab\u00e8 di un regime che '
      + 'questa cliente mangia\u00bb, riletto dal database al salvataggio. Il paniere \u00e8 una comodit\u00e0; il '
      + 'regime no.\n\n'
      + '\u26d4 **DUE DIFETTI GRAVI TROVATI DALLA REVISIONE AVVERSARIALE PRIMA DELLA CONSEGNA**, e '
      + 'nessuna prova li copriva:\n'
      + '\u00b7 `scrivi()` rifiutava con 400 **tutto** ci\u00f2 che non era nel pool: si accendeva la casella, '
      + 'si componeva la giornata intera, e il salvataggio diceva di no proprio sul piatto per cui la '
      + 'casella esiste. Le prove sulla ricerca e quelle sulla scrittura c\'erano tutte e due; **la '
      + 'coppia no**.\n'
      + '\u00b7 Il filtro sul regime si applicava **solo se** il regime si riusciva a leggere \u2014 e non si '
      + 'legge esattamente per la cliente senza pool, cio\u00e8 quella per cui si esce dal paniere. Una '
      + 'vegana appena inserita vedeva lo spezzatino di manzo non barrato. Ora il ripiego \u00e8 il regime '
      + 'pi\u00f9 stretto (`common/regimi.ts`), mai \u00abtutti\u00bb.\n\n'
      + '\u25b6\ufe0f **RESTA APERTO, e Simone lo sa**: creare una ricetta nuova dalla stessa finestra (nome, '
      + 'ingredienti, metodo, kcal, e **in quali panieri** \u2014 riusando il pezzo che la pagina Ricette '
      + 'ha gi\u00e0). E la ricetta dettata a Vera passo passo, che il 4/9 ho dichiarato fuori portata.'
      + '\n\n✅ **CHIUSA — fatto il 4/9 (`ad7272d`), e questa voce non lo diceva.** Il pulsante «Scrivi una ricetta nuova» sta in fondo all\'elenco di «Scrivi menu a mano»: prima si cerca, anche fuori dal paniere, e solo dopo si scrive. Riusa la finestra della pagina Ricette e dopo il salvataggio passa agli allergeni e poi ai panieri (con l\'anello corretto: una ricetta appena creata nasce con gli allergeni non confermati, e il pannello dei panieri non deve chiedere un gesto impossibile). Il permesso si chiede prima di compilare. ⚠️ La ricetta dettata a Vera passo passo resta fuori portata, ed è dichiarato in `vera/scrittura-ricetta.ts`. Riletto il 5/9 sulla lista di Simone: era già finita.',
  },

  {
    chiave: 'filtro-ricette-verificate',
    categoria: SIMONE,
    ordine: 4,
    fatta: true,
    nata: '2026-09-04T11:20',
    titolo: '\u2705 Mostrare e nascondere le ricette gi\u00e0 verificate, in pagina Ricette',
    dettaglio:
      'Simone, 4/9, il giorno stesso della spunta: *\u00abaggiungiamo il pulsante che mostra e nasconde '
      + 'quelle verificate\u00bb*.\n\n'
      + '\u2705 **FATTO**: due pulsanti \u2014 \u00abSolo verificate\u00bb e \u00abSolo da verificare\u00bb \u2014 nella barra della '
      + 'pagina, pi\u00f9 un segno di spunta sulla riga con chi e quando nel titolo. \u26a0\ufe0f **Due e non uno**: '
      + 'la domanda che si fa davvero verificando un catalogo \u00e8 *quali mancano*, e il secondo clic '
      + 'sullo stesso pulsante torna a \u00abtutte\u00bb.\n'
      + '\u26d4 **Gira sul database**, come il filtro allergeni del 19/8 e per la stessa ragione: la pagina '
      + 'riceve mille righe in ordine alfabetico, e un filtro applicato dopo direbbe \u00abne restano '
      + 'poche\u00bb mentre ne restano migliaia. C\'\u00e8 anche l\'eco \u00abil filtro l\'ho applicato davvero\u00bb, per '
      + 'la finestra di rilascio in cui il backoffice \u00e8 nuovo e il backend ancora no.\n\n'
      + '\u26d4 **E il nome di chi ha verificato veniva letto dalla tabella sbagliata** (revisione '
      + 'avversariale, stesso giorno): gli account di staff nascono senza nome e cognome, il nome vive '
      + 'in `Staff.displayName`. Il tooltip diceva \u00abVerificata il 04/09\u00bb e basta per quasi tutte le '
      + 'nutrizioniste \u2014 una firma senza chi, in silenzio.',
  },

];
