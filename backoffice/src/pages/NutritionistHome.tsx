import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';
import { DashboardShortcuts, DashboardModules } from '../components/DashboardBlocks';
import { WalletWidget } from '../components/WalletWidget';
import { usePreferenzeHome } from '../lib/preferenzeHome';

const euro0 = (c: number) => '€ ' + Math.round(c / 100).toLocaleString('it-IT');

interface Dash {
  isNutritionist: boolean;
  patientsCount: number;
  pendingDocuments: number;
  openEscalations: number;
  protocolsToValidate: number;
  upcomingVisits: number;
  earningsMonthCents: number;
  earningsTotalCents: number;
}
/** Quello che aspetta questa persona nell'assistente: proposte, domande, sostituzioni. */
interface Aspetta {
  richieste: number;
  daApprovare: number;
  daVerificare: number;
  capo: boolean;
  /**
   * ⚠️ Il quarto modulo della §13.3, arrivato il 18/8. `null` = **non lo so** (il conto è fallito e
   * il server l'ha degradato), che è diverso da «nessuna»: la chip lo scrive diverso invece di
   * mostrare uno zero rassicurante e falso.
   */
  pool: { quante: number; nomi: string[]; esaminate: number; nonValutabili: number } | null;
}
interface Patient {
  clientId: string;
  name: string | null;
  lastMeasureDate: string | null;
  openEscalations: number;
  pendingDocuments: number;
  nextVisit: { datetime: string; type: string } | null;
}
export function NutritionistHome() {
  const { user, can } = useAuth();
  const [dash, setDash] = useState<Dash | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const pref = usePreferenzeHome();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [d, p, prefs] = await Promise.all([
        api<Dash>('/nutritionist/dashboard'),
        api<{ patients: Patient[] }>('/nutritionist/patients'),
        api<{ showEarnings?: boolean }>('/me/preferences').catch(() => ({ showEarnings: false })),
      ]);
      setDash(d);
      setPatients(p.patients ?? []);
      setShowEarnings(!!(prefs as { showEarnings?: boolean }).showEarnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Spinner />;

  const hello = (user?.firstName && user.firstName.trim()) || 'Dottoressa';

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Ciao {hello} 👋</h1>
      {error && <Banner kind="err">{error}</Banner>}

      {pref.attivo('b_assistente') && can('nutri_assistant') && <AssistenteWidget />}

      {pref.attivo('b_portafoglio') && <WalletWidget />}

      {pref.attivo('b_scorciatoie') && <DashboardShortcuts />}

      {/* KPI clinici */}
      {pref.attivo('b_kpi') && (
      <>
      <div className="card-row">
        <Kpi label="Pazienti" value={String(dash?.patientsCount ?? 0)} icon="ti-users" />
        <Kpi label="Documenti da rivedere" value={String(dash?.pendingDocuments ?? 0)} icon="ti-file-description" color={dash && dash.pendingDocuments > 0 ? 'var(--coral-dark)' : undefined} />
        <Kpi label="Escalation aperte" value={String(dash?.openEscalations ?? 0)} icon="ti-alert-triangle" color={dash && dash.openEscalations > 0 ? 'var(--coral-dark)' : undefined} />
        <Kpi label="Visite in arrivo" value={String(dash?.upcomingVisits ?? 0)} icon="ti-calendar" />
      </div>

      {/* Guadagni (come coach) */}
      <div className="card-row" style={{ marginTop: 12 }}>
        {showEarnings && <Kpi label="Guadagni mese" value={euro0(dash?.earningsMonthCents ?? 0)} icon="ti-coin" />}
        {showEarnings && <Kpi label="Guadagni totale" value={euro0(dash?.earningsTotalCents ?? 0)} icon="ti-wallet" />}
      </div>
      </>
      )}

      {/*
        ⚠️ **Niente più `card-row` qui** (revisione, 22/8). Erano due carte affiancate, `flex: 1.3` e
        `flex: 1`; tolta la prima, l'unica rimasta si stirava su tutta la larghezza — e con `.spread`
        dentro, su un monitor largo il nome della paziente finiva a sinistra e la sua etichetta a
        milleduecento pixel di distanza, con il vuoto in mezzo. ⚠️ E con `b_pazienti` spento restava
        un contenitore vuoto che portava comunque i suoi margini.
      */}
      <div style={{ marginTop: 16 }}>
        {/*
          ⛔ **IL RIQUADRO «DA VALIDARE» NON STA PIÙ QUI** (22/8, richiesta di Simone: «togliamo il
          da validare in dashboard che non mi piace ed unifichiamolo con questo»).

          Vive in `components/CodaDaValidare.tsx` e si disegna in **Attività da fare** — la pagina
          che dal 22/8 la nutrizionista può finalmente aprire. ⚠️ La ragione è più forte del gusto:
          fino a ieri il suo lavoro stava in due posti che non si guardavano — tre code qui e
          quattro tipi di attività in una pagina a cui non aveva accesso. Due elenchi di «cosa devo
          fare» sono due elenchi che si leggono a metà.

          ⚠️ È stato **estratto, non ricopiato**: se un giorno lo si rivolesse anche qui, si mette
          `<CodaDaValidare />` e basta. Due copie divergono.

          ⛔ **Resta però il rimando, e non è cortesia** (revisione del 22/8). La pagina di
          destinazione è protetta dal permesso `coach_tasks`, che su un ambiente già vivo va acceso
          a mano (`npm run apri:attivita-nutrizionista`) e che lo script **non tocca** se qualcuno
          l'aveva già impostato. Togliendo il riquadro senza lasciare traccia, una nutrizionista con
          quel permesso ancora chiuso si troverebbe la coda clinica sparita da ogni schermata, senza
          un errore e senza un messaggio. *Niente tagli silenziosi.*
        */}
        <div className="card" style={{ margin: 0, marginBottom: 12 }}>
          <div className="spread" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5 }}>
              <i className="ti ti-clipboard-check" style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--teal)' }} />
              Le decisioni del motore, le diete e i protocolli <b>da validare</b> stanno in «Attività da fare».
            </span>
            <Link className="btn ghost sm" to="/attivita-coach">Aprile</Link>
          </div>
        </div>

        {/* Pazienti che richiedono attenzione */}
        {pref.attivo('b_pazienti') && (
        <div className="card" style={{ margin: 0 }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>Pazienti</h2>
            <Link className="muted" style={{ fontSize: 13 }} to="/clienti">Tutti →</Link>
          </div>
          {patients.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>Nessun paziente assegnato.</div>
          ) : (
            patients.slice(0, 10).map((p) => (
              <div key={p.clientId} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="spread">
                  <Link to={`/clienti/${p.clientId}`} className="link"><b>{p.name ?? 'Paziente'}</b></Link>
                  <div className="row" style={{ gap: 5 }}>
                    {p.openEscalations > 0 && <span className="chip red" style={{ fontSize: 10 }} title="Escalation aperte">{p.openEscalations} esc.</span>}
                    {p.pendingDocuments > 0 && <span className="chip amber" style={{ fontSize: 10 }} title="Documenti da rivedere">{p.pendingDocuments} doc.</span>}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {p.lastMeasureDate ? `ultima misura ${p.lastMeasureDate}` : 'nessuna misura'}
                  {p.nextVisit && ` · visita ${new Date(p.nextVisit.datetime).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`}
                </div>
              </div>
            ))
          )}
        </div>
        )}
      </div>

      {/* Modulo Regole del motore — solo il capo nutrizionista */}
      {pref.attivo('b_regole_motore') && can('engine_rules', 'manage') && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <i className="ti ti-adjustments-cog" style={{ fontSize: 20, color: 'var(--deep)' }} />
                <h2 style={{ margin: 0 }}>Regole del motore</h2>
              </div>
              <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>
                Gestisci le regole globali del motore, le regole base suggerite per tipo di nutrizione e le proposte di nuove regole.
              </p>
            </div>
            <Link className="btn" to="/regole-motore"><i className="ti ti-arrow-right" /> Apri</Link>
          </div>
        </div>
      )}
      <DashboardModules />

    </>
  );
}

function Kpi({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--chip)', color: 'var(--chip-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
        </span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
          <span className="muted" style={{ fontSize: 12 }}>{label}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * QUELLO CHE ASPETTA TE — l'assistente, dalla home.
 *
 * ⚠️ Il blocco esiste per una ragione sola: le cose che aspettano una persona stanno **dentro** la
 * pagina dell'assistente, e una coda che si vede solo entrando è una coda che si guarda quando ci
 * si ricorda di entrare. Qui si vede prima, cioè quando serve.
 *
 * ⚠️ E non c'è nessun numero di «regole create». Un contatore di quello che si è fatto è una
 * medaglietta: la si guarda due volte e poi mai più. Se non c'è niente da fare, questo blocco
 * **sparisce** invece di dire «zero» — dire zero ogni giorno è il modo di insegnare a non leggerlo.
 */
function AssistenteWidget() {
  const [a, setA] = useState<Aspetta | null>(null);

  useEffect(() => {
    let vivo = true;
    api<Aspetta>('/vera/aspetta-me')
      .then((r) => { if (vivo) setA(r); })
      // Silenzio: è un riquadro accessorio in cima alla home, e un errore rosso qui farebbe
      // sembrare rotta tutta la pagina per una cosa che non blocca niente.
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  // ⚠️ Il riquadro sparisce solo se non c'è VERAMENTE niente: le clienti col pool sotto soglia e
  // quelle di cui non si è potuto dire niente contano tutt'e due come «qualcosa da guardare».
  const poolDaDire = !a?.pool || a.pool.quante > 0 || a.pool.nonValutabili > 0;
  if (!a || (a.richieste === 0 && a.daApprovare === 0 && a.daVerificare === 0 && !poolDaDire)) return null;

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
      <div className="spread" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <i className="ti ti-sparkles" style={{ color: 'var(--gold)' }} />
          <b>Aspetta te</b>
          {a.daApprovare > 0 && <span className="chip amber">{a.daApprovare} da approvare</span>}
          {a.richieste > 0 && <span className="chip amber">{a.richieste} domande aperte</span>}
          {a.daVerificare > 0 && <span className="chip">{a.daVerificare} sostituzioni da verificare</span>}
          {/* ⚠️ Tre stati e tre chip diverse: «N col pool sotto soglia» (c'è un problema), «N non
              valutabili» (non lo so, e non è la stessa cosa di zero), «pool non calcolato» (il
              conto è fallito). Uno zero muto avrebbe insegnato a non guardare più il riquadro. */}
          {a.pool === null && <span className="chip">pool non calcolato</span>}
          {a.pool && a.pool.quante > 0 && (
            <span
              className="chip amber"
              title={a.pool.nomi.length ? `${a.pool.nomi.join(', ')}${a.pool.quante > a.pool.nomi.length ? ', …' : ''}` : undefined}
            >
              {a.pool.quante} col pool sotto soglia
            </span>
          )}
          {a.pool && a.pool.nonValutabili > 0 && (
            <span className="chip" title="Senza dieta assegnata, o con una dieta di cui non si è potuto leggere il pool: non è «a posto», è «non lo so».">
              {a.pool.nonValutabili} da guardare a mano
            </span>
          )}
        </div>
        <Link className="btn sm" to="/assistente"><i className="ti ti-message-chatbot" /> Apri l'assistente</Link>
      </div>
    </div>
  );
}
