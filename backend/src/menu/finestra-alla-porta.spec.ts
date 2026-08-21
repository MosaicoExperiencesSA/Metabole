/**
 * ⛔ **I DUE CANCELLI CHE RIFIUTANO `fastingWindow` — e il `null` che ci passava in mezzo.**
 *
 * Dal 21/8 la finestra la scrive solo l'orologio della cliente. I due DTO che prima l'accettavano —
 * quello della cliente (`PATCH /me/client-profile`) e quello dello staff (`PATCH /admin/clients/:id`)
 * — la **dichiarano ancora** e la **rifiutano**, e non è una contraddizione: l'API ha
 * `forbidNonWhitelisted: true`, quindi un campo non dichiarato non viene ignorato, fa fallire **tutta
 * la richiesta** con «property fastingWindow should not exist».
 *
 * ⚠️ Chi la manda ancora esiste, ed è gente vera: le app non ancora aggiornate (l'OTA non arriva a
 * tutte nello stesso istante) e le schede di backoffice aperte prima del deploy, che mandavano
 * `fastingWindow: ''` a **ogni** salvataggio. Senza la dichiarazione, una nutrizionista con la scheda
 * aperta da stamattina non sarebbe più riuscita a salvare nemmeno un numero di telefono.
 *
 * ## ⛔ E la ragione per cui questo file esiste: `@IsOptional` non voleva dire quello
 *
 * La prima stesura aveva `@IsOptional() @IsIn([])`. `@IsOptional` non vuol dire «se c'è, validalo»:
 * vuol dire «salta i controlli quando il valore è `undefined` **o `null`**». Quindi
 * `{"fastingWindow": null}` passava il cancello, finiva nel `...rest` scritto alla cieca, e mandava
 * la colonna a NULL **lasciando protocollo, orario e `fastingSceltoIl` scritti**: le fasce si
 * calcolano da quelli, quindi lo schermo continuava a dire «20:00 – 21:00 · 1 pasto» mentre il motore
 * le mandava tutti e cinque i pasti. Schermo e piatto che dicono due cose diverse — cioè il difetto
 * che questa consegna esiste per chiudere, rientrato dalla porta del cancello che doveva chiuderlo.
 *
 * ⚠️ Il difetto non si vedeva da nessun test: la suite provava `'skip_breakfast'` e `''`, e su quelli
 * il cancello funzionava. Si prova **`class-validator` vero**, non la lettura del decoratore.
 */
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { UpdateProfileDto } from '../profile/dto/update-profile.dto';

const CANCELLI = [
  ['la cliente (PATCH /me/client-profile)', UpdateProfileDto],
  ['lo staff (PATCH /admin/clients/:id)', UpdateClientDto],
] as const;

/** Gli errori su `fastingWindow`, con i loro messaggi. */
async function erroriSullaFinestra(Dto: new () => object, corpo: Record<string, unknown>) {
  const errori = await validate(plainToInstance(Dto, corpo) as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errori.filter((e) => e.property === 'fastingWindow');
}

describe.each(CANCELLI)('⛔ il cancello di %s', (_chi, Dto) => {
  it.each([
    ['una finestra vera', 'skip_breakfast'],
    ['la finestra ritirata', 'skip_lunch'],
    ['una derivata dall\'orologio', 'skip_all_but_dinner'],
    ['la stringa vuota che mandava la vecchia scheda', ''],
    ['una stringa qualsiasi', 'qualunque_cosa'],
  ])('rifiuta %s', async (_titolo, valore) => {
    expect(await erroriSullaFinestra(Dto, { fastingWindow: valore })).toHaveLength(1);
  });

  /**
   * ⛔ **IL CASO CHE PASSAVA.** `@IsOptional` salta anche su `null`; `@ValidateIf` guarda la
   * **presenza della chiave**. È tutta la differenza fra un cancello e un cancello aperto.
   */
  it('⛔ rifiuta anche `null`: era il buco di `@IsOptional`', async () => {
    expect(await erroriSullaFinestra(Dto, { fastingWindow: null })).toHaveLength(1);
  });

  /** ⚠️ E il campo assente non è un errore: quasi nessuna richiesta lo manda. */
  it('⚠️ chi non lo manda non se ne accorge', async () => {
    expect(await erroriSullaFinestra(Dto, { phone: '333' })).toHaveLength(0);
  });

  /**
   * ⛔ **Il messaggio è in italiano e dice cosa fare.** Un 400 con «property fastingWindow should not
   * exist» è tecnicamente lo stesso rifiuto, ma per chi lo legge è un guasto senza uscita — e chi lo
   * legge è una cliente che ha toccato un pallino, o una nutrizionista che voleva salvare un numero
   * di telefono. *Una ragione falsa è peggio di un ordine sbagliato*, e una ragione illeggibile pure.
   */
  it('⛔ e lo dice in italiano, con la via d\'uscita', async () => {
    const [errore] = await erroriSullaFinestra(Dto, { fastingWindow: 'skip_dinner' });
    const messaggi = Object.values(errore.constraints ?? {});
    expect(messaggi).toHaveLength(1);
    expect(messaggi[0]).toMatch(/orologio/);
    expect(messaggi[0]).not.toMatch(/should not exist|must be one of/);
    // Dice cosa fare, non solo cosa non si può fare.
    expect(messaggi[0]).toMatch(/riapri l'app|Ricarica la pagina/i);
  });
});
