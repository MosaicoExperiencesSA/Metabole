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

import { writeFileSync, mkdirSync } from 'node:fs';

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID || 'Xb7hH8MSUJpSbSDYk0k2'; // Alice (multilingua)
const MODEL = process.env.MODEL_ID || 'eleven_multilingual_v2';

if (!API_KEY) {
  console.error('Manca ELEVENLABS_API_KEY. Esempio:\n  ELEVENLABS_API_KEY=xxxx node tools/genera_voci_gaia.mjs');
  process.exit(1);
}

// Testi di Gaia (devono combaciare con quelli del prototipo)
const PHRASES = {
  benvenuto: "Ciao, sono Gaia, la tua assistente AI che ti guiderà passo passo alla configurazione personalizzata di Metabole, in modo che il tuo percorso di rinascita sia unico e cucito su di te. Appena sei pronta, clicca sul pulsante Entra in Metabole in fondo.",
  registrazione: "Presentati, così saprò dove e come inviarti tutto quello che serve per la gestione dell'app. Considera che i percorsi sono personalizzati e potrebbero richiedere l'invio di prodotti al tuo indirizzo o di schede via email.",
  facciamo: "Per settare e personalizzare la tua app ho bisogno di qualche indicazione su cinque punti: la mente, la vita, l'agenda, il gusto e il corpo.",
  intro_testa: "Per prima cosa, cosa c'è nella tua mente? L'equilibrio mentale è il primo passo per ritrovare la forma fisica corretta. Rispondi pure alle prossime domande.",
  intro_vita: "Ora la tua vita reale: lavoro, tempi e abitudini. Così il piano sarà davvero sostenibile per te.",
  intro_agenda: "Parliamo della tua agenda: feste, cene, viaggi. Non sono ideali per fare diete, ma questi momenti piacevoli si gestiscono: basta pianificarli.",
  intro_gusto: "E il gusto: cosa ami e cosa eviti. Mangiare bene deve piacerti, o non dura.",
  intro_corpo: "Bene, ora so tutto di te, tranne quali sono i tuoi obiettivi: peso e misure sono obiettivi, senza giudizi. Dimmi dove sei e dove vuoi arrivare.",
  colore: "Ultimo tocco: scegli il colore che ti rappresenta. Personalizzerò tutta l'app con la tinta che preferisci, e potrai cambiarla quando vuoi.",
  percorso: "Il tuo percorso personalizzato è pronto, costruito su tutte le tue risposte.",

  // Domande del test (chiave = q_ + titolo "slugificato")
  q_chi_sei: "Partiamo dalle basi.",
  q_il_tuo_punto_di_partenza: "Le aggiornerai ogni 2 giorni.",
  q_il_tuo_regime_alimentare: "Su cosa costruiamo i menu.",
  q_intolleranze_o_allergie: "Puoi sceglierne più di una.",
  q_cibi_che_non_ami: "Li terrò alla larga dai tuoi menu.",
  q_la_tua_vita_e_il_lavoro: "Così i menu diventano fattibili.",
  q_la_tua_salute: "Serve per la tua sicurezza.",
  q_il_tuo_obiettivo: "Con calma e in modo sostenibile.",
  q_periodi_senza_dieta: "Vacanze, feste, eventi o semplicemente momenti di pausa.",
  q_come_vuoi_essere_seguita: "Avrai anche un'assistente umana, oltre a me. Con che frequenza vuoi essere seguita?",
  q_che_tipo_sei: "Così individuo la coach più idonea al tuo carattere e taro la AI affinché ti segua secondo le tue necessità.",
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
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: VOICE_SETTINGS })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`ElevenLabs ${res.status}: ${t.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  for (const d of OUT_DIRS) writeFileSync(`${d}/${key}.mp3`, buf);
  console.log(`✓ ${key}.mp3 (${(buf.length / 1024).toFixed(0)} KB)`);
}

const entries = Object.entries(PHRASES);
console.log(`Genero ${entries.length} clip con voce ${VOICE_ID} (${MODEL})...`);
for (const [key, text] of entries) {
  try { await tts(key, text); } catch (e) { console.error(`✗ ${key}: ${e.message}`); }
  await sleep(400); // gentile con i rate limit
}
console.log('Fatto. MP3 in ./audio e ./docs/audio. Fai commit + push per pubblicarli.');
