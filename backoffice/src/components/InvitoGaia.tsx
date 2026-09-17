import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Modal } from './ui';
import {
  ELENCHI,
  dataBreve,
  giorniPerLaCoda,
  leggiNumeri,
  linkScheda,
  notaGiro,
  pagineTotali,
  percento,
  testoAccensione,
  urlElenco,
  type Elenco,
  type InvitoPanoramica,
  type TipoElenco,
} from '../lib/invitoGaia';

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
  const [aperto, setAperto] = useState<TipoElenco | null>(null);

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
  const tessere: [TipoElenco, string, string, string?][] = [
    ['inviati', 'Inviti mandati', String(c.inviati), `oggi ${c.oggi} su ${s.alGiorno}`],
    ['cliccati', 'Hanno cliccato', String(c.cliccati), percento(c.cliccati, c.inviati)],
    ['entrati', 'Sono entrate', String(c.entrati), percento(c.entrati, c.inviati)],
    ['promemoria', 'Promemoria', String(c.promemoria), `dopo ${s.promemoriaGiorni} giorni`],
    ['coda', 'In coda', String(c.inCoda), giorni != null ? `circa ${giorni} giorni al ritmo attuale` : 'invio fermo'],
    ['scartati', 'Non inviabili', String(c.scartati + c.falliti), `${c.scartati} scartati · ${c.falliti} falliti`],
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
        {tessere.map(([tipo, t, v, sotto]) => (
          <button
            key={tipo}
            type="button"
            className="tessera-invito"
            onClick={() => setAperto(tipo)}
            title={`Apri l’elenco: ${t.toLowerCase()}`}
          >
            <div className="muted" style={{ fontSize: 11 }}>{t} <i className="ti ti-list-details" style={{ fontSize: 12 }} /></div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
            {sotto && <div className="muted" style={{ fontSize: 11 }}>{sotto}</div>}
          </button>
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

      {aperto && <ElencoInvito tipo={aperto} onClose={() => setAperto(null)} />}

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

/**
 * L'elenco dietro una casella (17/9): nome, cognome, email, la data che quella casella conta e il
 * pulsante per la scheda. A pagine da 50, con la ricerca per nome o email. Negli inviti si può
 * restringere a quelli di oggi.
 */
function ElencoInvito({ tipo: tipoIniziale, onClose }: { tipo: TipoElenco; onClose: () => void }) {
  const [tipo, setTipo] = useState<TipoElenco>(tipoIniziale);
  const [pagina, setPagina] = useState(1);
  const [cerca, setCerca] = useState('');
  const [cercaAttiva, setCercaAttiva] = useState('');
  const [dati, setDati] = useState<Elenco | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  // La ricerca parte quando si smette di scrivere, e riporta alla prima pagina.
  useEffect(() => {
    const t = setTimeout(() => { setCercaAttiva(cerca); setPagina(1); }, 350);
    return () => clearTimeout(t);
  }, [cerca]);

  useEffect(() => {
    let vivo = true;
    setCaricando(true);
    setErrore(null);
    api<Elenco>(urlElenco(tipo, pagina, cercaAttiva))
      .then((d) => { if (vivo) setDati(d); })
      .catch((e) => { if (vivo) setErrore(e instanceof Error ? e.message : 'Elenco non disponibile.'); })
      .finally(() => { if (vivo) setCaricando(false); });
    return () => { vivo = false; };
  }, [tipo, pagina, cercaAttiva]);

  const info = ELENCHI[tipo];
  const pagine = dati ? pagineTotali(dati.totale, dati.perPagina) : 1;
  const conMotivo = tipo === 'scartati' || tipo === 'oggi';

  return (
    <Modal title={`${info.titolo}${dati ? ` · ${dati.totale.toLocaleString('it-IT')}` : ''}`} onClose={onClose} wide>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Cerca per nome, cognome o email"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          autoFocus
        />
        {(tipo === 'inviati' || tipo === 'oggi') && (
          <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={tipo === 'oggi'} onChange={(e) => { setTipo(e.target.checked ? 'oggi' : 'inviati'); setPagina(1); }} />
            Solo oggi
          </label>
        )}
      </div>

      {errore && <div className="banner err" style={{ marginBottom: 8 }}>{errore}</div>}

      <div style={{ overflowX: 'auto', opacity: caricando ? 0.55 : 1, transition: 'opacity .15s' }}>
        <table className="grid">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cognome</th>
              <th>Email</th>
              <th>{info.colonnaData}</th>
              {conMotivo && <th>Motivo</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {dati?.righe.map((r) => (
              <tr key={r.recordId}>
                <td>{r.nome || <span className="muted">—</span>}</td>
                <td>{r.cognome || <span className="muted">—</span>}</td>
                <td style={{ wordBreak: 'break-all' }}>{r.email || <span className="muted">—</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{dataBreve(r.quando)}</td>
                {conMotivo && <td className="muted" style={{ fontSize: 12 }}>{r.motivo ?? ''}</td>}
                <td style={{ textAlign: 'right' }}>
                  <Link to={linkScheda(r)} className="btn ghost sm" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }} onClick={onClose}>
                    Scheda <i className="ti ti-arrow-right" />
                  </Link>
                </td>
              </tr>
            ))}
            {dati && dati.righe.length === 0 && !caricando && (
              <tr><td colSpan={conMotivo ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                {cercaAttiva.trim().length >= 2 ? 'Nessun risultato per questa ricerca.' : info.vuoto}
              </td></tr>
            )}
            {!dati && caricando && (
              <tr><td colSpan={conMotivo ? 6 : 5} className="muted" style={{ textAlign: 'center', padding: 24 }}>Caricamento…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 12 }}>Pagina {pagina} di {pagine}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost sm" disabled={caricando || pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>‹ Precedente</button>
          <button className="btn ghost sm" disabled={caricando || pagina >= pagine} onClick={() => setPagina((p) => p + 1)}>Successiva ›</button>
          <button className="btn sm" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </Modal>
  );
}
