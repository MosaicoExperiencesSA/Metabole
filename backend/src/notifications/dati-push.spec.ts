/**
 * I dati che viaggiano con la push. Simone (12/8): «se clicco sulla notifica mi porti nella chat
 * specifica» — e senza questi, il telefono non sa quale.
 */
import { datiPush } from './dati-push';

describe('datiPush', () => {
  it('porta il tipo e la conversazione', () => {
    expect(datiPush('chat_message_nutritionist', { threadId: 'th-1', clientId: 'c-1', kind: 'chat_message_staff' })).toEqual({
      type: 'chat_message_nutritionist',
      kind: 'chat_message_staff',
      threadId: 'th-1',
      clientId: 'c-1',
    });
  });

  it('⚠️ solo stringhe: FCM rifiuta l\'invio INTERO se dentro `data` finisce un numero o un null', () => {
    // E il rifiuto si vede solo nei log del server: la push semplicemente non arriva, senza che
    // nessuno se ne accorga.
    const d = datiPush('x', { threadId: 42, clientId: null, visitId: undefined, kind: '' } as never);
    expect(d).toEqual({ type: 'x' });
    for (const v of Object.values(d)) expect(typeof v).toBe('string');
  });

  it('⚠️ il resto del payload NON viaggia', () => {
    // La push porta il minimo per aprire la schermata giusta, non una copia della notizia: title e
    // body si leggono sulla schermata di blocco, e lì non ci va niente di sanitario.
    const d = datiPush('menu_cambio_verificato', {
      threadId: 'th-1',
      nota: 'ipotiroidismo, TSH 6.1',
      weightGainKg: 1.2,
    });
    expect(d).toEqual({ type: 'menu_cambio_verificato', threadId: 'th-1' });
    expect(JSON.stringify(d)).not.toContain('TSH');
  });

  it('senza payload resta il solo tipo, come prima', () => {
    expect(datiPush('checkin_reminder')).toEqual({ type: 'checkin_reminder' });
    expect(datiPush('checkin_reminder', {})).toEqual({ type: 'checkin_reminder' });
  });

  it('la visita e la controparte passano: servono ad aprire agenda e chat giusta', () => {
    expect(datiPush('appointment_reminder', { visitId: 'v-1' }).visitId).toBe('v-1');
    expect(datiPush('chat_reply_coach', { counterpart: 'coach' }).counterpart).toBe('coach');
  });
});
