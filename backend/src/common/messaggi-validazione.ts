/**
 * LA RETE SOTTO I MESSAGGI DI VALIDAZIONE — perché un DTO nuovo non nasca in inglese.
 *
 * `class-validator` mette un messaggio in inglese **di default**: un DTO nuovo nasce sbagliato senza
 * che nessuno faccia niente di male, e il difetto si scopre quando ci sbatte contro una persona vera.
 * Il 7/8 una cliente si è vista rispondere «hipsCm must not be less than 40» sotto un pulsante che
 * sembrava rotto: non è nella sua lingua, non dice cosa fare, e contiene il nome di una colonna del
 * database.
 *
 * La difesa che c'era — un `message` scritto a mano su ogni decoratore, con un test che lo pretende sui
 * DTO che una cliente compila (`messaggi-clienti.spec.ts`) — è la migliore e resta la prima. Ma copre
 * solo i DTO in quella lista, che si allunga a mano: chat, documenti, buoni sconto ed eventi sono
 * scoperti, e il commento in testa a quel test lo diceva già («la `ValidationPipe` non ha un
 * `exceptionFactory` che possa rimediare a valle»).
 *
 * Questo file è quel rimedio a valle. Non sostituisce il messaggio scritto a mano: lo **lascia
 * passare intatto** e traduce solo quelli che `class-validator` ha generato da sé.
 *
 * ## Come si riconosce un messaggio «di default»
 *
 * Dai suoi schemi, che sono pochi e stabili: «must be a string», «should not be empty», «must not be
 * less than 40». Un messaggio nostro non somiglia a nessuno di quelli, quindi non viene toccato — e
 * nel dubbio si preferisce **non tradurre**: un messaggio inglese scritto da noi è comunque una scelta
 * di qualcuno, una traduzione automatica sbagliata è un danno nuovo.
 *
 * ## Il nome del campo resta il suo, e va detto
 *
 * `hipsCm` in italiano non è «fianchi cm»: tradurre i nomi dei campi richiederebbe un dizionario di
 * tutto il modello dati, che nessuno terrebbe aggiornato. Qui c'è un dizionario **corto** dei campi che
 * una persona compila davvero; per gli altri il nome resta tecnico. Per questo la regola del `message`
 * scritto a mano non decade: su una schermata che vede una cliente, quello è ancora l'unico modo di
 * dirle una frase giusta. Questa rete serve perché il caso peggiore sia «italiano un po' tecnico»
 * invece di «inglese incomprensibile».
 */
import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/** I campi che una persona compila davvero. Corto per scelta: un dizionario lungo non si mantiene. */
const NOMI: Record<string, string> = {
  email: 'l\'email',
  password: 'la password',
  newPassword: 'la nuova password',
  currentPassword: 'la password attuale',
  firstName: 'il nome',
  lastName: 'il cognome',
  name: 'il nome',
  phone: 'il telefono',
  birthDate: 'la data di nascita',
  weightKg: 'il peso',
  heightCm: 'l\'altezza',
  waistCm: 'la circonferenza vita',
  hipsCm: 'la circonferenza fianchi',
  thighsCm: 'la circonferenza cosce',
  age: 'l\'età',
  steps: 'i passi',
  glasses: 'i bicchieri d\'acqua',
  mood: 'l\'umore',
  text: 'il testo',
  message: 'il messaggio',
  note: 'la nota',
  date: 'la data',
  code: 'il codice',
};

/** Come nominare il campo in una frase. Senza traduzione resta il nome tecnico, fra apici. */
export function nomeCampo(campo: string): string {
  return NOMI[campo] ?? `il campo «${campo}»`;
}

/**
 * Gli schemi dei messaggi di `class-validator`, in ordine: il primo che combacia vince.
 *
 * Sono espressioni regolari sul messaggio già composto (il nome del campo è dentro), perché è quello
 * che arriva qui — i metadati del decoratore a questo punto non ci sono più.
 */
const SCHEMI: { re: RegExp; it: (m: RegExpMatchArray, campo: string) => string }[] = [
  // Whitelist: campo non dichiarato nel DTO. Non è un errore della persona, è una richiesta malformata.
  { re: /^property (.+) should not exist$/, it: (m) => `Il campo «${m[1]}» non è previsto in questa richiesta.` },
  { re: /should not be empty$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} è obbligatorio.` },
  { re: /must be an email$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} non sembra un indirizzo valido.` },
  { re: /must be a valid phone number$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} non sembra un numero valido.` },
  { re: /must be shorter than or equal to (\d+) characters$/, it: (m, c) => `${maiuscola(nomeCampo(c))} può essere lungo al massimo ${m[1]} caratteri.` },
  { re: /must be longer than or equal to (\d+) characters$/, it: (m, c) => `${maiuscola(nomeCampo(c))} deve essere lungo almeno ${m[1]} caratteri.` },
  { re: /must not be less than (-?[\d.]+)$/, it: (m, c) => `${maiuscola(nomeCampo(c))} non può essere minore di ${m[1]}.` },
  { re: /must not be greater than (-?[\d.]+)$/, it: (m, c) => `${maiuscola(nomeCampo(c))} non può essere maggiore di ${m[1]}.` },
  { re: /must be one of the following values: (.+)$/, it: (m, c) => `${maiuscola(nomeCampo(c))} può essere solo: ${m[1]}.` },
  { re: /must be a valid enum value$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} ha un valore non ammesso.` },
  { re: /must be an integer number$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} va indicato con un numero intero.` },
  { re: /must be a number.*$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} va indicato con un numero.` },
  { re: /must be a string$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} va indicato come testo.` },
  { re: /must be a boolean value$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} può essere solo sì o no.` },
  { re: /must be a (valid ISO 8601 date string|Date instance)$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} non è una data valida.` },
  { re: /must be a UUID$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} non è un identificativo valido.` },
  { re: /must be a URL address$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} non è un indirizzo valido.` },
  { re: /must be an array$/, it: (_m, c) => `${maiuscola(nomeCampo(c))} deve essere un elenco.` },
  { re: /must contain at least (\d+) elements$/, it: (m, c) => `${maiuscola(nomeCampo(c))} deve contenere almeno ${m[1]} elementi.` },
  { re: /must contain not more than (\d+) elements$/, it: (m, c) => `${maiuscola(nomeCampo(c))} può contenere al massimo ${m[1]} elementi.` },
];

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Traduce un messaggio **solo** se è uno di quelli generati da `class-validator`.
 *
 * `ogni valore di …`: sugli array class-validator antepone «each value in », e quel pezzo va tenuto
 * perché dice quale delle due cose è sbagliata — l'elenco o un suo elemento.
 */
export function traduciMessaggio(messaggio: string, campo: string): string {
  const perOgniValore = messaggio.startsWith('each value in ');
  const corpo = perOgniValore ? messaggio.slice('each value in '.length) : messaggio;
  for (const s of SCHEMI) {
    const m = corpo.match(s.re);
    if (m) {
      const tradotto = s.it(m, campo);
      return perOgniValore ? `Ogni valore: ${tradotto.charAt(0).toLowerCase()}${tradotto.slice(1)}` : tradotto;
    }
  }
  // Nessuno schema combacia → è un messaggio scritto da qualcuno. Non si tocca.
  return messaggio;
}

/**
 * Appiattisce gli errori (compresi quelli **annidati** dei DTO dentro DTO) in un elenco di frasi.
 *
 * Gli annidati vanno percorsi: senza, un oggetto sbagliato dentro il corpo produce un errore con
 * `constraints` vuoto e la risposta diventa un elenco vuoto — cioè un 400 che non dice niente, che è
 * il modo peggiore di rifiutare una richiesta.
 */
export function messaggiDaErrori(errori: ValidationError[]): string[] {
  const out: string[] = [];
  const visita = (e: ValidationError, prefisso: string) => {
    const campo = prefisso ? `${prefisso}.${e.property}` : e.property;
    for (const m of Object.values(e.constraints ?? {})) {
      out.push(traduciMessaggio(String(m), e.property));
    }
    for (const figlio of e.children ?? []) visita(figlio, campo);
  };
  for (const e of errori) visita(e, '');
  // Due vincoli diversi possono produrre la stessa frase (es. `@IsString` e `@IsNotEmpty` su un campo
  // vuoto): ripeterla due volte sembra un errore del sistema, non della richiesta.
  return [...new Set(out)];
}

/**
 * La `exceptionFactory` da dare alla `ValidationPipe`.
 *
 * Mantiene la forma della risposta di Nest — `{ message: string[] }` — perché l'app e il backoffice la
 * leggono così (`messageFrom` nel client unisce l'elenco con « · »): cambiarla qui vorrebbe dire
 * rompere ogni schermata che oggi mostra un errore di validazione.
 */
export function fabbricaErroreValidazione(errori: ValidationError[]): BadRequestException {
  const messaggi = messaggiDaErrori(errori);
  return new BadRequestException(messaggi.length ? messaggi : ['La richiesta non è valida.']);
}
