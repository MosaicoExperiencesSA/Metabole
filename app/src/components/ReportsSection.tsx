import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

/**
 * Elenco dei report del cliente (GET /me/reports), riusabile in due forme:
 *  - variant="card"  → una card in evidenza con l'ULTIMO report (per la Home/dashboard,
 *                      così appena viene generato il report — es. quello dei primi giorni
 *                      di prova — la cliente lo trova subito).
 *  - variant="list"  → l'elenco completo dei report (per la pagina Obiettivi).
 * Se non ci sono report non mostra nulla. Ogni voce apre /report/:id.
 */

interface ReportHead {
  id: string; kind: string; planName: string;
  periodStart: string; periodEnd: string; read: boolean; createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  trial: 'Settimana gratuita',
  monthly: 'Diario del mese',
  plan: 'Fine percorso',
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

export default function ReportsSection({ variant = 'list' }: { variant?: 'list' | 'card' }) {
  const nav = useNavigate();
  const [reports, setReports] = useState<ReportHead[] | null>(null);

  useEffect(() => {
    api<ReportHead[]>('/me/reports')
      .then((r) => setReports(Array.isArray(r) ? r : []))
      .catch(() => setReports([]));
  }, []);

  if (!reports || reports.length === 0) return null;

  if (variant === 'card') {
    const latest = reports[0];
    return (
      <div
        className="card"
        style={{ marginBottom: 12, border: '1.5px solid #C9BEF3', background: '#F4F1FE', cursor: 'pointer', display: 'flex', gap: 11, alignItems: 'center' }}
        onClick={() => nav(`/report/${latest.id}`)}
      >
        <span style={{ width: 40, height: 40, borderRadius: 12, background: '#7C3AED', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <i className="ti ti-file-analytics" style={{ fontSize: 21 }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            Il tuo report è pronto
            {!latest.read && <span className="livedot" style={{ background: '#E8543C' }} />}
          </div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>
            {KIND_LABEL[latest.kind] ?? 'Report'} · {fmt(latest.periodStart)}–{fmt(latest.periodEnd)}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', flex: 'none' }}>
          Apri <i className="ti ti-chevron-right" style={{ fontSize: 12, verticalAlign: '-1px' }} />
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="sec">I tuoi report</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {reports.map((h) => (
          <div
            key={h.id}
            className="card"
            style={{ margin: 0, display: 'flex', gap: 11, alignItems: 'center', cursor: 'pointer' }}
            onClick={() => nav(`/report/${h.id}`)}
          >
            <span style={{ width: 38, height: 38, borderRadius: 11, background: '#EDE7FB', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <i className="ti ti-file-analytics" style={{ fontSize: 19 }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {KIND_LABEL[h.kind] ?? 'Report'}
                {!h.read && <span className="livedot" style={{ background: '#E8543C' }} />}
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{fmt(h.periodStart)}–{fmt(h.periodEnd)}</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--teal)', flex: 'none' }}>
              Apri <i className="ti ti-chevron-right" style={{ fontSize: 11, verticalAlign: '-1px' }} />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
