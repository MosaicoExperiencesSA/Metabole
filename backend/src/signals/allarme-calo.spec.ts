import { MIN_GIORNI_DEFAULT, MIN_PESATE_DEFAULT, spiegaAllarmeSpento, statoAllarmeCalo } from './allarme-calo';

const G = 86_400_000;
const d = (iso: string) => new Date(`${iso}T08:00:00.000Z`);
const pesata = (iso: string, value = 70) => ({ date: d(iso), value });

describe('statoAllarmeCalo — «Autorizza a proseguire» azzera il calcolo, non i progressi', () => {
  it('senza baseline: tutto come prima, si guardano tutte le pesate', () => {
    const p = [pesata('2026-08-01'), pesata('2026-08-03'), pesata('2026-08-05')];
    const e = statoAllarmeCalo(p, null, d('2026-08-06'));
    expect(e.armato).toBe(true);
    expect(e.pesate).toHaveLength(3);
  });

  it('subito dopo l’autorizzazione l’allarme NON suona', () => {
    // Il caso che rende il pulsante una finta: due pesate ravvicinate ricostruiscono una pendenza
    // enorme, e l'allarme tornerebbe il giorno dopo l'ok del nutrizionista.
    const baseline = d('2026-08-10');
    const p = [pesata('2026-08-10'), pesata('2026-08-11'), pesata('2026-08-11')];
    const e = statoAllarmeCalo(p, baseline, d('2026-08-11'));
    expect(e.armato).toBe(false);
    expect(e.motivo).toBe('attesa_giorni');
  });

  it('passati i giorni ma con poche pesate: ancora spento, e lo dice', () => {
    const baseline = d('2026-08-01');
    const p = [pesata('2026-08-01'), pesata('2026-08-06')]; // una sola nuova
    const e = statoAllarmeCalo(p, baseline, d('2026-08-07'));
    expect(e.armato).toBe(false);
    expect(e.motivo).toBe('attesa_pesate');
    expect(e.pesateMancanti).toBe(MIN_PESATE_DEFAULT - 1);
    expect(spiegaAllarmeSpento(e)).toContain('2 pesate');
  });

  it('con 4 giorni E 3 pesate nuove torna armato, e calcola SOLO sulle nuove', () => {
    const baseline = d('2026-08-01');
    const p = [
      pesata('2026-07-28', 80), // vecchie: restano fuori dal calcolo dell'allarme
      pesata('2026-07-30', 78),
      pesata('2026-08-01', 77), // il giorno stesso dell'autorizzazione NON conta: è la pesata che
      //                            ha fatto scattare l'allarme, non una prova che vada meglio
      pesata('2026-08-03', 76),
      pesata('2026-08-05', 75.5),
      pesata('2026-08-06', 75),
    ];
    const e = statoAllarmeCalo(p, baseline, d('2026-08-06'));
    expect(e.armato).toBe(true);
    expect(e.pesate.map((x) => x.value)).toEqual([76, 75.5, 75]);
  });

  it('il pavimento è configurabile: sono numeri clinici, li cambia il nutrizionista', () => {
    const baseline = d('2026-08-01');
    const p = [pesata('2026-08-02'), pesata('2026-08-03')];
    // Col pavimento di default (4 giorni, 3 pesate) sarebbe spento; con 1 e 2 è armato.
    expect(statoAllarmeCalo(p, baseline, d('2026-08-03')).armato).toBe(false);
    expect(statoAllarmeCalo(p, baseline, d('2026-08-03'), 1, 2).armato).toBe(true);
  });

  it('i due default sono quelli decisi: 4 giorni e 3 pesate', () => {
    expect(MIN_GIORNI_DEFAULT).toBe(4);
    expect(MIN_PESATE_DEFAULT).toBe(3);
  });

  it('quando è armato non c’è niente da spiegare', () => {
    const e = statoAllarmeCalo([pesata('2026-08-06')], null, d('2026-08-06'));
    expect(spiegaAllarmeSpento(e)).toBeNull();
  });

  it('un baseline nel futuro non fa danni: nessuna pesata nuova, allarme spento e motivo esplicito', () => {
    // Non dovrebbe capitare, ma un orologio storto o un dato importato non devono produrre un
    // guardrail che si comporta in modo casuale.
    const e = statoAllarmeCalo([pesata('2026-08-06')], new Date(d('2026-08-06').getTime() + 5 * G), d('2026-08-06'));
    expect(e.armato).toBe(false);
    expect(e.pesate).toHaveLength(0);
  });
});
