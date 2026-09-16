import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Modal } from './ui';
import { giorniPerLaCoda, leggiNumeri, notaGiro, percento, testoAccensione, type InvitoPanoramica } from '../lib/invitoGaia';

/**
 * «Invito a Gaia» — pannello nella pagina Marketing (16/9, richiesta di Simone).
 * Ogni giorno N email ai lead in «Nuovo contatto», promemoria dopo X giorni, avviso alla coach
 * quando entrano. Il motore sta nel backend (`marketing/invito-gaia`); qui si accende e si guarda.
 */
export default function InvitoGaia() {
  const [p, setP] = useState<InvitoPanoramica | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [bozza, setBozza] = useState({ alGiorno: '', promemoriaGiorni: '', oraDa: '', oraA: '' });
  const [emailProva, setEmailProva] = useState('');

  function carica() {
    api<InvitoPanoramica>('/marketing/invito-gaia')
      .then((o) => {
        setP(o);
        setBozza({
          alGiorno: String(o.impostazioni.alGiorno),
          promemoriaGiorni: String(o.impostazioni.promemoriaGiorni),
          oraDa: String(o.impostazioni.oraDa),
          oraA: String(o.impostazioni.oraA),
        });
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Impossibile caricare l’invito a Gaia.'));
  }
  useEffect(carica, []);

  async function salva(corpo: Record<string, unknown>, ok: string): Promise<boolean> {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api('/marketing/invito-gaia', { method: 'PATCH', body: JSON.stringify(corpo) });
      setMsg(ok);
      carica();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Salvataggio non riuscito.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function accendi() {
    setConferma(false);
    if (!(await salva({ attivo: true }, 'Invito acceso: il primo giro parte subito, poi ogni quarto d’ora.'))) return;
    setBusy(true);
    try {
      const g = await api<{ inviti: number; promemoria: number; nota: string | null }>('/marketing/invito-gaia/giro', { method: 'POST' });
      setMsg(`Invito acceso. Primo giro: ${g.inviti} inviti, ${g.promemoria} promemoria (${notaGiro(g.nota)}).`);
      carica();
    } catch {
      /* il cron del quarto d'ora lo farà */
    } finally {
      setBusy(false);
    }
  }

  function salvaNumeri() {
    const letti = leggiNumeri(bozza);
    if (!letti.ok) { setErr(letti.errore); setMsg(null); return; }
    void salva(letti.valori, 'Impostazioni salvate.');
  }

  async function prova() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api('/marketing/invito-gaia/prova', { method: 'POST', body: JSON.stringify({ email: emailProva.trim() }) });
      setMsg(`Le due email di prova sono partite verso ${emailProva.trim()}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invio di prova non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  if (!p) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>✨ Invito a Gaia</h2>
        {err ? <div className="banner err">{err}</div> : <div className="muted">Caricamento…</div>}
      </div>
    );
  }

  const s = p.impostazioni;
  const c = p.conteggi;
  const giorni = giorniPerLaCoda(c.inCoda, s.alGiorno);
  const tessere: [string, string, string?][] = [
    ['Inviti mandati', String(c.inviati), `oggi ${c.oggi} su ${s.alGiorno}`],
    ['Hanno cliccato', String(c.cliccati), percento(c.cliccati, c.inviati)],
    ['Sono entrate', String(c.entrati), percento(c.entrati, c.inviati)],
    ['Promemoria', String(c.promemoria), `dopo ${s.promemoriaGiorni} giorni`],
    ['In coda', String(c.inCoda), giorni != null ? `circa ${giorni} giorni al ritmo attuale` : 'invio fermo'],
    ['Non inviabili', String(c.scartati + c.falliti), `${c.scartati} scartati · ${c.falliti} falliti`],
  ];

  return (
    <div className="card" style={{ borderTop: '4px solid #6c4fe0' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>✨ Invito a Gaia</h2>
        <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={s.attivo}
            disabled={busy}
            onChange={(e) => (e.target.checked ? setConferma(true) : void salva({ attivo: false }, 'Invito spento: non parte più niente.'))}
          />
          <span style={{ fontWeight: 600, color: s.attivo ? '#6c4fe0' : 'var(--muted)' }}>{s.attivo ? 'Invio attivo' : 'Invio spento'}</span>
        </label>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Ogni giorno un’email di invito a provare Gaia ai lead in «Nuovo contatto» senza account, dal più recente, con il link
        per scegliere la password e quello per cancellarsi. Chi si è disiscritto o ha negato il consenso non la riceve.
        Dopo {s.promemoriaGiorni} giorni chi non è entrata riceve un solo promemoria. Quando una lead entra, la sua coach
        riceve un avviso (la manager, se non ha coach).
      </p>

      {p.obbligoConsenso && (
        <div className="banner err" style={{ margin: '8px 0' }}>
          Il parametro «marketing_require_consent» è acceso: partono inviti solo ai lead con consenso marketing esplicito.
        </div>
      )}
      {p.modelliSpenti.length > 0 && (
        <div className="banner err" style={{ margin: '8px 0' }}>
          Uno dei due modelli email è disattivato ({p.modelliSpenti.join(', ')}): quelle email non partono. Si riattiva da <Link to="/email-modelli">Modelli email</Link>.
        </div>
      )}
      {msg && <div className="banner ok" style={{ margin: '8px 0' }}>{msg}</div>}
      {err && <div className="banner err" style={{ margin: '8px 0' }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 10 }}>
        {tessere.map(([t, v, sotto]) => (
          <div key={t} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', background: 'var(--card)' }}>
            <div className="muted" style={{ fontSize: 11 }}>{t}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
            {sotto && <div className="muted" style={{ fontSize: 11 }}>{sotto}</div>}
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'flex-end' }}>
        {([
          ['alGiorno', 'Email al giorno'],
          ['promemoriaGiorni', 'Promemoria dopo (giorni)'],
          ['oraDa', 'Dalle ore'],
          ['oraA', 'Alle ore'],
        ] as const).map(([k, l]) => (
          <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            <span className="muted">{l}</span>
            <input className="input" style={{ width: 120 }} inputMode="numeric" value={bozza[k]} onChange={(e) => setBozza((b) => ({ ...b, [k]: e.target.value }))} />
          </label>
        ))}
        <button className="btn ghost" disabled={busy} onClick={salvaNumeri}>Salva</button>
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 14, alignItems: 'center' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="La tua email per la prova" value={emailProva} onChange={(e) => setEmailProva(e.target.value)} />
        <button className="btn ghost" disabled={busy || !emailProva.includes('@')} onClick={prova}><i className="ti ti-send" /> Mandami le due email di prova</button>
        <Link to="/email-modelli" className="muted" style={{ fontSize: 12 }}>Modifica i testi («Invito a provare Gaia» e «Promemoria») →</Link>
      </div>

      <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
        {p.ultimoInvio ? <>Ultimo invito partito: {new Date(p.ultimoInvio).toLocaleString('it-IT')}. </> : <>Nessun invito ancora partito. </>}
        Gli scartati sono lead senza un indirizzo valido, doppioni, già registrati o che hanno detto no: escono dalla coda.
      </p>

      {conferma && (
        <Modal title="Accendere l’invito a Gaia?" onClose={() => setConferma(false)}>
          <p style={{ marginTop: 0 }}>{testoAccensione(p)}</p>
          <p className="muted" style={{ fontSize: 12 }}>Consiglio: prima manda a te le due email di prova e controllale.</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setConferma(false)}>Annulla</button>
            <button className="btn" onClick={() => void accendi()}><i className="ti ti-sparkles" /> Accendi</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
