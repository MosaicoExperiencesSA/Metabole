import { dateTime, fullName } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, Card, Empty, StaffShell } from '../ui';
import { COACH_TABS } from '../tabs';

interface Appointment {
  id: string;
  clientId: string;
  clientName: string | null;
  /**
   * §16.7 — da oggi in questa lista ci sono anche le VISITE dal nutrizionista, che stanno in
   * un'altra tabella. Richiesta di Simone del 12/8: la coach deve vedere gli appuntamenti di tutte
   * le sue clienti, non solo quelli che ha preso lei. Va detto quale è quale, o fissa la chiamata
   * mezz'ora prima di una visita credendo la giornata libera.
   */
  fonte?: 'visita' | 'appuntamento' | 'scadenza';
  staffRole?: string;
  staffName?: string | null;
  type: 'call' | 'televisit' | 'in_person' | 'scadenza_visita';
  datetime: string;
  note: string | null;
  /** Riga di tutto il giorno (le scadenze): l'orario dentro `datetime` non vuol dire niente. */
  tuttoIlGiorno?: boolean;
}

/** Il giorno senza l'ora: per le scadenze, dove l'orario è un artefatto del salvataggio. */
function soloGiorno(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

const TYPE: Partial<Record<Appointment['type'], [string, string]>> = {
  call: ['ti-phone', 'Chiamata'],
  televisit: ['ti-video', 'Televisita'],
  in_person: ['ti-map-pin', 'In presenza'],
};

export default function CoachAgenda() {
  const state = useApi<{ appointments: Appointment[] }>('/coach/agenda');
  return (
    <StaffShell title="Agenda" tabs={COACH_TABS}>
      <Async
        state={state}
        empty={<Empty icon="ti-calendar-off" text="Nessun appuntamento in programma." />}
      >
        {(d) => {
          if (d.appointments.length === 0)
            return <Empty icon="ti-calendar-off" text="Nessun appuntamento in programma." />;
          return (
            <Card className="pad0">
              {d.appointments.map((a) => {
                const t = TYPE[a.type] ?? ['ti-calendar', 'Appuntamento'];
                const visita = a.fonte === 'visita';
                /**
                 * ⛔ **Una SCADENZA non è un appuntamento, e non ha un'ora** (23/8). È l'ultimo
                 * giorno utile per la visita di una cliente: da domani i suoi menu si fermano.
                 * Senza questo ramo la riga usciva come «30 set · 02:00 · Appuntamento» — un
                 * incontro che non esiste, a un'ora inventata da un fuso, che qualcuno avrebbe
                 * provato a disdire.
                 */
                if (a.fonte === 'scadenza') {
                  return (
                    <div key={a.id} className="sf-row" style={{ cursor: 'default' }}>
                      <Avatar name={a.clientName} />
                      <div className="sf-row-main">
                        <div className="sf-row-name">{fullName(a.clientName)}</div>
                        <div className="sf-row-sub">
                          <i className="ti ti-alarm" /> Scadenza visita · {soloGiorno(a.datetime)} · tutto il giorno
                        </div>
                        {a.note && <div className="sf-row-sub">{a.note}</div>}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={a.id} className="sf-row" style={{ cursor: 'default' }}>
                    <Avatar name={a.clientName} />
                    <div className="sf-row-main">
                      <div className="sf-row-name">{fullName(a.clientName)}</div>
                      <div className="sf-row-sub">
                        <i className={`ti ${t[0]}`} /> {t[1]} · {dateTime(a.datetime)}
                      </div>
                      <div className="sf-row-sub">
                        {visita
                          ? `Visita col nutrizionista${a.staffName ? ` · ${a.staffName}` : ''}`
                          : a.staffName ?? 'Appuntamento'}
                      </div>
                      {a.note && <div className="sf-row-sub">{a.note}</div>}
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        }}
      </Async>
    </StaffShell>
  );
}
