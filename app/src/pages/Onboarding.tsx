import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { clipForPage, isMuted, setMuted } from '../audio/gaia';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import { TypeText } from '../components/TypeText';
import BrandPicker from '../components/BrandPicker';
import { applyBrand } from '../lib/brand';
import FieldInput from '../onboarding/Field';
import PlanFlow from './PlanFlow';
import type { Field, OnboardingResult, Page, Questions } from '../onboarding/types';

type Answers = Record<string, unknown>;

/**
 * Le 5 sezioni nell'ordine del prototipo definitivo (Metabole_Prototipo_Navigabile):
 * Corpo → Testa → Vita → Agenda → Gusto.
 * NB: 'meals' non è nel documento ma il backend richiede mealsPerDay → lo teniamo in Vita.
 */
// Sezioni allineate 1:1 al prototipo (docs/): ordine testa·vita·agenda·gusto·corpo,
// nomi/tab/intro/note e COLORI esatti dalla direttiva §3.
const SECTIONS = [
  { key: 'testa', tab: 'Mente', name: 'La mente', intro: 'Partiamo dalla tua mente', note: 'Motivazione e carattere: come vuoi essere seguita.', say: "Per prima cosa, cosa c'è nella tua mente? L'equilibrio mentale è il primo passo per ritrovare la forma fisica corretta. Rispondi pure alle prossime domande.", desc: 'Motivazione e carattere', icon: 'ti-mood-smile', color: '#6C4CD6', soft: '#F3EFFB', voice: 'intro_testa', pages: ['why', 'coach_style', 'character'] },
  { key: 'vita', tab: 'Vita', name: 'La vita', intro: 'La tua vita di tutti i giorni', note: 'Lavoro, tempo e ritmo dei pasti.', say: 'Ora è importante capire le tue abitudini nella vita reale: lavoro, tempo e abitudini. Così posso predisporre un piano adeguato alle tue esigenze.', desc: 'Lavoro, pasti e tempo', icon: 'ti-briefcase', color: '#2F80ED', soft: '#EDF3FE', voice: 'intro_vita', pages: ['lifestyle', 'path'] },
  { key: 'agenda', tab: 'Agenda', name: "L'agenda", intro: 'Eventi e periodi speciali', note: 'Vacanze e feste in cui non segui la dieta.', say: 'Parliamo della tua agenda: feste, cene, viaggi. Non sono ideali per fare diete, ma questi momenti piacevoli si gestiscono: basta pianificarli.', desc: 'Eventi e periodi speciali', icon: 'ti-calendar-heart', color: '#E8543C', soft: '#FDF0EC', voice: 'intro_agenda', pages: ['pause_periods'] },
  { key: 'gusto', tab: 'Gusto', name: 'Il gusto', intro: 'Adesso i tuoi gusti', note: 'Regime, stile e cibi che eviti.', say: 'E il gusto: cosa ami e cosa eviti. Mangiare bene deve piacerti, o non dura.', desc: 'Regime, stile e cibi', icon: 'ti-tools-kitchen-2', color: '#E8A11B', soft: '#FEF7E8', voice: 'intro_gusto', pages: ['regime', 'style', 'tastes'] },
  { key: 'corpo', tab: 'Corpo', name: 'Il corpo', intro: 'Per finire: i tuoi obiettivi', note: 'Peso e misure: il punto di partenza, senza giudizi.', say: 'Bene, ora so tutto di te, tranne quali sono i tuoi obiettivi: peso e misure sono obiettivi, senza giudizi. Dimmi dove sei e dove vuoi arrivare.', desc: 'Peso, misure e obiettivo', icon: 'ti-target', color: '#12A386', soft: '#EAF7F2', voice: 'intro_corpo', pages: ['identity', 'baseline', 'intolerances', 'health', 'objective'] },
] as const;

type Section = (typeof SECTIONS)[number];
type Item =
  | { t: 'overview' }
  | { t: 'section'; sec: Section; n: number }
  | { t: 'page'; page: Page; sec: Section }
  | { t: 'theme'; page: Page }
  | { t: 'consent' };

function isFilled(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

/** Messaggio d'errore per un campo numerico fuori dall'intervallo consentito. */
function fieldIssue(f: Field, v: unknown): string | null {
  if (f.type !== 'number' || !isFilled(v)) return null;
  const n = Number(v);
  const name = f.label ?? 'Valore';
  if (Number.isNaN(n)) return `${name}: valore non valido`;
  if (f.min != null && n < f.min) return `${name}: minimo ${f.min}`;
  if (f.max != null && n > f.max) return `${name}: massimo ${f.max}`;
  return null;
}

function cleanObj<T extends Record<string, unknown>>(obj: T): T | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return Object.keys(out).length ? (out as T) : undefined;
}

interface DietProduct { id: string; style: string; name: string; description: string | null; highlights: string[]; seasonalTag: string | null }

/** Etichette leggibili di ripiego se una dieta non ha un nome cliente impostato:
 *  così non mostriamo mai il codice grezzo (es. "low_carb") ma "Low carb". */
const STYLE_LABELS: Record<string, string> = {
  mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile',
  keto: 'Chetogenica', vegan: 'Vegana', vegetarian: 'Vegetariana', balanced: 'Equilibrata',
  summer_return: 'Rientro estivo', summer_holiday: 'Vacanza estiva', detox: 'Detox',
};
const prettyStyle = (s: string) => STYLE_LABELS[s] ?? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Schermo 16 "Stile che preferisci": prodotti (diete) letti dall'API a runtime (zero-redeploy).
 *  Ogni nome è toccabile → caratteristiche principali. Solo diete reali approvate: nessun ripiego statico. */
function DietProductsBlock({ value, onChange }: { value: unknown; onChange: (k: string, v: unknown) => void }) {
  const [products, setProducts] = useState<DietProduct[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<DietProduct[]>('/onboarding/diet-products')
      .then((r) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => setProducts([]));
  }, []);

  if (!products) return <div className="center" style={{ minHeight: 80 }}><div className="spin" /></div>;

  // Solo diete reali del catalogo (approvate e visibili al cliente): niente ripiego statico.
  // Se non ce ne sono, lo diciamo — le pubblica il nutrizionista dal backoffice.
  if (products.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '16px 14px' }}>
        <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          Al momento non ci sono piani disponibili. Le diete vengono pubblicate dal nutrizionista dal catalogo.
        </p>
      </div>
    );
  }

  const sel = String(value ?? '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {products.map((p) => {
        const on = sel === p.style;
        const isOpen = open === p.style;
        return (
          <div key={p.style} className="card" style={{ display: 'block', border: on ? '2px solid var(--teal)' : undefined }}>
            <div className="row-between" style={{ cursor: 'pointer' }} onClick={() => onChange('dietStyle', p.style)}>
              <b style={{ fontSize: 15 }}>
                {p.name && p.name !== p.style ? p.name : prettyStyle(p.style)}
                {p.seasonalTag && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--teal)', background: 'rgba(51,177,144,.12)', padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{p.seasonalTag}</span>}
              </b>
              {on
                ? <i className="ti ti-circle-check" style={{ color: 'var(--teal)', fontSize: 20 }} />
                : <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--line)', display: 'inline-block' }} />}
            </div>
            {(p.description || p.highlights.length > 0) && (
              <button
                type="button"
                className="link"
                style={{ background: 'none', border: 0, padding: '6px 0 0', cursor: 'pointer', fontSize: 12, margin: 0 }}
                onClick={() => setOpen(isOpen ? null : p.style)}
              >
                {isOpen ? 'Nascondi' : 'Caratteristiche principali'} <i className={`ti ti-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: 13, verticalAlign: '-2px' }} />
              </button>
            )}
            {isOpen && (
              <div style={{ marginTop: 6 }}>
                {p.description && <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{p.description}</div>}
                {p.highlights.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: 13, marginBottom: 3 }}>
                    <i className="ti ti-check" style={{ color: 'var(--teal)', flex: 'none' }} /> <span>{h}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Obiettivo con slider e banner di sostenibilità (come nel prototipo). */
function ObjectiveBlock({ page, answers, setAnswer }: { page: Page; answers: Answers; setAnswer: (k: string, v: unknown) => void }) {
  useEffect(() => {
    if (answers.weightToLoseKg == null || answers.weightToLoseKg === '') setAnswer('weightToLoseKg', 6);
    if (answers.weeks == null || answers.weeks === '') setAnswer('weeks', 18);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const kg = Number(answers.weightToLoseKg ?? 6);
  const wk = Number(answers.weeks ?? 18);
  const rate = kg / wk;
  let banner: { bg: string; color: string; text: string };
  if (rate <= 0.7) banner = { bg: '#DCF0D8', color: '#3B6D11', text: `Sostenibile · circa ${rate.toFixed(1).replace('.', ',')} kg a settimana` };
  else if (rate <= 1) banner = { bg: '#FBF0D6', color: '#8A5A0B', text: `Ambizioso, al limite · ${rate.toFixed(1).replace('.', ',')} kg/sett` };
  else banner = { bg: '#F7DAD6', color: '#993C1D', text: `Troppo veloce. Ti propongo circa ${Math.ceil(kg / 0.7)} settimane.` };

  const waist = page.fields.find((f) => f.key === 'waistToLoseCm');
  const hips = page.fields.find((f) => f.key === 'hipsToLoseCm');
  return (
    <>
      <div className="card">
        <div className="obj-row">
          <label>Peso da perdere</label>
          <input type="range" min={1} max={40} value={kg} onChange={(e) => setAnswer('weightToLoseKg', Number(e.target.value))} />
          <span className="obj-val">{kg} kg</span>
        </div>
        <div className="obj-row">
          <label>Entro</label>
          <input type="range" min={3} max={52} value={wk} onChange={(e) => setAnswer('weeks', Number(e.target.value))} />
          <span className="obj-val">{wk} sett.</span>
        </div>
        <div className="obj-banner" style={{ background: banner.bg, color: banner.color }}>{banner.text}</div>
      </div>
      {(waist || hips) && (
        <div className="fields-grid">
          {waist && <FieldInput field={waist as Field} value={answers[waist.key]} onChange={setAnswer} />}
          {hips && <FieldInput field={hips as Field} value={answers[hips.key]} onChange={setAnswer} />}
        </div>
      )}
    </>
  );
}

/** Step "Scegli il colore della tua app": selettore reale (6 colori + Auto) che
 *  applica e salva il colore scelto. Registra la scelta in answers.themeColor. */
function ThemeBlock({ onChange }: { onChange: (k: string, v: unknown) => void }) {
  return (
    <>
      <p className="muted" style={{ marginTop: -4, marginBottom: 14 }}>Il tema dell'app, diverso dai colori delle sezioni.</p>
      <div className="card">
        <BrandPicker onPick={(_value, resolved) => onChange('themeColor', resolved)} />
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 11.5 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 12, verticalAlign: '-1px' }} /> L'ultimo pulsante è <b>Auto</b>: un colore nuovo ogni due giorni.
        </p>
      </div>
    </>
  );
}

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [questions, setQuestions] = useState<Questions | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const { user } = useAuth();
  // Bozza locale dell'onboarding: se l'utente perde la linea o chiude l'app a metà,
  // al rientro (anche dopo il logout, stesso dispositivo) riprende da dove era arrivato.
  const draftKey = user?.id ? `metabole_onb_draft_${user.id}` : null;
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    api<Questions>('/onboarding/questions')
      .then(setQuestions)
      .catch(() => setLoadErr('Non riesco a caricare il questionario. Riprova tra poco.'));
  }, []);

  // Il nome è già stato preso in registrazione: lo pre-compiliamo e non lo richiediamo di nuovo.
  useEffect(() => {
    if (user?.firstName) setAnswer('name', user.firstName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.firstName]);

  const flow: Item[] = useMemo(() => {
    if (!questions) return [];
    const byKey: Record<string, Page> = Object.fromEntries(questions.pages.map((p) => [p.key, p]));
    const items: Item[] = [{ t: 'overview' }];
    SECTIONS.forEach((sec, si) => {
      items.push({ t: 'section', sec, n: si + 1 });
      sec.pages.forEach((pk) => {
        const p = byKey[pk];
        if (p) items.push({ t: 'page', page: p, sec });
      });
    });
    if (byKey['theme']) items.push({ t: 'theme', page: byKey['theme'] });
    items.push({ t: 'consent' });
    return items;
  }, [questions]);

  const cur = flow[idx];

  // Ripristina la bozza salvata (risposte + passo) una volta caricato il questionario.
  useEffect(() => {
    if (draftLoaded || !questions || !draftKey || flow.length === 0) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as { answers?: Answers; idx?: number };
        if (d.answers) setAnswers((prev) => ({ ...prev, ...d.answers }));
        if (typeof d.idx === 'number') setIdx(Math.min(Math.max(0, d.idx), flow.length - 1));
      }
    } catch {
      /* bozza corrotta: la ignoriamo e si riparte da capo */
    }
    setDraftLoaded(true);
  }, [questions, draftKey, draftLoaded, flow.length]);

  // Salva la bozza a ogni cambio di risposta o passo (solo dopo il caricamento iniziale).
  useEffect(() => {
    if (!draftLoaded || !draftKey || result) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, idx }));
    } catch {
      /* quota piena o storage non disponibile: ignora */
    }
  }, [answers, idx, draftLoaded, draftKey, result]);

  useEffect(() => {
    const c = answers.themeColor as string | undefined;
    if (c) applyBrand(c);
  }, [answers.themeColor]);

  // Conto alla rovescia della schermata "Sto cucendo il tuo percorso".
  useEffect(() => {
    if (!submitting) return;
    setCountdown(6);
    const id = setInterval(() => setCountdown((c) => (c > 1 ? c - 1 : 1)), 1000);
    return () => clearInterval(id);
  }, [submitting]);

  const clip = useMemo(() => {
    if (result) return 'percorso';
    if (!cur) return undefined;
    if (cur.t === 'overview') return 'facciamo';
    if (cur.t === 'section') return cur.sec.voice;
    if (cur.t === 'page') return clipForPage(cur.page);
    if (cur.t === 'theme') return 'colore';
    return undefined;
  }, [cur, result]);

  function setAnswer(key: string, value: unknown) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }
  function toggleMute() {
    const n = !muted;
    setMuted(n);
    setMutedState(n);
  }

  // Solo le pagine "vere" hanno validazione sui campi; lo step tema ha sempre un colore valido.
  const activePage = cur && cur.t === 'page' ? cur.page : null;
  // Controllo intervalli (min/max) per dare un messaggio chiaro qui, non un errore del backend alla fine.
  const rangeIssue = activePage
    ? activePage.fields.map((f) => (isFilled(answers[f.key]) ? fieldIssue(f, answers[f.key]) : null)).find(Boolean) ?? null
    : null;
  const requiredMissing = activePage ? activePage.fields.some((f) => f.required && !isFilled(answers[f.key])) : false;
  const pageValid = !rangeIssue && !requiredMissing;

  function next() {
    if (activePage && !pageValid) return;
    if (idx < flow.length - 1) setIdx((i) => i + 1);
  }
  function back() {
    if (idx > 0) setIdx((i) => i - 1);
  }

  async function submit() {
    setSubmitErr(null);
    setSubmitting(true);
    const a = answers;
    // La schermata "Quanti pasti" non c'è più: il numero di pasti si deduce dal percorso scelto.
    const mealsByPath: Record<string, number> = { five: 5, classic3: 3, supplements: 5, intermittent_fasting: 3 };
    const mealsRaw = Number(a.mealsPerDay);
    const mealsPerDay = mealsRaw >= 3 && mealsRaw <= 5 ? mealsRaw : (mealsByPath[String(a.pathType)] ?? 5);
    const dto: Record<string, unknown> = {
      name: a.name,
      age: Number(a.age),
      sex: a.sex,
      heightCm: Number(a.heightCm),
      startWeightKg: Number(a.startWeightKg),
      regime: a.regime,
      dietStyle: a.dietStyle,
      mealsPerDay,
      pathType: a.pathType,
      coachStyle: a.coachStyle,
      character: a.character,
      health: { hasConditions: a.hasConditions, takesMedications: a.takesMedications },
      objective: cleanObj({
        weightToLoseKg: Number(a.weightToLoseKg),
        weeks: Number(a.weeks),
        waistToLoseCm: a.waistToLoseCm != null && a.waistToLoseCm !== '' ? Number(a.waistToLoseCm) : undefined,
        hipsToLoseCm: a.hipsToLoseCm != null && a.hipsToLoseCm !== '' ? Number(a.hipsToLoseCm) : undefined,
      }),
      healthDataConsent: true,
    };
    if (a.startWaistCm != null && a.startWaistCm !== '') dto.startWaistCm = Number(a.startWaistCm);
    if (a.startHipsCm != null && a.startHipsCm !== '') dto.startHipsCm = Number(a.startHipsCm);
    // "altro" è solo un flag UI per mostrare il campo libero: non è un allergene reale.
    const hasOtherAllergy = Array.isArray(a.allergies) && (a.allergies as string[]).includes('altro');
    if (Array.isArray(a.allergies) && a.allergies.length) {
      const real = (a.allergies as string[]).filter((x) => x !== 'altro');
      if (real.length) dto.allergies = real;
    }
    if (hasOtherAllergy && Array.isArray(a.allergiesOther) && a.allergiesOther.length) dto.allergiesOther = a.allergiesOther;
    if (Array.isArray(a.intolerances) && a.intolerances.length) dto.intolerances = a.intolerances;
    if (Array.isArray(a.dislikedFoods) && a.dislikedFoods.length) dto.dislikedFoods = a.dislikedFoods;
    const lifestyle = cleanObj({ work: a.work, cookingTime: a.cookingTime, weekdayLunch: a.weekdayLunch, motivation: a.why });
    if (lifestyle) dto.lifestyle = lifestyle;
    if (a.themeColor) dto.themeColor = a.themeColor;
    if (Array.isArray(a.pausePeriods) && a.pausePeriods.length) dto.consents = { pausePeriods: a.pausePeriods };

    const t0 = performance.now();
    try {
      const res = await api<OnboardingResult>('/onboarding/answers', { method: 'POST', body: JSON.stringify(dto) });
      // Schermo "Sto cucendo il tuo percorso": teniamo la transizione visibile
      // ~6s (durata della voce di Gaia) anche se l'API risponde subito.
      const elapsed = performance.now() - t0;
      if (elapsed < 6000) await new Promise((r) => setTimeout(r, 6000 - elapsed));
      // Onboarding completato: la bozza locale non serve più.
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignora */ } }
      setResult(res);
    } catch (e) {
      setSubmitErr(e instanceof ApiError ? e.message : 'Qualcosa non ha funzionato. Riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  const MuteBtn = () => (
    <button className="voice-toggle" onClick={toggleMute} aria-label={muted ? 'Riattiva la voce' : 'Silenzia Gaia'}>
      <i className={`ti ${muted ? 'ti-volume-off' : 'ti-volume-2'}`} />
    </button>
  );

  // ---------- Render ----------

  if (loadErr) {
    return <div className="app-frame"><div className="screen no-tabbar center"><div className="banner err">{loadErr}</div></div></div>;
  }
  if (!questions || !cur) {
    return <div className="app-frame"><div className="screen no-tabbar center"><div className="spin" /></div></div>;
  }

  // Percorso pronto → coda commerciale (piano, pagamento demo, data, conferme).
  if (result) return <PlanFlow result={result} onDone={onDone} />;

  // Schermo 25 — "Sto cucendo il tuo percorso" (transizione mentre il motore calcola).
  if (submitting) {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16, padding: 24 }}>
          <Gaia clip="elaboro" size={120} controls={false} mouth="big" />
          <h1 style={{ margin: 0 }}>Sto cucendo il tuo percorso</h1>
          <div className="bubble" style={{ maxWidth: 320, borderRadius: 14, padding: '12px 14px' }}>
            <TypeText segments={[{ t: 'Dammi un momento: sto confrontando i protocolli, consulto il nutrizionista e ' }, { t: 'cucio il tuo percorso su misura', b: true }, { t: '.' }]} />
          </div>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--teal)', lineHeight: 1 }}>{countdown}</div>
            <div className="muted" style={{ fontSize: 13 }}>second{countdown === 1 ? 'o' : 'i'}</div>
          </div>
        </div>
      </div>
    );
  }

  if (cur.t === 'section') {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar sec-intro" style={{ background: cur.sec.color }}>
          <div className="sec-top">Sezione {cur.n} di 5</div>
          <div className="sec-dots">{SECTIONS.map((s, i) => <span key={s.key} className={i === cur.n - 1 ? 'sec-dot on' : 'sec-dot'} />)}</div>
          <div className="sec-center">
            <Gaia clip={clip} size={140} controls={false} />
            <div className="sec-name">{cur.sec.name}</div>
            <div className="sec-headline">{cur.sec.intro}</div>
            <div className="sec-note">{cur.sec.note}</div>
            <TypeText key={`say-${cur.sec.key}`} className="sec-say" segments={[{ t: cur.sec.say }]} />
          </div>
          <button className="btn" style={{ background: '#fff', color: cur.sec.color }} onClick={next}>Iniziamo</button>
        </div>
      </div>
    );
  }

  const curSecKey = cur.t === 'page' ? cur.sec.key : cur.t === 'theme' ? 'gusto' : null;
  const curSoft = curSecKey ? SECTIONS.find((s) => s.key === curSecKey)?.soft : undefined;

  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb" style={curSoft ? { background: curSoft } : undefined}>
        <MuteBtn />
        <div className="progress"><div className="progress-bar" style={{ width: `${((idx + 1) / flow.length) * 100}%` }} /></div>

        {curSecKey && (
          <>
            <div className="secbar">
              {SECTIONS.map((s) => {
                const passed = SECTIONS.findIndex((x) => x.key === s.key) <= SECTIONS.findIndex((x) => x.key === curSecKey);
                return <span key={s.key} className={passed ? 'on' : ''} />;
              })}
            </div>
            <div className="seclbl">{SECTIONS.map((s) => <span key={s.key} className={s.key === curSecKey ? 'active' : ''}>{s.tab}</span>)}</div>
          </>
        )}

        {cur.t === 'overview' && (
          <div className="onb-body">
            <h1>Facciamo conoscenza</h1>
            <p className="muted">Cinque aree per costruire il tuo percorso.</p>
            <div className="qbubble">
              <Gaia clip={clip} size={62} controls={false} />
              <div className="bubble">
                <TypeText segments={[{ t: 'Per settare e personalizzare la tua app ho bisogno di qualche indicazione su questi ' }, { t: 'cinque punti', b: true }, { t: '.' }]} />
              </div>
            </div>
            <div className="areas">
              {SECTIONS.map((s) => (
                <div className="area" key={s.key}>
                  <span className="area-ic" style={{ background: s.color }}>
                    <i className={`ti ${s.icon}`} />
                  </span>
                  <span className="area-txt">
                    <b>{s.tab}</b>
                    <span className="muted">{s.desc}</span>
                  </span>
                </div>
              ))}
            </div>
            <button className="btn" onClick={next}>Iniziamo il test</button>
          </div>
        )}

        {(cur.t === 'page' || cur.t === 'theme') && (
          <div className="onb-body">
            <div className="qbubble">
              <Gaia clip={clip} size={62} controls={false} />
              <div className="bubble"><TypeText key={idx} segments={[{ t: cur.t === 'theme' ? 'Anche i colori sono importanti: seleziona quello che ti piace di più e trasformerò la app secondo la tua scelta.' : (cur.page.subtitle || "Rispondi con calma, non c'è fretta.") }]} /></div>
            </div>
            <h1>{cur.t === 'theme' ? 'Scegli il colore della tua app' : cur.page.title}</h1>
            <div className={`onb-fields${cur.t === 'page' && cur.page.key === 'baseline' ? ' fields-grid' : ''}`}>
              {cur.t === 'theme' ? (
                <ThemeBlock onChange={setAnswer} />
              ) : cur.page.key === 'objective' ? (
                <ObjectiveBlock page={cur.page} answers={answers} setAnswer={setAnswer} />
              ) : cur.page.key === 'style' ? (
                <DietProductsBlock value={answers.dietStyle} onChange={setAnswer} />
              ) : (
                cur.page.fields
                  // "Altra allergia non in elenco" appare solo se ho spuntato "Altro" tra le allergie.
                  .filter((f) => f.key !== 'allergiesOther' || (Array.isArray(answers.allergies) && (answers.allergies as string[]).includes('altro')))
                  .map((f) => <FieldInput key={f.key} field={f} value={answers[f.key]} onChange={setAnswer} />)
              )}
            </div>
            {rangeIssue && <p className="field-issue">{rangeIssue}</p>}
            <div className="onb-nav">
              <button className="btn ghost" onClick={back}>Indietro</button>
              <button className="btn" onClick={next} disabled={!pageValid}>Avanti</button>
            </div>
          </div>
        )}

        {cur.t === 'consent' && (
          <div className="onb-body">
            <div className="qbubble">
              <Gaia clip="privacy" size={62} controls={false} />
              <div className="bubble">
                <TypeText segments={[{ t: 'Manca solo la tua approvazione al trattamento dei dati personali e potrò costruire il tuo percorso personalizzato di ' }, { t: 'MetaboleAI', b: true }, { t: '. Clicca su accetta e procedo.' }]} />
              </div>
            </div>
            <h1 style={{ marginBottom: 2 }}>Trattamento dei dati personali</h1>
            <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>La tua privacy prima di tutto.</p>
            <div className="card" style={{ padding: '12px 13px' }}>
              {([
                ['ti-shield-check', 'Dati trattati in Europa, secondo il GDPR.'],
                ['ti-stethoscope', 'I dati sulla salute li vede solo il tuo nutrizionista.'],
                ['ti-eye-off', 'Non usiamo i tuoi dati per scopi diversi dal servizio.'],
                ['ti-rotate', 'Puoi revocare il consenso quando vuoi.'],
              ] as [string, string][]).map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 18, color: 'var(--teal)', flex: 'none', marginTop: 1 }} />
                  <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{text}</span>
                </div>
              ))}
            </div>
            {submitErr && <div className="banner err">{submitErr}</div>}
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Ho letto e <b>accetto</b> il trattamento dei miei dati personali per l'erogazione del servizio.</span>
            </label>
            <span className="link" style={{ display: 'inline-block', marginTop: 8, fontSize: 13 }}>Leggi l'informativa completa</span>
            <div className="onb-nav">
              <button className="btn ghost" onClick={back} disabled={submitting}>Indietro</button>
              <button className="btn" onClick={submit} disabled={!consent || submitting}>
                {submitting ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Ho letto e accetto'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
