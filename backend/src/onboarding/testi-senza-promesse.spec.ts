import { ONBOARDING_QUESTIONS } from './onboarding.questions';

/**
 * ⚠️ I TESTI DEL QUESTIONARIO NON PROMETTONO COSE CHE NON CI SONO.
 *
 * Nasce da un difetto vero, trovato il 19/8 sera cercando tutt'altro: la pagina delle misure di
 * partenza diceva a ogni cliente «Se non sai come prenderle, **guarda il video toccando il
 * pulsante**». Il pulsante non c'è e il video non c'è — non esiste nessun `<video>` in tutta l'app.
 * La frase veniva dal prototipo, dove due schermate erano video di presentazione: ⛔ quei video
 * Simone li ha annullati il 17/07, e il testo che li citava è rimasto in produzione per settimane.
 *
 * ⚠️ **Un difetto di testo non è un difetto minore quando il testo è una promessa.** Quella frase
 * stava nel punto più delicato del questionario — le prime misure di una persona — e chi cercava il
 * pulsante e non lo trovava pensava di aver sbagliato lei.
 *
 * ⛔ Questo test non verifica la grammatica: verifica che **non si prometta un media che il prodotto
 * non ha**. Il giorno che il video si farà, si toglie la parola da questo elenco insieme al
 * pulsante — in un posto solo, e la cosa si vede nel commit.
 */
const PROMESSE_CHE_NON_POSSIAMO_MANTENERE = [
  /\bvideo\b/i,
  /\bfilmat/i,
  /\btutorial\b/i,
  /guarda il\b/i,
];

describe('i testi del questionario non promettono cose che non esistono', () => {
  type Pagina = { key: string; title?: string; subtitle?: string; fields?: readonly { key: string; label?: string }[] };
  const pagine = ONBOARDING_QUESTIONS.pages as readonly Pagina[];
  const testi = pagine.flatMap((p) => [
    { dove: `${p.key}.title`, testo: p.title ?? '' },
    { dove: `${p.key}.subtitle`, testo: p.subtitle ?? '' },
    ...(p.fields ?? []).map((f) => ({ dove: `${p.key}.${f.key}`, testo: f.label ?? '' })),
  ]);

  it('⚠️ nessun testo manda la cliente a cercare un video o un pulsante che non c\'è', () => {
    const colpevoli = testi.filter((t) => PROMESSE_CHE_NON_POSSIAMO_MANTENERE.some((r) => r.test(t.testo)));
    expect(colpevoli.map((c) => `${c.dove}: ${c.testo}`)).toEqual([]);
  });

  /** E la pagina che aveva il difetto continua a dire alla cliente **dove** chiedere aiuto. */
  it('la pagina delle misure dice ancora dove chiedere, ma di una cosa che esiste', () => {
    const baseline = (ONBOARDING_QUESTIONS.pages as readonly { key: string; subtitle?: string }[]).find((p) => p.key === 'baseline');
    expect(baseline?.subtitle).toContain('chat');
  });
});
