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

export default function NutriDashboard() {
  const nav = useNavigate();
  const dash = useApi<Dash>('/nutritionist/dashboard');
  const queue = useApi<ValidationQueue>('/nutritionist/validation-queue');
  const segn = useApi<{ segnalazioni: Segnalazione[] }>('/nutritionist/escalations');
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
