import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';
import { slotInfo, testoSostituzione, etichettaMetodo, type ApiMenuDay, type ApiMeal, type ApiRecipe, type ApiCiclo, testoPorzione, testoIngredientiScheda } from '../lib/meals';
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

/** «9 lug» — la data corta della finestra del ciclo, che serve solo a darle un confine. */
function giornoCorto(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
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

/**
 * La scheda della ricetta.
 *
 * ⚠️ `giorno` e `slot` viaggiano nella richiesta perché il server possa rispondere con le
 * grammature **della porzione che questa cliente ha ricevuto quel giorno** (voce 255): prima
 * mostrava sempre quelle di catalogo, e chi aveva la porzione ingrandita leggeva «891 kcal» nel
 * menu e trovava qui gli ingredienti per 495. ⚠️ Il fattore **non si manda**: lo rilegge il server
 * dalla giornata: quanto cibo compare in questa pagina non lo decide il telefono.
 */
function Recipe({ recipeId, date, slot, porzione, tag, onBack }: { recipeId: string; date?: string; slot?: string; porzione?: number; tag?: string; onBack: () => void }) {
  const [recipe, setRecipe] = useState<ApiRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams();
    if (date) q.set('giorno', date);
    if (slot) q.set('slot', slot);
    const qs = q.toString();
    api<ApiRecipe>(`/recipes/${recipeId}${qs ? `?${qs}` : ''}`).then(setRecipe).catch(() => setRecipe(null)).finally(() => setLoading(false));
  }, [recipeId, date, slot]);

  if (loading) return <div className="menu"><button className="back-link" onClick={onBack}><i className="ti ti-chevron-left" /> Menu</button><div className="center"><div className="spin" /></div></div>;
  if (!recipe) return <div className="menu"><button className="back-link" onClick={onBack}><i className="ti ti-chevron-left" /> Menu</button><div className="card"><p className="muted" style={{ margin: 0 }}>Ricetta non disponibile.</p></div></div>;

  const methods = recipe.cookingMethods ?? [];
  const porzioneScheda = testoIngredientiScheda({ porzioneScheda: recipe.porzione, porzioneMenu: porzione });
  return (
    <div className="menu">
      <button className="back-link" onClick={onBack}><i className="ti ti-chevron-left" /> Menu</button>
      <h1>{recipe.name}</h1>
      <div className="recipe-tags">
        <span className="meal-tag" style={{ background: '#F2EFE8', color: '#5F6E6B' }}>{recipe.kcal} kcal</span>
        {tag && <span className="meal-tag" style={{ background: '#DCEBE3', color: '#0E7C66' }}>{tag}</span>}
      </div>
      {/* ⚠️ La porzione di catalogo si dice solo quando le kcal sopra NON sono quelle di catalogo:
          serve a capire da dove viene il numero, non a proporre una seconda quantità possibile. */}
      {recipe.porzione && recipe.kcalBase ? (
        <div className="muted" style={{ fontSize: 11, marginTop: -4 }}>La porzione di catalogo è da {recipe.kcalBase} kcal</div>
      ) : null}

      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#F3E8DC', color: '#B8863B' }}><i className="ti ti-basket" /></span>
            <b style={{ fontSize: 13 }}>Ingredienti</b>
          </div>
          {/* ⚠️ Sopra la lista e non sotto: chi legge una grammatura ha già cominciato a pesare. */}
          {porzioneScheda && (
            <div
              style={{
                fontSize: 12,
                margin: '-2px 0 10px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                color: porzioneScheda.scalata ? '#8E6BB5' : '#993C1D',
              }}
            >
              <i className={`ti ${porzioneScheda.scalata ? 'ti-arrows-maximize' : 'ti-alert-triangle'}`} style={{ fontSize: 14, flex: 'none', marginTop: 1 }} />
              {porzioneScheda.testo}
            </div>
          )}
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
                <button key={i} className={`pill${method === i ? ' on' : ''}`} onClick={() => setMethod(i)}>{etichettaMetodo(m.type)}</button>
              ))}
            </div>
          )}
          {/*
            ⚠️ SOPRA I PASSI E NON SOTTO: chi legge «taglia le carote» dopo aver letto «biete» negli
            ingredienti si ferma lì, e una spiegazione in fondo arriva dopo il dubbio. I passi non
            vengono riscritti di proposito — cambiare una parola dentro una frase darebbe «la porro»
            o «biete tagliate a rondelle» — quindi si dice cosa mettere al posto di cosa.
          */}
          {(recipe.sostituzioniNeiPassi ?? []).length > 0 && (
            <div
              style={{
                fontSize: 12, margin: '-2px 0 10px', display: 'flex', alignItems: 'flex-start',
                gap: 6, color: '#8E6BB5',
              }}
            >
              <i className="ti ti-refresh" style={{ fontSize: 14, flex: 'none', marginTop: 1 }} />
              <span>
                Qui sotto trovi ancora {recipe.sostituzioniNeiPassi!.map((x) => `«${x.da}»`).join(', ')}:
                {' '}al loro posto usa {recipe.sostituzioniNeiPassi!.map((x) => `«${x.a}»`).join(', ')}, come negli ingredienti.
              </span>
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
  // Giorno selezionato per DATA (YYYY-MM-DD): può essere anche un giorno PASSATO
  // (dallo Storico menu o dal Percorso via ?giorno=). null = primo giorno futuro.
  const [selDate, setSelDate] = useState<string | null>(() => {
    const g = new URLSearchParams(window.location.search).get('giorno');
    return g && /^\d{4}-\d{2}-\d{2}$/.test(g) ? g : null;
  });
  // Ricetta aperta direttamente (es. dal tasto "Ricetta" della Home via ?ricetta=&giorno=).
  const [recipe, setRecipe] = useState<{ recipeId: string; date?: string; slot?: string; porzione?: number; tag?: string } | null>(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('ricetta');
    const g = p.get('giorno');
    // ⚠️ Anche lo slot: senza, un piatto che compare due volte nella stessa giornata (spuntino e
    // merenda) ha due porzioni possibili e il server non può sceglierne una — la scheda resterebbe
    // sulle grammature di catalogo proprio nel caso in cui la porzione è cambiata.
    const sl = p.get('slot');
    return r ? { recipeId: r, date: g && /^\d{4}-\d{2}-\d{2}$/.test(g) ? g : undefined, slot: sl ?? undefined } : null;
  });
  const mealsRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [blocked, setBlocked] = useState<{ active: boolean; reason: string | null } | null>(null);
  const [status, setStatus] = useState<MenuStatus | null>(null);
  /**
   * IL CICLO DI QUESTI GIORNI — `GET /me/cycle`, che esisteva dal principio e non chiamava nessuno.
   *
   * ⚠️ Ne servono **due cose sole**: le **cotture**, che sono quello che cambia cosa fa in cucina e
   * che oggi non le dice nessuno, e **com'è andato il ciclo appena chiuso**. ⛔ Il «gradimento» che
   * quell'endpoint calcolava **non arriva più fin qui** (il server non lo manda a lei): non è il
   * gradimento, è il minimo del massimo delle stelle con default 5 per le ricette mai valutate —
   * mostrarlo a chi non ha votato niente sarebbe il difetto delle stelle inventate, in una schermata.
   */
  const [ciclo, setCiclo] = useState<ApiCiclo | null>(null);

  useEffect(() => {
    api<{ delivered: string[]; days: ApiMenuDay[]; blocked?: { active: boolean; reason: string | null }; status?: MenuStatus }>('/me/menu')
      .then((r) => { setDays(r.days ?? []); setBlocked(r.blocked ?? null); setStatus(r.status ?? null); })
      .catch(() => setDays([]))
      /**
       * ⚠️ **DOPO** `/me/menu`, non insieme. È `/me/menu` che **eroga** i giorni nuovi
       * (`deliverIfEligible`): partendo in parallelo, alla prima apertura dopo la pesata di fine
       * ciclo la pagina mostrerebbe i giorni nuovi e questa scheda le cotture di quello chiuso. Si
       * vede una volta per ciclo, ed è il tipo di cosa che sembra un caso.
       *
       * Se non risponde, la scheda semplicemente non compare: non è un pezzo del menu.
       */
      .then(() => api<ApiCiclo>('/me/cycle').then(setCiclo).catch(() => setCiclo(null)));
  }, []);

  function scrollTo(i: number) {
    const el = mealsRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }
  function onScroll() {
    const el = mealsRef.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }
  function pickDay(date: string) {
    setSelDate(date);
    setIdx(0);
    const el = mealsRef.current;
    if (el) el.scrollTo({ left: 0 });
  }

  /**
   * ⚠️ LA PORZIONE DEL PASTO SERVE ANCHE QUANDO LA RICETTA SI APRE DA FUORI (dalla home, con
   * `?ricetta=&giorno=&slot=`). Lì `porzione` non viaggia nell'indirizzo — ed è giusto che non
   * viaggi, il fattore non lo decide il telefono — ma senza, la scheda perde il suo **terzo stato**:
   * quello in cui il server non è riuscito a scalare e bisogna dire «queste sono di catalogo, pesa
   * ×1,8». Il numero però ce l'abbiamo già in casa: sta nei giorni appena caricati. Trovato
   * rileggendo la sera del 18/8.
   */
  const porzioneDalMenu =
    recipe?.porzione ??
    (days ?? [])
      .find((d) => d.date.slice(0, 10) === recipe?.date)
      ?.meals.find((m) => m.recipeId === recipe?.recipeId && (!recipe?.slot || m.slot === recipe.slot))?.porzione;

  if (recipe) return <Recipe recipeId={recipe.recipeId} date={recipe.date} slot={recipe.slot} porzione={porzioneDalMenu} tag={recipe.tag} onBack={() => setRecipe(null)} />;
  if (days === null) return <div className="center"><div className="spin" /></div>;

  const todayMs = startOfDay(new Date()).getTime();
  const upcoming = days.filter((d) => startOfDay(new Date(d.date)).getTime() >= todayMs);
  const past = days.filter((d) => startOfDay(new Date(d.date)).getTime() < todayMs).reverse();
  // Selezione: la data scelta (anche passata), altrimenti il primo giorno futuro.
  const selDay = (selDate ? days.find((d) => d.date.slice(0, 10) === selDate) : undefined) ?? upcoming[0];
  const isPastDay = !!selDay && startOfDay(new Date(selDay.date)).getTime() < todayMs;
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

      {!selDay ? (
        status && status.state !== 'available' ? (
          <MenuStatusBanner status={status} />
        ) : (
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="muted" style={{ margin: 0 }}>Il tuo menu non è ancora disponibile. Si sblocca quando parte il tuo piano (e dopo i check-in).</p>
          </div>
        )
      ) : (
        <>
          {/* Giorno PASSATO aperto dallo storico: intestazione + torna a oggi */}
          {isPastDay ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: '#F7FAF9', boxShadow: 'none' }}>
              <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66', flex: 'none' }}><i className="ti ti-history" /></span>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>Menu di {dayLabel(selDay.date)}</div>
              {upcoming.length > 0 && (
                <button className="chip" onClick={() => pickDay(upcoming[0].date.slice(0, 10))} style={{ border: 'none', background: '#DCEBE3', color: '#0E7C66', padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
                  Torna a oggi
                </button>
              )}
            </div>
          ) : (
            upcoming.length > 0 && (
              <div className="pill-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                {upcoming.map((d) => (
                  <button key={d.id} className={`pill${selDay.id === d.id ? ' on' : ''}`} onClick={() => pickDay(d.date.slice(0, 10))}>{dayLabel(d.date)}</button>
                ))}
              </div>
            )
          )}

          {/*
            «Sostituisci» dalla giornata che sta guardando (§16.2).
            Prima l'unico ingresso era il pulsante della home, che non porta con sé nessun giorno:
            chi apriva il menu di domani e chiedeva un cambio si sentiva elencare i piatti di oggi.
            Il giorno viaggia nell'indirizzo e da lì arriva a Gaia. Non compare sui giorni PASSATI:
            un menu di ieri è già stato mangiato, e correggerlo non vuol dire niente.
          */}
          {/*
            LE COTTURE DI QUESTI GIORNI, e com'è andato il ciclo prima.
            ⚠️ Solo sui giorni in arrivo: su un menu di ieri «questi giorni» vorrebbe dire un'altra
            cosa, e la riga diventerebbe una didascalia sbagliata invece che un'informazione.
          */}
          {!isPastDay && ciclo?.attivo && (ciclo.cotture.length > 0 || ciclo.esitoPrecedente) && (
            <div className="card" style={{ marginBottom: 10, background: '#F7FAF9', boxShadow: 'none' }}>
              {ciclo.cotture.length > 0 && (
                <div style={{ fontSize: 13 }}>
                  <b>In questi giorni si cucina</b>{' '}
                  {ciclo.cotture.map((c) => c.etichetta.toLowerCase()).join(' e ')}
                  {/* ⚠️ «Questi giorni» ha un confine, e va detto: senza le date la riga resta vera
                      per sempre e nessuno sa a cosa si riferisce. */}
                  {ciclo.dal && ciclo.al ? ` (${giornoCorto(ciclo.dal)}–${giornoCorto(ciclo.al)})` : ''}.
                </div>
              )}
              {ciclo.esitoPrecedente && (
                <div className="muted" style={{ fontSize: 12, marginTop: ciclo.cotture.length > 0 ? 4 : 0 }}>
                  {ciclo.esitoPrecedente.riga}
                </div>
              )}
            </div>
          )}

          {!isPastDay && (
            <div style={{ marginBottom: 10 }}>
              <a
                className="chip"
                href={`/assistente?who=ai&intent=sostituzione&giorno=${selDay.date.slice(0, 10)}`}
                style={{ border: 'none', background: '#DCEBE3', color: '#0E7C66', padding: '7px 12px', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <i className="ti ti-arrows-exchange" /> Sostituisci qualcosa in questo giorno
              </a>
            </div>
          )}

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
                    {/* ⚠️ La porzione scalata (voce 255): sta QUI, sopra le sostituzioni e sopra le
                        kcal, perché è la cosa che spiega tutte e due. Senza, il numero di kcal e le
                        grammature della scheda ricetta si contraddicono e nessuno sa a quale credere. */}
                    {testoPorzione(m) && (
                      <div style={{ fontSize: 11, color: '#8E6BB5', margin: '2px 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="ti ti-arrows-maximize" style={{ fontSize: 13 }} />
                        {testoPorzione(m)}
                      </div>
                    )}
                    {m.substitutions && m.substitutions.length > 0 && (
                      <div style={{ fontSize: 11, color: '#0E7C66', margin: '2px 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="ti ti-replace" style={{ fontSize: 13 }} />
                        {m.substitutions.map((s) => testoSostituzione(s, m.porzione)).join(' · ')}
                      </div>
                    )}
                    <div className="row-between">
                      <span className="muted" style={{ fontSize: 12 }}>{m.kcal} kcal</span>
                      <button className="btn-recipe" onClick={() => setRecipe({ recipeId: m.recipeId, date: selDay.date.slice(0, 10), slot: m.slot, porzione: m.porzione, tag: s.label })}>Ricetta</button>
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
              <div
                className="card storico-row"
                key={d.id}
                onClick={() => { pickDay(d.date.slice(0, 10)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={{ cursor: 'pointer' }}
              >
                <span className="storico-thumb" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-calendar" /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{dayLabel(d.date)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{d.meals.length} pasti · tocca per vedere</div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: '#9AA6A2' }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
