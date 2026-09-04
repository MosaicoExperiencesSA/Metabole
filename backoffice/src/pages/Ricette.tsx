import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner, Toggle } from '../components/ui';
import { BottoneExcel, useTabella, type Colonna } from '../components/tabella';
import { useTaxonomy } from '../lib/taxonomy';
/**
 * ⚠️ La finestra degli allergeni: serve al passo che segue la creazione di una ricetta. Sta in
 * `components/` e non in `TagAllergeni.tsx` per non chiudere un ciclo di import — il perché per
 * esteso è in cima a quel file.
 */
import { AllergeniModal } from '../components/AllergeniModal';

export interface Ingredient { name: string; qty?: number | null; unit?: string | null }
interface CookingMethod { type: string; steps: string[] }
/**
 * ⚠️ **Un solo tipo «ricetta» per le due pagine che la mostrano** (24/8). Prima «Allergeni ricette»
 * ne aveva uno suo, stretto — `id, name, mealSlot, allergens, allergensReviewed, active` — perché
 * quella tabella non guardava altro. Da quando anche lì si apre «Modifica ricetta» servono gli
 * stessi campi, e due tipi per la stessa riga sono due tipi che un giorno divergono su un campo che
 * nessuna delle due pagine sta guardando in quel momento.
 *
 * ⚠️ I campi ci sono davvero, tutti: `listRecipes` (`catalog.service.ts`) fa `findMany` **senza
 * `select`**, quindi ogni riga arriva con tutte le colonne di `Recipe` più `utilizzo` e `settimane`.
 * `allergens` e `allergensReviewed` sono opzionali perché nel catalogo non si guardano, non perché
 * possano mancare.
 */
export interface Recipe {
  id: string;
  name: string;
  regime: string;
  mealSlot: string;
  kcal: number;
  ingredients: Ingredient[];
  cookingMethods?: CookingMethod[] | null;
  difficulty?: string;
  seasons?: string[];
  active: boolean;
  /**
   * In quali settimane del ciclo è usata questa ricetta.
   *
   * Si legge dalle GIORNATE, non dal tag: il tag `sett:N` diceva in quale generazione la ricetta era
   * nata, e quella differenza aveva fatto sembrare «tutte nella prima settimana» un catalogo
   * distribuito su due. Dentro una dieta sono le settimane DI QUELLA dieta; fuori, l'unione su tutto
   * il catalogo — la stessa ricetta serve più famiglie, in settimane diverse.
   */
  settimane?: number[] | null;
  /**
   * Le diete che usano questa ricetta e, per ognuna, in che settimane del suo ciclo. Sempre letto
   * dalle giornate.
   *
   * NON è il tag `dieta:<nome>`: quello dice per quale famiglia la ricetta è stata *generata* e non
   * cambia mai più, nemmeno quando un'altra dieta la riusa — cosa che il generatore fa apposta, per
   * non ricomprare piatti già pagati.
   *
   * `[]` = **orfana**: nessuna giornata la usa. `null` = il server non è riuscito a leggere le
   * giornate: non lo sappiamo, ed è una cosa diversa da «nessuna».
   */
  utilizzo?: { dieta: string; settimane: number[] }[] | null;
  /** I 14 allergeni UE confermati o suggeriti. Li guarda «Allergeni ricette», non il catalogo. */
  allergens?: string[];
  allergensReviewed?: boolean;
  /**
   * ⛔ **LA SPUNTA «RICETTA VERIFICATA»** (Simone, 4/9): una nutrizionista ha guardato la ricetta
   * intera. ⚠️ NON è `allergensReviewed`, che è più stretta e la legge il filtro di sicurezza.
   * `verifiedAt` è la data, `verifiedByName` il nome di chi: una spunta senza chi e quando dice
   * «qualcuno, una volta», e fra tre mesi davanti a una ricetta verificata e sbagliata non si sa a
   * chi chiedere.
   */
  verifiedAt?: string | null;
  verifiedByName?: string | null;
}

/** I nomi delle diete che usano la ricetta. `null` (server muto) si legge come elenco vuoto qui. */
const dieteDi = (r: { utilizzo?: { dieta: string }[] | null }): string[] => (r.utilizzo ?? []).map((u) => u.dieta);

const SLOT: Record<string, string> = { breakfast: 'Colazione', morning_snack: 'Spuntino', lunch: 'Pranzo', afternoon_snack: 'Merenda', dinner: 'Cena' };
/**
 * ⚠️ I metodi di cottura NON si scrivono più qui: arrivano da `/catalog/taxonomy`, che li prende da
 * `backend/src/common/metodi-cottura.ts`. Questa lista era ferma a tre voci mentre il motore ne
 * usava cinque — «in padella» e «al vapore» finivano nei menu e nella tendina non c'erano, quindi
 * chi apriva quella ricetta vedeva un valore che non poteva reinserire.
 */
const DIFFICULTY: Record<string, string> = { semplice: 'Semplice', media: 'Media', elaborata: 'Elaborata' };
const SLOTS = Object.keys(SLOT);
const DIFFICULTIES = Object.keys(DIFFICULTY);
const SEASONS: [string, string][] = [['spring', 'Primavera'], ['summer', 'Estate'], ['autumn', 'Autunno'], ['winter', 'Inverno']];
const SEASON_LABEL: Record<string, string> = Object.fromEntries(SEASONS);

/** Stagioni in chiaro. Vuoto = il piatto va bene tutto l'anno (vedi modale). */
const seasonsText = (s?: string[]): string =>
  s && s.length ? SEASONS.filter(([v]) => s.includes(v)).map(([, l]) => l).join(' · ') : 'Tutto l\'anno';

interface FormMethod { type: string; stepsText: string }
interface Form {
  name: string;
  regime: string;
  mealSlot: string;
  kcal: string;
  difficulty: string;
  seasons: string[];
  ingredients: Ingredient[];
  methods: FormMethod[];
  active: boolean;
  verified: boolean;
}

const emptyForm = (regime = 'omnivore', mealSlot = 'lunch'): Form => ({
  name: '', regime, mealSlot, kcal: '', difficulty: 'media', seasons: [],
  ingredients: [{ name: '', qty: null, unit: '' }],
  methods: [{ type: 'veloce', stepsText: '' }],
  active: true,
  verified: false,
});

function toForm(r: Recipe): Form {
  return {
    name: r.name, regime: r.regime, mealSlot: r.mealSlot, kcal: String(r.kcal),
    difficulty: r.difficulty ?? 'media',
    seasons: r.seasons ?? [],
    ingredients: r.ingredients?.length ? r.ingredients : [{ name: '', qty: null, unit: '' }],
    methods: (r.cookingMethods ?? []).length
      ? (r.cookingMethods ?? []).map((m) => ({ type: m.type, stepsText: (m.steps ?? []).join('\n') }))
      : [{ type: 'veloce', stepsText: '' }],
    active: r.active,
    verified: !!r.verifiedAt,
  };
}

/**
 * Ogni intestazione ordina, e sotto ogni intestazione c'è il suo filtro (richiesta Simone 6/8:
 * col catalogo che cresce — la Keto-Mediterranea da sola porta centinaia di piatti — scorrere
 * l'elenco a occhio non è più un modo di lavorare).
 *
 * I FILTRI girano sul DATABASE (dal 7/8): prima si scaricavano le prime 1000 righe del regime e
 * si filtrava qui, e con le sole ricette vegetariane già oltre quel tetto significava cercare
 * dentro una fetta arbitraria del catalogo — senza dirlo. L'ordinamento resta sulle righe
 * ricevute, e ha senso perché ormai sono il risultato dei filtri, non una fetta a caso.
 * Restano in memoria i filtri DIETA e SETTIMANA: non sono colonne di `Recipe`, il server li calcola
 * dalle giornate (`catalog/utilizzo-ricette.ts`). Hanno preso il posto del filtro TAG, che aveva lo
 * stesso limite e in più cercava dentro etichette che dicono dov'è *nata* la ricetta, non dov'è usata.
 *
 * Per questo la riga dei filtri qui è scritta a mano e non è quella di `useTabella`: i filtri di
 * colonna dell'helper lavorano sulle righe caricate, e qui devono arrivare al database. Dall'helper
 * vengono l'ordinamento, le intestazioni e la paginazione.
 */
const LIMITE_SERVER = 1000;

const emptyFilters = (regime = '') => ({
  name: '', regime, slot: '', kcalMin: '', kcalMax: '', difficulty: '', season: '', stato: '',
  // Dieta e settimana si filtrano sulle righe ricevute: tutti e due i dati arrivano dalle giornate,
  // non sono colonne del database, e Prisma non li sa interrogare. Come prima faceva il filtro Tag —
  // che aveva lo stesso limite e in più cercava dentro un'etichetta che diceva un'altra cosa.
  dieta: '', settimana: '',
  /**
   * ⚠️ **La spunta della nutrizionista**: `''` tutte, `'si'` solo verificate, `'no'` solo da
   * verificare. Sta qui dentro e non in uno stato suo apposta, così «Azzera filtri» la azzera e il
   * contatore la conta fra i filtri attivi — un filtro che nasconde righe e non compare fra quelli
   * attivi è il modo più veloce per far credere che il catalogo sia più piccolo di com'è.
   */
  verificata: '',
});

export function Ricette({ scopeRegime, scopeDietId, scopeDietName }: { scopeRegime?: string; scopeDietId?: string; scopeDietName?: string } = {}) {
  const { permissions } = useAuth();
  const { regimes, regimeLabel } = useTaxonomy();
  const canEdit = permissions?.role === 'nutritionist' || permissions?.role === 'head_nutritionist' || permissions?.role === 'admin';
  const [rows, setRows] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Quello che il salvataggio ha cambiato senza che nessuno lo chiedesse: oggi solo la conferma
   *  allergeni decaduta (voce 252). Vive nella pagina perché la finestra si chiude salvando. */
  const [avvisoSalvataggio, setAvvisoSalvataggio] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const [f, setF] = useState(emptyFilters(scopeRegime ?? ''));
  // Dentro Gestione dieta si parte dalle ricette DELLA dieta aperta. Prima l'elenco era tutto il
  // regime: si vedevano i piatti di altre famiglie sotto il nome di questa dieta (segnalazione
  // Simone 6/8). L'interruttore serve quando devi pescare una ricetta nuova da aggiungere.
  const [soloDieta, setSoloDieta] = useState(true);
  const dietScope = !!scopeDietId && soloDieta;

  // Quante ricette corrispondono ai filtri IN TUTTO il catalogo (non quante ne abbiamo in mano).
  const [totale, setTotale] = useState(0);
  const [troncato, setTroncato] = useState(false);
  /** ⚠️ Falso solo mentre si parla con un server che il filtro «verificate» non ce l'ha ancora. */
  const [serverFiltra, setServerFiltra] = useState(true);

  async function load() {
    setError(null);
    try {
      // I FILTRI VANNO SUL SERVER. Prima si scaricavano le prime 1000 righe del regime e si
      // filtrava qui: con le sole vegetariane già oltre quel tetto, filtrare voleva dire cercare
      // dentro una fetta arbitraria del catalogo. Una ricetta che c'è ma non compare è peggio di
      // un errore: chi cerca conclude che non esiste e la ricrea.
      const params = new URLSearchParams({ includeInactive: 'true' });
      if (scopeRegime) params.set('regime', scopeRegime);
      else if (f.regime) params.set('regime', f.regime);
      if (dietScope) params.set('dietId', scopeDietId as string);
      if (f.name.trim()) params.set('q', f.name.trim());
      if (f.slot) params.set('mealSlot', f.slot);
      if (f.difficulty) params.set('difficulty', f.difficulty);
      if (f.season) params.set('season', f.season);
      if (f.stato) params.set('stato', f.stato);
      if (f.verificata) params.set('verificata', f.verificata);
      if (f.kcalMin.trim()) params.set('kcalMin', f.kcalMin.trim());
      if (f.kcalMax.trim()) params.set('kcalMax', f.kcalMax.trim());
      const r = await api<{ items: Recipe[]; total: number; troncato: boolean; filtroVerificata?: 'si' | 'no' }>(`/recipes?${params.toString()}`);
      setRows(r.items);
      setTotale(r.total);
      setTroncato(r.troncato);
      /**
       * ⛔ **L'ECO: «il filtro l'ho applicato davvero»** — la stessa di `TagAllergeni`, e per lo
       * stesso motivo. Il backoffice si pubblica in un minuto, il backend ci mette di più: in quella
       * finestra la pagina manda `verificata=no` a un server che non lo conosce, riceve tutto il
       * catalogo e scrive «19347 ricette trovate» col pulsante «Solo da verificare» acceso. Un
       * numero sbagliato con la faccia di un numero giusto — e su questo si decide quanto lavoro
       * manca.
       */
      setServerFiltra(f.verificata ? r.filtroVerificata === f.verificata : true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a nutrizionisti e amministratori.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  // Si ricarica a ogni cambio di filtro, con una pausa: chi scrive nel campo nome non deve
  // generare una richiesta per lettera.
  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [scopeRegime, scopeDietId, soloDieta, f.name, f.regime, f.slot, f.difficulty, f.season, f.stato, f.verificata, f.kcalMin, f.kcalMax]);

  async function del(r: Recipe) {
    if (!confirm(`Eliminare la ricetta "${r.name}"?\nL'operazione non è reversibile.`)) return;
    setError(null);
    try {
      await api(`/recipes/${r.id}`, { method: 'DELETE' });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  // Tutti gli altri filtri li ha già applicati il database. Qui restano DIETA e SETTIMANA, che il
  // database non sa interrogare: non sono colonne di `Recipe`, si calcolano dalle giornate. Sulle
  // righe ricevute va bene — e se il risultato è troncato la pagina lo dice, invece di lasciarlo
  // credere.
  const filtrate = useMemo(() => {
    const dieta = f.dieta.trim();
    const settimana = f.settimana.trim();
    let out = rows;
    if (dieta) {
      // «nessuna» = le orfane: nessuna giornata le usa. È la domanda che conta davvero su questa
      // colonna, perché sono piatti pagati, scritti e riletti che nessuna cliente vedrà mai.
      // ⚠️ `utilizzo === null` (il server non è riuscito a leggere le giornate) NON è «nessuna»:
      // quelle righe restano fuori da entrambe le risposte, invece di essere dichiarate orfane.
      out = dieta === 'nessuna'
        ? out.filter((r) => r.utilizzo != null && r.utilizzo.length === 0)
        : out.filter((r) => dieteDi(r).includes(dieta));
    }
    if (settimana) {
      // Con anche il filtro Dieta attivo, la settimana si guarda DENTRO quella dieta. Senza, «Dieta
      // = Keto» + «Settimana = 1» elencherebbe una ricetta che sta nella settimana 1 della
      // Mediterranea e nella 3 della Keto: due verità separate lette come una frase sola, falsa.
      const settimaneDa = (r: Recipe): number[] | null =>
        dieta && dieta !== 'nessuna'
          ? (r.utilizzo ?? []).find((u) => u.dieta === dieta)?.settimane ?? []
          : r.settimane ?? null;
      out = settimana === 'nessuna'
        // Le orfane: generate e fuori dal ciclo. Vederle è il modo di sapere quanto lavoro pagato
        // sta lì senza servire a nessuna cliente.
        ? out.filter((r) => { const w = settimaneDa(r); return w != null && w.length === 0; })
        : out.filter((r) => (settimaneDa(r) ?? []).includes(Number(settimana)));
    }
    return out;
  }, [rows, f.dieta, f.settimana]);

  /**
   * Le settimane e le diete che esistono davvero fra queste righe: le tendine non offrono scelte
   * che non selezionano niente.
   *
   * ⚠️ Il valore **scelto** ci sta dentro comunque. Le righe arrivano dal server e cambiano a ogni
   * ricerca: filtrando per «Vegana» e poi scrivendo un nome che non compare in nessuna ricetta
   * vegana, «Vegana» sparirebbe dalle opzioni — e un `<select>` il cui valore non è fra le opzioni
   * si disegna **vuoto**. Si leggerebbe «Tutte» mentre il filtro sta ancora togliendo tutto.
   */
  const settimanePresenti = useMemo(() => {
    const viste = new Set(rows.flatMap((r) => r.settimane ?? []));
    const scelta = Number(f.settimana);
    if (f.settimana && f.settimana !== 'nessuna' && Number.isFinite(scelta)) viste.add(scelta);
    return [...viste].sort((a, b) => a - b);
  }, [rows, f.settimana]);

  const dietePresenti = useMemo(() => {
    const viste = new Set(rows.flatMap(dieteDi));
    if (f.dieta && f.dieta !== 'nessuna') viste.add(f.dieta);
    return [...viste].sort((a, b) => a.localeCompare(b, 'it'));
  }, [rows, f.dieta]);

  const COLONNE: Colonna<Recipe>[] = [
    { chiave: 'name', titolo: 'Nome', valore: (r) => r.name },
    { chiave: 'regime', titolo: 'Regime', valore: (r) => regimeLabel(r.regime) },
    // Il posto nella giornata, non l'etichetta: in alfabetico verrebbe «Cena, Colazione, Merenda»,
    // corretto e inutile. Nel file Excel va invece l'etichetta: `esporta` esiste per questo.
    { chiave: 'mealSlot', titolo: 'Pasto', valore: (r) => SLOTS.indexOf(r.mealSlot), esporta: (r) => SLOT[r.mealSlot] ?? r.mealSlot },
    { chiave: 'kcal', titolo: 'Kcal', valore: (r) => r.kcal },
    // Il posto nella scala (semplice → media → elaborata): in alfabetico «Elaborata» sarebbe la prima.
    { chiave: 'difficulty', titolo: 'Difficoltà', valore: (r) => DIFFICULTIES.indexOf(r.difficulty ?? 'media'), esporta: (r) => DIFFICULTY[r.difficulty ?? 'media'] ?? 'Media' },
    { chiave: 'seasons', titolo: 'Stagioni', valore: (r) => seasonsText(r.seasons) },
    // DIETA — quali diete usano davvero questa ricetta, letto dalle giornate dal server.
    // Ha preso il posto della colonna Tag (richiesta di Simone, 11/8). Il tag `dieta:<nome>` che si
    // leggeva lì diceva un'altra cosa: per quale famiglia la ricetta era stata *generata*, un dato
    // che non cambia mai più nemmeno quando un'altra dieta la riusa. Qui i nomi sono più d'uno
    // quando il piatto è condiviso — che è il fatto da vedere, non un caso da nascondere.
    {
      chiave: 'dieta',
      titolo: 'Dieta',
      valore: (r) => dieteDi(r).join(', '),
      esporta: (r) => (r.utilizzo == null ? 'non letto' : r.utilizzo.length ? dieteDi(r).join(', ') : 'nessuna'),
    },
    // SETTIMANA — si ordina sulla PRIMA settimana in cui compare, che è quella che conta per capire
    // dov'è finita. Nel file ci vanno tutte, perché lì la domanda è «in quante settimane gira».
    {
      chiave: 'settimana',
      titolo: 'Settimana n.',
      valore: (r) => (r.settimane ?? [])[0] ?? null,
      // Una sola settimana esce come NUMERO, non come «2»: scritta come testo, Excel ci mette il
      // triangolino verde e ordina la colonna in alfabetico («1», «10», «2»). Ed è il caso più
      // frequente: quasi tutte le ricette girano in una settimana sola.
      esporta: (r) => {
        const w = r.settimane;
        if (w == null) return 'non letto';
        return w.length === 0 ? 'fuori dal ciclo' : w.length === 1 ? w[0] : w.join(', ');
      },
    },
    // Le attive prima: come etichetta «Archiviata» starebbe davanti ad «Attiva».
    { chiave: 'active', titolo: 'Stato', valore: (r) => (r.active ? 0 : 1), esporta: (r) => (r.active ? 'Attiva' : 'Archiviata') },
    // La colonna dei pulsanti c'è solo per chi può modificare: come la cella, sotto.
    ...(canEdit ? [{ chiave: 'azioni', titolo: '' } as Colonna<Recipe>] : []),
  ];

  // Nome del file esportato: dice da dove vengono le righe, perché un «ricette.xlsx» sulla
  // scrivania fra un mese non ricorda se era il catalogo di una dieta o quello di tutto il regime.
  const nomeExcel = dietScope && scopeDietName
    ? `Ricette ${scopeDietName}`
    : scopeRegime ? `Ricette ${regimeLabel(scopeRegime)}` : 'Ricette';

  // Il server manda le ricette in ordine alfabetico, ed è l'ordine con cui la pagina si apre.
  const t = useTabella(filtrate, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'name', direzione: 'asc' }, nomeExcel });
  const filtriAttivi = JSON.stringify(f) !== JSON.stringify(emptyFilters(scopeRegime ?? ''));

  /**
   * Se il server ha tagliato a mille righe, l'esportazione lo chiede prima di partire.
   *
   * Il file uscirebbe con una parte del catalogo e nessuno, guardandolo, potrebbe accorgersene: un
   * foglio di calcolo non ha un banner che avvisa. È lo stesso difetto che i filtri lato server
   * hanno risolto a giugno — una ricetta che c'è ma non compare fa concludere che non esista.
   *
   * ⚠️ Il numero da dire è quello che **esce davvero** (`t.conteggio.mostrate`), non il tetto del
   * server: i filtri Tag e Settimana lavorano in memoria e restringono ancora, quindi «il file ne
   * conterrà 1000» sarebbe falso ogni volta che uno dei due è attivo. Un avviso che sbaglia il
   * numero fa più danno del silenzio, perché lo si crede.
   */
  const avvisoExport = troncato
    ? `Questa pagina ha ricevuto dal server solo le prime ${LIMITE_SERVER} ricette delle ${totale} che rispondono ai filtri.\n\nIl file conterrà le ${t.conteggio.mostrate} righe che vedi, scelte fra quelle ${LIMITE_SERVER} — non fra tutte e ${totale}.\n\nPer essere sicuro di averle tutte, restringi prima con un filtro. Scarico lo stesso?`
    : undefined;

  // `t.stileFiltri` incolla la riga dei filtri sotto i titoli quando la tabella scorre. Questa riga
  // è scritta a mano (i filtri vanno al database, non all'helper), quindi lo stile va chiesto:
  // senza, i titoli restavano in alto e i filtri no, e per cambiarne uno si tornava in cima.
  const filterCell = (node: React.ReactNode) => <th style={{ padding: '6px 8px', fontWeight: 400, ...t.stileFiltri }}>{node}</th>;
  const sel = { padding: '4px 6px', fontSize: 12, width: '100%' } as const;
  const inp = { padding: '4px 6px', fontSize: 12, width: '100%' } as const;

  if (loading) return <Spinner />;

  return (
    <>
      {scopeDietId && (
        <div className="spread" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn ${soloDieta ? '' : 'ghost'} sm`} onClick={() => setSoloDieta(true)}>
              <i className="ti ti-tools-kitchen-2" /> Solo questa dieta
            </button>
            <button className={`btn ${soloDieta ? 'ghost' : ''} sm`} onClick={() => setSoloDieta(false)}>
              <i className="ti ti-list" /> Tutto il regime{scopeRegime ? ` · ${regimeLabel(scopeRegime)}` : ''}
            </button>
          </div>
        </div>
      )}

      <div className="spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        {/* Contatore e comandi in un `.row`, come nelle altre due schede di Gestione dieta: prima il
            pulsante «Azzera filtri» stava dentro lo `<span>` del testo e si allineava alla baseline
            di un carattere da 13px, andando a capo come se fosse una parola della frase. */}
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {/* `totale` è il conteggio VERO sul database, non quante righe abbiamo in mano: quando
                il server tronca, questo numero è più grande di quello che esce dall'esportazione, e
                infatti in quel caso il pulsante lo dice prima di scaricare (`avvisoExport`). */}
            {filtriAttivi ? <><b>{t.conteggio.mostrate}</b> ricette trovate</> : <><b>{totale}</b> ricette</>}
          </span>
          {/*
              ⚠️ **DUE PULSANTI, NON UNO** (Simone, 4/9: «il pulsante che mostra e nasconde quelle
              verificate»). Un solo interruttore avrebbe due stati — tutte / solo verificate — e la
              domanda che si fa davvero mentre si verifica un catalogo è l'altra: *quali mancano*.
              Con due, il secondo clic sullo stesso pulsante torna a «tutte», come nella pagina
              Panieri: nessuno stato in cui si è entrati e non si sa come uscire.
          */}
          <div className="row" style={{ gap: 4 }}>
            <button
              className={`btn ${f.verificata === 'si' ? '' : 'ghost'} sm`}
              onClick={() => setF({ ...f, verificata: f.verificata === 'si' ? '' : 'si' })}
              title="Solo le ricette con la spunta della nutrizionista"
            >
              <i className="ti ti-rosette-discount-check" /> Solo verificate
            </button>
            <button
              className={`btn ${f.verificata === 'no' ? '' : 'ghost'} sm`}
              onClick={() => setF({ ...f, verificata: f.verificata === 'no' ? '' : 'no' })}
              title="Solo le ricette che la spunta non ce l'hanno ancora"
            >
              <i className="ti ti-rosette-discount-check-off" /> Solo da verificare
            </button>
          </div>
          {filtriAttivi && (
            <button className="btn ghost sm" onClick={() => { setF(emptyFilters(scopeRegime ?? '')); t.azzera(); }}>
              <i className="ti ti-filter-off" /> Azzera filtri
            </button>
          )}
          <BottoneExcel tabella={t} avviso={avvisoExport} />
        </div>
        {canEdit && <button className="btn" onClick={() => setEditing('new')}><i className="ti ti-plus" /> Nuova ricetta</button>}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {!serverFiltra && (
        <Banner kind="warn">
          Il filtro <b>verificate</b> non è arrivato al server: quello che vedi è il catalogo intero,
          non la selezione. Succede per qualche minuto durante un rilascio — ricarica fra poco.
        </Banner>
      )}
      {/* La conferma allergeni decaduta dopo una modifica degli ingredienti (voce 252): sta qui e
          non nella finestra, perché il salvataggio la chiude. */}
      {avvisoSalvataggio && <Banner kind="info">{avvisoSalvataggio}</Banner>}
      <GeneratoreWidget />
      {scopeDietId && !soloDieta && (
        <Banner kind="info">
          Stai vedendo <b>tutte</b> le ricette del regime, non solo quelle di
          {scopeDietName ? <> <b>{scopeDietName}</b></> : ' questa dieta'}: le ricette non appartengono a una
          dieta, sono le giornate a richiamarle, e la stessa ricetta può stare in più famiglie.
          <b> Se ne modifichi o cancelli una, cambia ovunque venga usata.</b>
        </Banner>
      )}
      {troncato && (
        <Banner kind="info">
          I filtri girano sul catalogo intero e trovano <b>{totale}</b> ricette: qui ne vedi le prime{' '}
          {LIMITE_SERVER} in ordine alfabetico. Restringi con un filtro per arrivare a quella che cerchi
          — nessuna ricetta è nascosta, è solo un elenco lungo.
          {(f.dieta.trim() || f.settimana.trim()) && <> ⚠️ I filtri <b>Dieta</b> e <b>Settimana n.</b> però
          lavorano solo su queste {LIMITE_SERVER}: per usarli con sicurezza restringi prima con un
          altro filtro.</>}
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        {/*
          Il selettore di pagina anche SOPRA la tabella (richiesta di Simone, 11/8).
          Con cento righe per pagina, per cambiare pagina bisognava scorrere fino in fondo e poi
          risalire per rileggere le intestazioni: due scorrimenti interi per ogni pagina, e questa
          è la schermata su cui il nutrizionista passa le ore quando rivede un catalogo.
          È lo stesso `<Pager>` collegato allo stesso stato, quindi i due restano d'accordo da soli,
          e spariscono entrambi quando la pagina è una sola.
        */}
        <Pager {...t.pager} sopra />
        {rows.length === 0 ? (
          <div className="empty">
            {dietScope
              ? 'Questa dieta non ha ancora ricette nelle sue giornate. Con “Tutto il regime” vedi il catalogo da cui pescarle.'
              : 'Nessuna ricetta.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {/* Riga dei filtri scritta a mano: questi filtri vanno al database, non all'helper. */}
              <tr>
                {filterCell(
                  <input className="input" style={inp} placeholder="Cerca…" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.regime} onChange={(e) => setF({ ...f, regime: e.target.value })} disabled={!!scopeRegime}>
                    <option value="">Tutti</option>
                    {regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>
                    <option value="">Tutti</option>
                    {SLOTS.map((s) => <option key={s} value={s}>{SLOT[s]}</option>)}
                  </select>,
                )}
                {filterCell(
                  <div className="row" style={{ gap: 4 }}>
                    <input className="input" style={{ ...inp, width: 54 }} inputMode="numeric" placeholder="min" value={f.kcalMin} onChange={(e) => setF({ ...f, kcalMin: e.target.value })} />
                    <input className="input" style={{ ...inp, width: 54 }} inputMode="numeric" placeholder="max" value={f.kcalMax} onChange={(e) => setF({ ...f, kcalMax: e.target.value })} />
                  </div>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
                    <option value="">Tutte</option>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY[d]}</option>)}
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })}>
                    <option value="">Tutte</option>
                    {SEASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    <option value="none">Tutto l'anno</option>
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.dieta} onChange={(e) => setF({ ...f, dieta: e.target.value })} title="Quali diete usano questa ricetta">
                    <option value="">Tutte</option>
                    {dietePresenti.map((d) => <option key={d} value={d}>{d}</option>)}
                    <option value="nessuna">— nessuna (orfane) —</option>
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.settimana} onChange={(e) => setF({ ...f, settimana: e.target.value })} title="In quale settimana del ciclo è usata">
                    <option value="">Tutte</option>
                    {settimanePresenti.map((n) => <option key={n} value={String(n)}>Settimana {n}</option>)}
                    <option value="nessuna">— fuori dal ciclo —</option>
                  </select>,
                )}
                {filterCell(
                  <select className="select" style={sel} value={f.stato} onChange={(e) => setF({ ...f, stato: e.target.value })}>
                    <option value="">Tutti</option>
                    <option value="active">Attiva</option>
                    <option value="archived">Archiviata</option>
                  </select>,
                )}
                {canEdit && <th style={t.stileFiltri}></th>}
              </tr>
            </thead>
            <tbody>
              {t.conteggio.mostrate === 0 ? (
                <tr><td colSpan={COLONNE.length}><div className="empty" style={{ padding: '18px 0' }}>Nessuna ricetta con questi filtri.</div></td></tr>
              ) : t.pagina.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)} style={{ cursor: 'pointer' }} title="Apri la ricetta">
                  {/* ⚠️ Il segno sulla riga, non solo il filtro: senza, tolto il filtro non si
                      distingue più una verificata da una no, e il pulsante diventa l'unico modo di
                      saperlo — cioè si vede una cosa per volta e mai le due insieme. */}
                  <td>
                    {r.name}
                    {r.verifiedAt && (
                      <i
                        className="ti ti-rosette-discount-check"
                        style={{ marginLeft: 6, color: 'var(--ok-ink)' }}
                        title={`Verificata${r.verifiedByName ? ` da ${r.verifiedByName}` : ''} il ${new Date(r.verifiedAt).toLocaleDateString('it-IT')}`}
                      />
                    )}
                  </td>
                  <td className="muted">{regimeLabel(r.regime)}</td>
                  <td className="muted">{SLOT[r.mealSlot] ?? r.mealSlot}</td>
                  <td className="muted">{r.kcal}</td>
                  <td><span className={`chip ${r.difficulty === 'semplice' ? 'green' : 'gray'}`}>{DIFFICULTY[r.difficulty ?? 'media'] ?? 'Media'}</span></td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                    {(r.seasons ?? []).length === 0
                      ? <span style={{ opacity: 0.6 }}>Tutto l'anno</span>
                      : (r.seasons ?? []).map((s) => <span key={s} className="chip gray" style={{ marginRight: 4 }}>{SEASON_LABEL[s] ?? s}</span>)}
                  </td>
                  <td className="muted">
                    {r.utilizzo == null
                      ? <span className="muted" title="Non è stato possibile leggere le giornate: non vuol dire che non sia usata">—</span>
                      : r.utilizzo.length === 0
                        ? <span className="chip gray" title="Nessuna giornata la usa: è una ricetta orfana">nessuna</span>
                        // Su ogni dieta, in che settimane sta: così «Dieta» e «Settimana n.» non si
                        // leggono come una frase sola quando le diete sono più d'una.
                        : r.utilizzo.map((u) => (
                          <span key={u.dieta} className="chip gray" style={{ marginRight: 4 }} title={`Settimana ${u.settimane.join(', ')}`}>{u.dieta}</span>
                        ))}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.settimane == null
                      ? <span className="muted" title="Non è stato possibile leggere le giornate">—</span>
                      : r.settimane.length === 0
                        ? <span className="chip gray" title="Nessuna giornata la usa: è fuori dal ciclo">fuori dal ciclo</span>
                        : r.settimane.map((n) => <span key={n} className="chip" style={{ marginRight: 4 }}>{n}</span>)}
                  </td>
                  <td><span className={`chip ${r.active ? '' : 'gray'}`}>{r.active ? 'Attiva' : 'Archiviata'}</span></td>
                  {canEdit && (
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setEditing(r); }}><i className="ti ti-edit" /> Modifica</button>
                        {canEdit && <button className="btn ghost sm" title="Elimina ricetta" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); del(r); }}><i className="ti ti-trash" /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>

      {editing && (
        <RecipeModal
          recipe={editing === 'new' ? null : editing}
          defaultRegime={scopeRegime}
          onClose={() => setEditing(null)}
          onSaved={(avviso) => { setEditing(null); setAvvisoSalvataggio(avviso ?? null); void load(); }}
        />
      )}
    </>
  );
}

/**
 * «IL GENERATORE STA LAVORANDO?» — richiesta di Simone, 18/8: «non ho capito da dove vedo se le
 * ricette vengono create».
 *
 * ⚠️ Sta QUI, in cima alle Ricette, e non in una diagnostica da shell: una diagnostica che nessuno
 * lancia è una diagnostica che non esiste. Le stesse informazioni di `npm run diag:catalogo`, dove
 * si guardano già.
 *
 * ⚠️ E NON sparisce quando è tutto a posto, a differenza degli altri riquadri di questo progetto.
 * La domanda a cui risponde è «sta lavorando?», e un riquadro che compare solo quando c'è un
 * problema risponde «non lo so» proprio nel caso in cui uno viene a controllare.
 */
interface StatoGeneratore {
  verdetto: 'mai_partito' | 'lavora' | 'niente_da_fare' | 'errore' | 'fermo';
  messaggio: string;
  oreFa: number | null;
  giorni: number;
  giri: number;
  errori: number;
  ricetteNate: number;
  ricetteDaConfermare: number;
  /** Quante ne aspettano in TUTTO: è il numero che si trova aprendo la pagina Allergeni. */
  ricetteDaConfermareInTutto?: number;
  restano: number;
}

function GeneratoreWidget() {
  const [s, setS] = useState<StatoGeneratore | null>(null);
  const [rotto, setRotto] = useState(false);

  useEffect(() => {
    let vivo = true;
    api<StatoGeneratore>('/engine-rules/generatore')
      .then((r) => { if (vivo) setS(r); })
      // ⚠️ Un errore qui non deve far sembrare rotta la pagina delle ricette: si dice piano.
      .catch(() => { if (vivo) setRotto(true); });
    return () => { vivo = false; };
  }, []);

  if (rotto) {
    return (
      <div className="card" style={{ borderLeft: '3px solid var(--line)' }}>
        <span className="muted" style={{ fontSize: 12.5 }}>
          <i className="ti ti-robot" /> Il generatore: stato non leggibile in questo momento. Le ricette qui sotto ci sono comunque.
        </span>
      </div>
    );
  }
  if (!s) return null;

  const grave = s.verdetto === 'mai_partito' || s.verdetto === 'errore' || s.verdetto === 'fermo';
  return (
    <div className="card" style={{ borderLeft: `3px solid ${grave ? 'var(--warm, #B0663F)' : 'var(--teal)'}` }}>
      <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <i className="ti ti-robot" style={{ color: grave ? 'var(--warm, #B0663F)' : 'var(--teal)' }} />
        <b style={{ fontSize: 13.5 }}>Il generatore di ricette</b>
        <span style={{ fontSize: 13 }}>{grave ? '⚠️ ' : ''}{s.messaggio}</span>
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
        Negli ultimi {s.giorni} giorni: <b>{s.ricetteNate}</b> ricette nuove
        {(s.ricetteDaConfermareInTutto ?? s.ricetteDaConfermare) > 0 && (
          <>
            {' '}(<b>{s.ricetteDaConfermareInTutto ?? s.ricetteDaConfermare}</b> aspettano gli allergeni →{' '}
            {/* ⚠️ Il collegamento c'è perché finché una ricetta è lì NON entra in nessuna dieta: un
                catalogo che cresce con una coda ferma è un catalogo che cresce e non serve a nessuno.
                ⚠️ Il numero è quello TOTALE e non quello dei sette giorni: la pagina dall'altra parte
                non filtra per data, e un collegamento deve promettere il numero che si trova
                arrivandoci (19/8, segnalazione del nutrizionista). */}
            <Link to="/tag-allergeni">Allergeni ricette</Link>)
          </>
        )}
        {' · '}{s.giri} giri{s.errori > 0 && <>, di cui <b>{s.errori} in errore</b></>}
        {' · '}{s.restano === 0 ? 'catalogo completo' : <>restano <b>{s.restano}</b> settimane da riempire</>}
      </div>
    </div>
  );
}

/**
 * ⚠️ **Esportato il 24/8** perché lo apre anche «Allergeni ricette»: la nutrizionista che sta per
 * confermare gli allergeni deve poter correggere il piatto senza cambiare pagina (richiesta di
 * Simone). Restava privato di questo file e non lo usava nessun altro.
 */
export function RecipeModal({ recipe, defaultRegime, defaultSlot, contesto = 'catalogo', onClose, onSaved }: {
  recipe: Recipe | null;
  defaultRegime?: string;
  /**
   * ⚠️ Il pasto già scelto da chi apre la finestra. Serve a «Scrivi menu a mano», che la apre stando
   * dentro uno slot preciso: proporre «pranzo» a chi sta riempiendo la colazione è farlo sbagliare
   * su un campo che aveva già deciso prima di aprire.
   */
  defaultSlot?: string;
  /**
   * Da dove è stato aperto. ⚠️ Serve a una cosa sola, e non è cosmesi: l'avviso della conferma
   * allergeni decaduta diceva «ricontrolla gli allergeni in «Allergeni ricette»», e detto **dentro**
   * quella pagina manda qualcuno a cercare il posto dove si trova già.
   */
  contesto?: 'catalogo' | 'allergeni' | 'menu';
  onClose: () => void;
  /** ⚠️ `creata` arriva solo quando la ricetta è appena NATA: serve a chi la vuole usare subito. */
  onSaved: (avviso?: string | null, creata?: Recipe) => void;
}) {
  const { regimes, cookingMethods } = useTaxonomy();
  const [f, setF] = useState<Form>(recipe ? toForm(recipe) : emptyForm(defaultRegime, defaultSlot));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /**
   * ⛔ **UNA RICETTA NUOVA CHE NON STA IN NESSUN PANIERE NON ARRIVA A NESSUNO.**
   *
   * Simone, 4/9: *«ovviamente mi chiederà anche in quali panieri metterla»*. Fino a oggi «Nuova
   * ricetta» salvava e chiudeva: la ricetta entrava in catalogo e **il motore non la pescava mai**,
   * perché con `panieri_sorgente_pool` è il paniere a decidere cosa arriva nel piatto. Chi l'aveva
   * appena scritta la ritrovava «da nessuna parte» senza nessun errore — il silenzio peggiore.
   *
   * ⛔ **E LA CATENA HA DUE ANELLI, non uno** — trovato da una revisione avversariale il 4/9, sulla
   * prima stesura di questo stesso passo. Una ricetta appena creata nasce con
   * `allergensReviewed: false`, e `InQualiPanieri` in quel caso è **bloccata**: la prima versione
   * mostrava un pannello che diceva «scegli dove metterla» sopra un elenco che non compariva mai.
   * Un passo che chiede un gesto impossibile è peggio del passo che non c'è.
   *
   * ⚠️ Quindi prima gli **allergeni** (la stessa finestra di «Allergeni ricette», traslocata in
   * `components/` apposta), e solo dopo i **panieri**. È la catena vera del prodotto: senza
   * allergeni confermati un piatto non entra nei menu, ed è un cancello di sicurezza, non un
   * passaggio burocratico da saltare.
   */
  const [creata, setCreata] = useState<Recipe | null>(null);
  /** ⚠️ Sale a `true` quando gli allergeni della ricetta appena creata sono stati confermati qui. */
  const [allergeniFatti, setAllergeniFatti] = useState(false);

  function setIng(i: number, patch: Partial<Ingredient>) {
    setF((s) => ({ ...s, ingredients: s.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }
  function setMet(i: number, patch: Partial<FormMethod>) {
    setF((s) => ({ ...s, methods: s.methods.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }

  async function save() {
    setErr(null);
    const kcal = Number(f.kcal);
    if (f.name.trim().length < 2) { setErr('Dai un nome alla ricetta.'); return; }
    if (!Number.isFinite(kcal) || kcal < 30 || kcal > 2000) { setErr('Le kcal devono essere tra 30 e 2000.'); return; }
    const ingredients = f.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), ...(i.qty != null && String(i.qty) !== '' ? { qty: Number(i.qty) } : {}), ...(i.unit?.trim() ? { unit: i.unit.trim() } : {}) }));
    if (ingredients.length === 0) { setErr('Aggiungi almeno un ingrediente.'); return; }
    const cookingMethods = f.methods
      .map((m) => ({ type: m.type, steps: m.stepsText.split('\n').map((s) => s.trim()).filter(Boolean) }))
      .filter((m) => m.steps.length > 0);
    /**
     * ⚠️ `tags` NON è nel corpo, ed è deliberato.
     *
     * `updateRecipe` scrive i tag solo se arrivano (`if (dto.tags !== undefined)`), quindi non
     * mandarli vuol dire **non toccarli**. Prima il campo di testo libero conteneva anche i tag con
     * prefisso, e ogni salvataggio riscriveva l'array intero: bastava cancellare `dieta:Pescetariana`
     * senza accorgersene e il generatore non ritrovava più quella ricetta fra le orfane — così
     * ricomprava dall'AI un piatto che esisteva già, senza nessun errore. Ora da qui non si possono
     * più rompere.
     */
    /**
     * ⚠️ `verified` si manda **solo quando è cambiato**. `updateRecipe` non tocca la spunta se il
     * campo non arriva, ed è quello che serve: mandarla sempre vorrebbe dire che chi apre una
     * ricetta verificata, corregge un refuso e salva, la **ri-firma** con il proprio nome senza
     * averla guardata. La firma deve restare di chi l'ha data.
     */
    const verificaCambiata = !recipe || f.verified !== !!recipe.verifiedAt;
    const body = { name: f.name.trim(), regime: f.regime, mealSlot: f.mealSlot, kcal, ingredients, cookingMethods, difficulty: f.difficulty, seasons: f.seasons, active: f.active, ...(verificaCambiata ? { verified: f.verified } : {}) };

    setBusy(true);
    try {
      /**
       * ⚠️ La risposta del PATCH si LEGGE (18/8, voce 252). Da oggi cambiare gli ingredienti fa
       * decadere la conferma degli allergeni — cioè toglie la ricetta dai menu nuovi — e chi ha
       * appena salvato deve saperlo. Una conseguenza che chi la provoca non vede è la stessa
       * famiglia di difetti che stiamo togliendo da settimane.
       *
       * Il messaggio lo mostra la PAGINA e non questa finestra, perché il salvataggio la chiude:
       * un avviso dentro una finestra che si sta chiudendo non lo legge nessuno.
       */
      let avviso: string | null = null;
      if (recipe) {
        const r = await api<{ confermaAllergeniDecaduta?: boolean; pastoCambiato?: string | null }>(
          `/recipes/${recipe.id}`, { method: 'PATCH', body: JSON.stringify(body) },
        );
        /**
         * ⛔ **Il cambio di pasto sposta le righe di paniere, e chi salva non lo vede** (4/9).
         * `Recipe.mealSlot` e `PaniereRicetta.slot` sono due colonne diverse: la scheda mostra il
         * campo cambiato, non le celle che si sono mosse — o che si sono **svuotate**, se il piatto
         * in quel pasto non ci può stare. Una conseguenza che chi la provoca non vede è la famiglia
         * di difetti che questo progetto toglie da settimane.
         */
        if (r?.pastoCambiato) avviso = avviso ? `${avviso}\n\n${r.pastoCambiato}` : r.pastoCambiato;
        /**
         * ⛔ **Si SOMMA, non sostituisce** — corretto il 4/9 da una revisione avversariale. Questo
         * ramo assegnava, e cancellava la frase sui panieri appena scritta due righe sopra: chi
         * correggeva gli ingredienti **e** spostava il pasto nello stesso salvataggio vedeva solo
         * l'avviso degli allergeni, e le righe di paniere si muovevano in silenzio. Sono due
         * conseguenze diverse dello stesso «Salva», e vanno dette tutte e due.
         */
        if (r?.confermaAllergeniDecaduta) {
          const allergeni =
            `«${body.name}»: hai cambiato gli ingredienti, quindi la conferma degli allergeni non ` +
            'vale più — era stata data su un piatto diverso. ⚠️ Da adesso la ricetta NON entra nei ' +
            'menu nuovi ' +
            (contesto === 'allergeni'
              ? 'e la riga qui sotto è tornata «Da rivedere»: ricontrolla gli allergeni e conferma.'
              : 'finché non ricontrolli gli allergeni in «Allergeni ricette».') +
            ' I menu già consegnati non cambiano.';
          avviso = avviso ? `${allergeni}\n\n${avviso}` : allergeni;
        }
      } else {
        /**
         * ⚠️ La risposta del POST si legge: è la ricetta appena nata, con il suo id. Senza,
         * il secondo passo non saprebbe a quale ricetta attaccare i panieri, e chi ha aperto
         * questa finestra da «Scrivi menu a mano» non potrebbe metterla nel pasto.
         */
        const nata = await api<Recipe>('/recipes', { method: 'POST', body: JSON.stringify(body) });
        if (nata?.id) { setCreata(nata); setBusy(false); return; }
      }
      onSaved(avviso);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * ⛔ **IL SECONDO PASSO: dove va a finire questa ricetta.** Vedi `creata` sopra per il perché.
   *
   * ⚠️ La riga in cima **non** dice «salvata con successo»: dice cosa manca ancora perché quel
   * piatto arrivi a qualcuno. Un messaggio di successo davanti a una ricetta che nessuna cliente
   * riceverà mai è la bugia più facile da scrivere.
   */
  if (creata && !allergeniFatti && !creata.allergensReviewed) {
    return (
      <AllergeniModal
        recipe={creata}
        /**
         * ⚠️ **Chiudere qui NON annulla la ricetta**: è già in catalogo, il POST è andato. Si esce
         * dalla catena, e la riga qui sotto lo dice a chi l'ha aperta invece di lasciarlo credere
         * che «Annulla» abbia annullato qualcosa.
         */
        onClose={() => onSaved(
          `«${creata.name}» è in catalogo, ma gli allergeni non sono confermati: finché non lo sono `
          + 'non entra in nessun paniere e nessuna cliente la riceve. Si fa da «Allergeni ricette».',
        )}
        onSaved={() => setAllergeniFatti(true)}
      />
    );
  }

  if (creata) {
    return (
      /**
       * ⛔ **CHIUDERE NON È «FINE»** — trovato da una revisione avversariale il 4/9.
       *
       * `Modal` non ha una X: si chiude cliccando **fuori**, e quel clic chiamava `onSaved(…,
       * creata)` esattamente come il pulsante. Da «Scrivi menu a mano» voleva dire che chiudere la
       * finestra **sostituiva il piatto già scelto** per quel pasto, motivazione della forzatura
       * compresa, senza una conferma e senza un messaggio: lavoro scritto perso con un clic fuori
       * bersaglio.
       *
       * ⚠️ Ora la ricetta la si porta via **solo** dal pulsante, che dice cosa fa. Chiudendo, la
       * ricetta resta in catalogo — è già salvata — e il pasto non si tocca.
       */
      <Modal title="In quali panieri?" onClose={() => onSaved(null)}>
        {/*
          ⚠️ **La riga non ORDINA un gesto**, e la differenza non è di tono: un paniere può essere
          impossibile per questa ricetta — un piatto di carne per una colazione, per dirne una — e
          in quel caso il pannello qui sotto non mostra niente da scegliere, solo il motivo. Una
          riga che dice «scegli dove metterla» sopra un elenco vuoto è la stessa specie di guasto
          che il passo allergeni esiste per togliere.
        */}
        <Banner kind="info">
          <b>«{creata.name}»</b> è in catalogo{allergeniFatti ? ' e gli allergeni sono confermati' : ''}.
          ⚠️ Finché non sta in un paniere il motore non la pesca per nessuna cliente. Qui sotto ci
          sono i panieri in cui può andare — o il motivo per cui non può andare in nessuno.
          {contesto === 'menu' && (
            <> Nel menu che stai scrivendo a mano ci va comunque: quello lo decidi tu, non il motore.</>
          )}
        </Banner>
        {/* ⚠️ Non si porta avanti nessuno stato: `InQualiPanieri` rilegge da `/panieri/ricetta/:id`,
            e il server ricalcola `bloccata` sulla ricetta vera — che gli allergeni li ha appena
            ricevuti davvero, con un PATCH. Passarglielo nel prop sarebbe un doppione che un giorno
            dice il contrario del database. */}
        <InQualiPanieri recipe={creata} />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          {/* ⚠️ L'etichetta dice cosa succede, e da «Scrivi menu a mano» succede una cosa in più. */}
          <button className="btn" onClick={() => onSaved(null, creata)}>
            {contesto === 'menu' ? 'Metti nel pasto' : 'Fine'}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={recipe ? 'Modifica ricetta' : 'Nuova ricetta'} onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <label style={{ gridColumn: '1 / -1' }}><span className="muted" style={{ fontSize: 12 }}>Nome</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Es. Farro, pollo e verdure" /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Regime</span>
          <select className="select" value={f.regime} onChange={(e) => setF({ ...f, regime: e.target.value })}>{regimes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}</select></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Pasto</span>
          <select className="select" value={f.mealSlot} onChange={(e) => setF({ ...f, mealSlot: e.target.value })}>{SLOTS.map((s) => <option key={s} value={s}>{SLOT[s]}</option>)}</select></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Kcal</span>
          <input className="input" inputMode="numeric" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} placeholder="480" /></label>
        <label><span className="muted" style={{ fontSize: 12 }}>Difficoltà</span>
          <select className="select" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY[d]}</option>)}</select></label>
        {/* Stagionalità (voce #11): nessuna spunta = il piatto va bene tutto l'anno.
            Fuori stagione la ricetta viene penalizzata nella scelta, non esclusa. */}
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Stagioni <span className="muted" style={{ fontWeight: 400 }}>— nessuna spunta = tutto l'anno. Fuori stagione il piatto viene proposto meno, non escluso.</span></span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
            {SEASONS.map(([val, lbl]) => {
              const on = f.seasons.includes(val);
              return (
                <button
                  type="button"
                  key={val}
                  className={on ? 'btn sm' : 'btn ghost sm'}
                  onClick={() => setF({ ...f, seasons: on ? f.seasons.filter((x) => x !== val) : [...f.seasons, val] })}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </label>
      </div>

      {/* Ingredienti */}
      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 13 }}>Ingredienti</b>
        {/*
          ⚠️ LA CONVENZIONE SI DICE A CHI SCRIVE, non solo a chi legge (19/8, decisione di Simone).
          La stessa riga compare nell'app sotto gli ingredienti della scheda: se qui non ci fosse,
          la convenzione varrebbe per la cliente e non per chi riempie il campo — e le grammature
          scritte a cotto arriverebbero nel piatto moltiplicate per tre senza che nessuno lo dica.
        */}
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          ⚠️ Le grammature si scrivono <b>a crudo</b>, come nei libri di cucina — è quello che legge
          la cliente nella scheda, ed è la base con cui si calcolano le calorie.
        </div>
        {f.ingredients.map((ing, i) => (
          <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}>
            <input className="input" style={{ flex: 2 }} placeholder="Nome" value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} />
            <input className="input" style={{ flex: 1, minWidth: 0 }} inputMode="decimal" placeholder="Qtà" value={ing.qty ?? ''} onChange={(e) => setIng(i, { qty: e.target.value === '' ? null : Number(e.target.value) })} />
            <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Unità" value={ing.unit ?? ''} onChange={(e) => setIng(i, { unit: e.target.value })} />
            <button className="btn ghost sm" title="Rimuovi" onClick={() => setF((s) => ({ ...s, ingredients: s.ingredients.filter((_, j) => j !== i) }))}><i className="ti ti-x" /></button>
          </div>
        ))}
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setF((s) => ({ ...s, ingredients: [...s.ingredients, { name: '', qty: null, unit: '' }] }))}><i className="ti ti-plus" /> Ingrediente</button>
      </div>

      {/* Metodi di cottura */}
      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 13 }}>Metodi di cottura</b>
        <p className="muted" style={{ fontSize: 11, margin: '2px 0 0' }}>Un passaggio per riga.</p>
        {f.methods.map((m, i) => (
          <div key={i} className="card" style={{ margin: '8px 0 0', padding: 10 }}>
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <select className="select" style={{ width: 150 }} value={m.type} onChange={(e) => setMet(i, { type: e.target.value })}>
                {cookingMethods.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                {/* Il metodo già salvato che non è più in elenco resta selezionabile: senza, aprire
                    e salvare una ricetta vecchia le cambierebbe la preparazione di nascosto. */}
                {m.type && !cookingMethods.some((t) => t.code === m.type) && <option value={m.type}>{m.type.replace(/_/g, ' ')}</option>}
              </select>
              <button className="btn ghost sm" title="Rimuovi metodo" onClick={() => setF((s) => ({ ...s, methods: s.methods.filter((_, j) => j !== i) }))}><i className="ti ti-x" /></button>
            </div>
            <textarea className="input" rows={3} placeholder={'Lessa il farro.\nSalta il pollo.\nAggiungi le verdure.'} value={m.stepsText} onChange={(e) => setMet(i, { stepsText: e.target.value })} style={{ resize: 'vertical' }} />
          </div>
        ))}
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setF((s) => ({ ...s, methods: [...s.methods, { type: 'veloce', stepsText: '' }] }))}><i className="ti ti-plus" /> Metodo</button>
      </div>

      {/**
        * ⛔ **«DOVE È USATA» È STATA TOLTA — decisione di Simone, 3/9.**
        *
        * Elencava le **giornate** che nominano il piatto, con un pulsante «Togli» per ognuna. Dal
        * 1°/9 la sorgente del pool è il **paniere** (`panieri_sorgente_pool`), quindi quelle righe
        * raccontavano una cosa che non decide più cosa arriva nel piatto di una cliente — e il
        * «Togli» toglieva da una porta che non è più quella. Un elenco che sembra comandare e non
        * comanda è peggio di un elenco che non c'è.
        *
        * ⚠️ Resta «In quali panieri», che è la stessa domanda fatta alla porta giusta.
        */}
      {/* Solo su una ricetta che esiste già: una ricetta nuova non ha ancora un id da collegare. */}
      {recipe && <InQualiPanieri recipe={recipe} />}

      <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
        <Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} />
        <span style={{ fontSize: 13 }}>{f.active ? 'Attiva (disponibile nei menu)' : 'Archiviata'}</span>
      </div>

      {/*
        ⛔ **LA SPUNTA «RICETTA VERIFICATA»** (Simone, 4/9). Sotto la casella si legge CHI e QUANDO,
        quando c'è: senza, la spunta direbbe «qualcuno, una volta».
        ⚠️ E si dice a voce alta che **cade da sola** se cambiano gli ingredienti o il regime — una
        firma su un contenuto non vale su un contenuto diverso. Chi la mette deve saperlo prima, non
        scoprirlo il giorno che la trova spenta.
      */}
      <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 10 }}>
        <Toggle on={f.verified} onChange={(v) => setF({ ...f, verified: v })} />
        <span style={{ fontSize: 13 }}>
          {f.verified ? 'Verificata dalla nutrizionista' : 'Non verificata'}
          {recipe?.verifiedAt && f.verified && (
            <span style={{ color: 'var(--muted)' }}>
              {' — '}
              {recipe.verifiedByName ? `${recipe.verifiedByName}, ` : ''}
              {new Date(recipe.verifiedAt).toLocaleDateString('it-IT')}
            </span>
          )}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        ⚠️ La verifica decade da sola se cambi gli ingredienti o il regime: vale su questo contenuto.
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}><i className="ti ti-device-floppy" /> {busy ? 'Salvo…' : 'Salva'}</button>
      </div>
    </Modal>
  );
}




/**
 * IN QUALI PANIERI STA QUESTA RICETTA — e come metterla in altri.
 *
 * Richiesta di Simone (2/9): dal popup poter aggiungere la ricetta a uno o più panieri.
 *
 * ## ⛔ È RIMASTA SOLA, e non per caso
 *
 * Il 2/9 nasceva accanto a «Dove è usata», e già allora la nota diceva che erano **due domande
 * diverse**: quella erano le **giornate** che nominano il piatto, questa è il **pool** da cui il
 * motore pesca. Con `panieri_sorgente_pool` su `paniere` è questa a decidere cosa arriva nel piatto
 * di una cliente, e le giornate sono diventate storia — così il 3/9 l'altra è stata tolta: un
 * elenco che sembra comandare e non comanda più, con un «Togli» per ogni riga, è peggio di un
 * elenco che non c'è.
 *
 * ⚠️ **Vale subito, come i collegamenti sopra**: tocca il paniere, non la ricetta, e tenerlo in
 * sospeso vorrebbe dire poter chiudere la scheda a metà.
 */
function InQualiPanieri({ recipe }: { recipe: Recipe }) {
  interface Stato {
    dentro: { famiglia: string; regime: string; slot: string }[];
    disponibili: { famiglia: string; regime: string }[];
    bloccata: string | null;
  }
  const [stato, setStato] = useState<Stato | null>(null);
  const [scelte, setScelte] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  async function carica() {
    try {
      setStato(await api<Stato>(`/panieri/ricetta/${recipe.id}`));
      setErr(null);
    } catch (e) {
      /** ⚠️ Chi non ha la chiave `panieri` non deve vedere un errore rosso: la sezione sparisce. */
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) { setStato(null); setErr(null); return; }
      setErr(e instanceof ApiError ? e.message : 'Non riesco a leggere i panieri.');
    }
  }
  useEffect(() => { void carica(); }, [recipe.id]);

  /**
   * ⛔ **Uno alla volta, e il conto di cosa è andato.** Simone ha chiesto di poterne scegliere più
   * d'uno; l'API ne prende uno per chiamata, e va bene — ma se il terzo di cinque fallisce, dire
   * «non riuscito» nasconde che i primi due sono stati scritti davvero. Si dice quanti sì e quanti no.
   */
  async function aggiungi() {
    if (!scelte.length) return;
    setBusy(true); setErr(null); setAvviso(null);
    const fatti: string[] = [];
    const falliti: string[] = [];
    for (const chiave of scelte) {
      const [famiglia, regime] = chiave.split('|');
      try {
        await api('/panieri/ricetta', {
          method: 'POST',
          body: JSON.stringify({ famiglia, regime, slot: recipe.mealSlot, recipeId: recipe.id }),
        });
        fatti.push(famiglia);
      } catch (e) {
        falliti.push(`${famiglia} (${e instanceof ApiError ? e.message : 'non riuscito'})`);
      }
    }
    if (fatti.length) setAvviso(`Aggiunta a ${fatti.join(', ')}. Da adesso il motore la può pescare per tutte le clienti di ${fatti.length > 1 ? 'quei panieri' : 'quel paniere'}.`);
    if (falliti.length) setErr(`Non aggiunta a ${falliti.join(' · ')}`);
    setScelte([]);
    await carica();
    setBusy(false);
  }

  async function togli(p: { famiglia: string; regime: string; slot: string }) {
    /** ⚠️ La conferma dice cosa cambia per le clienti, come nella pagina Panieri. */
    if (!confirm(
      `Togliere «${recipe.name}» dal paniere ${p.famiglia} · ${p.regime}?\n\n`
      + 'Non lo riceverà più nessuna cliente di quel paniere.',
    )) return;
    setBusy(true); setErr(null); setAvviso(null);
    try {
      await api('/panieri/ricetta', {
        method: 'DELETE',
        body: JSON.stringify({ famiglia: p.famiglia, regime: p.regime, slot: p.slot, recipeId: recipe.id }),
      });
      setAvviso(`Tolta dal paniere ${p.famiglia}.`);
      await carica();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non riesco a toglierla.');
    } finally { setBusy(false); }
  }

  if (!stato) return null;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <b style={{ fontSize: 13 }}>In quali panieri sta</b>
      <p className="muted" style={{ fontSize: 11, margin: '2px 0 8px' }}>
        Il paniere è <b>da dove il motore pesca</b> per comporre i menu.
        Vale <b>subito</b>: non aspetta «Salva».
      </p>

      {err && <Banner kind="err">{err}</Banner>}
      {avviso && <Banner kind="ok">{avviso}</Banner>}

      {stato.dentro.length === 0 ? (
        <div className="muted" style={{ fontSize: 12, padding: '6px 0' }}>
          In nessun paniere: il motore non la pesca per nessuna cliente.
        </div>
      ) : (
        <table className="grid" style={{ marginTop: 4 }}>
          <tbody>
            {stato.dentro.map((p) => (
              <tr key={`${p.famiglia}|${p.regime}|${p.slot}`}>
                <td><b>{p.famiglia}</b> <span className="chip">{p.regime}</span></td>
                <td className="muted" style={{ fontSize: 11 }}>{SLOT[p.slot] ?? p.slot}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn ghost sm" disabled={busy} onClick={() => void togli(p)}>
                    <i className="ti ti-unlink" /> Togli
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/*
        ⛔ Il motivo si dice PRIMA del clic che fallirebbe: scoprirlo premendo un pulsante, paniere
        per paniere, è far cercare a qualcuno una cosa che sappiamo già.
      */}
      {stato.bloccata ? (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>⚠️ {stato.bloccata}</p>
      ) : stato.disponibili.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          È già in tutti i panieri <b>{recipe.regime}</b>. ⚠️ Negli altri regimi non può stare: un
          piatto di un regime dentro il paniere di un altro finirebbe nel piatto sbagliato.
        </p>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
            Aggiungila a uno o più panieri <b>{recipe.regime}</b> — negli altri regimi non può stare.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {stato.disponibili.map((d) => {
              const chiave = `${d.famiglia}|${d.regime}`;
              const on = scelte.includes(chiave);
              return (
                <button
                  key={chiave}
                  type="button"
                  className={on ? 'btn sm' : 'btn ghost sm'}
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => setScelte((v) => (on ? v.filter((x) => x !== chiave) : [...v, chiave]))}
                >
                  {d.famiglia}
                </button>
              );
            })}
          </div>
          <button className="btn sm" style={{ marginTop: 8 }} disabled={busy || !scelte.length} onClick={() => void aggiungi()}>
            <i className="ti ti-plus" /> {busy ? 'Aggiungo…' : `Aggiungi a ${scelte.length || 'nessun'} paniere${scelte.length === 1 ? '' : 'i'}`}
          </button>
        </div>
      )}
    </div>
  );
}
