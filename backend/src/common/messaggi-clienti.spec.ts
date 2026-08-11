import 'reflect-metadata';
import { getMetadataStorage } from 'class-validator';
import { SubmitAnswersDto } from '../onboarding/dto/submit-answers.dto';
import { UpdateObjectiveDto, UpdateProfileDto, UpdateThemeDto } from '../profile/dto/update-profile.dto';
import { CreateCheckinDto, CreateMeasurementDto, CreateStepsDto, CreateWaterDto } from '../signals/dto/signals.dto';
import { LoginDto } from '../auth/dto/login.dto';

/**
 * ## La regola che questo test rende obbligatoria
 *
 * **Un messaggio di validazione che può arrivare a una cliente si scrive in italiano.**
 *
 * Non è una preferenza di stile. Il 7/8 una cliente si è vista rispondere «hipsCm must not be
 * less than 40» sotto un pulsante che sembrava rotto: quel messaggio non dice cosa fare, non è
 * nella sua lingua e contiene il nome di una colonna del database. Il controllo fatto dopo ha
 * trovato lo stesso problema in una decina di altri punti, **registrazione compresa**.
 *
 * ## Perché serve un test e non basta la buona volontà
 *
 * `class-validator` mette un messaggio in inglese **di default**: un DTO nuovo nasce sbagliato
 * senza che nessuno faccia niente di male, e il difetto si scopre solo quando ci sbatte contro
 * una persona vera.
 *
 * Dal 13/8 esiste anche una rete a valle — l'`exceptionFactory` della `ValidationPipe`, in
 * `common/messaggi-validazione.ts` — che traduce gli schemi di class-validator e **lascia intatto**
 * qualunque messaggio scritto a mano. Non rende inutile questo test, per una ragione precisa: quella
 * rete sa dire «la circonferenza fianchi non può essere minore di 40», non sa dire *cosa fare*. Su una
 * schermata che vede una cliente serve la seconda, e la scrive solo una persona. La rete serve perché
 * il caso peggiore sia «italiano un po' tecnico» invece di «inglese incomprensibile».
 *
 * Questo test legge i **metadati** dei decoratori e fallisce se un vincolo è senza `message`.
 *
 * ## Quando questo test fallisce
 *
 * Hai aggiunto un campo (o un DTO) che una cliente compila. Aggiungi il messaggio:
 * `@Min(40, { message: 'I fianchi sembrano troppo piccoli: controlla il valore in cm.' })`.
 * Scrivi **cosa fare**, non cosa è sbagliato — «I passi vanno indicati con un numero intero,
 * senza punti (es. 10000)» è utile, «steps must be an integer number» no.
 *
 * ## Cosa NON copre
 *
 * Solo i DTO elencati qui sotto. Non c'è modo di scoprire da soli quali DTO siano
 * client-facing, quindi la lista si allunga a mano quando nasce una schermata nuova. Restano
 * fuori di proposito i DTO del **backoffice**: lì il messaggio in inglese è brutto, ma lo legge
 * un'operatrice che sa cos'è un campo obbligatorio.
 */

/** I DTO che una CLIENTE compila dall'app. Aggiungerne uno qui è il modo di proteggerlo. */
const DTO_DELLE_CLIENTI: { nome: string; classe: new (...a: never[]) => object }[] = [
  { nome: 'SubmitAnswersDto (questionario di registrazione)', classe: SubmitAnswersDto },
  { nome: 'UpdateObjectiveDto (modifica obiettivo)', classe: UpdateObjectiveDto },
  { nome: 'UpdateProfileDto (i miei dati)', classe: UpdateProfileDto },
  { nome: 'UpdateThemeDto (colore dell\'app)', classe: UpdateThemeDto },
  { nome: 'CreateMeasurementDto (misure)', classe: CreateMeasurementDto },
  { nome: 'CreateCheckinDto (check-in giornaliero)', classe: CreateCheckinDto },
  { nome: 'CreateWaterDto (acqua)', classe: CreateWaterDto },
  { nome: 'CreateStepsDto (passi)', classe: CreateStepsDto },
  { nome: 'LoginDto (accesso)', classe: LoginDto },
];

/** I vincoli senza `message`: quelli che risponderebbero in inglese. */
function vincoliSenzaMessaggio(classe: new (...a: never[]) => object): string[] {
  const storage = getMetadataStorage();
  // `true` sull'ultimo parametro include i metadati ereditati; le classi annidate (es.
  // l'obiettivo dentro il questionario) hanno i propri e vanno elencate a parte se servisse.
  const metadati = storage.getTargetValidationMetadatas(classe, '', true, false);
  return metadati
    .filter((m) => m.type !== 'conditionalValidation' && m.type !== 'nestedValidation')
    .filter((m) => !m.message)
    .map((m) => `${m.propertyName} → ${String(m.constraintCls?.name ?? m.type)}`);
}

describe('Messaggi di validazione delle schermate cliente', () => {
  it('la lista dei DTO da proteggere non è vuota (altrimenti questo test non guarda niente)', () => {
    expect(DTO_DELLE_CLIENTI.length).toBeGreaterThanOrEqual(9);
  });

  it.each(DTO_DELLE_CLIENTI.map((d) => [d.nome, d.classe] as const))(
    '%s: nessun vincolo risponde in inglese',
    (_nome, classe) => {
      expect(vincoliSenzaMessaggio(classe)).toEqual([]);
    },
  );
});
