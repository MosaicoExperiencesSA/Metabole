/**
 * DOVE PORTA UNA NOTIFICA. Richieste di Simone (12/8): il tocco — dalla lista o dalla push —
 * deve aprire la chat di quella persona.
 */
import { describe, expect, it } from 'vitest';
import { datiDallaPush, rottaClienteDaNotifica, rottaDaNotifica } from './rottaNotifica';

describe('lo staff', () => {
  it('un messaggio porta nella conversazione, non nella cartella', () => {
    expect(rottaDaNotifica({ threadId: 'th-1', clientId: 'c-1' }, '/pazienti')).toBe('/chat/th-1');
  });

  it('⚠️ la chat vince sulla scheda anche quando ci sono tutti e due', () => {
    // Chi apre l'avviso di un messaggio vuole leggerlo. Il `clientId` c'è quasi sempre: se
    // decidesse lui, nessuna notifica di chat porterebbe mai in chat.
    expect(rottaDaNotifica({ threadId: 'th-1', clientId: 'c-1' }, '/clienti')).toBe('/chat/th-1');
  });

  it('senza conversazione si ripiega sulla scheda', () => {
    expect(rottaDaNotifica({ clientId: 'c-1' }, '/clienti')).toBe('/clienti/c-1');
    expect(rottaDaNotifica({ clientId: 'c-1' }, '/pazienti')).toBe('/pazienti/c-1');
  });

  it('⚠️ la radice della scheda cambia col ruolo, e non la sa il server', () => {
    // `/clienti` per la coach, `/pazienti` per la nutrizionista: è il motivo per cui il backend
    // manda gli identificativi e non l'indirizzo già fatto.
    expect(rottaDaNotifica({ clientId: 'c-1' }, '/clienti')).not.toBe(
      rottaDaNotifica({ clientId: 'c-1' }, '/pazienti'),
    );
  });

  it('un appuntamento porta in agenda', () => {
    expect(rottaDaNotifica({ visitId: 'v-1' }, '/pazienti')).toBe('/agenda');
  });

  it('senza niente di utile non si naviga: meglio restare dove si è', () => {
    expect(rottaDaNotifica({}, '/clienti')).toBeNull();
    expect(rottaDaNotifica(null, '/clienti')).toBeNull();
    expect(rottaDaNotifica(undefined)).toBeNull();
    // Senza radice della scheda, il solo clientId non basta.
    expect(rottaDaNotifica({ clientId: 'c-1' })).toBeNull();
  });
});

describe('la cliente', () => {
  it('⚠️ non naviga per conversazione: la sua chat è una sola, con le linguette', () => {
    // Riusare la rotta dello staff qui la manderebbe su `/chat/th-1`, che nella sua app non
    // esiste: finirebbe sulla home senza che niente dica perché.
    expect(rottaClienteDaNotifica({ threadId: 'th-1', counterpart: 'nutritionist' })).toBe(
      '/assistente?who=nutritionist',
    );
    expect(rottaClienteDaNotifica({ threadId: 'th-2', counterpart: 'coach' })).toBe('/assistente?who=coach');
  });

  it('Gaia è la chat senza linguetta', () => {
    expect(rottaClienteDaNotifica({ counterpart: 'ai' })).toBe('/assistente');
    expect(rottaClienteDaNotifica({ threadId: 'th-3' })).toBe('/assistente');
  });

  it('la sua agenda si chiama Calendario', () => {
    expect(rottaClienteDaNotifica({ visitId: 'v-1' })).toBe('/calendario');
  });

  it('senza niente di utile non si naviga', () => {
    expect(rottaClienteDaNotifica({})).toBeNull();
    expect(rottaClienteDaNotifica(null)).toBeNull();
  });
});

describe('i dati che arrivano dalla push', () => {
  it('si leggono sia annidati sotto `data` sia in cima', () => {
    // Le due forme esistono davvero, a seconda della piattaforma: fidarsi di una sola vuol dire
    // un tocco che non porta da nessuna parte, e nessun errore da nessuna parte.
    expect(datiDallaPush({ threadId: 'th-1' }).threadId).toBe('th-1');
    expect(datiDallaPush({ data: { threadId: 'th-1' } }).threadId).toBe('th-1');
  });

  it('⚠️ quello che non è una stringa piena diventa null', () => {
    const d = datiDallaPush({ threadId: '', clientId: 42, visitId: null, counterpart: undefined });
    expect(d.threadId).toBeNull();
    expect(d.clientId).toBeNull();
    expect(d.visitId).toBeNull();
    expect(d.counterpart).toBeNull();
  });

  it('un payload vuoto o storto non fa cadere niente', () => {
    expect(datiDallaPush(undefined)).toEqual({ threadId: null, clientId: null, visitId: null, counterpart: null });
    expect(datiDallaPush('non un oggetto')).toEqual({ threadId: null, clientId: null, visitId: null, counterpart: null });
  });

  it('la catena intera: push toccata dalla nutrizionista → la chat giusta', () => {
    const dati = datiDallaPush({ data: { type: 'chat_message_nutritionist', threadId: 'th-9', clientId: 'c-9' } });
    expect(rottaDaNotifica(dati, '/pazienti')).toBe('/chat/th-9');
  });
});

/**
 * ⚠️ La notizia che apre un DIALOGO, non una schermata (§7 dell'handoff allergie).
 *
 * Senza `?intent=`, il tocco porterebbe in una chat muta: l'ultima cosa che si erano dette
 * settimane fa, e una persona che non sa cosa deve scrivere. La domanda deve essere già lì.
 */
describe('le notifiche che cominciano una conversazione', () => {
  it('la ri-domanda sulle allergie porta in chat CON l intento', () => {
    expect(rottaClienteDaNotifica({ counterpart: 'ai', kind: 'allergie_conferma' })).toBe(
      '/assistente?intent=allergie',
    );
  });

  it('⚠️ e vince sul ramo generico «ai», che porterebbe alla stessa chat muta', () => {
    expect(rottaClienteDaNotifica({ counterpart: 'ai', threadId: 'th-9', kind: 'allergie_conferma' })).toBe(
      '/assistente?intent=allergie',
    );
  });

  it('una notizia qualsiasi resta com era: nessun intento inventato', () => {
    expect(rottaClienteDaNotifica({ counterpart: 'ai', kind: 'engine_daily' })).toBe('/assistente');
  });

  it('e il «kind» arriva anche dalla push, dove tutto è stringa', () => {
    expect(datiDallaPush({ data: { kind: 'allergie_conferma', counterpart: 'ai' } }).kind).toBe('allergie_conferma');
  });
});
