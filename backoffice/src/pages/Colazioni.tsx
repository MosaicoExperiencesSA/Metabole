import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { BottoneExcel, ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

/**
 * COLAZIONI DOLCI E SALATE — il sistema propone, una persona conferma.
 *
 * Decisione: `Decisioni_Simone_20260813.md` §12. Il tag scritto È la conferma; la proposta si
 * calcola al volo dagli ingredienti e dal nome e non si salva da nessuna parte. Una colazione senza
 * tag non partecipa alla richiesta «a colazione qualcosa di salato» (l'azione di Vera, che resta
 * spenta finché le conferme non ci sono): meglio meno scelta che una colazione sbagliata.
 */

type Tipo = 'dolce' | 'salato';
interface Colazione {
  id: string;
  name: string;
  kcal: number;
  confermato: Tipo | null;
  proposta: Tipo | null;
  indizi: string[];
}
interface Conta {
  totale: number;
  confermateSalato: number;
  confermateDolce: number;
  proposteSalato: number;
  proposteDolce: number;
  senzaProposta: number;
}

const stato = (r: Colazione): string =>
  r.confermato
    ? r.confermato === 'salato' ? 'Confermata salata' : 'Confermata dolce'
    : r.proposta
      ? r.proposta === 'salato' ? 'Proposta: salata' : 'Proposta: dolce'
      : 'Senza proposta';

export function Colazioni() {
  const [rows, setRows] = useState<Colazione[]>([]);
  const [conta, setConta] = useState<Conta | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrivendo, setScrivendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ items: Colazione[]; conta: Conta }>('/recipes/colazioni');
      setRows(r.items);
      setConta(r.conta);
      setSelezione(new Set());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata ai nutrizionisti.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function decidi(r: Colazione, tipo: Tipo | null) {
    setError(null); setNotice(null); setScrivendo(true);
    try {
      await api(`/recipes/${r.id}/colazione`, { method: 'PATCH', body: JSON.stringify({ tipo }) });
      setNotice(tipo ? `«${r.name}» confermata ${tipo === 'salato' ? 'salata' : 'dolce'}.` : `Classificazione tolta a «${r.name}».`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scrittura non riuscita.');
    } finally {
      setScrivendo(false);
    }
  }

  /**
   * L'invio a PACCHETTI: il server accetta al massimo 500 scelte per chiamata, e le proposte sono
   * di più (986 salate al primo giro — l'errore «no more than 500 elements» visto in produzione
   * il 13/8 sera). Si spezza qui, in sequenza, e si somma l'esito.
   */
  async function inviaScelte(scelte: { id: string; tipo: Tipo }[]): Promise<{ scritte: number; saltate: number }> {
    const totale = { scritte: 0, saltate: 0 };
    for (let i = 0; i < scelte.length; i += 500) {
      const esito = await api<{ scritte: number; saltate: number }>('/recipes/colazioni/conferma', {
        method: 'POST',
        body: JSON.stringify({ scelte: scelte.slice(i, i + 500) }),
      });
      totale.scritte += esito.scritte;
      totale.saltate += esito.saltate;
    }
    return totale;
  }

  async function confermaScelte(scelte: { id: string; tipo: Tipo }[], racconto: string) {
    setError(null); setNotice(null); setScrivendo(true);
    try {
      const esito = await inviaScelte(scelte);
      setNotice(`${racconto}: confermate ${esito.scritte}.${esito.saltate ? ` Saltate ${esito.saltate} (ricette sparite nel frattempo).` : ''}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conferma non riuscita.');
    } finally {
      setScrivendo(false);
    }
  }

  /** La conferma in blocco di TUTTE le proposte di un tipo ancora senza tag. */
  async function confermaBlocco(tipo: Tipo) {
    const scelte = rows.filter((r) => !r.confermato && r.proposta === tipo).map((r) => ({ id: r.id, tipo }));
    if (!scelte.length) return;
    const quali = tipo === 'salato' ? 'salate' : 'dolci';
    if (!confirm(`Confermo ${scelte.length} colazioni come ${quali}?\n\nSono le proposte del sistema che vedi in tabella filtrando «Proposta: ${tipo === 'salato' ? 'salata' : 'dolce'}». Se qualcuna non ti convince, prima correggila dalla sua riga.`)) return;
    await confermaScelte(scelte, `Proposte ${quali}`);
  }

  /**
   * La conferma della SELEZIONE (richiesta di Simone, 13/8 sera): ogni riga spuntata si conferma
   * con la SUA proposta. Le spuntate senza proposta o già confermate si saltano e si conta.
   */
  async function confermaSelezione() {
    const spuntate = rows.filter((r) => selezione.has(r.id));
    const scelte = spuntate.filter((r) => !r.confermato && r.proposta).map((r) => ({ id: r.id, tipo: r.proposta as Tipo }));
    const fuori = spuntate.length - scelte.length;
    if (!scelte.length) {
      setNotice('Nella selezione non c\'è nessuna proposta da confermare: le righe senza proposta si decidono una a una.');
      return;
    }
    if (!confirm(`Confermo ${scelte.length} colazioni con la loro proposta?${fuori ? `\n\n${fuori} righe selezionate non hanno una proposta (o sono già confermate): quelle restano come sono.` : ''}`)) return;
    await confermaScelte(scelte, 'Selezione');
  }

  const COLONNE: Colonna<Colazione>[] = [
    { chiave: 'sel', titolo: '✓', stile: { width: 36 } },
    { chiave: 'ricetta', titolo: 'Ricetta', valore: (r) => r.name, filtro: 'testo' },
    { chiave: 'kcal', titolo: 'kcal', valore: (r) => String(r.kcal), stile: { width: 70 } },
    // Gli indizi si mostrano, non si nascondono: sono il motivo della proposta.
    { chiave: 'indizi', titolo: 'Indizi', valore: (r) => r.indizi.join(', '), filtro: 'testo' },
    // «Proposta» e «Senza proposta» prima delle confermate: è l'ordine del lavoro.
    { chiave: 'stato', titolo: 'Stato', valore: stato, filtro: 'scelta', etichettaTutti: 'Tutte', ordineScelte: ['Proposta: salata', 'Proposta: dolce', 'Senza proposta', 'Confermata salata', 'Confermata dolce'], stile: { width: 165 } },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right', width: 210 } },
  ];

  const t = useTabella(rows, COLONNE, {
    testaFissa: true,
    ordineIniziale: { chiave: 'ricetta' },
    nomeExcel: 'Colazioni dolci e salate',
  });

  if (loading) return <Spinner />;

  const daFare = conta ? conta.proposteSalato + conta.proposteDolce + conta.senzaProposta : 0;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Le ricette dello slot colazione: il sistema propone <b>dolce</b> o <b>salata</b> dagli ingredienti,
          tu confermi. Una colazione senza conferma <b>non partecipa</b> alla richiesta «a colazione qualcosa
          di salato» dell'assistente — che resta spenta finché le conferme non bastano.
          {conta && (<> Sono <b>{conta.totale}</b> in tutto: <b>{daFare}</b> da decidere, {conta.confermateSalato} salate e {conta.confermateDolce} dolci già confermate.</>)}
        </p>
      </div>

      <div className="spread" style={{ marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="colazioni" />
          <BottoneExcel tabella={t} />
          {conta && conta.proposteSalato > 0 && (
            <button className="btn sm" disabled={scrivendo} onClick={() => void confermaBlocco('salato')}>
              Conferma le {conta.proposteSalato} proposte salate
            </button>
          )}
          {conta && conta.proposteDolce > 0 && (
            <button className="btn ghost sm" disabled={scrivendo} onClick={() => void confermaBlocco('dolce')}>
              Conferma le {conta.proposteDolce} proposte dolci
            </button>
          )}
          {selezione.size > 0 && (
            <button className="btn sm" disabled={scrivendo} onClick={() => void confermaSelezione()}>
              Conferma la selezione ({selezione.size})
            </button>
          )}
          {selezione.size > 0 && (
            <button className="btn ghost sm" disabled={scrivendo} onClick={() => setSelezione(new Set())}>
              Svuota
            </button>
          )}
          <button
            className="btn ghost sm"
            disabled={scrivendo}
            title="Spunta tutte le righe della pagina che vedi (coi filtri attivi)"
            onClick={() => setSelezione((prima) => {
              const dopo = new Set(prima);
              const tutteSpuntate = t.pagina.every((r) => dopo.has(r.id));
              for (const r of t.pagina) { if (tutteSpuntate) dopo.delete(r.id); else dopo.add(r.id); }
              return dopo;
            })}
          >
            {t.pagina.every((r) => selezione.has(r.id)) && t.pagina.length > 0 ? 'Togli la pagina' : 'Seleziona la pagina'}
          </button>
        </div>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Cerca in tutte le colonne…"
          value={t.ricerca}
          onChange={(e) => t.setRicerca(e.target.value)}
        />
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">
            {rows.length === 0 ? 'Nessuna ricetta di colazione nel catalogo.' : 'Nessuna colazione con questi filtri.'}
          </div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selezione.has(r.id)}
                      onChange={() => setSelezione((prima) => {
                        const dopo = new Set(prima);
                        if (dopo.has(r.id)) dopo.delete(r.id); else dopo.add(r.id);
                        return dopo;
                      })}
                    />
                  </td>
                  <td><b>{r.name}</b></td>
                  <td className="muted">{r.kcal}</td>
                  <td className="muted">{r.indizi.join(', ') || '—'}</td>
                  <td>
                    <span className={`chip ${r.confermato ? '' : 'gray'}`}>{stato(r)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {r.confermato !== 'salato' && (
                        <button className="btn ghost sm" disabled={scrivendo} onClick={() => void decidi(r, 'salato')}>Salata</button>
                      )}
                      {r.confermato !== 'dolce' && (
                        <button className="btn ghost sm" disabled={scrivendo} onClick={() => void decidi(r, 'dolce')}>Dolce</button>
                      )}
                      {r.confermato && (
                        <button className="btn ghost sm" title="Togli la classificazione" disabled={scrivendo} onClick={() => void decidi(r, null)}>Togli</button>
                      )}
                    </div>
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
