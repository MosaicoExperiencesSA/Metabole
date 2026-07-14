import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Banner } from '../components/ui';

/**
 * Import delle liste storiche (solo admin). Carica il CSV già preparato
 * (Metabole_Import_Pronto.csv), fa un'anteprima (dry-run) e poi importa in lotti
 * con barra di avanzamento. Match/dedup su telefono o email; le liste e la coach
 * si agganciano da sole.
 */
type Row = {
  email?: string; phone?: string; name?: string; lists?: string;
  previousStatus?: string; historicalPaidCents?: number; coachRefCode?: string;
  codiceFiscale?: string; address?: string;
};
type Summary = { created: number; merged: number; skipped: number; coachAssigned: number; listLinks: number; newLists: string[] };

const BATCH = 500;

/** Parser CSV minimale ma robusto (gestisce virgolette e virgole nei campi). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toRows(csv: string): { rows: Row[]; errors: string[] } {
  const grid = parseCsv(csv);
  if (grid.length < 2) return { rows: [], errors: ['Il file è vuoto o senza righe dati.'] };
  const head = grid[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const iE = col('email'), iP = col('phone'), iN = col('name'), iL = col('lists'),
    iS = col('previous_status'), iH = col('historical_paid_cents'), iC = col('coach_ref_code'),
    iCF = col('codice_fiscale'), iA = col('address');
  const errors: string[] = [];
  if (iE < 0 && iP < 0) errors.push('Manca la colonna email o phone.');
  const rows: Row[] = [];
  for (let r = 1; r < grid.length; r++) {
    const g = grid[r];
    const hv = iH >= 0 ? g[iH]?.trim() : '';
    rows.push({
      email: iE >= 0 ? g[iE]?.trim() : undefined,
      phone: iP >= 0 ? g[iP]?.trim() : undefined,
      name: iN >= 0 ? g[iN]?.trim() : undefined,
      lists: iL >= 0 ? g[iL]?.trim() : undefined,
      previousStatus: iS >= 0 ? g[iS]?.trim() : undefined,
      historicalPaidCents: hv ? Math.round(Number(hv)) : undefined,
      coachRefCode: iC >= 0 ? g[iC]?.trim() : undefined,
      codiceFiscale: iCF >= 0 ? g[iCF]?.trim() : undefined,
      address: iA >= 0 ? g[iA]?.trim() : undefined,
    });
  }
  return { rows, errors };
}

export function ImportaLead() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Summary | null>(null);
  const [result, setResult] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null); setPreview(null); setResult(null); setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const { rows, errors } = toRows(String(reader.result ?? ''));
      if (errors.length) { setError(errors.join(' ')); setRows([]); return; }
      setRows(rows);
    };
    reader.onerror = () => setError('Lettura del file non riuscita.');
    reader.readAsText(f);
  }

  async function run(dryRun: boolean) {
    if (!rows.length) return;
    setBusy(true); setError(null); setProgress(0);
    if (dryRun) setPreview(null); else setResult(null);
    const agg: Summary = { created: 0, merged: 0, skipped: 0, coachAssigned: 0, listLinks: 0, newLists: [] };
    const newListSet = new Set<string>();
    try {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const s = await api<Summary>('/crm/leads/import', { method: 'POST', body: JSON.stringify({ dryRun, rows: batch }) });
        agg.created += s.created; agg.merged += s.merged; agg.skipped += s.skipped;
        agg.coachAssigned += s.coachAssigned; agg.listLinks += s.listLinks;
        (s.newLists ?? []).forEach((n) => newListSet.add(n));
        setProgress(Math.min(1, (i + BATCH) / rows.length));
      }
      agg.newLists = [...newListSet];
      if (dryRun) setPreview(agg); else setResult(agg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import non riuscito. Riprova: è idempotente, non crea doppioni.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <Link to="/crm/gestione" className="btn ghost sm"><i className="ti ti-arrow-left" /> Gestione lead</Link>
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Import liste storiche</h2>
        <p className="hint">
          Carica il file <b>Metabole_Import_Pronto.csv</b> (già preparato e deduplicato). Il match è su
          <b> telefono o email</b>: i contatti già presenti vengono aggiornati, non duplicati. Liste e coach si
          agganciano da sole. Puoi rilanciare lo stesso file senza rischi.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        {fileName && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{fileName} — <b>{rows.length.toLocaleString('it-IT')}</b> righe pronte</p>}
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost" onClick={() => run(true)} disabled={busy}><i className="ti ti-eye" /> Anteprima (non scrive)</button>
            <button className="btn" onClick={() => run(false)} disabled={busy}><i className="ti ti-database-import" /> Importa ora</button>
          </div>
          {busy && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 8, background: 'var(--chip)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: 'var(--deep)', transition: 'width .2s' }} />
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{Math.round(progress * 100)}% — non chiudere la pagina…</p>
            </div>
          )}
          {preview && <SummaryCard title="Anteprima (nessuna scrittura)" s={preview} kind="info" />}
          {result && <SummaryCard title="Import completato ✓" s={result} kind="ok" />}
        </div>
      )}
    </>
  );
}

function SummaryCard({ title, s, kind }: { title: string; s: Summary; kind: 'info' | 'ok' }) {
  return (
    <div style={{ marginTop: 14 }}>
      <Banner kind={kind}>
        <b>{title}</b><br />
        Nuovi contatti: <b>{s.created.toLocaleString('it-IT')}</b> · Aggiornati (già presenti): <b>{s.merged.toLocaleString('it-IT')}</b>
        {s.skipped > 0 && <> · Saltati (senza chiave): <b>{s.skipped.toLocaleString('it-IT')}</b></>}<br />
        Coach assegnate: <b>{s.coachAssigned.toLocaleString('it-IT')}</b> · Collegamenti a liste: <b>{s.listLinks.toLocaleString('it-IT')}</b>
        {s.newLists.length > 0 && <> · Nuove liste da creare: <b>{s.newLists.join(', ')}</b></>}
      </Banner>
    </div>
  );
}
