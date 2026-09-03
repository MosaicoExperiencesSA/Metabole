import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { euro } from '../format';
import { useApi } from '../hooks';
import { Async, Card, Kpi, Section, StaffShell } from '../ui';
import { NUTRI_TABS } from '../tabs';
import InvitoCard from '../shared/InvitoCard';

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

interface ValidationQueue {
  engineDecisions: { id: string; patientName: string | null; flagReason: string | null; rule: { name: string } | null }[];
  protocolsPending: { id: string; name: string }[];
}

/**
 * Segnalazioni aperte sui suoi pazienti. Il conteggio esisteva già (`openEscalations`), ma
 * serviva solo a gonfiare il badge della campanella: il MOTIVO non compariva da nessuna parte.
 * Così la cliente leggeva «la nutrizionista sta sistemando il tuo menu» e la nutrizionista non
 * sapeva né di doverlo sistemare né perché.
 */
interface Segnalazione {
  id: string;
  clientId: string;
  paziente: string;
  motivo: string;
  categoria: string;
  creata: string;
  /** Se vero la paziente NON sta ricevendo i menu: è l'unica che ferma il servizio. */
  bloccoPiano: boolean;
}

/** Una riga di «Le tue attività»: la forma che rende `GET /staff/coach-tasks`. */
interface Attivita {
  id: string;
  clientId: string;
  kind: string;
  title: string;
  description: string | null;
  dueDate: string;
  /** ⚠️ Lo calcola il backend sul giorno di **Roma**: rifarlo qui darebbe un altro giorno. */
  overdue: boolean;
  clientName: string;
}

export default function NutriDashboard() {
  const nav = useNavigate();
  const dash = useApi<Dash>('/nutritionist/dashboard');
  const queue = useApi<ValidationQueue>('/nutritionist/validation-queue');
  const segn = useApi<{ segnalazioni: Segnalazione[] }>('/nutritionist/escalations');
  /**
   * ⛔ **LE SUE ATTIVITÀ, dal 3/9.** Dal 21/8 quattro tipi nascono addosso a lei — digiuno estremo,
   * finestra non traducibile, pasti non serviti, calorie corte — e la **push le arriva sul
   * telefono**. La sua schermata non le aveva: il 22/8 le era stata aperta la pagina del
   * backoffice, l'app staff no. Una notifica che porta a una schermata che non mostra la cosa
   * notificata è peggio di nessuna notifica.
   *
   * ⚠️ L'endpoint la serve **già** filtrata ai suoi quattro tipi e alle sue clienti
   * (`filtroNutrizionista`): qui non c'è nessun filtro, e non deve essercene uno — due regole per
   * la stessa domanda divergono, e questa decide cosa vede una persona.
   */
  const attivita = useApi<Attivita[]>('/staff/coach-tasks?status=todo&limit=50');
  const [lavoro, setLavoro] = useState<string | null>(null);
  const [esito, setEsito] = useState<{ id: string; ok: boolean; testo: string } | null>(null);

  /**
   * Sblocca davvero: il backend riprova a costruire la base sicura. Chiudere la segnalazione e
   * basta era cosmetico — il blocco si ricalcola a ogni menu e la segnalazione si riapriva
   * identica alla prima apertura dell'app.
   */
  async function sblocca(sg: Segnalazione) {
    setLavoro(sg.id); setEsito(null);
    try {
      const r = await api<{ sbloccato: boolean; messaggio: string; motivi?: string[] }>(
        `/nutritionist/escalations/${sg.id}/sblocca`, { method: 'POST', body: '{}' },
      );
      setEsito({
        id: sg.id,
        ok: r.sbloccato,
        testo: r.messaggio + ((r.motivi ?? []).length ? ` — ${(r.motivi ?? []).join('; ')}` : ''),
      });
      if (r.sbloccato) segn.reload();
    } catch (e) {
      setEsito({ id: sg.id, ok: false, testo: e instanceof Error ? e.message : 'Non riuscito.' });
    } finally {
      setLavoro(null);
    }
  }

  /**
   * ⛔ **CHIUDERLA DEVE POTERLA FARE DA QUI, o la schermata è una vetrina.**
   *
   * Su questi quattro tipi la coach prende 403 (`TIPI_DELLA_NUTRIZIONISTA` in
   * `coach-tasks.service.ts`, regola del 22/8): **è lei l'unica** che può chiuderle. Mostrargliele
   * senza il pulsante voleva dire mandarle una push, farle aprire la Dashboard, e rispedirla nel
   * backoffice per il clic — mentre l'avviso ha appena smesso di dirle dov'è il backoffice.
   * Un'attività che resta `todo` per questo motivo, il giorno dopo `escalateAttivitaScadute` la
   * manda alla manager commerciale: il difetto non sarebbe rimasto in questa pagina.
   *
   * ⚠️ Niente «Salta» qui, al contrario della coach: saltare «digiuno estremo» o «calorie corte»
   * è una decisione clinica, e questa lista è la coda di chi la prende. Si chiude facendola.
   */
  async function chiudiAttivita(id: string) {
    setLavoro(id); setEsito(null);
    try {
      await api(`/staff/coach-tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
      attivita.reload();
    } catch (e) {
      setEsito({ id, ok: false, testo: e instanceof Error ? e.message : 'Non riuscito.' });
    } finally {
      setLavoro(null);
    }
  }

  return (
    <StaffShell
      title="Dashboard"
      subtitle="Nutrizionista"
      tabs={NUTRI_TABS}
      headerBadge={dash.data ? dash.data.pendingDocuments + dash.data.openEscalations : undefined}
    >
      <Async state={dash}>
        {(d) => (
          <>
            <div className="sf-earn-row">
              <div className="sf-earn g1">
                <div className="lab">Guadagno totale</div>
                <div className="val">{euro(d.earningsTotalCents)}</div>
              </div>
              <div className="sf-earn g2">
                <div className="lab">Guadagno del mese</div>
                <div className="val">{euro(d.earningsMonthCents)}</div>
              </div>
            </div>

            <div className="sf-kpi-row">
              <Kpi
                icon="ti-users"
                value={d.patientsCount}
                label="Pazienti"
                bg="#DCEBE3"
                fg="#0E7C66"
                onClick={() => nav('/pazienti')}
              />
              <Kpi
                icon="ti-clipboard-check"
                value={d.protocolsToValidate}
                label="Da validare"
                bg="#E7EEF6"
                fg="#3A6EA5"
                onClick={() => nav('/diete')}
              />
            </div>
            <div className="sf-kpi-row">
              <Kpi
                icon="ti-calendar-heart"
                value={d.upcomingVisits}
                label="Visite oggi"
                bg="#FBEEE7"
                fg="#E8825A"
                onClick={() => nav('/agenda')}
              />
              <Kpi
                icon="ti-file-alert"
                value={d.pendingDocuments}
                label="Documenti"
                bg="#FBE3E3"
                fg="#B4491F"
                onClick={() => nav('/pazienti')}
              />
            </div>

            {/* SEGNALAZIONI, con il motivo per esteso e due sole scelte: sbloccare o scrivere.
                Sta in cima perché un piano bloccato è l'unica cosa in questa pagina per cui
                una paziente, in questo momento, non sta ricevendo i menu. */}
            <Async state={segn}>
              {(sg) => {
                const righe = sg.segnalazioni ?? [];
                if (righe.length === 0) return <></>;
                return (
                  <>
                    <Section title={`Segnalazioni (${righe.length})`} />
                    <Card className="pad0">
                      {righe.slice(0, 8).map((r) => (
                        <div key={r.id} className="sf-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <span style={{ width: 34, height: 34, borderRadius: 11, background: r.bloccoPiano ? '#FBE3E3' : '#FDF6E8', color: r.bloccoPiano ? '#B4491F' : '#8A6D1F', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                            <i className={`ti ${r.bloccoPiano ? 'ti-lock' : 'ti-alert-circle'}`} style={{ fontSize: 18 }} />
                          </span>
                          <div className="sf-row-main" style={{ minWidth: 0 }}>
                            <div className="sf-row-name">
                              {r.paziente}
                              {r.bloccoPiano && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#B4491F' }}>· NON RICEVE I MENU</span>}
                            </div>
                            <div className="sf-row-sub" style={{ whiteSpace: 'normal' }}>{r.motivo}</div>
                            <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
                              <button className="btn ghost sm" disabled={lavoro === r.id}
                                style={{ width: 'auto', padding: '6px 12px', fontSize: 12.5 }}
                                onClick={() => void sblocca(r)}>
                                {lavoro === r.id ? 'Riprovo…' : 'Sblocca il piano'}
                              </button>
                              <button className="btn ghost sm"
                                style={{ width: 'auto', padding: '6px 12px', fontSize: 12.5 }}
                                onClick={() => nav(`/pazienti/${r.clientId}`)}>
                                Apri la scheda
                              </button>
                            </div>
                            {esito?.id === r.id && (
                              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 9, fontSize: 12.5, lineHeight: 1.5, background: esito.ok ? '#EAF6F1' : '#FDF6E8', color: esito.ok ? '#0E7C66' : '#6B4E12' }}>
                                {esito.testo}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </Card>
                  </>
                );
              }}
            </Async>

            {/* ⛔ SOPRA le priorità cliniche: sono le uniche righe di questa pagina che hanno una
                SCADENZA, e per cui a lei è già arrivata una notifica sul telefono.

                ⚠️ **Niente `<Async>` qui, al contrario del resto della pagina.** `@RequirePage`
                legge `coach_tasks` da `role_page_permission`, e finché quella riga è spenta la
                chiamata torna 403: `Async` metterebbe un rettangolo d'errore rosso **senza titolo**
                (il `<Section>` sta dentro i children) fra il questionario e «Priorità cliniche».
                Un 403 previsto non è un guasto da mostrare — la sezione semplicemente non c'è,
                come fa già la dashboard della coach. */}
            {attivita.data && attivita.data.length > 0 && (() => {
              const lista = attivita.data;
              const scadute = lista.filter((a) => a.overdue).length;
              return (
                <>
                  <Section
                    title={`Le tue attività (${lista.length})`}
                    action={scadute > 0
                      ? <span className="sf-sub" style={{ color: '#B4491F', fontWeight: 700 }}>{scadute} in ritardo</span>
                      : undefined}
                  />
                  <Card className="pad0">
                    {/* ⛔ **Si mostrano TUTTE, non le prime N.** La coach ne mostra sei perché il
                        resto lo trova nel backoffice; lei il backoffice l'ha solo se qualcuno le
                        accende la chiave, e l'app staff non ha una pagina «tutte le attività». Un
                        «…e altre 12» senza nessun posto dove andarle a prendere rende falsa la
                        frase della push. ⚠️ L'ordine è `dueDate asc`: l'attività appena
                        notificata (scadenza domani) è **l'ultima** — cioè esattamente quella che
                        un taglio in cima nasconderebbe. */}
                    {lista.map((a) => (
                      <div
                        key={a.id}
                        className="sf-row"
                        style={{ alignItems: 'flex-start' }}
                      >
                        <span style={{ width: 34, height: 34, borderRadius: 11, background: a.overdue ? '#FBE3E3' : '#EAF1FB', color: a.overdue ? '#B4491F' : '#2C5AA0', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                          <i className={`ti ${a.overdue ? 'ti-alarm' : 'ti-checklist'}`} style={{ fontSize: 18 }} />
                        </span>
                        <div
                          className="sf-row-main"
                          style={{ minWidth: 0, cursor: 'pointer' }}
                          onClick={() => nav(`/pazienti/${a.clientId}`)}
                        >
                          <div className="sf-row-name">{a.title}</div>
                          <div className="sf-row-sub" style={{ whiteSpace: 'normal' }}>
                            {/* ⚠️ `clientName` può arrivare stringa vuota (il ripiego del backend
                                usa `??` dopo un `join`, che vuoto non è nullish): senza questo la
                                riga comincerebbe con « · per il 5/9». */}
                            {a.clientName?.trim() || 'Cliente'}
                            {/* ⚠️ La scadenza si scrive SEMPRE, non solo quando è passata: «per il 5
                                settembre» dice cosa fare, «in ritardo» dice solo che è tardi. */}
                            {' · '}
                            <span style={{ color: a.overdue ? '#B4491F' : undefined, fontWeight: a.overdue ? 700 : undefined }}>
                              {a.overdue ? 'scaduta il ' : 'per il '}{a.dueDate.split('-').reverse().join('/')}
                            </span>
                          </div>
                          {esito && esito.id === a.id && !esito.ok && (
                            <div className="sf-row-sub" style={{ color: '#B4491F', whiteSpace: 'normal' }}>{esito.testo}</div>
                          )}
                        </div>
                        <button
                          className="sf-btn g"
                          style={{ flex: 'none', width: 'auto', whiteSpace: 'nowrap', padding: '6px 10px', fontSize: 13 }}
                          disabled={lavoro === a.id}
                          onClick={() => chiudiAttivita(a.id)}
                        >
                          <i className="ti ti-check" /> Fatto
                        </button>
                      </div>
                    ))}
                  </Card>
                </>
              );
            })()}

            <Section
              title="Priorità cliniche"
              action={
                <span className="sf-sub" style={{ cursor: 'pointer' }} onClick={() => nav('/diete')}>
                  Vedi tutte
                </span>
              }
            />
            <Async state={queue}>
              {(q) => {
                const rows = [
                  ...q.engineDecisions.map((e) => ({
                    id: `d-${e.id}`,
                    icon: 'ti-report-medical',
                    bg: '#FBE3E3',
                    fg: '#B4491F',
                    title: e.rule?.name ?? 'Decisione da rivedere',
                    sub: [e.patientName, e.flagReason].filter(Boolean).join(' · ') || 'Da validare',
                  })),
                  ...q.protocolsPending.map((p) => ({
                    id: `p-${p.id}`,
                    icon: 'ti-clipboard-check',
                    bg: '#E7EEF6',
                    fg: '#3A6EA5',
                    title: p.name || 'Protocollo da validare',
                    sub: 'Protocollo in attesa di validazione',
                  })),
                ].slice(0, 5);
                if (rows.length === 0) {
                  return (
                    <Card>
                      <div className="sf-sub" style={{ textAlign: 'center', padding: 8 }}>
                        Nessuna priorità clinica. Ottimo lavoro! 🎉
                      </div>
                    </Card>
                  );
                }
                return (
                  <Card className="pad0">
                    {rows.map((r) => (
                      <div key={r.id} className="sf-row" onClick={() => nav('/diete')} style={{ alignItems: 'flex-start' }}>
                        <span
                          style={{ width: 34, height: 34, borderRadius: 11, background: r.bg, color: r.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
                        >
                          <i className={`ti ${r.icon}`} style={{ fontSize: 18 }} />
                        </span>
                        <div className="sf-row-main">
                          <div className="sf-row-name">{r.title}</div>
                          <div className="sf-row-sub">{r.sub}</div>
                        </div>
                        <i className="ti ti-chevron-right chev" />
                      </div>
                    ))}
                  </Card>
                );
              }}
            </Async>
            {/* Link d'invito: il ref code esisteva ma nell'app dei professionisti non
                c'era nessun posto in cui vederlo, e il link lo si manda dal telefono. */}
            <InvitoCard ruolo="nutrizionista" />
          </>
        )}
      </Async>
    </StaffShell>
  );
}
