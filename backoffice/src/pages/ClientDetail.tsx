import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';
import { noteModifica, righeModifica } from '../lib/logModifiche';
import { useTaxonomy } from '../lib/taxonomy';

interface Detail {
  user: {
    id: string; email: string; status: string; locale: string; emailVerifiedAt: string | null; createdAt: string;
    firstName: string | null; lastName: string | null;
    addressLine: string | null; postalCode: string | null; city: string | null; province: string | null; phone: string | null; codiceFiscale: string | null; linkedUserId: string | null;
  };
  profile: any | null;
  /**
   * Il via libera clinico (13/8). `esito: null` + `daValutare: true` = nessuno l'ha ancora guardata.
   * ⚠️ `serve_visita` NON è «da valutare»: qualcuno l'ha guardata e ha deciso che la visita serve.
   */
  idoneita?: { esito: string | null; decisaIl: string | null; daValutare: boolean };
  /**
   * La dieta COLLEGATA alla cliente, con la descrizione per esteso. Lo stile («Mediterranea») non
   * basta a dire quale sia: tre diete diverse hanno `style = mediterranean`. Vedi il commento in
   * `clients.service.getDetail`.
   */
  dietaAssegnata: {
    id: string | null; nome: string | null; descrizione: string | null;
    style: string | null; status: string; regime: string | null; mealsPerDay: number | null;
  } | null;
  /** La dieta su cui sono costruite le giornate GIÀ EROGATE: può non essere quella assegnata. */
  dietaMenuInCorso: string | null;
  menuAncoraSullaDietaPrecedente: boolean;
  /**
   * Quando la variante esatta del profilo non esiste a catalogo e il motore ripiega: cosa è stato
   * chiesto, cosa viene servito, e la frase da mostrare. Null quando le due coincidono.
   */
  scostamentoDieta: {
    motivo: 'pasti' | 'stile' | 'stile_e_pasti' | 'regime' | 'obiettivo';
    chiesto: { famiglia: string | null; regime: string | null; style: string | null; mealsPerDay: number | null };
    servito: { regime: string | null; style: string | null; mealsPerDay: number | null };
    testo: string;
  } | null;
  objective: any | null;
  measurements: { id: string; date: string; weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm: number | null; replacedSnapshot?: { weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm?: number | null; replacedAt?: string } | null }[];
  checkins: { id: string; date: string; mood: string; energy: number | null; hunger: number | null; stress: number | null }[];
  waterLogs: { id: string; date: string; glasses: number; goal: number }[];
  stepLogs: { id: string; date: string; steps: number; goal: number }[];
  subscription: any | null;
  /** Tutti i piani del cliente (recenti prima): serve per aprire i menu di un piano finito. */
  /** ⚠️ `inCorso`/`inCoda` li decide il backend (`commerce/abbonamento-in-corso.ts`): qui non si
   *  ricalcolano, altrimenti sarebbero un'altra definizione di «chi sta erogando». */
  subscriptions?: { id: string; status: string; startDate: string | null; endDate: string | null; planName: string | null; inCorso?: boolean; inCoda?: boolean }[];
  hasActivePlan?: boolean;
  /** Piano fermato dal nutrizionista: da quando, perché e da chi. Null quando il piano è normale. */
  pianoFermato: { dal: string; motivo: string | null; daId: string | null; da: string | null } | null;
  payments: { id: string; amountCents: number; description: string; method: string; status: string; createdAt: string; approvedAt: string | null }[];
  crm: { stage: string; stageLabel?: string | null; valueCents: number | null } | null;
  notes: { id: string; body: string; createdAt: string; author: string | null }[];
  pendingCommissions: { id: string; role: string; amountCents: number; createdAt: string }[];
}

/** Menu del cliente per la revisione: piatto + stelline date dal cliente. */
/** ⚠️ `kcal` è quello che la cliente mangia: con `porzione` valorizzata è già moltiplicato
 *  (voce 255). `porzione`/`kcalBase` servono a dire PERCHÉ quel numero è più alto del solito. */
interface MenuMeal { slot: string | null; name: string; kcal: number | null; porzione: number | null; kcalBase: number | null; stars: number | null; ratedSameDay: boolean | null; ratedOn: string | null }
interface MenuDayRow { id: string; date: string; level: number; status: string; dietName: string | null; meals: MenuMeal[] }

const SLOT_LABEL: Record<string, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Spuntino',
  lunch: 'Pranzo',
  afternoon_snack: 'Merenda',
  dinner: 'Cena',
};

/** Stelline 1–5 (valutazione del cliente). */
function Stars({ n }: { n: number }) {
  return (
    <span title={`${n}/5`} style={{ color: '#b8863b', letterSpacing: 1, whiteSpace: 'nowrap' }}>
      {'★'.repeat(n)}<span style={{ opacity: 0.25 }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

interface ChangeLogRow {
  id: string;
  action: string;
  at: string;
  self: boolean;
  metadata: Record<string, unknown> | null;
  actor: { name: string; email: string; role: string } | null;
}

const CHANGE_ACTION_LABEL: Record<string, string> = {
  'client.update': 'Modifica scheda',
  'client.diet_type.change': 'Cambio tipo di dieta',
  'me.profile.update': 'Modifica dati (dal cliente)',
  'admin.assignment.update': 'Assegnazione coach / nutrizionista',
  'crm.nutritionist.assign': 'Assegnazione nutrizionista',
  'crm.lead.assign': 'Assegnazione coach',
  'crm.lead.accept': 'Coach ha accettato',
  'crm.lead.reject': 'Coach ha rifiutato',
  'auth.email_change_requested': 'Richiesta cambio email',
  'auth.email_change_confirmed': 'Email confermata',
  'auth.email_primary_swapped': 'Email principale cambiata',
  'auth.email_secondary_removed': 'Email secondaria rimossa',
  'client.password_reset.trigger': 'Invio reset password',
};

const COMM_ROLE: Record<string, string> = {
  coach: 'Coach',
  manager_coach: 'Manager coach',
  nutritionist: 'Nutrizionista',
  head_nutritionist: 'Capo nutrizionista',
};

const L: Record<string, Record<string, string>> = {
  sex: { female: 'Donna', male: 'Uomo' },
  regime: { omnivore: 'Onnivora', vegetarian: 'Vegetariana', vegan: 'Vegana' },
  dietStyle: { mediterranean: 'Mediterranea', protein: 'Proteica', low_carb: 'Low carb', flexible: 'Flessibile' },
  objective: { dimagrimento: 'Dimagrimento', mantenimento: 'Mantenimento' },
  pathType: { classic3: '3 pasti', five: '5 pasti', supplements: 'Con integratori', intermittent_fasting: 'Digiuno intermittente' },
  coachStyle: { daily: 'Contatto quotidiano', when_needed: 'Quando serve', on_request: 'Su richiesta' },
  character: { follows: 'Segue bene', needs_push: 'Va spronata', perseveres: 'Persevera', quits: 'Molla facilmente' },
  work: { sedentary: 'Sedentario', standing: 'In piedi', shifts: 'Turni', travel: 'Viaggia spesso' },
  cookingTime: { very_little: 'Pochissimo', some: "Un po'", love_cooking: 'Ama cucinare' },
  weekdayLunch: { home: 'Da casa', canteen: 'Mensa', out: 'Fuori', on_the_go: 'Al volo' },
  yesno: { no: 'No', yes: 'Sì', tell_in_visit: 'Lo dirà in visita' },
  payStatus: { pending: 'In attesa', receipt_uploaded: 'Contabile caricata', approved: 'Approvato', rejected: 'Rifiutato' },
  subStatus: { pending: 'In attesa', active: 'Attivo', paused: 'In pausa', expired: 'Scaduto', cancelled: 'Annullato' },
  method: { bank_transfer: 'Bonifico', card: 'Carta' },
};
const lab = (group: string, v: string | null | undefined) => (v ? L[group]?.[v] ?? v : '—');
const euro = (c: number | null | undefined) => (c == null ? '—' : '€ ' + (c / 100).toFixed(2).replace('.', ','));
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('it-IT') : '—');
const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const kg = (n: number | null | undefined) => (n == null ? '—' : `${n} kg`);

/** Tetto della finestra menu accettato dal backend (`getMenus`): un piano annuale ci sta dentro. */
const MENU_MAX_GIORNI = 400;

/**
 * I piani da mostrare in Acquisti come pulsanti "apri i menu". Uno per abbonamento, non solo per
 * quello corrente: senza questo lo storico dei menu di un piano finito non era visibile da
 * nessuna parte. Il piano principale (quello del badge) sta per primo.
 * Funzione pura: prende la scheda e restituisce già il periodo pronto per la chiamata.
 */
function pianiPerMenu(d: Detail): {
  id: string;
  status: string;
  planName: string | null;
  startDate: string | null;
  /** ⚠️ La fine VERA del piano, o null. Non è `periodo.to`, che quando la fine manca diventa
   *  «oggi + 7 giorni» per la finestra dei menu: scritta in pastiglia sarebbe una data inventata. */
  endDate: string | null;
  /** Dal backend: sta erogando oggi / è in coda dietro a un altro piano. */
  inCorso: boolean;
  inCoda: boolean;
  principale: boolean;
  periodo?: { from: string; to: string; etichetta: string };
}[] {
  const giorno = (x: string | null | undefined) => (x ? String(x).slice(0, 10) : null);
  const lista = d.subscriptions?.length
    ? d.subscriptions
    : d.subscription
      ? [{
          id: String(d.subscription.id ?? 'principale'),
          status: String(d.subscription.status ?? ''),
          startDate: d.subscription.startDate ?? null,
          endDate: d.subscription.endDate ?? null,
          planName: d.subscription.plan?.name ?? null,
        }]
      : [];
  const idPrincipale = d.subscription?.id ? String(d.subscription.id) : lista[0]?.id;
  const fraUnaSettimana = new Date();
  fraUnaSettimana.setDate(fraUnaSettimana.getDate() + 7);
  const righe = lista.map((s) => {
    let from = giorno(s.startDate);
    // Piano ancora in corso: non ha una fine da guardare, si arriva a una settimana avanti come
    // nella finestra di default (i menu dei prossimi giorni sono già generati).
    const to = giorno(s.endDate) ?? fraUnaSettimana.toISOString().slice(0, 10);
    if (from && to < from) from = to;
    // Se il periodo supera il tetto del backend (caso raro: piano aperto da più di un anno)
    // si taglia l'INIZIO, non la fine: davanti serve avere i giorni recenti, e senza questo
    // taglio la coach vedrebbe solo «Periodo troppo lungo».
    if (from) {
      const giorni = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
      if (giorni > MENU_MAX_GIORNI) {
        const limite = new Date(`${to}T00:00:00Z`);
        limite.setUTCDate(limite.getUTCDate() - MENU_MAX_GIORNI);
        from = limite.toISOString().slice(0, 10);
      }
    }
    return {
      id: String(s.id),
      status: String(s.status ?? ''),
      planName: s.planName ?? null,
      startDate: giorno(s.startDate),
      endDate: giorno(s.endDate),
      inCorso: !!(s as { inCorso?: boolean }).inCorso,
      inCoda: !!(s as { inCoda?: boolean }).inCoda,
      principale: String(s.id) === String(idPrincipale),
      periodo: from ? { from, to, etichetta: `${s.planName ?? 'Piano'} · ${date(from)} → ${date(to)}` } : undefined,
    };
  });
  righe.sort((a, b) => (a.principale ? -1 : 0) - (b.principale ? -1 : 0));
  return righe;
}

// Umore: etichetta + colore chip.
const MOOD: Record<string, { label: string; chip: string }> = {
  great: { label: 'Alla grande', chip: '' },
  good: { label: 'Bene', chip: '' },
  ok: { label: 'Così così', chip: 'gray' },
  hard: { label: 'Faticoso', chip: 'amber' },
  stressed: { label: 'Stressata', chip: 'red' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 190, flex: 'none', color: 'var(--muted)', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  );
}

const fldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' };

/** Form di modifica della scheda (anagrafica + questionario). */
function EditCard({ form, setForm, lockDietType, lockFasting, lockAllergie }: { form: Record<string, string>; setForm: (u: (p: Record<string, string>) => Record<string, string>) => void; lockDietType?: boolean; lockFasting?: boolean; lockAllergie?: boolean }) {
  const { regimes, families } = useTaxonomy();
  const up = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const T = (k: string, label: string, type = 'text') => (
    <label style={fldStyle}><span>{label}</span><input className="input" type={type} value={form[k] ?? ''} onChange={(e) => up(k, e.target.value)} /></label>
  );
  /**
   * LE ALLERGIE: campo suo, col suo permesso («Modifica allergie»).
   *
   * ⚠️ Non è un campo di testo come gli altri, e il colore lo dice: un'allergia è un blocco duro,
   * e chi ne toglie una decide che da domani quella cliente può trovarsi quell'alimento nel piatto.
   * Senza il permesso resta visibile e in sola lettura — vederle serve a chiunque apra la scheda,
   * scriverle no.
   */
  const Allergie = () => (
    <label
      style={{ ...fldStyle, gridColumn: '1 / -1' }}
      title={lockAllergie ? 'Le allergie le corregge chi ha il permesso "Modifica allergie" (nutrizionista o amministrazione).' : undefined}
    >
      <span style={{ color: '#8E2F26' }}>
        Allergie (virgola){lockAllergie && <i className="ti ti-lock" style={{ marginLeft: 4, fontSize: 11 }} />}
      </span>
      <input
        className="input"
        value={form.allergies ?? ''}
        disabled={!!lockAllergie}
        placeholder="latte, frutta_a_guscio, fragole"
        onChange={(e) => up('allergies', e.target.value)}
      />
      <small className="muted" style={{ fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>
        {lockAllergie
          ? 'Sola lettura: le corregge la nutrizionista.'
          : 'Usa i codici dell’elenco UE dove puoi (latte, glutine, uova, pesce, crostacei, molluschi, soia, sesamo, arachidi, frutta_a_guscio, sedano, senape, solfiti, lupini): quelli il motore li espande in tutti i derivati. Quello che scrivi a mano resta segnato come «da codificare» e tiene bloccata la base personale.'}
      </small>
    </label>
  );
  // Regime e Stile = TIPO DI DIETA: modificabili solo col permesso "Cambia tipo di dieta".
  const S = (k: string, label: string, opts: [string, string][]) => {
    // `fastingWindow` ha un permesso SUO («Cambia i pasti del digiuno»): si può dare alla coach
    // senza darle anche regime e stile, che cambiano il prodotto.
    const locked = (!!lockDietType && (k === 'regime' || k === 'dietStyle')) || (!!lockFasting && k === 'fastingWindow');
    return (
      <label style={fldStyle} title={locked ? 'Il tipo di dieta lo cambia chi ha il permesso "Cambia tipo di dieta" (nutrizionista o amministrazione).' : undefined}>
        <span>{label}{locked && <i className="ti ti-lock" style={{ marginLeft: 4, fontSize: 11 }} />}</span>
        <select className="select" value={form[k] ?? ''} disabled={locked} onChange={(e) => up(k, e.target.value)}>
          <option value="">—</option>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    );
  };
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Modifica scheda</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {T('firstName', 'Nome')}{T('lastName', 'Cognome')}
        {T('phone', 'Telefono')}{T('codiceFiscale', 'Codice fiscale')}
        {T('addressLine', 'Via e n. civico')}
        {T('postalCode', 'CAP')}{T('city', 'Città')}
        {/* Si chiama ALIAS, non «Nome nel percorso»: è il nome con cui la cliente si fa
            chiamare in app. Chiamarlo «nome» invitava a riscriverci dentro nome e cognome —
            ed è esattamente quello che è successo con l'import. */}
        {T('province', 'Provincia')}{T('name', 'Alias (come si fa chiamare)')}
        {T('age', 'Età', 'number')}{S('sex', 'Sesso', [['female', 'Donna'], ['male', 'Uomo']])}
        {T('heightCm', 'Altezza (cm)', 'number')}{T('startWeightKg', 'Peso (kg)', 'number')}
        {T('startWaistCm', 'Vita (cm)', 'number')}{T('startHipsCm', 'Fianchi (cm)', 'number')}
        {S('regime', 'Regime', regimes.map((r) => [r.code, r.label] as [string, string]))}
        {/*
          «DIETA» AL POSTO DI «STILE» (decisione di Simone dell'11/8, §16.10).

          Lo stile non identifica una dieta: `Mediterranea`, `Mediterranea ipocalorica` e
          `Pescetariana` hanno tutte `style = mediterranean`. La vecchia tendina mostrava
          l'etichetta della prima dieta approvata con quel codice — si sceglieva «Mediterranea» e la
          cliente poteva ricevere «Pescetariana», cioè menu senza carne. Qui l'unità è la dieta, che
          è quello che il nutrizionista ha in mente quando apre questa scheda.

          ⚠️ Scrive DUE campi: `dietFamily` e, insieme, lo `dietStyle` di quella dieta. Non è una
          comodità: `pickDietFor` cerca famiglia **e** stile insieme, e una famiglia lasciata con lo
          stile di un'altra non trova niente e ripiega su una dieta vicina — cioè ricrea il difetto
          che questa tendina serve a chiudere.
        */}
        <label style={fldStyle} title={lockDietType ? 'La dieta la cambia chi ha il permesso "Cambia tipo di dieta" (nutrizionista o amministrazione).' : undefined}>
          <span>Dieta{lockDietType && <i className="ti ti-lock" style={{ marginLeft: 4, fontSize: 11 }} />}</span>
          <select
            className="select"
            value={form.dietFamily ?? ''}
            disabled={!!lockDietType}
            onChange={(e) => {
              const scelta = families.find((f) => f.name === e.target.value);
              up('dietFamily', e.target.value);
              up('dietStyle', scelta?.style ?? '');
            }}
          >
            <option value="">—</option>
            {families.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
            {/* La dieta che la cliente ha oggi può non essere più approvata: se sparisse dalla
                tendina, salvare un altro campo qualsiasi la cancellerebbe senza che nessuno lo
                chieda. */}
            {form.dietFamily && !families.some((f) => f.name === form.dietFamily) && (
              <option value={form.dietFamily}>{form.dietFamily} (non più in catalogo)</option>
            )}
          </select>
        </label>
        {S('objective', 'Fase (obiettivo dieta)', [['dimagrimento', 'Dimagrimento'], ['mantenimento', 'Mantenimento']])}
        {S('pathType', 'Pasti / percorso', [['classic3', '3 pasti'], ['five', '5 pasti'], ['intermittent_fasting', 'Digiuno intermittente']])}
        {/* I pasti del digiuno: si mostra SOLO se il percorso è quello, altrimenti è un campo che
            non vuol dire niente e invita a compilarlo per sbaglio. Richiesta di Simone del 10/8:
            lo staff deve poter cambiare quali pasti la cliente salta. */}
        {form.pathType === 'intermittent_fasting'
          ? S('fastingWindow', 'Pasti che salta (digiuno)', Object.entries(FASTING_WINDOW_LABEL) as [string, string][])
          : null}
        {S('coachStyle', 'Stile coach', [['daily', 'Quotidiano'], ['when_needed', 'Quando serve'], ['on_request', 'Su richiesta']])}
        {S('character', 'Carattere', [['follows', 'Segue bene'], ['needs_push', 'Va spronata'], ['perseveres', 'Persevera'], ['quits', 'Molla facilmente']])}
        {Allergie()}
        {T('intolerances', 'Intolleranze (virgola)')}{T('dislikedFoods', 'Cibi non graditi (virgola)')}
        {T('themeColor', 'Colore app')}
      </div>
    </div>
  );
}

/**
 * Fabbisogno calorico stimato dal profilo (Mifflin-St Jeor × attività − deficit obiettivo,
 * con soglie di sicurezza). Trasparenza per il nutrizionista sul target usato dai menu.
 */
interface KcalNeed {
  bmr: number; tdee: number; target: number; deficit: number; floored: boolean;
  activityFactor: number; activitySource: 'activity' | 'work' | 'default'; objective: string; weightKg: number;
  fonteDeficit?: 'imposto' | 'calcolato' | 'nessuno';
  deficitCalcolato?: number; correzionePct?: number; sottoSoglia?: boolean; spiegazione?: string;
}
/** Una riga dello storico: chi ha cambiato le calorie, quando, da quanto a quanto e perché. */
interface KcalStorico {
  id: string;
  deficitKcal: number | null; adjustPct: number | null;
  prevDeficitKcal: number | null; prevAdjustPct: number | null;
  targetPrima: number | null; targetDopo: number | null;
  sottoSoglia: boolean; motivo: string; createdAt: string;
  byStaff?: { displayName: string } | null;
}
interface KcalQuadro {
  valori: { deficitKcal: number | null; correzionePct: number | null };
  stima: KcalNeed | null;
  storico: KcalStorico[];
}

const SRC_ATTIVITA: Record<string, string> = { activity: 'attività dichiarata', work: 'tipo di lavoro', default: 'stima predefinita' };
const soloNumero = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function KcalNeedCard({ clientId }: { clientId: string }) {
  const { user: me } = useAuth();
  // Le calorie le scrive chi risponde della parte clinica. La coach vede e non tocca.
  const puoScrivere = me?.role === 'nutritionist' || me?.role === 'head_nutritionist' || me?.role === 'admin';

  const [quadro, setQuadro] = useState<KcalQuadro | null | 'none'>(null);
  const [apri, setApri] = useState(false);
  const [deficit, setDeficit] = useState('');
  const [pct, setPct] = useState('');
  const [motivo, setMotivo] = useState('');
  const [anteprima, setAnteprima] = useState<KcalNeed | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Si accende solo dopo un rifiuto per «sotto soglia»: la conferma non si può dare in anticipo.
  const [chiedeConferma, setChiedeConferma] = useState(false);

  const carica = useCallback(() => {
    if (!clientId) return;
    const rotta = puoScrivere ? `/nutritionist/clients/${clientId}/kcal` : `/admin/clients/${clientId}/kcal-need`;
    api<KcalQuadro | KcalNeed | null>(rotta)
      .then((r) => {
        if (!r) return setQuadro('none');
        const q = 'stima' in r ? (r as KcalQuadro) : { valori: { deficitKcal: null, correzionePct: null }, stima: r as KcalNeed, storico: [] };
        setQuadro(q);
        setDeficit(q.valori.deficitKcal != null ? String(q.valori.deficitKcal) : '');
        setPct(q.valori.correzionePct != null ? String(q.valori.correzionePct) : '');
      })
      .catch(() => setQuadro('none'));
  }, [clientId, puoScrivere]);
  useEffect(carica, [carica]);

  // Anteprima mentre digita: sapere DOPO di aver messo una cliente a 1000 kcal non serve a niente.
  useEffect(() => {
    if (!apri || !puoScrivere || !clientId) return;
    const t = setTimeout(() => {
      api<{ dopo: KcalNeed | null }>(`/nutritionist/clients/${clientId}/kcal/simula`, {
        method: 'POST',
        body: JSON.stringify({ deficitKcal: soloNumero(deficit), correzionePct: soloNumero(pct) }),
      })
        .then((r) => setAnteprima(r.dopo))
        .catch(() => setAnteprima(null));
    }, 400);
    return () => clearTimeout(t);
  }, [apri, puoScrivere, clientId, deficit, pct]);

  const salva = async () => {
    setErr(null); setMsg(null); setSalvando(true);
    try {
      const r = await api<{ targetPrima: number | null; targetDopo: number | null; sottoSoglia: boolean; menu: { ripristinati: number; delivered: string[] } }>(
        `/nutritionist/clients/${clientId}/kcal`,
        {
          method: 'POST',
          body: JSON.stringify({
            deficitKcal: soloNumero(deficit),
            correzionePct: soloNumero(pct),
            motivo: motivo.trim(),
            confermaSottoSoglia: chiedeConferma || undefined,
          }),
        },
      );
      setMsg(
        `Salvato: da ${r.targetPrima ?? '—'} a ${r.targetDopo ?? '—'} kcal/giorno.` +
          (r.menu.ripristinati > 0
            ? ` ⚠️ I menu futuri NON sono stati rigenerati (la cliente non è idonea adesso): restano quelli di prima, con le calorie vecchie.`
            : r.menu.delivered.length > 0
              ? ` I ${r.menu.delivered.length} giorni futuri sono stati rigenerati.`
              : ''),
      );
      setMotivo(''); setChiedeConferma(false); setApri(false);
      carica();
    } catch (e) {
      const testo = (e as Error).message ?? 'Errore';
      setErr(testo);
      // Il backend rifiuta il primo tentativo sotto soglia e dice a quanto si arriverebbe: da lì
      // in poi il pulsante cambia nome, così la conferma è una scelta e non una ripetizione.
      if (/soglia minima di sicurezza/i.test(testo)) setChiedeConferma(true);
    } finally {
      setSalvando(false);
    }
  };

  const data = quadro && quadro !== 'none' ? quadro.stima : null;
  const valori = quadro && quadro !== 'none' ? quadro.valori : { deficitKcal: null, correzionePct: null };
  const aMano = valori.deficitKcal != null || valori.correzionePct != null;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Fabbisogno calorico</h2>
        {puoScrivere && quadro !== 'none' && (
          <button className="btn ghost sm" onClick={() => setApri((v) => !v)}>
            <i className={`ti ti-${apri ? 'x' : 'adjustments'}`} /> {apri ? 'Chiudi' : 'Modifica calorie'}
          </button>
        )}
      </div>
      {quadro === null ? (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>Carico…</p>
      ) : quadro === 'none' || !data ? (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>Dati insufficienti per la stima (servono sesso, età, altezza e peso).</p>
      ) : (
        <>
          <div className="row" style={{ gap: 20, flexWrap: 'wrap', marginTop: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Target menu</div>
              <b style={{ fontSize: 22, color: data.sottoSoglia ? '#b3261e' : undefined }}>{data.target} kcal</b>
            </div>
            <div><div className="muted" style={{ fontSize: 12 }}>Mantenimento (TDEE)</div><b style={{ fontSize: 16 }}>{data.tdee} kcal</b></div>
            <div><div className="muted" style={{ fontSize: 12 }}>Metabolismo basale</div><b style={{ fontSize: 16 }}>{data.bmr} kcal</b></div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Deficit {data.fonteDeficit === 'imposto' && <b style={{ color: '#4b4878' }}>(imposto)</b>}</div>
              <b style={{ fontSize: 16 }}>{data.deficit > 0 ? `−${data.deficit} kcal` : '—'}</b>
            </div>
            {!!valori.correzionePct && (
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Correzione</div>
                <b style={{ fontSize: 16, color: '#4b4878' }}>{valori.correzionePct > 0 ? '+' : ''}{valori.correzionePct}%</b>
              </div>
            )}
          </div>

          {data.sottoSoglia && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#b3261e' }}>
              <i className="ti ti-alert-triangle" /> Questo target è <b>sotto la soglia minima di sicurezza</b>, per scelta esplicita del nutrizionista.
            </p>
          )}
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 11.5 }}>
            Obiettivo: <b>{data.objective}</b> · attività ×{data.activityFactor} ({SRC_ATTIVITA[data.activitySource]}) · peso {data.weightKg} kg
            {data.floored && <> · <span style={{ color: '#9a6a00' }}>soglia minima di sicurezza applicata</span></>}
            {data.fonteDeficit === 'imposto' && data.deficitCalcolato != null && <> · il calcolo automatico avrebbe dato −{data.deficitCalcolato} kcal</>}
          </p>
          {!aMano && (
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
              Stima automatica (Mifflin-St Jeor). Se il "menu a necessità" è attivo, i menu puntano al <b>Target</b>.
            </p>
          )}

          {apri && puoScrivere && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ fontSize: 12 }}>
                  <div className="muted">Deficit imposto (kcal/giorno)</div>
                  <input value={deficit} onChange={(e) => setDeficit(e.target.value)} placeholder="vuoto = calcolo automatico" style={{ width: 180 }} />
                </label>
                <label style={{ fontSize: 12 }}>
                  <div className="muted">Correzione sul totale (%)</div>
                  <input value={pct} onChange={(e) => setPct(e.target.value)} placeholder="es. −10" style={{ width: 140 }} />
                </label>
                {anteprima && (
                  <div style={{ fontSize: 12 }}>
                    <div className="muted">Con questi valori</div>
                    <b style={{ fontSize: 18, color: anteprima.sottoSoglia ? '#b3261e' : '#2e7d32' }}>{anteprima.target} kcal</b>
                  </div>
                )}
              </div>
              <label style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
                <div className="muted">Motivo (obbligatorio — fra tre mesi lo leggerà qualcuno che non c’era)</div>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} style={{ width: '100%' }}
                  placeholder="es. ferma da tre settimane a 1600 kcal, riduco il deficit" />
              </label>
              {err && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#b3261e' }}>{err}</p>}
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn sm" disabled={salvando || motivo.trim().length < 3} onClick={salva}>
                  {chiedeConferma ? 'Confermo: salva sotto la soglia' : 'Salva'}
                </button>
                {aMano && (
                  <button className="btn ghost sm" disabled={salvando} onClick={() => { setDeficit(''); setPct(''); }}>
                    Torna al calcolo automatico
                  </button>
                )}
              </div>
            </div>
          )}
          {msg && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#2e7d32' }}>{msg}</p>}

          {quadro.storico.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Storico delle modifiche</div>
              {quadro.storico.map((r) => (
                <div key={r.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <b>{r.targetPrima ?? '—'} → {r.targetDopo ?? '—'} kcal</b>
                    {r.sottoSoglia && <span style={{ color: '#b3261e' }}> · sotto soglia</span>}
                    <span className="muted"> · {new Date(r.createdAt).toLocaleString('it-IT')} · {r.byStaff?.displayName ?? 'non più in organico'}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    deficit {r.prevDeficitKcal ?? 'auto'} → {r.deficitKcal ?? 'auto'} · correzione {r.prevAdjustPct ?? 0}% → {r.adjustPct ?? 0}%
                  </div>
                  <div className="notif-testo" style={{ fontSize: 12 }}>«{r.motivo}»</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ClientDetail() {
  const { regimeLabel, familyLabel } = useTaxonomy();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, user: me } = useAuth();
  // Azioni riservate a chi amministra (push di prova, log, eliminazione).
  // ⚠️ NON è più il cancello del reset password: quello lo fanno anche le coach sulle proprie
  // clienti, e il controllo di appartenenza sta nel backend.
  const isAdmin = can('permissions');
  /**
   * Attivazione manuale di un piano dalla SCHEDA. L'operazione esisteva già, ma solo dalla
   * pagina Acquisti, dove la cliente va ripescata da una tendina di tutte le clienti: chi sta
   * guardando una scheda doveva uscire, cercarla di nuovo per email e sperare di non sbagliare
   * omonimo. Qui la cliente è già quella giusta, e non si può sbagliare.
   */
  const [attivaPiano, setAttivaPiano] = useState(false);
  // Chi può caricare la contabile per conto della cliente (mai approvarla da qui).
  const canUploadReceipt = me?.role === 'coach' || me?.role === 'sales' || me?.role === 'admin';
  const [d, setD] = useState<Detail | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [riattivando, setRiattivando] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  // Note dello staff (log)
  const [notes, setNotes] = useState<Detail['notes']>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Log modifiche (audit del profilo)
  const [logOpen, setLogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logRows, setLogRows] = useState<ChangeLogRow[]>([]);
  const [logErr, setLogErr] = useState<string | null>(null);

  async function openLog() {
    setLogOpen(true);
    setLogLoading(true);
    setLogErr(null);
    try {
      setLogRows(await api<ChangeLogRow[]>(`/admin/clients/${id}/audit`));
    } catch (err) {
      setLogErr(err instanceof ApiError ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLogLoading(false);
    }
  }

  // Menu del cliente (revisione nutrizionista): giorni + piatti + stelline del cliente
  const [menusOpen, setMenusOpen] = useState(false);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menuDays, setMenuDays] = useState<MenuDayRow[]>([]);
  const [menusErr, setMenusErr] = useState<string | null>(null);

  /** Periodo aperto nel popup: `null` = finestra di default (ultime 8 settimane + 7 giorni). */
  const [menusPeriodo, setMenusPeriodo] = useState<{ from: string; to: string; etichetta: string } | null>(null);

  /**
   * Apre i menu. Senza periodo mostra la finestra corrente; con un periodo (passato dal piano
   * cliccato in Acquisti) mostra i menu di **quel** piano, anche finito da mesi — prima lo
   * storico dei menu non era raggiungibile da nessuna parte.
   */
  async function openMenus(periodo?: { from: string; to: string; etichetta: string }) {
    setMenusOpen(true);
    setMenusLoading(true);
    setMenusErr(null);
    setMenusPeriodo(periodo ?? null);
    try {
      const qs = periodo ? `?from=${encodeURIComponent(periodo.from)}&to=${encodeURIComponent(periodo.to)}` : '';
      const r = await api<{ days: MenuDayRow[] }>(`/admin/clients/${id}/menus${qs}`);
      setMenuDays(r.days);
    } catch (err) {
      setMenusErr(err instanceof ApiError ? err.message : 'Caricamento dei menu non riuscito.');
    } finally {
      setMenusLoading(false);
    }
  }

  // Correzione misure inserite male dal cliente (permesso dedicato "Correggi misure cliente")
  const canFixMeasures = can('fix_measures', 'manage');
  // Cambio data inizio piano (permesso dedicato "Cambia data inizio piano")
  const canChangePlanStart = can('change_plan_start', 'manage');
  // Annullamento di un abbonamento: permesso suo, di default solo admin (17/8). Prima era
  // `isAdmin`, che in questa pagina vuol dire «vede la pagina Permessi» — e teneva il × nascosto
  // proprio a chi gestisce i piani, il capo nutrizionista.
  const canCancelSubscription = can('cancel_subscription', 'manage');
  // Le allergie: si vedono sempre, si correggono col permesso «Modifica allergie» (13/8).
  const puoAllergie = can('change_allergies', 'manage');
  // Il via libera clinico: lo dà chi ha «Idoneità a proseguire» (13/8).
  const puoIdoneita = can('clinical_clearance', 'manage');

  /** Sposta la data di inizio del piano: la fine si ricalcola e i menu ripartono da lì. */
  /**
   * IL VIA LIBERA CLINICO — «può proseguire» oppure «serve una visita» (13/8).
   *
   * ⚠️ La nota è **obbligatoria**, e il motivo va detto a chi la scrive, non solo rifiutato dal
   * server: la leggerà anche la coach, e fra un mese sarà l'unica cosa che dice perché è stato
   * deciso così. Finisce nella lista note della cliente — quella che la coach apre già — con autore
   * e ora.
   */
  async function decidiIdoneita(esito: 'idonea' | 'serve_visita') {
    const titolo = esito === 'idonea' ? 'PUÒ PROSEGUIRE' : 'SERVE UNA VISITA';
    const nota = prompt(
      `Valutazione clinica: ${titolo}.\n\nScrivi una nota che spieghi la decisione (almeno 10 caratteri).\nLa vedrà anche la coach nelle note della cliente, con il tuo nome e l'ora.`,
      '',
    );
    if (nota === null) return;
    setError(null);
    setNotice(null);
    try {
      const esitoRisposta = await api<{ segnalazioniChiuse: number; attivitaAperta?: boolean }>(`/admin/clients/${id}/idoneita`, {
        method: 'POST',
        body: JSON.stringify({ esito, nota: nota.trim() }),
      });
      const coda = esitoRisposta.segnalazioniChiuse
        ? ` ${esitoRisposta.segnalazioniChiuse} segnalazione/i clinica/e chiusa/e.`
        : '';
      /**
       * ⚠️ «Serve una visita» apre un'attività alla coach, e chi decide deve sapere se è successo.
       * Senza questa riga la nutrizionista non ha modo di distinguere «l'ho detto a qualcuno» da
       * «l'ho scritto e basta» — ed è la differenza fra una visita che si fissa e una che aspetta
       * che qualcuno riapra questa scheda.
       */
      const attivita =
        esito !== 'serve_visita'
          ? ''
          : esitoRisposta.attivitaAperta
            ? ' Ho aperto un\'attività alla coach: «Fissa la visita».'
            : ' ⚠️ L\'attività alla coach NON risulta aperta: avvisala tu.';
      setNotice(`Valutazione registrata: ${esito === 'idonea' ? 'può proseguire' : 'serve una visita'}.${coda}${attivita}`);
      /**
       * ⚠️ Il banner (di esito o di errore) sta IN CIMA alla pagina, e questo pulsante sta in fondo
       * alla scheda. Il 13/8 la rotta era sbagliata e il 404 finiva in un banner tre schermate più
       * su: dal basso sembrava che premere non facesse niente. Vale anche a cose funzionanti — una
       * decisione clinica registrata senza nessun segno visibile si rifà una seconda volta.
       */
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Ricarica: la nota nuova deve comparire subito nella lista, o sembra non essere stata salvata.
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Non è stato possibile registrare la valutazione.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function changePlanStart() {
    const cur = d?.profile?.planStartDate
      ? String(d.profile.planStartDate).slice(0, 10)
      : d?.subscription?.startDate ? String(d.subscription.startDate).slice(0, 10) : '';
    const input = prompt('Nuova data di INIZIO del piano (AAAA-MM-GG).\nLa data di fine viene ricalcolata dalla durata del piano e i menu ripartono dalla nuova data.', cur);
    if (input === null) return;
    const val = input.trim();
    // Accetta anche GG/MM/AAAA e lo converte.
    const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : val;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { setError('Data non valida: usa AAAA-MM-GG (o GG/MM/AAAA).'); return; }
    setError(null); setNotice(null);
    await inviaDataInizio(iso, false);
  }

  /**
   * L'invio vero, separato perché può servire due volte: la prima senza conferma e — se il server
   * risponde 409 — la seconda con la conferma dell'operatore.
   *
   * ⚠️ Dal 17/8 i 409 sono **due**, e questa pagina non deve sapere quale sia arrivato: «con questa
   * data il piano risulta già finito» e «con questa data si sovrappone a un altro piano» (voce 259,
   * il caso Lorena). La frase la compone il server in entrambi i casi e qui si mostra così com'è —
   * il giorno che se ne aggiunge un terzo, da questo lato non c'è niente da cambiare.
   *
   * L'avviso lo compone il SERVER e non questa pagina: la durata del piano la conosce lui, e
   * ricalcolarla qui vorrebbe dire tenere allineate due copie della stessa regola. Il 10/8 una
   * data col mese sbagliato ha fatto sparire il piano di una cliente senza che nulla lo dicesse:
   * l'errore era di distrazione, ma un comando che manda un piano nel passato in silenzio resta
   * un difetto — e questo è il punto in cui viene chiesto «sei sicuro».
   */
  async function inviaDataInizio(iso: string, conferma: boolean) {
    try {
      const r = await api<{ startDate: string; endDate: string; plan?: string; status?: string; reactivated?: boolean }>(
        `/admin/clients/${id}/plan-start`,
        { method: 'PATCH', body: JSON.stringify({ date: iso, conferma }) },
      );
      // Diciamo SU QUALE abbonamento abbiamo agito e com'è rimasto: con più abbonamenti in scheda
      // il solo "spostato" non basta a capire se si è toccato quello giusto.
      setNotice(
        `Inizio piano spostato al ${date(r.startDate)} (fine ricalcolata: ${date(r.endDate)})` +
          (r.plan ? ` su «${r.plan}»` : '') +
          (r.reactivated ? ' — piano riportato ad ATTIVO.' : r.status ? ` — stato: ${lab('subStatus', r.status)}.` : '.'),
      );
      void loadDetail();
    } catch (err) {
      // 409 = l'avviso, non un errore: la data è valida, ma il piano nascerebbe già finito.
      if (err instanceof ApiError && err.status === 409 && !conferma) {
        if (confirm(`${err.message}\n\nProcedo comunque?`)) await inviaDataInizio(iso, true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Cambio data non riuscito.');
    }
  }
  /**
   * ANNULLA UN ABBONAMENTO dalla scheda (17/8, dal caso Lorena: due piani attivi insieme).
   *
   * ⚠️ Annullare NON è stornare: qui si toglie il PIANO, i soldi hanno la loro strada. E non
   * cancella la riga — resta come `annullato`, perché un pagamento la referenzia e la storia di una
   * cliente è la cosa che si va a leggere proprio quando qualcosa non torna.
   *
   * ⚠️ L'avviso lo compone il SERVER (409) e non questa pagina: sapere se dopo l'annullamento la
   * cliente resta senza menu vuol dire guardare TUTTI i suoi abbonamenti con le loro date, e
   * rifarlo qui vorrebbe dire tenere allineate due copie della stessa regola. È la stessa scelta
   * fatta per il cambio della data di inizio, ed è quella che ha retto.
   */
  async function annullaAbbonamento(subId: string, nomePiano: string, conferma = false) {
    if (!conferma && !confirm(`Annullare «${nomePiano}»?\n\nIl piano smette di produrre menu nuovi. I giorni già consegnati restano, e la riga resta in scheda come «Annullato». Non è un rimborso: i soldi non si toccano.`)) return;
    setError(null); setNotice(null);
    try {
      const r = await api<{ testo: string; restaSenzaPiano: boolean }>(
        `/admin/subscriptions/${subId}/cancel`,
        { method: 'POST', body: JSON.stringify({ motivo: 'annullato dalla scheda cliente', conferma }) },
      );
      setNotice(r.testo);
      void loadDetail();
    } catch (err) {
      // 409 = l'avviso, non un errore: si può fare, ma la cliente resta senza piano in corso.
      if (err instanceof ApiError && err.status === 409 && !conferma) {
        if (confirm(`${err.message}\n\nProcedo comunque?`)) await annullaAbbonamento(subId, nomePiano, true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Annullamento non riuscito.');
    }
  }

  /** Rigenera i menu da oggi in poi: corregge menu vecchi sbagliati (es. solo colazione). */
  async function regenerateMenu() {
    if (!confirm('Rigenerare i menu di questa cliente da OGGI in poi?\nI giorni già erogati da oggi vengono ricreati con la generazione corretta (lo storico passato resta). Usalo per correggere menu vecchi sbagliati.')) return;
    setError(null); setNotice(null);
    try {
      const r = await api<{ removed: number; delivered: string[] }>(`/admin/clients/${id}/regenerate-menu`, { method: 'POST' });
      setNotice(
        r.delivered.length > 0
          ? `Menu rigenerati: ${r.delivered.length} giorno/i (${r.removed} rimossi e ricreati).`
          : `Nessun giorno rigenerato (${r.removed} rimossi). Possibile causa: misure mancanti, piano non attivo o in pausa — verifica lo stato della cliente.`,
      );
      void loadDetail();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Rigenerazione non riuscita.');
    }
  }
  const [fixing, setFixing] = useState<Detail['measurements'][number] | null>(null);

  // Team: liste coach/nutrizionisti per l'assegnazione (solo admin)
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [nutritionists, setNutritionists] = useState<{ id: string; name: string }[]>([]);

  // Report mensile
  interface Report { periodLabel: string; lostThisMonthKg: number | null; lostTotalKg: number | null; currentWeightKg: number | null; targetWeightKg: number | null; checkins: number; measurements: number }
  const [report, setReport] = useState<Report | null>(null);
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    (async () => {
      try { setReport(await api<Report>(`/admin/reports/${id}`)); } catch { /* report opzionale */ }
    })();
  }, [id]);

  async function sendReport() {
    if (!confirm('Inviare il report mensile alla cliente via email?')) return;
    setSendingReport(true);
    setNotice(null);
    setError(null);
    try {
      await api(`/admin/reports/${id}/send`, { method: 'POST' });
      setNotice('Report mensile inviato alla cliente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invio del report non riuscito.');
    } finally {
      setSendingReport(false);
    }
  }

  async function loadDetail(initial = false) {
    if (initial) setLoading(true);
    try {
      const data = await api<Detail>(`/admin/clients/${id}`);
      setD(data);
      setNotes(data.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      if (initial) setLoading(false);
    }
  }
  useEffect(() => {
    void loadDetail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        type StaffUser = { staff: { id: string; displayName: string } | null };
        const [c, n] = await Promise.all([
          api<{ items: StaffUser[] }>('/admin/users?role=coach'),
          api<{ items: StaffUser[] }>('/admin/users?role=nutritionist'),
        ]);
        const opts = (list: StaffUser[]) => list.filter((u) => u.staff).map((u) => ({ id: u.staff!.id, name: u.staff!.displayName }));
        setCoaches(opts(c.items));
        setNutritionists(opts(n.items));
      } catch {
        /* le liste sono opzionali: se non si caricano, resta la vista in sola lettura */
      }
    })();
  }, [isAdmin]);

  async function assignTeam(kind: 'coach' | 'nutritionist', staffId: string) {
    setError(null);
    setNotice(null);
    try {
      const body: Record<string, string | null> = { clientId: id! };
      if (kind === 'coach') body.coachId = staffId || null;
      else body.nutritionistId = staffId || null;
      await api('/admin/assignments', { method: 'POST', body: JSON.stringify(body) });
      const data = await api<Detail>(`/admin/clients/${id}`); // ricarico: aggiorna team e accantonate
      setD(data);
      setNotes(data.notes ?? []);
      setNotice('Team aggiornato.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può cambiare le assegnazioni.');
      else setError(err instanceof Error ? err.message : 'Assegnazione non riuscita.');
    }
  }

  async function resetPassword() {
    if (!confirm('Inviare alla cliente l\'email per reimpostare la password?')) return;
    setResetting(true);
    setNotice(null);
    try {
      await api(`/admin/clients/${id}/reset-password`, { method: 'POST' });
      setNotice('Email di reset inviata alla cliente: nel messaggio trova il link per scegliere la nuova password.');
    } catch (err) {
      // Il 403 non è più «non sei admin» (adesso lo fanno anche le coach): è «questa cliente non è
      // tua». Il messaggio del backend lo dice già meglio di qualunque testo fisso qui.
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message || 'Questa cliente non è assegnata a te.');
      } else setError(err instanceof Error ? err.message : 'Invio non riuscito.');
    } finally {
      setResetting(false);
    }
  }

  /**
   * Riapre l'app quando le misure mancano (voce #6e del 5/8). Lo fa la coach dopo aver sentito la
   * cliente: è il pezzo che rende accettabile un blocco, perché c'è sempre chi può riaprire.
   *
   * ⚠️ RIAPRE L'APP, NON EROGA IL MENU — e il nome vecchio («Sblocca app») prometteva l'altra cosa.
   * Il 13/8 Simone l'ha usato su una cliente ferma senza menu, e la mattina dopo il menu non c'era
   * ancora: «nonostante l'hai sbloccata ieri non ha generato il menù». Senza una pesata nel ciclo
   * corrente i giorni nuovi non partono (regola dell'11/8, «ci serve sempre una misura per erogare il
   * menu») e questo pulsante non la salta: toglie il muro e lascia la richiesta visibile. Prima
   * toglieva anche la richiesta, cioè l'unica istruzione che la cliente aveva.
   */
  /**
   * Riattiva un piano fermato dal nutrizionista (§15.2 punto 4).
   *
   * Il permesso NON si controlla qui: lo decide il backend guardando **chi** ha messo la pausa
   * (chi l'ha messa, il capo, l'admin). Nascondere il pulsante agli altri non basterebbe — e
   * mostrarlo a chi non può premerlo è meglio di farlo sparire senza spiegazione: il messaggio
   * d'errore dice a chi rivolgersi.
   */
  async function riattivaPiano() {
    if (!d) return;
    if (!confirm(
      'Riattivare il piano di questa cliente?\n\n' +
      'I giorni nuovi ripartono al primo controllo utile, con i cancelli di sempre (misure, ' +
      'finestra del piano, fine percorso): riattivare toglie solo la pausa, non salta nessun altro controllo.',
    )) return;
    setNotice(null); setError(null);
    setRiattivando(true);
    try {
      await api(`/nutritionist/clients/${d.user.id}/plan-hold/release`, { method: 'POST', body: JSON.stringify({}) });
      setNotice('Piano riattivato: i giorni nuovi riprendono al primo controllo utile.');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riattivazione non riuscita.');
    } finally {
      setRiattivando(false);
    }
  }

  async function sbloccaMisure() {
    if (!d) return;
    if (!confirm(
      'Riaprire l\'app a questa cliente?\n\n' +
      'ATTENZIONE: riapre l\'app, NON fa arrivare il menu. Per i giorni nuovi serve comunque una sua ' +
      'pesata: dopo la riapertura l\'app continua a chiederla, senza bloccarla.\n\n' +
      'È una finestra a tempo: se le misure continuano a non arrivare, il blocco torna.',
    )) return;
    setNotice(null); setError(null);
    try {
      const r = await api<{ until: string }>(`/staff/clients/${d.user.id}/measures-unlock`, { method: 'POST' });
      setNotice(
        `App riaperta fino al ${new Date(r.until).toLocaleString('it-IT')}. ` +
        'Il menu arriva appena lei registra la pesata: ricordaglielo in chat.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riapertura non riuscita.');
    }
  }

  /**
   * Push di PROVA al telefono della cliente, con diagnostica.
   * Non passa dalle notifiche normali: niente limite "una volta al giorno", niente
   * voce nel campanello. Serve a capire DOVE si rompe la catena quando le push non
   * arrivano — prima l'unico modo di provarle era fingere una conversazione in chat.
   */
  async function pushDiProva() {
    if (!d) return;
    setPushing(true);
    setNotice(null);
    setError(null);
    try {
      const r = await api<{
        fcmConfigured: boolean;
        devices: { platform: string; tokenTail: string; ok: boolean; error: string | null }[];
        sent: number;
        failed: number;
        removedStale: number;
        diagnosi: string;
      }>(`/admin/push-test/${d.user.id}`, { method: 'POST' });
      const dettaglio = r.devices.length
        ? ' · ' + r.devices.map((x) => `${x.platform} ${x.tokenTail}: ${x.ok ? 'ok' : (x.error ?? 'errore')}`).join(' · ')
        : '';
      const testa = r.devices.length ? `Inviate ${r.sent}/${r.devices.length}. ` : '';
      setNotice(`${testa}${r.diagnosi}${dettaglio}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può inviare una push di prova.');
      else setError(err instanceof Error ? err.message : 'Invio della push di prova non riuscito.');
    } finally {
      setPushing(false);
    }
  }

  /** Imposta una password SCELTA per la cliente (da comunicarle): permesso "set_client_password". */
  async function setClientPassword() {
    if (!d) return;
    const pw = prompt(`Nuova password per ${d.user.email}\n(minimo 8 caratteri; comunicala tu alla cliente. Le sessioni attive verranno chiuse.)`);
    if (pw === null) return;
    if (pw.trim().length < 8) { setError('La password deve avere almeno 8 caratteri.'); return; }
    setNotice(null); setError(null);
    try {
      await api(`/admin/clients/${id}/set-password`, { method: 'POST', body: JSON.stringify({ password: pw.trim() }) });
      setNotice('Password impostata. Comunicala alla cliente: da ora accede con questa.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impostazione password non riuscita.');
    }
  }

  /** Collega/scollega l'utenza cliente a un'utenza STAFF della stessa persona (switch senza logout nell'app). */
  async function linkAccount() {
    if (!d) return;
    if (d.user.linkedUserId) {
      if (!confirm('Questa utenza è già collegata a un account staff. Vuoi scollegarla?')) return;
      try {
        await api(`/admin/users/${d.user.id}/link`, { method: 'PATCH', body: JSON.stringify({ email: null }) });
        setNotice('Utenze scollegate.');
        void loadDetail();
      } catch (err) { setError(err instanceof ApiError ? err.message : 'Scollegamento non riuscito.'); }
      return;
    }
    const email = prompt("Email dell'utenza STAFF da collegare a questo cliente:\n(la stessa persona potrà passare da un profilo all'altro senza logout)");
    if (!email?.trim()) return;
    try {
      const r = await api<{ linked: { email: string } | null }>(`/admin/users/${d.user.id}/link`, { method: 'PATCH', body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      setNotice(`Utenza collegata a ${r.linked?.email ?? email.trim()}.`);
      void loadDetail();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Collegamento non riuscito.'); }
  }

  /** Cambio email di accesso del cliente (solo admin): usa l'endpoint admin utenti. */
  async function changeEmail() {
    if (!d) return;
    const next = prompt(`Nuova email di accesso per ${d.user.email}:\n(le sessioni attive del cliente verranno chiuse; da quel momento accede con la nuova email)`, d.user.email);
    if (next === null) return;
    const email = next.trim().toLowerCase();
    if (!email || !email.includes('@') || email === d.user.email.toLowerCase()) {
      if (email && email !== d.user.email.toLowerCase()) setError('Email non valida.');
      return;
    }
    setNotice(null);
    setError(null);
    try {
      await api(`/admin/users/${d.user.id}`, { method: 'PATCH', body: JSON.stringify({ email }) });
      setNotice(`Email cambiata in ${email}. Il cliente ora accede con la nuova email.`);
      void loadDetail();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cambio email non riuscito.');
    }
  }

  async function deleteClient() {
    const label = d?.user.email ?? 'questo cliente';
    if (!confirm(`Eliminare DEFINITIVAMENTE ${label} e TUTTO ciò che gli è collegato (questionario, misure, acquisti, note…)?\n\nL'operazione non è reversibile.`)) return;
    if (!confirm('Confermi di nuovo: elimino tutto in modo definitivo?')) return;
    setDeleting(true);
    setError(null);
    try {
      await api(`/admin/clients/${id}`, { method: 'DELETE' });
      navigate(-1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può eliminare un cliente.');
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
      setDeleting(false);
    }
  }

  function startEdit() {
    if (!d) return;
    const u = d.user;
    const pr = d.profile ?? {};
    setForm({
      firstName: u.firstName ?? '', lastName: u.lastName ?? '', phone: u.phone ?? '',
      addressLine: u.addressLine ?? '', postalCode: u.postalCode ?? '', city: u.city ?? '', province: u.province ?? '', codiceFiscale: u.codiceFiscale ?? '',
      name: pr.name ?? '', age: pr.age ?? '', sex: pr.sex ?? '', heightCm: pr.heightCm ?? '',
      startWeightKg: pr.startWeightKg ?? '', startWaistCm: pr.startWaistCm ?? '', startHipsCm: pr.startHipsCm ?? '',
      regime: pr.regime ?? '', dietStyle: pr.dietStyle ?? '', dietFamily: pr.dietFamily ?? '', mealsPerDay: pr.mealsPerDay ? String(pr.mealsPerDay) : '',
      objective: pr.objective ?? 'dimagrimento',
      pathType: pr.pathType ?? '', coachStyle: pr.coachStyle ?? '', character: pr.character ?? '',
      allergies: (pr.allergies ?? []).join(', '),
      intolerances: (pr.intolerances ?? []).join(', '), dislikedFoods: (pr.dislikedFoods ?? []).join(', '),
      fastingWindow: pr.fastingWindow ?? '',
      themeColor: pr.themeColor ?? '',
    });
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const f = form;
    const num = (v: string) => (v === '' || v == null ? undefined : Number(v));
    const list = (v: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
    const dto: Record<string, unknown> = {
      firstName: f.firstName, lastName: f.lastName, phone: f.phone,
      addressLine: f.addressLine, postalCode: f.postalCode, city: f.city, province: f.province, codiceFiscale: f.codiceFiscale || undefined,
      name: f.name,
      sex: f.sex || undefined, regime: f.regime || undefined, dietStyle: f.dietStyle || undefined, dietFamily: f.dietFamily || undefined,
      objective: f.objective || undefined,
      pathType: f.pathType || undefined, coachStyle: f.coachStyle || undefined, character: f.character || undefined,
      themeColor: f.themeColor || undefined,
      intolerances: list(f.intolerances), dislikedFoods: list(f.dislikedFoods),
      // ⚠️ Le allergie si mandano SOLO con il permesso. Il backend chiede il permesso solo se
      // l'elenco è cambiato davvero, quindi non ci sarebbe un 403 — ma mandare un campo che questa
      // schermata non permette di toccare è un modo per mandarlo per sbaglio.
      ...(puoAllergie ? { allergies: list(f.allergies) } : {}),
      // Si manda SEMPRE (anche vuota): la stringa vuota è «la decide la dieta», e ometterla
      // renderebbe impossibile togliere una finestra impostata per sbaglio. Il backend la
      // azzera da sé se il percorso non è più digiuno.
      fastingWindow: f.fastingWindow ?? '',
    };
    const age = num(f.age); if (age !== undefined) dto.age = age;
    const h = num(f.heightCm); if (h !== undefined) dto.heightCm = h;
    const w = num(f.startWeightKg); if (w !== undefined) dto.startWeightKg = w;
    const wa = num(f.startWaistCm); if (wa !== undefined) dto.startWaistCm = wa;
    const hi = num(f.startHipsCm); if (hi !== undefined) dto.startHipsCm = hi;
    // Pasti dedotti dall'unica scelta "Pasti / percorso": classic3 e digiuno → 3, five → 5.
    const mealsByPath: Record<string, number> = { classic3: 3, five: 5, intermittent_fasting: 3, supplements: 5 };
    if (f.pathType && mealsByPath[f.pathType]) dto.mealsPerDay = mealsByPath[f.pathType];
    try {
      /**
       * ⚠️ LA RISPOSTA SI LEGGE — prima si buttava via.
       *
       * Fra i cibi non graditi una spezia non viene salvata (escluderla svuoterebbe il pool invece
       * di togliere un piatto), e il server lo dice in `avvisiSpezie`. Ignorare quella risposta
       * voleva dire un «Scheda aggiornata.» che nascondeva una riga non scritta: chi l'ha digitata
       * la cercherebbe la volta dopo e la riscriverebbe uguale.
       */
      const esito = await api<{
        avvisiSpezie?: { termine: string; titolo: string; testo: string }[];
        /** ⚠️ «Aiutiamo le clienti a scrivere in modo corretto» (Simone, 18/8): quello che è stato
         *  salvato NON è un elenco di alimenti, e così com'è non toglie niente dal menu. */
        aiutoEsclusioni?: string;
      }>(`/admin/clients/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
      const data = await api<Detail>(`/admin/clients/${id}`);
      setD(data);
      setNotes(data.notes ?? []);
      setEditing(false);
      const spezie = esito?.avvisiSpezie ?? [];
      // ⚠️ I due avvisi si sommano invece di zittirsi a vicenda: sono due cose diverse — «questa
      // riga non è stata salvata» e «questa riga è stata salvata ma non esclude niente» — ed è
      // già successo il 17/8 che il secondo avviso coprisse il primo.
      const pezzi = [
        'Scheda aggiornata.',
        spezie.length
          ? `⚠️ Non salvato fra i cibi non graditi: ${spezie.map((a) => a.termine).join(', ')} — ${spezie[0].testo}`
          : null,
        esito?.aiutoEsclusioni ?? null,
      ].filter(Boolean);
      setNotice(pezzi.join(' '));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    const body = newNote.trim();
    if (!body) return;
    setSavingNote(true);
    setNotice(null);
    setError(null);
    try {
      const created = await api<Detail['notes'][number]>(`/admin/clients/${id}/note`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setNotes((ns) => [created, ...ns]);
      setNewNote('');
      setNotice('Nota aggiunta.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio della nota non riuscito.');
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Eliminare questa nota? L\'operazione non è reversibile.')) return;
    setError(null);
    try {
      await api(`/admin/clients/${id}/note/${noteId}`, { method: 'DELETE' });
      setNotes((ns) => ns.filter((n) => n.id !== noteId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Solo un admin può eliminare le note.');
      else setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  /** La coach carica la contabile del bonifico per conto della cliente (mai approvazione da qui). */
  async function uploadReceiptFor(paymentId: string, file: File) {
    if (file.size > 5 * 1024 * 1024) { setError('La contabile supera i 5 MB.'); return; }
    const mime = file.type || 'application/pdf';
    setUploadingReceipt(paymentId); setError(null); setNotice(null);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(new Error('Lettura del file non riuscita.'));
        r.readAsDataURL(file);
      });
      await api(`/staff/payments/${paymentId}/receipt`, { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: mime, contentBase64 }) });
      setNotice('Contabile caricata: ora è in attesa di verifica e approvazione (admin/responsabile).');
      const data = await api<Detail>(`/admin/clients/${id}`);
      setD(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Caricamento della contabile non riuscito.');
    } finally {
      setUploadingReceipt(null);
    }
  }

  if (loading) return <Spinner />;
  if (!d) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  const p = d.profile;
  const fullName = [d.user.firstName, d.user.lastName].filter(Boolean).join(' ');
  const fullAddress = [d.user.addressLine, [d.user.postalCode, d.user.city].filter(Boolean).join(' ').trim(), d.user.province]
    .filter(Boolean)
    .join(', ');
  const first = d.measurements[d.measurements.length - 1];
  const last = d.measurements[0];
  const lost = first && last ? Math.round((first.weightKg - last.weightKg) * 10) / 10 : null;

  return (
    <>
      <button className="btn ghost sm" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>
        <i className="ti ti-arrow-left" /> Indietro
      </button>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* Intestazione */}
      <div className="card" style={{ background: 'linear-gradient(120deg,#10403a,#12a386)', color: '#fff', border: 'none' }}>
        <div className="spread">
          <div>
            <h2 style={{ color: '#fff', fontSize: 22, margin: 0 }}>{p?.name ?? d.user.email}</h2>
            {fullName && <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600 }}>{fullName}</p>}
            <p style={{ margin: '4px 0 0', opacity: 0.9 }}>{d.user.email}</p>
            {d.user.phone && <p style={{ margin: '2px 0 0', opacity: 0.9 }}><i className="ti ti-phone" style={{ verticalAlign: '-2px', fontSize: 14 }} /> {d.user.phone}</p>}
            {fullAddress && <p style={{ margin: '2px 0 0', opacity: 0.9 }}><i className="ti ti-map-pin" style={{ verticalAlign: '-2px', fontSize: 14 }} /> {fullAddress}</p>}
            {d.user.codiceFiscale && <p style={{ margin: '2px 0 0', opacity: 0.9, fontSize: 13 }}><i className="ti ti-id" style={{ verticalAlign: '-2px', fontSize: 14 }} /> CF: {d.user.codiceFiscale}</p>}
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>
                {d.user.status === 'active' ? 'Attivo' : 'Sospeso'}
              </span>
              {p?.screeningFlag && <span className="chip red">Percorso supervisionato</span>}
              {d.crm && <span className="chip" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>CRM: {d.crm.stageLabel ?? d.crm.stage}</span>}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {!editing ? (
              <button className="btn ghost" onClick={startEdit} style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-edit" /> Modifica
              </button>
            ) : (
              <>
                <button className="btn" onClick={save} disabled={saving} style={{ background: '#fff', color: '#0e7c66' }}>
                  <i className="ti ti-device-floppy" /> {saving ? 'Salvo…' : 'Salva'}
                </button>
                <button className="btn ghost" onClick={() => setEditing(false)} disabled={saving} style={{ background: 'rgba(255,255,255,.9)' }}>Annulla</button>
              </>
            )}
            {!editing && (
              <button className="btn ghost" onClick={openLog} style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-history" /> Log modifiche
              </button>
            )}
            {/*
              Lo vede chiunque possa aprire questa scheda, coach comprese: se la scheda si apre la
              cliente è sua, e a garantirlo è il backend (`assertClientAccess`), non il fatto di
              nascondere il pulsante. Non è un'azione da admin — è il gesto più normale del mondo
              mentre si è al telefono con una cliente che non riesce a entrare.
            */}
            {!editing && (
              <button
                className="btn ghost"
                onClick={resetPassword}
                disabled={resetting}
                title="Manda alla cliente l'email col link per reimpostare la password: la sceglie lei, tu non la vedi"
                style={{ background: 'rgba(255,255,255,.9)' }}
              >
                <i className="ti ti-key" /> {resetting ? 'Invio…' : 'Reset password'}
              </button>
            )}
            {can('set_client_password', 'manage') && !editing && (
              <button className="btn ghost" onClick={setClientPassword} title="Imposta una password scelta per la cliente (da comunicarle)" style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-lock-cog" /> Imposta password
              </button>
            )}
            {!editing && (
              <button
                className="btn ghost"
                onClick={sbloccaMisure}
                title="Riapre l'app se è bloccata per le misure mancanti. NON fa arrivare il menu: per i giorni nuovi serve comunque la sua pesata."
                style={{ background: 'rgba(255,255,255,.9)' }}
              >
                <i className="ti ti-lock-open" /> Riapri l'app
              </button>
            )}
            {isAdmin && !editing && (
              <button
                className="btn ghost"
                onClick={pushDiProva}
                disabled={pushing}
                title="Manda una notifica push di prova al telefono di questa cliente e dice cosa non ha funzionato"
                style={{ background: 'rgba(255,255,255,.9)' }}
              >
                <i className="ti ti-bell-ringing" /> {pushing ? 'Invio…' : 'Push di prova'}
              </button>
            )}
            {isAdmin && !editing && (
              <button className="btn ghost" onClick={changeEmail} title="Cambia l'email di accesso del cliente" style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-mail-cog" /> Cambia email
              </button>
            )}
            {isAdmin && !editing && (
              <button className="btn ghost" onClick={linkAccount} title="Collega/scollega l'utenza staff della stessa persona (switch senza logout)" style={{ background: 'rgba(255,255,255,.9)' }}>
                <i className="ti ti-link" /> {d.user.linkedUserId ? 'Scollega utenza staff' : 'Collega utenza staff'}
              </button>
            )}
            {isAdmin && !editing && (
              <button className="btn ghost" onClick={deleteClient} disabled={deleting} style={{ background: 'rgba(255,255,255,.9)', color: '#b3261e' }}>
                <i className="ti ti-trash" /> {deleting ? 'Elimino…' : 'Elimina'}
              </button>
            )}
          </div>
        </div>
      </div>

      <TravelCard clientId={id ?? ''} profile={p} />

      <PauseRequestsCard clientId={id ?? ''} clientName={p?.name ?? d.user.email} />

      {/* Team assegnato: coach e nutrizionista (l'admin può cambiare/rimuovere) */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Team assegnato</h2>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Coach</div>
            {isAdmin ? (
              <select className="select" style={{ width: '100%' }} value={p?.assignedCoachId ?? ''} onChange={(e) => assignTeam('coach', e.target.value)}>
                <option value="">— nessuna (rimuovi) —</option>
                {coaches.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                {p?.assignedCoachId && !coaches.some((o) => o.id === p.assignedCoachId) && (
                  <option value={p.assignedCoachId}>{p.assignedCoach?.displayName ?? 'Assegnata'}</option>
                )}
              </select>
            ) : (
              <b>{p?.assignedCoach?.displayName ?? '—'}</b>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Nutrizionista</div>
            {isAdmin ? (
              <select className="select" style={{ width: '100%' }} value={p?.assignedNutritionistId ?? ''} onChange={(e) => assignTeam('nutritionist', e.target.value)}>
                <option value="">— nessuno (rimuovi) —</option>
                {nutritionists.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                {p?.assignedNutritionistId && !nutritionists.some((o) => o.id === p.assignedNutritionistId) && (
                  <option value={p.assignedNutritionistId}>{p.assignedNutritionist?.displayName ?? 'Assegnato'}</option>
                )}
              </select>
            ) : (
              <b>{p?.assignedNutritionist?.displayName ?? '—'}</b>
            )}
          </div>
        </div>
      </div>

      <KcalNeedCard clientId={id ?? ''} />

      {/* Note dello staff: editor a sinistra, log a destra */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Note</h2>
        <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Sinistra: nuova nota */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 120, resize: 'vertical' }}
              placeholder="Scrivi una nota sulla cliente: preferenze, note di percorso, promemoria…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn" onClick={addNote} disabled={savingNote || !newNote.trim()}>
                <i className="ti ti-device-floppy" /> {savingNote ? 'Salvataggio…' : 'Salva nota'}
              </button>
            </div>
          </div>
          {/* Destra: storico (log) */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Storico note</div>
            {notes.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nessuna nota ancora.</p>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                    {isAdmin && (
                      <button
                        onClick={() => deleteNote(n.id)}
                        title="Elimina nota"
                        style={{ position: 'absolute', top: 4, right: 4, border: 'none', background: 'transparent', color: '#e5484d', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
                      >
                        <i className="ti ti-x" />
                      </button>
                    )}
                    <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', paddingRight: isAdmin ? 20 : 0 }}>{n.body}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {n.author ?? 'Staff'} · {dateTime(n.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
          <EditCard
            form={form}
            setForm={setForm}
            lockDietType={!can('change_diet_type', 'manage')}
            lockAllergie={!puoAllergie}
            lockFasting={!can('change_fasting_window', 'manage')}
          />
        )}

      {/* Questionario / profilo */}
      {!editing && (
      <div className="card">
        <h2>Questionario</h2>
        {!p ? (
          <p className="muted">La cliente non ha ancora completato il questionario.</p>
        ) : (
          <>
            <Row label="Nome" value={p.name ?? '—'} />
            <Row label="Età" value={p.age ?? '—'} />
            <Row label="Sesso" value={lab('sex', p.sex)} />
            <Row label="Altezza" value={p.heightCm ? `${p.heightCm} cm` : '—'} />
            <Row label="Peso di partenza" value={p.startWeightKg ? `${p.startWeightKg} kg` : '—'} />
            <Row label="Vita" value={p.startWaistCm ? `${p.startWaistCm} cm` : '—'} />
            <Row label="Fianchi" value={p.startHipsCm ? `${p.startHipsCm} cm` : '—'} />
            <Row label="Regime" value={p.regime ? regimeLabel(p.regime) : '—'} />
            {/*
              Qui c'era «Stile alimentare», che diceva «Mediterranea» anche a una cliente che sta
              seguendo la Pescetariana: lo stesso codice `mediterranean` copre tre diete diverse.
              Ora si legge la DIETA scelta — e sotto, «Dieta assegnata», quella che il motore le sta
              davvero erogando: se le due non combaciano, si vede.
            */}
            <Row label="Dieta" value={p.dietFamily ? familyLabel(p.dietFamily) : '—'} />
            {/*
              QUALE DIETA È COLLEGATA (richiesta di Simone del 10/8, davanti a questa scheda: «di
              Mediterranea ne ho tre tipi, devo vedere tutta la descrizione così scelgo nel modo
              giusto o capisco se la cliente è in quella corretta»).

              Lo stile qui sopra non lo dice: «Mediterranea», «Mediterranea senza glutine» e la
              Keto-Mediterranea hanno tutte `style = mediterranean`. Quello che disambigua è il NOME
              della dieta, che era scritto sul profilo e non compariva da nessuna parte.
            */}
            <Row
              label="Dieta assegnata"
              value={
                d.dietaAssegnata ? (
                  <>
                    <b>{d.dietaAssegnata.nome}</b>
                    {d.dietaAssegnata.status === 'non_in_catalogo' && (
                      <span className="chip" style={{ marginLeft: 6, fontSize: 10.5, background: '#FDECEA', color: '#B4232A' }}>
                        non è in catalogo
                      </span>
                    )}
                    {d.dietaAssegnata.status === 'draft' && (
                      <span className="chip" style={{ marginLeft: 6, fontSize: 10.5, background: '#FFF1E2', color: '#9A5B12' }}>
                        bozza, non approvata
                      </span>
                    )}
                    {(d.dietaAssegnata.regime || d.dietaAssegnata.mealsPerDay) && (
                      <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
                        {[d.dietaAssegnata.regime, d.dietaAssegnata.mealsPerDay ? `${d.dietaAssegnata.mealsPerDay} pasti` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                    {/* La descrizione PER ESTESO, non troncata: è quella che fa scegliere. */}
                    {d.dietaAssegnata.descrizione ? (
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                        {d.dietaAssegnata.descrizione}
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Questa dieta non ha una descrizione per le clienti: senza, in app la cliente vede
                        solo il nome. Si scrive dal catalogo diete.
                      </div>
                    )}
                    {/*
                      LO SCOSTAMENTO FRA CHIESTO E SERVITO (11/8, dal caso Cristina).

                      Qui si leggeva «Flessibile vegan · 3 pasti» nella scheda di una cliente
                      **onnivora che ne ha chiesti 5**, e tre righe più sotto «Pasti / percorso: 5
                      pasti»: due righe della stessa schermata che si contraddicevano, senza che
                      nessuna delle due dicesse perché. Il regime era di un'altra variante omonima
                      (la scheda cercava la dieta per solo nome), i pasti erano un ripiego vero e
                      taciuto.

                      Ora la riga sopra mostra la dieta che riceverà davvero, e questa dice cosa
                      manca a catalogo. La frase arriva dal backend, una sola, perché due schermate
                      che la ricompongono raccontano due versioni dello stesso fatto.
                    */}
                    {d.scostamentoDieta && (
                      <div
                        style={{
                          fontSize: 12.5, lineHeight: 1.5, marginTop: 6, padding: '7px 10px', borderRadius: 8,
                          background: d.scostamentoDieta.motivo === 'regime' ? '#FDECEA' : '#FFF6E5',
                          color: d.scostamentoDieta.motivo === 'regime' ? '#B4232A' : '#7A4E00',
                        }}
                      >
                        <i className={`ti ${d.scostamentoDieta.motivo === 'regime' ? 'ti-alert-triangle' : 'ti-info-circle'}`} />{' '}
                        {d.scostamentoDieta.testo}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="muted">
                    nessuna dieta fissata: il motore la sceglie da stile, regime, obiettivo e pasti
                  </span>
                )
              }
            />
            {/*
              IL CASO CHE VA DETTO. Fra il cambio di dieta e la rigenerazione dei menu le due cose
              divergono: sul profilo c'è «senza glutine» e nel menu di domani c'è ancora il pane.
              Con il glutine di mezzo non è una sfumatura.

              ⚠️ Guarda solo le giornate DA RICEVERE (12/8, Simone: «se il menu è vecchio la
              segnalazione non ha senso, serve se i futuri saranno sbagliati»). Prima confrontava
              l'ultima giornata generata, anche di tre mesi prima: su un percorso finito l'avviso
              gridava al lupo su un menu che nessuno riceverà più.
            */}
            {d.menuAncoraSullaDietaPrecedente && (
              <Row
                label="⚠️ Menu in corso"
                value={
                  <>
                    <span style={{ color: '#9A5B12', fontWeight: 600 }}>
                      ancora sulla dieta precedente ({d.dietaMenuInCorso})
                    </span>
                    <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 3 }}>
                      Le giornate che deve ancora <b>ricevere</b> sono costruite sulla dieta di prima.
                      Finché non premi «Rigenera menu» qui sotto, la cliente riceve i piatti della
                      dieta vecchia.
                    </div>
                  </>
                }
              />
            )}
            <Row label="Fase (obiettivo dieta)" value={lab('objective', p.objective ?? 'dimagrimento')} />
            <Row label="Pasti / percorso" value={lab('pathType', p.pathType)} />
          {/* Quali pasti salta: prima non compariva da nessuna parte nel backoffice, quindi lo
              staff non poteva sapere se una cliente in digiuno saltava la colazione o la cena.
              ⚠️ E la finestra VUOTA non è «li decide la dieta» (18/8, voce 256): è una domanda che
              non le è mai stata fatta — il questionario la chiede solo da agosto. Detta come prima
              sembrava una scelta; è un valore di scorta che sta decidendo quali pasti mangia. Sono
              due stati diversi e vanno letti diversi, come ovunque in questo progetto. La coach se
              lo trova anche fra le sue attività (`finestra-mai-chiesta.ts`). */}
          {p.pathType === 'intermittent_fasting' && (
            <Row
              label="Pasti che salta"
              value={
                p.fastingWindow
                  ? FASTING_WINDOW_LABEL[p.fastingWindow] ?? p.fastingWindow
                  : '⚠️ mai chiesta — intanto riceve tutti i pasti della dieta'
              }
            />
          )}
          {/* Gli spuntini tolti da Vera («togli lo spuntino», 13/8): agiscono sul motore e prima
              non si vedevano da nessuna parte — lo stesso buco che avevano le allergie. Sola
              lettura: si cambiano dettandolo all'assistente, che rifà i giorni non ancora aperti. */}
          {((p.pastiEsclusi as string[] | undefined) ?? []).length > 0 && (
            <Row
              label="Spuntini esclusi (da Vera)"
              value={((p.pastiEsclusi as string[]) ?? [])
                .map((s2: string) => (s2 === 'morning_snack' ? 'spuntino del mattino' : s2 === 'afternoon_snack' ? 'merenda del pomeriggio' : s2))
                .join(', ')}
            />
          )}
            <Row label="Lavoro" value={lab('work', p.lifestyle?.work)} />
            <Row label="Tempo per cucinare" value={lab('cookingTime', p.lifestyle?.cookingTime)} />
            <Row label="Pranzo nei feriali" value={lab('weekdayLunch', p.lifestyle?.weekdayLunch)} />
            <Row label="Stile coach" value={lab('coachStyle', p.coachStyle)} />
            <Row label="Carattere" value={lab('character', p.character)} />
            {/* Il via libera clinico, sopra le allergie: è la risposta alla domanda che le allergie
                fanno nascere. */}
            <Row
              label="Valutazione clinica"
              value={
                d?.idoneita?.esito === 'idonea'
                  ? `Può proseguire${d.idoneita.decisaIl ? ` · ${date(d.idoneita.decisaIl)}` : ''}${p.idoneitaDecisaDa?.displayName ? ` · ${p.idoneitaDecisaDa.displayName}` : ''}`
                  : d?.idoneita?.esito === 'serve_visita'
                    ? `Serve una visita${d.idoneita.decisaIl ? ` · ${date(d.idoneita.decisaIl)}` : ''}${p.idoneitaDecisaDa?.displayName ? ` · ${p.idoneitaDecisaDa.displayName}` : ''}`
                    // ⚠️ «Da valutare» e «nessuno deve valutarla» sono due cose diverse: la prima è
                    // una cosa da fare, la seconda è il silenzio giusto.
                    : d?.idoneita?.daValutare
                      ? 'Da valutare'
                      : 'Non serve'
              }
            />
            {!!p.idoneitaNota?.body && (
              // La nota sta nella lista note (la coach la trova lì), ma qui si legge senza cercarla:
              // è la sola cosa che spiega PERCHÉ è stato deciso così.
              <Row label="↳ nota" value={p.idoneitaNota.body} />
            )}
            {puoIdoneita && (
              <div style={{ display: 'flex', gap: 8, margin: '2px 0 8px' }}>
                <button className="btn ghost sm" onClick={() => void decidiIdoneita('idonea')} title="Registra che hai valutato questa cliente e può proseguire. Serve una nota: la vedrà anche la coach.">
                  <i className="ti ti-check" /> Può proseguire
                </button>
                <button className="btn ghost sm" onClick={() => void decidiIdoneita('serve_visita')} title="Registra che serve una visita. Serve una nota: la vedrà anche la coach.">
                  <i className="ti ti-stethoscope" /> Serve una visita
                </button>
              </div>
            )}
            {/*
              ALLERGIE — non comparivano in nessuna scheda, né qui né in app (punto D dell'handoff
              del 12/8). Sono il dato con la conseguenza più grave dei tre — R8: blocco duro, non
              sostituzione — e chi apriva questa scheda vedeva intolleranze e cibi non graditi e
              non loro.

              ⚠️ SOLA LETTURA, e resta così. Un solo punto in tutto il codice scrive le allergie
              (l'upsert del questionario): non stanno nel DTO della PATCH cliente, non stanno in
              `PROFILE_FIELDS`. È una protezione, non una dimenticanza — chi codifica un'allergia
              scritta a mano deve essere una nutrizionista, e quel permesso va deciso, non dato
              per scontato da una casella di testo.
            */}
            <Row
              label="Allergie"
              value={
                p.allergies?.length
                  ? p.allergies.join(', ')
                  // ⚠️ «Nessuna» e «non risposto» sono due cose diverse, e per 315 clienti iscritte
                  // prima del 12/8 non lo sappiamo. Scriverlo è meno peggio che dire «Nessuna» a
                  // chi non se l'è mai sentito chiedere.
                  : p.allergieDichiarateIl ? 'Nessuna' : 'Non dichiarate'
              }
            />
            {!!p.allergiesOther?.length && (
              // Il testo libero: sono quelle che nessuno ha ancora tradotto in codici UE, e finché
              // restano così bloccano la base personale sicura.
              <Row label="↳ da codificare a mano" value={p.allergiesOther.join(', ')} />
            )}
            <Row label="Intolleranze" value={p.intolerances?.length ? p.intolerances.join(', ') : 'Nessuna'} />
            {!!p.intolerancesOther?.length && (
              <Row label="↳ scritte a mano" value={p.intolerancesOther.join(', ')} />
            )}
            {p.intolerances?.includes('other') && !p.intolerancesOther?.length && (
              // ⚠️ Ha spuntato «Altro» e non ha mai detto cosa: ha un'intolleranza che NOI non
              // sappiamo, e i suoi menu la ignorano. Va chiesto — è la prima persona da richiamare.
              <Row label="⚠️ Intolleranza non specificata" value="Ha scelto «Altro» senza dire cosa: da chiedere." />
            )}
            <Row label="Cibi non graditi" value={p.dislikedFoods?.length ? p.dislikedFoods.join(', ') : 'Nessuno'} />
            <Row label="Patologie" value={lab('yesno', p.onboardingAnswers?.health?.hasConditions)} />
            <Row label="Farmaci" value={lab('yesno', p.onboardingAnswers?.health?.takesMedications)} />
            <Row
              label="Periodi senza dieta"
              value={
                Array.isArray(p.consents?.pausePeriods) && p.consents.pausePeriods.length
                  ? p.consents.pausePeriods.map((r: { start?: string; end?: string }) => `${date(r.start) } – ${date(r.end)}`).join(' · ')
                  : 'Nessuno'
              }
            />
            <Row
              label="Colore app"
              value={
                p.themeColor ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: p.themeColor, border: '1px solid var(--line)' }} />
                    {p.themeColor}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <Row label="Percorso supervisionato" value={p.screeningFlag === undefined ? 'Riservato allo staff clinico' : p.screeningFlag ? 'Sì (screening sanitario)' : 'No'} />
            <Row label="Data inizio piano" value={date(p.planStartDate)} />
          </>
        )}
      </div>
      )}

      {/* Obiettivo */}
      {d.objective && (
        <div className="card">
          <h2>Obiettivo</h2>
          <Row label="Peso obiettivo" value={d.objective.targetWeightKg ? `${d.objective.targetWeightKg} kg` : '—'} />
          <Row label="Entro il" value={date(d.objective.targetDate)} />
          <Row label="Stato" value={d.objective.status === 'confirmed' ? 'Confermato' : d.objective.status === 'proposed' ? 'Da confermare' : d.objective.status} />
        </div>
      )}

      {/* Pesate */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }} className="spread">
          <h2 style={{ margin: 0 }}>Pesate</h2>
          {lost != null && <span className={`chip ${lost > 0 ? '' : 'gray'}`}>{lost > 0 ? `−${lost} kg` : `${Math.abs(lost)} kg`} dal via</span>}
        </div>
        {d.measurements.length === 0 ? (
          <div className="empty">Nessuna pesata registrata.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Data</th><th>Peso</th><th>Vita</th><th>Fianchi</th>{canFixMeasures && <th />}</tr></thead>
            <tbody>
              {d.measurements.map((m) => (
                <tr key={m.id}>
                  <td>
                    {date(m.date)}
                    {m.replacedSnapshot && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 2, color: '#B4491F' }} title="La cliente ha corretto la misura di questo giorno. Il valore sostituito NON viene conteggiato in grafici e report.">
                        <i className="ti ti-replace" style={{ fontSize: 12, verticalAlign: '-1px' }} /> sostituita · era {m.replacedSnapshot.weightKg} kg
                        {m.replacedSnapshot.waistCm ? ` · ${m.replacedSnapshot.waistCm} cm vita` : ''}
                        {m.replacedSnapshot.hipsCm ? ` · ${m.replacedSnapshot.hipsCm} cm fianchi` : ''}
                      </div>
                    )}
                  </td>
                  <td><b>{m.weightKg} kg</b></td>
                  <td className="muted">{m.waistCm ? `${m.waistCm} cm` : '—'}</td>
                  <td className="muted">{m.hipsCm ? `${m.hipsCm} cm` : '—'}</td>
                  {canFixMeasures && (
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost sm" title="Correggi la misura (se inserita male dal cliente)" onClick={() => setFixing(m)}>
                        <i className="ti ti-pencil" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Report mensile */}
      {report && (
        <div className="card">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Report mensile</h2>
            <button className="btn" onClick={sendReport} disabled={sendingReport}>
              <i className="ti ti-mail" /> {sendingReport ? 'Invio…' : 'Invia al cliente'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Periodo: {report.periodLabel} · inviato via email con PDF allegato.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {([
              ['Perso questo mese', kg(report.lostThisMonthKg)],
              ['Perso dall’inizio', kg(report.lostTotalKg)],
              ['Peso attuale', kg(report.currentWeightKg)],
              ['Obiettivo', kg(report.targetWeightKg)],
              ['Check-in nel mese', String(report.checkins)],
              ['Pesate nel mese', String(report.measurements)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', minWidth: 120 }}>
                <div className="muted" style={{ fontSize: 11 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Umori (check-in) */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }}>
          <h2 style={{ margin: 0 }}>Umori e check-in</h2>
        </div>
        {d.checkins.length === 0 ? (
          <div className="empty">Nessun check-in registrato.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Data</th><th>Umore</th><th>Energia</th><th>Fame</th><th>Stress</th></tr></thead>
            <tbody>
              {d.checkins.map((c) => {
                const m = MOOD[c.mood];
                return (
                  <tr key={c.id}>
                    <td>{date(c.date)}</td>
                    <td><span className={`chip ${m?.chip ?? 'gray'}`}>{m?.label ?? c.mood}</span></td>
                    <td className="muted">{c.energy != null ? `${c.energy}/5` : '—'}</td>
                    <td className="muted">{c.hunger != null ? `${c.hunger}/5` : '—'}</td>
                    <td className="muted">{c.stress != null ? `${c.stress}/5` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Acqua e Passi affiancati */}
      <div className="card-row">
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px 4px' }}>
            <h2 style={{ margin: 0 }}>Acqua bevuta</h2>
          </div>
          {d.waterLogs.length === 0 ? (
            <div className="empty">Nessuna registrazione.</div>
          ) : (
            <table className="grid">
              <thead><tr><th>Data</th><th>Bicchieri</th><th>Obiettivo</th></tr></thead>
              <tbody>
                {d.waterLogs.map((w) => (
                  <tr key={w.id}>
                    <td>{date(w.date)}</td>
                    <td>
                      <b>{w.glasses}</b>
                      {w.glasses >= w.goal && w.goal > 0 && <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>✓</span>}
                    </td>
                    <td className="muted">{w.goal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px 4px' }}>
            <h2 style={{ margin: 0 }}>Passi</h2>
          </div>
          {d.stepLogs.length === 0 ? (
            <div className="empty">Nessuna registrazione.</div>
          ) : (
            <table className="grid">
              <thead><tr><th>Data</th><th>Passi</th><th>Obiettivo</th></tr></thead>
              <tbody>
                {d.stepLogs.map((s) => (
                  <tr key={s.id}>
                    <td>{date(s.date)}</td>
                    <td>
                      <b>{s.steps.toLocaleString('it-IT')}</b>
                      {s.steps >= s.goal && s.goal > 0 && <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>✓</span>}
                    </td>
                    <td className="muted">{s.goal.toLocaleString('it-IT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Provvigioni accantonate */}
      {d.pendingCommissions.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px 4px' }}>
            <h2 style={{ margin: 0 }}>Provvigioni accantonate</h2>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>
              In attesa dell'assegnazione del ruolo: verranno pagate automaticamente quando assegni coach/nutrizionista.
            </p>
          </div>
          <table className="grid">
            <thead><tr><th>Ruolo</th><th>Importo</th><th>Dal</th></tr></thead>
            <tbody>
              {d.pendingCommissions.map((pc) => (
                <tr key={pc.id}>
                  <td>{COMM_ROLE[pc.role] ?? pc.role}</td>
                  <td><b>{euro(pc.amountCents)}</b></td>
                  <td className="muted">{date(pc.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acquisti */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '18px 20px 4px' }} className="spread">
          <h2 style={{ margin: 0 }}>Acquisti</h2>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button className="btn ghost sm" onClick={() => setAttivaPiano(true)}
                title="Attiva un piano a questa cliente senza passare dal negozio">
                <i className="ti ti-plus" /> Attiva un piano
              </button>
            )}
            {/* Se non c'è un abbonamento ATTIVO lo diciamo esplicitamente: il badge del piano
                mostra l'abbonamento più significativo (es. prova scaduta), non un annullato. */}
            {d.subscription && d.hasActivePlan === false && (
              <span className="chip" style={{ background: '#F3E7E1', color: '#8A4B2A', border: '1px solid #E0A98A' }}>
                Nessun piano attivo
              </span>
            )}
            {/*
              PIANO FERMATO DAL NUTRIZIONISTA (§15.2 punto 4). Sta qui, accanto allo stato del
              piano, perché è la prima cosa da vedere quando ci si chiede perché una cliente non
              riceve i menu — e perché questo è l'unico posto da cui si riattiva. Un blocco che si
              mette da una schermata e si toglie solo da un'API è un blocco che resta.
            */}
            {d.pianoFermato && (
              <span
                className="chip"
                style={{ background: '#FDECEA', color: '#B4232A', border: '1px solid #F0B3AE' }}
                title={
                  `Fermato il ${new Date(d.pianoFermato.dal).toLocaleDateString('it-IT')}` +
                  (d.pianoFermato.da ? ` da ${d.pianoFermato.da}` : '') +
                  (d.pianoFermato.motivo ? ` — ${d.pianoFermato.motivo}` : '') +
                  '. I giorni già ricevuti restano alla cliente; non partono quelli nuovi.'
                }
              >
                <i className="ti ti-player-pause" /> Piano in pausa
                {d.pianoFermato.da ? ` · ${d.pianoFermato.da}` : ''}
              </span>
            )}
            {d.pianoFermato && (
              <button
                className="btn ghost sm"
                disabled={riattivando}
                title="Riattiva i giorni nuovi. Può farlo chi ha messo la pausa, il capo nutrizionista o un amministratore."
                onClick={() => void riattivaPiano()}
              >
                <i className="ti ti-player-play" /> Riattiva il piano
              </button>
            )}
            {/* Un pulsante per OGNI piano, non solo per quello corrente: premendolo si aprono i
                menu erogati in quel periodo. È l'unico posto da cui si vede lo storico dei menu
                di un piano finito (richiesta di Simone dell'8/8). Il piano principale sta per
                primo ed è evidenziato; se il backend non manda ancora l'elenco si ricade sul
                solo piano principale, come prima. */}
            {pianiPerMenu(d).map((s) => (
              <Fragment key={s.id}>
              <button
                className="chip"
                onClick={() => void openMenus(s.periodo)}
                title={
                  s.periodo
                    ? `Apri i menu erogati durante «${s.planName ?? 'piano'}» (${s.periodo.from} → ${s.periodo.to}), con le stelline date ai piatti`
                    : 'Apri i menu del cliente per controllarli (con le stelline date ai piatti)'
                }
                style={{
                  cursor: 'pointer',
                  border: s.principale ? '1px solid var(--brand, #7A8B5A)' : '1px solid var(--line)',
                  opacity: s.principale ? 1 : 0.8,
                }}
              >
                {/* ⚠️ DUE PIANI ATTIVI ERANO DUE PASTIGLIE IDENTICHE: «Piano · Attivo» più la data
                    d'inizio, e chi apriva la scheda non poteva sapere quale dei due stesse dando i
                    menu oggi — è il buco da cui è passato il caso Polidoro. Ora quello in coda lo
                    dice, e la data mostrata è quella che serve a distinguerli: chi eroga si legge
                    per la FINE (fino a quando arrivano i menu), chi è in coda per l'INIZIO (da
                    quando partirà). ⚠️ `inCorso`/`inCoda` arrivano dal backend, che li calcola con
                    la funzione che usa anche il motore: qui non si ridecide niente. */}
                {s.planName ?? 'Piano'} · {s.inCoda ? 'In coda' : lab('subStatus', s.status)}
                {(() => {
                  // ⚠️ Solo date VERE: se la fine non c'è si scrive che non c'è, non si inventa.
                  const quando = s.inCoda
                    ? (s.startDate ? `dal ${date(s.startDate)}` : null)
                    : s.inCorso
                      ? (s.endDate ? `fino al ${date(s.endDate)}` : 'senza scadenza')
                      : (s.startDate ? date(s.startDate) : null);
                  return quando ? <span className="muted" style={{ marginLeft: 4 }}>{quando}</span> : null;
                })()}
                <i className="ti ti-tools-kitchen-2" style={{ marginLeft: 4 }} />
              </button>
              {/* ⚠️ Fuori dalla pastiglia e non dentro: un pulsante dentro un pulsante non è HTML
                  valido, e il click finirebbe sul contenitore aprendo i menu invece di annullare.
                  Solo sui piani che si possono ancora annullare — su uno già annullato o scaduto non
                  c'è niente da fare, e mostrarlo lo stesso è un invito a un errore.
                  ⚠️ Il permesso è `cancel_subscription` e NON `isAdmin`, che qui voleva dire «vede la
                  pagina Permessi»: dall'utenza del capo nutrizionista — che è chi gestisce i piani
                  ogni giorno — il × non si vedeva, e l'unica strada era entrare come admin. */}
              {canCancelSubscription && s.status !== 'cancelled' && s.status !== 'expired' && (
                <button
                  className="btn ghost sm"
                  onClick={() => void annullaAbbonamento(s.id, s.planName ?? 'piano')}
                  title={`Annulla «${s.planName ?? 'piano'}»: smette di produrre menu nuovi. Non è un rimborso.`}
                  style={{ marginLeft: -4 }}
                >
                  <i className="ti ti-x" />
                </button>
              )}
              </Fragment>
            ))}
          </div>
        </div>
        {/* Data di inizio piano: quella SCELTA dalla cliente (planStartDate, guida i menu);
            se l'abbonamento è stato attivato in un giorno diverso lo indichiamo accanto. */}
        {(d.profile?.planStartDate || d.subscription?.startDate) && (
          <div className="muted" style={{ padding: '0 20px 8px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            Inizio piano: <b style={{ color: 'var(--ink, #1F2933)' }}>{date(d.profile?.planStartDate ?? d.subscription?.startDate)}</b>
            {d.subscription?.startDate && d.profile?.planStartDate && String(d.profile.planStartDate).slice(0, 10) !== String(d.subscription.startDate).slice(0, 10) && (
              <span title="L'abbonamento è stato attivato in questa data (approvazione pagamento); i menu partono dall'inizio piano.">· attivato il {date(d.subscription.startDate)}</span>
            )}
            {d.subscription?.endDate && <> · fine {date(d.subscription.endDate)}</>}
            {canChangePlanStart && (
              <button className="btn ghost sm" onClick={() => void changePlanStart()} title="Cambia la data di inizio (la fine si ricalcola e i menu ripartono da lì)">
                <i className="ti ti-pencil" />
              </button>
            )}
            {canChangePlanStart && (
              <button className="btn ghost sm" onClick={() => void regenerateMenu()} title="Rigenera i menu da oggi in poi: corregge menu vecchi sbagliati (es. solo colazione). Lo storico passato resta.">
                <i className="ti ti-refresh" /> Rigenera menu
              </button>
            )}
          </div>
        )}
        {d.payments.length === 0 ? (
          <div className="empty">Nessun pagamento.</div>
        ) : (
          <table className="grid">
            <thead><tr><th>Descrizione</th><th>Importo</th><th>Metodo</th><th>Stato</th><th>Data</th>{canUploadReceipt && <th>Contabile</th>}</tr></thead>
            <tbody>
              {d.payments.map((pay) => {
                const needsReceipt = pay.method === 'bank_transfer' && (pay.status === 'pending' || pay.status === 'rejected' || pay.status === 'receipt_uploaded');
                return (
                  <tr key={pay.id}>
                    <td>{pay.description}</td>
                    <td>{euro(pay.amountCents)}</td>
                    <td className="muted">{lab('method', pay.method)}</td>
                    <td>
                      <span className={`chip ${pay.status === 'approved' ? '' : pay.status === 'rejected' ? 'red' : 'amber'}`}>
                        {lab('payStatus', pay.status)}
                      </span>
                    </td>
                    <td className="muted">{date(pay.createdAt)}</td>
                    {canUploadReceipt && (
                      <td>
                        {needsReceipt ? (
                          <label className="btn ghost sm" style={{ cursor: 'pointer' }} title="Carica la contabile del bonifico per conto della cliente (l'approvazione resta all'amministrazione)">
                            <i className="ti ti-file-upload" /> {uploadingReceipt === pay.id ? 'Carico…' : pay.status === 'receipt_uploaded' ? 'Sostituisci' : 'Carica contabile'}
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,image/heic"
                              style={{ display: 'none' }}
                              disabled={uploadingReceipt === pay.id}
                              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadReceiptFor(pay.id, f); }}
                            />
                          </label>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Conversazioni (Gaia compresa) e cambi di menu concordati in chat, da verificare.
          Vedi progetto/PROGETTO_gaia-cambio-menu.md, punto 2. */}
      <ConversazioniCard clientId={id ?? ''} />

      {/* Popup: Menu del cliente (revisione nutrizionista, con stelline) */}
      {menusOpen && (
        <div className="overlay" onClick={() => setMenusOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '82vh', overflowY: 'auto' }}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}><i className="ti ti-tools-kitchen-2" /> Menu del cliente</h2>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Con un piano vecchio aperto serve la strada di ritorno alla finestra corrente:
                    altrimenti si resta nello storico senza capire perché mancano i menu di oggi. */}
                {menusPeriodo && (
                  <button className="btn ghost sm" onClick={() => void openMenus()} title="Torna alle ultime 8 settimane e ai prossimi 7 giorni">
                    <i className="ti ti-arrow-back-up" /> Periodo corrente
                  </button>
                )}
                <button className="btn ghost sm" onClick={() => setMenusOpen(false)}><i className="ti ti-x" /> Chiudi</button>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
              {menusPeriodo ? <><b>{menusPeriodo.etichetta}</b> — menu erogati durante questo piano. </> : 'Ultime 8 settimane e prossimi 7 giorni. '}
              Le stelline sono le valutazioni date dal cliente ai piatti; quando la valutazione è di un altro giorno lo indichiamo.
            </p>
            {menusErr && <Banner kind="err">{menusErr}</Banner>}
            {menusLoading ? (
              <Spinner />
            ) : menuDays.length === 0 ? (
              <div className="empty">
                {menusPeriodo
                  ? 'Nessun menu erogato in questo periodo: il piano potrebbe essere stato annullato prima di partire.'
                  : 'Nessun menu generato per questo cliente.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {menuDays.map((day) => (
                  <div key={day.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px' }}>
                    <div className="spread" style={{ marginBottom: 6 }}>
                      <b>{date(day.date)}</b>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {day.dietName ?? '—'} · livello {day.level}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {day.meals.map((meal, i) => (
                        <div key={i} className="row" style={{ gap: 8, fontSize: 13, alignItems: 'baseline' }}>
                          <span className="muted" style={{ width: 84, flexShrink: 0, fontSize: 12 }}>{(meal.slot && SLOT_LABEL[meal.slot]) ?? meal.slot ?? '—'}</span>
                          <span style={{ flex: 1 }}>{meal.name}</span>
                          {meal.kcal != null && <span className="muted" style={{ fontSize: 11.5 }}>{meal.kcal} kcal</span>}
                          {/* ⚠️ Senza questa pastiglia la nutrizionista legge un pranzo da 891 kcal
                              e non ha modo di sapere che è una porzione scalata sul fabbisogno e
                              non un errore del catalogo (voce 255). */}
                          {meal.porzione != null && meal.porzione > 1.05 && (
                            <span
                              title={meal.kcalBase != null ? `Porzione di catalogo: ${meal.kcalBase} kcal` : 'Porzione scalata sul fabbisogno'}
                              style={{ fontSize: 10.5, color: '#8E6BB5', border: '1px solid #E2D6F0', borderRadius: 8, padding: '0 5px' }}
                            >
                              ×{String(Math.round(meal.porzione * 10) / 10).replace('.', ',')}
                            </span>
                          )}
                          {meal.stars != null ? (
                            <span>
                              <Stars n={meal.stars} />
                              {meal.ratedSameDay === false && meal.ratedOn && (
                                <span className="muted" style={{ fontSize: 10.5, marginLeft: 4 }} title="Valutazione data alla stessa ricetta in un altro giorno">({date(meal.ratedOn)})</span>
                              )}
                            </span>
                          ) : (
                            <span className="muted" style={{ fontSize: 11 }}>non valutato</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popup: attivazione manuale di un piano (solo admin) */}
      {attivaPiano && (
        <AttivaPianoModal
          clientId={id!}
          clientLabel={p?.name ?? d.user.email}
          onClose={() => setAttivaPiano(false)}
          onDone={(msg) => { setAttivaPiano(false); setNotice(msg); void loadDetail(); }}
        />
      )}

      {/* Popup: correzione misura (permesso "Correggi misure cliente") */}
      {fixing && (
        <FixMeasureModal
          measure={fixing}
          onClose={() => setFixing(null)}
          onSaved={() => { setFixing(null); setNotice('Misura corretta.'); void loadDetail(); }}
          clientId={id!}
        />
      )}

      {/* Popup: Log modifiche */}
      {logOpen && (
        <div className="overlay" onClick={() => setLogOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}><i className="ti ti-history" /> Log modifiche</h2>
              <button className="btn ghost sm" onClick={() => setLogOpen(false)}><i className="ti ti-x" /> Chiudi</button>
            </div>
            {logErr && <Banner kind="err">{logErr}</Banner>}
            {logLoading ? (
              <Spinner />
            ) : logRows.length === 0 ? (
              <div className="empty">Nessuna modifica registrata per questo cliente.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {logRows.map((r) => {
                  /*
                    COSA è cambiato, non solo CHE è cambiato qualcosa (richiesta di Simone del
                    10/8). Prima qui c'erano due righe che dicevano la stessa cosa — «Modifica dati
                    (dal cliente)» e «Modificato dal cliente» — e mai quella che serve: quale campo,
                    da cosa a cosa. Vale per le modifiche della cliente e per quelle dello staff.

                    Il riconoscimento delle tre forme di metadata sta in `lib/logModifiche`, la
                    stessa che usa il log del lead: erano due rendering diversi della stessa cosa, e
                    nel lead i campi si vedevano già mentre qui no.
                  */
                  const righe = righeModifica(r.metadata);
                  const note = noteModifica(r.metadata);
                  const etichettaAzione = CHANGE_ACTION_LABEL[r.action] ?? r.action;
                  return (
                    <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
                      <div className="spread" style={{ alignItems: 'baseline' }}>
                        <b style={{ fontSize: 14 }}>{etichettaAzione}</b>
                        <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(r.at).toLocaleString('it-IT')}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {r.self ? 'Modificato dal cliente' : r.actor ? <>Da <b>{r.actor.name}</b> ({r.actor.role})</> : 'Da sistema'}
                      </div>
                      {righe.length > 0 && (
                        <div style={{ marginTop: 6, display: 'grid', gap: 2 }}>
                          {righe.map((c) => (
                            <div key={c.campo} style={{ fontSize: 12, lineHeight: 1.5 }}>
                              {/* Con la forma «due scalari» il nome del campo non è nel metadata:
                                  lo dà l'azione, che è l'unica cosa che lo sa. */}
                              <span className="muted">{c.campo === 'valore' ? etichettaAzione : c.etichetta}: </span>
                              <span style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{c.prima}</span>
                              {' → '}
                              <b>{c.dopo}</b>
                            </div>
                          ))}
                        </div>
                      )}
                      {note.map((n) => (
                        <div key={n} className="muted" style={{ fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>{n}</div>
                      ))}
                      {/* Una riga senza dettaglio è una modifica registrata prima del 10/8, quando
                          l'audit non salvava i campi: dirlo è meglio di lasciar pensare che non
                          fosse cambiato niente. */}
                      {righe.length === 0 && note.length === 0 && (
                        <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                          dettaglio dei campi non registrato per questa modifica
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


interface PauseReq { id: string; clientId: string; name: string; startDate: string; endDate: string; days: number; createdAt: string }

/**
 * Richieste di pausa (congelamento vacanza) di questa cliente in attesa di
 * approvazione. Compaiono solo quelle >20 giorni: coach/nutrizionista assegnati
 * (o capo nutrizionista/admin) possono approvare o rifiutare.
 */
function PauseRequestsCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [rows, setRows] = useState<PauseReq[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fmt = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  async function load() {
    try {
      const all = await api<PauseReq[]>('/staff/pause-requests');
      setRows(all.filter((r) => r.clientId === clientId));
    } catch { /* ignora */ }
  }
  useEffect(() => { load(); }, [clientId]);

  async function decide(id: string, approve: boolean) {
    setBusy(id); setErr(null); setMsg(null);
    try {
      await api(`/staff/pause-requests/${id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ approve, note: note[id]?.trim() || undefined }),
      });
      setMsg(approve ? `Pausa approvata: la scadenza di ${clientName} è stata spostata in avanti.` : 'Richiesta rifiutata: la cliente è stata avvisata.');
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0 && !msg) return null;

  return (
    <div className="card" style={{ borderLeft: '4px solid #E8825A' }}>
      <h2 style={{ marginTop: 0 }}><i className="ti ti-snowflake" style={{ verticalAlign: '-2px', color: '#E8825A' }} /> Richieste di pausa</h2>
      <p className="hint" style={{ marginTop: 0 }}>Pausa oltre i 20 giorni: se approvi, il piano si congela e la scadenza slitta in avanti dei giorni richiesti.</p>
      {err && <Banner kind="err">{err}</Banner>}
      {msg && <Banner kind="ok">{msg}</Banner>}
      {rows.map((r) => (
        <div key={r.id} className="card" style={{ background: '#FFF8F4', boxShadow: 'none', marginBottom: 8 }}>
          <div className="spread" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <b>{fmt(r.startDate)} – {fmt(r.endDate)}</b>
              <div className="muted" style={{ fontSize: 12 }}>{r.days} giorni · richiesta il {fmt(r.createdAt)}</div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                placeholder="Nota (facoltativa)"
                value={note[r.id] ?? ''}
                onChange={(e) => setNote({ ...note, [r.id]: e.target.value })}
              />
              <button className="btn" onClick={() => decide(r.id, true)} disabled={busy === r.id} style={{ background: '#0e7c66' }}>
                <i className="ti ti-check" /> {busy === r.id ? '…' : 'Approva'}
              </button>
              <button className="btn ghost" onClick={() => decide(r.id, false)} disabled={busy === r.id} style={{ color: '#b3261e' }}>
                <i className="ti ti-x" /> Rifiuta
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TravelCard({ clientId, profile }: { clientId: string; profile: { travelState?: string | null; travelStart?: string | null; travelEnd?: string | null } | null }) {
  const [state, setState] = useState<string>(profile?.travelState ?? '');
  const [start, setStart] = useState<string>(profile?.travelStart ? String(profile.travelStart).slice(0, 10) : '');
  const [end, setEnd] = useState<string>(profile?.travelEnd ? String(profile.travelEnd).slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null); setMsg(null);
    try {
      await api(`/admin/clients/${clientId}/travel`, { method: 'PATCH', body: JSON.stringify({ state, start, end }) });
      setMsg(state === 'in_vacanza' ? 'In vacanza: il popup misure è sospeso fino al rientro.' : state === 'rientrato' ? 'Rientro registrato: evento inviato al CRM/marketing.' : 'Modalità viaggio aggiornata.');
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Modalità viaggio (piani estate)</h2>
      <p className="hint" style={{ marginTop: 0 }}>In vacanza il popup misure si sospende; al rientro parte un evento verso il CRM/marketing (campagna di rientro).</p>
      {err && <Banner kind="err">{err}</Banner>}
      {msg && <Banner kind="ok">{msg}</Banner>}
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: 180 }}>
          <span>Stato</span>
          <select className="select" value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">— nessuna —</option>
            <option value="in_partenza">In partenza</option>
            <option value="in_vacanza">In vacanza</option>
            <option value="rientrato">Rientrato/a</option>
          </select>
        </label>
        <label className="field" style={{ maxWidth: 160 }}><span>Dal</span><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field" style={{ maxWidth: 160 }}><span>Al</span><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <button className="btn" onClick={save} disabled={saving}><i className="ti ti-device-floppy" /> {saving ? 'Salvo…' : 'Salva'}</button>
      </div>
    </div>
  );
}

/** Correzione di una misura inserita male dal cliente (tracciata in audit con prima/dopo). */
function FixMeasureModal({ clientId, measure, onClose, onSaved }: {
  clientId: string;
  measure: { id: string; date: string; weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm: number | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toS = (v: number | null) => (v != null ? String(v).replace('.', ',') : '');
  const [weight, setWeight] = useState(toS(measure.weightKg));
  const [waist, setWaist] = useState(toS(measure.waistCm));
  const [hips, setHips] = useState(toS(measure.hipsCm));
  const [thighs, setThighs] = useState(toS(measure.thighsCm));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** '' → null (svuota il dato) · numero valido → numero · altro → undefined (errore). */
  const num = (v: string): number | null | undefined => {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

  async function save() {
    setErr(null);
    const w = num(weight);
    if (w == null) { setErr('Il peso è obbligatorio e deve essere un numero (kg).'); return; }
    const body: Record<string, unknown> = { weightKg: w };
    for (const [key, val, label] of [['waistCm', waist, 'Vita'], ['hipsCm', hips, 'Fianchi'], ['thighsCm', thighs, 'Cosce']] as const) {
      const parsed = num(val);
      if (parsed === undefined) { setErr(`${label}: valore non valido.`); return; }
      body[key] = parsed;
    }
    setBusy(true);
    try {
      await api(`/admin/clients/${clientId}/measurements/${measure.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
      setBusy(false);
    }
  }

  const F = (label: string, v: string, set: (x: string) => void, unit: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
      <span>{label} ({unit})</span>
      <input className="input" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} placeholder="—" />
    </label>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}><i className="ti ti-pencil" /> Correggi misura</h2>
          <button className="btn ghost sm" onClick={onClose}><i className="ti ti-x" /> Chiudi</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
          Pesata del <b>{date(measure.date)}</b>. Lascia vuota una circonferenza per rimuovere il dato. La correzione resta tracciata nel log (prima/dopo).
        </p>
        {err && <Banner kind="err">{err}</Banner>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {F('Peso', weight, setWeight, 'kg')}
          {F('Vita', waist, setWaist, 'cm')}
          {F('Fianchi', hips, setHips, 'cm')}
          {F('Cosce', thighs, setThighs, 'cm')}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
          <button className="btn" onClick={save} disabled={busy}><i className="ti ti-device-floppy" /> {busy ? 'Salvo…' : 'Salva correzione'}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Attivazione manuale di un piano dalla scheda cliente (solo admin).
 *
 * Usa lo stesso endpoint del modale in Acquisti (`POST /admin/purchases`): il piano viene
 * attivato e il pagamento registrato come `manual` già approvato — quindi partono anche menu,
 * ricevuta e, se richiesto, provvigioni. Qui la cliente non si sceglie: è quella della scheda.
 *
 * L'elenco piani arriva da `/admin/purchases/plans` e non da `/plans`: la vetrina pubblica
 * nasconde il Mantenimento, che a mano deve restare attivabile.
 */
function AttivaPianoModal({
  clientId, clientLabel, onClose, onDone,
}: { clientId: string; clientLabel: string; onClose: () => void; onDone: (msg: string) => void }) {
  type PianoRow = { id: string; name: string; priceCents: number; period: string; billing?: string | null };
  const [piani, setPiani] = useState<PianoRow[]>([]);
  const [planId, setPlanId] = useState('');
  const [buono, setBuono] = useState('');
  // Provvigioni: qui **non si generano mai**. L'attivazione dalla scheda non è una vendita
  // (importo registrato 0), e una provvigione è un costo vero contro un ricavo che non esiste.
  // Lo stato resta a `false` e il quadratino non si mostra: mostrarlo spento e ignorarlo sarebbe
  // peggio che non averlo.
  const provvigioni = false;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<PianoRow[]>('/admin/purchases/plans')
      .then(setPiani)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Non riesco a leggere i piani.'));
  }, []);

  const piano = piani.find((x) => x.id === planId);

  async function salva() {
    if (!planId) { setErr('Scegli il piano.'); return; }
    setBusy(true); setErr(null);
    try {
      await api('/admin/purchases', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          planId,
          generateCommissions: provvigioni,
          discountCode: buono.trim() || undefined,
          // Attivazione dalla SCHEDA = interna (omaggio, staff, socio, prova): il piano si attiva
          // davvero ma NON entra in contabilità. Le vendite vere si registrano da Acquisti, che
          // non passa questo campo. Segnalazione di Simone dell'8/8: un piano da €130 attivato a
          // mano qui gonfiava i ricavi di €130 mai incassati.
          origine: 'scheda_cliente',
        }),
      });
      onDone(
        'Piano attivato e registrato a importo 0. Non entra in contabilità né nei grafici del ' +
        'fatturato, e non genera provvigioni: per registrare un incasso vero usa la pagina Acquisti.',
      );
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Attiva un piano" onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Cliente: <b>{clientLabel}</b>
      </p>
      <div className="field">
        <label>Piano</label>
        <select className="select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">Scegli il piano…</option>
          {piani.map((x) => <option key={x.id} value={x.id}>{x.name} · {euro(x.priceCents)}</option>)}
        </select>
      </div>
      {piano && (
        <p className="muted" style={{ fontSize: 13 }}>
          Verrà attivato <b>{piano.name}</b> ({piano.period}). I menu partono da subito. Il listino è
          {' '}<b>{euro(piano.priceCents)}</b>, ma il pagamento viene registrato a <b>€ 0,00</b>: non è
          una vendita.
        </p>
      )}
      {/*
        Diceva «con il pagamento registrato come già incassato»: era vero e per questo sbagliato.
        Da qui si attivano omaggi, staff e prove interne, e quei ricavi non esistono. L'avviso è
        esplicito perché è l'unico posto in cui si può capire prima di premere.
      */}
      <p style={{ fontSize: 13, background: 'rgba(184,134,59,.12)', padding: '8px 10px', borderRadius: 8 }}>
        <b>Non entra in contabilità né nei grafici.</b> Questa attivazione è per omaggi, staff o prove
        interne: il piano si attiva davvero, ma il pagamento è registrato a <b>importo 0</b> — quindi
        resta fuori dal conto economico, dal <b>fatturato</b> dei grafici e dalle provvigioni. Per una
        <b> vendita vera</b> incassata fuori dal negozio — un bonifico gestito a mano — usa la pagina{' '}
        <b>Acquisti</b>.
      </p>
      <div className="field">
        <label>Buono sconto (facoltativo)</label>
        <input className="input" value={buono} onChange={(e) => setBuono(e.target.value.toUpperCase())}
          placeholder="Es. ESTATE25" style={{ width: 200, textTransform: 'uppercase' }} />
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        Da qui <b>non si generano provvigioni</b>: senza incasso non c'è niente da cui pagarle. Se la
        cliente ha pagato davvero, registra la vendita da <b>Acquisti</b> — lì le provvigioni si scelgono.
      </p>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={salva} disabled={busy || !planId}>
          {busy ? 'Attivo…' : 'Attiva il piano'}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Conversazioni e cambi di menu concordati in chat
// (progetto/PROGETTO_gaia-cambio-menu.md, punto 2)
// ---------------------------------------------------------------------------

interface ThreadRow {
  id: string;
  counterpart: string;
  counterpartName: string;
  lastMessageAt: string | null;
  messageCount: number;
}
interface MsgRow {
  id: string;
  senderRole: string;
  /** Chi l'ha scritto davvero: serve a sapere se la ✕ per cancellarlo va mostrata (11/8). */
  senderUserId?: string | null;
  body: string;
  sentAt: string;
  meta?: { sost?: { passo?: string }; esitoSostituzione?: string } | null;
}
interface SostituzioneRow {
  /** `piatto` = ha cambiato tutto il piatto · `ingrediente` = solo un alimento dentro il piatto. */
  tipo?: 'ingrediente' | 'piatto';
  data: string;
  /** Lo slot tecnico (`lunch`): serve alla verifica, che individua il cambio per giorno+pasto. */
  slot: string;
  slotLabel: string;
  piatto: string;
  from: string;
  to: string;
  fromQty?: number;
  toQty?: number;
  unit?: string;
  /** Unità del sostituto quando è diversa (panna in ml → burro in g). Assente = la stessa. */
  unitA?: string;
  motivo?: string;
  reason: string;
  stato: string;
  concordataIl?: string;
  grammaturaCorretta?: boolean;
  /** Quando la nutrizionista l'ha guardato, e la sua nota (la legge anche la cliente). */
  verificataIl?: string;
  nota?: string;
}

/**
 * I pasti che salta chi fa digiuno intermittente. Le stesse tre voci che vede la cliente nel suo
 * profilo: se qui si scrivessero diverse, staff e cliente parlerebbero di due cose con lo stesso
 * nome. Lo spuntino del mattino segue sempre la colazione — è una regola del motore
 * (`menu.service.slotSaltatiPerDigiuno`), non una scelta di questa tendina.
 */
/**
 * ⚠️ Copia delle etichette staff di `backend/src/menu/finestre-digiuno.ts` — un frontend non può
 * importare dal backend. Se lì si aggiunge una finestra, va aggiunta anche qui: fino all'11/8
 * mancavano «salta la cena» e «salta il pranzo», che il motore avrebbe saputo gestire ma che nessuno
 * poteva scegliere. L'ordine è quello della tabella.
 */
const FASTING_WINDOW_LABEL: Record<string, string> = {
  skip_breakfast: 'Salta la colazione (mangia da pranzo a cena)',
  skip_dinner: 'Salta la cena (mangia da colazione a pranzo)',
  skip_lunch: 'Salta il pranzo (colazione e cena)',
  skip_breakfast_lunch: 'Salta colazione e pranzo (solo cena)',
  skip_dinner_breakfast: 'Salta cena e colazione (finestra al mattino)',
};

const MOTIVO_LABEL: Record<string, string> = {
  non_disponibile: "non ce l'ho in casa",
  non_piace: 'non mi piace',
  digestione: 'mi resta sullo stomaco',
  no_tempo: 'non ho tempo di cucinarlo',
};

const dataBreve = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const oraBreve = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const quantita = (qta: number | undefined, unita: string | undefined) =>
  qta !== undefined && qta > 0 ? `${qta}${unita ? ` ${unita}` : ''} ` : '';

/**
 * Chiave di una riga di cambio. Non esiste un id: il cambio vive dentro il JSON dei pasti di quella
 * giornata, e si individua per giorno + pasto + alimento — le stesse tre cose che la PATCH manda al
 * backend. Tenere la stessa chiave nei due posti è ciò che fa aprire il modulo sulla riga giusta.
 */
const rigaChiave = (s: { data: string; slot: string; from: string }) => `${s.data}|${s.slot}|${s.from}`;

/**
 * La conversazione con Gaia sulla scheda cliente, accanto a quelle con coach e nutrizionista.
 *
 * Prima non c'era: `/staff/threads` è filtrato per ruolo sul `counterpart` e il thread `ai`
 * non compariva a nessuno. Il risultato è che quello che la cliente diceva a Gaia — cosa non
 * le piace, cosa non digerisce, cosa non ha tempo di cucinare — non lo sapeva nessuno: non la
 * coach, non la nutrizionista, non il motore che le comporrà il menu del mese prossimo.
 *
 * Si LEGGE e non si scrive: in quel thread la voce è quella di Gaia, e una risposta dello
 * staff travestita da assistente ingannerebbe la cliente. Per parlarle c'è il thread proprio.
 */
function ConversazioniCard({ clientId }: { clientId: string }) {
  const { can, user: me } = useAuth();
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [messaggi, setMessaggi] = useState<MsgRow[]>([]);
  const [caricaMsg, setCaricaMsg] = useState(false);
  const [sostituzioni, setSostituzioni] = useState<SostituzioneRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  /** Riga su cui è aperto il modulo di correzione (chiave riga), e cosa si sta scrivendo. */
  const [correggo, setCorreggo] = useState<string | null>(null);
  const [corr, setCorr] = useState<{ to: string; toQty: string; nota: string }>({ to: '', toQty: '', nota: '' });
  const [salvo, setSalvo] = useState(false);
  const [esitoVerifica, setEsitoVerifica] = useState<string | null>(null);
  /** La risposta che si sta scrivendo alla cliente, dal thread aperto (11/8). */
  const [risposta, setRisposta] = useState('');
  const [invio, setInvio] = useState(false);
  /**
   * Il messaggio in attesa di conferma per la cancellazione, e quello in corso.
   *
   * La conferma è una richiesta esplicita di Simone, e ha una ragione: la cliente può aver già
   * letto quel messaggio, quindi cancellarlo non lo fa sparire dalla sua testa — è un gesto che
   * vale la pena fare apposta e non per un dito scivolato sulla ✕.
   */
  const [daCancellare, setDaCancellare] = useState<MsgRow | null>(null);
  const [cancello, setCancello] = useState<string | null>(null);

  /**
   * `client_conversations` e non `chat`, ed è il senso della richiesta di Simone dell'11/8 («la
   * visibilità e la scrittura di questa parte devo poterla abilitare dai permessi»): leggere le
   * conversazioni di UNA cliente dalla sua scheda è una decisione diversa da entrare nella pagina
   * Chat dell'azienda, e prima erano lo stesso interruttore.
   */
  const puoLeggere = can('client_conversations');
  /**
   * Chi può TOCCARE un cambio, che non è chi lo legge. La coach lo legge — le serve per capire come
   * sta andando — ma la grammatura di un piatto è materia clinica, e la decide chi se ne prende la
   * responsabilità: perciò `manage` ce l'hanno per default solo nutrizionista, capo nutrizionista e
   * admin. Prima l'elenco dei ruoli era scritto qui e nel backend; ora il permesso è uno e si
   * cambia dai Permessi. Qui serve solo a non mostrare pulsanti che darebbero 403: il cancello vero
   * resta `correggiCambioInChatPerStaff`.
   */
  const puoVerificare = can('client_conversations', 'manage');

  const caricaCambi = useCallback(() => {
    if (!clientId) return;
    api<SostituzioneRow[]>(`/staff/clients/${clientId}/sostituzioni-chat`)
      .then(setSostituzioni)
      .catch(() => { /* l'elenco è un extra: la card resta utile senza */ });
  }, [clientId]);

  /**
   * La verifica: conferma, correggi o annulla. Dopo la scrittura si ricarica l'elenco e non si
   * aggiorna a mano la riga: la verità è quella scritta sulla giornata, e ricalcolarla qui sarebbe
   * un secondo posto dove sbagliare.
   */
  const verifica = async (
    riga: SostituzioneRow,
    stato: 'verificata' | 'corretta' | 'annullata',
    extra?: { to?: string; toQty?: number; nota?: string },
  ) => {
    setSalvo(true);
    setEsitoVerifica(null);
    try {
      const r = await api<{ descrizione: string }>(`/staff/clients/${clientId}/sostituzioni-chat`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: riga.data,
          slot: riga.slot,
          tipo: riga.tipo ?? 'ingrediente',
          ...(riga.tipo === 'piatto' ? {} : { from: riga.from }),
          stato,
          ...(extra ?? {}),
        }),
      });
      setEsitoVerifica(r.descrizione);
      setCorreggo(null);
      caricaCambi();
    } catch (e) {
      setEsitoVerifica(e instanceof Error ? e.message : 'Non riesco a salvare la verifica.');
    } finally {
      setSalvo(false);
    }
  };

  useEffect(() => {
    // Il gate sta DENTRO l'effetto: un `return null` prima degli hook non è lecito, e senza
    // questa riga un ruolo senza il permesso `chat` sparava comunque due chiamate destinate a 403.
    if (!clientId || !puoLeggere) return;
    let vivo = true;
    api<ThreadRow[]>(`/staff/clients/${clientId}/threads`)
      .then((ts) => {
        if (!vivo) return;
        setThreads(ts);
        // Si apre su Gaia: è la conversazione che prima non si vedeva, ed è quella dove
        // nascono i cambi da verificare.
        setSel(ts.find((t) => t.counterpart === 'ai')?.id ?? ts[0]?.id ?? null);
      })
      // ⚠️ Un errore NON è «nessuna conversazione». Prima finiva in `setThreads([])` e la card
      // mostrava «Nessuna conversazione visibile per il tuo ruolo»: è così che un 403 sulla rotta
      // (all'admin mancava il ruolo nel controller, 8/8) si è travestito da elenco vuoto e ci sono
      // volute due segnalazioni per scovarlo. Se la richiesta fallisce lo diciamo.
      .catch((e) => {
        if (!vivo) return;
        setThreads([]);
        setErr(
          e instanceof ApiError && e.status === 403
            ? 'Il tuo ruolo non può leggere le conversazioni di questa cliente.'
            : e instanceof Error ? e.message : 'Non riesco a leggere le conversazioni.',
        );
      });
    caricaCambi();
    return () => { vivo = false; };
    // `caricaCambi` è stabile (useCallback su clientId): l'elenco si ricarica anche dopo una
    // verifica, altrimenti la riga appena corretta resterebbe «da verificare» sotto gli occhi di
    // chi l'ha appena sistemata.
  }, [clientId, puoLeggere, caricaCambi]);

  /**
   * Risponde alla cliente dal thread aperto. Il messaggio è identico a quello scritto dalla pagina
   * Chat — stesso endpoint, stessa notifica: cambia solo che qui hai sotto gli occhi misure, menu e
   * segnalazioni mentre scrivi.
   */
  async function inviaRisposta() {
    const testo = risposta.trim();
    if (!sel || !testo) return;
    setInvio(true);
    setErr(null);
    try {
      await api(`/threads/${sel}/messages`, { method: 'POST', body: JSON.stringify({ body: testo }) });
      setRisposta('');
      // Si ricarica invece di aggiungere la bolla a mano: così quello che si legge è quello che è
      // stato salvato davvero, e non una copia ottimistica che potrebbe non combaciare.
      const ms = await api<MsgRow[]>(`/threads/${sel}/messages`);
      setMessaggi(ms);
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 403
          ? 'In questa conversazione puoi leggere ma non scrivere: risponde chi segue la cliente.'
          : e instanceof Error ? e.message : 'Messaggio non inviato.',
      );
    } finally {
      setInvio(false);
    }
  }

  /**
   * Cancella un proprio messaggio, dopo la conferma. Il backend accetta solo l'autore, quindi anche
   * se la ✕ comparisse dove non deve non succederebbe niente: la regola sta di là, questa è la
   * porta. Si ricarica l'elenco invece di togliere la bolla a mano — quello che si legge dev'essere
   * quello che è stato salvato davvero.
   */
  async function cancellaMessaggio(m: MsgRow) {
    if (!sel) return;
    setCancello(m.id);
    setErr(null);
    try {
      await api(`/threads/${sel}/messages/${m.id}`, { method: 'DELETE' });
      const ms = await api<MsgRow[]>(`/threads/${sel}/messages`);
      setMessaggi(ms);
      setDaCancellare(null);
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 403
          ? 'Si può cancellare solo un messaggio scritto da sé.'
          : e instanceof Error ? e.message : 'Messaggio non cancellato.',
      );
    } finally {
      setCancello(null);
    }
  }

  useEffect(() => {
    if (!sel) { setMessaggi([]); return; }
    let vivo = true;
    setCaricaMsg(true);
    setErr(null);
    // Cambiando conversazione la bozza non si porta dietro: il testo scritto per la coach non deve
    // ritrovarsi nel campo della nutrizionista.
    setRisposta('');
    api<MsgRow[]>(`/threads/${sel}/messages`)
      .then((ms) => { if (vivo) setMessaggi(ms); })
      .catch((e) => { if (vivo) setErr(e instanceof ApiError ? e.message : 'Conversazione non leggibile.'); })
      .finally(() => { if (vivo) setCaricaMsg(false); });
    return () => { vivo = false; };
  }, [sel]);

  if (!puoLeggere) return null;
  if (threads === null) return <div className="card"><Spinner /></div>;

  const daVerificare = sostituzioni.filter((s) => s.stato === 'da_verificare');

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>
        <i className="ti ti-messages" style={{ verticalAlign: '-2px', color: '#12A386' }} /> Conversazioni
      </h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Anche la chat con Gaia: è lì che la cliente dice cosa non le piace, cosa non digerisce e
        cosa non ha tempo di cucinare. Si legge, non si risponde: per scriverle usa il suo thread.
      </p>

      {/* --- I cambi concordati in chat: l'elenco che rende la verifica una cosa fattibile --- */}
      {sostituzioni.length > 0 && (
        <div className="card" style={{ background: '#F7FBF9', boxShadow: 'none', marginBottom: 12 }}>
          <div className="spread" style={{ alignItems: 'center', marginBottom: 8 }}>
            <b style={{ fontSize: 13.5 }}>
              <i className="ti ti-replace" style={{ verticalAlign: '-2px', color: '#0E7C66' }} /> Cambi concordati in chat
            </b>
            {daVerificare.length > 0 && (
              <span
                style={{
                  fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                  background: '#FFF1E2', color: '#9A5B12',
                }}
              >
                {daVerificare.length} da verificare
              </span>
            )}
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Giorno</th>
                <th>Pasto</th>
                <th>Cambio</th>
                <th>Motivo</th>
                <th>Stato</th>
                {puoVerificare && <th style={{ width: 168 }}>Verifica</th>}
              </tr>
            </thead>
            <tbody>
              {sostituzioni.map((s, i) => (
                <tr key={`${s.data}-${s.from}-${i}`}>
                  <td>{dataBreve(s.data)}</td>
                  <td>
                    {s.slotLabel}
                    <div className="muted" style={{ fontSize: 11.5 }}>{s.piatto}</div>
                  </td>
                  <td>
                    {/*
                      Il cambio di PIATTO va distinto a occhio da uno scambio di ingrediente: la
                      nutrizionista non guarda «ha cambiato l'olio» e «ha cambiato la colazione» con
                      la stessa attenzione. Le quantità non si mostrano: fra due piatti non vogliono
                      dire niente.
                    */}
                    {s.tipo === 'piatto' && (
                      <span className="chip" style={{ marginRight: 6, fontSize: 10.5, background: '#6c5ab7', color: '#fff' }}>
                        piatto
                      </span>
                    )}
                    {s.tipo === 'piatto'
                      ? <>{s.from} → <b>{s.to}</b></>
                      : <>{quantita(s.fromQty, s.unit)}{s.from} → <b>{quantita(s.toQty, s.unitA ?? s.unit)}{s.to}</b></>}
                    {s.grammaturaCorretta && (
                      <div style={{ fontSize: 11.5, color: '#9A5B12' }}>
                        grammatura riportata a pari: da ricontrollare
                      </div>
                    )}
                  </td>
                  <td>{s.motivo ? MOTIVO_LABEL[s.motivo] ?? s.motivo : s.reason}</td>
                  <td>
                    {s.stato === 'da_verificare' ? (
                      <span style={{ color: '#9A5B12', fontWeight: 600 }}>da verificare</span>
                    ) : (
                      <span className="muted">{s.stato}</span>
                    )}
                    {/* La nota della nutrizionista sta accanto allo stato: senza di lei «corretta»
                        non dice perché, e il perché è la parte che serve — anche alla cliente, che
                        la riceve in notifica. */}
                    {s.nota && (
                      <div className="muted" style={{ fontSize: 11.5, fontStyle: 'italic' }}>«{s.nota}»</div>
                    )}
                  </td>
                  {puoVerificare && (
                    <td>
                      {correggo === rigaChiave(s) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {/* Il sostituto si cambia solo sugli scambi di ingrediente: fra due
                              piatti «metti X al posto di Y» non è una correzione di grammatura, è
                              un altro cambio — e quello lo fa il motore, non questo campo. */}
                          {s.tipo !== 'piatto' && (
                            <>
                              <input
                                className="input sm"
                                placeholder={`sostituto (ora: ${s.to})`}
                                value={corr.to}
                                onChange={(e) => setCorr({ ...corr, to: e.target.value })}
                              />
                              <input
                                className="input sm"
                                placeholder={`quantità in ${s.unitA ?? s.unit ?? 'g'}`}
                                inputMode="numeric"
                                value={corr.toQty}
                                onChange={(e) => setCorr({ ...corr, toQty: e.target.value.replace(/[^0-9]/g, '') })}
                              />
                            </>
                          )}
                          <input
                            className="input sm"
                            placeholder="nota (la legge la cliente)"
                            value={corr.nota}
                            onChange={(e) => setCorr({ ...corr, nota: e.target.value })}
                          />
                          <div className="row" style={{ gap: 5 }}>
                            <button
                              className="btn sm"
                              disabled={salvo || (s.tipo !== 'piatto' && !corr.to.trim() && !corr.toQty && !corr.nota.trim())}
                              onClick={() =>
                                verifica(s, 'corretta', {
                                  ...(corr.to.trim() ? { to: corr.to.trim() } : {}),
                                  ...(corr.toQty ? { toQty: Number(corr.toQty) } : {}),
                                  ...(corr.nota.trim() ? { nota: corr.nota.trim() } : {}),
                                })
                              }
                            >
                              Salva
                            </button>
                            <button className="btn ghost sm" disabled={salvo} onClick={() => setCorreggo(null)}>
                              Annulla
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                          <button
                            className="btn ghost sm"
                            title="Va bene così"
                            disabled={salvo}
                            onClick={() => verifica(s, 'verificata')}
                          >
                            <i className="ti ti-check" />
                          </button>
                          <button
                            className="btn ghost sm"
                            title="Correggi sostituto o grammi"
                            disabled={salvo}
                            onClick={() => {
                              setCorreggo(rigaChiave(s));
                              setCorr({ to: '', toQty: '', nota: '' });
                            }}
                          >
                            <i className="ti ti-pencil" />
                          </button>
                          <button
                            className="btn ghost sm"
                            title="Annulla il cambio: il piatto torna come era"
                            disabled={salvo}
                            onClick={() => verifica(s, 'annullata')}
                          >
                            <i className="ti ti-x" style={{ color: '#B4232A' }} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {esitoVerifica && <Banner kind="ok">{esitoVerifica}</Banner>}
          <p className="hint" style={{ marginBottom: 0 }}>
            I grammi li propone Gaia a pari grammatura e la ricetta di catalogo non viene mai
            toccata: il cambio vale solo per questa cliente.
            {puoVerificare
              ? ' Correggendo qui scrivi sulla giornata di questa cliente, e lei riceve una notifica con la tua nota. Sul gruppo dei grassi serve quasi sempre: 70 ml di panna sono ~200 kcal, 70 g di olio ~630.'
              : ' La verifica la fa la nutrizionista: la grammatura è una decisione clinica.'}
          </p>
        </div>
      )}

      {/*
        L'errore va FUORI dal ramo «ci sono conversazioni», dove stava prima: con l'elenco vuoto
        non si vedeva, ed è l'altra metà del motivo per cui un 403 è passato per «vuoto».
      */}
      {err && <Banner kind="err">{err}</Banner>}
      {threads.length === 0 ? (
        /*
          Il messaggio diceva sempre «non visibile per il tuo ruolo», anche a un admin che le vede
          TUTTE: così un elenco vuoto sembrava un problema di permessi. Per chi vede tutto, vuoto
          vuol dire vuoto — i thread nascono quando è la CLIENTE a entrare in chat dall'app.
        */
        !err && (
          <p className="muted" style={{ marginBottom: 0 }}>
            {me?.role === 'admin'
              ? 'Questa cliente non ha ancora nessuna conversazione: i thread nascono quando entra in chat dall\'app.'
              : 'Nessuna conversazione visibile per il tuo ruolo.'}
          </p>
        )
      ) : (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {threads.map((t) => (
              <button
                key={t.id}
                className={t.id === sel ? 'btn sm' : 'btn ghost sm'}
                onClick={() => setSel(t.id)}
              >
                {t.counterpart === 'ai' && <i className="ti ti-sparkles" style={{ marginRight: 4 }} />}
                {t.counterpartName}
                <span className="muted" style={{ marginLeft: 6, fontSize: 11.5 }}>{t.messageCount}</span>
              </button>
            ))}
          </div>

          {caricaMsg ? (
            <Spinner />
          ) : messaggi.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>Nessun messaggio in questa conversazione.</p>
          ) : (
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {messaggi.map((m) => {
                const dellaCliente = m.senderRole === 'client';
                /*
                  LA ✕ ROSSA (richiesta di Simone, 11/8): «chi scrive il messaggio deve poterlo
                  cancellare». Compare SOLO sui propri messaggi — non sul capo, non sull'admin: il
                  senso è rimediare a quello che si è scritto per sbaglio, non moderare quello che
                  ha scritto un altro. Il backend applica la stessa regola, questa è la sua faccia.
                */
                const mio = !!m.senderUserId && m.senderUserId === me?.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      position: 'relative',
                      alignSelf: dellaCliente ? 'flex-start' : 'flex-end',
                      maxWidth: '78%',
                      padding: '8px 11px',
                      borderRadius: 12,
                      background: dellaCliente ? '#F2EFE8' : '#DCEBE3',
                      fontSize: 13,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {mio && (
                      <button
                        type="button"
                        title="Cancella questo messaggio"
                        aria-label="Cancella questo messaggio"
                        disabled={cancello === m.id}
                        onClick={() => setDaCancellare(m)}
                        style={{
                          position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                          borderRadius: '50%', border: '1px solid #E4B4B6', background: '#fff',
                          color: '#B4232A', fontSize: 11, lineHeight: '15px', padding: 0,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <i className="ti ti-x" />
                      </button>
                    )}
                    {m.body}
                    <div className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>
                      {m.senderRole === 'ai' ? 'Gaia' : dellaCliente ? 'cliente' : m.senderRole} · {oraBreve(m.sentAt)}
                      {m.meta?.esitoSostituzione === 'applicata' && ' · cambio applicato al menu'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/*
            RISPONDERE DA QUI (richiesta di Simone, 11/8).

            Prima la sezione era di sola lettura e per rispondere bisognava cambiare pagina: si
            leggeva il problema nella scheda — con davanti misure, menu e segnalazioni — e si
            rispondeva altrove, senza più niente sotto gli occhi.

            Il campo NON compare sul thread di Gaia, e non è una scelta estetica: una risposta dello
            staff dentro la conversazione con l'assistente arriverebbe alla cliente come se l'avesse
            scritta Gaia. Il backend la rifiuta comunque (là dentro lo staff ha accesso in sola
            lettura), ma un campo che si può scrivere e non si può inviare è una promessa rotta:
            meglio non mostrarlo e dire perché.

            Chi può scrivere lo decide il backend — è chi segue la cliente, non chi ne risponde in
            gerarchia. Qui si mostra il campo a chi in linea di principio potrebbe, e se il backend
            rifiuta si legge il suo motivo invece di un campo che sparisce senza spiegazione.
          */}
          {(() => {
            const thread = threads.find((t) => t.id === sel);
            if (!thread) return null;
            if (thread.counterpart === 'ai') {
              return (
                <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                  <i className="ti ti-info-circle" /> Questa è la conversazione con Gaia: si legge e non
                  si scrive. Una risposta qui arriverebbe alla cliente come se l'avesse scritta lei.
                  Per parlarle usa la conversazione con la coach o con la nutrizionista.
                </p>
              );
            }
            const mioRuolo =
              (thread.counterpart === 'coach' && (me?.role === 'coach' || me?.role === 'coach_coordinator')) ||
              (thread.counterpart === 'nutritionist' && (me?.role === 'nutritionist' || me?.role === 'head_nutritionist'));
            if (!mioRuolo) return null;
            return (
              <div style={{ marginTop: 10 }}>
                <textarea
                  className="input"
                  rows={2}
                  value={risposta}
                  maxLength={2000}
                  disabled={invio}
                  placeholder={`Rispondi come ${thread.counterpartName}…`}
                  onChange={(e) => setRisposta(e.target.value)}
                  /* Invio con Ctrl/⌘+Invio: a capo con Invio, perché qui si scrivono spiegazioni
                     lunghe e un invio accidentale a metà frase la manda alla cliente com'è. */
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void inviaRisposta();
                  }}
                />
                <div className="spread" style={{ marginTop: 6, alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    Le arriva una notifica. Ctrl/⌘+Invio per inviare.
                  </span>
                  <button className="btn sm" disabled={invio || !risposta.trim()} onClick={() => void inviaRisposta()}>
                    <i className="ti ti-send" /> {invio ? 'Invio…' : 'Invia'}
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/*
        LA CONFERMA (richiesta di Simone, 11/8). Non è una formalità: la cliente può aver già letto
        quel messaggio, quindi cancellarlo non lo toglie dalla sua testa. È un gesto da fare apposta,
        e la finestra mostra il testo perché si veda QUALE messaggio sta per sparire — la ✕ è
        piccola e le bolle si somigliano.
      */}
      {daCancellare && (
        <Modal title="Cancellare questo messaggio?" onClose={() => setDaCancellare(null)}>
          <p style={{ marginTop: 0, fontSize: 13 }}>
            Sparisce dalla conversazione, per te e per la cliente. Se l'aveva già letto, però, quello
            che ha letto resta: se serve, scrivile anche una rettifica.
          </p>
          <div style={{
            background: '#F2EFE8', borderRadius: 10, padding: '9px 12px', fontSize: 13,
            whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto',
          }}>
            {daCancellare.body}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn ghost sm" disabled={!!cancello} onClick={() => setDaCancellare(null)}>
              Lascia com'è
            </button>
            <button
              className="btn sm"
              style={{ background: '#B4232A', borderColor: '#B4232A' }}
              disabled={!!cancello}
              onClick={() => void cancellaMessaggio(daCancellare)}
            >
              {cancello ? 'Cancello…' : 'Sì, cancella'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
