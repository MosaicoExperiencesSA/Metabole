import { RISPOSTA_FERMATA, numeriEstranei, verificaRispostaGaia } from './guardia-risposta-ai';

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

/**
 * MODALITÀ FONDATA — «può affermarlo ma deve prima verificare» (Simone, 11/8, poche ore dopo il
 * basmati).
 *
 * Con i dati della banca dati davanti, il controllo si capovolge: non più «hai detto un numero?» ma
 * «hai detto un numero che non ti ho dato?». È l'unica differenza tecnica fra un modello che **cita**
 * e un modello che **ricorda** — e la ragione per cui adesso Gaia può rispondere invece di girare
 * tutto alla nutrizionista.
 */
describe('verificaRispostaGaia — con i dati della banca dati', () => {
  const dati = { numeriAmmessi: [57, 67, 50, 68, 100, 367, 341, 9, 7.5] };

  it('la risposta GIUSTA al basmati ora passa: cita il range e la fonte', () => {
    const buona =
      "Secondo le tabelle internazionali l'indice glicemico del riso basmati sta fra 57 e 67, " +
      'e quello del riso integrale fra 50 e 68: sono vicini, e la differenza dipende più dalla varietà ' +
      'e dalla cottura che dal tipo.';
    expect(verificaRispostaGaia(buona, dati)).toEqual({ ok: true });
  });

  it('senza i dati la STESSA frase resta bloccata: la differenza è chi ha fornito i numeri', () => {
    const stessaFrase = "L'indice glicemico del riso basmati sta fra 57 e 67.";
    expect(verificaRispostaGaia(stessaFrase, dati).ok).toBe(true);
    expect(verificaRispostaGaia(stessaFrase, null).ok).toBe(false);
  });

  it('un numero che NON gli abbiamo dato ferma la risposta', () => {
    // 58 non è nella scheda: se compare, l'ha messo il modello.
    const inventato = "L'indice glicemico del riso basmati è 58.";
    const esito = verificaRispostaGaia(inventato, dati);
    expect(esito.ok).toBe(false);
    expect(esito.motivo).toContain('non presenti nei dati forniti');
  });

  it('i valori per 100 g passano se sono i nostri', () => {
    expect(verificaRispostaGaia('100 g di riso basmati crudo sono 367 kcal e 9 g di proteine.', dati).ok).toBe(true);
    expect(verificaRispostaGaia('100 g di riso basmati crudo sono 380 kcal.', dati).ok).toBe(false);
  });

  it('confrontare fra loro i valori forniti è aritmetica, non opinione: passa', () => {
    expect(verificaRispostaGaia('Il riso integrale ha più fibre del basmati.', dati).ok).toBe(true);
  });

  it('gli arrotondamenti non fanno bocciare una risposta giusta', () => {
    // 7,5 g di proteine detto «7,5» o «7.5»: lo stesso numero.
    expect(verificaRispostaGaia('Il riso integrale ha 7.5 g di proteine.', dati).ok).toBe(true);
  });

  it('i conteggi della vita quotidiana non sono dati: 2 volte al giorno passa', () => {
    expect(verificaRispostaGaia('Puoi mangiarlo 2 o 3 volte a settimana, ne parliamo con la coach.', dati).ok).toBe(true);
  });

  it('MA la sazietà resta vietata anche con i dati: quella non è in tabella', () => {
    const esito = verificaRispostaGaia('Il basmati ha indice glicemico fra 57 e 67, quindi sazia meno.', dati);
    expect(esito.ok).toBe(false);
    expect(esito.motivo).toContain('effetto fisiologico');
  });

  it('e resta vietato dire se un alimento può sostituire un altro: lo decide la nutrizionista', () => {
    const esito = verificaRispostaGaia('Puoi sostituire il riso integrale con il basmati senza problemi.', dati);
    expect(esito.ok).toBe(false);
    expect(esito.motivo).toContain('sostituzione');
  });

  it('una scheda vuota NON è modalità fondata: i divieti valgono tutti', () => {
    expect(verificaRispostaGaia("L'indice glicemico è 62.", { numeriAmmessi: [] }).ok).toBe(false);
  });
});

describe('numeriEstranei', () => {
  it('trova solo i numeri che non sono fra quelli forniti', () => {
    expect(numeriEstranei('sono 367 kcal e 58 di indice', [367, 57, 67])).toEqual([58]);
  });

  it('gli anni non contano come dati nutrizionali', () => {
    expect(numeriEstranei('le tabelle del 2021 dicono 65', [65])).toEqual([]);
  });

  it('i numeri fino a 12 non contano: sono conteggi, non valori', () => {
    expect(numeriEstranei('3 volte al giorno, 8 bicchieri', [])).toEqual([]);
  });
});
