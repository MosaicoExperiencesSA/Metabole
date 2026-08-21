import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Sheet from './Sheet';

/**
 * «CI DICI SE HAI ALLERGIE?» — la scheda in home per chi non ha mai risposto.
 *
 * Decisione di Simone (13/8): «non fermiamo nessuno; stasera gira un aggiornamento e andiamo a
 * chiedere a tutti quelli che hanno l'app installata». Metà delle clienti (24 su 48) ha saltato
 * quella pagina del questionario, e per loro `allergies: []` non vuol dire «non ne ho»: vuol dire
 * che non lo sappiamo.
 *
 * ## Le tre scelte, e perché
 *
 * ⚠️ **Una scheda in home, non un popup.** Il popup intercetta una persona che stava andando a
 * vedere il menù, e la prima reazione a un popup è chiuderlo. La scheda si vede aprendo l'app, non
 * blocca niente e resta lì finché non risponde.
 *
 * ⚠️ **Si può rimandare.** «Lo faccio dopo» e ricompare al prossimo giro. La cosa che uccide questi
 * avvisi è non poterli chiudere: chi non può rispondere adesso impara a ignorarli per sempre.
 *
 * ⚠️ **Non si risponde per lei, e non si insiste con un elenco solo.** C'è il campo libero, perché
 * chi ha un'allergia fuori dai quattordici codici europei è proprio quella che conta di più — e
 * quello che scrive lì apre una domanda alla sua nutrizionista invece di restare una parola in banca
 * dati che non toglie niente dal piatto.
 */
const ALLERGENI: { code: string; label: string }[] = [
  { code: 'glutine', label: 'Glutine' },
  { code: 'crostacei', label: 'Crostacei' },
  { code: 'uova', label: 'Uova' },
  { code: 'pesce', label: 'Pesce' },
  { code: 'arachidi', label: 'Arachidi' },
  { code: 'soia', label: 'Soia' },
  { code: 'latte', label: 'Latte e derivati' },
  { code: 'frutta_a_guscio', label: 'Frutta a guscio' },
  { code: 'sedano', label: 'Sedano' },
  { code: 'senape', label: 'Senape' },
  { code: 'sesamo', label: 'Sesamo' },
  { code: 'solfiti', label: 'Solfiti' },
  { code: 'lupini', label: 'Lupini' },
  { code: 'molluschi', label: 'Molluschi' },
];

/** Vedi `MenuReviewPopup`: la home ha bisogno di sapere se questo riquadro la sta occupando. */
export interface ChiediAllergieProps {
  onAschermo?: (aschermo: boolean) => void;
}

export default function ChiediAllergie({ onAschermo }: ChiediAllergieProps = {}) {
  const [daChiedere, setDaChiedere] = useState(false);
  const [aperto, setAperto] = useState(false);
  const [rimandato, setRimandato] = useState(false);
  const [scelte, setScelte] = useState<string[]>([]);
  const [nessuna, setNessuna] = useState(false);
  const [altro, setAltro] = useState('');
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    api<{ allergies: string[] | null; allergieDichiarateIl: string | null }>('/me/client-profile')
      // ⚠️ La domanda si fa a chi non ha MAI risposto: la data è l'unico modo di distinguere
      // «non ne ho» da «non me l'ha mai chiesto nessuno».
      .then((p) => setDaChiedere(!p.allergieDichiarateIl))
      .catch(() => setDaChiedere(false));
  }, []);

  const aschermo = daChiedere && !rimandato && !fatto;
  // ⚠️ In un effetto: vedi la nota in `MenuReviewPopup`.
  useEffect(() => { onAschermo?.(aschermo); }, [aschermo, onAschermo]);
  /**
   * ⚠️ E allo **smontaggio** si dice che non c'è più. Senza, chi ospita resterebbe con «c'è un
   * riquadro aperto» addosso per sempre: la home toglie questo componente quando il check-in
   * prende il suo posto, e da lì l'ultima cosa detta sarebbe stata «sono a schermo».
   * ⚠️ In un effetto **a parte**: metterlo come pulizia di quello qui sopra farebbe passare un
   * `false` a ogni cambio di stato, cioè una finestrella in cui la regola non vale.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onAschermo?.(false), []);

  if (!aschermo) return null;

  function tocca(code: string) {
    setNessuna(false);
    setScelte((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));
  }

  async function salva() {
    setBusy(true);
    setErrore(null);
    try {
      await api('/me/allergie', {
        method: 'POST',
        body: JSON.stringify({
          allergie: nessuna ? [] : scelte,
          altro: nessuna || !altro.trim() ? [] : [altro.trim()],
          nessuna,
        }),
      });
      setFatto(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscita a salvare. Riprova fra poco.');
    } finally {
      setBusy(false);
    }
  }

  const puoSalvare = nessuna || scelte.length > 0 || altro.trim().length > 0;

  return (
    <>
      <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid #C0392B' }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Ci dici se hai allergie?</div>
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>
          Non risulta una tua risposta. È la prima cosa che teniamo fuori dai menu — anche le tracce e
          i derivati — e ci mettiamo un minuto.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setAperto(true)}>Rispondo adesso</button>
          <button className="btn ghost" onClick={() => setRimandato(true)}>Lo faccio dopo</button>
        </div>
      </div>

      {aperto && (
        <Sheet onClose={() => setAperto(false)}>
          <h3 style={{ margin: '0 0 4px' }}>Hai allergie alimentari?</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
            Tocca quelle che ti riguardano. Le allergie le evitiamo sempre; se non ne hai, dillo lo
            stesso: anche «non ne ho» è una risposta che ci serve.
          </p>

          <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            {ALLERGENI.map((a) => (
              <button
                key={a.code}
                className={scelte.includes(a.code) ? 'btn sm' : 'btn ghost sm'}
                onClick={() => tocca(a.code)}
                style={{ fontSize: 12.5 }}
              >
                {a.label}
              </button>
            ))}
          </div>

          <input
            className="input"
            placeholder="Altro (scrivilo qui: ci pensa la tua nutrizionista)"
            value={altro}
            onChange={(e) => { setAltro(e.target.value); if (e.target.value) setNessuna(false); }}
            disabled={nessuna}
          />

          <label className="row" style={{ gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13.5 }}>
            <input
              type="checkbox"
              checked={nessuna}
              onChange={(e) => { setNessuna(e.target.checked); if (e.target.checked) { setScelte([]); setAltro(''); } }}
            />
            Non ho allergie
          </label>

          {errore && <p style={{ color: '#C0392B', fontSize: 12.5 }}>{errore}</p>}

          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            <button className="btn" disabled={!puoSalvare || busy} onClick={() => void salva()}>
              {busy ? 'Salvo…' : 'Salva'}
            </button>
            <button className="btn ghost" onClick={() => setAperto(false)}>Annulla</button>
          </div>

          <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
            ⚠️ Una volta registrate, per cambiarle parlane con la tua nutrizionista: è lei a poterle
            correggere.
          </p>
        </Sheet>
      )}
    </>
  );
}
