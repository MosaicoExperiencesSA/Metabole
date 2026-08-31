import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, Spinner } from '../components/ui';
import { BottoneExcel, Colonna, ContatoreRighe, useTabella } from '../components/tabella';
import { TestoConGrassetto } from '../components/TestoConGrassetto';
import { agganciaInFondo, portaInFondo } from '../lib/scorri-in-fondo';

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

/** Una domanda aperta dal sistema, che aspetta una risposta da chi sa tradurla. */
interface Richiesta {
  id: string;
  tipo: string;
  clienteNome: string | null;
  testo: string;
  origine: string;
  createdAt: string;
}

/** Una riga del registro allargato: mette insieme assistente, Gaia, cliente e staff. */
interface Voce {
  id: string;
  fonte: 'azione_vera' | 'audit' | 'food_swap';
  quando: string;
  origine: 'assistente' | 'gaia' | 'cliente' | 'staff' | 'motore';
  cosa: string;
  suChi: string | null;
  dettaglio: unknown;
  annullabile: boolean;
  stato?: string;
}

interface AspettaMe {
  richieste: number;
  daApprovare: number;
  daVerificare: number;
  capo: boolean;
  /**
   * LE TRE CODE DEL CATALOGO (18/8). `null` = non lo so — la lettura si è rotta — ed è diverso da
   * zero: la pastiglia lo scrive diverso, invece di dire «tutto a posto» perché non ha saputo
   * contare.
   */
  catalogo?: { allergeni: number; ricette: number; combinazioni: number; totale: number } | null;
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

/** Chi ha fatto la modifica: è la colonna che risponde a «chi è stato». */
const ORIGINE: Record<string, string> = {
  assistente: 'Assistente',
  gaia: 'Gaia',
  cliente: 'La cliente',
  staff: 'Staff',
  motore: 'Motore',
};

const data = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Sotto quest'altezza la chat non scende: tre messaggi e la riga per scrivere ci devono stare. */
const ALTEZZA_CHAT_MIN = 320;

/**
 * LE FRASI CHE L'ASSISTENTE NON HA CAPITO (voce `vera-corpus-prima-del-rilascio`).
 *
 * ⚠️ `GET /vera/corpus` esiste dal 12/8 e **non lo apriva nessuno**: era un endpoint, non un posto.
 * Un traduttore marcisce senza dare nessun errore rosso — il giorno in cui cambia il catalogo o una
 * regola in `capisci.ts`, l'unico sintomo è che l'assistente comincia a sembrare più scema di prima.
 * L'unico rimedio che funziona è vedere le frasi vere, e per vederle devono stare dove si guarda.
 */
interface FraseNonCapita {
  frase: string;
  quante: number;
  ultimaVolta: string;
  /** Si è arresa dopo il secondo tentativo, o era solo il primo «non ci arrivo»? */
  arresa: boolean;
}

export function Vera() {
  const { can } = useAuth();
  // ⚠️ `nutri_assistant` e non `food_swaps`: la chiave è cambiata il 13/8, e questa riga è il posto
  // dove dimenticarsene non produce nessun errore — la pagina si aprirebbe lo stesso, e sarebbe la
  // casella delle Sostituzioni a decidere se qui si può dettare.
  const puoDettare = can('nutri_assistant', 'manage');

  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [azioni, setAzioni] = useState<Azione[]>([]);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [tutto, setTutto] = useState<Voce[]>([]);
  const [vediTutto, setVediTutto] = useState(false);
  const [aspetta, setAspetta] = useState<AspettaMe | null>(null);
  const [testo, setTesto] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aperta, setAperta] = useState<Azione | null>(null);
  const [report, setReport] = useState<{ periodo: string; testo: string } | null>(null);
  const fine = useRef<HTMLDivElement | null>(null);
  /**
   * ⛔ **Si scorre quando la scatola si ATTACCA, non quando arrivano i messaggi.** Fino al 31/8
   * questa pagina si apriva su messaggi di cinque giorni prima: `apri()` scrive i messaggi e
   * spegne `loading` solo dopo il registro, quindi nel disegno in cui i messaggi arrivano qui
   * c'è ancora `<Spinner />` e `fine.current` è `null`. Vedi `lib/scorri-in-fondo.ts`.
   */
  const attaccaFine = useMemo(() => agganciaInFondo(fine), []);
  const finestraChat = useRef<HTMLDivElement>(null);

  /**
   * L'ALTEZZA DELLA CHAT SI RICORDA (voce 237, richiesta di Simone dagli screenshot del 13/8).
   *
   * Solo il valore scelto TRASCINANDO finisce in localStorage: salvare l'altezza a ogni misura
   * congelerebbe in pixel il default `min(72vh, 640px)` alla prima visita, e su uno schermo diverso
   * sembrerebbe una scelta che nessuno ha fatto.
   */
  const [altezzaChat] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem('metabole_bo_vera_chat_h') || '');
      return Number.isFinite(v) && v >= ALTEZZA_CHAT_MIN && v <= 2000 ? v : null;
    } catch {
      return null;
    }
  });

  function trascinaAltezza(e: React.MouseEvent) {
    e.preventDefault();
    const el = finestraChat.current;
    if (!el) return;
    const inizioY = e.clientY;
    const inizioAltezza = el.getBoundingClientRect().height;
    const muovi = (ev: MouseEvent) => {
      const h = Math.max(ALTEZZA_CHAT_MIN, Math.round(inizioAltezza + ev.clientY - inizioY));
      el.style.height = `${h}px`;
    };
    const lascia = () => {
      document.removeEventListener('mousemove', muovi);
      document.removeEventListener('mouseup', lascia);
      const h = Math.round(el.getBoundingClientRect().height);
      try { localStorage.setItem('metabole_bo_vera_chat_h', String(h)); } catch { /* storage non disponibile */ }
    };
    document.addEventListener('mousemove', muovi);
    document.addEventListener('mouseup', lascia);
  }

  // Le frasi non capite, dalla più ripetuta. Vuoto = il riquadro non compare proprio.
  const [nonCapite, setNonCapite] = useState<FraseNonCapita[]>([]);
  const [apriFrasi, setApriFrasi] = useState(false);

  async function caricaRegistro() {
    const [reg, ric, asp, all, corp] = await Promise.all([
      api<Azione[]>('/vera/registro'),
      api<Richiesta[]>('/vera/richieste'),
      api<AspettaMe>('/vera/aspetta-me'),
      api<Voce[]>('/vera/registro/tutto'),
      /**
       * ⚠️ Sotto `catch`: il corpus è materiale di manutenzione, non serve a far funzionare
       * niente. Se questa lettura si rompe la cosa giusta è che il riquadro non compaia — non
       * che la pagina dell'assistente non si apra.
       */
      api<{ nonCapite: FraseNonCapita[] }>('/vera/corpus').catch(() => ({ nonCapite: [] })),
    ]);
    setAzioni(reg);
    setRichieste(ric);
    setAspetta(asp);
    setTutto(all);
    setNonCapite(corp.nonCapite ?? []);
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
  /**
   * ⛔ **La chat si apre sull'ultimo messaggio** (Simone, 23/8), e si scorre la SCATOLA, non
   * `scrollIntoView` su un segnaposto: quello scorre anche tutti gli antenati, cioè fa saltare la
   * pagina. Due giri, perché al primo disegno le altezze non sono ancora quelle vere — vedi
   * `lib/scorri-in-fondo.ts`.
   */
  useEffect(() => {
    portaInFondo(fine.current);
    const t = requestAnimationFrame(() => portaInFondo(fine.current));
    return () => cancelAnimationFrame(t);
  }, [messaggi]);

  /**
   * Manda una frase alla chat senza passare dalla casella. Serve alle pastiglie: quello che una
   * pastiglia annuncia deve essere raggiungibile CLICCANDOLA, non solo sapendo la parola giusta
   * da scrivere. È la stessa lezione del widget del generatore — una coda che si apre solo a voce
   * è una coda che nessuno svuota.
   */
  async function chiedi(frase: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await api<{ messaggi: Messaggio[] }>('/vera/chat', { method: 'POST', body: JSON.stringify({ testo: frase }) });
      setMessaggi(r.messaggi);
      await caricaRegistro();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Messaggio non inviato.');
    } finally {
      setBusy(false);
    }
  }

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

  /**
   * ⛔ **«NON NE HO TROVATI» NON È «NON CE N'ERANO»** — 26/8, voce `visto-non-vuol-dire-aperto`.
   *
   * `daRifare` è l'elenco dei giorni che **sappiamo** non aperti. Fino al 26/8 il conto si faceva su
   * `viewedAt`, che `getMenu` scrive su tutti i trenta giorni della finestra a ogni apertura
   * dell'app: quindi era quasi sempre vuoto, e qui si leggeva «quelli che ha già visto restano come
   * sono» — un'affermazione su un fatto (li ha visti) che il dato non sosteneva.
   *
   * ⚠️ Adesso il dato è vero, ma **un elenco vuoto resta ambiguo**: può voler dire «li ha aperti
   * tutti» oppure «della sua app non lo sappiamo ancora», che è la risposta normale finché gli
   * aggiornamenti non sono arrivati a tutte. Si dice così — l'assenza di un fatto non si racconta
   * come un fatto. È il difetto che questa voce esiste per chiudere, e questa schermata è l'ultimo
   * posto in cui poteva sopravvivere.
   */
  async function annulla(a: Azione) {
    if (!confirm(
      `Annullare «${AZIONE[a.azione] ?? a.azione}» su ${a.soggettoNome ?? 'questa cliente'}?\n\n` +
      'La regola smette di valere. I menu che la cliente ha GIÀ APERTO restano come sono: si rifanno ' +
      'solo i giorni futuri che sappiamo non aver ancora aperto.',
    )) return;
    setError(null);
    try {
      const r = await api<{ daRifare: string[] }>(`/vera/registro/${a.id}/annulla`, { method: 'POST' });
      setNotice(
        r.daRifare.length
          ? `Annullata. Si possono rifare ${r.daRifare.length} giorn${r.daRifare.length === 1 ? 'o' : 'i'} di menu che sappiamo non aver ancora aperto.`
          : 'Annullata. Nessun giorno futuro risulta rifacibile: o li ha già aperti, o la sua app non ce lo dice ancora. '
            + 'Per rifarli comunque c\'è «Rigenera menu» dalla sua scheda.',
      );
      await caricaRegistro();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annullamento non riuscito.');
    }
  }

  /**
   * Il report del mese, per chi sorveglia. Si apre a richiesta e non si carica insieme al resto:
   * è una lettura d'insieme, e mescolarla alla schermata di lavoro la fa scorrere via come tutto
   * il resto.
   */
  async function apriReport(mesePrima: boolean) {
    const ora = new Date();
    const d = new Date(Date.UTC(ora.getUTCFullYear(), ora.getUTCMonth() - (mesePrima ? 1 : 0), 1));
    setError(null);
    try {
      setReport(
        await api<{ periodo: string; testo: string }>(
          `/vera/report?anno=${d.getUTCFullYear()}&mese=${d.getUTCMonth() + 1}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report non disponibile.');
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
        {/*
          ⚠️ Il report esiste come pulsante e non solo come email di fine mese: un foglio che arriva
          una volta al mese in posta è un foglio che si legge il primo mese. Qui è a portata di mano
          il giorno in cui serve — che di solito è il giorno in cui è successo qualcosa.
        */}
        {aspetta?.capo && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => void apriReport(false)}>
              <i className="ti ti-report" /> Report del mese
            </button>
            <button className="btn ghost sm" onClick={() => void apriReport(true)}>Mese scorso</button>
          </div>
        )}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {/*
        ⚠️ «Quello che aspetta me», non «quello che ho fatto».
        Un contatore delle regole create è una medaglietta: la si guarda due volte e poi mai più.
        Qui ci sono solo cose che hanno bisogno di una persona.
      */}
      {aspetta && (aspetta.richieste > 0 || aspetta.daApprovare > 0 || aspetta.daVerificare > 0 || (aspetta.catalogo?.totale ?? 0) > 0 || aspetta.catalogo === null) && (
        <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {aspetta.daApprovare > 0 && (
            <span className="chip amber">
              <i className="ti ti-stack-2" /> {aspetta.daApprovare} da approvare
            </span>
          )}
          {aspetta.richieste > 0 && (
            <span className="chip amber">
              <i className="ti ti-help-circle" /> {aspetta.richieste} domande aperte
            </span>
          )}
          {aspetta.daVerificare > 0 && (
            <span className="chip">
              <i className="ti ti-replace" /> {aspetta.daVerificare} sostituzioni da verificare
            </span>
          )}
          {/*
            LE TRE CODE DEL CATALOGO (18/8, richiesta di Simone: «vanno tutti inviati a vera che
            aiuta il nutrizionista a verificare uno per uno»).
            ⚠️ Questa pastiglia si CLICCA e apre la coda in chat. Le altre qui sopra sono
            annunci; questa è la porta — perché la coda esiste per essere svuotata, e chiedere di
              indovinare la parola «approvazioni» sarebbe averla nascosta dietro un indovinello.
          */}
          {(aspetta.catalogo?.totale ?? 0) > 0 && (
            <button
              type="button"
              className="chip amber"
              onClick={() => void chiedi('approvazioni')}
              disabled={busy}
              title={`${aspetta.catalogo!.allergeni} allergeni, ${aspetta.catalogo!.ricette} ricette, ${aspetta.catalogo!.combinazioni} combinazioni`}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              <i className="ti ti-checkup-list" /> {aspetta.catalogo!.totale} da approvare in catalogo
            </button>
          )}
          {/* ⚠️ «Non lo so» ≠ «niente»: se il conto non riesce si dice, invece di tacere. */}
          {aspetta.catalogo === null && (
            <span className="chip" title="Il conto delle code di catalogo non è riuscito.">
              <i className="ti ti-alert-triangle" /> code di catalogo: non lo so
            </span>
          )}
        </div>
      )}

      {/*
        ⚠️ Le domande aperte esistono come ELENCO e non solo come messaggi.
        È l'avvertenza che il contratto fra le due sessioni mette sopra tutte le altre: se vivono
        solo dentro il dialogo, in due settimane sono una chat lunga in cui le cose scendono e
        nessuno sa più cosa manca. Qui si vedono a colpo d'occhio, e l'assistente le porta una
        alla volta nella conversazione qui sotto.
      */}
      {richieste.length > 0 && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--gold)' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <i className="ti ti-help-circle" style={{ color: 'var(--gold)' }} />
            <b>
              {richieste.length === 1 ? 'Una domanda aspetta te' : `${richieste.length} domande aspettano te`}
            </b>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
            {richieste.slice(0, 5).map((r) => (
              <li key={r.id} style={{ marginBottom: 4 }}>
                {r.clienteNome && <b>{r.clienteNome}: </b>}
                {r.testo}
              </li>
            ))}
          </ul>
          {richieste.length > 5 && (
            <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
              …e altre {richieste.length - 5}. L'assistente te le porta una alla volta qui sotto.
            </p>
          )}
        </div>
      )}

      {/* ── la conversazione ─────────────────────────────────────────────── */}
      <div
        ref={finestraChat}
        className="card"
        style={{ padding: 0, display: 'flex', flexDirection: 'column', height: altezzaChat ?? 'min(72vh, 640px)', minHeight: ALTEZZA_CHAT_MIN }}
      >
        <div ref={attaccaFine} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                {/* ⚠️ Il grassetto si DISEGNA (25/8): i testi di Vera lo scrivono in markdown in
                    **novantasei** stringhe, e la nutrizionista leggeva gli asterischi in mezzo alle
                    frasi. Vedi il riquadro in `TestoConGrassetto`. Qui non arriva mai una push:
                    questa chat vive solo nel back office. */}
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}><TestoConGrassetto testo={m.testo} /></div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{data(m.createdAt)}</div>
              </div>
            );
          })}
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

        {/* Il bordo che si trascina (voce 237). Solo mouse: il backoffice si usa alla scrivania. */}
        <div
          onMouseDown={trascinaAltezza}
          title="Trascina per ridimensionare la chat"
          style={{ height: 10, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
        >
          <div style={{ width: 44, height: 3, borderRadius: 2, background: 'var(--line)' }} />
        </div>
      </div>

      {/* ── le frasi che non ha capito ───────────────────────────────────── */}
      {/*
        ⚠️ Se non ce ne sono, questo riquadro NON compare. È la stessa regola del riquadro «quello
        che aspetta me»: una scatola che dice «niente da fare» ogni volta insegna a non leggerla.
        ⚠️ E chiuso di default: è manutenzione, non una cosa che aspetta qualcuno. Deve stare sotto
        gli occhi di chi passa di qui, non prendersi la pagina.
      */}
      {nonCapite.length > 0 && (
        <div className="card" style={{ marginTop: 18, borderLeft: '3px solid var(--line)' }}>
          <div className="spread" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <i className="ti ti-message-question" style={{ color: 'var(--muted)' }} />
              <b>
                {nonCapite.length === 1
                  ? "C'è una frase che non ho capito"
                  : `Ci sono ${nonCapite.length} frasi che non ho capito`}
              </b>
              <span className="muted" style={{ fontSize: 12.5 }}>negli ultimi 90 giorni</span>
            </div>
            <button className="btn ghost" onClick={() => setApriFrasi((v) => !v)}>
              <i className={`ti ti-chevron-${apriFrasi ? 'up' : 'down'}`} /> {apriFrasi ? 'Chiudi' : 'Guarda'}
            </button>
          </div>
          {apriFrasi && (
            <>
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '10px 0 4px' }}>
                Sono le parole da insegnargli. ⚠️ Un traduttore smette di capire <b>senza dare nessun
                errore</b>: l'unico sintomo è che l'assistente sembra più scema di prima. Vanno
                ripassate prima di ogni rilascio.
              </div>
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                {nonCapite.map((f) => (
                  <li key={f.frase} style={{ marginBottom: 7, lineHeight: 1.5 }}>
                    {/* ⚠️ La frase si mostra COM'È STATA SCRITTA. Ripulirla vorrebbe dire buttare via
                        esattamente l'informazione che serve: com'è che le viene di dirlo. */}
                    <span style={{ fontSize: 14 }}>«{f.frase}»</span>{' '}
                    <span className="muted" style={{ fontSize: 12 }}>
                      — {f.quante === 1 ? 'una volta' : `${f.quante} volte`}
                      {f.arresa ? ', e si è arresa' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── il registro ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, marginTop: 18 }}>
        <div className="spread" style={{ padding: '14px 16px', gap: 10, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Registro</h2>
            {/*
              ⚠️ «Tutto» non è un di più: sulle sue clienti scrivono in tanti — lei, Gaia, la
              cliente dall'app, il motore — e quello che le manca non è «cosa ho fatto io», è
              «cosa è cambiato».
            */}
            <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={vediTutto} onChange={(e) => setVediTutto(e.target.checked)} />
              Tutto quello che cambia sulle mie clienti
            </label>
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

        {vediTutto ? (
          tutto.length === 0 ? (
            <div className="empty">Negli ultimi due mesi non è cambiato niente sulle tue clienti.</div>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Quando</th>
                  <th style={{ width: 110 }}>Chi</th>
                  <th>Cosa</th>
                  <th style={{ width: 160 }}>Su chi</th>
                </tr>
              </thead>
              <tbody>
                {tutto.map((v) => (
                  <tr key={`${v.fonte}-${v.id}`}>
                    <td style={{ whiteSpace: 'nowrap' }}>{data(v.quando)}</td>
                    <td>
                      <span className={`chip ${v.origine === 'assistente' ? '' : 'gray'}`}>{ORIGINE[v.origine] ?? v.origine}</span>
                    </td>
                    <td style={{ fontSize: 13.5 }}>{v.cosa}</td>
                    <td>{v.suChi ?? <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
        <>
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
        </>
        )}
      </div>

      {report && (
        <Modal title={`Assistente — ${report.periodo}`} onClose={() => setReport(null)}>
          <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: '60vh', overflowY: 'auto' }}>
            {report.testo}
          </div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
            Si ricalcola ogni volta: non è una fotografia salvata, quindi tiene conto anche di quello che è
            stato annullato dopo.
          </p>
        </Modal>
      )}

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
