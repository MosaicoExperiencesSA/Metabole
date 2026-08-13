/**
 * GAIA RICHIEDE LE ALLERGIE (§7 dell'handoff, campagna del 13/8 — 24 clienti su 48).
 *
 * Qui non si verifica che le frasi siano gentili: si verifica **quando** Gaia scrive su un profilo
 * sanitario e quando invece si ferma. Le cose che si possono sbagliare in silenzio sono quattro:
 *
 *  1. **scrivere quello che ha detto invece di quello che ha confermato** — il passo di conferma
 *     esiste per questo, e senza un test si può togliere senza che niente diventi rosso;
 *  2. ⚠️ **togliere un'allergia**: un elenco nuovo che non contiene più una voce di prima non è un
 *     aggiornamento, è una cancellazione — e la fa una persona, non una chat;
 *  3. **i codici UE che aveva già**: la domanda riguarda il testo libero, e chi risponde a quella
 *     domanda non deve perdere il resto;
 *  4. **il ricontrollo alla conferma**: fra la proposta e il «sì» la nutrizionista può aver già
 *     sistemato tutto dalla scheda. Lo stato appeso al messaggio è vecchio per definizione.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AllergieChatService } from './allergie-chat.service';
import { StatoAllergie } from './allergie-chat';

interface Opzioni {
  allergies?: string[];
  allergiesOther?: string[];
  allergieDichiarateIl?: Date | null;
  intolerances?: string[];
  intolerancesOther?: string[];
  onboardingCompletedAt?: Date | null;
}

async function crea(opzioni: Opzioni = {}) {
  const profilo = {
    name: 'Giulia',
    allergies: opzioni.allergies ?? [],
    allergiesOther: opzioni.allergiesOther ?? [],
    allergieDichiarateIl: opzioni.allergieDichiarateIl ?? null,
    intolerances: opzioni.intolerances ?? [],
    intolerancesOther: opzioni.intolerancesOther ?? [],
    onboardingCompletedAt: opzioni.onboardingCompletedAt === undefined ? new Date('2026-07-01') : opzioni.onboardingCompletedAt,
  };
  const prisma: any = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(profilo),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      AllergieChatService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: audit },
    ],
  }).compile();
  return { service: moduleRef.get(AllergieChatService), prisma, profilo };
}

/** Quello che sarebbe finito in banca dati, o `null` se non si è scritto niente. */
const scritto = (prisma: any): any =>
  prisma.clientProfile.updateMany.mock.calls.length ? prisma.clientProfile.updateMany.mock.calls[0][0].data : null;

const IN_CORSO: StatoAllergie = { passo: 'conferma', motivo: 'mai_risposto', codici: ['latte'], libere: [], nessuna: false, tentativi: 0 };

describe('l apertura sceglie la domanda dal profilo, non dalla notifica', () => {
  it('chi ha «Altro» fra le intolleranze e non ha mai detto cosa', async () => {
    const { service } = await crea({ intolerances: ['other'] });
    const e = await service.apri('c1');
    expect(e.esito).toBe('aperto');
    expect(e.stato?.motivo).toBe('intolleranza_ignota');
    expect(e.testo).toMatch(/non esisteva ancora/);
  });

  it('chi ha un allergia scritta a mano: gliela si rilegge', async () => {
    const { service } = await crea({ allergies: ['le fragole'], allergiesOther: ['le fragole'] });
    const e = await service.apri('c1');
    expect(e.stato?.motivo).toBe('allergie_da_codificare');
    expect(e.testo).toContain('le fragole');
  });

  it('chi non ha mai risposto', async () => {
    const { service } = await crea({});
    expect((await service.apri('c1')).stato?.motivo).toBe('mai_risposto');
  });

  it('⚠️ chi nel frattempo è stata sistemata dalla nutrizionista NON si disturba', async () => {
    const { service, prisma } = await crea({ allergies: ['latte'], allergieDichiarateIl: new Date() });
    const e = await service.apri('c1');
    expect(e.esito).toBe('non_serve');
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });
});

describe('⚠️ si scrive solo quello che ha confermato', () => {
  it('la risposta non scrive niente: prima si propone', async () => {
    const { service, prisma } = await crea({});
    const e = await service.avanza('c1', { passo: 'risposta', motivo: 'mai_risposto', tentativi: 0 }, 'sono allergica al latte');
    expect(e.esito).toBe('in_corso');
    expect(e.stato?.passo).toBe('conferma');
    expect(e.stato?.codici).toEqual(['latte']);
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });

  it('il «sì» scrive, e timbra la data della dichiarazione', async () => {
    const { service, prisma } = await crea({});
    const e = await service.avanza('c1', IN_CORSO, 'sì');
    expect(e.esito).toBe('applicata');
    expect(scritto(prisma).allergies).toEqual(['latte']);
    expect(scritto(prisma).allergieDichiarateIl).toBeInstanceOf(Date);
  });

  it('«nessuna» è una risposta: elenco vuoto ma data valorizzata', async () => {
    const { service, prisma } = await crea({});
    const proposta = await service.avanza('c1', { passo: 'risposta', motivo: 'mai_risposto', tentativi: 0 }, 'nessuna');
    expect(proposta.stato?.nessuna).toBe(true);
    const e = await service.avanza('c1', proposta.stato!, 'sì');
    expect(e.esito).toBe('applicata');
    expect(scritto(prisma).allergies).toEqual([]);
    expect(scritto(prisma).allergieDichiarateIl).toBeInstanceOf(Date);
  });

  it('il «no» torna alla domanda invece di ripetere la stessa proposta', async () => {
    const { service, prisma } = await crea({});
    const e = await service.avanza('c1', IN_CORSO, 'no');
    expect(e.stato?.passo).toBe('risposta');
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });

  it('due «no» di fila passano alla nutrizionista, non alla coach', async () => {
    const { service } = await crea({});
    const e = await service.avanza('c1', { ...IN_CORSO, tentativi: 1 }, 'no');
    expect(e.esito).toBe('arresa');
    expect(e.inoltraA).toBe('nutritionist');
  });

  it('una correzione al posto del sì/no è una correzione, non un incomprensione', async () => {
    const { service } = await crea({});
    const e = await service.avanza('c1', IN_CORSO, 'anche le uova');
    expect(e.stato?.passo).toBe('conferma');
    expect(e.stato?.codici).toEqual(['uova']);
  });

  it('due risposte non capite di fila passano a una persona', async () => {
    const { service } = await crea({});
    const uno = await service.avanza('c1', { passo: 'risposta', motivo: 'mai_risposto', tentativi: 0 }, 'boh');
    expect(uno.esito).toBe('in_corso');
    const due = await service.avanza('c1', uno.stato!, 'mah');
    expect(due.esito).toBe('arresa');
    expect(due.inoltraA).toBe('nutritionist');
  });
});

describe('⚠️ togliere un allergia non lo fa Gaia', () => {
  it('«nessuna» a chi ne ha una dichiarata: ci si ferma e si chiama la nutrizionista', async () => {
    const { service, prisma } = await crea({ allergies: ['le fragole'], allergiesOther: ['le fragole'] });
    const e = await service.avanza('c1', { passo: 'risposta', motivo: 'allergie_da_codificare', tentativi: 0 }, 'nessuna');
    expect(e.esito).toBe('arresa');
    expect(e.inoltraA).toBe('nutritionist');
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ Il freno guarda le ESCLUSIONI, non le parole. Chi ha «latte» codificato e «il latte
   * vaccino» scritto a mano non perde niente se il testo libero sparisce: quello che escludeva
   * lo esclude già il codice, e in più. Un controllo fatto sulle stringhe si fermerebbe qui, e
   * manderebbe alla nutrizionista una coda di casi in cui non c'è niente da decidere.
   */
  it('e non si ferma quando il testo libero era già coperto dal codice', async () => {
    const { service, prisma } = await crea({ allergies: ['latte', 'il latte vaccino'], allergiesOther: ['il latte vaccino'] });
    const proposta = await service.avanza('c1', { passo: 'risposta', motivo: 'allergie_da_codificare', tentativi: 0 }, 'nessuna');
    expect(proposta.esito).toBe('in_corso');
    const e = await service.avanza('c1', proposta.stato!, 'sì');
    expect(e.esito).toBe('applicata');
    expect(scritto(prisma).allergies).toEqual(['latte']);
    expect(scritto(prisma).allergiesOther).toEqual([]);
  });

  it('un elenco nuovo che ne dimentica una: idem, non si scrive', async () => {
    const { service, prisma } = await crea({ allergies: ['le fragole', 'i kiwi'], allergiesOther: ['le fragole', 'i kiwi'] });
    const e = await service.avanza('c1', { passo: 'risposta', motivo: 'allergie_da_codificare', tentativi: 0 }, 'le fragole');
    expect(e.esito).toBe('arresa');
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });

  it('⚠️ ma i codici UE che aveva già NON contano come persi: la domanda era un altra', async () => {
    const { service, prisma } = await crea({ allergies: ['latte', 'le fragole'], allergiesOther: ['le fragole'] });
    const proposta = await service.avanza('c1', { passo: 'risposta', motivo: 'allergie_da_codificare', tentativi: 0 }, 'le fragole');
    expect(proposta.esito).toBe('in_corso');
    const e = await service.avanza('c1', proposta.stato!, 'sì');
    expect(e.esito).toBe('applicata');
    expect(scritto(prisma).allergies).toEqual(['latte', 'fragole']);
    expect(scritto(prisma).allergiesOther).toEqual(['fragole']);
  });

  it('«le noci» diventa il codice UE, e il testo libero smette di bloccare la base personale', async () => {
    const { service, prisma } = await crea({ allergies: ['le noci'], allergiesOther: ['le noci'] });
    const proposta = await service.avanza('c1', { passo: 'risposta', motivo: 'allergie_da_codificare', tentativi: 0 }, 'le noci');
    const e = await service.avanza('c1', proposta.stato!, 'sì');
    expect(e.esito).toBe('applicata');
    expect(scritto(prisma).allergies).toEqual(['frutta_a_guscio']);
    expect(scritto(prisma).allergiesOther).toEqual([]);
  });
});

describe('le intolleranze, e il punto di domanda che si chiude', () => {
  it('«il lattosio» scioglie «Altro» e lascia il resto dov era', async () => {
    const { service, prisma } = await crea({ intolerances: ['lactose', 'other'] });
    const proposta = await service.avanza('c1', { passo: 'risposta', motivo: 'intolleranza_ignota', tentativi: 0 }, 'il lattosio');
    const e = await service.avanza('c1', proposta.stato!, 'sì');
    expect(e.esito).toBe('applicata');
    expect(scritto(prisma).intolerances).not.toContain('other');
    expect(scritto(prisma).intolerances).toContain('lactose');
    expect(scritto(prisma).intolerancesOther).toEqual(['latte']);
  });

  it('⚠️ «nessuna» toglie il flag e SOLO il flag: «other» non escludeva niente, era una domanda', async () => {
    const { service, prisma } = await crea({ intolerances: ['lactose', 'other'] });
    const proposta = await service.avanza('c1', { passo: 'risposta', motivo: 'intolleranza_ignota', tentativi: 0 }, 'nessuna');
    const e = await service.avanza('c1', proposta.stato!, 'sì');
    expect(e.esito).toBe('applicata');
    expect(scritto(prisma).intolerances).toEqual(['lactose']);
  });
});

describe('⚠️ lo stato appeso al messaggio è vecchio per definizione', () => {
  it('se la nutrizionista ha già sistemato tutto, il «sì» non scrive niente', async () => {
    const { service, prisma } = await crea({ allergies: ['latte'], allergieDichiarateIl: new Date() });
    const e = await service.avanza('c1', IN_CORSO, 'sì');
    expect(e.esito).toBe('non_serve');
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });
});

describe('la scrittura e la sua traccia viaggiano insieme', () => {
  it('profilo e audit nella stessa transazione', async () => {
    const { service, prisma } = await crea({});
    await service.avanza('c1', IN_CORSO, 'sì');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const riga = prisma.auditLog.create.mock.calls[0][0].data;
    expect(riga.action).toBe('chat.allergie.dichiarate');
    expect(riga.actorId).toBe('c1');
    expect(riga.metadata.prima.allergies).toEqual([]);
  });

  it('⚠️ e se la transazione fallisce, la cliente NON legge «fatto»', async () => {
    const { service, prisma } = await crea({});
    prisma.$transaction.mockRejectedValueOnce(new Error('database via'));
    const e = await service.avanza('c1', IN_CORSO, 'sì');
    expect(e.esito).toBe('arresa');
    expect(e.inoltraA).toBe('nutritionist');
  });
});
