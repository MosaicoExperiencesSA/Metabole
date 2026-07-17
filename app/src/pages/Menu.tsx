import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';
import { slotInfo, METHOD_LABEL, type ApiMenuDay, type ApiMeal, type ApiRecipe } from '../lib/meals';
import MenuStatusBanner, { type MenuStatus } from '../components/MenuStatusBanner';

/**
 * Menu / diario — dati REALI dal backend:
 * - GET /me/menu → giorni erogati (visibili) con i pasti
 * - GET /recipes/:id → dettaglio ricetta (metodi di cottura, ingredienti)
 * - POST /me/ratings → valutazione del piatto
 */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  if (diff === -1) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
}

function StarRating({ recipeId, date }: { recipeId: string; date?: string }) {
  const [rating, setRating] = useState(0);
  const [saved, setSaved] = useState(false);
  const msg = rating >= 4 ? 'Ti è piaciuta: te la riproporrò più spesso.' : rating > 0 && rating <= 2 ? 'Capito, la eviterò quasi del tutto.' : 'Valutazione salvata.';

  async function rate(n: number) {
    setRating(n);
    try {
      await api('/me/ratings', { method: 'POST', body: JSON.stringify({ recipeId, stars: n, ...(date ? { date } : {}) }) });
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  return (
    <div className="card">
      <b style={{ fontSize: 13 }}>Hai cucinato questo piatto?</b>
      <div className="muted" style={{ margin: '2px 0 8px' }}>La valutazione insegna cosa proporti</div>
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} className="ti ti-star-filled" style={{ color: n <= rating ? '#F2B705' : '#E2DED4', cursor: 'pointer' }} onClick={() => rate(n)} />
        ))}
      </div>
      {rating > 0 && <div style={{ marginTop: 8, fontSize: 12, color: rating <= 2 ? '#993C1D' : '#0E7C66' }}>{saved ? msg : 'Salvataggio…'}</div>}
    </div>
  );
}

function Recipe({ recipeId, date, tag, onBack }: { recipeId: string; date?: string; tag?: string; onBack: () => void }) {
  const [recipe, setRecipe] = useState<ApiRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState(0);

  useEffect(() => {
    api<ApiRecipe>(`/recipes/${recipeId}`).then(setRecipe).catch(() => setRecipe(null)).finally(() => setLoading(false));
  }, [recipeId]);

  if (loading) return <div className="menu"><button className="back-link" onClick={onBack}><i className="ti ti-chevron-left" /> Menu</button><div className="center"><div className="spin" /></div></div>;
  if (!recipe) return <div className="menu"><button className="back-link" onClick={onBack}><i className="ti ti-chevron-left" /> Menu</button><div className="card"><p className="muted" style={{ margin: 0 }}>Ricetta non disponibile.</p></div></div>;

  const methods = recipe.cookingMethods ?? [];
  return (
    <div className="menu">
      <button className="back-link" onClick={onBack}><i className="ti ti-chevron-left" /> Menu</button>
      <h1>{recipe.name}</h1>
      <div className="recipe-tags">
        <span className="meal-tag" style={{ background: '#F2EFE8', color: '#5F6E6B' }}>{recipe.kcal} kcal</span>
        {tag && <span className="meal-tag" style={{ background: '#DCEBE3', color: '#0E7C66' }}>{tag}</span>}
        {(recipe.tags ?? []).map((t) => <span key={t} className="meal-tag" style={{ background: '#F2EFE8', color: '#5F6E6B' }}>{t}</span>)}
      </div>

      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#F3E8DC', color: '#B8863B' }}><i className="ti ti-basket" /></span>
            <b style={{ fontSize: 13 }}>Ingredienti</b>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>{ing.name}{ing.qty ? ` — ${ing.qty}${ing.unit ? ' ' + ing.unit : ''}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {methods.length > 0 && (
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-tools-kitchen-2" /></span>
            <b style={{ fontSize: 13 }}>Come si cucina</b>
          </div>
          {methods.length > 1 && (
            <div className="pill-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
              {methods.map((m, i) => (
                <button key={i} className={`pill${method === i ? ' on' : ''}`} onClick={() => setMethod(i)}>{METHOD_LABEL[m.type] ?? m.type}</button>
              ))}
            </div>
          )}
          <ol className="recipe-steps">
            {(methods[method]?.steps ?? []).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      <StarRating recipeId={recipeId} date={date} />
    </div>
  );
}

export default function Menu() {
  const [days, setDays] = useState<ApiMenuDay[] | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [recipe, setRecipe] = useState<{ recipeId: string; date?: string; tag?: string } | null>(null);
  const mealsRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [blocked, setBlocked] = useState<{ active: boolean; reason: string | null } | null>(null);
  const [status, setStatus] = useState<MenuStatus | null>(null);

  useEffect(() => {
    api<{ delivered: string[]; days: ApiMenuDay[]; blocked?: { active: boolean; reason: string | null }; status?: MenuStatus }>('/me/menu')
      .then((r) => { setDays(r.days ?? []); setBlocked(r.blocked ?? null); setStatus(r.status ?? null); })
      .catch(() => setDays([]));
  }, []);

  function scrollTo(i: number) {
    const el = mealsRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }
  function onScroll() {
    const el = mealsRef.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }
  function pickDay(i: number) {
    setDayIdx(i);
    setIdx(0);
    const el = mealsRef.current;
    if (el) el.scrollTo({ left: 0 });
  }

  if (recipe) return <Recipe recipeId={recipe.recipeId} date={recipe.date} tag={recipe.tag} onBack={() => setRecipe(null)} />;
  if (days === null) return <div className="center"><div className="spin" /></div>;

  const todayMs = startOfDay(new Date()).getTime();
  const upcoming = days.filter((d) => startOfDay(new Date(d.date)).getTime() >= todayMs);
  const past = days.filter((d) => startOfDay(new Date(d.date)).getTime() < todayMs).reverse();
  const selDay = upcoming[dayIdx];
  const meals = selDay?.meals ?? [];

  return (
    <div className="home">
      <AppHeader title="Il tuo menu" />

      {blocked?.active && !status && (
        <div className="card" style={{ background: '#FBF0D6', border: '1px solid #EAD8A6', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="event-ic" style={{ background: '#F2B705', color: '#fff', flex: 'none' }}><i className="ti ti-heart-handshake" /></span>
          <div style={{ fontSize: 13, color: '#7A5B12' }}>{blocked.reason ?? 'Stiamo sistemando il tuo piano con la nutrizionista.'}</div>
        </div>
      )}

      {upcoming.length === 0 ? (
        status && status.state !== 'available' ? (
          <MenuStatusBanner status={status} />
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="muted" style={{ margin: 0 }}>Il tuo menu non è ancora disponibile. Si sblocca quando parte il tuo piano (e dopo i check-in).</p>
          </div>
        )
      ) : (
        <>
          <div className="pill-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
            {upcoming.map((d, i) => (
              <button key={d.id} className={`pill${dayIdx === i ? ' on' : ''}`} onClick={() => pickDay(i)}>{dayLabel(d.date)}</button>
            ))}
          </div>

          {meals.length > 1 && (
            <div className="pill-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
              {meals.map((m, i) => (
                <button key={i} className={`pill${idx === i ? ' on' : ''}`} onClick={() => scrollTo(i)}>{slotInfo(m.slot).label}</button>
              ))}
            </div>
          )}

          <div className="meal-carousel" ref={mealsRef} onScroll={onScroll}>
            {meals.map((m: ApiMeal, i) => {
              const s = slotInfo(m.slot);
              return (
                <div className="meal-row" key={i}>
                  <div className="meal-thumb" style={{ background: s.bg }}><i className={`ti ${s.icon}`} style={{ color: s.color }} /></div>
                  <div className="meal-body">
                    <span className="meal-tag" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <div className="meal-name">{m.name}</div>
                    {m.substitutions && m.substitutions.length > 0 && (
                      <div style={{ fontSize: 11, color: '#0E7C66', margin: '2px 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="ti ti-replace" style={{ fontSize: 13 }} />
                        {m.substitutions.map((sub) => `${sub.from} → ${sub.to}`).join(' · ')}
                      </div>
                    )}
                    <div className="row-between">
                      <span className="muted" style={{ fontSize: 12 }}>{m.kcal} kcal</span>
                      <button className="btn-recipe" onClick={() => setRecipe({ recipeId: m.recipeId, date: selDay.date.slice(0, 10), tag: s.label })}>Ricetta</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {meals.length > 1 && (
            <div className="home-dots">
              {meals.map((_, i) => <span key={i} className={i === idx ? 'on' : ''} />)}
            </div>
          )}
        </>
      )}

      {past.length > 0 && (
        <>
          <div className="sec">Storico menu</div>
          <div className="meals-col">
            {past.slice(0, 7).map((d) => (
              <div className="card storico-row" key={d.id}>
                <span className="storico-thumb" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-calendar" /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{dayLabel(d.date)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{d.meals.length} pasti</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
