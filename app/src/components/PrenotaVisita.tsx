import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import Sheet from './Sheet';

/**
 * §16.7 — PRENOTARE LA VISITA DALL'APP.
 *
 * Prende il posto del cartello «la prenotazione diretta sta arrivando»: da oggi la cliente sceglie
 * l'orario da sola fra quelli che la SUA nutrizionista ha aperto nella settimana tipo.
 *
 * ## Tre scelte che sembrano di grafica e non lo sono
 *
 * 1. **Il credito si dice sempre, anche quando è zero, e prima degli orari.** Mostrare un
 *    calendario pieno di orari a chi non ha una visita da usare è farle scegliere il martedì alle 10
 *    per poi dirle di no quando preme: il rifiuto va detto prima di far fare la fatica, non dopo.
 * 2. **I giorni senza orari liberi non si disegnano affatto.** Quindici caselle grigie sono
 *    quindici piccoli no; le date che restano sono tutte cliccabili.
 * 3. **Gli errori del server si mostrano parola per parola.** Sono scritti in italiano e dicono già
 *    cosa fare («questo orario è appena stato preso», «scrivi alla tua coach»): riassumerli in
 *    «Errore» butterebbe via l'unica cosa utile.
 */

interface Orario {
  slotId: string;
  data: string; // YYYY-MM-DD
  inizio: string; // HH:MM
  fine: string;
  tipo: string;
  festivita: string | null;
}

interface Disponibilita {
  nutrizionista: { nome: string } | null;
  credito: { disponibili: number; acquistate: number; usate: number };
  orari: Orario[];
  messaggio: string | null;
}

const TIPO: Record<string, string> = { in_person: 'In presenza', televisit: 'Televisita' };

const giorno = (data: string): string => {
  const d = new Date(`${data}T12:00:00`);
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function PrenotaVisita({
  onClose,
  onFatto,
  /** Se c'è, invece di prenotare si SPOSTA questo appuntamento. */
  spostaVisitId,
}: {
  onClose: () => void;
  onFatto: () => void;
  spostaVisitId?: string;
}) {
  const [d, setD] = useState<Disponibilita | null>(null);
  const [scelto, setScelto] = useState<Orario | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fatto, setFatto] = useState<string | null>(null);

  useEffect(() => {
    api<Disponibilita>('/me/visite/disponibilita')
      .then(setD)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Non riesco a leggere gli orari.'));
  }, []);

  const conferma = async () => {
    if (!scelto) return;
    setBusy(true);
    setErr(null);
    try {
      const corpo = JSON.stringify({ slotId: scelto.slotId, data: scelto.data });
      const rotta = spostaVisitId ? `/me/visite/${spostaVisitId}/sposta` : '/me/visite/prenota';
      await api(rotta, { method: 'POST', body: corpo });
      setFatto(`${giorno(scelto.data)} alle ${scelto.inizio}`);
      onFatto();
    } catch (e) {
      // Il testo del server è già la spiegazione: si mostra quello.
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Non è riuscita.');
      // L'orario può essere stato preso da un'altra nel frattempo: si ricarica la lista, così
      // quello che non c'è più sparisce invece di restare lì da riprovare.
      api<Disponibilita>('/me/visite/disponibilita').then(setD).catch(() => undefined);
      setScelto(null);
    } finally {
      setBusy(false);
    }
  };

  if (fatto) {
    return (
      <Sheet onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <span className="event-ic" style={{ background: '#DCF0D8', color: '#3B6D11', margin: '0 auto 10px' }}>
            <i className="ti ti-calendar-check" />
          </span>
          <b style={{ fontSize: 15, display: 'block' }}>{spostaVisitId ? 'Appuntamento spostato' : 'Appuntamento fissato'}</b>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {fatto}. Ti arriva l'email di conferma, e un promemoria 20 minuti prima.
          </p>
          <button className="btn" onClick={onClose}>Va bene</button>
        </div>
      </Sheet>
    );
  }

  const perGiorno = new Map<string, Orario[]>();
  for (const o of d?.orari ?? []) {
    const lista = perGiorno.get(o.data) ?? [];
    lista.push(o);
    perGiorno.set(o.data, lista);
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span className="event-ic" style={{ background: '#EAF6F1', color: '#0E7C66' }}>
          <i className="ti ti-calendar-plus" />
        </span>
        <b style={{ fontSize: 15 }}>{spostaVisitId ? 'Sposta l\'appuntamento' : 'Prenota la visita'}</b>
      </div>

      {!d && !err && <p className="muted" style={{ fontSize: 13 }}>Sto guardando gli orari liberi…</p>}

      {d && (
        <>
          {d.nutrizionista && (
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
              Con <b>{d.nutrizionista.nome}</b>
              {!spostaVisitId && d.credito.disponibili > 0 && (
                <> · ti {d.credito.disponibili === 1 ? 'resta 1 visita' : `restano ${d.credito.disponibili} visite`}</>
              )}
            </p>
          )}

          {/* Il no si dice qui, prima di far scegliere un orario. */}
          {d.messaggio && !spostaVisitId && (
            <div className="card" style={{ background: '#FDECC8', boxShadow: 'none', padding: 11, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#8A5A00' }}>{d.messaggio}</span>
            </div>
          )}

          {d.nutrizionista && (spostaVisitId || d.credito.disponibili > 0) && (
            perGiorno.size === 0 ? (
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                Non ci sono orari liberi nei prossimi trenta giorni. Scrivi alla tua coach: trova lei
                uno spazio. 💚
              </p>
            ) : (
              <div style={{ maxHeight: '46vh', overflowY: 'auto', margin: '0 -2px' }}>
                {[...perGiorno.entries()].map(([data, orari]) => (
                  <div key={data} style={{ marginBottom: 12 }}>
                    <div className="sec" style={{ margin: '0 2px 6px', textTransform: 'capitalize' }}>
                      {giorno(data)}
                      {orari[0].festivita && (
                        <span className="muted" style={{ fontWeight: 400 }}> · {orari[0].festivita}</span>
                      )}
                    </div>
                    <div className="pill-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                      {orari.map((o) => (
                        <button
                          key={`${o.slotId}|${o.data}`}
                          className={`pill${scelto?.slotId === o.slotId && scelto?.data === o.data ? ' on' : ''}`}
                          onClick={() => setScelto(o)}
                        >
                          {o.inizio}
                          <span className="muted" style={{ fontSize: 10 }}> · {TIPO[o.tipo] ?? o.tipo}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {err && (
        <div className="card" style={{ background: '#FBE0DE', boxShadow: 'none', padding: 11, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: '#B3261E' }}>{err}</span>
        </div>
      )}

      {scelto && (
        <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={conferma}>
          <i className="ti ti-check" />{' '}
          {busy ? 'Un attimo…' : `Conferma ${giorno(scelto.data)} alle ${scelto.inizio}`}
        </button>
      )}
    </Sheet>
  );
}
