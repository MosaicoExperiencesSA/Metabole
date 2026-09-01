import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ⛔ **I CANCELLI DI QUESTA PORTA SONO QUELLI DI `deliverIfEligible`, NELLO STESSO ORDINE.**
 *
 * ⚠️ La porta risponde a «perché il motore non compone i menu di questa cliente». Se ne conosce
 * meno di quanti ne ha il motore, risponde **«nessun motivo noto»** su una persona che invece è
 * ferma per una ragione precisa — ed è la risposta peggiore possibile: manda a cercare un difetto
 * dove non c'è, mentre il motore sta facendo esattamente quello che gli è stato chiesto.
 *
 * ⛔ **È successo l'1/9, su cinque clienti vere.** La prima stesura si fermava alla sospensione e
 * non conosceva la misura di partenza: due persone che non avevano **mai** ricevuto un menu e tre
 * ferme da giorni sono comparse sotto «senza un motivo noto». Aspettavano una pesata che nessuno
 * aveva detto loro di fare.
 *
 * Questa sentinella tiene i due elenchi affiancati: ogni cancello che ferma `deliverIfEligible`
 * dev'essere una risposta di questa porta.
 */
describe('la porta conosce tutti i cancelli del motore', () => {
  const dir = join(__dirname);
  const porta = readFileSync(join(dir, 'perche-non-ricompone.ts'), 'utf8');
  const motore = readFileSync(join(dir, 'menu.service.ts'), 'utf8');

  /**
   * I cancelli, col segno che li riconosce nei due file. ⚠️ Si cerca la **condizione**, non una
   * frase: le parole del messaggio cambiano, la condizione no.
   */
  const CANCELLI: { nome: string; nelMotore: RegExp; nellaPorta: RegExp }[] = [
    { nome: 'data di inizio piano', nelMotore: /if \(!profile\?\.planStartDate\) return \[\]/, nellaPorta: /if \(!p\.planStartDate\)/ },
    { nome: 'visita clinica scaduta', nelMotore: /statoSupervisione\([\s\S]{0,80}?'visita_scaduta'/, nellaPorta: /statoSupervisione\([\s\S]{0,120}?'visita_scaduta'/ },
    { nome: 'nessun piano attivo', nelMotore: /if \(!activeSubscription\) return \[\]/, nellaPorta: /if \(!piano\) return/ },
    { nome: 'monitoraggio', nelMotore: /plan\?\.period === 'monitoring'/, nellaPorta: /plan\?\.period === 'monitoring'/ },
    { nome: 'piano concluso', nelMotore: /endDate[\s\S]{0,60}?< toDateOnly\(\)\.getTime\(\)/, nellaPorta: /endDate[\s\S]{0,60}?< toDateOnly\(\)\.getTime\(\)/ },
    { nome: 'piano fermato', nelMotore: /planHeldAt\?: Date \| null \}\)\.planHeldAt\) return \[\]/, nellaPorta: /if \(p\.planHeldAt\)/ },
    /**
     * ⚠️ Il motore chiede la pausa a `EventsService.activePausePeriod`; la porta, che gira anche
     * fuori da Nest, rifà quella query a mano — ed è **dichiarato** dentro `perche-non-ricompone.ts`
     * come copia da tenere allineata. I due segni sono diversi per questo, non per distrazione.
     */
    { nome: 'sospensione', nelMotore: /this\.events\.activePausePeriod\(/, nellaPorta: /mode: 'pause_period'/ },
    { nome: 'misura di partenza', nelMotore: /mancaMisuraDiPartenza\(/, nellaPorta: /mancaMisuraDiPartenza\(/ },
    { nome: 'finestra di visibilità', nelMotore: /today\.getTime\(\) < visibleFrom\.getTime\(\)/, nellaPorta: /< visibileDal\.getTime\(\)/ },
  ];

  it('⛔ ogni cancello del motore ha una risposta nella porta', () => {
    const mancanti = CANCELLI.filter((c) => c.nelMotore.test(motore) && !c.nellaPorta.test(porta)).map((c) => c.nome);
    expect(mancanti).toEqual([]);
  });

  /**
   * ⚠️ **E il contrario: un cancello che il motore non ha più.** Una porta che risponde «è in
   * monitoraggio» quando il motore ha smesso di guardarlo manda a spegnere una cosa che non ferma
   * più niente — e la cliente resta ferma lo stesso.
   */
  it('⚠️ e nessuna risposta della porta è rimasta orfana', () => {
    const orfani = CANCELLI.filter((c) => c.nellaPorta.test(porta) && !c.nelMotore.test(motore)).map((c) => c.nome);
    expect(orfani).toEqual([]);
  });

  /**
   * ⛔ **Un cancello che il motore ha e la porta no la sentinella lo deve VEDERE.** Se le due
   * espressioni fossero scritte male, questa prova resterebbe verde su una porta monca — che è
   * esattamente lo stato da cui viene.
   */
  it('⛔ e la sentinella si accorge di una porta monca', () => {
    const portaMonca = porta.replace(/mancaMisuraDiPartenza\(/g, 'xxx(');
    const mancanti = CANCELLI.filter((c) => c.nelMotore.test(motore) && !c.nellaPorta.test(portaMonca)).map((c) => c.nome);
    expect(mancanti).toEqual(['misura di partenza']);
  });

  /**
   * ⚠️ La pesata del rientro NON è in elenco, ed è dichiarato: dipende dal giorno di rientro
   * calcolato dentro il motore da tre rami diversi (pausa in corso, pausa appena finita, anticipo),
   * e rifarlo qui vorrebbe dire copiare quella logica — cioè la seconda copia della cosa più
   * delicata. Chi legge «nessun motivo noto» su una cliente appena rientrata da una pausa guardi lì.
   */
  it('⚠️ la pesata del rientro resta fuori, e la porta lo dice a chi legge', () => {
    expect(motore).toMatch(/mancaLaPesataDelRientro\(/);
    expect(porta).toMatch(/pesata del rientro/i);
  });
});
