/**
 * Assegnazione automatica della dieta senza glutine.
 *
 * Richiesta di Simone del 9/8: chi dichiara glutine (allergia, intolleranza, «gluten free») deve
 * ricevere **in automatico** la variante senza glutine ed esserne **avvisato**.
 *
 * Il rischio di questa automazione è preciso e va tenuto in mano: se la variante non è in catalogo,
 * scrivere `dietFamily` non basta — `pickDietFor` scende ai ripieghi e la cliente finisce su una
 * dieta col glutine, convinta del contrario, perché noi glielo abbiamo scritto. Per questo l'ordine
 * dei controlli è: serve? · la variante esiste? · poi scrivo e avviso. Questi test tengono fermo
 * quell'ordine, e tengono fermo anche il verso opposto: non cambiare la dieta a chi non l'ha chiesto.
 */

import {
  assegnaSenzaGlutine,
  corpoAvviso,
  dichiaraSenzaGlutine,
  DIETA_SENZA_GLUTINE,
  eClinico,
  TITOLO_AVVISO,
} from './senza-glutine';

describe('riconoscere la dichiarazione sul glutine', () => {
  it.each([
    ['gluten'],            // il valore del questionario
    ['glutine'],           // italiano, dagli import
    ['Glutine'],
    ['gluten free'],
    ['senza glutine'],
    ['celiaca'],
    ['celiachia'],
    ['no glutine grazie'], // campo libero
  ])('«%s» significa senza glutine', (t) => {
    expect(dichiaraSenzaGlutine([t])).toBe(true);
  });

  /**
   * Il verso che conta di più: NON cambiare la dieta a chi non l'ha chiesto. La prima versione del
   * riconoscimento includeva i singoli cereali, e «farro» fra i cibi non graditi avrebbe spostato
   * una cliente su una dieta senza glutine — una decisione presa al posto suo su un dato che dice
   * un'altra cosa.
   */
  it.each([
    ['farro'],
    ['frumento'],
    ['orzo'],
    ['pane'],
    ['grano saraceno'], // di glutine non ne ha: guai a farlo scattare
    ['lattosio'],
    [''],
  ])('«%s» NON basta per cambiare la dieta', (t) => {
    expect(dichiaraSenzaGlutine([t])).toBe(false);
  });

  it('distingue il clinico dalla preferenza: cambia chi deve guardarla', () => {
    expect(eClinico(['celiachia'])).toBe(true);
    expect(eClinico(['allergia al glutine'])).toBe(true);
    expect(eClinico(['gluten free'])).toBe(false);
  });
});

describe('il messaggio alla cliente', () => {
  it('dice cosa cambia e da cosa è sostituito', () => {
    const t = corpoAvviso('Giulia');
    expect(t).toMatch(/^Giulia, /);
    expect(t).toContain('senza glutine');
    expect(t).toMatch(/riso|mais|quinoa/);
  });

  it('NON promette la certificazione, e nomina la contaminazione', () => {
    const t = corpoAvviso('Giulia');
    expect(t).not.toMatch(/certificat[oa] senza glutine/i);
    expect(t).toContain('contaminazione');
    expect(t).toMatch(/nutrizionista/);
  });

  it('senza nome la frase regge comunque', () => {
    expect(corpoAvviso(null)).toMatch(/^abbiamo letto/);
    expect(corpoAvviso(null)).not.toContain('undefined');
  });
});

// ---------- Assegnazione ----------

const PROFILO_BASE = {
  name: 'Giulia',
  regime: 'omnivore',
  dietStyle: 'mediterranean',
  dietFamily: 'Mediterranea',
  mealsPerDay: 5,
  objective: 'dimagrimento',
  allergies: [] as string[],
  intolerances: [] as string[],
  dislikedFoods: [] as string[],
};

function fintoPrisma(tocca?: (p: any) => void) {
  const prisma: any = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ ...PROFILO_BASE }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    diet: {
      findFirst: jest.fn().mockResolvedValue({ id: 'diet-sg', name: DIETA_SENZA_GLUTINE }),
    },
    menuDay: { count: jest.fn().mockResolvedValue(0) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  if (tocca) tocca(prisma);
  return prisma;
}

describe('assegnaSenzaGlutine', () => {
  it('chi non ha dichiarato niente non viene toccato', async () => {
    const prisma = fintoPrisma();
    const esito = await assegnaSenzaGlutine(prisma, 'cli-1');
    expect(esito).toEqual({ esito: 'non_serve' });
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('con l\'intolleranza al glutine assegna la variante e avvisa la cliente', async () => {
    const prisma = fintoPrisma((p) => {
      p.clientProfile.findUnique.mockResolvedValue({ ...PROFILO_BASE, intolerances: ['gluten'] });
    });
    const esito = await assegnaSenzaGlutine(prisma, 'cli-1');
    expect(esito).toEqual({ esito: 'assegnata', dietId: 'diet-sg', giorniDaRifare: 0 });
    expect(prisma.clientProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dietFamily: DIETA_SENZA_GLUTINE, dietStyle: 'mediterranean' } }),
    );
    const notifica = prisma.notification.create.mock.calls[0][0].data;
    expect(notifica.type).toBe('diet_gluten_free');
    expect(notifica.payload.title).toBe(TITOLO_AVVISO);
    expect(notifica.payload.body).toContain('senza glutine');
  });

  it('vale anche se l\'ha scritto fra le ALLERGIE', async () => {
    const prisma = fintoPrisma((p) => {
      p.clientProfile.findUnique.mockResolvedValue({ ...PROFILO_BASE, allergies: ['glutine'] });
    });
    expect((await assegnaSenzaGlutine(prisma, 'cli-1')).esito).toBe('assegnata');
  });

  /**
   * IL CASO CHE FA PIÙ DANNO. Senza questo controllo si scriverebbe `dietFamily` su una variante
   * inesistente: `pickDietFor` scende ai ripieghi, la cliente riceve una dieta col glutine — e le
   * abbiamo appena mandato un messaggio che dice il contrario.
   */
  it('se la variante NON è in catalogo non scrive e non promette niente', async () => {
    const prisma = fintoPrisma((p) => {
      p.clientProfile.findUnique.mockResolvedValue({ ...PROFILO_BASE, intolerances: ['gluten'] });
      p.diet.findFirst.mockResolvedValue(null);
    });
    const esito = await assegnaSenzaGlutine(prisma, 'cli-1');
    expect(esito.esito).toBe('variante_mancante');
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect((esito as { motivo: string }).motivo).toContain('non è');
  });

  it('cerca la variante APPROVATA e col numero di pasti della cliente', async () => {
    const prisma = fintoPrisma((p) => {
      p.clientProfile.findUnique.mockResolvedValue({ ...PROFILO_BASE, intolerances: ['gluten'] });
    });
    await assegnaSenzaGlutine(prisma, 'cli-1');
    expect(prisma.diet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: DIETA_SENZA_GLUTINE,
          status: 'approved',
          regime: 'omnivore',
          mealsPerDay: 5,
        }),
      }),
    );
  });

  it('chi ce l\'ha già non riceve un secondo messaggio', async () => {
    const prisma = fintoPrisma((p) => {
      p.clientProfile.findUnique.mockResolvedValue({
        ...PROFILO_BASE, intolerances: ['gluten'], dietFamily: DIETA_SENZA_GLUTINE,
      });
    });
    expect((await assegnaSenzaGlutine(prisma, 'cli-1')).esito).toBe('gia_assegnata');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('dice quante giornate future vanno rigenerate: sono ancora col glutine', async () => {
    const prisma = fintoPrisma((p) => {
      p.clientProfile.findUnique.mockResolvedValue({ ...PROFILO_BASE, intolerances: ['gluten'] });
      p.menuDay.count.mockResolvedValue(3);
    });
    const esito = await assegnaSenzaGlutine(prisma, 'cli-1');
    expect(esito).toEqual({ esito: 'assegnata', dietId: 'diet-sg', giorniDaRifare: 3 });
  });

  it('con `senzaAvviso` cambia la dieta ma non manda niente (script in prova)', async () => {
    const prisma = fintoPrisma((p) => {
      p.clientProfile.findUnique.mockResolvedValue({ ...PROFILO_BASE, intolerances: ['gluten'] });
    });
    await assegnaSenzaGlutine(prisma, 'cli-1', { senzaAvviso: true });
    expect(prisma.clientProfile.updateMany).toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('senza profilo non fa niente, invece di esplodere', async () => {
    const prisma = fintoPrisma((p) => p.clientProfile.findUnique.mockResolvedValue(null));
    expect((await assegnaSenzaGlutine(prisma, 'cli-1')).esito).toBe('non_serve');
  });
});
