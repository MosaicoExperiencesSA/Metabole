import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';
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
interface Decision {
  id: string;
  clientId: string;
  patientName: string | null;
  date: string;
  flagReason: string | null;
  /** La causa (`calo_rapido_energia`, `energia_bassa_cronica`, …) e la sua etichetta breve. */
  causa: string | null;
  causaEtichetta: string | null;
  rule: { id: string; name: string } | null;
  action: unknown;
}

/**
 * Cosa si può fare su una riga della coda: arriva dal backend, perché **quali azioni siano
 * ammesse dipende dalla causa** ed è una regola clinica, non una scelta di interfaccia. Se la
 * tabella vivesse qui, una POST fatta a mano la scavalcherebbe.
 */
interface AzioniDecisione {
  decisionId: string;
  clientId: string;
  causa: string | null;
  causaEtichetta: string | null;
  flagReason: string | null;
  pianoGiaFermo: boolean;
  calcoloGiaAzzeratoIl: string | null;
  azioni: { azione: string; etichetta: string; cosaFa: string; eseguitaDalServer: boolean }[];
}
interface Queue {
  engineDecisions: Decision[];
  dietsInReview: { id: string; name: string; regime: string; style: string }[];
  protocolsPending: { id: string; name: string; type: string }[];
  /** Quante ce ne sono nel database (da `count()`), non quante righe sono nell'elenco. */
  counts: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
  /** Quante righe sono arrivate: se è meno di `counts`, l'elenco è troncato e va detto. */
  mostrati?: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
}

/**
 * Il numero fra parentesi nei titoli della coda.
 *
 * Prima era `elenco.length`, cioè la lunghezza di un array troncato a 100: nel giorno in cui il
 * motore segnala più di cento clienti — quello in cui il numero serve — diceva «100» qualunque fosse
 * la verità. Adesso `totale` viene dal database e, quando l'elenco è più corto, si dice entrambi.
 */
const conteggio = (totale: number, mostrati: number): string =>
  mostrati < totale ? `${mostrati} di ${totale}` : String(totale);

export function NutritionistHome() {
  const { user, can } = useAuth();
  const [dash, setDash] = useState<Dash | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const pref = usePreferenzeHome();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [d, p, q, prefs] = await Promise.all([
        api<Dash>('/nutritionist/dashboard'),
        api<{ patients: Patient[] }>('/nutritionist/patients'),
        api<Queue>('/nutritionist/validation-queue'),
        api<{ showEarnings?: boolean }>('/me/preferences').catch(() => ({ showEarnings: false })),
      ]);
      setDash(d);
      setPatients(p.patients ?? []);
      setQueue(q);
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

  async function reviewDecision(id: string, outcome: 'confirm' | 'correct') {
    setQueue((q) => (q ? { ...q, engineDecisions: q.engineDecisions.filter((x) => x.id !== id) } : q));
    try {
      await api(`/nutritionist/decisions/${id}/${outcome}`, { method: 'POST', body: JSON.stringify({}) });
      setNotice(outcome === 'confirm' ? 'Decisione confermata.' : 'Decisione segnata da correggere.');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
      void load();
    }
  }

  /**
   * «CORREGGI» apre le azioni della causa, non un modulo generico (§15.2 punto 2).
   *
   * La domanda di Nocanty era «cosa fanno questi due pulsanti?», e la risposta onesta era
   * «niente»: scrivevano l'esito e nessun altro pezzo di codice leggeva quel campo. Ora
   * «Correggi» chiede al backend cosa si può fare **per quella causa** e lo mostra con scritto
   * cosa succede: un pulsante che cambia il piano di una persona deve dirlo prima di essere
   * premuto, non dopo.
   */
  const [azioni, setAzioni] = useState<AzioniDecisione | null>(null);
  const [azioneInCorso, setAzioneInCorso] = useState(false);
  const [notaAzione, setNotaAzione] = useState('');

  async function apriAzioni(id: string) {
    setError(null);
    try {
      setAzioni(await api<AzioniDecisione>(`/nutritionist/decisions/${id}/azioni`));
      setNotaAzione('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non riesco a leggere le azioni disponibili.');
    }
  }

  async function eseguiAzione(azione: string) {
    if (!azioni) return;
    setAzioneInCorso(true);
    try {
      await api(`/nutritionist/decisions/${azioni.decisionId}/azione`, {
        method: 'POST',
        body: JSON.stringify({ azione, note: notaAzione.trim() || undefined }),
      });
      setNotice(
        azione === 'blocca_piano'
          ? 'Piano messo in pausa: i giorni nuovi non partono, quelli già ricevuti restano alla cliente.'
          : 'Autorizzazione registrata: il calcolo del calo riparte da adesso.',
      );
      setAzioni(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setAzioneInCorso(false);
    }
  }

  if (loading) return <Spinner />;

  const hello = (user?.firstName && user.firstName.trim()) || 'Dottoressa';

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Ciao {hello} 👋</h1>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

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

      <div className="card-row" style={{ marginTop: 16, alignItems: 'flex-start' }}>
        {/* Coda di validazione */}
        {pref.attivo('b_da_validare') && (
        <div className="card" style={{ margin: 0, flex: 1.3 }}>
          <h2 style={{ marginTop: 0 }}>Da validare</h2>

          <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0' }}>Decisioni del motore ({conteggio(queue?.counts.engineDecisions ?? 0, queue?.mostrati?.engineDecisions ?? queue?.engineDecisions.length ?? 0)})</h3>
          {(!queue || queue.engineDecisions.length === 0) ? (
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Nessuna decisione da rivedere.</div>
          ) : (
            queue.engineDecisions.slice(0, 8).map((d) => (
              <div key={d.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <b style={{ fontSize: 14 }}>
                    {d.patientName ? <Link to={`/clienti/${d.clientId}`} className="link">{d.patientName}</Link> : 'Paziente'}
                  </b>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {d.date}
                    {d.causaEtichetta && ` · ${d.causaEtichetta}`}
                    {d.rule?.name && ` · ${d.rule.name}`}
                    {d.flagReason && ` · ${d.flagReason}`}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => reviewDecision(d.id, 'confirm')}>Conferma</button>
                  <button className="btn ghost sm" onClick={() => void apriAzioni(d.id)}>Correggi…</button>
                </div>
              </div>
            ))
          )}

          {queue && queue.dietsInReview.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '14px 0 4px' }}>Diete in revisione ({conteggio(queue.counts.dietsInReview, queue.mostrati?.dietsInReview ?? queue.dietsInReview.length)})</h3>
              {queue.dietsInReview.map((d) => (
                <div key={d.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  {/* Lo stile è stato tolto l'11/8: qui accanto al nome non aggiungeva niente
                      («Pescetariana · mediterranean») e ripeteva un dato che non identifica la
                      dieta. Il regime invece sì: dice se è onnivora, vegetariana o vegana. */}
                  <span><b>{d.name}</b> <span className="muted" style={{ fontSize: 12 }}>({d.regime})</span></span>
                  <Link className="btn ghost sm" to="/diete">Apri</Link>
                </div>
              ))}
            </>
          )}

          {queue && queue.protocolsPending.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, color: 'var(--muted)', margin: '14px 0 4px' }}>Protocolli in attesa ({conteggio(queue.counts.protocolsPending, queue.mostrati?.protocolsPending ?? queue.protocolsPending.length)})</h3>
              {queue.protocolsPending.map((p) => (
                <div key={p.id} className="spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span><b>{p.name}</b> <span className="muted" style={{ fontSize: 12 }}>({p.type})</span></span>
                  <Link className="btn ghost sm" to="/protocolli">Apri</Link>
                </div>
              ))}
            </>
          )}
        </div>
        )}

        {/* Pazienti che richiedono attenzione */}
        {pref.attivo('b_pazienti') && (
        <div className="card" style={{ margin: 0, flex: 1 }}>
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

      {/*
        LA FINESTRA DI «CORREGGI». Le azioni arrivano dal backend perché dipendono dalla causa.
        «Apri la scheda» e «Scrivi in chat» sono rimandi: portano dove quelle cose vivono già, coi
        loro permessi. Non si reimplementano qui — una seconda strada per cambiare la dieta, con
        controlli diversi, è il modo in cui nascono i buchi.
      */}
      {azioni && (
        <Modal title={azioni.causaEtichetta ?? 'Cosa vuoi fare'} onClose={() => setAzioni(null)}>
          {azioni.flagReason && (
            <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 0, color: 'var(--ink)' }}>{azioni.flagReason}</p>
          )}
          {azioni.pianoGiaFermo && (
            <Banner kind="info">
              Il piano di questa cliente è <b>già fermo</b>: i giorni nuovi non partono. Si riattiva dalla
              sua scheda.
            </Banner>
          )}
          {azioni.calcoloGiaAzzeratoIl && (
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              Il calcolo del calo è già stato azzerato il{' '}
              {new Date(azioni.calcoloGiaAzzeratoIl).toLocaleDateString('it-IT')}.
            </div>
          )}

          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {azioni.azioni.map((a) => (
              <div key={a.azione} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 11 }}>
                <div className="spread" style={{ gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 14 }}>{a.etichetta}</b>
                    <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 3 }}>{a.cosaFa}</div>
                  </div>
                  {a.eseguitaDalServer ? (
                    <button
                      className={a.azione === 'blocca_piano' ? 'btn ghost sm' : 'btn sm'}
                      disabled={azioneInCorso || (a.azione === 'blocca_piano' && azioni.pianoGiaFermo)}
                      onClick={() => void eseguiAzione(a.azione)}
                    >
                      {a.azione === 'blocca_piano' && azioni.pianoGiaFermo ? 'Già fermo' : 'Fai questo'}
                    </button>
                  ) : (
                    <Link
                      className="btn ghost sm"
                      to={a.azione === 'apri_scheda' ? `/clienti/${azioni.clientId}` : `/chat?cliente=${azioni.clientId}`}
                      onClick={() => setAzioni(null)}
                    >
                      Vai
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/*
            La nota è facoltativa ma sta SOPRA i pulsanti: se fosse dopo, si scriverebbe dopo aver
            già premuto. Finisce nell'audit e, per il blocco, è il motivo che resta scritto sul
            piano — cioè quello che leggerà chi troverà quel piano fermo fra tre giorni.
          */}
          <label style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
            Nota (facoltativa, resta nello storico)
            <textarea
              className="input"
              rows={2}
              value={notaAzione}
              maxLength={1000}
              onChange={(e) => setNotaAzione(e.target.value)}
              placeholder="Es. la sento domani in televisita"
              style={{ marginTop: 4 }}
            />
          </label>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setAzioni(null)}>Chiudi</button>
          </div>
        </Modal>
      )}
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
