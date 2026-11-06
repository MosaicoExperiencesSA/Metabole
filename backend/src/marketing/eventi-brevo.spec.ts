import { motivoOptOutBrevo } from './eventi-brevo';

describe('motivoOptOutBrevo', () => {
  it('invalid_email esclude: era il buco che lasciava in coda gli indirizzi morti', () => {
    expect(motivoOptOutBrevo('invalid_email')).toBe('invalid_email');
  });

  it.each([
    ['hard_bounce', 'hard_bounce'],
    ['hardBounce', 'hard_bounce'],
    ['HARD-BOUNCE', 'hard_bounce'],
    ['unsubscribed', 'unsubscribed'],
    ['unsubscribe', 'unsubscribed'],
    ['spam', 'spam'],
    ['complaint', 'spam'],
    ['blocked', 'blocked'],
    ['blacklisted', 'blocked'],
    ['invalidEmail', 'invalid_email'],
  ])('%s -> %s', (evento, motivo) => {
    expect(motivoOptOutBrevo(evento)).toBe(motivo);
  });

  it.each(['soft_bounce', 'softBounce', 'deferred', 'delivered', 'opened', 'click', 'request', ''])(
    '%s NON esclude: indirizzo vivo o evento normale',
    (evento) => {
      expect(motivoOptOutBrevo(evento)).toBeNull();
    },
  );

  it('un evento che non è una stringa non esclude', () => {
    expect(motivoOptOutBrevo(undefined)).toBeNull();
    expect(motivoOptOutBrevo(null)).toBeNull();
    expect(motivoOptOutBrevo(42)).toBeNull();
  });
});
