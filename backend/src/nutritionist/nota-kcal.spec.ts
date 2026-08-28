import { cosaEStatoScritto, testoNotaKcal, versoKcal, DatiNotaKcal } from './nota-kcal';

const BASE: DatiNotaKcal = {
  targetPrima: 1600,
  targetDopo: 1760,
  deficitKcal: null,
  correzionePct: 10,
  fino: new Date('2026-09-04T00:00:00.000Z'),
  perGiorni: 7,
  chi: 'Dr.ssa Bini',
  quando: new Date('2026-08-28T09:30:00.000Z'),
  motivo: 'energia bassa da due settimane',
};

describe('la riga che resta in scheda quando qualcuno tocca le calorie', () => {
  it('⛔ dice chi, quando, di quanto e perché — tutte e quattro', () => {
    const t = testoNotaKcal(BASE);
    expect(t).toContain('Dr.ssa Bini');
    expect(t).toContain('28/08/2026');
    expect(t).toContain('+10%');
    expect(t).toContain('da 1600 a 1760 kcal/giorno');
    expect(t).toContain('energia bassa da due settimane');
  });

  it('⚠️ e l\'intestazione è quella chiesta da Simone, alla lettera', () => {
    expect(testoNotaKcal(BASE)).toMatch(/^Aumento calorie autorizzato da /);
  });

  /**
   * ⛔ **IL VERSO LO DICE IL TARGET, NON IL SEGNO DELLA PERCENTUALE.** Le leve sono due e tirano in
   * direzioni opposte: togliere il deficit ALZA il piatto senza nessuna percentuale positiva, e
   * scrivere +5% mentre si aggiunge un deficit di 400 lo abbassa. Chi rilegge la nota vuole sapere
   * se quella persona ha cominciato a mangiare di più o di meno.
   */
  it('⛔ togliere il deficit è un AUMENTO, anche senza nessuna percentuale positiva', () => {
    const t = testoNotaKcal({ ...BASE, correzionePct: null, deficitKcal: null, fino: null, perGiorni: null, targetPrima: 1400, targetDopo: 1700 });
    expect(t).toMatch(/^Aumento calorie autorizzato/);
  });

  it('⛔ e una percentuale POSITIVA con un deficit più grosso è una RIDUZIONE', () => {
    const t = testoNotaKcal({ ...BASE, correzionePct: 5, deficitKcal: 400, targetPrima: 1700, targetDopo: 1350 });
    expect(t).toMatch(/^Riduzione calorie decisa/);
    // ⚠️ Le due leve compaiono tutt'e due: chi legge deve poter rifare il conto.
    expect(t).toContain('+5%');
    expect(t).toContain('deficit 400 kcal/giorno');
  });

  /** ⚠️ Quando un target non si sa (profilo incompleto) non si indovina il verso. */
  it('⚠️ senza i due target la nota non dice né su né giù', () => {
    const t = testoNotaKcal({ ...BASE, targetPrima: null, targetDopo: null });
    expect(t).toMatch(/^Calorie corrette da /);
    expect(t).not.toContain('kcal/giorno (');
    expect(versoKcal(null, 1700)).toBeNull();
    expect(versoKcal(1700, null)).toBeNull();
  });

  it('⚠️ un target invariato non è né un aumento né una riduzione', () => {
    expect(versoKcal(1600, 1600)).toBe('fermo');
    expect(testoNotaKcal({ ...BASE, targetDopo: 1600 })).toMatch(/^Calorie corrette da /);
  });

  /**
   * ⚠️ **«Per 7 giorni» e «per sempre» sono due prescrizioni diverse**, e il silenzio le fa sembrare
   * uguali: senza scadenza la nota lo dice a parole.
   */
  it('⚠️ la durata c\'è sempre: o la data, o «senza scadenza»', () => {
    expect(cosaEStatoScritto(BASE)).toBe('+10% per 7 giorni, fino al 04/09/2026');
    expect(cosaEStatoScritto({ ...BASE, fino: null, perGiorni: null })).toBe('+10% senza scadenza');
    expect(cosaEStatoScritto({ ...BASE, perGiorni: 1 })).toContain('per 1 giorno,');
  });

  /** ⚠️ E quando non resta niente lo dice: una nota che elenca zero cose sembra una modifica non avvenuta. */
  it('⚠️ togliere tutto è una riga, non una riga vuota', () => {
    const t = testoNotaKcal({ ...BASE, correzionePct: null, deficitKcal: null, fino: null, perGiorni: null });
    expect(t).toContain('tolta ogni correzione scritta a mano');
    expect(t).toContain('si torna al calcolo automatico');
  });

  it('⚠️ un deficit a 0 vale come nessun deficit, non come «deficit 0»', () => {
    expect(cosaEStatoScritto({ ...BASE, correzionePct: null, deficitKcal: 0 })).toContain('tolta ogni correzione');
  });

  /** ⚠️ Mai una riga senza un soggetto: se il nome non si sa, si scrive comunque qualcosa. */
  it('⚠️ senza il nome di chi ha deciso la frase regge lo stesso', () => {
    expect(testoNotaKcal({ ...BASE, chi: '   ' })).toContain('autorizzato da staff il');
  });

  /**
   * ⛔ **LA DATA È QUELLA DI ROMA, non quella UTC** (test aggiunto in revisione: il commento che lo
   * spiegava non aveva il suo caso, e la mutazione `giornoLocale` → data grezza restava verde).
   *
   * Una decisione presa all'una e mezza di notte a Roma è del giorno **dopo** rispetto a UTC. Questa
   * nota esiste per rispondere alla domanda «quando»: sbagliarla di un giorno, e proprio sulle
   * decisioni prese di notte, è il modo più silenzioso di renderla inutile.
   */
  it('⛔ una decisione dell\'una di notte a Roma porta la data di Roma', () => {
    // 28/08 23:30 UTC = 29/08 01:30 a Roma.
    const t = testoNotaKcal({ ...BASE, quando: new Date('2026-08-28T23:30:00.000Z') });
    expect(t).toContain('il 29/08/2026');
    expect(t).not.toContain('il 28/08/2026');
  });

  it('⚠️ le date sono quelle che legge una persona, non ISO', () => {
    const t = testoNotaKcal(BASE);
    expect(t).not.toContain('2026-08-28');
    expect(t).not.toContain('2026-09-04');
  });
});
