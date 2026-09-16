import { describe, expect, it } from 'vitest';
import {
  MAX_BYTES_ALLEGATO,
  fotoDaRidurre,
  nomeCorto,
  pesoDetto,
  problemaAllegato,
  tipoDelFile,
} from './allegati';

describe('⛔ allegati in chat — le regole del browser (16/9)', () => {
  it('il tipo arriva dal telefono, e se manca dall\'estensione', () => {
    expect(tipoDelFile('x.PDF', '')).toBe('application/pdf');
    expect(tipoDelFile('x.heic', '')).toBe('image/heic');
    expect(tipoDelFile('x.pdf', 'image/png')).toBe('image/png');
    expect(tipoDelFile('x.exe', '')).toBe('');
    // Tipi dichiarati male o generici: si ripiega sull'estensione.
    expect(tipoDelFile('ricetta.docx', 'application/octet-stream')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(tipoDelFile('foto.jpg', 'image/jpg')).toBe('image/jpeg');
    expect(tipoDelFile('foto', 'IMAGE/PNG')).toBe('image/png');
    // Un tipo non ammesso e un'estensione sconosciuta restano quello che sono: poi `problemaAllegato` dice di no.
    expect(tipoDelFile('pagina.html', 'text/html')).toBe('text/html');
  });

  it('il nome lungo si accorcia come farebbe il server, estensione salva', () => {
    expect(nomeCorto('breve.pdf')).toBe('breve.pdf');
    const n = nomeCorto(`${'a'.repeat(200)}.pdf`);
    expect(n.length).toBe(120);
    expect(n.endsWith('.pdf')).toBe(true);
  });

  it('⛔ tipo non ammesso, vuoto, troppo grande: la frase prima di mandare', () => {
    expect(problemaAllegato('text/html', 10)).toMatch(/non si può allegare/);
    expect(problemaAllegato('', 10)).toMatch(/non si può allegare/);
    expect(problemaAllegato('application/pdf', 0)).toMatch(/vuoto/);
    expect(problemaAllegato('application/pdf', MAX_BYTES_ALLEGATO + 1)).toMatch(/8 MB/);
    expect(problemaAllegato('application/pdf', MAX_BYTES_ALLEGATO)).toBeNull();
  });

  it('si rimpiccioliscono solo le foto che il browser sa disegnare, e solo se grandi', () => {
    expect(fotoDaRidurre('image/jpeg', 3_000_000, 1000)).toBe(true);
    expect(fotoDaRidurre('image/jpeg', 200_000, 4000)).toBe(true);
    expect(fotoDaRidurre('image/jpeg', 200_000, 1500)).toBe(false);
    expect(fotoDaRidurre('image/heic', 5_000_000, 4000)).toBe(false);
    expect(fotoDaRidurre('application/pdf', 5_000_000, 0)).toBe(false);
  });

  it('il peso si dice come lo si legge', () => {
    expect(pesoDetto(1536 * 1024)).toBe('1,5 MB');
    expect(pesoDetto(820 * 1024)).toBe('820 KB');
    expect(pesoDetto(10)).toBe('1 KB');
    expect(pesoDetto(1024 * 1024)).toBe('1,0 MB');
  });
});
