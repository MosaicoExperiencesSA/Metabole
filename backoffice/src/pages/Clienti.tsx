import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner, usePagination } from '../components/ui';

interface ClientRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
  /** Nome del profilo: quello con cui la cliente vuole essere chiamata. */
  nickname?: string | null;
  /** Coach assegnata (richiesta di Simone dell'8/8). */
  coach?: string | null;
  /** Famiglia di dieta assegnata (es. «Mediterranea senza glutine»). */
  dietFamily?: string | null;
  /** Ha dichiarato il glutine: si mostra come pastiglia accanto al nome. */
  senzaGlutine?: boolean;
}

const date = (s: string) => new Date(s).toLocaleDateString('it-IT');

type Chiave = 'nome' | 'email' | 'coach' | 'stato' | 'creato';

/**
 * Elenco clienti.
 *
 * Filtri e riordino in alto **come nella board dei lead** (richiesta di Simone dell'8/8), più la
 * colonna **Coach**: senza quella, per sapere di chi è una cliente si dovevano aprire le schede una
 * per una, ed è la domanda che una manager coach si fa venti volte al giorno.
 *
 * ## Perché qui il filtro è nel browser e nei lead è sul server
 *
 * Non è una dimenticanza. I lead sono decine di migliaia e vanno filtrati dal database, con debounce
 * e paginazione server-side; le clienti sono qualche centinaio e arrivano già tutte in una
 * risposta — filtrarle e ordinarle in memoria è istantaneo e non aggiunge un endpoint da mantenere.
 * Il confine è il tetto della risposta (`limite`): se un giorno le clienti lo superano la tabella lo
 * **dice** (avviso in alto) invece di far credere che si stia filtrando tutto. Quel giorno il filtro
 * andrà spostato sul server, e questo commento è il promemoria.
 */
export function Clienti() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [totale, setTotale] = useState(0);
  const [limite, setLimite] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtri (colonna per colonna, come nei lead) + ricerca libera.
  const [filter, setFilter] = useState('');
  const [fCoach, setFCoach] = useState('');
  const [fStato, setFStato] = useState('');
  /** Filtro «senza glutine»: la domanda pratica è «chi devo guardare fra queste». */
  const [fGlutine, setFGlutine] = useState('');
  const [sortKey, setSortKey] = useState<Chiave | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    (async () => {
      try {
        // Endpoint con visibilità per ruolo: coach/nutrizionista ricevono SOLO i propri
        // clienti assegnati; manager coach, capo nutrizionista e admin tutti.
        const res = await api<{ items: ClientRow[]; total: number; mostrati?: number; limite?: number }>('/admin/clients');
        setRows(res.items);
        setTotale(res.total ?? res.items.length);
        setLimite(res.limite ?? 0);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) setError('Sezione riservata.');
        else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Nome da mostrare: anagrafica se c'è, altrimenti il nome del profilo. */
  const name = (r: ClientRow) => [r.firstName, r.lastName].filter(Boolean).join(' ') || (r.nickname ?? '');

  /** Le coach presenti fra queste clienti: la tendina si costruisce dai dati, senza un altro giro. */
  const coaches = useMemo(
    () => [...new Set(rows.map((r) => r.coach).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (q && !name(r).toLowerCase().includes(q) && !r.email.toLowerCase().includes(q)) return false;
      // «— non assegnata —» è un filtro che serve: sono le clienti che nessuno sta seguendo.
      if (fCoach === 'none' && r.coach) return false;
      if (fCoach && fCoach !== 'none' && r.coach !== fCoach) return false;
      if (fStato && r.status !== fStato) return false;
      if (fGlutine === 'si' && !r.senzaGlutine) return false;
      // «da sistemare» = l'ha dichiarato ma la dieta senza glutine non ce l'ha: sono quelle su cui
      // c'è ancora qualcosa da fare, ed è l'elenco che serve dopo aver generato la variante.
      if (fGlutine === 'da_sistemare' && (!r.senzaGlutine || r.dietFamily === 'Mediterranea senza glutine')) return false;
      return true;
    });
    if (sortKey) {
      const valore = (r: ClientRow): string => {
        if (sortKey === 'nome') return name(r).toLowerCase();
        if (sortKey === 'email') return r.email.toLowerCase();
        // Chi non ha coach va in fondo in ordine crescente, non in cima come farebbe la stringa
        // vuota: le righe "vuote" davanti nascondono quelle che stai cercando.
        if (sortKey === 'coach') return (r.coach ?? 'zzz').toLowerCase();
        if (sortKey === 'stato') return r.status;
        return r.createdAt; // ISO: l'ordine alfabetico è quello cronologico
      };
      out = [...out].sort((a, b) => valore(a).localeCompare(valore(b)) * (sortDir === 'asc' ? 1 : -1));
    }
    return out;
  }, [rows, filter, fCoach, fStato, fGlutine, sortKey, sortDir]);

  const pg = usePagination(filtered, 100);
  const filtriAttivi = !!(filter || fCoach || fStato || fGlutine);

  function ordina(key: Chiave) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function azzera() {
    setFilter(''); setFCoach(''); setFStato(''); setFGlutine('');
  }

  const th = (label: string, key: Chiave) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} onClick={() => ordina(key)} title="Clicca per ordinare">
      {label}{sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{ alignSelf: 'center', fontSize: 14, fontWeight: 800, background: 'var(--chip)', borderRadius: 999, padding: '7px 14px', whiteSpace: 'nowrap' }}
            title="Clienti che rispettano i filtri correnti"
          >
            {filtriAttivi ? `${filtered.length} di ${rows.length}` : `${totale} clienti`}
          </span>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Cerca per nome o email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select className="select" style={{ maxWidth: 230 }} value={fGlutine} onChange={(e) => setFGlutine(e.target.value)} title="Clienti che hanno dichiarato il glutine">
            <option value="">Glutine: tutte</option>
            <option value="si">Ha dichiarato il glutine</option>
            <option value="da_sistemare">Glutine senza la dieta dedicata</option>
          </select>
          {filtriAttivi && (
            <button className="btn ghost" onClick={azzera} title="Rimuovi tutti i filtri">
              <i className="ti ti-filter-off" /> Azzera filtri
            </button>
          )}
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {/* Il tetto della risposta: se è stato raggiunto lo diciamo, invece di far credere che il
          filtro stia guardando tutte le clienti. */}
      {limite > 0 && totale > rows.length && (
        <Banner kind="info">
          Mostro le {rows.length} clienti più recenti di {totale}: i filtri qui sopra lavorano su queste.
          Per cercare fra tutte usa la board dei lead, che interroga il database.
        </Banner>
      )}

      <div className="card" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">{filtriAttivi ? 'Nessuna cliente con questi filtri.' : 'Nessun cliente.'}</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                {th('Nome', 'nome')}
                {th('Email', 'email')}
                {th('Coach', 'coach')}
                {th('Stato', 'stato')}
                {th('Iscritto il', 'creato')}
                <th></th>
              </tr>
              {/* Riga dei filtri sotto le intestazioni, come nella board dei lead. */}
              <tr>
                <th style={{ padding: '4px 6px' }} colSpan={2}>
                  <input
                    className="input"
                    style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }}
                    placeholder="Nome o email…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fCoach} onChange={(e) => setFCoach(e.target.value)}>
                    <option value="">Tutte</option>
                    <option value="none">— non assegnata —</option>
                    {coaches.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </th>
                <th style={{ padding: '4px 6px' }}>
                  <select className="select" style={{ width: '100%', padding: '4px 8px', fontWeight: 400 }} value={fStato} onChange={(e) => setFStato(e.target.value)}>
                    <option value="">Tutti</option>
                    <option value="active">Attivo</option>
                    <option value="suspended">Sospeso</option>
                  </select>
                </th>
                <th style={{ padding: '4px 6px' }} />
                <th style={{ padding: '4px 6px' }} />
              </tr>
            </thead>
            <tbody>
              {pg.pageItems.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clienti/${r.id}`)}>
                  <td>
                    {name(r) || <span className="muted">—</span>}
                    {/* Il glutine NON si vede dalla tendina «Stile»: la variante senza glutine ha
                        lo stesso stile della Mediterranea, la differenza sta nella famiglia. Qui
                        si vede a colpo d'occhio, che è la domanda di chi apre questo elenco. */}
                    {r.senzaGlutine && (
                      <span
                        className="chip"
                        style={{ marginLeft: 6, fontSize: 10.5, background: '#F3E7E1', color: '#8A4B2A', border: '1px solid #E0A98A' }}
                        title={
                          r.dietFamily === 'Mediterranea senza glutine'
                            ? 'Ha dichiarato il glutine e ha la dieta senza glutine assegnata.'
                            : `Ha dichiarato il glutine, ma la dieta assegnata è «${r.dietFamily ?? '—'}»: la variante senza glutine non le è ancora arrivata.`
                        }
                      >
                        senza glutine{r.dietFamily === 'Mediterranea senza glutine' ? '' : ' ⚠️'}
                      </span>
                    )}
                  </td>
                  <td>{r.email}</td>
                  <td>{r.coach ?? <span className="muted" title="Nessuna coach assegnata">—</span>}</td>
                  <td><span className={`chip ${r.status === 'active' ? '' : 'amber'}`}>{r.status === 'active' ? 'Attivo' : 'Sospeso'}</span></td>
                  <td className="muted">{date(r.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}><i className="ti ti-chevron-right muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} from={pg.from} to={pg.to} onPage={pg.setPage} />
      </div>
    </>
  );
}
