import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Gaia from '../components/Gaia';
import { TypeText } from '../components/TypeText';
import { isoDi } from '../lib/giorno';
import type { OnboardingResult } from '../onboarding/types';

/**
 * FINE QUESTIONARIO → BENVENUTO DI GAIA → DATA DI INIZIO → dentro l'app.
 *
 * Sostituisce `PlanFlow` (§16.1, decisione di Simone dell'11/8): «a tutti i clienti, una volta che
 * completano il questionario, in automatico attiviamo Conosciamoci senza passare dallo shop e senza
 * generare un acquisto». Il negozio la cliente lo incontra **alla fine degli 8 giorni**, quando la
 * scelta ha senso — non prima di aver visto un piatto.
 *
 * ## Perché questa schermata non è solo una semplificazione
 *
 * Nel percorso gratuito `planStartDate` restava **null**: la schermata che chiede la data esisteva
 * solo dopo Stripe, quindi chi non pagava con carta non la vedeva mai, e il menu restava «in
 * preparazione» finché la cliente non incontrava per caso la card «Quando vuoi iniziare?» in Home.
 * Questa pagina è il posto che mancava.
 *
 * ## La data è obbligatoria
 *
 * L'ha chiesto Simone: «non si va avanti senza». Nessun «lo faccio dopo», nessun valore
 * preimpostato che si possa confermare per inerzia — se una data preimpostata bastasse, buona parte
 * delle clienti partirebbe con la data di default senza averci pensato, e a quel punto la domanda
 * non serviva. L'aiuto sotto al campo dice cosa fare quando non si sa: metterne una lontana.
 */
export default function Benvenuto({ result, onDone }: { result: OnboardingResult; onDone: () => void }) {
  const { user } = useAuth();
  const nome = user?.firstName || '';
  const coachName = result.team.coach?.displayName ?? null;
  const [step, setStep] = useState(0);
  const [data, setData] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const oggi = isoDi(new Date());

  async function attiva() {
    if (!data) {
      setErrore('Scegli il giorno in cui vuoi iniziare.');
      return;
    }
    setBusy(true);
    setErrore(null);
    try {
      await api('/me/benvenuto', { method: 'POST', body: JSON.stringify({ dataInizio: data }) });
      onDone(); // completa l'onboarding → entra nell'app
    } catch (e) {
      /**
       * L'errore si MOSTRA e non si ingoia. È il solo passaggio fra il questionario e l'app: se
       * fallisce in silenzio la cliente resta su una schermata che non va avanti, senza sapere
       * perché — e il messaggio del backend qui è quello che le serve (data nel passato, oltre i 12
       * mesi, prova già attiva).
       */
      const msg = (e as { message?: string })?.message;
      setErrore(msg && msg.length < 300 ? msg : 'Non sono riuscita ad attivare il tuo percorso. Riprova fra un momento.');
    } finally {
      setBusy(false);
    }
  }

  // ---- Passo 1: il benvenuto di Gaia ----
  if (step === 0) {
    return (
      <div className="app-frame">
        <div className="screen no-tabbar onb">
          <div className="onb-body">
            <h1>Ci conosciamo?</h1>
            <p className="muted" style={{ marginTop: 2 }}>Il tuo percorso è pronto, costruito sulle tue risposte.</p>
            <div className="qbubble">
              <Gaia size={62} controls={false} />
              <div className="bubble">
                <TypeText segments={
                  nome
                    ? [
                        { t: `Benvenuta ${nome}! Dedicami ` },
                        { t: '8 giorni', b: true },
                        { t: ' per conoscerti: in questo periodo ci conosceremo a vicenda e imparerò i tuoi gusti. Al termine potrai scegliere liberamente come proseguire.' },
                      ]
                    : [
                        { t: 'Benvenuta! Dedicami ' },
                        { t: '8 giorni', b: true },
                        { t: ' per conoscerti: in questo periodo ci conosceremo a vicenda e imparerò i tuoi gusti. Al termine potrai scegliere liberamente come proseguire.' },
                      ]
                } />
              </div>
            </div>
            <div className="card result-card">
              <div className="result-name">{result.path.name}</div>
              {result.path.tags.length > 0 && (
                <div className="result-tags">{result.path.tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
              )}
            </div>
            {/* La presentazione della coach stava in `PlanFlow`: senza questo riquadro sparirebbe,
                e sapere chi ti seguirà — con il nome — è la parte che le clienti citano di più. */}
            <div className="card">
              <h2>La tua coach</h2>
              <p className="muted" style={{ margin: 0 }}>
                {coachName ? (
                  <>La tua coach è <b>{coachName}</b>. Ti contatterà a breve per iniziare.</>
                ) : (
                  <>La tua coach ti verrà presentata a breve e ti contatterà per iniziare.</>
                )}
              </p>
            </div>
            <button className="btn" style={{ marginTop: 18 }} onClick={() => setStep(1)}>Iniziamo</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Passo 2: la data di inizio (obbligatoria) ----
  return (
    <div className="app-frame">
      <div className="screen no-tabbar onb">
        <div className="onb-body">
          <h1>Quando vuoi iniziare?</h1>
          <div className="qbubble">
            <Gaia size={62} controls={false} />
            <div className="bubble">
              <TypeText segments={[{ t: 'Inseriscimi la data in cui vuoi iniziare: da quel giorno partono i tuoi menu.' }]} />
            </div>
          </div>
          <div className="card">
            <input
              className="input"
              type="date"
              min={oggi}
              value={data}
              onChange={(e) => { setData(e.target.value); setErrore(null); }}
              style={{ marginBottom: 8 }}
            />
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              Se non la sai, inseriscine una molto lontana: potrai sempre cambiarla dalla tua dashboard.
            </div>
          </div>
          {errore && (
            <div className="card" style={{ background: '#FDECEC', border: '1px solid #F3C4C4', boxShadow: 'none' }}>
              <div style={{ fontSize: 13, color: '#8A2E2E' }}>{errore}</div>
            </div>
          )}
          <button className="btn" style={{ marginTop: 18 }} onClick={attiva} disabled={busy || !data}>
            {busy ? 'Preparo tutto…' : 'Conferma e inizia'}
          </button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setStep(0)} disabled={busy}>
            Torna indietro
          </button>
        </div>
      </div>
    </div>
  );
}
