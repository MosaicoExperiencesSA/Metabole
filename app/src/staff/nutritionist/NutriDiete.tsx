import { api } from '../../api/client';
import { fullName, shortDate } from '../format';
import { useApi, useAction } from '../hooks';
import { Async, Card, Empty, Section, StaffShell } from '../ui';
import { NUTRI_TABS } from '../tabs';

interface Decision {
  id: string;
  clientId: string;
  patientName: string | null;
  date: string;
  flagReason: string | null;
  rule: { id: string; name: string } | null;
}
interface Queue {
  engineDecisions: Decision[];
  protocolsPending: { id: string; name: string; type: string }[];
  counts: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
}
interface DietRow {
  id: string;
  name: string;
  regime: string;
  style: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
}

const DIET_STATUS: Record<DietRow['status'], [string, string, string]> = {
  approved: ['#DCF0D8', '#3B6D11', 'Approvata'],
  in_review: ['#FDF3DD', '#B8863B', 'In revisione'],
  draft: ['#F2F5F4', '#8A938F', 'Bozza'],
  rejected: ['#FBE3E3', '#B4491F', 'Rifiutata'],
};

export default function NutriDiete() {
  const queue = useApi<Queue>('/nutritionist/validation-queue');
  const diets = useApi<DietRow[]>('/diets');
  const [decide, decState] = useAction(async (id: string, action: 'confirm' | 'correct') => {
    await api(`/nutritionist/decisions/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) });
  });

  async function run(id: string, action: 'confirm' | 'correct') {
    const ok = await decide(id, action);
    if (ok) queue.reload();
  }

  return (
    <StaffShell title="Diete e protocolli" tabs={NUTRI_TABS}>
      <Async state={queue}>
        {(q) => (
          <>
            <Section title="Decisioni del motore da validare" />
            {q.engineDecisions.length === 0 ? (
              <Card>
                <div className="sf-sub">Nessuna decisione in attesa. ✅</div>
              </Card>
            ) : (
              <Card className="pad0">
                {q.engineDecisions.map((dec) => (
                  <div key={dec.id} className="sf-alert" style={{ flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div className="sf-alert-t">{fullName(dec.patientName)}</div>
                      <div className="sf-alert-d">
                        {dec.rule?.name || 'Adattamento menu'}
                        {dec.flagReason ? ` · ${dec.flagReason}` : ''}
                      </div>
                      <div className="sf-sub" style={{ marginTop: 3 }}>
                        {shortDate(dec.date)}
                      </div>
                    </div>
                    <div className="sf-acts">
                      <button
                        className="sf-mini b"
                        disabled={decState.loading}
                        onClick={() => run(dec.id, 'confirm')}
                      >
                        <i className="ti ti-check" /> Conferma
                      </button>
                      <button
                        className="sf-mini"
                        disabled={decState.loading}
                        onClick={() => run(dec.id, 'correct')}
                      >
                        <i className="ti ti-edit" /> Correggi
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {q.protocolsPending.length > 0 && (
              <>
                <Section title="Protocolli da validare" />
                <Card className="pad0">
                  {q.protocolsPending.map((pr) => (
                    <div key={pr.id} className="sf-row" style={{ cursor: 'default' }}>
                      <div className="sf-row-main">
                        <div className="sf-row-name">{pr.name}</div>
                        <div className="sf-row-sub">{pr.type}</div>
                      </div>
                      <span className="sf-pill" style={{ background: '#FDF3DD', color: '#B8863B' }}>
                        In attesa
                      </span>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </Async>

      <Section title="Catalogo diete" />
      <Async state={diets} empty={<Empty icon="ti-salad" text="Nessuna dieta in catalogo." />}>
        {(list) =>
          list.length === 0 ? (
            <Empty icon="ti-salad" text="Nessuna dieta in catalogo." />
          ) : (
            <Card className="pad0">
              {list.map((d) => {
                const s = DIET_STATUS[d.status] ?? DIET_STATUS.draft;
                return (
                  <div key={d.id} className="sf-row" style={{ cursor: 'default' }}>
                    <div className="sf-row-main">
                      <div className="sf-row-name">{d.name}</div>
                      <div className="sf-row-sub">
                        {d.regime} · {d.style}
                      </div>
                    </div>
                    <span className="sf-pill" style={{ background: s[0], color: s[1] }}>
                      {s[2]}
                    </span>
                  </div>
                );
              })}
            </Card>
          )
        }
      </Async>
      <div className="sf-sub" style={{ textAlign: 'center', margin: '10px 4px 0' }}>
        Le diete vanno approvate dal nutrizionista capo prima di entrare in catalogo.
      </div>
    </StaffShell>
  );
}
