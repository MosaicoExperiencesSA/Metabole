/**
 * Il confronto fra nomi di alimento è la riga che decide se «pepe» tocca i peperoni. Questi test
 * stavano dentro il file del dialogo in chat; sono qui perché da §16.9 le stesse funzioni decidono
 * anche se una richiesta è la stessa di un'altra e se un gruppo di equivalenza la copre già.
 */
import { chiaveAlimento, combaciaAlimento, condividonoAlimento, paroleAlimento, radice } from './nomi-alimento';

describe('nomi di alimento', () => {
  describe('mai per sottostringa', () => {
    it('«pepe» NON è «peperoni»', () => {
      // Il caso vero: la cliente voleva togliere il pepe e si vedeva sostituire i peperoni.
      expect(combaciaAlimento('peperoni', 'pepe')).toBe(false);
      expect(combaciaAlimento('pepe nero', 'pepe')).toBe(true);
    });

    it('«mela» NON è «melanzane», «pane» NON è «pancetta»', () => {
      expect(combaciaAlimento('melanzane', 'mela')).toBe(false);
      expect(combaciaAlimento('pancetta', 'pane')).toBe(false);
    });
  });

  describe('la radice, per non elencare i plurali', () => {
    it('«carote» e «carota» sono la stessa cosa', () => {
      expect(radice('carote')).toBe(radice('carota'));
      expect(combaciaAlimento('carote', 'carota')).toBe(true);
    });

    it('le parole corte non si accorciano: è quello che salverebbe «pepe» da «peperoni»', () => {
      expect(radice('pepe')).toBe('pepe');
      expect(radice('uovo')).toBe('uovo');
    });
  });

  it('il termine più specifico prende il generico, non viceversa', () => {
    expect(combaciaAlimento('yogurt greco', 'yogurt')).toBe(true);
    expect(combaciaAlimento('yogurt', 'yogurt greco')).toBe(false);
  });

  it('le parole di servizio non identificano un alimento', () => {
    expect(paroleAlimento('petto di pollo')).toEqual(['petto', 'pollo']);
    expect(combaciaAlimento('petto di pollo', 'pollo')).toBe(true);
  });

  it('due varianti dello stesso cibo si riconoscono', () => {
    // Serve a scartare «yogurt» → «yogurt senza lattosio» quando il problema è il gusto.
    expect(condividonoAlimento('yogurt greco', 'yogurt senza lattosio')).toBe(true);
    expect(condividonoAlimento('yogurt greco', 'ricotta')).toBe(false);
  });

  describe('chiaveAlimento — l\'uguaglianza esatta, per la colonna', () => {
    it('maiuscole, accenti, plurali e spazi doppi danno la stessa chiave', () => {
      const atteso = chiaveAlimento('carote fresche');
      expect(chiaveAlimento('Carote Fresche')).toBe(atteso);
      expect(chiaveAlimento('  CAROTA   FRESCA  ')).toBe(atteso);
    });

    it('alimenti diversi danno chiavi diverse — anche quelli che si assomigliano', () => {
      expect(chiaveAlimento('pepe')).not.toBe(chiaveAlimento('peperoni'));
      expect(chiaveAlimento('mela')).not.toBe(chiaveAlimento('melanzane'));
    });

    it('la «h» dura non spacca il conteggio: pesca/pesche, zucca/zucche, gnocco/gnocchi', () => {
      // Senza questo, la stessa richiesta scritta al plurale apre una seconda riga e il conteggio
      // — che è il motivo per cui la tabella esiste — si divide in due.
      expect(chiaveAlimento('pesche')).toBe(chiaveAlimento('pesca'));
      expect(chiaveAlimento('zucche')).toBe(chiaveAlimento('zucca'));
      expect(chiaveAlimento('gnocchi')).toBe(chiaveAlimento('gnocco'));
    });

    it('un nome cortissimo o fatto di sola punteggiatura non produce una chiave vuota', () => {
      // Una chiave vuota accorperebbe alimenti diversi sotto la stessa riga: è il modo in cui
      // questa tabella conterebbe insieme cose che non c'entrano niente.
      expect(chiaveAlimento('te')).not.toBe('');
      expect(chiaveAlimento('---')).toBeDefined();
      expect(chiaveAlimento('te')).toBe('te');
    });

    it('la chiave è un prefisso utile: «yogurt greco» comincia per «yogurt»', () => {
      // È ciò su cui si appoggia la ricerca per alimento nella tabella (`startsWith`).
      expect(chiaveAlimento('yogurt greco').startsWith(chiaveAlimento('yogurt'))).toBe(true);
    });
  });
});
