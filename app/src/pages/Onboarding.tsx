import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/client';
import { clipForPage } from '../audio/gaia';
import Gaia from '../components/Gaia';
import FieldInput from '../onboarding/Field';
import type { OnboardingResult, Page, Questions } from '../onboarding/types';

type Phase = 'welcome' | 'overview' | 'pages' | 'consent' | 'submitting' | 'result';
type Answers = Record<string, unknown>;

const AREAS = [
  { icon: 'ti-brain', label: 'La mente' },
  { icon: 'ti-briefcase', label: 'La vita' },
  { icon: 'ti-calendar-heart', label: "L'agenda" },
  { icon: 'ti-tools-kitchen-2', label: 'Il gusto' },
  { icon: 'ti-activity-heart', label: 'Il corpo' },
];

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

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [questions, setQuestions] = useState<Questions | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('welcome');
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);

  useEffect(() => {
    api<Questions>('/onboarding/questions')
      .then(setQuestions)
      .catch(() => setLoadErr('Non riesco a caricare il questionario. Riprova tra poco.'));
  }, []);

  const pages: Page[] = questions?.pages ?? [];
  const page = pages[pageIndex];

  // Applica in tempo reale il colore scelto per l'app.
  useEffect(() => {
    const c = answers.themeColor as string | undefined;
    if (c) document.documentElement.style.setProperty('--teal', c);
  }, [answers.themeColor]);

  const clip = useMemo(() => {
    if (phase === 'welcome') return 'benvenuto';
    if (phase === 'overview') return 'facciamo';
    if (phase === 'pages' && page) return clipForPage(page);
    if (phase === 'result') return 'percorso';
    return undefined;
  }, [phase, page]);

  function setAnswer(key: string, value: unknown) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  const pageValid = !page || page.fields.every((f) => !f.required || isFilled(answers[f.key]));

  function next() {
    if (phase === 'pages' && !pageValid) return;
    if (pageIndex >= pages.length - 1) setPhase('consent');
    else setPageIndex((i) => i + 1);
  }
  function back() {
    if (pageIndex <= 0) setPhase('overview');
    else setPageIndex((i) => i - 1);
  }

  async function submit() {
    setSubmitErr(null);
    setPhase('submitting');
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
      setPhase('result');
    } catch (e) {
      setSubmitErr(e instanceof ApiError ? e.message : 'Qualcosa non ha funzionato. Riprova.');
      setPhase('consent');
    }
  }

  // ---------- Render ----------

  if (loadErr) {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar center">
          <div className="banner err">{loadErr}</div>
        </div>
      </div>
    );
  }
  if (!questions) {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar center">
          <div className="spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb">
        {phase === 'pages' && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }} />
          </div>
        )}

        <div className="onb-gaia">
          <Gaia clip={clip} size={phase === 'welcome' || phase === 'result' ? 132 : 92} />
        </div>

        {phase === 'welcome' && (
          <div className="onb-body">
            <h1>Ciao, sono Gaia 🌿</h1>
            <p className="muted">
              Sono la tua assistente. Ti farò qualche domanda per costruire il tuo percorso, su misura per te.
              Tocca il pulsante per riascoltarmi quando vuoi.
            </p>
            <button className="btn" onClick={() => setPhase('overview')}>Iniziamo</button>
          </div>
        )}

        {phase === 'overview' && (
          <div className="onb-body">
            <h1>Cinque aree, poche domande</h1>
            <p className="muted">Mi bastano cinque punti per capirti davvero:</p>
            <div className="areas">
              {AREAS.map((ar) => (
                <div className="area" key={ar.label}>
                  <i className={`ti ${ar.icon}`} />
                  <span>{ar.label}</span>
                </div>
              ))}
            </div>
            <button className="btn" onClick={() => { setPhase('pages'); setPageIndex(0); }}>Vai</button>
          </div>
        )}

        {phase === 'pages' && page && (
          <div className="onb-body">
            <div className="step-count">Passo {pageIndex + 1} di {pages.length}</div>
            <h1>{page.title}</h1>
            {page.subtitle && <p className="muted">{page.subtitle}</p>}
            <div className="onb-fields">
              {page.fields.map((f) => (
                <FieldInput key={f.key} field={f} value={answers[f.key]} onChange={setAnswer} />
              ))}
            </div>
            <div className="onb-nav">
              <button className="btn ghost" onClick={back}>Indietro</button>
              <button className="btn" onClick={next} disabled={!pageValid}>
                {pageIndex >= pages.length - 1 ? 'Quasi fatto' : 'Avanti'}
              </button>
            </div>
          </div>
        )}

        {phase === 'consent' && (
          <div className="onb-body">
            <h1>Un ultimo passo</h1>
            <p className="muted">
              Per costruire un percorso sicuro trattiamo alcuni dati sulla tua salute. Sono visibili solo a te
              e al tuo nutrizionista. Devi darci il consenso per continuare.
            </p>
            {submitErr && <div className="banner err">{submitErr}</div>}
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Acconsento al trattamento dei miei dati sanitari (GDPR art. 9).</span>
            </label>
            <div className="onb-nav">
              <button className="btn ghost" onClick={() => setPhase('pages')}>Indietro</button>
              <button className="btn" onClick={submit} disabled={!consent}>Crea il mio percorso</button>
            </div>
          </div>
        )}

        {phase === 'submitting' && (
          <div className="onb-body center">
            <div className="spin" />
            <p className="muted" style={{ marginTop: 14 }}>Sto preparando il tuo percorso…</p>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="onb-body">
            <h1>Il tuo percorso è pronto! 🎉</h1>
            <div className="card result-card">
              <div className="result-name">{result.path.name}</div>
              {result.path.tags.length > 0 && (
                <div className="result-tags">
                  {result.path.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
                </div>
              )}
            </div>
            <div className="card">
              <h2>Il tuo team</h2>
              <p className="muted" style={{ margin: 0 }}>
                Coach: <b>{result.team.coach?.displayName ?? 'in assegnazione'}</b><br />
                Nutrizionista: <b>{result.team.nutritionist?.displayName ?? 'in assegnazione'}</b>
              </p>
            </div>
            <div className="card">
              <h2>Prima visita</h2>
              <p className="muted" style={{ margin: 0 }}>{result.firstVisit.note}</p>
            </div>
            <button className="btn" onClick={onDone}>Entra nell'app</button>
          </div>
        )}
      </div>
    </div>
  );
}
