import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import AppHeader from '../components/AppHeader';
import CarouselNav, { scrollCarouselTo } from '../components/CarouselNav';
import ReportsSection from '../components/ReportsSection';
import VideoMisure from '../components/VideoMisure';
import { parseMisura } from '../lib/misure';
import { esitoPesata, type EsitoPesata, type Traguardo } from '../lib/esitoPesata';
import { oggiIso } from '../lib/giorno';
import { entroIlTempo, leggiFrase, serveChiedere, type DomandaInSospeso } from '../lib/pesataDaConfermare';

/** Obiettivo — misure reali, andamento (grafici) e progressi verso il target. */

interface Measurement {
  id: string;
  date: string;
  weightKg: number;
  waistCm: number | null;
  hipsCm: number | null;
  /**
   * ⚠️ Lo staff poteva registrarle una circonferenza cosce che lei NON avrebbe mai visto (voce
   * 253, giro del 16/8): il campo esisteva nel database, nel form del backoffice e nella risposta
   * di `GET /me/measurements`, e si fermava qui — questa interfaccia non lo dichiarava, quindi per
   * l'app non esisteva. Un dato suo, misurato sul suo corpo, invisibile alla sola persona a cui
   * riguarda.
   */
  thighsCm: number | null;
  replacedSnapshot?: unknown | null; // valorizzato ⇒ misura del giorno già corretta una volta
}
interface Objective {
  targetWeightKg: number | null;
  targetWaistCm: number | null;
  targetHipsCm: number | null;
  targetDate: string | null;
}

const d1 = (n: number) => n.toFixed(1).replace('.', ',');
/** Numero col segno esplicito: "-1,0" / "+1,0" / "0,0". Evita i "--1,0" da segno raddoppiato. */
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${d1(Math.abs(n))}`;


function Spark({ vals, dates, format, color }: { vals: number[]; dates?: string[]; format: (v: number) => string; color: string }) {
  const H = 66;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 250;
  const h = 64;
  const n = vals.length;
  const x = (i: number) => (i / Math.max(n - 1, 1)) * w;
  const y = (v: number) => h - ((v - min) / range) * h * 0.85 - 5;
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || n <= 1) return;
    const rect = el.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(rel * (n - 1)));
  }
  const hx = hover != null ? (x(hover) / w) * 100 : 0;

  return (
    <div ref={ref} style={{ position: 'relative', height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {vals.map((v, i) => <circle key={i} cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r="3" fill={hover === i ? color : color} opacity={hover == null || hover === i ? 1 : 0.5} />)}
      </svg>
      {hover != null && (
        <>
          <div style={{ position: 'absolute', left: `${hx}%`, top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,.12)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: `${hx}%`, top: (y(vals[hover]) / h) * H, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: '50%', background: color, border: '2px solid #fff', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: `${Math.min(85, Math.max(15, hx))}%`, top: -4, transform: 'translate(-50%,-100%)', background: '#16302C', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>
            {dates?.[hover] ? `${dates[hover]} · ` : ''}{format(vals[hover])}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * QUELLO CHE IL SERVER SA DEI PROGRESSI — `GET /me/progress`, che fino al 19/8 non chiamava nessuno.
 *
 * ⚠️ Serve per **una cosa sola**: la percentuale del peso. Il server la calcola sulla **media
 * mobile** — la regola scritta del progetto è «si ragiona sempre sulla tendenza, mai sul singolo
 * dato» — mentre questa pagina se la calcolava da sola sull'**ultima pesata**. Stessa cliente,
 * stessa domanda, due numeri: e quello che vedeva lei era il più ballerino, perché due etti di
 * ritenzione lo mandavano indietro in una giornata in cui non era successo niente.
 *
 * ⛔ Il resto di quello che manda `/me/progress` **non si mostra**, ed è una decisione di Simone
 * (19/8): la **proiezione della data** («arrivi il 14 novembre») scritta qui diventerebbe una
 * promessa, e resta nel Report dov'è una curva dentro un documento; i **giorni di stallo** sono il
 * dato che fa suonare l'allarme alla coach, e «ferma da 11 giorni» letto in un giorno storto può
 * essere la spinta a smettere invece che a riprendere.
 */
interface ProgressiDalServer {
  progress?: { weightPercent: number | null; lostKg: number | null };
  start?: { weightKg: number | null };
}

const METRICS = [
  { key: 'weightKg', label: 'Peso', unit: 'kg', color: '#12A386', targetKey: 'targetWeightKg' },
  { key: 'waistCm', label: 'Vita', unit: 'cm', color: '#E8825A', targetKey: 'targetWaistCm' },
  { key: 'hipsCm', label: 'Fianchi', unit: 'cm', color: '#3A6EA5', targetKey: 'targetHipsCm' },
  /**
   * ⚠️ Le cosce NON hanno un obiettivo: `Objective` non ha un `targetThighsCm`, e inventarlo
   * vorrebbe dire una migrazione per una cosa che nessuno ha chiesto. `targetKey: null` è
   * dichiarato e gestito: il grafico dell'andamento c'è, la barra «verso il tuo obiettivo» no —
   * perché un traguardo non c'è, e una barra senza traguardo misura la distanza da niente.
   */
  { key: 'thighsCm', label: 'Cosce', unit: 'cm', color: '#8E6BB5', targetKey: null },
] as const;

export default function Obiettivo() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  /** I progressi come li calcola il server: serve la sola percentuale del peso. */
  const [progressi, setProgressi] = useState<ProgressiDalServer | null>(null);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [thighs, setThighs] = useState('');
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false); // modalità "cambia misure" attiva
  const [confirmCorrect, setConfirmCorrect] = useState(false); // sto mostrando "Sei sicuro?"
  /**
   * ⛔ **LA DOMANDA PRIMA DEL SALVATAGGIO** (voce `pesata-strana-chiedi-conferma`). Il server sa già
   * riconoscere due pesate che non possono essere della stessa persona, ⚠️ ma finora **agiva tutto
   * dopo**: il numero si salvava, il fabbisogno si sospendeva, e per riparare un tasto premuto male
   * serviva una telefonata. Qui c'è la frase che il server risponde quando il numero non torna, e
   * `pesoScritto` è il valore per cui è stata chiesta.
   *
   * ⛔ **Non è un cancello**: se lei risponde «sì, è giusto» il numero si salva identico a prima e il
   * guardrail fa il suo giro. Una cliente che pesa davvero quel numero non deve restare fuori dalla
   * sua app perché noi non ci crediamo.
   */
  const [daConfermare, setDaConfermare] = useState<DomandaInSospeso | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [chartIdx, setChartIdx] = useState(0);
  // Modifica obiettivo
  const [editObj, setEditObj] = useState(false);
  const [objKg, setObjKg] = useState('');
  const [objWeeks, setObjWeeks] = useState('');
  const [objBusy, setObjBusy] = useState(false);
  const [objErr, setObjErr] = useState<string | null>(null);

  function onChartsScroll() {
    const el = chartsRef.current;
    if (el) setChartIdx(Math.round(el.scrollLeft / el.clientWidth));
  }

  /**
   * Cosa è successo con l'ULTIMA pesata salvata: i traguardi appena raggiunti, oppure il fatto che
   * la pesata sia stata segnalata alla nutrizionista. Il server lo rispondeva già da sempre e
   * nessuna schermata lo leggeva.
   */
  const [esito, setEsito] = useState<EsitoPesata | null>(null);

  async function saveObjective() {
    setObjBusy(true);
    setObjErr(null);
    try {
      const body: Record<string, number> = {};
      const kg = parseMisura(objKg);
      const wk = Number(objWeeks);
      if (kg != null) body.weightToLoseKg = kg;
      if (Number.isFinite(wk) && wk > 0) body.weeks = wk;
      await api('/me/objective', { method: 'PATCH', body: JSON.stringify(body) });
      setEditObj(false);
      await load();
    } catch (e) {
      setObjErr(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setObjBusy(false);
    }
  }

  async function load() {
    const [msRaw, obj, prog] = await Promise.all([
      api<Measurement[]>('/me/measurements').catch(() => [] as Measurement[]),
      api<Objective>('/me/objective').catch((e) => (e instanceof ApiError && e.status === 404 ? null : null)),
      // Se non risponde, la barra del peso resta com'era: vedi il commento sul calcolo, più giù.
      api<ProgressiDalServer>('/me/progress').catch(() => null),
    ]);
    setProgressi(prog);
    // L'API le manda DECRESCENTI: le riordiniamo CRESCENTI (dalla più vecchia alla più
    // recente) così i grafici vanno nel verso giusto (un calo scende) e il form
    // pre-compila con l'ULTIMA misura (quella di oggi), non con la più vecchia.
    const ms = [...msRaw].sort((a, b) => a.date.localeCompare(b.date));
    setMeasurements(ms);
    setObjective(obj);
    const last = ms[ms.length - 1];
    if (last) {
      setWeight(d1(last.weightKg));
      setWaist(last.waistCm != null ? d1(last.waistCm) : '');
      setHips(last.hipsCm != null ? d1(last.hipsCm) : '');
      setThighs(last.thighsCm != null ? d1(last.thighsCm) : '');
    }
    setCorrecting(false);
    setConfirmCorrect(false);
    setDaConfermare(null);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  /** Quello che si sta per mandare, o `null` se manca il peso (unico obbligatorio). */
  function corpoMisure(): Record<string, number> | null {
    const w = parseMisura(weight);
    if (w === undefined) {
      setMsg('Inserisci almeno il peso.');
      return null;
    }
    const body: Record<string, number> = { weightKg: w };
    const wa = parseMisura(waist);
    const hi = parseMisura(hips);
    const co = parseMisura(thighs);
    if (wa !== undefined) body.waistCm = wa;
    if (hi !== undefined) body.hipsCm = hi;
    if (co !== undefined) body.thighsCm = co;
    return body;
  }

  /**
   * «Questo numero torna con le pesate che ci sono già?» — la domanda, prima di salvare.
   *
   * ⛔ **Se qualcosa va storto si risponde "nessuna domanda" e si salva**: rete che cade, rotta che
   * non c'è ancora sul server, risposta storta. Questa è una cortesia, non un controllo di accesso —
   * *una cliente non deve restare fuori dalla sua app perché una rotta di cortesia è caduta.*
   */
  async function chiediSeTorna(pesoKg: number): Promise<string | null> {
    try {
      /**
       * ⛔ **Con un tetto al tempo di attesa.** `fetch` non ha un timeout suo: senza `entroIlTempo`
       * una richiesta *appesa* — non fallita, appesa: il modo più comune in cui una rete mobile
       * smette di funzionare — teneva `busy` acceso, e `busy` spegne anche le caselle. La cliente
       * restava con i campi grigi, senza poter salvare né correggere il numero.
       */
      return await entroIlTempo(
        api<unknown>(`/me/measurements/verifica?weightKg=${encodeURIComponent(String(pesoKg))}`).then(leggiFrase),
      );
    } catch {
      return null;
    }
  }

  /** Il salvataggio vero, senza più domande: lo chiamano sia «Invia» sia «Sì, è giusto». */
  async function salva(body: Record<string, number>) {
    setBusy(true);
    setDaConfermare(null);
    try {
      const r = await api<{ newMilestones?: Traguardo[]; rapidLossAlert?: boolean; pesateDaVerificare?: boolean }>(
        '/me/measurements',
        { method: 'POST', body: JSON.stringify(body) },
      );
      await load();
      setMsg('Misure salvate!');
      setEsito(esitoPesata(r?.newMilestones, !!r?.rapidLossAlert, !!r?.pesateDaVerificare));
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setMsg(null);
    const body = corpoMisure();
    if (!body) return;
    // Già chiesto per QUESTO numero e già risposto: si salva. Se cambia il numero, si richiede.
    if (!serveChiedere(daConfermare, body.weightKg)) {
      await salva(body);
      return;
    }
    setBusy(true);
    const frase = await chiediSeTorna(body.weightKg);
    setBusy(false);
    if (frase) {
      setDaConfermare({ frase, pesoScritto: body.weightKg });
      return;
    }
    await salva(body);
  }

  /**
   * «Salva correzione»: la stessa domanda, un passo prima del «Sei sicuro?».
   *
   * ⚠️ Correggere è **il gesto che ripara**, e quasi sempre il numero nuovo è quello buono — ma è
   * anche il gesto con cui un numero storto può *nascere*, e chiederlo qui costa un tocco. ⛔ La
   * riga di oggi che si sta sostituendo non entra nel confronto (ci pensa il server): altrimenti
   * questa schermata difenderebbe il numero sbagliato proprio mentre lei lo ripara.
   */
  async function chiediPoiConferma() {
    setMsg(null);
    const body = corpoMisure();
    if (!body) return;
    if (serveChiedere(daConfermare, body.weightKg)) {
      setBusy(true);
      const frase = await chiediSeTorna(body.weightKg);
      setBusy(false);
      if (frase) {
        setDaConfermare({ frase, pesoScritto: body.weightKg });
        return;
      }
    }
    // ⛔ La conferma NON si azzera: `correct()` la ricontrolla, e senza troverebbe il vuoto e
    // richiederebbe la stessa cosa — un giro senza uscita.
    setConfirmCorrect(true);
  }

  /** Correzione della misura di OGGI (una sola volta): la precedente resta "sostituita". */
  async function correct() {
    setMsg(null);
    const body = corpoMisure();
    if (!body) return;
    /**
     * ⛔ **LA DOMANDA SI RICONTROLLA QUI, che è il punto che scrive** (trovato in revisione).
     *
     * `chiediPoiConferma` chiede un passo prima, e apre il «Sei sicuro?» — ⚠️ ma in quello stato le
     * caselle sono ancora **attive**: si poteva scrivere 73 (nessuna domanda), aprire il «Sei
     * sicuro?», cambiare il campo in 113 e premere «Sì, sostituisci». Il 113 si salvava **senza che
     * nessuno le avesse chiesto niente** — cioè usando una conferma data su un altro numero, che è
     * esattamente l'invariante per cui `serveChiedere` esiste.
     */
    if (serveChiedere(daConfermare, body.weightKg)) {
      setBusy(true);
      const frase = await chiediSeTorna(body.weightKg);
      setBusy(false);
      if (frase) {
        setConfirmCorrect(false);
        setDaConfermare({ frase, pesoScritto: body.weightKg });
        return;
      }
    }
    setBusy(true);
    setDaConfermare(null);
    try {
      const r = await api<{ pesateDaVerificare?: boolean }>(
        '/me/measurements/correct',
        { method: 'POST', body: JSON.stringify(body) },
      );
      await load();
      setMsg('Misure corrette. La misura precedente è stata sostituita.');
      /**
       * ⚠️ Anche qui: `correctTodayMeasurement` risponde `pesoIncoerente` da sempre e questa
       * schermata lo buttava via. È la rotta con cui un refuso si ripara da solo — ma se anche il
       * numero corretto non torna con le altre pesate, la segnalazione nasce lo stesso, e allora
       * lei deve saperlo qui e non dal messaggio della nutrizionista.
       */
      setEsito(esitoPesata([], false, !!r?.pesateDaVerificare));
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Correzione non riuscita.');
    } finally {
      setBusy(false);
      setConfirmCorrect(false);
    }
  }

  if (loading) return <div className="center"><div className="spin" /></div>;

  // Misura di oggi già inviata? (le misure sono ordinate crescenti → l'ultima è la più
  // recente). Se sì, il tasto resta disattivato finché non modifichi un valore.
  const todayIso = oggiIso();
  const lastMeas = measurements[measurements.length - 1];
  const sentToday = !!lastMeas && String(lastMeas.date).slice(0, 10) === todayIso;
  // Misura di oggi già corretta una volta? Allora niente altre modifiche dalla cliente.
  const correctedToday = sentToday && !!lastMeas?.replacedSnapshot;
  // Gli input si modificano: quando NON hai ancora inviato oggi, oppure quando hai premuto
  // "Cambia misure" (correcting) e non l'hai già corretta.
  const inputsEnabled = !busy && (!sentToday || (correcting && !correctedToday));

  return (
    <div className="home">
      <AppHeader title="I tuoi obiettivi" />

      {/* Elenco dei report del percorso (settimana di prova, diario del mese, fine piano). */}
      <ReportsSection variant="list" />

      {/* Obiettivo attuale (dai dati di registrazione) */}
      {objective && (() => {
        const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
        const start = sorted[0];
        /**
         * ⚠️ **LA PARTENZA È UNA SOLA IN QUESTA PAGINA** (19/8, dalla revisione). Qui c'era la prima
         * pesata, mentre la barra più sotto usa quella del **profilo** — il peso dichiarato al
         * questionario, che di solito è un altro numero. Sulla stessa schermata si leggeva
         * «Obiettivo attuale −14,0 kg» e due dita più giù «di −10,0 kg», e nessuno dei due era
         * sbagliato: erano due domande a cui rispondevano due punti di partenza diversi.
         */
        const partenzaPeso = progressi?.start?.weightKg ?? start?.weightKg ?? null;
        const dW = objective.targetWeightKg != null && partenzaPeso != null ? partenzaPeso - objective.targetWeightKg : null;
        const dWa = objective.targetWaistCm != null && start?.waistCm != null ? start.waistCm - objective.targetWaistCm : null;
        const dH = objective.targetHipsCm != null && start?.hipsCm != null ? start.hipsCm - objective.targetHipsCm : null;
        const cm = dWa ?? dH;
        const weeks = objective.targetDate ? Math.max(1, Math.round((new Date(objective.targetDate).getTime() - Date.now()) / (7 * 86_400_000))) : null;
        const rate = dW != null && weeks ? dW / weeks : null;
        const sust = rate == null ? null : rate <= 0.7 ? { t: 'sostenibile', c: '#3B6D11' } : rate <= 1 ? { t: 'ambizioso', c: '#8A5A0B' } : { t: 'molto ambizioso', c: '#993C1D' };
        if (dW == null && cm == null) return null;
        return (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row-between">
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Obiettivo attuale</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>
                  {dW != null ? `-${d1(dW)} kg` : ''}{dW != null && cm != null ? ' · ' : ''}{cm != null ? `-${d1(cm)} cm` : ''}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {weeks ? `entro ${weeks} settimane` : ''}{weeks && sust ? ' · ' : ''}{sust && <span style={{ color: sust.c, fontWeight: 600 }}>{sust.t}</span>}
                </div>
              </div>
              <span className="event-ic" style={{ background: '#EAF6F1', color: '#0E7C66', flex: 'none' }}><i className="ti ti-target" /></span>
            </div>
            <button
              className="btn-recipe"
              style={{ marginTop: 10 }}
              onClick={() => { setObjKg(dW != null ? d1(dW) : ''); setObjWeeks(weeks ? String(weeks) : ''); setObjErr(null); setEditObj(true); }}
            >
              <i className="ti ti-pencil" /> Modifica o fissa un nuovo obiettivo
            </button>
          </div>
        );
      })()}

      {editObj && (
        <div className="card" style={{ marginBottom: 12 }}>
          <b style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Modifica obiettivo</b>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Peso da perdere (kg)</div>
              <input className="input" inputMode="decimal" value={objKg} onChange={(e) => setObjKg(e.target.value)} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Entro (settimane)</div>
              <input className="input" inputMode="numeric" value={objWeeks} onChange={(e) => setObjWeeks(e.target.value)} />
            </div>
          </div>
          {objErr && <div className="muted" style={{ color: '#B3261E', fontSize: 12, marginTop: 8 }}>{objErr}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn" style={{ flex: 1 }} onClick={saveObjective} disabled={objBusy}>{objBusy ? 'Salvo…' : 'Salva obiettivo'}</button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEditObj(false)}>Annulla</button>
          </div>
        </div>
      )}

      {/* Misure di oggi */}
      <div className="card">
        {/*
          ⚠️ Il punto interrogativo accanto al titolo, non un riquadro sotto (richiesta di Simone,
          21/8). Qui il video è un **ripensamento**, non il punto della schermata: chi sa già
          misurarsi sta scrivendo un numero, e un'anteprima grande in mezzo le occuperebbe lo spazio
          per una cosa che ha già visto. Nel blocco misure che ferma il menu, invece, il video sta
          in grande e sopra le caselle di vita e fianchi — lì è la schermata a esistere per quello.
          ⚠️ È lo **stesso** componente, e lo stesso file video: due copie divergono.
        */}
        <div className="row-between" style={{ alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 13 }}>Misure di oggi</b>
          <VideoMisure forma="punto" origine="obiettivo" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Peso (kg)</div><input className="input" inputMode="decimal" value={weight} disabled={!inputsEnabled} onChange={(e) => { setWeight(e.target.value); setDaConfermare(null); }} /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Vita (cm)</div><input className="input" inputMode="decimal" value={waist} disabled={!inputsEnabled} onChange={(e) => setWaist(e.target.value)} /></div>
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Fianchi (cm)</div><input className="input" inputMode="decimal" value={hips} disabled={!inputsEnabled} onChange={(e) => setHips(e.target.value)} /></div>
          {/* ⚠️ Non basta MOSTRARLE le cosce: se solo lo staff può scriverle, resta un dato su di
              lei che lei non governa. La porta era già aperta — `CreateMeasurementDto` accetta
              `thighsCm` da sempre — e mancava soltanto questa casella. */}
          <div><div className="muted" style={{ fontSize: 11, marginBottom: 3 }}>Cosce (cm)</div><input className="input" inputMode="decimal" value={thighs} disabled={!inputsEnabled} onChange={(e) => setThighs(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {!sentToday ? (
              <button className="btn" style={{ padding: 11 }} onClick={submit} disabled={busy}>
                <i className="ti ti-send" /> {busy ? 'Salvo…' : 'Invia'}
              </button>
            ) : correctedToday ? (
              <button className="btn" style={{ padding: 11 }} disabled>
                <i className="ti ti-check" /> Corretta oggi
              </button>
            ) : !correcting ? (
              <button className="btn ghost" style={{ padding: 11 }} onClick={() => { setMsg(null); setCorrecting(true); }} disabled={busy}>
                <i className="ti ti-pencil" /> Cambia misure
              </button>
            ) : (
              <button className="btn" style={{ padding: 11 }} onClick={chiediPoiConferma} disabled={busy}>
                <i className="ti ti-send" /> {busy ? 'Salvo…' : 'Salva correzione'}
              </button>
            )}
          </div>
        </div>

        {/*
          ⛔ **LA DOMANDA, PRIMA CHE IL NUMERO PARTA** (voce `pesata-strana-chiedi-conferma`).

          Il guardrail sulle pesate impossibili esisteva già, ⚠️ ma agiva **dopo**: il numero si
          salvava, il fabbisogno si sospendeva, e per riparare un tasto premuto male serviva una
          telefonata della coach. Il posto dove lo stesso errore costa niente è questo, perché lei
          è ancora davanti alla tastiera.

          ⛔ **Non è un blocco.** «Sì, è giusto» salva il numero identico a prima, e il guardrail fa
          il suo giro come sempre: *una cliente che pesa davvero quel numero non deve restare fuori
          dalla sua app perché noi non ci crediamo*. Per la stessa ragione la frase **chiede** e non
          accusa, e non nomina la nutrizionista: qui non è ancora successo niente, e minacciare una
          segnalazione per ottenere una correzione fa rispondere «no» proprio a chi il numero
          l'aveva giusto.

          ⚠️ La frase arriva dal server: le soglie stanno nei Parametri e la regola è la stessa che
          un istante dopo deciderà se aprire la segnalazione. Riscriverla qui vorrebbe dire una
          schermata che dice «va bene» e un guardrail che dice il contrario.
        */}
        {daConfermare && !daConfermare.confermato && (
          <div className="card" style={{ marginTop: 10, background: '#FBF0D6', border: '1px solid #EAD8A6', boxShadow: 'none' }}>
            <div style={{ fontSize: 13, color: '#7A5B12', marginBottom: 8, lineHeight: 1.5 }}>
              <i className="ti ti-help-circle" style={{ verticalAlign: '-2px', marginRight: 5 }} />
              {daConfermare.frase}
            </div>
            <div className="row" style={{ gap: 8 }}>
              {/*
                ⚠️ «Sì, è giusto» porta avanti **il gesto che stava facendo**: dal primo invio salva,
                da «Cambia misure» apre il «Sei sicuro?» della sostituzione — che è una domanda
                diversa (si corregge una volta sola) e non va saltata.
              */}
              <button
                className="btn"
                style={{ flex: 1, padding: 10 }}
                onClick={
                  correcting
                    ? () => { setDaConfermare({ ...daConfermare, confermato: true }); setConfirmCorrect(true); }
                    : submit
                }
                disabled={busy}
              >
                {busy ? 'Salvo…' : 'Sì, è giusto'}
              </button>
              <button className="btn ghost" style={{ flex: 1, padding: 10 }} onClick={() => setDaConfermare(null)} disabled={busy}>
                Correggo
              </button>
            </div>
          </div>
        )}

        {/* Conferma sostituzione ("Sei sicuro?") */}
        {confirmCorrect && (
          <div className="card" style={{ marginTop: 10, background: '#FBF0D6', border: '1px solid #EAD8A6', boxShadow: 'none' }}>
            <div style={{ fontSize: 13, color: '#7A5B12', marginBottom: 8 }}>
              Sei sicuro? Le misure di oggi verranno sostituite con quelle nuove. <b>Puoi correggerle una sola volta</b>; dopo, solo lo staff può modificarle.
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" style={{ flex: 1, padding: 10 }} onClick={correct} disabled={busy}>{busy ? 'Salvo…' : 'Sì, sostituisci'}</button>
              <button className="btn ghost" style={{ flex: 1, padding: 10 }} onClick={() => setConfirmCorrect(false)} disabled={busy}>Annulla</button>
            </div>
          </div>
        )}

        {sentToday && !correctedToday && !correcting && (
          <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>Hai inviato le misure di oggi. Se hai sbagliato puoi correggerle una volta.</div>
        )}
        {msg && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>{msg}</div>}
        {/*
          ⚠️ QUELLO CHE IL SERVER RISPONDEVA E NESSUNO LEGGEVA (16/8). `POST /me/measurements`
          torna da sempre i traguardi appena raggiunti e il guardrail del calo rapido: si salvava,
          la pagina si ricaricava, e la cliente non sapeva né di aver raggiunto l'obiettivo né che
          si era aperta una segnalazione su di lei.

          ⚠️ Il gate delle misure (`MeasuresGate`) resta fuori di proposito: lì dopo il salvataggio
          si fa `window.location.reload()` per aggiornare menu e lista della spesa, e un messaggio
          scritto un istante prima di ricaricare è un messaggio che nessuno legge.
        */}
        {esito?.tipo === 'traguardi' && (
          <div
            className="card"
            style={{ marginTop: 10, background: '#EAF6EC', boxShadow: 'none', padding: 11 }}
          >
            {esito.etichette.map((e) => (
              <div key={e} style={{ fontSize: 13.5, fontWeight: 600, color: '#2E6B3A', lineHeight: 1.5 }}>
                <i className="ti ti-trophy" style={{ verticalAlign: '-2px', marginRight: 6 }} />
                {e}
              </div>
            ))}
          </div>
        )}
        {esito?.tipo === 'da-verificare' && (
          <div
            className="card"
            style={{ marginTop: 10, background: '#FDECC8', boxShadow: 'none', padding: 11 }}
          >
            {/*
              ⚠️ Adesso invece **è successo qualcosa**: la segnalazione è aperta e per qualche giorno
              i suoi menu useranno il livello della sua dieta invece del suo fabbisogno. Tacere qui
              sarebbe peggio che dirlo — poi la nutrizionista le scrive e lei non sa perché.

              ⛔ E non si dice «hai sbagliato»: il server sa che due numeri insieme non stanno in
              piedi, non **quale** dei due è quello buono.
            */}
            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: '#8A5A00' }}>
              <i className="ti ti-info-circle" style={{ verticalAlign: '-2px', marginRight: 5 }} />
              Questa pesata è lontana dalle precedenti, quindi la controlla la tua nutrizionista: se
              serve ti scrive lei. Intanto il tuo peso è salvato e il menu continua ad arrivare.
            </span>
          </div>
        )}
        {esito?.tipo === 'segnalata' && (
          <div
            className="card"
            style={{ marginTop: 10, background: '#FDECC8', boxShadow: 'none', padding: 11 }}
          >
            {/*
              ⚠️ Si dice COSA È SUCCESSO, non che c'è un problema: il guardrail apre una
              segnalazione, non fa una diagnosi. Allarmarla sarebbe sbagliato quanto tacere — ma
              tacere è peggio, perché poi la nutrizionista le scrive e lei non sa perché.
            */}
            <span style={{ fontSize: 12.5, lineHeight: 1.55, color: '#8A5A00' }}>
              <i className="ti ti-info-circle" style={{ verticalAlign: '-2px', marginRight: 5 }} />
              Il calo di questi giorni è più rapido del previsto, quindi abbiamo avvisato la tua
              nutrizionista: la guarda lei e ti scrive se serve. Tu continua come stai facendo.
            </span>
          </div>
        )}
      </div>

      {measurements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>Ancora nessuna misura: inserisci la prima per vedere i progressi.</p>
        </div>
      ) : (
        <>
          {/* Andamento — carosello di grafici (come il prototipo) */}
          {(() => {
            const charts = METRICS
              .map((m) => {
                const pts = measurements
                  .map((x) => ({ v: x[m.key] as number | null, d: x.date }))
                  .filter((p): p is { v: number; d: string } => p.v != null);
                return {
                  m,
                  series: pts.map((p) => p.v),
                  dates: pts.map((p) => new Date(p.d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })),
                };
              })
              .filter((c) => c.series.length >= 2);
            if (charts.length === 0) return null;
            return (
              <>
                {/* Il suggerimento "scorri i grafici" solo se i grafici sono più di uno: con una
                    sola metrica misurata non c'è niente da scorrere e la scritta faceva pensare
                    a uno swipe rotto (segnalazione clienti del 5/8). */}
                <div className="sec">
                  Andamento
                  {charts.length > 1 && <span className="muted" style={{ fontWeight: 400 }}> · scorri i grafici</span>}
                </div>
                <div className="meal-carousel" ref={chartsRef} onScroll={onChartsScroll}>
                  {charts.map(({ m, series, dates }) => {
                    const delta = series[0] - series[series.length - 1];
                    return (
                      <div className="card" key={m.key}>
                        <div className="row-between" style={{ marginBottom: 8 }}>
                          <b style={{ fontSize: 13 }}>Andamento {m.label.toLowerCase()}</b>
                          <span style={{ fontSize: 11, color: m.color, fontWeight: 600 }}>{delta >= 0 ? '-' : '+'}{d1(Math.abs(delta))} {m.unit}</span>
                        </div>
                        <Spark vals={series} dates={dates} format={(v) => `${d1(v)} ${m.unit}`} color={m.color} />
                        <div className="row-between" style={{ fontSize: 10, color: '#9aa', marginTop: 4 }}>
                          <span>{dates[0]}</span><span>{dates[dates.length - 1]}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <CarouselNav
                  count={charts.length}
                  index={chartIdx}
                  onGo={(i) => { setChartIdx(i); scrollCarouselTo(chartsRef.current, i); }}
                />
              </>
            );
          })()}

          {/* Progressi */}
          <div className="card" style={{ marginTop: 12 }}>
            <b style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>Verso il tuo obiettivo</b>
            {METRICS.map((m) => {
              const series = measurements.map((x) => x[m.key] as number | null).filter((v): v is number => v != null);
              // `targetKey: null` (le cosce): nessun obiettivo, quindi niente barra. Il `return`
              // qui sotto la salta già, come fa da sempre per chi il traguardo non l'ha impostato.
              const target = objective && m.targetKey ? (objective[m.targetKey] as number | null) : null;
              if (series.length === 0 || target == null) return null;
              /**
               * ⚠️ IL PESO LO CALCOLA IL SERVER — 19/8, decisione di Simone.
               *
               * Qui c'era un conto locale sull'**ultima pesata**, mentre il server (e quindi il
               * motore e l'allarme di stallo della coach) risponde alla stessa domanda sulla **media
               * mobile**. Due numeri sulla stessa persona, e quello che vedeva lei tornava indietro
               * per due etti di ritenzione, in una giornata in cui non era successo niente.
               *
               * ⚠️ **Solo il peso**: vita e fianchi il server non li calcola, e restano il conto di
               * questa pagina — dichiarato, non dimenticato.
               *
               * ⚠️ E se `/me/progress` non risponde si torna al conto locale, che è quello di prima:
               * meglio il numero vecchio che una barra vuota. È l'unico caso in cui i due conti
               * convivono, e dura quanto dura la richiesta fallita.
               */
              const dalServer = m.key === 'weightKg' ? progressi : null;
              const startServer = dalServer?.start?.weightKg;
              const start = typeof startServer === 'number' ? startServer : series[0];
              const persiDalServer = dalServer?.progress?.lostKg;
              const current =
                typeof persiDalServer === 'number' ? start - persiDalServer : series[series.length - 1];
              // Movimenti CON SEGNO rispetto al punto di partenza: negativo = in calo.
              // Prima si stampava un "-" fisso davanti al numero, che con il peso in aumento
              // produceva "--1,0" (segnalato il 5/8) e con un obiettivo in crescita sarebbe
              // stato sbagliato comunque.
              const fatto = current - start;
              const totale = target - start;
              const pctRaw = totale === 0 ? 100 : (fatto / totale) * 100;
              const pctServer = dalServer?.progress?.weightPercent;
              const dalServerDavvero = typeof pctServer === 'number';
              const pct = dalServerDavvero ? pctServer : Math.max(0, Math.min(100, Math.round(pctRaw)));
              // Direzione opposta a quella dell'obiettivo: la barra a 0% da sola non spiega niente.
              const controMano = pctRaw < 0;
              return (
                <div key={m.key} style={{ marginBottom: 13 }}>
                  <div className="row-between" style={{ fontSize: 12, marginBottom: 4 }}>
                    <b>{m.label}</b>
                    <span className="muted">
                      {signed(fatto)} di {signed(totale)} {m.unit} ·{' '}
                      {/* ⚠️ La percentuale si scrive com'è: arrotondandola all'intero direbbe 45%
                          accanto a dei chili che ne fanno 44, e i due numeri della stessa riga si
                          contraddirebbero. E la virgola, non il punto. */}
                      <b style={{ color: controMano ? 'var(--warm, #B0663F)' : m.color }}>
                        {String(Math.round(pct * 10) / 10).replace('.', ',')}%
                      </b>
                    </span>
                  </div>
                  <div className={controMano ? 'bar bar-off' : 'bar'}>
                    <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: m.color }} />
                  </div>
                  {/*
                    ⚠️ SU COSA È CALCOLATA, DETTO — è il prezzo della decisione del 19/8 (passare alla
                    media mobile), e va pagato qui. Senza questa riga la cliente pesa 300 g in meno, la
                    barra non si muove, e sopra — nel modulo «Misure di oggi» — vede l'ultima pesata:
                    la schermata sembra rotta, e a quel punto smette di crederle anche quando si muove.
                  */}
                  {dalServerDavvero && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.35 }}>
                      Sulla media degli ultimi giorni, non sul peso di stamattina: una giornata storta non ti fa tornare indietro.
                    </div>
                  )}
                  {controMano && (
                    <div className="muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.35 }}>
                      {d1(Math.abs(fatto))} {m.unit} sopra il punto di partenza. Conta la tendenza delle settimane, non la singola misura.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
