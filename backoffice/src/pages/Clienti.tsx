import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

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

  /** Filtro «senza glutine»: la domanda pratica è «chi devo guardare fra queste». */
  const [fGlutine, setFGlutine] = useState('');

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

  /**
   * Il glutine resta un filtro sopra la tabella e non un filtro di colonna: incrocia la
   * dichiarazione della cliente con la famiglia di dieta assegnata, e nessuna delle due è una
   * colonna di questa tabella (la pastiglia sta dentro la cella del nome).
   */
  const preFiltrate = useMemo(() => {
    if (!fGlutine) return rows;
    return rows.filter((r) => {
      if (fGlutine === 'si' && !r.senzaGlutine) return false;
      // «da sistemare» = l'ha dichiarato ma la dieta senza glutine non ce l'ha: sono quelle su cui
      // c'è ancora qualcosa da fare, ed è l'elenco che serve dopo aver generato la variante.
      if (fGlutine === 'da_sistemare' && (!r.senzaGlutine || r.dietFamily === 'Mediterranea senza glutine')) return false;
      return true;
    });
  }, [rows, fGlutine]);

  const COLONNE: Colonna<ClientRow>[] = [
    { chiave: 'nome', titolo: 'Nome', valore: (r) => name(r), filtro: 'testo' },
    { chiave: 'email', titolo: 'Email', valore: (r) => r.email, filtro: 'testo' },
    // Le clienti senza coach vanno in fondo: lo fa l'helper per tutte le colonne. Prima qui c'era
    // un `?? 'zzz'`, che una coach col nome che inizia per z avrebbe scavalcato.
    { chiave: 'coach', titolo: 'Coach', valore: (r) => r.coach, filtro: 'scelta', etichettaTutti: 'Tutte' },
    // L'etichetta che si legge nella cella, non `active`/`suspended`.
    { chiave: 'stato', titolo: 'Stato', valore: (r) => (r.status === 'active' ? 'Attivo' : 'Sospeso'), filtro: 'scelta', etichettaTutti: 'Tutti' },
    // La data ISO grezza: si ordina bene alfabeticamente, quella scritta in italiano no.
    { chiave: 'creato', titolo: 'Iscritto il', valore: (r) => r.createdAt },
    { chiave: 'apri', titolo: '' },
  ];

  // L'elenco arriva dal server dalla più recente: è l'ordine con cui la pagina si apre da sempre.
  const t = useTabella(preFiltrate, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'creato', direzione: 'desc' } });
  const filtriAttivi = t.filtriAttivi || fGlutine !== '';
  function azzeraTutto() {
    t.azzera();
    setFGlutine('');
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        {/*
          Senza filtri si dice il totale VERO (il `count` del server), non le righe caricate: «340
          clienti» è il numero che l'ufficio si aspetta di leggere, e mostrarne uno più piccolo
          perché il server ne manda 500 alla volta sarebbe una bugia sul dato più guardato della
          pagina. Con i filtri attivi il «di quante» è quello caricato — è l'insieme su cui i filtri
          lavorano davvero — e la differenza fra i due la dichiara l'avviso del tetto qui sotto.
        */}
        <ContatoreRighe
          conteggio={{ mostrate: t.conteggio.mostrate, totali: filtriAttivi ? rows.length : totale || rows.length }}
          filtriAttivi={filtriAttivi}
          azzera={azzeraTutto}
          nome="clienti"
        />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
          <select className="select" style={{ maxWidth: 230 }} value={fGlutine} onChange={(e) => setFGlutine(e.target.value)} title="Clienti che hanno dichiarato il glutine">
            <option value="">Glutine: tutte</option>
            <option value="si">Ha dichiarato il glutine</option>
            <option value="da_sistemare">Glutine senza la dieta dedicata</option>
          </select>
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
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{filtriAttivi ? 'Nessuna cliente con questi filtri.' : 'Nessun cliente.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
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
        <Pager {...t.pager} />
      </div>
    </>
  );
}
