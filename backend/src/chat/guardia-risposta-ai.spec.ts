import { RISPOSTA_FERMATA, verificaRispostaGaia } from './guardia-risposta-ai';

/**
 * IL BASMATI (segnalato l'11/8, conversazione del 1° agosto).
 *
 * La frase esatta che Gaia ha scritto a una cliente è il primo test, ed è il motivo per cui questo
 * file esiste. Il dato è invertito: il basmati sta intorno a IG 50-58, il riso integrale comune a
 * 65-70. Nessuno se n'era accorto perché il filtro guardava solo quello che scriveva la CLIENTE.
 */
const FRASE_DEL_BASMATI =
  "Il riso basmati è più raffinato e ha un indice glicemico più alto rispetto all'integrale, " +
  'quindi sazia meno e fa aumentare più rapidamente la glicemia. Se vuoi mantenerti in linea con ' +
  "gli obiettivi di Metabole, l'integrale rimane la scelta migliore, ma occasionalmente puoi fare " +
  'la sostituzione! Se hai esigenze specifiche, il nutrizionista potrà consigliarti al meglio.';

describe('verificaRispostaGaia — quello che Gaia NON può affermare', () => {
  it('la frase del basmati non si manda', () => {
    const esito = verificaRispostaGaia(FRASE_DEL_BASMATI);
    expect(esito.ok).toBe(false);
    expect(esito.motivo).toBeTruthy();
  });

  it('gli indicatori clinici per nome fermano la risposta', () => {
    for (const frase of [
      'Il pane bianco ha un indice glicemico più alto.',
      'Questo aiuta a tenere la glicemia stabile.',
      "L'avocado fa bene al colesterolo.",
      'Stimola meno insulina.',
    ]) {
      expect(verificaRispostaGaia(frase).ok).toBe(false);
    }
  });

  it('i confronti nutrizionali fra alimenti fermano la risposta', () => {
    for (const frase of [
      'Il tacchino ha più proteine del pollo.',
      'La pasta integrale ha più fibre.',
      'Ha meno calorie della versione classica.',
      'Le mandorle sono più caloriche delle noci.',
    ]) {
      expect(verificaRispostaGaia(frase).ok).toBe(false);
    }
  });

  it('gli effetti fisiologici attribuiti a un cibo fermano la risposta', () => {
    for (const frase of [
      'Sazia meno del riso integrale.',
      'Fa aumentare la fame nel pomeriggio.',
      'Si assorbe più lentamente, quindi ti tiene sazia.',
      'Evita il picco glicemico di metà mattina.',
    ]) {
      expect(verificaRispostaGaia(frase).ok).toBe(false);
    }
  });

  it('i numeri nutrizionali fermano la risposta: quella tabella Gaia non la ha davanti', () => {
    for (const frase of [
      'Sono circa 350 kcal a porzione.',
      'Ci sono 20 g di proteine.',
      'Aggiungi 30 grammi di carboidrati.',
    ]) {
      expect(verificaRispostaGaia(frase).ok).toBe(false);
    }
  });

  it('il giudizio su una sostituzione ferma la risposta: lo decidono i gruppi di equivalenza', () => {
    for (const frase of [
      'Puoi sostituire il riso con la quinoa senza problemi.',
      'Meglio non sostituire il pesce al posto della carne rossa.',
      'Ti sconsiglio di mettere la panna al posto dello yogurt.',
    ]) {
      expect(verificaRispostaGaia(frase).ok).toBe(false);
    }
  });
});

/**
 * L'altra metà, e conta uguale: una guardia che ferma tutto spegne Gaia. Il suo lavoro — pasti,
 * orari, abitudini, motivazione, uso dell'app — deve passare intero.
 */
describe('verificaRispostaGaia — quello che Gaia può dire tranquillamente', () => {
  it('conversazione normale: passa', () => {
    for (const frase of [
      'Trovi il menu di domani nella sezione Menu, si apre la sera prima.',
      'Se salti la colazione dimmelo, così ne parliamo con la tua coach.',
      'Bello questo passo avanti: due settimane di costanza non sono poco.',
      'La spesa la puoi fare una volta a settimana, ti preparo la lista.',
      'Se il piatto di stasera non ti va, dal pulsante «Sostituisci un ingrediente» ne cerchiamo un altro.',
      'Bevi con calma durante la giornata, non tutto insieme la sera.',
      'La tua nutrizionista ti risponde di solito entro un giorno lavorativo.',
    ]) {
      expect(verificaRispostaGaia(frase)).toEqual({ ok: true });
    }
  });

  it('i numeri che NON sono nutrizionali passano: orari, giorni, bicchieri', () => {
    for (const frase of [
      'Il prossimo ciclo di menu arriva fra 7 giorni.',
      'Ti consiglio 8 bicchieri al giorno, come dice il tuo obiettivo nell\'app.',
      'Ci vediamo alla visita del 12 settembre.',
    ]) {
      expect(verificaRispostaGaia(frase)).toEqual({ ok: true });
    }
  });

  it('testo vuoto o assente non è un problema della guardia', () => {
    expect(verificaRispostaGaia(null)).toEqual({ ok: true });
    expect(verificaRispostaGaia('')).toEqual({ ok: true });
  });

  it('la risposta di ripiego dice cosa succede adesso, non solo «non lo so»', () => {
    expect(RISPOSTA_FERMATA).toContain('nutrizionista');
    expect(RISPOSTA_FERMATA).toMatch(/girat|risponde lei/);
  });
});
