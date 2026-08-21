import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import AppHeader from '../components/AppHeader';
import OrologioDigiuno from '../components/OrologioDigiuno';
import { MINUTI_AL_GIORNO, oraDelGiorno } from '../lib/orologio';

/**
 * LA PAGINA DELL'OROLOGIO — dove la cliente sceglie o sposta la sua finestra.
 *
 * ⚠️ **Non è una pagina di impostazioni**: è la pagina in cui una persona decide a che ora mangia.
 * Da qui la scelta di mostrare **prima** l'orologio e i pasti che ne escono, e solo dopo i bottoni:
 * quello che conta è vedere la propria giornata, non scegliere una sigla.
 *
 * ## ⛔ Tre cose che questa pagina NON fa
 *
 * 1. **Non blocca.** «Lo faccio dopo» torna in home, e la domanda si ripresenta al prossimo avvio.
 *    Chi non può rispondere adesso — sta correndo, è al lavoro — non deve imparare a chiudere gli
 *    avvisi senza leggerli.
 * 2. **Non decide i pasti.** Quali pasti riceve lo deriva la **durata** della finestra
 *    (`menu/orologio-digiuno.ts` sul server), e questa pagina li **mostra**. Non c'è nessuna
 *    tendina «quali pasti vuoi saltare»: sarebbe la seconda porta sulla stessa domanda.
 * 3. **Non anticipa la risposta del server.** Dopo il salvataggio si ridisegna con **quello che il
 *    server ha scritto davvero**, che col piano graduale è diverso da quello che lei ha chiesto —
 *    ha chiesto le 08:00, in vigore restano le 12:00 ancora per qualche giorno. Fingere il
 *    risultato qui vorrebbe dire mostrarle un orologio che non esiste da nessuna parte.
 */

interface PastoInVista { slot: string; oraMin: number; ora: string; etichetta: string }

interface Vista {
  digiuna: boolean;
  daChiedere: boolean;
  motivo: string;
  proposta?: { protocollo: string; inizioMin: number; ora: string };
  finestraNonTraducibile: boolean;
  attuale?: {
    protocollo: string;
    inizioMin: number;
    apertura: string;
    chiusura: string;
    oreFinestra: number;
    oreDigiuno: number;
    pasti: PastoInVista[];
  };
  piano?: { bersaglioInizioMin: number; bersaglio: string; giorniMancanti: number };
  protocolli: { valore: string; oreFinestra: number; nome: string }[];
  esito?: { metodo: string; daQuando: string; spiegazione: string; giorniDelPiano: number };
}

export default function Digiuno() {
  const navigate = useNavigate();
  const [vista, setVista] = useState<Vista | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Quello che sta scegliendo adesso, prima di confermare. */
  const [protocollo, setProtocollo] = useState<string | null>(null);
  const [inizioMin, setInizioMin] = useState<number | null>(null);

  useEffect(() => {
    api<Vista>('/me/digiuno')
      .then((v) => {
        setVista(v);
        // ⚠️ Si parte da quello che ha già; se non ha ancora scelto, dalla proposta; se non c'è
        // nemmeno quella, dal 16:8 a mezzogiorno — il più comune, e comunque tutto da confermare.
        setProtocollo(v.attuale?.protocollo ?? v.proposta?.protocollo ?? '16:8');
        setInizioMin(v.attuale?.inizioMin ?? v.proposta?.inizioMin ?? 12 * 60);
      })
      .catch(() => setErrore('Non riesco a leggere la tua finestra. Riprova fra poco.'));
  }, []);

  /**
   * ⚠️ **Mai uno schermo bianco a chi ci è appena atterrata.** L'intestazione c'è sempre — è l'unica
   * via d'uscita — e l'errore dice cosa fare invece di lasciarla lì.
   */
  if (errore && !vista) {
    return (
      <div className="page">
        <AppHeader title="Il tuo digiuno" />
        <div className="card" style={{ padding: 16, fontSize: 13 }}>
          {errore}
          <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => window.location.reload()}>
            Riprova
          </button>
        </div>
      </div>
    );
  }
  if (!vista || protocollo === null || inizioMin === null) {
    return (
      <div className="page">
        <AppHeader title="Il tuo digiuno" />
        <div className="card muted" style={{ padding: 16, fontSize: 13 }}>Un attimo…</div>
      </div>
    );
  }

  if (!vista.digiuna) {
    return (
      <div className="page">
        <AppHeader title="Digiuno" />
        <div className="card" style={{ padding: 16 }}>
          Il tuo percorso non prevede il digiuno intermittente. Se vuoi parlarne, scrivi alla tua
          nutrizionista dalla chat.
        </div>
      </div>
    );
  }

  /**
   * ⚠️ Se il protocollo salvato non è più in catalogo (dato vecchio, o tabella cambiata) non si
   * ripiega su un indice: si **aggiunge** quello che ha, così il quadrante disegna la sua durata
   * vera e il bottone resta selezionato su quello che le risulta. Ripiegare sul secondo della lista
   * disegnerebbe una durata e ne salverebbe un'altra.
   */
  const catalogo = vista.protocolli.some((p) => p.valore === protocollo)
    ? vista.protocolli
    : [...vista.protocolli, { valore: protocollo, oreFinestra: vista.attuale?.oreFinestra ?? 8, nome: 'la tua' }];
  const scelto = catalogo.find((p) => p.valore === protocollo)!;
  /**
   * ⚠️ La chiusura la manda il server (`attuale.chiusura`) e si usa quella **finché la finestra è
   * quella in vigore**. Il conto qui sotto serve solo alla finestra che sta scegliendo, e che il
   * server non ha ancora visto: è un'anteprima di una proposta, non una seconda verità.
   */
  const chiusuraMin = (inizioMin + scelto.oreFinestra * 60) % MINUTI_AL_GIORNO;
  /**
   * ⚠️ I pasti mostrati sono quelli che il **server** ha calcolato per la finestra in vigore. Finché
   * lei sta muovendo la lancetta senza confermare, restano quelli: gli orari li ricalcolerebbe una
   * seconda regola scritta qui, e due regole per la stessa cosa prima o poi si contraddicono.
   */
  const pastiInVigore = vista.attuale?.pasti ?? [];
  const cambiata = protocollo !== vista.attuale?.protocollo || inizioMin !== vista.attuale?.inizioMin;
  /**
   * ⛔ **I pallini si disegnano solo se sono di QUESTA finestra** (corretto in revisione, 21/8).
   * Prima restavano quelli del server anche mentre lei trascinava: spostando da mezzogiorno alle
   * otto, i tre pasti restavano disegnati a 12:15 · 15:00 · 19:45, cioè **nelle ore di digiuno**.
   * L'unica smentita era una riga di undici pixel molto più in basso.
   */
  const pastiSulQuadrante = cambiata ? [] : pastiInVigore;

  async function conferma() {
    setSalvando(true);
    setErrore(null);
    try {
      const v = await api<Vista>('/me/digiuno', {
        method: 'PATCH',
        body: JSON.stringify({ protocollo, inizioMin }),
      });
      setVista(v);
      setProtocollo(v.attuale?.protocollo ?? protocollo);
      setInizioMin(v.attuale?.inizioMin ?? inizioMin);
    } catch (e) {
      // ⚠️ Il messaggio del server si mostra **così com'è**: è scritto per lei e dice cosa fare
      // adesso («puoi rifarlo fra N ore»). Sostituirlo con un «errore» generico toglierebbe l'unica
      // parte utile.
      setErrore(e instanceof ApiError ? e.message : 'Non sono riuscito a salvare. Riprova fra poco.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="page">
      <AppHeader title="Il tuo digiuno" />

      {vista.daChiedere && (
        <div className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Scegli la tua finestra</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {vista.proposta
              ? 'Ho impostato quella che stai già seguendo: se ti va bene, confermala. Puoi cambiarla quando vuoi.'
              : 'Decidi tu a che ora mangi. Trascina il pallino per spostare la finestra, e scegli quante ore dura.'}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16 }}>
        <OrologioDigiuno
          inizioMin={inizioMin}
          oreFinestra={scelto.oreFinestra}
          pasti={pastiSulQuadrante.map((p) => ({ oraMin: p.oraMin, etichetta: p.etichetta }))}
          bersaglioMin={vista.piano?.bersaglioInizioMin ?? null}
          /**
           * ⛔ Il conto alla rovescia racconta la finestra **in vigore**, non quella che sta
           * scegliendo: altrimenti, mentre trascina, il centro le direbbe «stai digiunando» a chi
           * può mangiare ancora per sei ore. E a chi non ha mai scelto non racconta niente.
           */
          contoDa={vista.attuale ? { inizioMin: vista.attuale.inizioMin, oreFinestra: vista.attuale.oreFinestra } : null}
          onCambia={salvando ? undefined : setInizioMin}
        />
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 14, fontWeight: 600 }}>
          {cambiata || !vista.attuale
            ? `${oraDelGiorno(inizioMin)} – ${oraDelGiorno(chiusuraMin)}`
            : `${vista.attuale.apertura} – ${vista.attuale.chiusura}`}
        </div>
        <div className="muted" style={{ textAlign: 'center', fontSize: 12 }}>
          {scelto.oreFinestra === 1 ? "un'ora" : `${scelto.oreFinestra} ore`} per mangiare,{' '}
          {24 - scelto.oreFinestra} di digiuno
        </div>
      </div>

      <div className="sec" style={{ marginTop: 12 }}>Quanto dura</div>
      <div className="card" style={{ padding: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {catalogo.map((p) => (
          <button
            key={p.valore}
            onClick={() => setProtocollo(p.valore)}
            style={{
              flex: '1 1 30%', padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
              border: p.valore === protocollo ? '2px solid var(--teal, #17A398)' : '1px solid #E1E7E5',
              background: p.valore === protocollo ? 'rgba(23,163,152,0.08)' : '#fff',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700 }}>{p.valore}</div>
            <div className="muted" style={{ fontSize: 10 }}>{p.nome}</div>
          </button>
        ))}
      </div>

      {pastiInVigore.length > 0 && (
        <>
          <div className="sec" style={{ marginTop: 12 }}>I tuoi pasti</div>
          <div className="card" style={{ padding: '4px 12px' }}>
            {pastiInVigore.map((p, i) => (
              <div key={p.slot + p.ora} className="row-between" style={{ padding: '10px 0', borderBottom: i < pastiInVigore.length - 1 ? '1px solid #F2F5F4' : 'none' }}>
                <span style={{ fontSize: 13 }}>{p.etichetta}</span>
                <span className="muted" style={{ fontSize: 13 }}>{p.ora}</span>
              </div>
            ))}
          </div>
          {cambiata && (
            <div className="muted" style={{ fontSize: 11, margin: '6px 2px 0' }}>
              ⚠️ Questi sono i pasti della finestra che hai adesso. Confermando, li ricalcolo.
            </div>
          )}
        </>
      )}

      {/**
        * ⚠️ `giorniMancanti` a zero vuol dire «non ci si arriva», e il server lo dichiara così apposta
        * invece di inventare un numero. Scrivere «fra 0 giorni» sarebbe raccontarle una cosa che non
        * vuol dire niente: in quel caso si dice solo dove sta andando.
        */}
      {vista.piano && (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13 }}>
            {vista.piano.giorniMancanti > 0
              ? `Sto spostando la tua finestra un po' alla volta: fra ${vista.piano.giorniMancanti} ${vista.piano.giorniMancanti === 1 ? 'giorno' : 'giorni'} aprirai alle ${vista.piano.bersaglio}.`
              : `Sto spostando la tua finestra un po' alla volta, verso le ${vista.piano.bersaglio}.`}
          </div>
        </div>
      )}

      {vista.esito && (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13 }}>{vista.esito.spiegazione}</div>
        </div>
      )}

      {errore && (
        <div className="card" style={{ padding: 14, marginTop: 12, fontSize: 13 }}>{errore}</div>
      )}

      <button
        className="btn"
        style={{ width: '100%', marginTop: 14 }}
        disabled={salvando || (!cambiata && !vista.daChiedere)}
        onClick={conferma}
      >
        {salvando ? 'Salvo…' : vista.daChiedere && !cambiata ? 'Confermo così' : 'Salva la finestra'}
      </button>

      {vista.daChiedere && (
        <button
          onClick={() => navigate('/')}
          style={{ width: '100%', marginTop: 8, background: 'none', border: 0, color: '#8A9A94', fontSize: 13, cursor: 'pointer', padding: 10 }}
        >
          Lo faccio dopo
        </button>
      )}

      <div className="muted" style={{ fontSize: 11, margin: '10px 2px 0' }}>
        Quali pasti ricevi dipende da <b>quanto dura</b> la finestra, non da dove la metti: spostarla
        di un'ora non cambia quello che mangi. Se hai dubbi, parlane con la tua nutrizionista.
      </div>
    </div>
  );
}
