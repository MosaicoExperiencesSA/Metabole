/**
 * ⛔ **LA PORTA CHE LA REGOLA PROMETTE.**
 *
 * Dal 25/8 la cliente può cambiare le ore del digiuno una volta a settimana, e la frase che legge
 * quando non può le dice: *«se ti serve prima, scrivilo alla tua nutrizionista: lo cambia lei»*.
 * ⛔ Quella porta non esisteva: dal 21/8 la tendina della finestra è fuori dalla scheda staff, e in
 * tutto il backend nessuno poteva cambiare il protocollo di una cliente. Un limite senza la sua
 * porta è un cancello chiuso, con in più una frase che fa credere il contrario.
 */
import { chiedeUnCambioDiDigiuno, clienteDopoIlVerbo, inChiaro, leggiDigiunoDettato } from './digiuno-dettato';

describe('⛔ leggere il protocollo dalla frase', () => {
  /**
   * ⛔ **I DUE PUNTI SI LEGGONO SEMPRE, GLI ALTRI SEPARATORI SOLO NEL CONTESTO** — corretto al
   * secondo giro di revisione, 25/8. Le cinque coppie del catalogo sono tutte **date plausibili**
   * (14/10, 16/8, 18/6, 20/4, 23/1), e «sposta la visita di Giulia al 14/10» apriva un'anteprima
   * «sto per mettere Giulia a 14:10… Confermi?». In una chat dove si risponde «sì» di corsa, quello
   * scrive un cambio clinico su una frase che parlava di un appuntamento.
   */
  it('⛔ coi due punti si legge sempre: «16:8» non è né una data né un\'ora', () => {
    expect(leggiDigiunoDettato('metti Giulia a 16:8')).toEqual({ protocollo: '16:8' });
  });

  it('⛔ con la barra o il trattino solo se la frase nomina il digiuno', () => {
    for (const forma of ['16/8', '16-8', '16 8']) {
      expect(leggiDigiunoDettato(`metti Giulia a ${forma}`)).toBeNull();
      expect(leggiDigiunoDettato(`metti il digiuno di Giulia a ${forma}`)).toEqual({ protocollo: '16:8' });
    }
  });

  /** ⛔ E la prova del difetto: una data resta una data. */
  it('⛔ «sposta la visita di Giulia al 14/10» NON è un cambio di digiuno', () => {
    expect(leggiDigiunoDettato('sposta la visita di Giulia al 14/10')).toBeNull();
    expect(leggiDigiunoDettato('metti il controllo di Giulia il 20/4')).toBeNull();
    expect(leggiDigiunoDettato('sposta l\'appuntamento di Anna al 18/6')).toBeNull();
  });

  /**
   * ⚠️ **Il NOME che la schermata mostra** — la nutrizionista guarda la stessa pagina della cliente,
   * e quella scrive «Standard», non «16:8». ⛔ Ma solo se la frase parla di digiuno: «standard» è una
   * parola che si scrive tutti i giorni, e senza il contesto «metti la dieta standard a Giulia»
   * diventava l'ordine di portarla a 16:8.
   */
  it('⚠️ col nome dello schermo, quando la frase parla di digiuno', () => {
    expect(leggiDigiunoDettato('passa Giulia al digiuno standard')).toEqual({ protocollo: '16:8' });
    expect(leggiDigiunoDettato('metti il digiuno di Giulia su avanzato')).toEqual({ protocollo: '18:6' });
    expect(leggiDigiunoDettato('cambia il protocollo di Giulia in OMAD')).toEqual({ protocollo: '23:1' });
  });

  it('⛔ ma «standard» dentro una frase sulla dieta resta una dieta', () => {
    expect(leggiDigiunoDettato('metti la dieta standard a Giulia')).toBeNull();
    expect(leggiDigiunoDettato('rimetti la porzione standard a Giulia')).toBeNull();
    expect(leggiDigiunoDettato('metti a Giulia il pane standard')).toBeNull();
  });

  /**
   * ⛔ **Un protocollo che non esiste non si scrive.** «15:9» è perfettamente formato e non è nel
   * catalogo: accettarlo metterebbe nel profilo di una persona una finestra che l'orologio non sa
   * disegnare. *«Non lo so» deve costare meno di «ho indovinato».*
   */
  it('⛔ un protocollo fuori catalogo non si legge', () => {
    expect(leggiDigiunoDettato('metti Giulia a 15:9')).toBeNull();
    expect(leggiDigiunoDettato('metti Giulia a 12:12')).toBeNull();
    expect(leggiDigiunoDettato('metti il digiuno di Giulia a 15:9')).toBeNull();
    expect(leggiDigiunoDettato('cambia il digiuno di Giulia')).toBeNull();
  });

  it('⚠️ e una frase senza numeri né nomi non produce niente', () => {
    expect(leggiDigiunoDettato('')).toBeNull();
    expect(leggiDigiunoDettato('come sta Giulia?')).toBeNull();
  });
});

describe('⛔ quando la frase è un ordine, e quando è una constatazione', () => {
  it('⛔ serve un verbo di comando insieme alla parola digiuno', () => {
    expect(chiedeUnCambioDiDigiuno('metti Giulia a 16:8 di digiuno')).toBe(true);
    expect(chiedeUnCambioDiDigiuno('cambia la finestra di Giulia')).toBe(true);
    expect(chiedeUnCambioDiDigiuno('correggi il protocollo di Anna')).toBe(true);
  });

  /**
   * ⛔ **Una constatazione non è un ordine.** «Giulia fa 16:8 da un mese» racconta un fatto: se
   * bastasse la parola «digiuno», Vera scriverebbe nel profilo di una persona per una frase detta
   * a se stessa. È lo stesso criterio della controproposta in chat — un alimento nominato non è un
   * alimento chiesto.
   */
  it('⛔ una constatazione non lo è', () => {
    expect(chiedeUnCambioDiDigiuno('Giulia fa 16:8 da un mese')).toBe(false);
    expect(chiedeUnCambioDiDigiuno('quante clienti sono in digiuno?')).toBe(false);
  });

  it('⚠️ e un ordine che non parla di digiuno nemmeno', () => {
    expect(chiedeUnCambioDiDigiuno('metti Giulia sulla mediterranea')).toBe(false);
    expect(chiedeUnCambioDiDigiuno('')).toBe(false);
  });
});

/**
 * ⚠️ **Il riepilogo dice le ore, non il codice.** «16:8» è un codice: chi conferma una scrittura sul
 * piano di una persona deve leggere quante ore digiuna, che è la cosa che sta decidendo.
 */
describe('⚠️ il protocollo scritto in chiaro', () => {
  it('⚠️ dice il nome e le ore', () => {
    expect(inChiaro('16:8')).toBe('16:8 (Standard: 16 ore di digiuno, 8 di finestra)');
    expect(inChiaro('23:1')).toBe('23:1 (OMAD: 23 ore di digiuno, 1 di finestra)');
  });

  it('⚠️ e su un valore che non conosce non inventa niente', () => {
    expect(inChiaro('15:9')).toBe('15:9');
  });
});

/**
 * ⛔ **IL NOME NELLE DUE FORME CHE IL LETTORE GENERALE NON LEGGE.**
 *
 * `nomePersona` (in `capisci.ts`) cerca la persona dopo una preposizione — «a Giulia», «per Anna» —
 * e fa bene: una parola maiuscola a caso non è un nome, e attribuire una regola alla persona
 * sbagliata è il difetto peggiore che quel file possa avere. ⚠️ Ma nelle frasi sul digiuno la
 * preposizione sta davanti al **protocollo** («metti Giulia **a** 18:6») o è un possessivo («il
 * digiuno **di** Giulia»), e Vera rispondeva «su quale cliente?» a frasi che il nome ce l'avevano
 * scritto in mezzo. Trovato scrivendo i test del dialogo.
 */
describe('⛔ il nome della cliente nelle frasi sul digiuno', () => {
  it('⛔ subito dopo il verbo', () => {
    expect(clienteDopoIlVerbo('metti Giulia a 18:6')).toBe('Giulia');
    expect(clienteDopoIlVerbo('sposta Anna Rossi su 16:8')).toBe('Anna Rossi');
  });

  it('⛔ e nel possessivo', () => {
    expect(clienteDopoIlVerbo('cambia il digiuno di Giulia')).toBe('Giulia');
    expect(clienteDopoIlVerbo('correggi la finestra della Rossi')).toBe('Rossi');
  });

  /**
   * ⚠️ **Una parola minuscola non è un nome**, ed è la rete che rende accettabile allargare la
   * lettura qui: senza la maiuscola, «metti il digiuno a 18:6» darebbe la cliente «il».
   */
  it('⚠️ una parola minuscola non diventa una persona', () => {
    expect(clienteDopoIlVerbo('metti il digiuno a 18:6')).toBeNull();
    expect(clienteDopoIlVerbo('cambia la finestra')).toBeNull();
  });

  it('⚠️ e una frase senza nomi non ne inventa', () => {
    expect(clienteDopoIlVerbo('')).toBeNull();
    expect(clienteDopoIlVerbo('quante clienti sono a 16:8?')).toBeNull();
  });
});

/**
 * ⛔ **«metti Giulia a 18:6» NON contiene la parola digiuno**, ed è la forma più naturale che esista.
 * Pretenderla avrebbe lasciato fuori proprio quella. La strada si apre lo stesso perché nella frase
 * c'è un **protocollo del catalogo** — che è il contesto, e tiene fuori gli orari: «16:8» non è
 * un'ora (quelle si scrivono `16:08`), e «12:12», che come coppia esiste, non è un protocollo.
 */
describe('⛔ un protocollo vero apre la strada anche senza la parola «digiuno»', () => {
  it('⛔ «metti Giulia a 18:6» è un ordine', () => {
    expect(chiedeUnCambioDiDigiuno('metti Giulia a 18:6')).toBe(true);
  });

  it('⛔ ma «12:12» non è un protocollo, quindi non apre niente', () => {
    expect(chiedeUnCambioDiDigiuno('metti Giulia a 12:12')).toBe(false);
  });

  it('⚠️ e un orario vero nemmeno', () => {
    expect(chiedeUnCambioDiDigiuno('sposta la visita di Giulia alle 16:08')).toBe(false);
  });
});

/**
 * ⛔ **CON LA MAIUSCOLA, cioè come si scrive davvero.**
 *
 * Il verbo si cercava senza il flag `i` mentre il nome pretende l'iniziale maiuscola: le due
 * condizioni non potevano essere vere insieme a inizio frase. «Metti Giulia a 18:6» — la forma
 * citata nella specifica e nella voce di lavoro — non trovava nessun nome, e il ripiego generale
 * rispondeva **«Metti Giulia»**: Vera cercava una cliente che si chiama così e diceva di non
 * trovarla. La porta appena costruita era chiusa sulla frase per cui era stata costruita.
 */
describe('⛔ il nome anche quando la frase comincia con la maiuscola', () => {
  it('⛔ «Metti Giulia a 18:6» trova Giulia, non «Metti Giulia»', () => {
    expect(clienteDopoIlVerbo('Metti Giulia a 18:6')).toBe('Giulia');
    expect(clienteDopoIlVerbo('Porta Giulia a 20:4')).toBe('Giulia');
    expect(clienteDopoIlVerbo('Passa Anna Rossi su avanzato')).toBe('Anna Rossi');
  });

  it('⚠️ e la forma minuscola continua a funzionare', () => {
    expect(clienteDopoIlVerbo('metti Giulia a 18:6')).toBe('Giulia');
  });
});
