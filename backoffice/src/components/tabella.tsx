/**
 * TABELLE: ORDINAMENTO E FILTRI, UNA VOLTA SOLA.
 *
 * Simone, l'11/8: «in quella tabella come in quella dei log mettere i filtri e riordino sulle
 * colonne… controllale tutte». Guardandole tutte: il backoffice ha 37 tabelle, cinque avevano
 * l'ordinamento e le cinque erano **cinque copie divergenti** dello stesso blocchetto
 * (`sortKey`/`sortDir` + una funzione `ordina` + un `<th>` cliccabile), copiato a mano ogni volta
 * e ogni volta un po' diverso: due chiamano la funzione `ordina`, due `toggleSort`, una tratta i
 * valori vuoti in un modo e una nell'altro. Aggiungere l'ordinamento alle altre trentadue
 * copiando ancora voleva dire trentadue occasioni di sbagliare la stessa riga.
 *
 * Qui c'è quel blocchetto, una volta. Le pagine dichiarano le colonne (titolo + come si legge il
 * valore + se ha un filtro) e continuano a disegnare le celle a mano: le celle sono l'unica cosa
 * che cambia davvero da una tabella all'altra, e un componente che le disegnasse al posto nostro
 * avrebbe bisogno di più configurazione di quanta ne risparmia.
 *
 * ## Le tre decisioni dentro l'ordinamento
 *
 * 1. **I vuoti vanno in fondo, sempre** — anche in ordine crescente. Ordinando per «Coach» con le
 *    righe senza coach in cima, le prime due schermate sono vuote e chi cerca una coach pensa che
 *    l'ordinamento non funzioni. Prima lo faceva solo `Clienti`, con un `?? 'zzz'` che si rompe
 *    con un nome che inizia per z.
 * 2. **Numeri e date si confrontano come tali.** `valore` può restituire un numero (importi,
 *    kcal, ore) o una data ISO: le stringhe ISO si ordinano bene alfabeticamente, gli importi no
 *    («100» viene prima di «20»).
 * 3. **Un solo clic sull'intestazione** alterna crescente/decrescente sulla stessa colonna, e
 *    riparte da crescente quando si cambia colonna.
 *
 * ## I filtri
 *
 * Due tipi, perché sono i due che servivano in tutte le tabelle guardate:
 * - `testo`: una casella che cerca dentro il valore della colonna;
 * - `scelta`: una tendina con i valori **presenti nelle righe caricate**, non un elenco fisso —
 *   così non compaiono opzioni che non selezionano niente (era già il trucco di `Clienti` per
 *   l'elenco delle coach, generalizzato).
 *
 * Il filtro libero in cima alla pagina (quello che cerca in tutte le colonne insieme) resta dove
 * era: si passa `ricerca` a `useTabella` e cerca in tutte le colonne che hanno un `valore`.
 */
import { useEffect, useMemo, useState } from 'react';
import { RIGHE_OPZIONI } from '../lib/preferenzeHome';
import { usePagination } from './ui';

export interface Colonna<T> {
  /** Identificatore stabile della colonna (usato per lo stato di ordinamento e filtro). */
  chiave: string;
  /** Titolo mostrato nell'intestazione. Vuoto per le colonne dei pulsanti. */
  titolo: string;
  /**
   * Come si legge il valore della colonna, per ordinare e filtrare. Ometterlo rende la colonna
   * non ordinabile e non filtrabile (colonne di pulsanti, o celle con dentro un modulo).
   */
  valore?: (r: T) => string | number | null | undefined;
  /** Tipo di filtro sotto l'intestazione. Default: nessuno. */
  filtro?: 'testo' | 'scelta';
  /** Etichetta dell'opzione «tutti» della tendina (default «Tutti»). */
  etichettaTutti?: string;
  /**
   * Ordine delle voci della tendina, quando l'alfabeto non è l'ordine giusto.
   *
   * Su una colonna «Stato» l'ordine utile è quello del ciclo di vita — In attesa, Pagato,
   * Rifiutato — e che coincida con l'alfabeto è un caso. Le voci non elencate qui vanno in fondo
   * in ordine alfabetico: aggiungerne una al prodotto e dimenticarla qui la fa comparire comunque.
   */
  ordineScelte?: string[];
  /**
   * Per i filtri a scelta: come si scrive l'opzione nella tendina, se il valore grezzo non è
   * leggibile (es. `active` → «Attivo»). Il confronto resta sul valore grezzo.
   */
  etichetta?: (v: string) => string;
  /** Disattiva l'ordinamento anche se la colonna ha un `valore` (colonne calcolate lente). */
  nonOrdinabile?: boolean;
  /** Passato al `<th>`: utile per le colonne numeriche allineate a destra. */
  stile?: React.CSSProperties;
  /** `colSpan` dell'intestazione, per le tabelle che uniscono due colonne sotto un titolo. */
  colSpan?: number;
}

interface Opzioni {
  /** Righe per pagina (default 100, come le tabelle esistenti). */
  perPagina?: number;
  /** Colonna ordinata all'apertura; senza questa le righe restano nell'ordine del server. */
  ordineIniziale?: { chiave: string; direzione?: 'asc' | 'desc' };
  /**
   * Filtri già impostati all'apertura, per chiave di colonna.
   *
   * Serve alle pagine che si aprono su una vista ristretta — «solo le ricette da rivedere» — e che
   * prima lo facevano con una spunta a parte sopra la tabella. Due controlli sullo stesso dato si
   * contraddicono a vicenda: con la spunta attiva la tendina della stessa colonna offriva una voce
   * sola. Il filtro di colonna è uno, e parte selezionato; «Azzera filtri» lo apre a tutto.
   */
  filtriIniziali?: Record<string, string>;
}

/** Confronto di due valori di colonna: vuoti in fondo, numeri come numeri. */
function confronta(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const vuotoA = a === null || a === undefined || a === '';
  const vuotoB = b === null || b === undefined || b === '';
  // I vuoti in fondo in entrambe le direzioni: il segno della direzione NON li tocca (vedi il
  // moltiplicatore in `ordinate`), altrimenti in decrescente tornerebbero in cima.
  if (vuotoA && vuotoB) return 0;
  if (vuotoA) return Number.POSITIVE_INFINITY;
  if (vuotoB) return Number.NEGATIVE_INFINITY;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'it', { numeric: true, sensitivity: 'base' });
}

export function useTabella<T>(righe: T[], colonne: Colonna<T>[], opzioni: Opzioni = {}) {
  const [chiaveOrdine, setChiaveOrdine] = useState<string>(opzioni.ordineIniziale?.chiave ?? '');
  const [direzione, setDirezione] = useState<'asc' | 'desc'>(opzioni.ordineIniziale?.direzione ?? 'asc');
  /** Valore corrente di ogni filtro di colonna, per chiave. */
  const [filtri, setFiltri] = useState<Record<string, string>>(opzioni.filtriIniziali ?? {});
  /** Ricerca libera su tutte le colonne con un `valore`. */
  const [ricerca, setRicerca] = useState('');

  const perChiave = useMemo(() => new Map(colonne.map((c) => [c.chiave, c])), [colonne]);

  /** Opzioni delle tendine: i valori che ci sono davvero nelle righe caricate. */
  const scelte = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of colonne) {
      if (c.filtro !== 'scelta' || !c.valore) continue;
      const viste = new Set<string>();
      for (const r of righe) {
        const v = c.valore(r);
        if (v !== null && v !== undefined && v !== '') viste.add(String(v));
        // Il valore vuoto si segna a parte: serve a decidere se la voce «— non impostato —» ha
        // senso in questa colonna (vedi `conVuoti`).
        else viste.add(VUOTO);
      }
      const ordine = c.ordineScelte;
      out[c.chiave] = [...viste].sort((a, b) => {
        if (!ordine) return a.localeCompare(b, 'it');
        const ia = ordine.indexOf(a);
        const ib = ordine.indexOf(b);
        // Le voci non elencate finiscono dopo quelle elencate, fra loro in alfabetico.
        if (ia === -1 && ib === -1) return a.localeCompare(b, 'it');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    return out;
  }, [righe, colonne]);

  /**
   * Le colonne in cui esiste almeno una riga senza valore. Solo lì la tendina mostra «— non
   * impostato —»: su una colonna «Stato», dove ogni riga ha sempre uno stato, quella voce non
   * seleziona mai niente — e una voce che non fa niente insegna a diffidare del menu.
   */
  const conVuoti = useMemo(
    () => new Set(Object.entries(scelte).filter(([, v]) => v.includes(VUOTO)).map(([k]) => k)),
    [scelte],
  );

  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    const attivi = Object.entries(filtri).filter(([, v]) => v !== '');
    if (!q && attivi.length === 0) return righe;
    return righe.filter((r) => {
      for (const [chiave, atteso] of attivi) {
        const c = perChiave.get(chiave);
        if (!c?.valore) continue;
        const v = c.valore(r);
        const testo = v === null || v === undefined ? '' : String(v);
        if (c.filtro === 'scelta') {
          // `—` come valore selezionato significa «le righe senza valore»: la domanda pratica
          // («quali non hanno la coach?») era già quella che serviva nell'elenco clienti.
          if (atteso === VUOTO ? testo !== '' : testo !== atteso) return false;
        } else if (!testo.toLowerCase().includes(atteso.trim().toLowerCase())) return false;
      }
      if (!q) return true;
      return colonne.some((c) => {
        if (!c.valore) return false;
        const v = c.valore(r);
        return v !== null && v !== undefined && String(v).toLowerCase().includes(q);
      });
    });
  }, [righe, filtri, ricerca, colonne, perChiave]);

  const ordinate = useMemo(() => {
    const c = chiaveOrdine ? perChiave.get(chiaveOrdine) : undefined;
    if (!c?.valore) return filtrate;
    const segno = direzione === 'asc' ? 1 : -1;
    const leggi = c.valore;
    return [...filtrate].sort((a, b) => {
      const d = confronta(leggi(a), leggi(b));
      // I vuoti tornano ±Infinity: restano in fondo anche in decrescente (decisione 1).
      if (!Number.isFinite(d)) return d > 0 ? 1 : -1;
      return d * segno;
    });
  }, [filtrate, chiaveOrdine, direzione, perChiave]);

  const pg = usePagination(ordinate, opzioni.perPagina ?? 100);

  // Cambiando filtro il numero di pagine cambia: senza questo si resta su una pagina che non
  // esiste più e la tabella sembra vuota (succedeva in Clienti prima del filtro glutine).
  useEffect(() => {
    pg.setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ricerca, JSON.stringify(filtri), chiaveOrdine, direzione]);

  function ordina(chiave: string) {
    const c = perChiave.get(chiave);
    if (!c?.valore || c.nonOrdinabile) return;
    if (chiaveOrdine === chiave) setDirezione((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setChiaveOrdine(chiave); setDirezione('asc'); }
  }

  const filtriAttivi = ricerca.trim() !== '' || Object.values(filtri).some((v) => v !== '');
  function azzera() { setFiltri({}); setRicerca(''); }
  const impostaFiltro = (chiave: string, valore: string) => setFiltri((f) => ({ ...f, [chiave]: valore }));

  /** La riga dei titoli: cliccabili dove la colonna è ordinabile. */
  function intestazione() {
    return (
      <tr>
        {colonne.map((c) => {
          const ordinabile = !!c.valore && !c.nonOrdinabile;
          return (
            <th
              key={c.chiave}
              colSpan={c.colSpan}
              style={{ ...(ordinabile ? { cursor: 'pointer', userSelect: 'none' } : {}), whiteSpace: 'nowrap', ...c.stile }}
              onClick={ordinabile ? () => ordina(c.chiave) : undefined}
              title={ordinabile ? 'Clicca per ordinare' : undefined}
            >
              {c.titolo}
              {chiaveOrdine === c.chiave ? (direzione === 'asc' ? ' ▲' : ' ▼') : ''}
            </th>
          );
        })}
      </tr>
    );
  }

  /** La riga dei filtri, subito sotto i titoli. Da omettere se nessuna colonna ha un filtro. */
  function rigaFiltri() {
    if (!colonne.some((c) => c.filtro)) return null;
    return (
      <tr>
        {colonne.map((c) => (
          <th key={c.chiave} colSpan={c.colSpan} style={{ padding: '4px 6px' }}>
            {c.filtro === 'testo' && (
              <input
                className="input sm"
                style={{ width: '100%', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
                placeholder="Filtra…"
                value={filtri[c.chiave] ?? ''}
                onChange={(e) => impostaFiltro(c.chiave, e.target.value)}
              />
            )}
            {c.filtro === 'scelta' && (
              <select
                className="select sm"
                style={{ width: '100%', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
                value={filtri[c.chiave] ?? ''}
                onChange={(e) => impostaFiltro(c.chiave, e.target.value)}
              >
                <option value="">{c.etichettaTutti ?? 'Tutti'}</option>
                {conVuoti.has(c.chiave) && <option value={VUOTO}>— non impostato —</option>}
                {(scelte[c.chiave] ?? []).filter((v) => v !== VUOTO).map((v) => (
                  <option key={v} value={v}>{c.etichetta ? c.etichetta(v) : v}</option>
                ))}
              </select>
            )}
          </th>
        ))}
      </tr>
    );
  }

  return {
    /** Le righe della pagina corrente, filtrate e ordinate: quelle da disegnare. */
    pagina: pg.pageItems,
    /** Tutte le righe filtrate e ordinate (per i totali in fondo alla tabella). */
    tutte: ordinate,
    intestazione,
    rigaFiltri,
    ordina,
    filtriAttivi,
    azzera,
    ricerca,
    setRicerca,
    filtri,
    impostaFiltro,
    /** Da passare a `<Pager {...pager} />`. */
    pager: { page: pg.page, totalPages: pg.totalPages, total: pg.total, from: pg.from, to: pg.to, onPage: pg.setPage },
    conteggio: { mostrate: ordinate.length, totali: righe.length },
  };
}

/**
 * Valore speciale della tendina per «righe senza valore in questa colonna».
 *
 * I due punti in testa e in coda perché deve essere impossibile che coincida con un valore vero
 * della colonna: se coincidesse, scegliere quel valore filtrerebbe le righe vuote.
 */
export const VUOTO = '::vuoto::';

/**
 * Etichetta compatta del filtro: «12 di 340» quando i filtri sono attivi, altrimenti il totale.
 * È la stessa che c'era in `Clienti`, spostata qui perché serviva identica in tutte le altre.
 */
export function ContatoreRighe({
  conteggio,
  filtriAttivi,
  azzera,
  nome,
}: {
  conteggio: { mostrate: number; totali: number };
  filtriAttivi: boolean;
  azzera: () => void;
  /** Plurale della cosa contata: «clienti», «righe», «lead». */
  nome: string;
}) {
  return (
    <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span
        style={{ fontSize: 14, fontWeight: 800, background: 'var(--chip)', borderRadius: 999, padding: '7px 14px', whiteSpace: 'nowrap' }}
        title={`${nome} che rispettano i filtri correnti`}
      >
        {filtriAttivi ? `${conteggio.mostrate} di ${conteggio.totali}` : `${conteggio.totali} ${nome}`}
      </span>
      {filtriAttivi && (
        <button className="btn ghost sm" onClick={azzera} title="Rimuovi tutti i filtri">
          <i className="ti ti-filter-off" /> Azzera filtri
        </button>
      )}
    </div>
  );
}

/**
 * QUANTE RIGHE VEDERE — 10 / 25 / 50 / 100.
 *
 * Richiesta di Simone dell'11/8 sulla tabella «Le mie clienti» in home: «rendila scorrevole con la
 * possibilità di selezionare quante righe vedere… (default 10) poi salva le preferenze». La scelta si
 * salva nel profilo, quindi il selettore non è locale alla pagina: chi lo cambia lo cambia per sé,
 * una volta.
 */
export function SelettoreRighe({ valore, onCambia }: { valore: number; onCambia: (n: number) => void }) {
  return (
    <select
      className="select sm"
      style={{ width: 'auto' }}
      value={valore}
      onChange={(e) => onCambia(Number(e.target.value))}
      title="Quante righe vedere per pagina: la scelta resta salvata"
    >
      {RIGHE_OPZIONI.map((n) => <option key={n} value={n}>{n} righe</option>)}
    </select>
  );
}

/**
 * Il contenitore scorrevole delle tabelle di home. L'altezza è calcolata sulle righe da mostrare, non
 * fissa: con 100 righe selezionate una card alta 400px sarebbe una finestrella, con 10 righe una card
 * alta 900px sarebbe mezza schermata vuota. `56px` è l'altezza reale di una riga di `table.grid` con
 * due testi sovrapposti; l'intestazione resta ferma in cima (`position: sticky`).
 */
export const stileScorrevole = (righe: number): React.CSSProperties => ({
  maxHeight: Math.min(righe, 12) * 56 + 96,
  overflowY: 'auto',
  overflowX: 'auto',
});
