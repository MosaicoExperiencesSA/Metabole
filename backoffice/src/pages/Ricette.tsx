import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner, Toggle } from '../components/ui';
import { BottoneExcel, useTabella, type Colonna } from '../components/tabella';
import { useTaxonomy } from '../lib/taxonomy';

interface Ingredient { name: string; qty?: number | null; unit?: string | null }
interface CookingMethod { type: string; steps: string[] }
interface Recipe {
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
}

/** I nomi delle diete che usano la ricetta. `null` (server muto) si legge come elenco vuoto qui. */
const dieteDi = (r: { utilizzo?: { dieta: string }[] | null }): string[] => (r.utilizzo ?? []).map((u) => u.dieta);

/** Una riga di «Dove è usata»: una dieta e una settimana. Il giorno è il dettaglio dentro. */
interface Uso {
  dietId: string; dieta: string; ritirata: boolean; bozza: boolean;
  /**
   * Pasti e obiettivo della dieta (12/8). Non sono decorazione: la stessa dieta esiste in più
   * varianti — 3 e 5 pasti, dimagrimento e mantenimento — e col solo nome «Digiuno intermittente
   * (16:8)» ripetuto quattro volte non si capisce a quale delle quattro appartenga ogni riga.
   */
  pasti?: number | null; obiettivo?: string | null;
  dayIndex: number; settimana: number; giorno: number;
}

/**
 * La riga piccola sotto il nome della dieta. Abbreviata come ha chiesto Simone (12/8): «gg», «man»
 * e «dim» — sta su una riga sola anche nella colonna stretta, ed è quello che serve per
 * distinguere le varianti a colpo d'occhio.
 *
 * ⚠️ Quello che non si sa non si scrive: un obiettivo mancante lascia il posto vuoto invece di
 * inventare «dim», che è il default del database e non un dato letto.
 */
const OBIETTIVO_BREVE: Record<string, string> = { dimagrimento: 'dim', mantenimento: 'man' };
const rigaUso = (u: Uso): string =>
  [
    `gg ${u.giorno}`,
    u.pasti ? `${u.pasti} pasti` : null,
    u.obiettivo ? OBIETTIVO_BREVE[u.obiettivo] ?? u.obiettivo : null,
  ]
    .filter(Boolean)
    .join(' · ');
interface DietaCollegabile { id: string; name: string; regime: string; status?: string; mealsPerDay?: number; fasting?: boolean; objective?: string | null }
interface GiornateSlot {
  slotPrevisto: boolean;
  pastiPrevisti: number;
  stato: string;
  settimane: number;
  giornateComplete: number;
  suggerimento: { settimana: number; dayIndex: number; giorno: number; nuova: boolean };
  giornate: { dayIndex: number; settimana: number; giorno: number; occupatoDa: { id: string; name: string } | null; completa: boolean }[];
}
interface EsitoCollega {
  giaCosi: boolean; sostituito: string | null; settimana: number; giorno: number;
  settimanaNuova: boolean; giornateVuoteCreate: number; giornataCompleta: boolean; pastiMancanti: number;
}

/** Il posto del giorno dentro la sua settimana: 1..7. Stessa regola del backend. */
const i7 = (dayIndex: number): number => ((dayIndex - 1) % 7) + 1;

/** Etichette obiettivo, per distinguere le varianti nella tendina delle diete collegabili. */
const OBIETTIVO: Record<string, string> = { dimagrimento: 'Dimagrimento', mantenimento: 'Mantenimento' };

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
}

const emptyForm = (regime = 'omnivore'): Form => ({
  name: '', regime, mealSlot: 'lunch', kcal: '', difficulty: 'media', seasons: [],
  ingredients: [{ name: '', qty: null, unit: '' }],
  methods: [{ type: 'veloce', stepsText: '' }],
  active: true,
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
      if (f.kcalMin.trim()) params.set('kcalMin', f.kcalMin.trim());
      if (f.kcalMax.trim()) params.set('kcalMax', f.kcalMax.trim());
      const r = await api<{ items: Recipe[]; total: number; troncato: boolean }>(`/recipes?${params.toString()}`);
      setRows(r.items);
      setTotale(r.total);
      setTroncato(r.troncato);
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
  }, [scopeRegime, scopeDietId, soloDieta, f.name, f.regime, f.slot, f.difficulty, f.season, f.stato, f.kcalMin, f.kcalMax]);

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
                  <td>{r.name}</td>
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

function RecipeModal({ recipe, defaultRegime, onClose, onSaved }: { recipe: Recipe | null; defaultRegime?: string; onClose: () => void; onSaved: (avviso?: string | null) => void }) {
  const { regimes, cookingMethods } = useTaxonomy();
  const [f, setF] = useState<Form>(recipe ? toForm(recipe) : emptyForm(defaultRegime));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    const body = { name: f.name.trim(), regime: f.regime, mealSlot: f.mealSlot, kcal, ingredients, cookingMethods, difficulty: f.difficulty, seasons: f.seasons, active: f.active };

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
        const r = await api<{ confermaAllergeniDecaduta?: boolean }>(
          `/recipes/${recipe.id}`, { method: 'PATCH', body: JSON.stringify(body) },
        );
        if (r?.confermaAllergeniDecaduta) {
          avviso =
            `«${body.name}»: hai cambiato gli ingredienti, quindi la conferma degli allergeni non ` +
            'vale più — era stata data su un piatto diverso. ⚠️ Da adesso la ricetta NON entra nei ' +
            'menu nuovi finché non ricontrolli gli allergeni in «Allergeni ricette». I menu già ' +
            'consegnati non cambiano.';
        }
      } else {
        await api('/recipes', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved(avviso);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
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

      {/* Solo su una ricetta che esiste già: una ricetta nuova non ha ancora un id da collegare. */}
      {recipe && <DoveUsata recipe={recipe} slotNelModulo={f.mealSlot} />}

      <div className="row" style={{ alignItems: 'center', gap: 8, marginTop: 14 }}>
        <Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} />
        <span style={{ fontSize: 13 }}>{f.active ? 'Attiva (disponibile nei menu)' : 'Archiviata'}</span>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={save} disabled={busy}><i className="ti ti-device-floppy" /> {busy ? 'Salvo…' : 'Salva'}</button>
      </div>
    </Modal>
  );
}


/**
 * DOVE È USATA QUESTA RICETTA — e come collegarla altrove.
 *
 * Richiesta di Simone dell'11/8: dal dettaglio della ricetta poterla collegare a una dieta e a una
 * settimana, a più d'una, anche a una settimana che ancora non c'è.
 *
 * ## Si ragiona per RIGHE
 *
 * Una riga è **una dieta e una settimana** — «Low carb · Settimana 1», «Mediterranea · Settimana 4»
 * — perché è così che si guarda un catalogo: dove gira questo piatto. Il giorno c'è, e si vede, ma
 * è il dettaglio dentro la riga: sotto sta scritto «giorno 3».
 *
 * ## Non è come il resto della scheda
 *
 * Gli altri campi si salvano con «Salva». Questi collegamenti **valgono subito**, perché toccano le
 * giornate di una dieta e non la ricetta: tenerli in sospeso vorrebbe dire poter chiudere la scheda
 * con dei collegamenti a metà. Ogni riga aggiunta o tolta è un'operazione conclusa, e lo dice.
 */
function DoveUsata({ recipe, slotNelModulo }: { recipe: Recipe; slotNelModulo: string }) {
  const [usi, setUsi] = useState<Uso[] | null>(null);
  const [diete, setDiete] = useState<DietaCollegabile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apri, setApri] = useState(false);

  const [dietId, setDietId] = useState('');
  const [giornate, setGiornate] = useState<GiornateSlot | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  /** Contatore delle richieste: la risposta di una dieta abbandonata non deve sovrascrivere l'altra. */
  const richiesta = useRef(0);

  async function caricaUsi() {
    try { setUsi(await api<Uso[]>(`/recipes/${recipe.id}/uso`)); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Non riesco a leggere dove è usata.'); }
  }

  async function caricaGiornate(id: string) {
    const mia = ++richiesta.current;
    try {
      const g = await api<GiornateSlot>(`/recipes/diete/${id}/giornate?slot=${encodeURIComponent(recipe.mealSlot)}`);
      // Cambiando dieta due volte in fretta, la risposta lenta della prima arriverebbe per ultima e
      // farebbe scegliere un giorno guardando le giornate di un'altra dieta.
      if (mia !== richiesta.current) return;
      setGiornate(g);
      setDayIndex(g.suggerimento.dayIndex);
    } catch (e) {
      if (mia === richiesta.current) setErr(e instanceof ApiError ? e.message : 'Non riesco a leggere le giornate.');
    }
  }

  useEffect(() => {
    void caricaUsi();
    // Solo le diete dello STESSO regime e non ritirate: una ricetta onnivora dentro una dieta vegana
    // è l'errore che il generatore si vieta da sé, e qui lo farebbe una persona a mano. Il backend
    // rifiuta comunque; la tendina evita di far scegliere qualcosa che verrà respinto.
    api<DietaCollegabile[]>('/diets')
      .then((d) => setDiete(d.filter((x) => x.regime === recipe.regime && x.status !== 'rejected')))
      .catch(() => setDiete([]));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [recipe.id]);

  useEffect(() => {
    setGiornate(null); setDayIndex(0);
    if (dietId) void caricaGiornate(dietId);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [dietId, recipe.mealSlot]);

  const settimanaScelta = dayIndex ? Math.max(1, Math.ceil(dayIndex / 7)) : 0;

  const giorniDellaSettimana = useMemo(() => {
    if (!settimanaScelta) return [];
    const primo = (settimanaScelta - 1) * 7 + 1;
    return Array.from({ length: 7 }, (_, i) => primo + i).map((di) => {
      const g = giornate?.giornate.find((x) => x.dayIndex === di);
      return { dayIndex: di, giorno: i7(di), occupatoDa: g?.occupatoDa ?? null, esiste: !!g };
    });
  }, [settimanaScelta, giornate]);

  /** Le settimane offerte: quelle che ci sono, più la prossima — il modo di allungare il ciclo. */
  const settimaneOfferte = useMemo(() => {
    const n = giornate?.settimane ?? 0;
    // Il ciclo si ferma a 12 settimane (84 giornate): oltre, il backend rifiuta. Meglio non offrirla.
    const prossima = n < 12 ? [n + 1] : [];
    return [...Array.from({ length: n }, (_, i) => i + 1), ...prossima];
  }, [giornate]);

  /** Cambiando settimana si va sul primo giorno LIBERO, non sul giorno 1 che spesso è occupato. */
  function scegliSettimana(n: number) {
    const primo = (n - 1) * 7 + 1;
    const giorni = Array.from({ length: 7 }, (_, i) => primo + i);
    const libero = giorni.find((di) => {
      const g = giornate?.giornate.find((x) => x.dayIndex === di);
      return !g || !g.occupatoDa;
    });
    setDayIndex(libero ?? primo);
  }

  async function collega() {
    if (!dietId || !dayIndex) return;
    setBusy(true); setErr(null); setAvviso(null);
    try {
      const r = await api<EsitoCollega>(`/recipes/${recipe.id}/uso`, { method: 'POST', body: JSON.stringify({ dietId, dayIndex }) });
      const parti = [r.giaCosi ? 'Era già collegata a questa giornata.' : `Collegata alla settimana ${r.settimana}, giorno ${r.giorno}.`];
      // Le tre cose che NON si vedono guardando la riga nuova, e che vanno dette adesso.
      if (r.sostituito) parti.push(`Ha preso il posto di «${r.sostituito}».`);
      if (r.settimanaNuova) parti.push(`La settimana ${r.settimana} è nuova: le altre ${r.giornateVuoteCreate} giornate sono vuote.`);
      if (!r.giornataCompleta) {
        parti.push(`⚠️ A quella giornata mancano ancora ${r.pastiMancanti} pasti, e finché è così il motore la salta: il piatto è scritto ma non arriva a nessuna cliente.`);
      }
      setAvviso(parti.join(' '));
      await caricaUsi();
      await caricaGiornate(dietId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Collegamento non riuscito.');
    } finally { setBusy(false); }
  }

  async function scollega(u: Uso) {
    // Il prezzo vero va detto prima, e non è «il pasto resta vuoto»: una giornata monca il motore la
    // scarta, quindi il ciclo servito alle clienti si accorcia di una giornata.
    if (!confirm(
      `Togliere «${recipe.name}» da ${u.dieta}, settimana ${u.settimana}, giorno ${u.giorno}?\n\n`
      + 'Quella giornata resta senza questo pasto, e una giornata incompleta il motore NON la serve: '
      + 'il ciclo di questa dieta si accorcia di una giornata per tutte le clienti che la seguono, '
      + 'finché non la ricompleti.',
    )) return;
    setBusy(true); setErr(null); setAvviso(null);
    try {
      const r = await api<{ tolta: boolean; giornateComplete?: number }>(
        `/recipes/${recipe.id}/uso`, { method: 'DELETE', body: JSON.stringify({ dietId: u.dietId, dayIndex: u.dayIndex }) },
      );
      setAvviso(r.tolta
        ? `Tolta da ${u.dieta}, settimana ${u.settimana}. Quella dieta ora eroga ${r.giornateComplete} giornate complete.`
        : 'In quella giornata questa ricetta non c\'era più.');
      await caricaUsi();
      if (dietId === u.dietId) await caricaGiornate(dietId);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Non riesco a toglierla.');
    } finally { setBusy(false); }
  }

  const occupante = giorniDellaSettimana.find((g) => g.dayIndex === dayIndex)?.occupatoDa ?? null;
  // Il collegamento scrive nello slot SALVATO. Se nel modulo il pasto è stato cambiato e non ancora
  // salvato, collegare adesso metterebbe il piatto nello slot vecchio: meglio fermarsi e dirlo.
  const slotCambiato = slotNelModulo !== recipe.mealSlot;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <b style={{ fontSize: 13 }}>Dove è usata</b>
      <p className="muted" style={{ fontSize: 11, margin: '2px 0 8px' }}>
        Una riga per dieta e settimana, letta dalle giornate. Vale <b>subito</b>: non aspetta «Salva».
      </p>

      {err && <Banner kind="err">{err}</Banner>}
      {avviso && <Banner kind="ok">{avviso}</Banner>}
      {slotCambiato && (
        <Banner kind="info">
          Hai cambiato il pasto da <b>{SLOT[recipe.mealSlot] ?? recipe.mealSlot}</b> a <b>{SLOT[slotNelModulo] ?? slotNelModulo}</b> e non hai ancora salvato.
          Salva prima di collegare: i collegamenti scrivono nel pasto salvato, non in quello scelto qui sopra.
        </Banner>
      )}

      {usi === null ? <Spinner /> : usi.length === 0 ? (
        <div className="muted" style={{ fontSize: 12, padding: '6px 0' }}>
          Nessuna giornata la usa: è una ricetta <b>orfana</b>. È stata generata e pagata, e nessuna cliente la vedrà.
        </div>
      ) : (
        <table className="grid" style={{ marginTop: 4 }}>
          <tbody>
            {usi.map((u) => (
              <tr key={`${u.dietId}-${u.dayIndex}`}>
                <td>
                  <b>{u.dieta}</b>{' '}
                  {u.ritirata && <span className="chip gray" title="Dieta rifiutata o ritirata: le sue giornate restano scritte, ma non viene erogata">non erogata</span>}
                  {u.bozza && <span className="chip gray" title="Dieta in bozza o in revisione: non ancora pubblicata">bozza</span>}
                  <div className="muted" style={{ fontSize: 11 }}>{rigaUso(u)}</div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}><span className="chip">Settimana {u.settimana}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn ghost sm" disabled={busy} onClick={() => scollega(u)} title="Togli da questa giornata">
                    <i className="ti ti-unlink" /> Togli
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!apri ? (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setApri(true)} disabled={slotCambiato}>
          <i className="ti ti-plus" /> Collega a una dieta
        </button>
      ) : (
        <div className="card" style={{ marginTop: 8, padding: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
            <label><span className="muted" style={{ fontSize: 12 }}>Dieta</span>
              <select className="select" value={dietId} onChange={(e) => setDietId(e.target.value)}>
                <option value="">— scegli —</option>
                {/* L'etichetta deve DISTINGUERE le varianti: nome e regime sono uguali in tutta la
                    famiglia, e due voci identiche che si comportano in modo diverso (il digiuno non
                    ha colazione) fanno scegliere quella sbagliata. */}
                {[...diete]
                  .sort((a, b) => a.name.localeCompare(b.name, 'it') || (a.mealsPerDay ?? 0) - (b.mealsPerDay ?? 0))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.objective ? ` · ${OBIETTIVO[d.objective] ?? d.objective}` : ''}
                      {d.fasting ? ' · Digiuno' : d.mealsPerDay ? ` · ${d.mealsPerDay} pasti` : ''}
                      {d.status !== 'approved' ? ' · bozza' : ''}
                    </option>
                  ))}
              </select>
            </label>
            <label><span className="muted" style={{ fontSize: 12 }}>Settimana</span>
              <select className="select" value={settimanaScelta || ''} disabled={!giornate}
                onChange={(e) => scegliSettimana(Number(e.target.value))}>
                {settimaneOfferte.map((n) => (
                  <option key={n} value={n}>Settimana {n}{n > (giornate?.settimane ?? 0) ? ' — nuova' : ''}</option>
                ))}
              </select>
            </label>
            <label><span className="muted" style={{ fontSize: 12 }}>Giorno</span>
              <select className="select" value={dayIndex || ''} disabled={!giornate}
                onChange={(e) => setDayIndex(Number(e.target.value))}>
                {giorniDellaSettimana.map((g) => (
                  <option key={g.dayIndex} value={g.dayIndex}>
                    Giorno {g.giorno}{g.occupatoDa ? ` — occupato da ${g.occupatoDa.name}` : g.esiste ? ' — libero' : ' — da creare'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {giornate && !giornate.slotPrevisto && (
            <Banner kind="err">
              Questa dieta non prevede questo pasto: le sue giornate ne hanno {giornate.pastiPrevisti}. La ricetta non ci può stare.
            </Banner>
          )}
          {giornate?.suggerimento && dayIndex === giornate.suggerimento.dayIndex && giornate.slotPrevisto && (
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              <i className="ti ti-bulb" style={{ marginRight: 4 }} />
              {giornate.suggerimento.nuova
                ? `In questa dieta il pasto è pieno in tutte le ${giornate.settimane} settimane: ti propongo la settimana ${giornate.suggerimento.settimana}, nuova.`
                : `Ti propongo la prima settimana con un buco in questo pasto: la ${giornate.suggerimento.settimana}, giorno ${giornate.suggerimento.giorno}.`}
            </div>
          )}
          {giornate && settimanaScelta > giornate.settimane && (
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              La settimana {settimanaScelta} non esiste ancora: nascerà con 7 giornate, sei delle quali vuote.
              Finché non le riempi, il motore le salta — e salta anche quella con questo piatto.
            </div>
          )}
          {occupante && (
            <div style={{ fontSize: 11, marginTop: 6, color: 'var(--danger)' }}>
              ⚠️ In quel giorno c'è già <b>{occupante.name}</b>: collegando questa ricetta prende il suo posto.
            </div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button className="btn ghost sm" onClick={() => { setApri(false); setDietId(''); }} disabled={busy}>Annulla</button>
            <button className="btn sm" onClick={collega} disabled={busy || !dietId || !dayIndex || !giornate?.slotPrevisto}>
              <i className="ti ti-link" /> {busy ? 'Collego…' : 'Collega'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
