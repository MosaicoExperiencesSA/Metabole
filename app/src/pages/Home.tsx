import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import ChiediAllergie from '../components/ChiediAllergie';
import CardDigiuno from '../components/CardDigiuno';
import Sheet from '../components/Sheet';
import CheckinPopup, { type CheckinValori } from '../components/CheckinPopup';
import ReferralCard from '../components/ReferralCard';
import MenuReviewPopup from '../components/MenuReviewPopup';
import VoiceToggle from '../components/VoiceToggle';
import { fraseDelGiorno } from '../lib/frasiGaia';
import { getTodaySteps } from '../lib/steps';
import { DEFAULT_WATER_UNIT, isWaterUnit, WATER_UNITS, waterGoalValue, waterIcon, waterLiters, waterStep, waterValue, type WaterUnit } from '../lib/water';
import StartDatePrompt from '../components/StartDatePrompt';
import MenuStatusBanner, { type MenuStatus } from '../components/MenuStatusBanner';
import PendingBankTransfers from '../components/PendingBankTransfers';
import AppHeader from '../components/AppHeader';
import { slotInfo, type ApiMeal, type ApiMenuDay } from '../lib/meals';
import { TypeText } from '../components/TypeText';
import { oggiIso } from '../lib/giorno';

interface Today {
  checkinDone: boolean;
  // Deciso dal server: include la regola "solo se c'è un piano attivo" (voce #1).
  checkinDue?: boolean;
  hasActivePlan?: boolean;
  // "Salta per oggi" già usato: il popup non si mostra, ma NON è un check-in fatto — l'aderenza
  // guarda checkinDone, mai questo.
  checkinSkipped?: boolean;
  measurementDone: boolean;
  water: { glasses: number; goal: number };
  steps: { steps: number; goal: number };
  objective?: string | null; // fase attuale: 'dimagrimento' | 'mantenimento'
}

// Badge della fase attuale (gestita dallo staff): dimagrimento o mantenimento.
const PHASE_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  dimagrimento: { label: 'Dimagrimento', icon: 'ti-trending-down', color: '#12A386' },
  mantenimento: { label: 'Mantenimento', icon: 'ti-equal', color: '#2F80ED' },
};
interface NextAppt { id: string; staffRole: string; staffName: string | null; type: string; datetime: string; note: string | null }

const APPT_TYPE_LABEL: Record<string, string> = { call: 'Chiamata', televisit: 'Televisita', in_person: 'In presenza' };
function apptWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

/**
 * Home — allineata al prototipo navigabile (docs/):
 * header MetaboleAI · "Ciao, {nome}", card "IL MENU DI OGGI" (carosello pasti + Spesa),
 * "PROSSIMO APPUNTAMENTO", card Gaia "LA FRASE DI OGGI". Dati REALI dal backend.
 */

interface EventItem { id: string; type: string; label: string | null; startDate: string; mode: string }
const EV: Record<string, [string, string, string, string]> = {
  // tipo → [etichetta, icona, bg, colore]
  wedding: ['Matrimonio', 'ti-heart', '#FBEEE7', '#E8825A'],
  baptism: ['Battesimo', 'ti-heart', '#FBEEE7', '#E8825A'],
  dinner: ['Cena', 'ti-glass-full', '#F3E8DC', '#B8863B'],
  monthly_cheat: ['Sgarro', 'ti-cake', '#F3E8DC', '#B8863B'],
  vacation: ['Vacanza', 'ti-umbrella', '#E7EEF6', '#3A6EA5'],
  other: ['Evento', 'ti-calendar-heart', '#E7EEF6', '#3A6EA5'],
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function whenLabel(iso: string): string {
  const days = Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  if (days > 1) return `tra ${days} giorni`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** Testi di aiuto rapido (come nel prototipo). */
const SHEETS: Record<string, { t: string; b: string; cta: string }> = {
  fame: { t: 'Ho fame adesso', b: "Bevi un bicchiere d'acqua e prendi un frutto o dei semi: spesso la fame passa in 15 minuti. Se ti capita spesso di pomeriggio, lo segnalo alla tua coach e anticipiamo lo spuntino.", cta: 'Chiedi alla coach' },
  fuori: { t: 'Mangio fuori', b: 'Scegli una proteina con verdure, evita bevande zuccherate e concediti un piccolo piacere senza sensi di colpa. Domani ti preparo un rientro morbido, tranquilla.', cta: 'Ok, grazie' },
};

/**
 * Aiuto rapido. «Sostituisci» non apre più un pop-up: porta nella chat con Gaia, dove il
 * cambio si concorda parlando e poi entra davvero nel menu della giornata.
 *
 * Il pop-up che c'era chiedeva PER QUANTO valeva la sostituzione — oggi / questi giorni /
 * per sempre — cioè la conseguenza. La domanda che conta è PERCHÉ, e non l'abbiamo mai
 * fatta: «non ce l'ho in casa» è un problema di martedì e domani il piatto deve tornare,
 * «mi resta sullo stomaco» non è un gusto ma un segnale clinico, e finivano nella stessa
 * casella. Ora la domanda la fa Gaia, e quello che la cliente risponde lo leggono anche la
 * coach e la nutrizionista. Vedi `progetto/PROGETTO_gaia-cambio-menu.md`.
 *
 * L'endpoint del vecchio pop-up (`POST /me/menu/substitute`) resta: lo usano il Profilo per
 * i cibi esclusi e le app già installate, dove gli aggiornamenti OTA sono spenti.
 */
const HELP: { icon: string; label: string; key: string; color: string; vaA?: string }[] = [
  { icon: 'ti-mood-sad', label: 'Ho fame', key: 'fame', color: '#E8825A' },
  { icon: 'ti-tools-kitchen-2', label: 'Mangio fuori', key: 'fuori', color: '#3A6EA5' },
  { icon: 'ti-arrows-exchange', label: 'Sostituisci', key: 'sost', color: '#6C5AB7', vaA: '/assistente?who=ai&intent=sostituzione' },
];

function KpiTile({ icon, value, label, color, onClick, hint, onInfo }: { icon: string; value: string; label: string; color: string; onClick?: () => void; hint?: string; onInfo?: () => void }) {
  // Come nel prototipo: sfondo a gradiente colorato + icona a tinta piena con
  // ombra colorata (leggero effetto 3D).
  return (
    <div
      onClick={onClick}
      title={hint}
      style={{
        flex: 1,
        minWidth: 0,
        aspectRatio: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 6px',
        borderRadius: 18,
        background: `linear-gradient(160deg, ${color}22, ${color}0a)`,
        border: `1px solid ${color}26`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 9,
          boxShadow: `0 6px 14px ${color}55`,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 18, color: '#fff' }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#101826', lineHeight: 1 }}>
        {value}
        {/* Il «?» accanto al NUMERO, non all'etichetta: la domanda che viene è «perché proprio
            questo numero?», e nasce guardando la cifra. */}
        {onInfo && (
          <button
            type="button"
            className="info-dot"
            aria-label={`Come si calcola l'obiettivo: ${label}`}
            onClick={(e) => { e.stopPropagation(); onInfo(); }}
            style={{ marginLeft: 5, width: 15, height: 15, fontSize: 9, verticalAlign: '2px' }}
          >
            ?
          </button>
        )}
      </div>
      <div className="muted" style={{ fontSize: 10, marginTop: 5 }}>{label}</div>
    </div>
  );
}

interface SpesaItem { name: string; qty?: number | null; unit?: string | null; checked: boolean }
function SpesaList() {
  const [list, setList] = useState<{ id?: string; items: SpesaItem[] } | null>(null);
  useEffect(() => {
    api<{ id?: string; items: SpesaItem[] }>('/me/shopping-list').then(setList).catch(() => setList(null));
  }, []);

  async function toggle(item: SpesaItem) {
    if (!list?.id) return;
    setList((l) => (l ? { ...l, items: l.items.map((x) => (x.name === item.name ? { ...x, checked: !x.checked } : x)) } : l));
    try {
      await api(`/me/shopping-list/${list.id}/items`, { method: 'PATCH', body: JSON.stringify({ itemName: item.name, checked: !item.checked }) });
    } catch {
      /* la spunta è già applicata localmente */
    }
  }

  return (
    <>
      <div className="row" style={{ alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span className="event-ic" style={{ background: '#DCEBE3', color: '#0E7C66' }}><i className="ti ti-basket" /></span>
        <div><b style={{ fontSize: 15 }}>Lista della spesa</b><div className="muted" style={{ fontSize: 11 }}>Per i prossimi giorni</div></div>
      </div>
      {!list || list.items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Nessun ingrediente: la lista si popola quando il menu è disponibile.</p>
      ) : (
        list.items.map((it) => (
          <div key={it.name} className="spesa-item" style={{ opacity: it.checked ? 0.55 : 1 }} onClick={() => toggle(it)}>
            <span className={`spesa-ck${it.checked ? ' on' : ''}`}>{it.checked && <i className="ti ti-check" />}</span>
            <span style={{ fontSize: 13 }}>{it.name}{it.qty ? ` · ${it.qty}${it.unit ? ' ' + it.unit : ''}` : ''}</span>
          </div>
        ))
      )}
    </>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | 'spesa'>(null);
  const [help, setHelp] = useState<string | null>(null);
  /** Il popup che spiega da dove esce l'obiettivo passi (richiesta di Simone, 12/8). */
  const [infoPassi, setInfoPassi] = useState(false);
  const [today, setToday] = useState<Today | null>(null);
  const [meals, setMeals] = useState<ApiMeal[] | null>(null);
  const [nextAppt, setNextAppt] = useState<NextAppt | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [deviceSteps, setDeviceSteps] = useState<number | null>(null);
  const [waterUnit, setWaterUnit] = useState<WaterUnit>(DEFAULT_WATER_UNIT);
  const [dismissed, setDismissed] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [menuStatus, setMenuStatus] = useState<MenuStatus | null>(null);
  const mealsRef = useRef<HTMLDivElement>(null);
  const [mealIdx, setMealIdx] = useState(0);

  // Caricamento del menu di oggi: estratto così da poterlo RICARICARE dopo una
  // sostituzione (prima la card restava col piatto vecchio e sembrava "non cambiare").
  const loadMenu = useCallback(() => {
    return api<{ days: ApiMenuDay[]; status?: MenuStatus }>('/me/menu').then((r) => {
      const iso = oggiIso();
      // "IL MENU DI OGGI" = SOLO il menu con data di oggi. Niente ripiego su un giorno vecchio
      // (days[0]): a piano concluso / in attesa non deve comparire un menu passato come se fosse
      // di oggi. Se non c'è il menu di oggi → nessun pasto → compare il banner di stato.
      const day = r.status?.state === 'expired'
        ? undefined
        : (r.days ?? []).find((d) => d.date.slice(0, 10) === iso);
      setMeals(day?.meals ?? []);
      setMenuStatus(r.status ?? null);
    }).catch(() => setMeals([]));
  }, []);

  useEffect(() => {
    api<Today>('/me/today').then(setToday).catch(() => {});
    void loadMenu();
    api<{ next: NextAppt | null }>('/me/agenda?next=1').then((r) => setNextAppt(r.next)).catch(() => setNextAppt(null));
    api<EventItem[]>('/me/events').then((evs) => {
      const t = startOfDay(new Date()).getTime();
      setEvents((evs ?? []).filter((e) => startOfDay(new Date(e.startDate)).getTime() >= t).sort((a, b) => a.startDate.localeCompare(b.startDate)));
    }).catch(() => setEvents([]));
    // Passi dal sensore del telefono (solo su nativo): li mostriamo e li salviamo.
    getTodaySteps().then((s) => {
      if (s == null) return;
      setDeviceSteps(s);
      api('/me/steps', { method: 'POST', body: JSON.stringify({ steps: s }) }).catch(() => {});
    });
    // Unità di visualizzazione dell'acqua scelta dal cliente (bicchieri / bottiglie).
    api<{ waterUnit?: string }>('/me/preferences').then((p) => {
      if (isWaterUnit(p.waterUnit)) setWaterUnit(p.waterUnit);
    }).catch(() => {});
  }, [loadMenu]);

  function onMealsScroll() {
    const el = mealsRef.current;
    if (el) setMealIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  async function submitCheckin(valori: CheckinValori) {
    setCheckinBusy(true);
    try {
      // Dal 5/8 il check-in porta anche energia, fame e stress (voce #1): il popup li
      // raccoglie tutti e tre prima di arrivare qui, il DTO lato server li accetta opzionali.
      await api('/me/checkins', { method: 'POST', body: JSON.stringify(valori) });
      setToday((t) => (t ? { ...t, checkinDone: true } : t));
    } catch {
      /* in caso di errore chiudiamo comunque */
    } finally {
      setCheckinBusy(false);
      setDismissed(true);
    }
  }

  /**
   * "Salta per oggi". Prima era `setDismissed(true)` e basta: `dismissed` vive dentro questo
   * componente, che React smonta appena si esce dalla home, quindi al rientro il popup tornava —
   * l'etichetta diceva "per oggi" ma valeva "per adesso". Ora lo skip viene registrato lato
   * server, così regge anche fra una schermata e l'altra, dopo un riavvio dell'app e su un altro
   * dispositivo.
   *
   * Chiudiamo SUBITO, senza aspettare la risposta: il popup è un cortesia, non una transazione,
   * e la cliente non deve guardare uno spinner per dire "non adesso". Se la chiamata fallisce
   * (rete assente) resta il vecchio comportamento — chiuso per questa schermata — che è il peggio
   * possibile ed è comunque quello di prima.
   */
  function skipCheckin() {
    setDismissed(true);
    setToday((t) => (t ? { ...t, checkinSkipped: true } : t));
    api('/me/checkins/skip', { method: 'POST' }).catch(() => {});
  }

  async function addWater() {
    if (!today) return;
    const prev = today.water.glasses;
    const next = prev + waterStep(waterUnit); // +1 bicchiere, o l'equivalente in bottiglie
    setToday((t) => (t ? { ...t, water: { ...t.water, glasses: next } } : t));
    try {
      await api('/me/water', { method: 'POST', body: JSON.stringify({ glasses: next }) });
    } catch {
      setToday((t) => (t ? { ...t, water: { ...t.water, glasses: prev } } : t));
    }
  }

  const name = (user?.firstName || user?.email?.split('@')[0] || 'ciao').replace(/^\w/, (c) => c.toUpperCase());
  const now = new Date();
  // Una frase diversa ogni giorno, e diversa da cliente a cliente: vedi lib/frasiGaia.ts.
  const frase = fraseDelGiorno(user?.id, now);
  const totKcal = (meals ?? []).reduce((a, m) => a + (m.kcal || 0), 0);

  /**
   * ⛔ **UNA INTERRUZIONE PER VOLTA, e adesso vale per TUTTE E TRE.**
   *
   * L'orologio del digiuno porta chi non ha ancora scelto sulla sua pagina al primo avvio: se lo
   * facesse mentre un riquadro è aperto, la home si smonterebbe portandosi via quello che la cliente
   * ci aveva già scritto dentro. Vincerebbe chi arriva ultimo fra due chiamate in parallelo, quindi
   * in modo intermittente e a seconda della rete — il difetto peggiore da riconoscere.
   *
   * ⛔ **La prima versione copriva solo il check-in** (corretto in revisione, 21/8), perché il
   * check-in è l'unico che questa pagina sa da sé. Gli altri due si decidono dentro di loro, dopo
   * una chiamata al server: «com'è andata ieri?» — dove vivono le **stelle non ancora salvate** — e
   * la domanda sulle allergie, dove vive un **testo libero su un dato sanitario**. Erano proprio i
   * due dove perdere quello che si è scritto costa di più.
   *
   * ⚠️ Adesso lo dicono loro (`onAschermo`), invece che questa pagina indovinarlo: chi sa una cosa è
   * chi la decide. La regola resta una sola, e sta scritta una volta sola qui sotto.
   */
  const [reviewAschermo, setReviewAschermo] = useState(false);
  const [allergieAschermo, setAllergieAschermo] = useState(false);
  const checkinAschermo = Boolean(
    today && (today.checkinDue ?? (!today.checkinDone && !today.checkinSkipped)) && !dismissed,
  );
  const qualcosaAschermo = checkinAschermo || reviewAschermo || allergieAschermo;

  return (
    <div className="home">
      <AppHeader title={`Ciao, ${name}`} />

      {/*
        ⚠️ IN CIMA A TUTTO, e prima del menu: la domanda sulle allergie a chi non ha mai risposto
        (13/8). Metà delle clienti ha saltato quella pagina del questionario, e per loro un elenco
        vuoto non vuol dire «non ne ho» — vuol dire che non lo sappiamo. Il componente non mostra
        niente a chi ha già risposto: sotto la prima riga si toglie da solo.
      */}
      <ChiediAllergie onAschermo={setAllergieAschermo} />

      {/*
        ⚠️ L'orologio del digiuno: mostra dove sei adesso, e a chi non ha ancora scelto la finestra
        apre la pagina al primo avvio (decisione di Simone, 19/8). Non mostra niente a chi non
        digiuna, e niente nemmeno se il server non risponde — la home non deve avere un buco al
        posto di una cosa che non la riguarda.
      */}
      <CardDigiuno atterraggioPermesso={!qualcosaAschermo} />

      {/* Fase attuale del percorso (dimagrimento / mantenimento), decisa dallo staff. */}
      {today?.objective && PHASE_BADGE[today.objective] && (
        <div style={{ display: 'flex', marginBottom: 10 }}>
          <span
            className="chip"
            style={{
              background: `${PHASE_BADGE[today.objective].color}18`,
              color: PHASE_BADGE[today.objective].color,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <i className={`ti ${PHASE_BADGE[today.objective].icon}`} style={{ fontSize: 13 }} /> {PHASE_BADGE[today.objective].label}
          </span>
        </div>
      )}

      <StartDatePrompt />

      {/* Bonifico da completare: dati per pagare + carica contabile, direttamente in dashboard. */}
      <PendingBankTransfers />

      {/* Menu non ancora visibile: spiega perché e quando arriva (niente banner se c'è già il menu di oggi). */}
      {/*
        ⚠️ **`|| visitaDaFareEntro`, e senza è come non averlo scritto** (23/8). Il promemoria della
        visita («va fatta entro il 30, dopo i menu si fermano») serve proprio a chi i menu li sta
        **ricevendo**: è l'unico momento in cui è utile. Con la sola condizione «nessun pasto» lo
        avrebbe visto solo chi era già fermo per un altro motivo — cioè quasi nessuno, e il blocco le
        sarebbe arrivato addosso lo stesso senza preavviso.
        ⚠️ Il componente sa già stare zitto da solo (`menuStatusView` rende `null` su `available`):
        questa riga è una seconda copia della stessa decisione, e va tenuta d'accordo con quella.
      */}
      {menuStatus && (!meals || meals.length === 0 || menuStatus.visitaDaFareEntro) && (
        <MenuStatusBanner status={menuStatus} />
      )}

      {/* IL MENU DI OGGI */}
      {meals && meals.length > 0 && (
        <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #EEF1F0', boxShadow: '0 10px 24px rgba(16,48,42,.10)', marginBottom: 14 }}>
          <div style={{ background: 'var(--teal)', color: '#fff', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 700, letterSpacing: '.5px' }}>IL MENU DI OGGI</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{meals.length} pasti{totKcal > 0 ? ` · ${totKcal.toLocaleString('it-IT')} kcal` : ''}</div>
            </div>
            <button className="chip" onClick={() => setSheet('spesa')} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', padding: '6px 10px', fontSize: 11 }}>
              <i className="ti ti-basket" style={{ fontSize: 13 }} /> Spesa
            </button>
          </div>
          <div style={{ padding: '11px 12px 12px' }}>
            <div className="meal-carousel" ref={mealsRef} onScroll={onMealsScroll}>
              {meals.map((m, i) => {
                const s = slotInfo(m.slot);
                return (
                  <div className="meal-row" key={i}>
                    <div className="meal-thumb" style={{ background: s.bg }}><i className={`ti ${s.icon}`} style={{ color: s.color }} /></div>
                    <div className="meal-body">
                      <span className="meal-tag" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                      <div className="meal-name">{m.name}</div>
                      <div className="row-between">
                        <span className="muted" style={{ fontSize: 12 }}>{m.kcal} kcal</span>
                        <button className="btn-recipe" onClick={() => navigate(`/menu?ricetta=${m.recipeId}&giorno=${oggiIso()}&slot=${m.slot}`)}>Ricetta</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="home-dots">
              {meals.map((_, i) => <span key={i} className={i === mealIdx ? 'on' : ''} />)}
            </div>
          </div>
        </div>
      )}

      {/* PROSSIMO APPUNTAMENTO */}
      {nextAppt && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 14 }} onClick={() => navigate('/calendario')}>
          <span className="event-ic" style={{ background: '#EAF6F1', color: '#0E7C66', flex: 'none' }}>
            <i className="ti ti-calendar-event" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.3px' }}>PROSSIMO APPUNTAMENTO</div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
              {apptWhen(nextAppt.datetime)}
              {nextAppt.staffName ? ` · ${nextAppt.staffName}` : ''}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>{APPT_TYPE_LABEL[nextAppt.type] ?? 'Appuntamento'}</div>
          </div>
          <i className="ti ti-chevron-right" style={{ color: '#C6CFCB' }} />
        </div>
      )}

      {/* GAIA · LA FRASE DI OGGI */}
      <div style={{ background: 'var(--teal)', borderRadius: 20, padding: '14px 16px', color: '#fff', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 'none' }}>
            <Gaia size={60} controls={false} mouth="big" eyes="open" />
            <VoiceToggle size={17} style={{ opacity: 0.9 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, opacity: 0.9, fontWeight: 700, letterSpacing: '.4px' }}>
              <i className="ti ti-sparkles" style={{ fontSize: 10, verticalAlign: '-1px' }} /> GAIA · LA FRASE DI OGGI
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginTop: 5 }}>
              "<TypeText key={frase} segments={[{ t: frase }]} />"
            </div>
          </div>
        </div>
      </div>

      {/* KPI di oggi: kcal · acqua · passi */}
      <div style={{ display: 'flex', gap: 9, margin: '12px 0' }}>
        <KpiTile icon="ti-flame" value={totKcal > 0 ? totKcal.toLocaleString('it-IT') : '—'} label="kcal" color="#E8825A" />
        {/* Bevuto/obiettivo NELL'UNITÀ SCELTA dalla cliente: se conta in bottiglie, anche
            l'obiettivo è un numero intero di bottiglie (`waterGoalValue`), non il risultato con
            la virgola di una divisione — «1,8» accanto a «bottiglie da 1,5 L» si leggeva come se
            fosse la misura della bottiglia. Il litraggio esatto resta nel suggerimento. */}
        <KpiTile icon={waterIcon(waterUnit)} value={today ? `${waterValue(today.water.glasses, waterUnit)}/${waterGoalValue(today.water.goal, waterUnit)}` : '—'} label="acqua" color="#2AA7C4" onClick={today ? addWater : undefined} hint={today ? `Tocca per aggiungere ${waterUnit === 'glass' ? 'un bicchiere (250 ml)' : `una ${WATER_UNITS[waterUnit].label.toLowerCase().replace(/^bottiglie/, 'bottiglia')}`} · obiettivo di oggi ${waterLiters(today.water.goal)}` : undefined} />
        <KpiTile
          icon="ti-walk"
          value={deviceSteps != null ? deviceSteps.toLocaleString('it-IT') : today ? today.steps.steps.toLocaleString('it-IT') : '—'}
          label="passi"
          color="#3B6D11"
          hint={today ? `Obiettivo di oggi: ${today.steps.goal.toLocaleString('it-IT')} passi` : undefined}
          onInfo={today ? () => setInfoPassi(true) : undefined}
        />
      </div>

      {/* Porta un'amica: codice invito + condivisione nativa (voce #13). Sta subito sotto i
          quadrotti perché è lì che la cliente guarda ogni giorno; l'endpoint esisteva già ma
          nell'app non c'era nessun posto in cui vedere il proprio codice. */}
      <ReferralCard />

      {/* Aiuto rapido. Si intitolava "Help": unica parola inglese di tutta l'app cliente,
          e per giunta appiccicata alla card sopra. */}
      <div className="sec" style={{ margin: '14px 2px 8px' }}>Se ti serve una mano</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {HELP.map(({ icon, label, key, color, vaA }) => (
          <div key={key} className="card" style={{ flex: 1, margin: 0, textAlign: 'center', padding: '12px 4px', cursor: 'pointer' }} onClick={() => (vaA ? navigate(vaA) : setHelp(key))}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: color + '1f', color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px' }}>
              <i className={`ti ${icon}`} style={{ fontSize: 21 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* In arrivo: eventi/periodi speciali */}
      {events.length > 0 && (
        <>
          <div className="sec" style={{ margin: '14px 2px 8px' }}>In arrivo</div>
          {events.slice(0, 3).map((ev) => {
            const [lbl, icon, bg, color] = EV[ev.type] ?? EV.other;
            return (
              <div key={ev.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', marginBottom: 10 }} onClick={() => navigate('/percorso')}>
                <span className="event-ic" style={{ background: bg, color, flex: 'none' }}><i className={`ti ${icon}`} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.label || lbl} {whenLabel(ev.startDate)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>Ti preparo per arrivarci al meglio</div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: '#C6CFCB' }} />
              </div>
            );
          })}
        </>
      )}

      {/* Popup check-in giornaliero */}
      {/* `checkinDue` arriva dal server e include la regola "solo con un piano attivo" (voce #1):
          a piano scaduto il popup non compare più. Il fallback su checkinDone/checkinSkipped
          serve solo finché un'app vecchia parla con un backend nuovo. */}
      {checkinAschermo && (
        <CheckinPopup onSubmit={submitCheckin} onSkip={skipCheckin} busy={checkinBusy} />
      )}
      {/* Popup "Com'è andata ieri?" — solo quando il check-in non è a schermo */}
      {!checkinAschermo && <MenuReviewPopup onAschermo={setReviewAschermo} />}
      {sheet === 'spesa' && <Sheet onClose={() => setSheet(null)}><SpesaList /></Sheet>}

      {/*
        DA DOVE ESCE L'OBIETTIVO PASSI (richiesta di Simone, 12/8).
        Serve perché quel numero **cambia da solo**: sale del 5% ogni due settimane. Un obiettivo che
        si muove senza che nessuno lo spieghi si legge come un guasto — «ieri erano 8.000, oggi
        8.400» — e la reazione non è camminare di più, è smettere di fidarsi del numero.
      */}
      {infoPassi && (
        <Sheet onClose={() => setInfoPassi(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: '#3B6D11', color: '#fff', flex: 'none' }}>
              <i className="ti ti-walk" />
            </span>
            <b style={{ fontSize: 15 }}>Il tuo obiettivo di passi</b>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.65, color: '#2E3E3B' }}>
            <p style={{ margin: '0 0 10px' }}>
              I primi giorni l'obiettivo nasce da quello che ci hai raccontato tu: quanto ti muovi
              nella giornata, il lavoro che fai, com'è fatta la tua settimana. Parte da lì apposta —
              da un numero che puoi prendere davvero.
            </p>
            <p style={{ margin: '0 0 10px' }}>
              Poi cresce con te, un poco per volta. Ogni due settimane si alza di un passo piccolo:
              abbastanza da portarti avanti, abbastanza poco da non pesarti addosso. Non è una gara
              con nessun altro, è la tua strada che si allunga mentre ti abitui.
            </p>
            <p style={{ margin: 0 }}>
              Se in qualche giornata non ci arrivi non è un problema: conta molto di più quello che
              fai la maggior parte dei giorni. E se ti sembra troppo, o troppo poco, dillo alla tua
              coach — l'obiettivo si cambia.
            </p>
          </div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 11, marginTop: 14 }} onClick={() => setInfoPassi(false)}>
            Ho capito
          </button>
        </Sheet>
      )}
      {help && SHEETS[help] && (
        <Sheet onClose={() => setHelp(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <span className="event-ic" style={{ background: 'var(--teal)', color: '#fff', flex: 'none' }}><i className="ti ti-sparkles" /></span>
            <b style={{ fontSize: 15 }}>{SHEETS[help].t}</b>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#2E3E3B', marginBottom: 14 }}>{SHEETS[help].b}</div>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 11 }} onClick={() => { if (help === 'fame') navigate('/contatti'); setHelp(null); }}>{SHEETS[help].cta}</button>
        </Sheet>
      )}
    </div>
  );
}
