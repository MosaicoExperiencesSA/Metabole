import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { condividi } from '../lib/share';

/**
 * "Porta un'amica": codice invito + link pronto da condividere (richiesta Simone 5/8, voce #13).
 *
 * L'endpoint `GET /me/referral` esisteva già e generava il codice, ma nell'app cliente non c'era
 * NESSUN punto in cui vederlo: il meccanismo di invito funzionava solo se qualcuno ti dettava il
 * codice a voce. Qui sta sotto i quadrotti della Home, dove la cliente passa ogni giorno.
 *
 * Il pulsante apre il foglio di condivisione nativo del telefono (WhatsApp, Messaggi, Mail);
 * su desktop copia negli appunti, che è l'unica cosa sensata da fare lì.
 */
interface Referral {
  code: string;
  invited: number;
  converted: number;
  rewardDays: number;
  /** Il server decide QUANDO mostrarla: dopo N giorni di percorso (parametro
   *  `referral_card_after_days`, oggi 15). È una regola di prodotto, non grafica:
   *  così si cambia da Parametri senza pubblicare una nuova versione dell'app. */
  visible: boolean;
  afterDays: number;
}

const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? 'https://app.metabole.eu';

export default function ReferralCard() {
  const [ref, setRef] = useState<Referral | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  useEffect(() => {
    api<Referral>('/me/referral').then(setRef).catch(() => setRef(null));
  }, []);

  useEffect(() => {
    if (!esito) return;
    const t = setTimeout(() => setEsito(null), 2600);
    return () => clearTimeout(t);
  }, [esito]);

  // `visible === false` = percorso troppo giovane: la card non si mostra. Il controllo è
  // difensivo su `visible !== false` per non far sparire la card se un giorno il campo manca.
  if (!ref?.code || ref.visible === false) return null;

  const link = `${APP_URL}/register?ref=${encodeURIComponent(ref.code)}`;
  const giorni = ref.rewardDays;

  async function invia() {
    const r = await condividi({
      titolo: 'Prova Metabole con me',
      testo: `Sto seguendo il mio percorso con Metabole e mi trovo bene. Se vuoi provarlo, iscriviti da qui col mio codice ${ref!.code}:`,
      url: link,
    });
    if (r === 'condiviso') setEsito(null);
    else if (r === 'copiato') setEsito('Link copiato: incollalo dove vuoi.');
    else if (r === 'fallito') setEsito('Non sono riuscito a condividere. Copia il codice qui sopra.');
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <b style={{ fontSize: 13 }}>Porta un'amica</b>
        {ref.invited > 0 && (
          <span className="muted" style={{ fontSize: 11 }}>
            {ref.invited} {ref.invited === 1 ? 'invito' : 'inviti'}
            {/* `converted` conta chi ha ACQUISTATO, non chi si è iscritta: qui c'era scritto
                "iscritte", che è un'altra cosa e non torna mai col numero degli inviti. */}
            {ref.converted > 0 ? ` · ${ref.converted} con acquisto` : ''}
          </span>
        )}
      </div>
      {/* La ricompensa scatta all'ACQUISTO dell'amica, non alla registrazione: `onConvert` è
          chiamato solo dalla catena di approvazione del pagamento (commerce.service). Il testo
          diceva "si iscrive", e prometteva quindi una cosa che non succede: chi invita tre amiche
          e le vede registrate senza ricevere niente ha ragione a sentirsi presa in giro. */}
      <p className="muted" style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.4 }}>
        Quando un'amica si iscrive col tuo codice <b>e acquista un percorso</b>, il tuo si allunga
        di {giorni} giorni.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div
          style={{
            flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 11,
            background: 'var(--soft)', border: '1px dashed var(--line)',
            fontSize: 15, fontWeight: 800, letterSpacing: 1, textAlign: 'center',
          }}
        >
          {ref.code}
        </div>
        {/* `.btn` ha `width: 100%` nel tema: con `flex: none` quella larghezza vince e il pulsante
            si prendeva tutta la riga, uscendo dalla card e coprendo il codice. Serve `width: auto`. */}
        <button
          className="btn"
          style={{ flex: 'none', width: 'auto', whiteSpace: 'nowrap', padding: '10px 16px' }}
          onClick={invia}
        >
          <i className="ti ti-share-2" style={{ marginRight: 6 }} />
          Condividi
        </button>
      </div>
      {esito && (
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8, textAlign: 'center' }}>{esito}</div>
      )}
    </div>
  );
}
