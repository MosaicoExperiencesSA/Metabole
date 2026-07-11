// Genera le voci di Gaia (ElevenLabs) come file MP3.
//
// USO (dal terminale, dentro la cartella del repo):
//   ELEVENLABS_API_KEY=la_tua_chiave VOICE_ID=id_voce node tools/genera_voci_gaia.mjs
//
// - La chiave NON va nel repo: si passa come variabile d'ambiente.
// - VOICE_ID: scegli una voce dalla tua libreria ElevenLabs (consigliata una voce
//   femminile calda). Default: "Alice" (multilingua). Puoi cambiarla.
// - Richiede Node 18+ (ha fetch integrato).
//
// Output: scrive gli MP3 in ./audio e in ./docs/audio (per il sito GitHub Pages),
// con i nomi-chiave usati dal prototipo (benvenuto, facciamo, intro_*, colore).

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';

// Carica le variabili da un file .env (nella cartella del repo), se presente.
// Così la chiave si mette UNA volta e non va mai incollata nei comandi né nel repo (.env è git-ignored).
for (const p of ['.env', 'tools/.env']) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const mm = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (mm && !line.trim().startsWith('#') && !process.env[mm[1]]) {
      process.env[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
    }
  }
}

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID || 'Xb7hH8MSUJpSbSDYk0k2'; // Alice (multilingua)
const MODEL = process.env.MODEL_ID || 'eleven_multilingual_v2';
// FORCE=1 rigenera anche le clip già esistenti. ONLY="key1,key2" genera solo quelle chiavi.
const FORCE = process.env.FORCE === '1';
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);

if (!API_KEY) {
  console.error('Manca ELEVENLABS_API_KEY.\nCrea il file .env nella cartella del repo con dentro:\n  ELEVENLABS_API_KEY=sk_la_tua_chiave_vera\nPoi lancia: node tools/genera_voci_gaia.mjs');
  process.exit(1);
}

// Testi di Gaia (devono combaciare con quelli del prototipo)
const PHRASES = {
  benvenuto: "Ciao, sono Gaia, la tua assistente Èi Ài che ti guiderà passo passo alla configurazione personalizzata di Metàbol Èi Ài, in modo che il tuo percorso di rinascita sia unico e cucito su di te. Appena sei pronta, clicca sul pulsante Entra in Metàbol Èi Ài in fondo.",
  registrazione: "Crea la tua registrazione in pochi passi, in modo da darti l'accesso completo a Metàbol Èi Ài.",
  facciamo: "Per settare e personalizzare la tua app ho bisogno di qualche indicazione su cinque punti: la mente, la vita, l'agenda, il gusto e il corpo.",
  intro_testa: "Per prima cosa, cosa c'è nella tua mente? L'equilibrio mentale è il primo passo per ritrovare la forma fisica corretta. Rispondi pure alle prossime domande.",
  intro_vita: "Ora è importante capire le tue abitudini nella vita reale: lavoro, tempo e abitudini. Così posso predisporre un piano adeguato alle tue esigenze.",
  intro_agenda: "Parliamo della tua agenda: feste, cene, viaggi. Non sono ideali per fare diete, ma questi momenti piacevoli si gestiscono: basta pianificarli.",
  intro_gusto: "E il gusto: cosa ami e cosa eviti. Mangiare bene deve piacerti, o non dura.",
  intro_corpo: "Bene, ora so tutto di te, tranne quali sono i tuoi obiettivi: peso e misure sono obiettivi, senza giudizi. Dimmi dove sei e dove vuoi arrivare.",
  colore: "Anche i colori sono importanti: seleziona quello che ti piace di più e trasformerò la app secondo la tua scelta.",
  percorso: "Giulia, il tuo percorso personalizzato è pronto. È settato secondo le indicazioni del nutrizionista e personalizzato sulle informazioni che hai fornito. La tua coach si chiama Sara e il tuo nutrizionista è la dottoressa Marini. Sei pronta a partire?",
  elaboro: "Dammi un momento: sto confrontando i protocolli, consulto il nutrizionista e cucio il tuo percorso su misura.",
  coachvideo: "Ti presento Sara, la coach che ti seguirà. Guarda il suo messaggio: ci sarà lei, davvero, al tuo fianco ogni giorno.",
  nutrivideo: "E questo è il tuo nutrizionista, la dottoressa Marini. È lei a costruire e validare il tuo piano, adattandolo alla tua salute: sei in mani sicure.",
  anteprima: "Ecco un assaggio del tuo menu di un giorno, cucito sulle tue risposte. Dove c'è una ricetta la trovi col pulsante; sugli altri piatti trovi un consiglio per mangiarli meglio.",
  piano: "Resta la cosa più sfidante da completare. Ti consiglio il piano da tre mesi: risparmi e sono sicura di portarti all'obiettivo. Se preferisci andare un mese alla volta, scegli il percorso da un mese. Esegui il pagamento e saremo online: io, la tua coach e il nutrizionista, al tuo fianco.",
  datainizio: "Bene, un obiettivo non è tale senza una data di partenza. Quando vuoi iniziare?",
  fatturazione: "Inserisci i dati per la fatturazione. Troverai la ricevuta via email una volta completato il pagamento del tuo piano.",
  attesa: "Tra pochi giorni parte il tuo percorso. Non preoccuparti: ti indicherò io cosa fare, come la lista della spesa. Un consiglio: installami sul telefono come widget, toccando il pulsante qui sotto.",

  // Domande del test (chiave = q_ + titolo "slugificato")
  q_perche_vuoi_iniziare_adesso: "Dimmi la spinta più vera: mi aiuta a costruire il percorso giusto per te.",
  q_come_vuoi_essere_chiamata: "Come vuoi che ti chiami? Scrivi qui il tuo nome.",
  q17_resto: "Perfetto! Ora inseriscimi la tua età, il tuo sesso e la tua altezza.",
  q_il_tuo_punto_di_partenza: "Inseriscimi le tue misure di partenza. Ricordati che dovrai aggiornarle ogni due giorni. Se non sai come prenderle, guarda il video toccando il pulsante.",
  q_il_tuo_regime_alimentare: "La base del tuo menu: qual è il tuo regime alimentare? Onnivoro, vegetariano o vegano?",
  q_stile_che_preferisci: "Scegli la dieta che preferisci: mediterranea, proteica, low-carb o flessibile?",
  q_intolleranze_o_allergie: "Un punto molto importante: le tue allergie o intolleranze. È importante che le conosca, così posso evitarti i cibi che potrebbero farti male.",
  q_cibi_che_non_ami: "Mangiare non deve essere uno stress: elencami i cibi che proprio non riesci a mangiare.",
  q_la_tua_vita_e_il_lavoro: "Parliamo del tuo lavoro. Il tuo lavoro è: sedentario, in piedi, a turni, o viaggi spesso?",
  q8_tempo: "Bene. E quanto tempo hai per cucinare: pochissimo, un po', o ti piace cucinare?",
  q8_dove: "E dove pranzi nei giorni feriali: da casa, in mensa, fuori, o al volo?",
  q_che_percorso_preferisci: "Quale percorso preferisci: tre pasti classico, cinque pasti, con integratori, o digiuno intermittente?",
  q_la_tua_salute: "Altro punto importante: le patologie di cui soffri e le medicine che prendi. Indicale con cura.",
  q_il_tuo_obiettivo: "Siamo arrivati al passo più importante: qual è il tuo obiettivo? Dimmi quanti chili vuoi perdere, quanti centimetri su fianchi e vita e soprattutto entro quando. Se è sostenibile, organizzerò al meglio il tuo percorso per fartelo raggiungere senza indugio.",
  q_periodi_senza_dieta: "Aggiungi tutte le feste, gli eventi, le vacanze o semplicemente i momenti di pausa: così pianifichiamo insieme la strategia migliore per fartele godere appieno, senza rimpianti.",
  q_come_vuoi_essere_seguita: "Oltre a me sarai seguita anche da un coach umano, che ti affiancherà nel tuo percorso. Per assegnarti l'assistente più adatta devo capire alcune cose, così non sarò né invadente né superficiale. Con che frequenza vuoi essere seguita dalla tua coach: ogni giorno, quando serve, o su tua richiesta?",
  q_quale_caratteristica_ti_contraddistingue: "Quando prendi un impegno, quale caratteristica ti contraddistingue? Segui bene, vai spronata, perseveri da sola, o tendi a mollare?",
  q_generic: "Rispondi con calma, non c'è fretta.",

  // Saluti del coach nell'app (buongiorno al mattino, ecc.)
  coach_buongiorno: "Buongiorno! Un nuovo giorno, un passo alla volta.",
  coach_inrotta: "Sei in rotta, continua così!",
  coach_acqua: "Ricordati di bere un po' d'acqua.",
  coach_passi: "Muoviti un po', ti aspetto per una camminata.",
  coach_buonanotte: "Buonanotte, riposa. Domani si ricomincia."
};

// Impostazioni voce: calda, naturale, ritmo morbido
const VOICE_SETTINGS = { stability: 0.45, similarity_boost: 0.85, style: 0.25, use_speaker_boost: true };

const OUT_DIRS = ['audio', 'docs/audio'];
OUT_DIRS.forEach(d => mkdirSync(d, { recursive: true }));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function tts(key, text) {
  // Endpoint "with-timestamps": restituisce audio + allineamento tempo<->carattere
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: VOICE_SETTINGS })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const buf = Buffer.from(j.audio_base64, 'base64');
  const al = j.alignment || j.normalized_alignment || null;
  for (const d of OUT_DIRS) {
    writeFileSync(`${d}/${key}.mp3`, buf);
    if (al) writeFileSync(`${d}/${key}.json`, JSON.stringify({ characters: al.characters, character_start_times_seconds: al.character_start_times_seconds }));
  }
  console.log(`✓ ${key}.mp3 (${(buf.length / 1024).toFixed(0)} KB)${al ? ' + timings' : ''}`);
}

const entries = Object.entries(PHRASES);
console.log(`Genero ${entries.length} clip con voce ${VOICE_ID} (${MODEL})...`);
for (const [key, text] of entries) {
  if (ONLY.length && !ONLY.includes(key)) continue;
  if (!FORCE && OUT_DIRS.every(d => existsSync(`${d}/${key}.mp3`))) { console.log(`· ${key}.mp3 già presente, salto`); continue; }
  try { await tts(key, text); } catch (e) { console.error(`✗ ${key}: ${e.message}`); }
  await sleep(400); // gentile con i rate limit
}
console.log('Fatto. MP3 in ./audio e ./docs/audio. Fai commit + push per pubblicarli.');
