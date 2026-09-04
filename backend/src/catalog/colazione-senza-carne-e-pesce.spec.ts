/**
 * ⛔ **LE PROVE DELLA PULIZIA DI COLAZIONE, SPUNTINO E MERENDA.**
 *
 * I nomi veri vengono dalla schermata del 4/9 — «Basso indice glicemico · Onnivoro · Colazione» —
 * dove Simone ha trovato branzino, burger di merluzzo, dentice, filetto di trota e salmone
 * affumicato accanto all'avena e ai pancake.
 *
 * ⛔ **E la metà che conta è la seconda**: questa pulizia TOGLIE righe da un paniere, quindi un
 * falso positivo non è un fastidio — è una colazione buona che sparisce.
 */
import {
  fuoriPostoAColazione, guardaLeCelle, celleDaPulire, celleTroppoVuote, daTogliere, MINIMO_PER_CELLA,
} from './colazione-senza-carne-e-pesce';

const p = (nome: string, ingredienti: string[] = [], pesati?: { name: string; grammi: number | null }[]) =>
  ({ id: nome, nome, ingredienti, pesati });

describe('cosa non ci va a colazione', () => {
  it.each([
    ['Branzino al vapore con cavolini di Bruxelles e semi di girasole', 'pesce nel nome'],
    ['Burger di merluzzo, cavolfiore e noci', 'pesce nel nome'],
    ['Dentice al vapore con purè di ceci e spinaci crudi', 'pesce nel nome'],
    ['Filetto di trota affumicata con rapa bianca cruda e semi di chia', 'pesce nel nome'],
    ['Crostini integrale di grano saraceno con salmone affumicato e sesamo', 'pesce nel nome'],
    ['Uova strapazzate con prosciutto crudo', 'carne nel nome'],
  ])('«%s» esce, ed è %s', (nome, motivo) => {
    expect(fuoriPostoAColazione(p(nome))?.motivo).toBe(motivo);
  });

  /** ⚠️ Il nome può non dirlo: i gamberetti stanno spesso solo nell'elenco degli ingredienti. */
  it('esce anche quando il pesce sta solo fra gli ingredienti', () => {
    const e = fuoriPostoAColazione(p('Insalata tiepida di quinoa', ['quinoa', 'gamberetti sgusciati', 'limone']));
    expect(e).toMatchObject({ motivo: 'pesce fra gli ingredienti', prova: 'gamberetti sgusciati' });
  });

  it('e quando la carne sta solo fra gli ingredienti', () => {
    const e = fuoriPostoAColazione(p('Toast integrale', ['pane integrale', 'petto di tacchino', 'insalata']));
    expect(e).toMatchObject({ motivo: 'carne fra gli ingredienti', prova: 'petto di tacchino' });
  });
});

/**
 * ⛔ **QUELLO CHE NON DEVE SPARIRE.** Sono colazioni vere, prese dalla stessa schermata: se questa
 * pulizia le portasse via, il paniere si svuoterebbe di roba giusta.
 */
describe('quello che resta a colazione', () => {
  it.each([
    'Avena integrale con frutti di bosco e mandorle',
    'Avocado toast integrale e uovo',
    'Budino di ricotta con mandorle tostate e melograno',
    'Chia pudding con latte di cocco e frutti di bosco',
    'Crepes proteiche di albumi con ricotta e lamponi',
    'Fiocchi d\'avena con mandorle e mela',
    'Formaggio bianco magro con lamponi e semi di lino',
  ])('«%s» resta', (nome) => {
    expect(fuoriPostoAColazione(p(nome))).toBeNull();
  });

  /**
   * ⛔ **La riga che la correzione di stamattina rende possibile.** «Burger **vegetale** di
   * lenticchie nere» era nella stessa schermata: senza `senzaImitazioni` questa pulizia l'avrebbe
   * tolto dal paniere della colazione, cioè avrebbe fatto il danno che esiste per evitare.
   */
  it('⛔ «Burger vegetale di lenticchie nere con insalata di cavolo rosso» resta', () => {
    expect(fuoriPostoAColazione(p('Burger vegetale di lenticchie nere con insalata di cavolo rosso'))).toBeNull();
  });

  /** ⚠️ E il melograno non è un «grano»: è la correzione delle esclusioni, sulla stessa consegna. */
  it('⚠️ il melograno non fa scattare niente', () => {
    expect(fuoriPostoAColazione(p('Budino di ricotta con melograno', ['ricotta', 'melograno']))).toBeNull();
  });
});

describe('le celle: quante ne restano decide se si può togliere', () => {
  const conPesce = (n: number) => Array.from({ length: n }, (_, i) => p(`Branzino numero ${i}`));
  const buone = (n: number) => Array.from({ length: n }, (_, i) => p(`Porridge numero ${i}`));

  it('conta i fuori posto e quanti resterebbero', () => {
    const [e] = guardaLeCelle([{ paniereId: 'x', etichetta: 'BIG · Onnivoro', slot: 'breakfast', piatti: [...conPesce(3), ...buone(10)] }]);
    expect(e).toMatchObject({ quanti: 13, restano: 10 });
    expect(e.fuoriPosto).toHaveLength(3);
  });

  /**
   * ⛔ **Una cella che resterebbe vuota non si tocca, e si dice.** Il branzino a colazione è
   * sbagliato; una colazione che non c'è è peggio — la cliente apre l'app e non trova niente.
   */
  it('⛔ sotto la soglia la cella NON si pulisce, ma si nomina', () => {
    const esiti = guardaLeCelle([
      { paniereId: 'piena', etichetta: 'piena', slot: 'breakfast', piatti: [...conPesce(2), ...buone(20)] },
      { paniereId: 'magra', etichetta: 'magra', slot: 'morning_snack', piatti: [...conPesce(5), ...buone(3)] },
    ]);
    expect(celleDaPulire(esiti).map((c) => c.paniereId)).toEqual(['piena']);
    expect(celleTroppoVuote(esiti).map((c) => c.paniereId)).toEqual(['magra']);
  });

  it('una cella senza fuori posto non compare in nessuno dei due elenchi', () => {
    const esiti = guardaLeCelle([{ paniereId: 'ok', etichetta: 'ok', slot: 'breakfast', piatti: buone(12) }]);
    expect(celleDaPulire(esiti)).toEqual([]);
    expect(celleTroppoVuote(esiti)).toEqual([]);
  });

  /** ⚠️ La soglia è un numero di prodotto, e si può spostare sapendo perché era lì. */
  it('⚠️ la soglia si può spostare, e la risposta cambia con lei', () => {
    const esiti = guardaLeCelle([{ paniereId: 'x', etichetta: 'x', slot: 'breakfast', piatti: [...conPesce(2), ...buone(5)] }]);
    expect(celleDaPulire(esiti, MINIMO_PER_CELLA)).toEqual([]);
    expect(celleDaPulire(esiti, 5).map((c) => c.paniereId)).toEqual(['x']);
  });

  /** ⚠️ Le verdure si CONTANO e non si tolgono: «Avocado toast» è una colazione normale. */
  it('⚠️ le verdure si contano soltanto', () => {
    const [e] = guardaLeCelle([{
      paniereId: 'x', etichetta: 'x', slot: 'breakfast',
      piatti: [p('Vellutata di broccoli', ['broccoli'], [{ name: 'broccoli', grammi: 300 }]), ...buone(10)],
    }]);
    expect(e.fuoriPosto).toEqual([]);
    expect(e.restano).toBe(11);
  });

  /**
   * ⛔ **LE BOZZE SI TOLGONO SEMPRE — il caso trovato in produzione il 4/9, dopo `APPLICA=1`.**
   *
   * Simone, riaprendo la pagina Panieri col filtro «Mostra solo in bozza»: *«da qui non ha tolto
   * pesce, carne, molluschi e crostacei»*. La prima stesura guardava **solo le ricette attive**,
   * col commento «una bozza spenta non arriva nel piatto di nessuno»: vero oggi, falso il giorno
   * che qualcuno la valida — che è il senso di quella pagina.
   *
   * ⚠️ E la soglia non le riguarda: una bozza non arriva a nessuna cliente, quindi toglierla non
   * può svuotare niente.
   */
  it('⛔ una bozza fuori posto si toglie anche se la cella è magra', () => {
    const [e] = guardaLeCelle([{
      paniereId: 'x', etichetta: 'x', slot: 'breakfast',
      piatti: [{ ...p('Branzino al vapore'), attivo: false }, ...buone(2)],
    }]);
    expect(daTogliere(e).map((f) => f.nome)).toEqual(['Branzino al vapore']);
    expect(celleDaPulire([e]).map((c) => c.paniereId)).toEqual(['x']);
  });

  /** ⛔ E la stessa riga ATTIVA, nella stessa cella magra, non si tocca: è quello che protegge. */
  it('⛔ ma la stessa riga attiva, in una cella magra, resta', () => {
    const [e] = guardaLeCelle([{
      paniereId: 'x', etichetta: 'x', slot: 'breakfast',
      piatti: [p('Branzino al vapore'), ...buone(2)],
    }]);
    expect(daTogliere(e)).toEqual([]);
    expect(celleTroppoVuote([e]).map((c) => c.paniereId)).toEqual(['x']);
  });

  /**
   * ⛔ **La soglia si misura sulle ATTIVE, non su tutte.** Una cella con venti bozze e tre attive
   * sembrerebbe piena e non lo è: la cliente riceve tre piatti.
   */
  it('⛔ venti bozze non fanno passare la soglia per le tre attive', () => {
    const [e] = guardaLeCelle([{
      paniereId: 'x', etichetta: 'x', slot: 'breakfast',
      piatti: [
        p('Branzino al vapore'),
        ...buone(2),
        ...buone(20).map((b, i) => ({ ...b, id: `bozza-${i}`, nome: `bozza ${i}`, attivo: false })),
      ],
    }]);
    expect(e.attivi).toBe(3);
    expect(e.restanoAttivi).toBe(2);
    expect(daTogliere(e)).toEqual([]);
  });

  /**
   * ⚠️ **Una cella può stare in tutti e due gli elenchi**, ed è la situazione normale di un paniere
   * a metà validazione: le sue bozze si puliscono, le sue attive no.
   */
  it('⚠️ bozze da togliere e attive da lasciare, nella stessa cella', () => {
    const [e] = guardaLeCelle([{
      paniereId: 'x', etichetta: 'x', slot: 'breakfast',
      piatti: [
        p('Branzino al vapore'),
        { ...p('Filetto di trota'), id: 'trota-bozza', attivo: false },
        ...buone(2),
      ],
    }]);
    expect(daTogliere(e).map((f) => f.nome)).toEqual(['Filetto di trota']);
    expect(celleDaPulire([e]).map((c) => c.paniereId)).toEqual(['x']);
    expect(celleTroppoVuote([e]).map((c) => c.paniereId)).toEqual(['x']);
  });

  /** ⚠️ «Non lo so» vale ATTIVA: il ripiego fa togliere di meno, non di più. */
  it('⚠️ una riga senza `attivo` conta come attiva', () => {
    const [e] = guardaLeCelle([{
      paniereId: 'x', etichetta: 'x', slot: 'breakfast',
      piatti: [p('Branzino al vapore'), ...buone(2)],
    }]);
    expect(e.attivi).toBe(3);
    expect(daTogliere(e)).toEqual([]);
  });
});
