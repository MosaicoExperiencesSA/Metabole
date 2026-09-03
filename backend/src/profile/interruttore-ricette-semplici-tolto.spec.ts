/**
 * ⛔ **L'INTERRUTTORE «RICETTE SEMPLICI» È USCITO DALL'APP, E IL CAMPO È RIMASTO NEL DTO.**
 *
 * Sono due metà che vanno **in due direzioni opposte**, ed è per questo che stanno in una prova
 * sola: fare l'una senza l'altra rompe qualcosa in tutti e due i versi.
 *
 * · La preferenza è uscita dal **motore** il 2/9 (decisione di Simone, dopo il caso Patrizia del
 *   31/8). L'interruttore nel Profilo dell'app è rimasto fino al 3/9: la cliente lo accendeva e
 *   **non succedeva niente**. Un interruttore che non accende nulla è la cosa che `CLAUDE.md` dice
 *   di non lasciare in giro — e quando è la cliente a premerlo è peggio di una chiave di permesso
 *   morta, perché lei ci conta.
 * · ⛔ **Ma `prefersSimpleRecipes` NON va tolto dal DTO nello stesso giro.** L'interruttore sparisce
 *   dai telefoni solo con un rilascio OTA, e le app **già installate** mandano quel campo a ogni
 *   salvataggio del profilo. Un DTO che non lo accetta più risponde **400**: la cliente non
 *   salverebbe più il profilo — nome e allergie comprese — per un campo che non serve a nessuno.
 *   Si pulisce quando le versioni vecchie non sono più in giro, ed è un altro giro.
 *
 * ⚠️ E il valore in banca dati si tiene: dice a chi quella preferenza interessava, e non si ricrea.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto } from './dto/update-profile.dto';

const profiloApp = readFileSync(
  join(__dirname, '..', '..', '..', 'app', 'src', 'pages', 'Profilo.tsx'), 'utf8',
);
/** ⚠️ Sul codice, coi commenti tolti: il file SPIEGA perché l'interruttore è stato tolto, e deve poterlo fare. */
const codice = profiloApp
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ');

describe('«Preferisco ricette semplici»: tolto dall\'app, tenuto nel DTO', () => {
  /** ⛔ A file vuoto o rinominato ogni «non c'è» sarebbe verde sul nulla. */
  it('⛔ il Profilo dell\'app si legge davvero', () => {
    expect(codice).toMatch(/export default function Profilo|function Profilo\(/);
    expect(codice.length).toBeGreaterThan(5000);
  });

  it('⛔ l\'interruttore non c\'è più nell\'app', () => {
    expect(codice).not.toMatch(/SimpleRecipesPref/);
    expect(codice).not.toMatch(/prefersSimpleRecipes/);
    expect(codice).not.toMatch(/Preferisco ricette semplici/);
  });

  /** ⚠️ E il file dice PERCHÉ: senza, fra sei mesi qualcuno lo rimette credendo a una dimenticanza. */
  it('⚠️ e il file dice perché è stato tolto', () => {
    expect(profiloApp).toMatch(/«PREFERISCO RICETTE SEMPLICI» È STATA TOLTA/);
  });

  /**
   * ⛔ **La metà che va nel verso opposto.** Questa prova esiste per il giorno in cui qualcuno,
   * facendo pulizia, toglierà il campo dal DTO «visto che non lo usa più nessuno».
   */
  it('⛔ il DTO accetta ANCORA `prefersSimpleRecipes`: le app vecchie lo mandano', async () => {
    const dto = plainToInstance(UpdateProfileDto, { prefersSimpleRecipes: true });
    const errori = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errori).toEqual([]);
  });

  /**
   * ⚠️ La controprova, nello stesso posto: se il DTO accettasse qualunque cosa, la prova sopra
   * passerebbe anche a campo tolto — e non misurerebbe niente.
   */
  it('⚠️ e un campo inventato invece lo rifiuta: la prova sopra misura davvero', async () => {
    const dto = plainToInstance(UpdateProfileDto, { campoCheNonEsiste: true } as never);
    const errori = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errori.length).toBeGreaterThan(0);
  });
});
