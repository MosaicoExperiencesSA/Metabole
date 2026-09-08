/**
 * ⛔ **NON SI SALVAVA PIÙ NESSUNA RICETTA NUOVA** — segnalato da Simone l'8/9, con lo screenshot
 * della finestra «Nuova ricetta» aperta da *Scrivi il menu a mano*:
 *
 * > *Il campo «verified» non è previsto in questa richiesta.*
 *
 * La finestra mostra la casella «Verificata dalla nutrizionista» **anche su una ricetta che non
 * esiste ancora**, e in creazione la manda sempre (`!recipe` rende «cambiata» la spunta). Il campo
 * in `CreateRecipeDto` non c'era, `forbidNonWhitelisted` rifiutava tutto il corpo, e il POST moriva
 * **prima** di arrivare al servizio.
 *
 * ⚠️ **E non era un difetto del menu a mano**: la finestra è una sola per tutte e tre le porte
 * (pagina Ricette, pagina Panieri, menu a mano). Quello che Simone ha visto in una valeva in tutte.
 *
 * ⛔ **La seconda metà del guasto era invisibile**: il passo «In quali panieri?» si apre **dopo** il
 * salvataggio, quindi «non ha i panieri» non era un secondo difetto — era il primo, visto da valle.
 * Una ricetta che non nasce non arriva mai al passo che la mette nel piatto di qualcuno.
 *
 * ⚠️ **Perché nessuna prova l'aveva presa.** Le prove del 4/9 e del 7/9 leggevano il *sorgente* del
 * backoffice (che la finestra passi al secondo passo, che il pulsante dica «Metti nel pasto») e le
 * prove del servizio chiamavano `createRecipe` **con un oggetto scritto a mano**, cioè saltando la
 * pipe di validazione — che è esattamente il pezzo che si era rotto. Qui il corpo è quello che
 * manda la finestra, e passa dalla pipe.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validateSync } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';
import { CreateRecipeDto } from './dto/catalog.dto';

/**
 * ⚠️ **Le stesse due opzioni di `main.ts`**, e non una approssimazione: è `forbidNonWhitelisted` a
 * trasformare un campo di troppo in un rifiuto, e senza di lui questa prova resterebbe verde
 * davanti al guasto vero.
 */
const errori = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateRecipeDto, body) as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

/**
 * ⛔ **LE CHIAVI SI LEGGONO DALLA FINESTRA, non si ricopiano a mano** — 8/9, dopo una revisione
 * avversariale che ha smontato la prima stesura di questa stessa prova.
 *
 * La prima stesura aveva una costante scritta a mano con i campi della finestra e un commento che
 * diceva «se un giorno la finestra ne aggiunge uno, è qui che ci si accorge». **Non era vero**:
 * niente la legava a `Ricette.tsx`. Aggiungendo un campo qualsiasi al corpo del POST, l'intera
 * suite restava verde e il difetto dell'8/9 ripassava identico.
 *
 * ⚠️ Quindi si legge il sorgente vero e si confrontano le chiavi con quelle che `CreateRecipeDto`
 * dichiara — le stesse che `whitelist` guarda a runtime, prese dal registro di `class-validator`
 * invece che da un elenco scritto due volte.
 *
 * ⛔ **E si guarda dentro gli spread condizionali**, che è dove `verified` si nascondeva:
 * `...(verificaCambiata ? { verified: f.verified } : {})`. Una lettura solo del primo livello
 * avrebbe dato verde sul difetto vero, cioè sarebbe stata peggio di niente.
 */
const SORGENTE_FINESTRA = resolve(__dirname, '../../../backoffice/src/pages/Ricette.tsx');

/** Il testo del letterale `const body = { … }` di `save()`, con le parentesi bilanciate. */
function corpoDelPost(sorgente: string): string {
  const inizio = sorgente.indexOf('const body = {');
  if (inizio < 0) throw new Error('Non trovo `const body = {` in Ricette.tsx: la finestra è cambiata, aggiorna questa prova.');
  let i = sorgente.indexOf('{', inizio);
  let profondita = 0;
  for (let j = i; j < sorgente.length; j += 1) {
    if (sorgente[j] === '{') profondita += 1;
    else if (sorgente[j] === '}') {
      profondita -= 1;
      if (profondita === 0) return sorgente.slice(i, j + 1);
    }
  }
  throw new Error('Il letterale `const body` non si chiude: aggiorna questa prova.');
}

/**
 * ⚠️ **Si prendono TUTTE le chiavi, a ogni profondità**, e non solo quelle del primo livello: le
 * chiavi annidate qui dentro sono quelle degli spread, che finiscono nel corpo esattamente come le
 * altre. Il prezzo è che un valore che fosse a sua volta un oggetto (`macros: { proteine: 1 }`)
 * porterebbe dentro anche le SUE chiavi e farebbe diventare rossa questa prova: quel rosso è una
 * domanda giusta — «questo campo il server lo prevede?» — e si risolve aggiungendo il campo qui
 * sotto con il perché, non allargando il setaccio.
 */
const chiaviMandate = (corpo: string): string[] => {
  const trovate = new Set<string>();
  /** `nome: valore` — la forma lunga. */
  const conDuePunti = /(?:^|[{,\s(])([A-Za-z_$][\w$]*)\s*:/g;
  /**
   * ⛔ **E la forma ABBREVIATA** — `{ kcal, ingredients, cookingMethods }`. La prima stesura di
   * questa prova guardava solo i due punti e si perdeva **tre campi su dieci** senza dirlo: una
   * prova che legge il sorgente e ne legge metà è peggio di una che non lo legge, perché sembra
   * che copra.
   */
  const abbreviate = /[{,]\s*([A-Za-z_$][\w$]*)\s*(?=[,}])/g;
  for (const re of [conDuePunti, abbreviate]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(corpo))) trovate.add(m[1]);
  }
  return [...trovate].sort();
};

/** Le proprietà che il DTO dichiara — dal registro di `class-validator`, che è quello che decide. */
const chiaviAmmesse = (): Set<string> => new Set(
  getMetadataStorage()
    .getTargetValidationMetadatas(CreateRecipeDto, '', false, false)
    .map((m) => m.propertyName),
);

/**
 * ⛔ **IL CORPO DI PROVA**, che resta a mano di proposito: serve a far girare la pipe su valori
 * veri. È il confronto delle CHIAVI qui sopra a sorvegliare che non se ne aggiunga uno di nascosto.
 */
const corpoDellaFinestra = (extra: Record<string, unknown> = {}) => ({
  name: 'Kiwi',
  regime: 'omnivore',
  mealSlot: 'breakfast',
  kcal: 200,
  ingredients: [{ name: 'kiwi', qty: 4, unit: 'pz' }],
  cookingMethods: [{ type: 'veloce', steps: ['se 4 kiwi non sono sufficienti puo mangiarne ancora 1'] }],
  difficulty: 'semplice',
  seasons: [],
  active: true,
  verified: false,
  ...extra,
});

describe('⛔ le chiavi che la finestra manda sono TUTTE previste dal DTO', () => {
  const mandate = chiaviMandate(corpoDelPost(readFileSync(SORGENTE_FINESTRA, 'utf8')));

  it('la lettura del sorgente funziona (se questo fallisce, la prova sotto non prova niente)', () => {
    expect(mandate).toContain('name');
    expect(mandate).toContain('kcal');
    /** ⚠️ La chiave dentro lo spread: è quella che l'8/9 non si è vista. */
    expect(mandate).toContain('verified');
  });

  it('⛔ nessuna chiave della finestra è fuori da CreateRecipeDto', () => {
    const ammesse = chiaviAmmesse();
    expect(mandate.filter((k) => !ammesse.has(k))).toEqual([]);
  });

  /**
   * ⚠️ E il corpo di prova qui sotto è davvero quello della finestra, non un suo cugino.
   * `confermaRegime` c'è solo al secondo tentativo, quindi si aggiunge qui per il confronto.
   */
  it('⚠️ il corpo di prova copre tutte le chiavi che la finestra manda', () => {
    const diProva = Object.keys(corpoDellaFinestra({ confermaRegime: true }));
    expect(mandate.filter((k) => !diProva.includes(k))).toEqual([]);
  });
});

describe('POST /recipes — il corpo che manda «Nuova ricetta»', () => {
  it('⛔ passa la validazione con «verified» dentro (era il messaggio rosso dell 8/9)', () => {
    expect(errori(corpoDellaFinestra())).toHaveLength(0);
  });

  it('passa anche con la spunta accesa e con la conferma del regime', () => {
    expect(errori(corpoDellaFinestra({ verified: true }))).toHaveLength(0);
    expect(errori(corpoDellaFinestra({ confermaRegime: true }))).toHaveLength(0);
  });

  it('⚠️ «verified» resta facoltativo: chi non lo manda non deve rompersi', () => {
    const corpo = corpoDellaFinestra();
    delete (corpo as Record<string, unknown>).verified;
    expect(errori(corpo)).toHaveLength(0);
  });

  /**
   * ⚠️ La rete non si è allargata a tutto: un campo inventato deve continuare a essere rifiutato,
   * altrimenti questa prova direbbe soltanto che la pipe è stata spenta.
   */
  it('⛔ un campo che non esiste è ancora rifiutato', () => {
    const e = errori(corpoDellaFinestra({ pippo: 1 }));
    expect(e).toHaveLength(1);
    expect(e[0].property).toBe('pippo');
  });

  it('⛔ e «verified» non è diventato un campo libero: una stringa non passa', () => {
    expect(errori(corpoDellaFinestra({ verified: 'si' }))).not.toHaveLength(0);
  });
});

describe('CatalogService.createRecipe — la firma alla nascita', () => {
  const monta = async () => {
    const prisma: any = {
      recipe: { create: jest.fn(async ({ data }: { data: unknown }) => ({ id: 'r-nuova', ...(data as object) })) },
    };
    const audit = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0), getString: jest.fn(async () => '') } },
      ],
    }).compile();
    return { service: moduleRef.get(CatalogService), prisma, audit };
  };

  /**
   * ⚠️ **L'extra è volutamente non tipizzato.** Se fosse `Partial<CreateRecipeDto>`, togliendo il
   * campo dal DTO questo file smetterebbe di **compilare** — e una suite che non parte fa fallire
   * la CI, sì, ma non dice cosa è successo e soprattutto non fa mai girare la prova qui sopra, che
   * è quella che riproduce il messaggio rosso visto da Simone. Qui si vuole il ROSSO
   * dell'asserzione, non quello del compilatore.
   */
  const dto = (extra: Record<string, unknown> = {}) => ({
    name: 'Kiwi',
    regime: 'omnivore',
    mealSlot: 'breakfast',
    kcal: 200,
    ingredients: [{ name: 'kiwi', qty: 4, unit: 'pz' }],
    ...extra,
  }) as CreateRecipeDto;

  it('⛔ con la spunta accesa nasce firmata da CHI salva, non da «qualcuno»', async () => {
    const { service, prisma } = await monta();
    await service.createRecipe('u-nutri', dto({ verified: true }));
    const scritto = prisma.recipe.create.mock.calls[0][0].data;
    expect(scritto.verifiedById).toBe('u-nutri');
    expect(scritto.verifiedAt).toBeInstanceOf(Date);
  });

  it('senza spunta nasce NON verificata, e non si inventa una firma', async () => {
    const { service, prisma } = await monta();
    await service.createRecipe('u-nutri', dto());
    const scritto = prisma.recipe.create.mock.calls[0][0].data;
    expect(scritto.verifiedById).toBeUndefined();
    expect(scritto.verifiedAt).toBeUndefined();
  });

  it('⚠️ la spunta spenta è esplicita e non firma nessuno', async () => {
    const { service, prisma } = await monta();
    await service.createRecipe('u-nutri', dto({ verified: false }));
    const scritto = prisma.recipe.create.mock.calls[0][0].data;
    expect(scritto.verifiedById).toBeNull();
    expect(scritto.verifiedAt).toBeNull();
  });

  /**
   * ⚠️ **La firma finisce nel registro anche quando nasce così.** Chi si chiede «chi ha verificato
   * questo piatto» deve trovarlo scritto anche quando la risposta è «quella stessa che l'ha
   * scritto»: è la stessa ragione per cui si scrive nella modifica.
   */
  it('⛔ e resta scritta nel registro', async () => {
    const { service, audit } = await monta();
    await service.createRecipe('u-nutri', dto({ verified: true }));
    expect(audit.log.mock.calls[0][0].metadata).toMatchObject({ verifica: 'verificata' });
  });

  it('⚠️ una ricetta normale non porta metadata inutili nel registro', async () => {
    const { service, audit } = await monta();
    await service.createRecipe('u-nutri', dto());
    expect(audit.log.mock.calls[0][0].metadata).toBeUndefined();
  });

  /**
   * ⛔ **La verifica NON è la conferma degli allergeni.** Se un giorno qualcuno le facesse
   * coincidere, un piatto entrerebbe nei menu delle allergiche perché qualcuno ha detto «l'ho
   * guardata», senza aver guardato i tag.
   */
  it('⛔ nascere verificata non conferma gli allergeni', async () => {
    const { service, prisma } = await monta();
    await service.createRecipe('u-nutri', dto({ verified: true }));
    expect(prisma.recipe.create.mock.calls[0][0].data.allergensReviewed).toBeUndefined();
  });
});
