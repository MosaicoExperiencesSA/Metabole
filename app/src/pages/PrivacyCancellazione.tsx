import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiPublic } from '../api/client';
import AppHeader from '../components/AppHeader';

/**
 * LE DUE PAGINE PUBBLICHE DELLA CANCELLAZIONE.
 *
 * `/privacy/sospendi?token=…` — il pulsante delle mail. Pubblica perché **il token è
 * l'autorizzazione**: è così che la decisione «solo la cliente può fermare il termine» diventa vera
 * anche tecnicamente, e perché il link deve funzionare anche se ha cancellato l'app dal telefono —
 * che è la situazione più probabile di tutte, dato che sta andando via.
 *
 * `/privacy/cancellazione` — cosa cancelliamo e cosa siamo obbligati a tenere, con il perché accanto
 * a ogni voce (decisione del 10/8: la frase sulle fatture sta nel popup, nelle mail **e** qui).
 * L'elenco arriva dal backend, dalla stessa fonte che usano le mail: una copia scritta qui a mano
 * diventerebbe falsa il giorno in cui il codice cambia e questa pagina no.
 */

interface CosaCancelliamo {
  giorniAttesa: number;
  siCancella: string[];
  resta: { cosa: string; perche: string }[];
}

export function PrivacySospendi() {
  const [params] = useSearchParams();
  const token = (params.get('token') ?? '').trim();
  const [stato, setStato] = useState<'attesa' | 'fatto' | 'gia' | 'errore'>('attesa');
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStato('errore');
      setErrore('Il link non è completo. Riapri il pulsante dalla mail che ti abbiamo mandato.');
      return;
    }
    let vivo = true;
    apiPublic<{ fermata: boolean; giaFermata: boolean }>(`/privacy/sospendi?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    })
      .then((r) => { if (vivo) setStato(r.giaFermata ? 'gia' : 'fatto'); })
      .catch((e) => {
        if (!vivo) return;
        setStato('errore');
        setErrore(e instanceof Error ? e.message : 'Non riesco a fermare la cancellazione.');
      });
    return () => { vivo = false; };
  }, [token]);

  return (
    <>
      <AppHeader title="Cancellazione dei dati" />
      <div className="card" style={{ textAlign: 'center' }}>
        {stato === 'attesa' && <p className="muted" style={{ margin: 0 }}>Un attimo…</p>}

        {(stato === 'fatto' || stato === 'gia') && (
          <>
            <div style={{ fontSize: 40, lineHeight: 1 }}>💚</div>
            <h2 style={{ margin: '10px 0 6px', fontSize: 19 }}>
              {stato === 'gia' ? 'Era già tutto fermo' : 'Fatto: non cancelliamo niente'}
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>
              I tuoi dati restano dove sono e il consenso è di nuovo attivo. Il percorso riprende da
              dov'era: non devi rifare niente.
            </p>
            {/*
              L'unica cosa che NON torna da sé, e va detta qui e non solo nella mail: chi apre questo
              link magari la mail non la rilegge. È la contropartita onesta della scelta di disdire
              il rinnovo — rimetterlo in piedi da soli vorrebbe dire riabbonare qualcuno senza
              chiederglielo.
            */}
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '12px 0 0' }}>
              Il <b>rinnovo automatico</b> resta disdetto: l'avevamo fermato quando hai revocato. Il
              piano che hai pagato vale fino alla scadenza, e quando vuoi rinnovarlo dillo alla tua
              coach — non ti addebitiamo niente senza che tu lo chieda.
            </p>
          </>
        )}

        {stato === 'errore' && (
          <>
            <div style={{ fontSize: 40, lineHeight: 1 }}>⚠️</div>
            <h2 style={{ margin: '10px 0 6px', fontSize: 19 }}>Non ho potuto fermarla</h2>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{errore}</p>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '12px 0 0' }}>
              Se il termine è vicino, scrivi subito alla tua coach: fermarla è ancora possibile finché
              non è il giorno indicato nella mail.
            </p>
          </>
        )}
      </div>
    </>
  );
}

export function PrivacyCosaCancelliamo() {
  const [dati, setDati] = useState<CosaCancelliamo | null>(null);

  useEffect(() => {
    let vivo = true;
    apiPublic<CosaCancelliamo>('/privacy/cosa-cancelliamo')
      .then((r) => { if (vivo) setDati(r); })
      .catch(() => { /* la pagina resta leggibile anche senza: vedi sotto */ });
    return () => { vivo = false; };
  }, []);

  return (
    <>
      <AppHeader title="Cosa cancelliamo" />
      <div className="card">
        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
          Se revochi il consenso al trattamento dei dati sanitari, entro{' '}
          <b>{dati?.giorniAttesa ?? 30} giorni</b> cancelliamo il tuo percorso. Fino a quel giorno puoi
          fermare tutto dal pulsante che trovi nelle mail che ti mandiamo.
        </p>

        <div className="sec" style={{ margin: '16px 0 6px' }}>Cosa cancelliamo</div>
        {dati ? (
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7 }}>
            {dati.siCancella.map((v) => <li key={v}>{v}</li>)}
          </ul>
        ) : (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Tutto il percorso: profilo, misure, menu, conversazioni, documenti.
          </p>
        )}
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '10px 0 0' }}>
          Non è recuperabile: dopo quel giorno non lo abbiamo più nemmeno noi.
        </p>

        <div className="sec" style={{ margin: '18px 0 6px' }}>Cosa siamo obbligati a tenere</div>
        {dati?.resta.map((r) => (
          <div key={r.cosa} style={{ padding: '9px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.cosa}</div>
            {/* Il perché accanto a ogni voce: un elenco di cose che teniamo, senza la ragione,
                somiglia a una scusa. */}
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{r.perche}</div>
          </div>
        ))}
        {!dati && (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Solo le fatture dei pagamenti: per legge vanno conservate dieci anni e non contengono dati
            sanitari.
          </p>
        )}

        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: '16px 0 0' }}>
          Revocando il consenso disdiciamo anche il rinnovo automatico dell'abbonamento: il piano che
          hai già pagato resta valido fino alla sua scadenza. Si ferma il rinnovo, non il servizio.
        </p>
      </div>
    </>
  );
}
