import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { clipForPage, isMuted, setMuted } from '../audio/gaia';
import Gaia from '../components/Gaia';
import FieldInput from '../onboarding/Field';
import type { Field, OnboardingResult, Page, Questions } from '../onboarding/types';

type Answers = Record<string, unknown>;

/**
 * Le 5 sezioni nell'ordine corretto (Metabole_Sequenza_Schermate.md):
 * Mente → Vita → Agenda → Gusto → Corpo (il corpo/obiettivo è volutamente l'ultimo).
 * NB: 'meals' non è nel documento ma il backend richiede mealsPerDay → lo teniamo in Vita.
 */
const SECTIONS = [
  { key: 'testa', tab: 'Mente', name: 'La mente', intro: 'Ora motivazione e carattere', note: 'Come vuoi essere seguita e che tipo sei.', color: '#6C5AB7', voice: 'intro_testa', pages: ['coach_style', 'character'] },
  { key: 'vita', tab: 'Vita', name: 'La vita', intro: 'La tua vita di tutti i giorni', note: 'Lavoro, tempo e ritmo dei pasti.', color: '#2E7BB5', voice: 'intro_vita', pages: ['lifestyle', 'meals', 'path'] },
  { key: 'agenda', tab: 'Agenda', name: "L'agenda", intro: 'Eventi e periodi speciali', note: 'Vacanze e feste in cui non segui la dieta.', color: '#E8825A', voice: 'intro_agenda', pages: ['pause_periods'] },
  { key: 'gusto', tab: 'Gusto', name: 'Il gusto', intro: 'Adesso i tuoi gusti', note: 'Regime, stile e cibi che eviti.', color: '#B8863B', voice: 'intro_gusto', pages: ['regime', 'style', 'tastes'] },
  { key: 'corpo', tab: 'Corpo', name: 'Il corpo', intro: 'Procediamo con le domande sul corpo', note: 'Peso, misure e obiettivo. Niente giudizi: mi servono solo per partire.', color: '#12A386', voice: 'intro_corpo', pages: ['identity', 'baseline', 'intolerances', 'health', 'objective'] },
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

function cleanObj<T extends Record<string, unknown>>(obj: T): T | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return Object.keys(out).length ? (out as T) : undefined;
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
  return (
    <>
      <div className="card">
        <div className="obj-row">
          <label>Peso da perdere</label>
          <input type="range" min={1} max={20} value={kg} onChange={(e) => setAnswer('weightToLoseKg', Number(e.target.value))} />
          <span className="obj-val">{kg} kg</span>
        </div>
        <div className="obj-row">
          <label>Entro</label>
          <input type="range" min={3} max={52} value={wk} onChange={(e) => setAnswer('weeks', Number(e.target.value))} />
          <span className="obj-val">{wk} sett.</span>
        </div>
        <div className="obj-banner" style={{ background: banner.bg, color: banner.color }}>{banner.text}</div>
      </div>
      {waist && <FieldInput field={waist as Field} value={answers[waist.key]} onChange={setAnswer} />}
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
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    api<Questions>('/onboarding/questions')
      .then(setQuestions)
      .catch(() => setLoadErr('Non riesco a caricare il questionario. Riprova tra poco.'));
  }, []);

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

  useEffect(() => {
    const c = answers.themeColor as string | undefined;
    if (c) document.documentElement.style.setProperty('--teal', c);
  }, [answers.themeColor]);

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

  const activePage = cur && (cur.t === 'page' || cur.t === 'theme') ? cur.page : null;
  const pageValid = !activePage || activePage.fields.every((f) => !f.required || isFilled(answers[f.key]));

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
    const dto: Record<string, unknown> = {
      name: a.name,
      age: Number(a.age),
      sex: a.sex,
      heightCm: Number(a.heightCm),
      startWeightKg: Number(a.startWeightKg),
      regime: a.regime,
      dietStyle: a.dietStyle,
      mealsPerDay: Number(a.mealsPerDay),
      pathType: a.pathType,
      coachStyle: a.coachStyle,
      character: a.character,
      health: { hasConditions: a.hasConditions, takesMedications: a.takesMedications },
      objective: cleanObj({
        weightToLoseKg: Number(a.weightToLoseKg),
        weeks: Number(a.weeks),
        waistToLoseCm: a.waistToLoseCm != null && a.waistToLoseCm !== '' ? Number(a.waistToLoseCm) : undefined,
      }),
      healthDataConsent: true,
    };
    if (a.startWaistCm != null && a.startWaistCm !== '') dto.startWaistCm = Number(a.startWaistCm);
    if (a.startHipsCm != null && a.startHipsCm !== '') dto.startHipsCm = Number(a.startHipsCm);
    if (Array.isArray(a.intolerances) && a.intolerances.length) dto.intolerances = a.intolerances;
    if (Array.isArray(a.dislikedFoods) && a.dislikedFoods.length) dto.dislikedFoods = a.dislikedFoods;
    const lifestyle = cleanObj({ work: a.work, cookingTime: a.cookingTime, weekdayLunch: a.weekdayLunch });
    if (lifestyle) dto.lifestyle = lifestyle;
    if (a.themeColor) dto.themeColor = a.themeColor;
    if (Array.isArray(a.pausePeriods) && a.pausePeriods.length) dto.consents = { pausePeriods: a.pausePeriods };

    try {
      const res = await api<OnboardingResult>('/onboarding/answers', { method: 'POST', body: JSON.stringify(dto) });
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

  if (result) {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar onb">
          <div className="onb-gaia"><Gaia clip={clip} size={132} controls={false} /></div>
          <div className="onb-body">
            <h1>Il tuo percorso è pronto! 🎉</h1>
            <div className="card result-card">
              <div className="result-name">{result.path.name}</div>
              {result.path.tags.length > 0 && <div className="result-tags">{result.path.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>}
            </div>
            <div className="card">
              <h2>Il tuo team</h2>
              <p className="muted" style={{ margin: 0 }}>
                Coach: <b>{result.team.coach?.displayName ?? 'in assegnazione'}</b><br />
                Nutrizionista: <b>{result.team.nutritionist?.displayName ?? 'in assegnazione'}</b>
              </p>
            </div>
            <div className="card"><h2>Prima visita</h2><p className="muted" style={{ margin: 0 }}>{result.firstVisit.note}</p></div>
            <button className="btn" onClick={onDone}>Entra nell'app</button>
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
          </div>
          <button className="btn" style={{ background: '#fff', color: cur.sec.color }} onClick={next}>Iniziamo</button>
        </div>
      </div>
    );
  }

  const curSecKey = cur.t === 'page' ? cur.sec.key : cur.t === 'theme' ? 'corpo' : null;

  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb">
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
            <div className="onb-gaia"><Gaia clip={clip} size={116} controls={false} /></div>
            <h1>Facciamo conoscenza</h1>
            <p className="muted">Poche domande, divise in cinque aree, per costruire il tuo percorso:</p>
            <div className="areas">
              {SECTIONS.map((s) => (
                <div className="area" key={s.key}>
                  <span className="area-dot" style={{ background: s.color }} />
                  <span>{s.name}</span>
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
              <div className="bubble">{cur.page.subtitle || "Rispondi con calma, non c'è fretta."}</div>
            </div>
            <h1>{cur.page.title}</h1>
            <div className={`onb-fields${cur.page.key === 'baseline' ? ' fields-grid' : ''}`}>
              {cur.t === 'page' && cur.page.key === 'objective' ? (
                <ObjectiveBlock page={cur.page} answers={answers} setAnswer={setAnswer} />
              ) : (
                cur.page.fields.map((f) => <FieldInput key={f.key} field={f} value={answers[f.key]} onChange={setAnswer} />)
              )}
            </div>
            <div className="onb-nav">
              <button className="btn ghost" onClick={back}>Indietro</button>
              <button className="btn" onClick={next} disabled={!pageValid}>Avanti</button>
            </div>
          </div>
        )}

        {cur.t === 'consent' && (
          <div className="onb-body">
            <h1>Un ultimo passo</h1>
            <p className="muted">
              Per costruire un percorso sicuro trattiamo alcuni dati sulla tua salute. Sono visibili solo a te
              e al tuo nutrizionista. Serve il tuo consenso per continuare.
            </p>
            {submitErr && <div className="banner err">{submitErr}</div>}
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Acconsento al trattamento dei miei dati sanitari (GDPR art. 9).</span>
            </label>
            <div className="onb-nav">
              <button className="btn ghost" onClick={back} disabled={submitting}>Indietro</button>
              <button className="btn" onClick={submit} disabled={!consent || submitting}>
                {submitting ? <span className="spin" style={{ width: 20, height: 20, borderColor: 'rgba(255,255,255,.4)', borderTopColor: '#fff' }} /> : 'Crea il mio percorso'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
