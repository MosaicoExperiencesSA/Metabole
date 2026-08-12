import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from './ui';

interface Slot {
  id: string;
  weekday: number | null;
  data: string | null;
  inizio: string;
  fine: string;
  ripete: boolean;
  tipo: string;
  attivo: boolean;
}

interface Ferie {
  id: string;
  dal: string;
  al: string;
  motivo: string | null;
}

interface Libero {
  slotId: string;
  data: string;
  inizio: string;
  fine: string;
  tipo: string;
  festivita: string | null;
}

/** 0 = domenica, come `Date.getDay()`. L'elenco però si legge da lunedì: è la settimana di chi lavora. */
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const ORDINE = [1, 2, 3, 4, 5, 6, 0];

const giornoBreve = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });

/**
 * §16.7 — LA SETTIMANA TIPO DEL NUTRIZIONISTA, e i giorni in cui non riceve.
 *
 * «Il nutrizionista inserisce gli slot in una settimana tipo, esempio lunedì dalle 9 alle 10 poi
 * dalle 10,05 alle 11.10, col flag "si ripete"» (Simone, 12/8).
 *
 * ⚠️ Sta dentro la pagina Agenda visite e non in una sua pagina: gli orari che offre e gli
 * appuntamenti che ne nascono sono la stessa cosa guardata a due giorni di distanza, e separarli
 * vorrebbe dire aprirne due per capire una giornata.
 *
 * Il riquadro non compare a chi non ha una scheda staff (un admin, per esempio): non è un errore da
 * mostrare, è una sezione che per lui non vuol dire niente.
 */
export function SettimanaTipo() {
  const { can } = useAuth();
  const puoGestire = can('visits_agenda', 'manage');
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [ferie, setFerie] = useState<Ferie[]>([]);
  const [liberi, setLiberi] = useState<Libero[]>([]);
  const [senzaAgenda, setSenzaAgenda] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(true);

  const [nuovo, setNuovo] = useState({ weekday: 1, inizio: '09:00', fine: '10:00', ripete: true, data: '', tipo: 'in_person' });
  const [nuoveFerie, setNuoveFerie] = useState({ dal: '', al: '', motivo: '' });

  async function carica() {
    setCaricando(true);
    try {
      const [s, f, l] = await Promise.all([
        api<Slot[]>('/agenda-visite/slot'),
        api<Ferie[]>('/agenda-visite/ferie'),
        api<Libero[]>('/agenda-visite/liberi'),
      ]);
      setSlots(s);
      setFerie(f);
      setLiberi(l);
      setSenzaAgenda(false);
    } catch (err) {
      // 403 = non ha una scheda staff (o non ha il permesso): la sezione sparisce, non urla.
      if (err instanceof ApiError && err.status === 403) setSenzaAgenda(true);
      else setErrore(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setCaricando(false);
    }
  }
  useEffect(() => { void carica(); }, []);

  async function aggiungiSlot() {
    setErrore(null);
    setAvviso(null);
    try {
      await api('/agenda-visite/slot', {
        method: 'POST',
        body: JSON.stringify({
          inizio: nuovo.inizio,
          fine: nuovo.fine,
          ripete: nuovo.ripete,
          tipo: nuovo.tipo,
          ...(nuovo.ripete ? { weekday: nuovo.weekday } : { data: nuovo.data }),
        }),
      });
      setAvviso('Orario aggiunto.');
      void carica();
    } catch (err) {
      // L'errore del server dice CON QUALE orario si accavalla: si mostra così com'è.
      setErrore(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  async function togliSlot(s: Slot) {
    if (!confirm(`Togliere l'orario ${s.inizio}–${s.fine}?`)) return;
    setErrore(null);
    try {
      const r = await api<{ messaggio: string }>(`/agenda-visite/slot/${s.id}`, { method: 'DELETE' });
      setAvviso(r.messaggio);
      void carica();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  async function aggiungiFerie() {
    setErrore(null);
    setAvviso(null);
    if (!nuoveFerie.dal || !nuoveFerie.al) { setErrore('Scegli il primo e l\'ultimo giorno.'); return; }
    try {
      await api('/agenda-visite/ferie', { method: 'POST', body: JSON.stringify(nuoveFerie) });
      setAvviso('Giorni chiusi.');
      setNuoveFerie({ dal: '', al: '', motivo: '' });
      void carica();
    } catch (err) {
      // ⚠️ È qui che arriva «in quel periodo hai N appuntamenti già fissati: …». Il messaggio del
      // server contiene i nomi e le date: mostrarlo intero è tutta l'informazione che serve.
      setErrore(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  async function togliFerie(f: Ferie) {
    if (!confirm(`Riaprire i giorni dal ${f.dal} al ${f.al}?`)) return;
    try {
      await api(`/agenda-visite/ferie/${f.id}`, { method: 'DELETE' });
      void carica();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Non riuscito.');
    }
  }

  if (caricando) return <Spinner />;
  if (senzaAgenda || !slots) return null;

  const perGiorno = ORDINE.map((w) => ({ w, righe: slots.filter((s) => s.ripete && s.weekday === w) }));
  const straordinari = slots.filter((s) => !s.ripete);
  // Le prossime giornate con almeno un orario libero: l'anteprima di quello che vedrà la cliente.
  const prossimi = liberi.slice(0, 24);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="spread" style={{ marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700 }}>La mia settimana tipo</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            Gli orari che offri per le visite. Quelli con «si ripete» valgono tutte le settimane; nei giorni
            di chiusura e nelle festività si chiudono da soli.
          </div>
        </div>
      </div>

      {errore && <Banner kind="err">{errore}</Banner>}
      {avviso && <Banner kind="ok">{avviso}</Banner>}

      <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 2, minWidth: 300 }}>
          {perGiorno.map(({ w, righe }) => (
            <div key={w} className="row" style={{ gap: 8, alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid var(--line,#eee)' }}>
              <div style={{ width: 90, fontSize: 13, fontWeight: 600 }}>{GIORNI[w]}</div>
              <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {righe.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>—</span>}
                {righe.map((s) => (
                  <span key={s.id} className={`chip ${s.attivo ? '' : 'gray'}`} style={{ fontSize: 12 }}>
                    {s.inizio}–{s.fine}
                    {s.tipo === 'televisit' && ' · TV'}
                    {!s.attivo && ' · ritirato'}
                    {puoGestire && (
                      <button
                        onClick={() => togliSlot(s)}
                        title="Togli questo orario"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: 4, padding: 0 }}
                      >×</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {straordinari.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Giornate straordinarie</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {straordinari.map((s) => (
                  <span key={s.id} className={`chip ${s.attivo ? '' : 'gray'}`} style={{ fontSize: 12 }}>
                    {s.data && giornoBreve(s.data)} {s.inizio}–{s.fine}
                    {puoGestire && (
                      <button onClick={() => togliSlot(s)} style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: 4, padding: 0 }}>×</button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {puoGestire && (
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={nuovo.ripete} onChange={(e) => setNuovo((n) => ({ ...n, ripete: e.target.checked }))} />
                Si ripete
              </label>
              {nuovo.ripete ? (
                <select className="input" style={{ width: 130 }} value={nuovo.weekday} onChange={(e) => setNuovo((n) => ({ ...n, weekday: Number(e.target.value) }))}>
                  {ORDINE.map((w) => <option key={w} value={w}>{GIORNI[w]}</option>)}
                </select>
              ) : (
                <input className="input" type="date" style={{ width: 150 }} value={nuovo.data} onChange={(e) => setNuovo((n) => ({ ...n, data: e.target.value }))} />
              )}
              <input className="input" type="time" style={{ width: 110 }} value={nuovo.inizio} onChange={(e) => setNuovo((n) => ({ ...n, inizio: e.target.value }))} />
              <input className="input" type="time" style={{ width: 110 }} value={nuovo.fine} onChange={(e) => setNuovo((n) => ({ ...n, fine: e.target.value }))} />
              <select className="input" style={{ width: 130 }} value={nuovo.tipo} onChange={(e) => setNuovo((n) => ({ ...n, tipo: e.target.value }))}>
                <option value="in_person">In presenza</option>
                <option value="televisit">Televisita</option>
              </select>
              <button className="btn sm" onClick={aggiungiSlot}><i className="ti ti-plus" /> Aggiungi</button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Giorni in cui non ricevo</div>
          {ferie.length === 0 && <div className="muted" style={{ fontSize: 12.5 }}>Nessuno.</div>}
          {ferie.map((f) => (
            <div key={f.id} className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12.5, padding: '2px 0' }}>
              <span>{giornoBreve(f.dal)} → {giornoBreve(f.al)}</span>
              {f.motivo && <span className="muted">· {f.motivo}</span>}
              {puoGestire && (
                <button onClick={() => togliFerie(f)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
              )}
            </div>
          ))}
          {puoGestire && (
            <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <input className="input" type="date" style={{ width: 140 }} value={nuoveFerie.dal} onChange={(e) => setNuoveFerie((f) => ({ ...f, dal: e.target.value }))} />
              <input className="input" type="date" style={{ width: 140 }} value={nuoveFerie.al} onChange={(e) => setNuoveFerie((f) => ({ ...f, al: e.target.value }))} />
              <input className="input" style={{ width: 130 }} placeholder="Motivo" value={nuoveFerie.motivo} onChange={(e) => setNuoveFerie((f) => ({ ...f, motivo: e.target.value }))} />
              <button className="btn ghost sm" onClick={aggiungiFerie}>Chiudi</button>
            </div>
          )}

          {/* L'anteprima: gli stessi orari che vedrà la cliente, dalla stessa funzione. */}
          <div style={{ fontSize: 12.5, fontWeight: 600, margin: '12px 0 4px' }}>Prossimi orari liberi</div>
          {prossimi.length === 0 ? (
            <div className="muted" style={{ fontSize: 12.5 }}>Nessuno nei prossimi 30 giorni.</div>
          ) : (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {prossimi.map((l) => (
                <span key={`${l.slotId}-${l.data}`} className="chip" style={{ fontSize: 11.5 }}>
                  {giornoBreve(l.data)} {l.inizio}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
