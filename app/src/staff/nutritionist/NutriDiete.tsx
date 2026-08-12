import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import Sheet from '../../components/Sheet';
import { fullName, shortDate } from '../format';
import { useApi, useAction } from '../hooks';
import { Async, Card, Empty, Section, StaffShell } from '../ui';
import { NUTRI_TABS } from '../tabs';

interface Decision {
  id: string;
  clientId: string;
  patientName: string | null;
  date: string;
  flagReason: string | null;
  rule: { id: string; name: string } | null;
}
/**
 * §15.2 punto 2 — le azioni ammesse PER QUELLA CAUSA, decise dal server.
 *
 * ⚠️ Quali siano non lo decide questa schermata: `azioneAmmessa` sul backend rifiuta un'azione che
 * non appartiene alla causa. Qui si disegna quello che il server ha detto, e basta: una seconda
 * lista scritta a mano nel telefono sarebbe la stessa regola in due posti, e fra un mese sarebbero
 * due regole diverse.
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
  protocolsPending: { id: string; name: string; type: string }[];
  counts: { engineDecisions: number; dietsInReview: number; protocolsPending: number };
}
interface DietRow {
  id: string;
  name: string;
  regime: string;
  style: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
}

const DIET_STATUS: Record<DietRow['status'], [string, string, string]> = {
  approved: ['#DCF0D8', '#3B6D11', 'Approvata'],
  in_review: ['#FDF3DD', '#B8863B', 'In revisione'],
  draft: ['#F2F5F4', '#8A938F', 'Bozza'],
  rejected: ['#FBE3E3', '#B4491F', 'Rifiutata'],
};

export default function NutriDiete() {
  const nav = useNavigate();
  const queue = useApi<Queue>('/nutritionist/validation-queue');
  const diets = useApi<DietRow[]>('/diets');
  const [decide, decState] = useAction(async (id: string, action: 'confirm' | 'correct') => {
    await api(`/nutritionist/decisions/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) });
  });

  async function run(id: string, action: 'confirm' | 'correct') {
    const ok = await decide(id, action);
    if (ok) queue.reload();
  }

  /**
   * ⚠️ «CORREGGI» APRE LE AZIONI, ANCHE DAL TELEFONO.
   *
   * La finestra esisteva solo nel backoffice: qui «Correggi» continuava a scrivere l'esito e basta
   * — cioè esattamente il difetto che la domanda di Nocanty («cosa fanno questi due pulsanti?»)
   * aveva fatto emergere, rimasto in piedi proprio sulla schermata da cui lei guarda la coda. Un
   * pulsante che cambia il piano di una persona deve dire cosa fa **prima** di essere premuto.
   */
  const [azioni, setAzioni] = useState<AzioniDecisione | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function apriAzioni(id: string) {
    setErrore(null);
    try {
      setAzioni(await api<AzioniDecisione>(`/nutritionist/decisions/${id}/azioni`));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riesco a leggere le azioni disponibili.');
    }
  }

  async function esegui(azione: string) {
    if (!azioni) return;
    setInCorso(true);
    setErrore(null);
    try {
      await api(`/nutritionist/decisions/${azioni.decisionId}/azione`, {
        method: 'POST',
        body: JSON.stringify({ azione }),
      });
      setEsito(
        azione === 'blocca_piano'
          ? 'Piano messo in pausa: i giorni nuovi non partono, quelli già ricevuti restano alla cliente.'
          : 'Autorizzazione registrata: il calcolo del calo riparte da adesso.',
      );
      setAzioni(null);
      queue.reload();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Operazione non riuscita.');
    } finally {
      setInCorso(false);
    }
  }

  function vai(azione: string, clientId: string) {
    setAzioni(null);
    nav(azione === 'apri_scheda' ? `/pazienti/${clientId}` : `/chat?cliente=${clientId}`);
  }

  return (
    <StaffShell title="Diete e protocolli" tabs={NUTRI_TABS}>
      {esito && (
        <Card>
          <div style={{ fontSize: 13, color: '#3B6D11' }}>{esito}</div>
        </Card>
      )}
      {errore && (
        <Card>
          <div style={{ fontSize: 13, color: '#B3261E' }}>{errore}</div>
        </Card>
      )}
      <Async state={queue}>
        {(q) => (
          <>
            <Section title="Decisioni del motore da validare" />
            {q.engineDecisions.length === 0 ? (
              <Card>
                <div className="sf-sub">Nessuna decisione in attesa. ✅</div>
              </Card>
            ) : (
              <Card className="pad0">
                {q.engineDecisions.map((dec) => (
                  <div key={dec.id} className="sf-alert" style={{ flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div className="sf-alert-t">{fullName(dec.patientName)}</div>
                      <div className="sf-alert-d">
                        {dec.rule?.name || 'Adattamento menu'}
                        {dec.flagReason ? ` · ${dec.flagReason}` : ''}
                      </div>
                      <div className="sf-sub" style={{ marginTop: 3 }}>
                        {shortDate(dec.date)}
                      </div>
                    </div>
                    <div className="sf-acts">
                      <button
                        className="sf-mini b"
                        disabled={decState.loading}
                        onClick={() => run(dec.id, 'confirm')}
                      >
                        <i className="ti ti-check" /> Conferma
                      </button>
                      <button
                        className="sf-mini"
                        disabled={decState.loading}
                        onClick={() => void apriAzioni(dec.id)}
                      >
                        <i className="ti ti-edit" /> Correggi
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {q.protocolsPending.length > 0 && (
              <>
                <Section title="Protocolli da validare" />
                <Card className="pad0">
                  {q.protocolsPending.map((pr) => (
                    <div key={pr.id} className="sf-row" style={{ cursor: 'default' }}>
                      <div className="sf-row-main">
                        <div className="sf-row-name">{pr.name}</div>
                        <div className="sf-row-sub">{pr.type}</div>
                      </div>
                      <span className="sf-pill" style={{ background: '#FDF3DD', color: '#B8863B' }}>
                        In attesa
                      </span>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </Async>

      <Section title="Catalogo diete" />
      <Async state={diets} empty={<Empty icon="ti-salad" text="Nessuna dieta in catalogo." />}>
        {(list) =>
          list.length === 0 ? (
            <Empty icon="ti-salad" text="Nessuna dieta in catalogo." />
          ) : (
            <Card className="pad0">
              {list.map((d) => {
                const s = DIET_STATUS[d.status] ?? DIET_STATUS.draft;
                return (
                  <div key={d.id} className="sf-row" style={{ cursor: 'default' }}>
                    <div className="sf-row-main">
                      <div className="sf-row-name">{d.name}</div>
                      <div className="sf-row-sub">
                        {d.regime} · {d.style}
                      </div>
                    </div>
                    <span className="sf-pill" style={{ background: s[0], color: s[1] }}>
                      {s[2]}
                    </span>
                  </div>
                );
              })}
            </Card>
          )
        }
      </Async>
      <div className="sf-sub" style={{ textAlign: 'center', margin: '10px 4px 0' }}>
        Le diete vanno approvate dal nutrizionista capo prima di entrare in catalogo.
      </div>
      {azioni && (
        <Sheet onClose={() => setAzioni(null)}>
          <b style={{ fontSize: 15 }}>{azioni.causaEtichetta ?? 'Cosa vuoi fare'}</b>
          {azioni.flagReason && (
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{azioni.flagReason}</p>
          )}
          {/* Offrire «Blocca il piano» a un piano già bloccato è il modo più rapido per far
              credere che il pulsante non funzioni. */}
          {azioni.pianoGiaFermo && (
            <div className="card" style={{ background: '#FDECC8', boxShadow: 'none', padding: 11 }}>
              <span style={{ fontSize: 12, color: '#8A5A00' }}>
                Il piano di questa cliente è <b>già fermo</b>: i giorni nuovi non partono. Si riattiva
                dalla sua scheda.
              </span>
            </div>
          )}
          {azioni.calcoloGiaAzzeratoIl && (
            <div className="muted" style={{ fontSize: 12 }}>
              Il calcolo del calo è già stato azzerato il{' '}
              {new Date(azioni.calcoloGiaAzzeratoIl).toLocaleDateString('it-IT')}.
            </div>
          )}

          <div style={{ display: 'grid', gap: 9, marginTop: 10 }}>
            {azioni.azioni.map((a) => (
              <div key={a.azione} style={{ border: '1px solid #EEF1F0', borderRadius: 10, padding: 11 }}>
                <b style={{ fontSize: 14 }}>{a.etichetta}</b>
                {/* Cosa succede, scritto prima del tocco e non dopo. */}
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: '3px 0 8px' }}>
                  {a.cosaFa}
                </div>
                {a.eseguitaDalServer ? (
                  <button
                    className="btn sm"
                    disabled={inCorso || (a.azione === 'blocca_piano' && azioni.pianoGiaFermo)}
                    onClick={() => void esegui(a.azione)}
                  >
                    {a.azione === 'blocca_piano' && azioni.pianoGiaFermo ? 'Già fermo' : 'Fai questo'}
                  </button>
                ) : (
                  <button className="btn ghost sm" onClick={() => vai(a.azione, azioni.clientId)}>
                    Vai
                  </button>
                )}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </StaffShell>
  );
}
