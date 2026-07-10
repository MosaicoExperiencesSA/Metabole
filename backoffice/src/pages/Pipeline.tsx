import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';

interface Stage {
  key: string;
  label: string;
  color: string | null;
  order: number;
  isSystem: boolean;
}
interface Card {
  id: string;
  clientId: string | null;
  stage: string;
  name: string;
  email: string | null;
  coach: string | null;
  owner: string | null;
  valueCents: number | null;
  daysInStage: number | null;
  isClient: boolean;
}
interface Board {
  stages: Stage[];
  cards: Record<string, Card[]>;
  orphans: Card[];
  total: number;
}

function euro(cents: number | null): string | null {
  if (cents == null) return null;
  return '€ ' + (cents / 100).toFixed(0);
}

export function Pipeline() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canManageStages = can('permissions', 'manage'); // gestione stati = admin (come permessi)
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [showStages, setShowStages] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setBoard(await api<Board>('/crm/pipeline'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function move(cardId: string, toStage: string) {
    if (!board) return;
    const from = Object.keys(board.cards).find((k) => board.cards[k].some((c) => c.id === cardId));
    if (!from || from === toStage) return;
    // Ottimistico: sposto subito la scheda.
    const card = board.cards[from].find((c) => c.id === cardId)!;
    setBoard({
      ...board,
      cards: {
        ...board.cards,
        [from]: board.cards[from].filter((c) => c.id !== cardId),
        [toStage]: [{ ...card, stage: toStage, daysInStage: 0 }, ...(board.cards[toStage] ?? [])],
      },
    });
    try {
      await api(`/crm/leads/${cardId}/stage`, { method: 'POST', body: JSON.stringify({ stage: toStage }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spostamento non riuscito.');
      await load(); // ripristina lo stato reale
    }
  }

  if (loading) return <Spinner />;
  if (!board) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          {board.total} tra clienti e lead. Trascina una scheda per cambiarne lo stato.
        </p>
        {canManageStages && (
          <button className="btn ghost" onClick={() => setShowStages(true)}>
            <i className="ti ti-settings" /> Gestisci stati
          </button>
        )}
      </div>

      {error && <Banner kind="err">{error}</Banner>}

      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
        {board.stages.map((s) => {
          const cards = board.cards[s.key] ?? [];
          const isOver = overStage === s.key;
          return (
            <div
              key={s.key}
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.key); }}
              onDragLeave={() => setOverStage((cur) => (cur === s.key ? null : cur))}
              onDrop={(e) => { e.preventDefault(); setOverStage(null); if (dragId) void move(dragId, s.key); setDragId(null); }}
              style={{
                width: 250,
                flex: 'none',
                background: isOver ? (s.color ?? '#12a386') + '18' : '#f3f1ea',
                border: `1px solid ${isOver ? (s.color ?? '#12a386') : 'var(--line)'}`,
                borderRadius: 14,
                padding: 10,
                minHeight: 120,
              }}
            >
              <div className="spread" style={{ marginBottom: 8, padding: '2px 4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color ?? '#7c8c88' }} />
                  {s.label}
                </span>
                <span className="chip gray">{cards.length}</span>
              </div>
              {cards.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => setDragId(null)}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--line)',
                    borderRadius: 11,
                    padding: '10px 12px',
                    marginBottom: 8,
                    cursor: 'grab',
                    boxShadow: dragId === c.id ? '0 8px 20px rgba(16,64,58,.15)' : 'var(--shadow)',
                    opacity: dragId === c.id ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    {c.clientId ? (
                      <b
                        style={{ fontSize: 14, color: 'var(--teal-dark)', cursor: 'pointer' }}
                        title="Apri la scheda cliente"
                        onClick={(e) => { e.stopPropagation(); navigate(`/clienti/${c.clientId}`); }}
                      >
                        {c.name}
                      </b>
                    ) : (
                      <b style={{ fontSize: 14 }}>{c.name}</b>
                    )}
                    {!c.isClient && <span className="chip amber" style={{ fontSize: 10 }}>lead</span>}
                  </div>
                  {c.email && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{c.email}</div>}
                  <div className="row" style={{ gap: 8, marginTop: 8, fontSize: 12 }}>
                    {c.coach && (
                      <span className="muted"><i className="ti ti-user" /> {c.coach}</span>
                    )}
                    {c.daysInStage != null && (
                      <span className="muted" title="giorni in questo stato"><i className="ti ti-clock" /> {c.daysInStage}g</span>
                    )}
                    {euro(c.valueCents) && <span className="chip" style={{ fontSize: 11 }}>{euro(c.valueCents)}</span>}
                  </div>
                </div>
              ))}
              {cards.length === 0 && <div className="muted" style={{ fontSize: 12, textAlign: 'center', padding: 14 }}>—</div>}
            </div>
          );
        })}
      </div>

      {board.orphans.length > 0 && (
        <Banner kind="info">
          {board.orphans.length} scheda/e in uno stato non più presente. Trascinale in uno stato valido.
        </Banner>
      )}

      {showStages && (
        <StagesModal
          stages={board.stages}
          onClose={() => setShowStages(false)}
          onChanged={() => { void load(); }}
        />
      )}
    </>
  );
}

function StagesModal({ stages, onClose, onChanged }: { stages: Stage[]; onClose: () => void; onChanged: () => void }) {
  const [list, setList] = useState<Stage[]>(stages);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#12a386');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  async function addStage() {
    if (newLabel.trim().length < 2) { setError('Dai un nome allo stato.'); return; }
    await run(async () => {
      const created = await api<Stage>('/crm/stages', { method: 'POST', body: JSON.stringify({ label: newLabel.trim(), color: newColor }) });
      setList((l) => [...l, created]);
      setNewLabel('');
    });
  }
  async function rename(s: Stage, label: string) {
    await run(async () => {
      await api(`/crm/stages/${s.key}`, { method: 'PATCH', body: JSON.stringify({ label }) });
      setList((l) => l.map((x) => (x.key === s.key ? { ...x, label } : x)));
    });
  }
  async function recolor(s: Stage, color: string) {
    await run(async () => {
      await api(`/crm/stages/${s.key}`, { method: 'PATCH', body: JSON.stringify({ color }) });
      setList((l) => l.map((x) => (x.key === s.key ? { ...x, color } : x)));
    });
  }
  async function del(s: Stage) {
    if (!confirm(`Eliminare lo stato "${s.label}"?`)) return;
    await run(async () => {
      await api(`/crm/stages/${s.key}`, { method: 'DELETE' });
      setList((l) => l.filter((x) => x.key !== s.key));
    });
  }
  async function reorder(next: Stage[]) {
    setList(next);
    await run(() => api('/crm/stages/reorder', { method: 'PATCH', body: JSON.stringify({ keys: next.map((s) => s.key) }) }));
  }
  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    void reorder(next);
  }

  return (
    <Modal title="Stati della pipeline" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Gli stati sono condivisi da tutti. Quelli di sistema (usati dall'automazione) si possono rinominare ma non eliminare.
      </p>
      <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
        {list.map((s, i) => (
          <div key={s.key} className="row" style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button className="btn ghost sm" style={{ padding: '0 6px', lineHeight: 1 }} disabled={busy || i === 0} onClick={() => moveRow(i, -1)}>▲</button>
              <button className="btn ghost sm" style={{ padding: '0 6px', lineHeight: 1 }} disabled={busy || i === list.length - 1} onClick={() => moveRow(i, 1)}>▼</button>
            </div>
            <input type="color" value={s.color ?? '#7c8c88'} disabled={busy} onChange={(e) => recolor(s, e.target.value)} style={{ width: 34, height: 30, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', padding: 1 }} />
            <input className="input" style={{ flex: 1, padding: '7px 10px' }} defaultValue={s.label} disabled={busy} onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== s.label) rename(s, e.target.value.trim()); }} />
            {s.isSystem ? (
              <span className="chip gray" style={{ fontSize: 10 }}>sistema</span>
            ) : (
              <button className="btn danger sm" disabled={busy} onClick={() => del(s)}>×</button>
            )}
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ width: 34, height: 34, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', padding: 1 }} />
        <input className="input" style={{ flex: 1 }} placeholder="Nuovo stato…" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStage()} />
        <button className="btn" disabled={busy || !newLabel.trim()} onClick={addStage}>Aggiungi</button>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose}>Chiudi</button>
      </div>
    </Modal>
  );
}
