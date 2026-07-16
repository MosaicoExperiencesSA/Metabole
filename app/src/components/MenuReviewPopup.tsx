import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { slotInfo, type ApiMeal, type ApiMenuDay } from '../lib/meals';

/**
 * Popup "Com'è andata ieri?" — all'apertura fa valutare i menu del giorno prima:
 * stelle (salvate su /me/ratings) + aderenza Seguita/No (salvata come tag della
 * valutazione, così non serve un endpoint dedicato). Si mostra una volta al giorno.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return iso(d);
}
const dismissKey = (d: string) => `metabole_menu_review_${d}`;

interface Row { recipeId: string; slot: string; name: string; stars: number; followed: 'yes' | 'no' | null }

export default function MenuReviewPopup() {
  const day = yesterdayISO();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(dismissKey(day))) { setRows([]); return; }
    } catch { /* storage non disponibile */ }
    api<{ days: ApiMenuDay[] }>('/me/menu')
      .then((r) => {
        const d = (r.days ?? []).find((x) => x.date.slice(0, 10) === day);
        const meals: ApiMeal[] = d?.meals ?? [];
        setRows(meals.map((m) => ({ recipeId: m.recipeId, slot: m.slot, name: m.name, stars: 0, followed: null })));
      })
      .catch(() => setRows([]));
  }, [day]);

  if (!rows || rows.length === 0) return null;

  function set(i: number, patch: Partial<Row>) {
    setRows((rs) => (rs ? rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : rs));
  }
  function dismiss() {
    try { localStorage.setItem(dismissKey(day), '1'); } catch { /* ignora */ }
    setRows([]);
  }
  async function save() {
    setBusy(true);
    try {
      await Promise.all(
        (rows ?? [])
          .filter((r) => r.stars > 0 || r.followed)
          .map((r) =>
            api('/me/ratings', {
              method: 'POST',
              body: JSON.stringify({
                recipeId: r.recipeId,
                stars: r.stars > 0 ? r.stars : 3,
                date: day,
                tags: r.followed === 'yes' ? ['seguita'] : r.followed === 'no' ? ['non_seguita'] : [],
              }),
            }).catch(() => { /* una valutazione non deve bloccare le altre */ }),
          ),
      );
    } finally {
      setBusy(false);
      dismiss();
    }
  }

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <div className="sheet-card">
        <div className="sheet-grab" />
        <b style={{ fontSize: 16 }}>Com'è andata ieri?</b>
        <div className="muted" style={{ fontSize: 12.5, margin: '3px 0 14px' }}>
          Valuta i menu di ieri: mi aiuta a scegliere meglio per te.
        </div>
        {rows.map((r, i) => {
          const s = slotInfo(r.slot);
          return (
            <div key={r.recipeId} className="card" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label} · {r.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i
                      key={n}
                      className="ti ti-star-filled"
                      style={{ color: n <= r.stars ? '#F2B705' : '#E2DED4', cursor: 'pointer', fontSize: 18 }}
                      onClick={() => set(i, { stars: n })}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-recipe"
                    style={r.followed === 'yes' ? { background: 'var(--teal)', color: '#fff' } : undefined}
                    onClick={() => set(i, { followed: 'yes' })}
                  >
                    Seguita
                  </button>
                  <button
                    type="button"
                    className="btn-recipe"
                    style={r.followed === 'no' ? { background: '#B4491F', color: '#fff' } : undefined}
                    onClick={() => set(i, { followed: 'no' })}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <button className="btn" style={{ width: '100%', marginTop: 4 }} onClick={save} disabled={busy}>
          {busy ? 'Salvo…' : 'Continua'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 12, cursor: 'pointer' }} onClick={dismiss}>
          <span className="muted">Salta</span>
        </div>
      </div>
    </div>
  );
}
