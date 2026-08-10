import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Banner, Pager, Spinner } from '../components/ui';
import { ContatoreRighe, useTabella, type Colonna } from '../components/tabella';

interface Commission {
  id: string;
  date: string;
  amountCents: number;
  recipientId: string | null;
  recipient: string;
  clientId: string | null;
  client: string;
  product: string;
}

const euro = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');
const date = (s: string) => new Date(s).toLocaleDateString('it-IT');

/** Quante righe manda al massimo `GET /admin/commissions`: oltre questo tetto i filtri non arrivano. */
const TETTO_SERVER = 1000;

export function Provvigioni() {
  const [rows, setRows] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cliente, prodotto e ricevente sono diventati filtri di colonna; min/max restano qui sopra
  // perché l'helper filtra per testo o per scelta, e «da 50 a 200 €» non è né l'uno né l'altro.
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setRows(await api<Commission[]>('/admin/commissions'));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function deleteRow(r: Commission) {
    if (!confirm(`Eliminare questa provvigione di ${euro(r.amountCents)} a ${r.recipient}?\nVerrà scalata anche dai compensi dello staff.`)) return;
    setError(null);
    try {
      await api(`/admin/commissions/${r.id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const preFiltrate = useMemo(() => {
    const minC = min ? parseFloat(min) * 100 : null;
    const maxC = max ? parseFloat(max) * 100 : null;
    if (minC == null && maxC == null) return rows;
    return rows.filter((r) => {
      if (minC != null && r.amountCents < minC) return false;
      if (maxC != null && r.amountCents > maxC) return false;
      return true;
    });
  }, [rows, min, max]);

  const COLONNE: Colonna<Commission>[] = [
    // La data ISO grezza: si ordina bene alfabeticamente, la formattata in italiano no.
    { chiave: 'data', titolo: 'Data', valore: (r) => r.date },
    { chiave: 'cliente', titolo: 'Cliente', valore: (r) => r.client, filtro: 'testo' },
    { chiave: 'prodotto', titolo: 'Prodotto', valore: (r) => r.product, filtro: 'testo' },
    { chiave: 'ricevente', titolo: 'Ricevente', valore: (r) => r.recipient, filtro: 'scelta', etichettaTutti: 'Tutti' },
    // I centesimi, non «€ 297,00»: come testo «€ 100,00» finirebbe prima di «€ 20,00».
    { chiave: 'importo', titolo: 'Importo', valore: (r) => r.amountCents, stile: { textAlign: 'right' } },
    { chiave: 'azioni', titolo: '' },
  ];

  // Il server manda le più recenti in cima: lo stesso ordine resta quello di partenza.
  const t = useTabella(preFiltrate, COLONNE, { ordineIniziale: { chiave: 'data', direzione: 'desc' } });
  const filtriSopra = min !== '' || max !== '';
  function azzeraTutto() { t.azzera(); setMin(''); setMax(''); }

  // Il totale segue i filtri: è la somma di quello che si sta guardando, non di tutto.
  const total = t.tutte.reduce((a, r) => a + r.amountCents, 0);

  if (loading) return <Spinner />;

  return (
    <>
      {error && <Banner kind="err">{error}</Banner>}

      {/* Il tetto si dichiara: filtrare e non trovare niente non vuol dire che la provvigione non c'è. */}
      {rows.length >= TETTO_SERVER && (
        <Banner kind="info">
          Sono caricate le <b>ultime {TETTO_SERVER} provvigioni</b>: ordinamento e filtri lavorano solo su queste.
        </Banner>
      )}

      <div className="spread" style={{ marginBottom: 10, gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <ContatoreRighe
          conteggio={{ mostrate: t.conteggio.mostrate, totali: rows.length }}
          filtriAttivi={t.filtriAttivi || filtriSopra}
          azzera={azzeraTutto}
          nome="provvigioni"
        />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Cerca in tutte le colonne…" value={t.ricerca} onChange={(e) => t.setRicerca(e.target.value)} />
          <Field label="Importo min (€)"><input className="input sm" type="number" step="0.01" style={{ width: 110 }} value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Importo max (€)"><input className="input sm" type="number" step="0.01" style={{ width: 110 }} value={max} onChange={(e) => setMax(e.target.value)} /></Field>
          <span><b>Totale: {euro(total)}</b></span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">{rows.length === 0 ? 'Nessuna provvigione.' : 'Nessuna provvigione con questi filtri.'}</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{date(r.date)}</td>
                  <td>{r.client}</td>
                  <td className="muted">{r.product}</td>
                  <td>{r.recipient}</td>
                  <td style={{ textAlign: 'right' }}><b>{euro(r.amountCents)}</b></td>
                  <td style={{ textAlign: 'right', width: 36 }}>
                    <button
                      onClick={() => deleteRow(r)}
                      title="Elimina provvigione"
                      style={{ border: 'none', background: 'transparent', color: '#e5484d', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
                    >
                      <i className="ti ti-x" />
                    </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
