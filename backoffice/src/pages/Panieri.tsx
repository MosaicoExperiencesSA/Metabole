import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, PageHeader, Spinner } from '../components/ui';

/**
 * I PANIERI — da dove arrivano i piatti di una cliente.
 *
 * ⚠️ **Non è il catalogo diete.** Una dieta è quello che una cliente segue; il paniere è l'insieme
 * dei piatti che il motore può metterle nel piatto, ed è **famiglia × regime**: molte varianti
 * diverse pescano dallo stesso. Fino a oggi questa tabella si poteva leggere solo con un tabulato
 * da shell — chi risponde di cosa mangiano le clienti non aveva modo di guardarci dentro.
 *
 * ⛔ **E chi tocca una riga qui cambia il menu di tutte insieme**, non la giornata di una: per
 * questo il pulsante «togli» c'è solo per chi ha `manage`, e ogni scrittura finisce nell'audit.
 *
 * ## Come si legge una cella
 *
 * ⚠️ I numeri sono **piatti diversi**, non righe di tabella: la stessa vellutata può stare a pranzo
 * e a cena, e conta una volta sola nel totale. E **spuntino e merenda hanno lo stesso numero**
 * perché sono un paniere solo (decisione dell'1/9: un piatto delle 10:30 va bene anche alle 17).
 */

const SLOT = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'] as const;
const NOME_SLOT: Record<string, string> = {
  breakfast: 'Colazione',
  morning_snack: 'Spuntino',
  lunch: 'Pranzo',
  afternoon_snack: 'Merenda',
  dinner: 'Cena',
};
const NOME_REGIME: Record<string, string> = {
  omnivore: 'Onnivoro',
  pescetarian: 'Pescetariano',
  vegetarian: 'Vegetariano',
  vegan: 'Vegano',
};

interface Cella {
  famiglia: string;
  regime: string;
  esiste: boolean;
  impossibile: string | null;
  perSlot: Record<string, number>;
  totale: number;
}

interface Ricetta {
  id: string;
  name: string;
  kcal: number;
  mealSlot: string;
  active: boolean;
}

export function Panieri() {
  const { can } = useAuth();
  const puoGestire = can('panieri', 'manage');
  const [celle, setCelle] = useState<Cella[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  /** La cella aperta, e per quale pasto: `null` = nessuna. */
  const [aperta, setAperta] = useState<{ cella: Cella; slot: string } | null>(null);
  const [ricette, setRicette] = useState<Ricetta[] | null>(null);

  async function carica() {
    try {
      setCelle(await api<Cella[]>('/panieri'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Caricamento non riuscito.');
    }
  }

  useEffect(() => { void carica(); }, []);

  async function apri(cella: Cella, slot: string) {
    if (!cella.esiste) return;
    setAperta({ cella, slot });
    setRicette(null);
    try {
      const r = await api<Ricetta[]>(
        `/panieri/${encodeURIComponent(cella.famiglia)}/${cella.regime}/ricette?slot=${slot}`,
      );
      setRicette(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Non sono riuscito a leggere le ricette.');
      setAperta(null);
    }
  }

  async function togli(r: Ricetta) {
    if (!aperta) return;
    const { cella, slot } = aperta;
    /**
     * ⚠️ La conferma dice **cosa cambia per le clienti**, non «sei sicuro?»: chi preme questo
     * pulsante toglie un piatto dal pool di tutte quelle del paniere, e la frase deve dirlo.
     */
    const quante = cella.perSlot[slot] ?? 0;
    if (!confirm(
      `Togliere «${r.name}» dal paniere ${cella.famiglia} · ${NOME_REGIME[cella.regime] ?? cella.regime}?\n\n`
      + `Non lo riceverà più nessuna cliente di questo paniere per ${NOME_SLOT[slot]?.toLowerCase() ?? slot}. `
      + `Ne restano ${Math.max(0, quante - 1)}.`,
    )) return;
    try {
      await api('/panieri/ricetta', {
        method: 'DELETE',
        body: JSON.stringify({ famiglia: cella.famiglia, regime: cella.regime, slot, recipeId: r.id }),
      });
      setRicette((v) => (v ?? []).filter((x) => x.id !== r.id));
      setAvviso(`«${r.name}» tolta dal paniere.`);
      await carica();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Non sono riuscito a togliere la ricetta.');
    }
  }

  const famiglie = useMemo(() => [...new Set((celle ?? []).map((c) => c.famiglia))], [celle]);
  const regimi = useMemo(() => [...new Set((celle ?? []).map((c) => c.regime))], [celle]);
  const cellaDi = (famiglia: string, regime: string) =>
    (celle ?? []).find((c) => c.famiglia === famiglia && c.regime === regime);

  return (
    <div className="page">
      <PageHeader title="Panieri" />
      {error && <Banner kind="err">{error}</Banner>}
      {avviso && <Banner kind="ok">{avviso}</Banner>}

      <p className="muted" style={{ maxWidth: 760 }}>
        Il paniere è <strong>da dove arrivano i piatti</strong> di una cliente: famiglia × regime.
        Molte varianti diverse pescano dallo stesso. I numeri sono piatti <strong>diversi</strong>,
        non righe: la stessa vellutata a pranzo e a cena conta una volta sola.
        Spuntino e merenda hanno lo stesso numero perché sono un paniere solo.
      </p>

      {!celle ? <Spinner /> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Famiglia</th>
                {regimi.map((r) => <th key={r}>{NOME_REGIME[r] ?? r}</th>)}
              </tr>
            </thead>
            <tbody>
              {famiglie.map((f) => (
                <tr key={f}>
                  <td><strong>{f}</strong></td>
                  {regimi.map((rg) => {
                    const c = cellaDi(f, rg);
                    if (!c) return <td key={rg} />;
                    if (c.impossibile) {
                      return (
                        <td key={rg} title={c.impossibile} style={{ color: 'var(--muted)' }}>
                          — non possibile
                        </td>
                      );
                    }
                    if (!c.esiste) {
                      return <td key={rg} style={{ color: 'var(--muted)' }}>paniere non creato</td>;
                    }
                    return (
                      <td key={rg}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.totale} piatti</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {SLOT.map((sl) => (
                            <button
                              key={sl}
                              className="btn ghost"
                              style={{ padding: '2px 6px', fontSize: 12 }}
                              title={`${NOME_SLOT[sl]}: ${c.perSlot[sl] ?? 0} piatti — apri l'elenco`}
                              onClick={() => void apri(c, sl)}
                            >
                              {NOME_SLOT[sl]?.slice(0, 3)} {c.perSlot[sl] ?? 0}
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aperta && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>
              {aperta.cella.famiglia} · {NOME_REGIME[aperta.cella.regime] ?? aperta.cella.regime} · {NOME_SLOT[aperta.slot]}
            </h2>
            <button className="btn ghost" onClick={() => { setAperta(null); setRicette(null); }}>Chiudi</button>
          </div>
          {(aperta.slot === 'morning_snack' || aperta.slot === 'afternoon_snack') && (
            <p className="muted" style={{ marginTop: 4 }}>
              ⚠️ Spuntino e merenda pescano dallo stesso paniere: qui sotto ci sono i piatti di
              tutti e due, ed è quello che vede la cliente.
            </p>
          )}
          {!ricette ? <Spinner /> : ricette.length === 0 ? (
            <p className="muted">Nessun piatto per questo pasto.</p>
          ) : (
            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Piatto</th><th>kcal</th><th>Stato</th>{puoGestire && <th />}
                </tr>
              </thead>
              <tbody>
                {ricette.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.kcal}</td>
                    <td>{r.active ? 'attiva' : <span style={{ color: 'var(--muted)' }}>bozza — il motore non la usa</span>}</td>
                    {puoGestire && (
                      <td>
                        <button className="btn ghost" onClick={() => void togli(r)}>Togli dal paniere</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
