import { describe, expect, it } from 'vitest';
import { giorniPerLaCoda, leggiNumeri, notaGiro, percento, testoAccensione, type InvitoPanoramica } from './invitoGaia';

const base: InvitoPanoramica = {
  impostazioni: { attivo: false, alGiorno: 100, promemoriaGiorni: 15, oraDa: 9, oraA: 20, linkOre: 48 },
  conteggi: { inviati: 0, oggi: 0, falliti: 0, scartati: 0, promemoria: 0, cliccati: 0, entrati: 0, inCoda: 250 },
  obbligoConsenso: false,
  modelliSpenti: [],
  ultimoInvio: null,
  nellaFinestraOra: true,
};

describe('pannello invito a Gaia (16/9)', () => {
  it('giorni per la coda', () => {
    expect(giorniPerLaCoda(250, 100)).toBe(3);
    expect(giorniPerLaCoda(0, 100)).toBe(0);
    expect(giorniPerLaCoda(10, 0)).toBeNull();
    expect(giorniPerLaCoda(NaN, 100)).toBeNull();
  });

  it('percentuali', () => {
    expect(percento(1, 0)).toBe('—');
    expect(percento(5, 100)).toBe('5,0%');
    expect(percento(1, 3)).toBe('33%');
  });

  it('la conferma dice numeri e orari veri', () => {
    const t = testoAccensione(base);
    expect(t).toContain('Da adesso');
    expect(t).toContain('fino a 100 email al giorno');
    expect(t).toContain('fra le 9 e le 20');
    expect(t).toContain('Oggi ne partono fino a 100');
    expect(t).toContain('Dopo 15 giorni');
  });

  it('conta quelli già partiti oggi', () => {
    expect(testoAccensione({ ...base, conteggi: { ...base.conteggi, oggi: 37 } })).toContain('Oggi ne partono fino a 63');
    expect(testoAccensione({ ...base, conteggi: { ...base.conteggi, oggi: 100 } })).toContain('quota di oggi è già raggiunta');
  });

  it('fuori orario e coda corta', () => {
    const t = testoAccensione({ ...base, nellaFinestraOra: false, conteggi: { ...base.conteggi, inCoda: 7 } });
    expect(t).toContain('Dalla prossima fascia oraria (dalle 9)');
    expect(t).toContain('fino a 7');
    const vuota = testoAccensione({ ...base, conteggi: { ...base.conteggi, inCoda: 0 } });
    expect(vuota).toContain('nessuno in coda');
  });

  it('i numeri del modulo: vuoto non è zero', () => {
    const buono = { alGiorno: '100', promemoriaGiorni: '15', oraDa: '9', oraA: '20' };
    expect(leggiNumeri(buono)).toEqual({ ok: true, valori: { alGiorno: 100, promemoriaGiorni: 15, oraDa: 9, oraA: 20 } });
    expect(leggiNumeri({ ...buono, oraDa: '' })).toEqual({ ok: false, errore: 'Dalle ore: scrivi un numero intero.' });
    expect(leggiNumeri({ ...buono, alGiorno: ' ' }).ok).toBe(false);
    expect(leggiNumeri({ ...buono, alGiorno: '1.5' }).ok).toBe(false);
    expect(leggiNumeri({ ...buono, alGiorno: '2000' })).toEqual({ ok: false, errore: 'Email al giorno: deve stare fra 0 e 1000.' });
    expect(leggiNumeri({ ...buono, oraDa: '20' }).ok).toBe(false);
    expect(leggiNumeri({ ...buono, alGiorno: '0' }).ok).toBe(true);
  });

  it('note del giro', () => {
    expect(notaGiro(null)).toBe('completato');
    expect(notaGiro('spento')).toBe('invito spento');
    expect(notaGiro('fuori dalla finestra oraria')).toBe('fuori orario, nessun invio');
  });
});
