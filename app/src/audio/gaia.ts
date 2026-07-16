/**
 * Voce di Gaia — riproduce le clip MP3 in app/public/audio (generate con ElevenLabs).
 * - una sola clip alla volta;
 * - fallback a q_generic.mp3 se una clip di pagina manca;
 * - mute persistito (l'utente può silenziare Gaia);
 * - notifica quando "sta parlando" così la mascotte muove la bocca.
 * L'autoplay del browser richiede un gesto utente: le clip partono sui tap di navigazione.
 */

const MUTE_KEY = 'metabole_gaia_muted';

let current: HTMLAudioElement | null = null;
let talkTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(speaking: boolean) => void>();

function clearTalkTimer() {
  if (talkTimer) {
    clearTimeout(talkTimer);
    talkTimer = null;
  }
}

function emit(speaking: boolean) {
  listeners.forEach((l) => l(speaking));
}

export function onSpeaking(cb: (speaking: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setMuted(muted: boolean) {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (muted) stop();
}

export function stop() {
  clearTalkTimer();
  if (current) {
    current.pause();
    current = null;
  }
  emit(false);
}

/** Clip rigenerate (voce Gaia): override del nome-file, fa anche da cache-buster. */
const CLIP_VERSIONS: Record<string, string> = {
  percorso: 'percorso_v02',
  q_come_vuoi_essere_chiamata: 'q_come_vuoi_essere_chiamata_v02',
};

/** Riproduce la clip indicata (senza estensione). No-op se Gaia è silenziata. */
export function play(key: string) {
  if (isMuted() || !key) return;
  stop();
  const file = CLIP_VERSIONS[key] ?? key;
  const audio = new Audio(`/audio/${file}.mp3`);
  current = audio;
  const finish = () => {
    if (current === audio) current = null;
    clearTalkTimer();
    emit(false);
  };
  audio.onended = finish;
  audio.onerror = () => {
    // clip di pagina mancante → ripiego sulla frase generica
    if (key.startsWith('q_') && key !== 'q_generic') {
      play('q_generic');
    } else {
      finish();
    }
  };
  emit(true);
  // La bocca (e gli occhi aperti) si animano per tutta la durata della clip.
  // Fallback: se l'autoplay è bloccato dal browser o la durata non è nota, Gaia
  // "parla" comunque visibilmente per qualche secondo.
  talkTimer = setTimeout(finish, 4500);
  audio.addEventListener('loadedmetadata', () => {
    if (current !== audio) return;
    clearTalkTimer();
    const ms = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 + 250 : 4500;
    talkTimer = setTimeout(finish, ms);
  });
  audio.play().catch(() => {
    // autoplay bloccato: lasciamo il fallback animare la bocca, senza spegnere subito
  });
}

/** Chiave audio della pagina: il colore ha una clip dedicata, le altre usano q_<slug-del-titolo>. */
export function clipForPage(page: { key: string; title: string }): string {
  if (page.key === 'theme') return 'colore';
  const slug = page.title
    .toLowerCase()
    .normalize('NFD') // separa gli accenti come segni combinanti
    .split('')
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c < 0x0300 || c > 0x036f; // scarta i segni diacritici combinanti
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `q_${slug}`;
}
