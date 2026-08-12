import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';
import { pastigliaStadio } from '../lib/stadio';

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
  /** Stadio della pipeline (`CrmRecord.stage`). `null` = nessuna scheda CRM. */
  stage?: string | null;
}

/** Gli stadi della pipeline, con l'etichetta e il colore decisi dal backoffice. */
interface Stadio { key: string; label: string; color: string | null; order: number }

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
  const { can, impersonate } = useAuth();
  /**
   * «Entra come» anche da qui (richiesta di Simone dell'11/8). C'era in Gestione lead, nella scheda
   * lead e in Utenti — cioè ovunque tranne che nell'elenco da cui una coach parte davvero quando una
   * cliente la chiama. Il permesso è quello nuovo `impersonate`, non il ruolo scritto nel codice.
   */
  const puoEntrare = can('impersonate', 'manage');
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [totale, setTotale] = useState(0);
  const [limite, setLimite] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stadi, setStadi] = useState<Stadio[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // Endpoint con visibilità per ruolo: coach/nutrizionista ricevono SOLO i propri
        // clienti assegnati; manager coach, capo nutrizionista e admin tutti.
        const [res, st] = await Promise.all([
          api<{ items: ClientRow[]; total: number; mostrati?: number; limite?: number }>('/admin/clients'),
          // Gli stadi vivono nel CRM e li disegna il backoffice: l'elenco Clienti li LEGGE, non li
          // ridefinisce. Se la chiamata non riesce si mostra la chiave grezza invece di niente.
          api<Stadio[]>('/crm/stages').catch(() => [] as Stadio[]),
        ]);
        setStadi(st);
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

  async function entraCome(r: ClientRow) {
    setError(null);
    try {
      await impersonate(r.id, r.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non sono riuscito a entrare in questo account.');
    }
  }

  /**
   * Il filtro «Glutine» sopra la tabella è stato TOLTO l'11/8 («questo filtro non serve»). La
   * **pastiglia** dentro la cella del nome resta: non è un filtro, è il segno che quella cliente ha
   * dichiarato il glutine e non ha ancora la dieta dedicata — l'unico posto in cui si vede.
   */
  const stadioDi = (chiave: string | null | undefined) => stadi.find((s) => s.key === chiave) ?? null;

  const COLONNE: Colonna<ClientRow>[] = [
    { chiave: 'nome', titolo: 'Nome', valore: (r) => name(r), filtro: 'testo' },
    { chiave: 'email', titolo: 'Email', valore: (r) => r.email, filtro: 'testo' },
    // Le clienti senza coach vanno in fondo: lo fa l'helper per tutte le colonne. Prima qui c'era
    // un `?? 'zzz'`, che una coach col nome che inizia per z avrebbe scavalcato.
    { chiave: 'coach', titolo: 'Coach', valore: (r) => r.coach, filtro: 'scelta', etichettaTutti: 'Tutte' },
    /**
     * «Stato» è lo **stadio della pipeline**, lo stesso di Gestione lead (richiesta dell'11/8).
     * Prima diceva `Attivo`/`Sospeso`, cioè lo stato dell'ACCOUNT: riguarda l'accesso, non il
     * rapporto — ed è «Attivo» anche per chi ha smesso di pagare sei mesi fa. Il valore ordinato e
     * filtrato è l'ETICHETTA, non la chiave: nella tendina si legge «Cliente», non `paid`.
     */
    { chiave: 'stato', titolo: 'Stato', valore: (r) => stadioDi(r.stage)?.label ?? r.stage ?? '—', filtro: 'scelta', etichettaTutti: 'Tutti' },
    // La data ISO grezza: si ordina bene alfabeticamente, quella scritta in italiano no.
    { chiave: 'creato', titolo: 'Iscritto il', valore: (r) => r.createdAt },
    { chiave: 'apri', titolo: '' },
  ];

  // L'elenco arriva dal server dalla più recente: è l'ordine con cui la pagina si apre da sempre.
  const t = useTabella(rows, COLONNE, { testaFissa: true, ordineIniziale: { chiave: 'creato', direzione: 'desc' }, nomeExcel: 'Clienti'});
  const filtriAttivi = t.filtriAttivi;

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
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe
          conteggio={{ mostrate: t.conteggio.mostrate, totali: filtriAttivi ? rows.length : totale || rows.length }}
          filtriAttivi={filtriAttivi}
          azzera={t.azzera}
          nome="clienti"
        />
          <BottoneExcel tabella={t} avviso={limite > 0 && totale > rows.length ? `Questa pagina ha caricato ${rows.length} clienti su ${totale}: il file conterrà le ${t.conteggio.mostrate} righe che vedi, scelte fra quelle. Per cercare fra tutte usa la board dei lead. Scarico lo stesso?` : undefined} />
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
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
                  <td>
                    {(() => {
                      const st = stadioDi(r.stage);
                      return (
                        <span style={pastigliaStadio(st?.color)} title={st ? `Stadio della pipeline: ${st.label}` : 'Nessuna scheda CRM per questa cliente'}>
                          {st?.label ?? r.stage ?? '—'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="muted">{date(r.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {puoEntrare && r.status === 'active' && (
                      <button
                        className="btn ghost sm"
                        style={{ marginRight: 8 }}
                        // La riga apre la scheda: senza questo, «Entra come» aprirebbe ANCHE la scheda.
                        onClick={(e) => { e.stopPropagation(); entraCome(r); }}
                        title="Guarda l'app con i suoi occhi, in sola lettura: per 30 minuti, e resta scritto nell'audit"
                      >
                        <i className="ti ti-eye" /> Entra come
                      </button>
                    )}
                    <i className="ti ti-chevron-right muted" />
                  </td>
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
