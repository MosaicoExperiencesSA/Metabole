import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { BottoneExcel, Colonna, ContatoreRighe, useTabella } from '../components/tabella';

/**
 * L'ASSISTENTE DELLA NUTRIZIONISTA — la chat sopra, il registro sotto, sulla stessa schermata.
 *
 * Richiesta di Lucia (12/8): «un sistema che apprende da me in maniera discorsiva». Lei detta a
 * parole — «a Giulia Rossi niente formaggi molli, solo il grana» — e l'assistente traduce in regole
 * vere, mostrandole SEMPRE cosa sta per scrivere prima di scriverlo.
 *
 * ⚠️ Il registro sta **sotto la chat e non in un'altra pagina**, ed è una scelta: è la memoria della
 * conversazione, e serve nel momento in cui si sta lavorando. Ogni riga dice cosa è stato fatto, su
 * chi, in che stato — e cliccandola si rivede **la frase da cui è nata**, che è il modo più rapido
 * per capire perché una regola è venuta storta.
 */

interface Messaggio {
  id: string;
  ruolo: 'nutrizionista' | 'agente';
  testo: string;
  createdAt: string;
}

interface Azione {
  id: string;
  frase: string;
  azione: string;
  ambito: string;
  soggettoNome: string | null;
  dettaglio: unknown;
  stato: string;
  conflittoSanitario: boolean;
  createdAt: string;
}

const AZIONE: Record<string, string> = {
  restrizione_cliente: 'Restrizione',
  sostituzione_cliente: 'Sostituzione',
  variante_cliente: 'Variante di piano',
  ricetta_modificata: 'Ricetta modificata',
  ricetta_nuova: 'Ricetta nuova',
  regola_dieta: 'Regola su una dieta',
};

const STATO: Record<string, string> = {
  attiva: 'Attiva',
  in_approvazione: 'In approvazione',
  annullata: 'Annullata',
  respinta: 'Respinta',
};

const AMBITO: Record<string, string> = { cliente: 'Una cliente', dieta: 'Un tipo di dieta', catalogo: 'Tutte' };

const data = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function Vera() {
  const { can } = useAuth();
  const puoDettare = can('food_swaps', 'manage');

  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [azioni, setAzioni] = useState<Azione[]>([]);
  const [testo, setTesto] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aperta, setAperta] = useState<Azione | null>(null);
  const fine = useRef<HTMLDivElement>(null);

  async function caricaRegistro() {
    setAzioni(await api<Azione[]>('/vera/registro'));
  }

  async function apri() {
    setLoading(true);
    setError(null);
    try {
      // `chat/apri` è idempotente: alla prima apertura in assoluto l'assistente si presenta e chiede
      // come si vuole chiamare; dalla seconda in poi restituisce soltanto lo storico.
      const r = puoDettare
        ? await api<{ messaggi: Messaggio[] }>('/vera/chat/apri', { method: 'POST' })
        : { messaggi: await api<Messaggio[]>('/vera/chat') };
      setMessaggi(r.messaggi);
      await caricaRegistro();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata a chi segue le clienti.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void apri(); }, []);
  useEffect(() => { fine.current?.scrollIntoView({ block: 'end' }); }, [messaggi]);

  async function invia() {
    const t = testo.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await api<{ messaggi: Messaggio[] }>('/vera/chat', { method: 'POST', body: JSON.stringify({ testo: t }) });
      setMessaggi(r.messaggi);
      setTesto('');
      // Il registro può essere cambiato proprio adesso: si ricarica sempre, non solo quando
      // l'ultima risposta sembra una conferma.
      await caricaRegistro();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Messaggio non inviato.');
    } finally {
      setBusy(false);
    }
  }

  async function annulla(a: Azione) {
    if (!confirm(
      `Annullare «${AZIONE[a.azione] ?? a.azione}» su ${a.soggettoNome ?? 'questa cliente'}?\n\n` +
      'La regola smette di valere. I menu che la cliente ha GIÀ VISTO restano come sono: si rifanno ' +
      'solo i giorni futuri che non ha ancora aperto.',
    )) return;
    setError(null);
    try {
      const r = await api<{ daRifare: string[] }>(`/vera/registro/${a.id}/annulla`, { method: 'POST' });
      setNotice(
        r.daRifare.length
          ? `Annullata. Si possono rifare ${r.daRifare.length} giorn${r.daRifare.length === 1 ? 'o' : 'i'} di menu che non ha ancora visto.`
          : 'Annullata. Non ci sono menu futuri da rifare: quelli che ha già visto restano come sono.',
      );
      await caricaRegistro();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annullamento non riuscito.');
    }
  }

  const COLONNE: Colonna<Azione>[] = [
    { chiave: 'quando', titolo: 'Quando', valore: (a) => a.createdAt, esporta: (a) => data(a.createdAt), stile: { width: 120 } },
    { chiave: 'azione', titolo: 'Cosa', valore: (a) => a.azione, filtro: 'scelta', etichetta: (v) => AZIONE[v] ?? v, etichettaTutti: 'Tutte', stile: { width: 150 } },
    { chiave: 'soggetto', titolo: 'Su chi', valore: (a) => a.soggettoNome ?? '', filtro: 'testo' },
    { chiave: 'ambito', titolo: 'Vale per', valore: (a) => a.ambito, filtro: 'scelta', etichetta: (v) => AMBITO[v] ?? v, etichettaTutti: 'Tutti', stile: { width: 120 } },
    { chiave: 'frase', titolo: 'Come l\'hai detta', valore: (a) => a.frase, filtro: 'testo' },
    { chiave: 'stato', titolo: 'Stato', valore: (a) => a.stato, filtro: 'scelta', etichetta: (v) => STATO[v] ?? v, etichettaTutti: 'Tutti', ordineScelte: ['attiva', 'in_approvazione', 'annullata', 'respinta'], stile: { width: 130 } },
    { chiave: 'azioni', titolo: '', stile: { textAlign: 'right' } },
  ];
  const t = useTabella(azioni, COLONNE, { ordineIniziale: { chiave: 'quando', direzione: 'desc' }, nomeExcel: 'Registro assistente', perPagina: 25 });

  if (loading) return <Spinner />;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <p className="muted" style={{ margin: 0, maxWidth: 700 }}>
          Detta a parole cosa vuoi fare — «a Giulia Rossi niente formaggi molli, solo il grana» — e l'assistente
          te lo traduce in regole vere. Prima di scrivere qualsiasi cosa ti mostra <b>cosa sta per fare</b> e
          quante ricette resterebbero nel piano di quella cliente.
        </p>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/* ── la conversazione ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 460 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messaggi.length === 0 && <div className="empty">Scrivi la prima frase qui sotto.</div>}
          {messaggi.map((m) => {
            const mia = m.ruolo === 'nutrizionista';
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mia ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  // ⚠️ Variabili del tema, non colori scritti a mano: il backoffice ha quattro temi
                  // e le bolle della chat delle clienti — che sono in `#12A386` letterale — si
                  // rompono in tre di questi.
                  background: mia ? 'var(--teal)' : 'var(--chip)',
                  color: mia ? '#fff' : 'var(--chip-ink)',
                  padding: '9px 13px',
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{m.testo}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{data(m.createdAt)}</div>
              </div>
            );
          })}
          <div ref={fine} />
        </div>

        {puoDettare ? (
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line)', alignItems: 'flex-end' }}>
            {/*
              ⚠️ `textarea` e non `input`: le frasi dettate sono lunghe (fino a 2000 caratteri), e su
              una riga sola non si rilegge quello che si sta per far scrivere a qualcun altro.
              Invio manda, Maiusc+Invio va a capo.
            */}
            <textarea
              className="input"
              rows={2}
              style={{ flex: 1, resize: 'vertical', minHeight: 44, fontFamily: 'inherit' }}
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void invia(); } }}
              placeholder="Per esempio: a Giulia Rossi non dare più formaggi molli, solo il grana"
              disabled={busy}
            />
            <button className="btn" onClick={() => void invia()} disabled={busy || !testo.trim()}>
              {busy ? '…' : <><i className="ti ti-send" /> Invia</>}
            </button>
          </div>
        ) : (
          <div className="muted" style={{ padding: 12, borderTop: '1px solid var(--line)', fontSize: 13 }}>
            Puoi leggere il registro qui sotto. Per dettare all'assistente serve il permesso di gestione.
          </div>
        )}
      </div>

      {/* ── il registro ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, marginTop: 18 }}>
        <div className="spread" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Registro</h2>
            <ContatoreRighe conteggio={t.conteggio} filtriAttivi={t.filtriAttivi} azzera={t.azzera} nome="azioni" />
            <BottoneExcel tabella={t} />
          </div>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
        </div>

        <Pager {...t.pager} sopra />
        {t.conteggio.mostrate === 0 ? (
          <div className="empty">
            {azioni.length === 0 ? 'Ancora nessuna azione: comincia dettando una frase qui sopra.' : 'Nessuna azione con questi filtri.'}
          </div>
        ) : (
          <table className="grid">
            <thead>{t.intestazione()}{t.rigaFiltri()}</thead>
            <tbody>
              {t.pagina.map((a) => (
                <tr key={a.id} onClick={() => setAperta(a)} style={{ cursor: 'pointer' }} title="Apri: qui c'è la frase con cui l'hai dettata">
                  <td style={{ whiteSpace: 'nowrap' }}>{data(a.createdAt)}</td>
                  <td>
                    {AZIONE[a.azione] ?? a.azione}
                    {/* Una regola confermata sopra un vincolo sanitario si vede a colpo d'occhio: sono
                        poche, e ognuna va letta. */}
                    {a.conflittoSanitario && <span className="chip red" style={{ marginLeft: 6 }}>vincolo sanitario</span>}
                  </td>
                  <td>{a.soggettoNome ?? <span className="muted">—</span>}</td>
                  <td>{AMBITO[a.ambito] ?? a.ambito}</td>
                  <td className="muted" style={{ fontSize: 13 }}>«{a.frase}»</td>
                  <td>
                    <span className={`chip ${a.stato === 'in_approvazione' ? 'amber' : a.stato === 'annullata' ? 'gray' : ''}`}>
                      {STATO[a.stato] ?? a.stato}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {puoDettare && a.stato !== 'annullata' && (
                      <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); void annulla(a); }}>
                        <i className="ti ti-arrow-back-up" /> Annulla la regola
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>

      {aperta && (
        <Modal title="Com'è nata questa regola" onClose={() => setAperta(null)}>
          <div className="field">
            <label>La frase che hai dettato</label>
            <p style={{ margin: 0, fontSize: 15 }}>«{aperta.frase}»</p>
          </div>
          <div className="field">
            <label>Cosa ne è uscito</label>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', background: 'var(--chip)', padding: 10, borderRadius: 8 }}>
              {JSON.stringify(aperta.dettaglio, null, 2)}
            </pre>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            La frase si conserva apposta: se una regola è venuta storta, è qui che si vede perché.
          </p>
        </Modal>
      )}
    </>
  );
}
