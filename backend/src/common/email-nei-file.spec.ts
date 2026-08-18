import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { emailDiPersoneVere } from './email-nei-file';

describe('emailDiPersoneVere', () => {
  it('un dominio di posta vero è una persona vera, e viene segnalata', () => {
    expect(emailDiPersoneVere('scritto da qualcuno@libero.it in fondo')).toEqual([
      { indirizzo: 'qualcuno@libero.it', riga: 1 },
    ]);
  });

  it('i domini finti delle fixture non contano: `@x.it`, `@example.com`, `@metabole.eu`', () => {
    const testo = 'a@x.it, mario@example.com, admin@metabole.eu, c@d.tld';
    expect(emailDiPersoneVere(testo)).toEqual([]);
  });

  it('gli indirizzi ammessi restano, alias con il `+` compresi', () => {
    expect(emailDiPersoneVere('simone.salogni+playreview@gmail.com')).toEqual([]);
  });

  it('dice la riga, perché serve ad andarci', () => {
    const trovate = emailDiPersoneVere('prima\nseconda\nterza qualcuno@tiscali.it');
    expect(trovate).toEqual([{ indirizzo: 'qualcuno@tiscali.it', riga: 3 }]);
  });

  it('un testo pulito torna una lista vuota — il caso normale', () => {
    expect(emailDiPersoneVere('Sonia, finestra «salto la cena», riceve tre pasti')).toEqual([]);
  });

  it('il maiuscolo non è un modo per passare', () => {
    expect(emailDiPersoneVere('QUALCUNO@LIBERO.IT')).toHaveLength(1);
  });
});

/**
 * ⚠️ LA GUARDIA VERA. Passa in rassegna i file versionati: se un'email di una persona vera rientra
 * nel repository, questo test diventa rosso e dice in quale file e a che riga.
 *
 * Il 18/8 la stessa passata trovava 8 clienti in 21 file. Se un giorno torna rossa, la risposta non
 * è allungare la lista degli indirizzi ammessi: è togliere l'indirizzo e scrivere il nome.
 */
describe('⚠️ nessuna email di clienti nei file versionati', () => {
  const radice = path.resolve(__dirname, '..', '..', '..');
  const SALTA_ESTENSIONI = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.zip', '.woff', '.woff2',
    '.ttf', '.eot', '.otf', '.mp4', '.mp3', '.keystore', '.jks', '.map',
  ]);
  // Questi due file parlano del problema: contengono per forza degli esempi.
  const SALTA_FILE = new Set(['backend/src/common/email-nei-file.ts', 'backend/src/common/email-nei-file.spec.ts']);
  const MASSIMO_BYTE = 5 * 1024 * 1024;

  /**
   * ⚠️ `--others --exclude-standard` insieme a `--cached`: si guardano anche i file **non ancora
   * versionati** (esclusi quelli che `.gitignore` tiene fuori). Guardare solo i versionati vorrebbe
   * dire accorgersene **dopo** il commit, cioè dopo che il dato è già nello storico — che è la
   * parte che non si toglie più.
   */
  function fileDaGuardare(): string[] {
    const uscita = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: radice,
      maxBuffer: 64 * 1024 * 1024,
    }).toString('utf8');
    return [...new Set(uscita.split('\0').filter(Boolean))];
  }

  it('git ls-files risponde: senza questo la guardia non guarda niente', () => {
    expect(fileDaGuardare().length).toBeGreaterThan(100);
  });

  it('⚠️ nessun indirizzo di posta vera nei file versionati', () => {
    const colpevoli: string[] = [];
    for (const relativo of fileDaGuardare()) {
      if (SALTA_FILE.has(relativo)) continue;
      if (SALTA_ESTENSIONI.has(path.extname(relativo).toLowerCase())) continue;
      const assoluto = path.join(radice, relativo);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(assoluto);
      } catch {
        continue; // file cancellato ma ancora nell'indice: non è affare di questo test
      }
      if (!stat.isFile() || stat.size > MASSIMO_BYTE) continue;
      const testo = fs.readFileSync(assoluto, 'utf8');
      if (testo.includes('\0')) continue; // binario travestito da testo
      for (const t of emailDiPersoneVere(testo)) {
        colpevoli.push(`${relativo}:${t.riga}  ${t.indirizzo}`);
      }
    }
    expect(colpevoli).toEqual([]);
  });
});
