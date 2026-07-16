import { useState, type ReactNode } from 'react';

/** Promemoria minimo che le viste sanno disegnare. */
export interface CalReminder {
  id: string;
  title: string;
  dueAt: string;
  done: boolean;
  linkedName?: string | null;
  note?: string | null;
}

export type CalView = 'list' | 'day' | 'week' | 'month';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function startOfWeek(d: Date) { const x = startOfDay(d); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); }
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
const dayKey = (d: Date) => startOfDay(d).toISOString();
const WD = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

function dayLabel(d: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  if (diff === -1) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Calendario promemoria con vista commutabile: Lista (giorni scorrevoli),
 * Settimana o Mese. La resa del singolo promemoria è delegata a `renderItem`
 * (così la pagina può aggiungere azioni e il modulo dashboard resta compatto).
 */
export function ReminderCalendar({
  reminders,
  renderItem,
  compact = false,
  initialView = 'list',
}: {
  reminders: CalReminder[];
  renderItem: (r: CalReminder) => ReactNode;
  compact?: boolean;
  initialView?: CalView;
}) {
  const [view, setView] = useState<CalView>(initialView);
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [selDay, setSelDay] = useState<Date>(startOfDay(new Date()));

  const byDay = new Map<string, CalReminder[]>();
  for (const r of reminders) {
    const k = dayKey(new Date(r.dueAt));
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(r);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const seg = (
    <div className="row" style={{ gap: 4, background: 'var(--chip)', padding: 3, borderRadius: 10 }}>
      {(['list', 'day', 'week', 'month'] as CalView[]).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className="btn sm"
          style={{
            background: view === v ? 'var(--card)' : 'transparent',
            color: view === v ? 'var(--ink)' : 'var(--muted)',
            border: 'none', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
            fontWeight: view === v ? 700 : 500,
          }}
        >
          {v === 'list' ? 'Lista' : v === 'day' ? 'Giorno' : v === 'week' ? 'Settimana' : 'Mese'}
        </button>
      ))}
    </div>
  );

  // ---- Giorno: un solo giorno con frecce avanti/indietro (ci si arriva anche cliccando
  //      una casella della vista Mese) ----
  function DayView() {
    const items = byDay.get(dayKey(selDay)) ?? [];
    return (
      <>
        <div className="spread" style={{ marginBottom: 8 }}>
          <button className="btn ghost sm" onClick={() => setSelDay(addDays(selDay, -1))}><i className="ti ti-chevron-left" /></button>
          <b style={{ fontSize: compact ? 13 : 15, textTransform: 'capitalize' }}>
            {dayLabel(selDay)}
            {['Oggi', 'Domani', 'Ieri'].includes(dayLabel(selDay)) && (
              <span className="muted" style={{ fontWeight: 500 }}> · {selDay.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            )}
          </b>
          <button className="btn ghost sm" onClick={() => setSelDay(addDays(selDay, 1))}><i className="ti ti-chevron-right" /></button>
        </div>
        {items.length === 0
          ? <div className="empty" style={{ padding: compact ? '14px' : '28px 20px' }}>Nessun promemoria in questo giorno.</div>
          : items.map((r) => <div key={r.id}>{renderItem(r)}</div>)}
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="btn ghost sm" onClick={() => { setCursor(startOfDay(selDay)); setView('month'); }}>
            <i className="ti ti-calendar-month" /> Torna al mese
          </button>
        </div>
      </>
    );
  }

  // ---- Lista: giorni con promemoria, in ordine ----
  function ListView() {
    const now = Date.now();
    const upcoming = reminders.filter((r) => r.done || new Date(r.dueAt).getTime() >= startOfDay(new Date(now)).getTime());
    const keys = [...new Set(upcoming.map((r) => dayKey(new Date(r.dueAt))))].sort();
    if (keys.length === 0) return <div className="empty" style={{ padding: compact ? '14px' : '28px 20px' }}>Nessun promemoria in programma.</div>;
    const shownKeys = compact ? keys.slice(0, 3) : keys;
    return (
      <>
        {shownKeys.map((k) => (
          <div key={k} style={{ marginBottom: compact ? 8 : 14 }}>
            <h3 style={{ textTransform: 'capitalize', fontSize: compact ? 13 : 16, margin: compact ? '6px 0 2px' : '10px 0 4px', color: 'var(--muted)' }}>{dayLabel(new Date(k))}</h3>
            {byDay.get(k)!.map((r) => <div key={r.id}>{renderItem(r)}</div>)}
          </div>
        ))}
      </>
    );
  }

  // ---- Settimana: 7 giorni della settimana del cursore ----
  function WeekView() {
    const ws = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const we = addDays(ws, 6);
    return (
      <>
        <div className="spread" style={{ marginBottom: 8 }}>
          <button className="btn ghost sm" onClick={() => setCursor(addDays(ws, -7))}><i className="ti ti-chevron-left" /></button>
          <b style={{ fontSize: compact ? 13 : 15 }}>
            {ws.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – {we.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </b>
          <button className="btn ghost sm" onClick={() => setCursor(addDays(ws, 7))}><i className="ti ti-chevron-right" /></button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {days.map((d) => {
            const items = byDay.get(dayKey(d)) ?? [];
            const today = sameDay(d, new Date());
            return (
              <div key={dayKey(d)} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 10, background: today ? 'var(--chip)' : 'transparent' }}>
                <div className="spread" style={{ marginBottom: items.length ? 6 : 0 }}>
                  <b style={{ fontSize: 13, textTransform: 'capitalize' }}>{d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' })}</b>
                  {today && <span className="chip" style={{ fontSize: 10 }}>oggi</span>}
                </div>
                {items.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>—</span> : items.map((r) => <div key={r.id}>{renderItem(r)}</div>)}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // ---- Mese: griglia 6×7; i giorni con promemoria sono evidenziati (badge col numero)
  //      e cliccando un giorno si passa alla vista Giorno ----
  function MonthView() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const now = Date.now();
    return (
      <>
        <div className="spread" style={{ marginBottom: 8 }}>
          <button className="btn ghost sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><i className="ti ti-chevron-left" /></button>
          <b style={{ fontSize: compact ? 13 : 15, textTransform: 'capitalize' }}>{cursor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</b>
          <button className="btn ghost sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><i className="ti ti-chevron-right" /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {WD.map((w) => <div key={w} className="muted" style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '2px 0' }}>{w}</div>)}
          {cells.map((d) => {
            const items = byDay.get(dayKey(d)) ?? [];
            const other = d.getMonth() !== cursor.getMonth();
            const today = sameDay(d, new Date());
            const pending = items.filter((r) => !r.done).length;
            const late = items.some((r) => !r.done && new Date(r.dueAt).getTime() < now);
            const has = items.length > 0;
            // Colore del giorno: rosso se c'è uno scaduto, verde se c'è da fare, grigio se tutto completato.
            const accent = late ? 'var(--danger)' : pending > 0 ? 'var(--teal)' : 'var(--muted)';
            return (
              <button
                key={dayKey(d)}
                onClick={() => { setSelDay(startOfDay(d)); setView('day'); }}
                title={has ? `${items.length} promemoria — apri il giorno` : 'Apri il giorno'}
                style={{
                  aspectRatio: '1', minHeight: compact ? 30 : 38,
                  border: has ? `2px solid ${accent}` : '1px solid var(--line)',
                  borderRadius: 8,
                  background: has ? (late ? 'rgba(229,72,77,.10)' : 'rgba(18,163,134,.12)') : today ? 'var(--chip)' : 'var(--card)',
                  color: other ? 'var(--muted)' : 'var(--ink)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative', padding: 0,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: today || has ? 800 : 500 }}>{d.getDate()}</span>
                {has && (
                  <span style={{
                    minWidth: compact ? 14 : 17, height: compact ? 14 : 17, padding: '0 4px', borderRadius: 9,
                    background: accent, color: '#fff', fontSize: compact ? 9 : 10.5, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>{items.length}</span>
                )}
                {today && !has && <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--teal)' }} />}
              </button>
            );
          })}
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
          Il numero indica i promemoria del giorno (<span style={{ color: 'var(--teal)', fontWeight: 700 }}>verde</span> da fare,
          <span style={{ color: 'var(--danger)', fontWeight: 700 }}> rosso</span> scaduti). Clicca un giorno per aprirlo.
        </p>
      </>
    );
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        {seg}
      </div>
      {view === 'list' && <ListView />}
      {view === 'day' && <DayView />}
      {view === 'week' && <WeekView />}
      {view === 'month' && <MonthView />}
    </div>
  );
}
