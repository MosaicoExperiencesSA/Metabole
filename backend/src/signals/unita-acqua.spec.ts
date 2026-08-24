import 'reflect-metadata';
/**
 * COME LA CLIENTE CONTAVA L'ACQUA, GIORNO PER GIORNO — richiesta di Simone del 24/8: «visto che la
 * modalità acqua è personalizzabile dalla cliente per ogni giornata, nella riga va inserito se è un
 * valore in bicchiere, bottiglia da 0,5, da 1 o da 1,5».
 *
 * ⚠️ La premessa da cui parte tutto: fino a ieri l'unità viveva SOLO nelle preferenze dell'utente
 * (`prefs.waterUnit`), che è un valore di ADESSO. Leggendo il passato con la preferenza di oggi, una
 * settimana contata a bicchieri diventerebbe una settimana di bottiglie il giorno in cui lei cambia
 * il selettore — e nessuno se ne accorgerebbe, perché il numero grande (i bicchieri) resta giusto.
 * Perciò l'unità si scrive sulla RIGA del giorno, come già si fa con l'obiettivo dei passi.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CreateWaterDto } from './dto/signals.dto';
import { SignalsService } from './signals.service';
import { CHIAVI_UNITA_ACQUA, comeLiHaContati, eUnitaAcqua, etichettaUnitaAcqua, UNITA_ACQUA } from '../common/unita-acqua';

describe('unità dell\'acqua — le parole e la conversione', () => {
  it('le bottiglie si scrivono con il loro nome e il loro numero', () => {
    expect(comeLiHaContati(12, 'bottle1')).toBe('3 bottiglie da 1 L');
    expect(comeLiHaContati(4, 'bottle05')).toBe('2 bottiglie da 0,5 L');
    expect(comeLiHaContati(6, 'bottle15')).toBe('1 bottiglia da 1,5 L'); // singolare, non «1 bottiglie»
  });

  /**
   * ⛔ **LA GIORNATA MISTA — il rilievo più grave della revisione del 24/8.** L'unità è una
   * preferenza di profilo: la cliente conta otto bicchieri la mattina, alle 19 passa alle bottiglie
   * da 1 L e tocca una volta. La riga è 12 bicchieri con unità `bottle1`, e la prima stesura
   * scriveva «3 bottiglie da 1 L» — di bottiglie ne ha bevuta **una**. La coach avrebbe letto una
   * giornata che non è mai esistita, e ci avrebbe ragionato sopra al check settimanale.
   */
  it('⛔ una giornata a unità MISTE non si converte: si dice come contava alla fine', () => {
    expect(comeLiHaContati(10, 'bottle1')).toBe('a fine giornata contava in bottiglie da 1 L');
    expect(comeLiHaContati(3, 'bottle05')).toBe('a fine giornata contava in bottiglie da 0,5 L');
  });

  it('col bicchiere si dice il bicchiere, senza rifare il numero della colonna accanto', () => {
    expect(comeLiHaContati(8, 'glass')).toBe('contati in bicchieri');
  });

  it('⛔ e con l\'unità NON registrata nemmeno: NULL non vuol dire «bicchieri», vuol dire «non lo so»', () => {
    // È il caso di tutte le giornate prima del 24/8 e di chi tocca il tile da un'app non aggiornata.
    expect(comeLiHaContati(8, null)).toBeNull();
    expect(comeLiHaContati(8, undefined)).toBeNull();
    expect(comeLiHaContati(8, 'pinta')).toBeNull();
    expect(etichettaUnitaAcqua(null)).toBeNull();
    expect(etichettaUnitaAcqua('bottle05')).toBe('bottiglie da 0,5 L');
  });

  it('le quattro unità sono quelle e solo quelle', () => {
    expect(CHIAVI_UNITA_ACQUA).toEqual(['glass', 'bottle05', 'bottle1', 'bottle15']);
    expect(eUnitaAcqua('bottle15')).toBe(true);
    expect(eUnitaAcqua('bottiglia')).toBe(false);
  });
});

/**
 * ⚠️ LE DUE COPIE DELL'ELENCO SI GUARDANO IN FACCIA. L'app è un progetto suo e non può importare da
 * `backend/`: la sua tabella (`app/src/lib/water.ts`) è per forza una seconda copia. Una copia che
 * nessuno confronta è una copia che diverge — e qui divergerebbe sui LITRI: se domani in app la
 * bottiglia da 1 L valesse 5 bicchieri, l'app scriverebbe «3 bottiglie» e il back office «2,4», per
 * la stessa giornata della stessa persona.
 */
describe('l\'app e il backend contano le stesse bottiglie', () => {
  const sorgenteApp = readFileSync(join(__dirname, '..', '..', '..', 'app', 'src', 'lib', 'water.ts'), 'utf8');

  it.each(CHIAVI_UNITA_ACQUA)('%s vale gli stessi bicchieri di qua e di là', (chiave) => {
    const riga = new RegExp(`${chiave}: \\{[^}]*glasses: (\\d+)`).exec(sorgenteApp);
    expect(riga).not.toBeNull();
    expect(Number(riga![1])).toBe(UNITA_ACQUA[chiave].bicchieri);
  });

  it('e non ce n\'è una in più di là', () => {
    const chiaviApp = /export const WATER_UNITS[\s\S]*?\n\};/.exec(sorgenteApp)![0]
      .split('\n')
      .map((r) => /^\s{2}(\w+): \{/.exec(r)?.[1])
      .filter((v): v is string => !!v);
    expect(chiaviApp).toEqual(CHIAVI_UNITA_ACQUA);
  });
});

describe('CreateWaterDto — l\'unità è facoltativa, ma se c\'è dev\'essere una delle quattro', () => {
  const valida = async (corpo: Record<string, unknown>) =>
    validate(plainToInstance(CreateWaterDto, corpo), { whitelist: true });

  it('senza `unit` passa: le app già installate non la mandano, e l\'acqua si registra lo stesso', async () => {
    expect(await valida({ glasses: 6 })).toHaveLength(0);
  });

  it.each(CHIAVI_UNITA_ACQUA)('con `unit` = %s passa', async (chiave) => {
    expect(await valida({ glasses: 6, unit: chiave })).toHaveLength(0);
  });

  it('⛔ con un\'unità inventata NON passa: finirebbe in banca dati e non si saprebbe più leggere', async () => {
    const errori = await valida({ glasses: 6, unit: 'damigiana' });
    expect(errori).toHaveLength(1);
    expect(JSON.stringify(errori)).toContain('Unità dell\'acqua non riconosciuta');
  });
});

describe('upsertWater — l\'unità si scrive sulla riga del giorno', () => {
  const creaServizio = () => {
    const waterLog = { upsert: jest.fn().mockResolvedValue({}) };
    const prisma = {
      waterLog,
      measurement: { findFirst: jest.fn().mockResolvedValue({ weightKg: 70 }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ startWeightKg: 70 }) },
    };
    const configParams = { getNumber: jest.fn().mockResolvedValue(33) };
    // Ordine del costruttore: prisma, configParams, audit, dietLearning, progress, routing, menu.
    const service = new SignalsService(
      prisma as never,
      configParams as never,
      { log: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, waterLog };
  };

  it('arriva davvero al database, in creazione e in aggiornamento', async () => {
    const { service, waterLog } = creaServizio();
    await service.upsertWater('c1', { glasses: 12, unit: 'bottle1' } as never);
    const chiamata = waterLog.upsert.mock.calls[0][0];
    expect(chiamata.create.unit).toBe('bottle1');
    expect(chiamata.update.unit).toBe('bottle1');
  });

  /**
   * ⛔ IL CASO CHE FA IL DANNO: la stessa cliente ha il telefono con l'app vecchia e il tablet con
   * quella nuova. Se il tap dell'app vecchia scrivesse `unit: null`, ogni giornata perderebbe
   * l'unità appena la si tocca dall'altro apparecchio — e la colonna nuova resterebbe vuota per
   * sempre senza che nessuno capisca perché.
   */
  it('⛔ se il tap arriva senza unità, quella già scritta NON si cancella', async () => {
    const { service, waterLog } = creaServizio();
    await service.upsertWater('c1', { glasses: 7 } as never);
    const chiamata = waterLog.upsert.mock.calls[0][0];
    expect(chiamata.update).not.toHaveProperty('unit');
    expect(chiamata.create).not.toHaveProperty('unit');
  });

  it('e un\'unità inventata che superasse la validazione non entra comunque', async () => {
    const { service, waterLog } = creaServizio();
    await service.upsertWater('c1', { glasses: 7, unit: 'damigiana' } as never);
    expect(waterLog.upsert.mock.calls[0][0].update).not.toHaveProperty('unit');
  });
});
