import { useState } from 'react';
import { condividi } from '../../lib/share';
import { useApi } from '../hooks';
import { Card, Section } from '../ui';

/**
 * "Il mio link d'invito" nell'app dei professionisti.
 *
 * Il ref code dello staff esisteva da un pezzo e funziona: chi si registra da quel link viene
 * assegnata direttamente a chi l'ha mandato, senza passare dal ciclo di accettazione. Ma nell'app
 * dei professionisti non c'era **nessun posto** in cui vederlo (segnalazione Simone 6/8): era
 * visibile solo nel backoffice da desktop, mentre il link lo si manda dal telefono, in chat, nel
 * momento in cui si parla con qualcuno. Uno strumento di acquisizione lasciato dove non serve.
 *
 * Stesso pulsante della card cliente: foglio di condivisione nativo su telefono, copia su
 * desktop. Vale per coach, coordinatrice, responsabile coach e nutrizionista.
 */
interface Invito {
  refCode: string;
  url: string;
}

export default function InvitoCard({ ruolo }: { ruolo: 'coach' | 'nutrizionista' }) {
  const invito = useApi<Invito>('/crm/my-invite');
  const [esito, setEsito] = useState<string | null>(null);

  // Nessun invito disponibile (per esempio: manca la scheda staff) → la card non compare, ma
  // NON in silenzio: chi non lo trova deve sapere perché e a chi chiederlo.
  if (invito.error) {
    return (
      <>
        <Section title="Il mio link d'invito" />
        <Card>
          <div className="sf-sub" style={{ lineHeight: 1.5 }}>
            Il tuo codice invito non è ancora disponibile. Chiedi a chi gestisce il backoffice di
            generartelo da <b>Utenti</b>: da quel momento lo trovi qui.
          </div>
        </Card>
      </>
    );
  }
  if (!invito.data) return null;

  const { refCode, url } = invito.data;
  const chi = ruolo === 'coach' ? 'seguita da te' : 'in carico a te';

  async function invia() {
    const r = await condividi({
      titolo: 'Inizia il tuo percorso con Metabole',
      testo: `Ti mando il link per iscriverti a Metabole con il mio codice ${refCode}:`,
      url,
    });
    if (r === 'copiato') setEsito('Link copiato: incollalo dove vuoi.');
    else if (r === 'fallito') setEsito('Non sono riuscito a condividere. Copia il codice qui sopra.');
    else setEsito(null);
    if (r === 'copiato' || r === 'fallito') setTimeout(() => setEsito(null), 2600);
  }

  return (
    <>
      <Section title="Il mio link d'invito" />
      <Card>
        <div className="sf-sub" style={{ lineHeight: 1.5, marginBottom: 10 }}>
          Chi si registra da questo link diventa una cliente {chi}, senza passare da nessuna
          assegnazione.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 11,
              background: 'rgba(14,124,102,.08)', border: '1px dashed rgba(14,124,102,.35)',
              fontSize: 15, fontWeight: 800, letterSpacing: 1, textAlign: 'center',
            }}
          >
            {refCode}
          </div>
          {/* width auto: la classe .btn del tema è a larghezza piena e senza questo il pulsante
              esce dalla card coprendo il codice (stesso difetto della card cliente). */}
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
          <div className="sf-sub" style={{ fontSize: 11.5, marginTop: 8, textAlign: 'center' }}>{esito}</div>
        )}
      </Card>
    </>
  );
}
