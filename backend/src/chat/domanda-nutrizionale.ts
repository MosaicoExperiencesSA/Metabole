/**
 * «QUESTA È UNA DOMANDA SU UN ALIMENTO?» — il riconoscimento, deterministico.
 *
 * Serve a decidere se, prima di far parlare Gaia, vale la pena andare a leggere la banca dati
 * nutrizionale (11/8, richiesta di Simone: «può affermarlo ma deve prima verificare»). Non decide la
 * risposta: decide se cercare i dati.
 *
 * ## Perché è tarato LARGO, al contrario della guardia in uscita
 *
 * Un falso positivo qui costa una lettura in più al database e nient'altro: se il testo non contiene
 * nessun alimento della tabella, la ricerca torna vuota e la conversazione continua identica. Un
 * falso negativo invece costa la cosa che stiamo provando a togliere: Gaia che risponde a memoria
 * perché nessuno le ha messo davanti i dati. Quindi in dubbio si cerca.
 *
 * È il rovescio esatto della taratura di `rilevaIntentoSostituzione`, che è volutamente stretto: là
 * un falso positivo dirotta la cliente in un dialogo a domande chiuse, cioè fa un danno.
 */

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, ' ');

/**
 * I modi di chiedere una proprietà di un alimento. Non c'è nessun nome di cibo qui: i nomi stanno in
 * `nutrient_fact`, e chi decide se un alimento c'è è la tabella, non una regex da tenere aggiornata.
 */
const SEGNALI: RegExp[] = [
  // Gli indicatori e le grandezze, nominati dalla cliente.
  /indice glicemico|carico glicemico|glicemi/,
  /quante? calorie|quante? kcal|calorie (ha|ci sono|del|della|di)|caloric/,
  /quant\w* (proteine|carboidrat\w*|zuccher\w*|grass\w*|fibr\w*)/,
  /(proteine|carboidrat\w*|zuccher\w*|grass\w*|fibr\w*) (ha|ci sono|del|della|di|in)/,
  /valori nutrizional|tabella nutrizional|macro\b|macronutrient/,
  // I confronti: «meglio A o B», «differenza fra A e B», «è più X di Y».
  /\b(meglio|preferibile)\b[^?]{0,40}\bo\b/,
  // Solo «differenz», senza pretendere il «fra» subito dopo: «che differenza c'è fra pane bianco e
  // integrale?» normalizzato diventa «differenza c e fra», e il pattern più preciso lo perdeva. Qui
  // essere larghi costa una lettura al database, essere precisi costa una risposta a memoria.
  /differenz/,
  /(e|è) (piu|meno) (calorico|caloric\w*|proteic\w*|grass\w*|sano|leggero|digeribile)/,
  /(ha|hanno) (piu|meno) (calorie|proteine|carboidrat\w*|zuccher\w*|grass\w*|fibr\w*)/,
  // Le domande di sostanza su un cibo, che sono quelle che portano Gaia a improvvisare.
  /fa (ingrassare|dimagrire|bene|male)/,
  /(quanto|quanta|quanti) .{0,20}(posso mangiare|se ne puo|al giorno)/,
  /\b(integrale|raffinat\w*)\b.{0,30}\b(meglio|differenz|piu|meno)\b/,
];

export function domandaNutrizionale(testo: string): boolean {
  const t = normalizza(testo);
  return SEGNALI.some((p) => p.test(t));
}

/** Parole che non sono mai il nome di un alimento: tolte prima di cercare i mancanti. */
const NON_ALIMENTI = new Set([
  'indice', 'glicemico', 'carico', 'glicemia', 'calorie', 'kcal', 'caloriche', 'calorico', 'proteine',
  'proteico', 'carboidrati', 'zuccheri', 'grassi', 'fibre', 'valori', 'nutrizionali', 'tabella',
  'macro', 'macronutrienti', 'differenza', 'meglio', 'preferibile', 'quante', 'quanti', 'quanto',
  'quanta', 'posso', 'mangiare', 'giorno', 'sera', 'mattina', 'pranzo', 'cena', 'colazione',
  'spuntino', 'ingrassare', 'dimagrire', 'bene', 'male', 'sano', 'leggero', 'digeribile', 'piu',
  'meno', 'molto', 'poco', 'sono', 'hanno', 'della', 'delle', 'degli', 'dello', 'nella', 'nelle',
  'questo', 'questa', 'quello', 'quella', 'anche', 'come', 'cosa', 'perche', 'dice', 'gaia',
  'nutrizionista', 'coach', 'dieta', 'menu', 'piatto', 'pasto', 'grammi', 'porzione', 'sostituire',
  'sostituzione', 'invece', 'oppure', 'sempre', 'davvero', 'vorrei', 'volevo', 'chiedere', 'sapere',
]);

/**
 * I termini che potrebbero essere alimenti, per la lista dei mancanti.
 *
 * Prima le coppie di parole («riso venere», «latte di soia» → «latte soia»), poi le singole: gli
 * alimenti veri hanno spesso due parole, e registrare solo «venere» non aiuterebbe nessuno a capire
 * quale riga aggiungere. Le parole troppo corte e quelle di servizio restano fuori.
 */
export function terminiAlimentoCandidati(testo: string, massimo = 4): string[] {
  const parole = normalizza(testo)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !NON_ALIMENTI.has(p) && !/^\d+$/.test(p));

  const coppie: string[] = [];
  for (let i = 0; i < parole.length - 1; i += 1) coppie.push(`${parole[i]} ${parole[i + 1]}`);
  // Le coppie prima: sono più informative. Poi le singole, senza duplicati.
  return [...new Set([...coppie, ...parole])].slice(0, massimo);
}
