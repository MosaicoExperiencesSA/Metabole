import type { ValidationError } from 'class-validator';
import { fabbricaErroreValidazione, messaggiDaErrori, nomeCampo, traduciMessaggio } from './messaggi-validazione';

/**
 * LA RETE SOTTO I MESSAGGI DI VALIDAZIONE (13/8).
 *
 * Il caso vero: una cliente si è vista rispondere «hipsCm must not be less than 40» sotto un pulsante
 * che sembrava rotto. La difesa principale resta il `message` scritto a mano sul decoratore
 * (`messaggi-clienti.spec.ts`), che copre i DTO che una cliente compila; questa è la rete per tutti gli
 * altri.
 *
 * Il test che conta più di tutti è quello che verifica che un messaggio **nostro** non venga toccato:
 * una traduzione automatica che riscrive una frase scritta da una persona è un danno nuovo, non una
 * correzione.
 */
const errore = (property: string, constraints: Record<string, string>, children: ValidationError[] = []): ValidationError =>
  ({ property, constraints, children } as ValidationError);

describe('traduciMessaggio — gli schemi di class-validator', () => {
  it('IL CASO VERO: «hipsCm must not be less than 40»', () => {
    expect(traduciMessaggio('hipsCm must not be less than 40', 'hipsCm'))
      .toBe('La circonferenza fianchi non può essere minore di 40.');
  });

  it('campo obbligatorio', () => {
    expect(traduciMessaggio('email should not be empty', 'email')).toBe('L\'email è obbligatorio.');
  });

  it('email, numeri, testo, booleani, date', () => {
    expect(traduciMessaggio('email must be an email', 'email')).toContain('non sembra un indirizzo valido');
    expect(traduciMessaggio('steps must be an integer number', 'steps')).toContain('numero intero');
    expect(traduciMessaggio('weightKg must be a number conforming to the specified constraints', 'weightKg')).toContain('con un numero');
    expect(traduciMessaggio('text must be a string', 'text')).toContain('come testo');
    expect(traduciMessaggio('ok must be a boolean value', 'ok')).toContain('sì o no');
    expect(traduciMessaggio('date must be a valid ISO 8601 date string', 'date')).toContain('non è una data valida');
  });

  it('lunghezze e intervalli, col numero che era nel messaggio', () => {
    expect(traduciMessaggio('note must be shorter than or equal to 600 characters', 'note')).toContain('al massimo 600 caratteri');
    expect(traduciMessaggio('password must be longer than or equal to 8 characters', 'password')).toContain('almeno 8 caratteri');
    expect(traduciMessaggio('glasses must not be greater than 20', 'glasses')).toContain('maggiore di 20');
    expect(traduciMessaggio('weightKg must not be less than 30.5', 'weightKg')).toContain('minore di 30.5');
  });

  it('valori ammessi: l\'elenco si tiene, è l\'unica parte utile', () => {
    expect(traduciMessaggio('status must be one of the following values: pending, approved', 'status'))
      .toBe('Il campo «status» può essere solo: pending, approved.');
  });

  it('campo non previsto (whitelist): non è un errore della persona', () => {
    // `forbidNonWhitelisted` scatta su una richiesta malformata, non su un dato sbagliato: la frase
    // deve dirlo, altrimenti si cerca l'errore nel posto sbagliato.
    expect(traduciMessaggio('property pippo should not exist', 'pippo'))
      .toBe('Il campo «pippo» non è previsto in questa richiesta.');
  });

  it('sugli array tiene il «ogni valore»: dice se sbaglia l\'elenco o un suo elemento', () => {
    expect(traduciMessaggio('each value in tags must be a string', 'tags')).toBe('Ogni valore: il campo «tags» va indicato come testo.');
  });

  it('UN MESSAGGIO NOSTRO NON SI TOCCA', () => {
    // È il test che protegge il lavoro fatto a mano sui DTO client-facing: quelle frasi sono migliori
    // di qualunque traduzione automatica, e riscriverle sarebbe una regressione silenziosa.
    const nostro = 'I fianchi sembrano troppo piccoli: controlla il valore in cm.';
    expect(traduciMessaggio(nostro, 'hipsCm')).toBe(nostro);
    const inglese = 'Weight must be measured in the morning'; // scritto da noi, comunque non si tocca
    expect(traduciMessaggio(inglese, 'weightKg')).toBe(inglese);
  });
});

describe('nomeCampo', () => {
  it('i campi che una persona compila hanno un nome in italiano', () => {
    expect(nomeCampo('email')).toBe('l\'email');
    expect(nomeCampo('hipsCm')).toBe('la circonferenza fianchi');
  });

  it('gli altri restano tecnici, fra apici — e va bene: la frase è comunque in italiano', () => {
    expect(nomeCampo('stripeSubscriptionId')).toBe('il campo «stripeSubscriptionId»');
  });
});

describe('messaggiDaErrori', () => {
  it('percorre gli errori ANNIDATI: senza, un 400 non direbbe niente', () => {
    const annidato = errore('indirizzo', {}, [errore('via', { isNotEmpty: 'via should not be empty' })]);
    expect(messaggiDaErrori([annidato])).toEqual(['Il campo «via» è obbligatorio.']);
  });

  it('non ripete la stessa frase due volte', () => {
    // Su un campo vuoto scattano insieme `@IsString` e `@IsNotEmpty`: due frasi identiche sembrano un
    // errore del sistema, non della richiesta.
    const e = errore('note', {
      isNotEmpty: 'note should not be empty',
      isString: 'note should not be empty',
    });
    expect(messaggiDaErrori([e])).toHaveLength(1);
  });

  it('più campi sbagliati: una frase per ognuno', () => {
    const out = messaggiDaErrori([
      errore('email', { isEmail: 'email must be an email' }),
      errore('password', { minLength: 'password must be longer than or equal to 8 characters' }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('fabbricaErroreValidazione', () => {
  it('risponde 400 tenendo la FORMA che l\'app si aspetta: `message` come elenco', () => {
    // L'app e il backoffice leggono `message` (stringa o elenco) e uniscono con « · »: cambiare la
    // forma qui romperebbe ogni schermata che mostra un errore di validazione.
    const ex = fabbricaErroreValidazione([errore('email', { isEmail: 'email must be an email' })]);
    expect(ex.getStatus()).toBe(400);
    const body = ex.getResponse() as { message: string[] };
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message[0]).toContain('L\'email');
  });

  it('errori senza vincoli leggibili → una frase comunque, non un elenco vuoto', () => {
    const body = fabbricaErroreValidazione([errore('x', {})]).getResponse() as { message: string[] };
    expect(body.message).toEqual(['La richiesta non è valida.']);
  });
});
