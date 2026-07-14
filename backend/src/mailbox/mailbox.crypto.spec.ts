import { decryptBuffer, deriveKey, encryptBuffer } from '../health-area/crypto.util';

/**
 * La password della casella si salva cifrata (AES-256-GCM) e si rilegge per l'auth IMAP/SMTP.
 * Questo test verifica il round-trip usato da MailboxService (encrypt→base64→decrypt).
 */
describe('Mailbox — cifratura password casella', () => {
  const key = deriveKey('test-file-encryption-key');
  const enc = (pw: string) => encryptBuffer(Buffer.from(pw, 'utf8'), key).toString('base64');
  const dec = (b64: string) => decryptBuffer(Buffer.from(b64, 'base64'), key).toString('utf8');

  it('round-trip: la password decifrata è identica all’originale', () => {
    const pw = 'S3gr3t@!mail#2026';
    const stored = enc(pw);
    expect(stored).not.toContain(pw); // a riposo non è in chiaro
    expect(dec(stored)).toBe(pw);
  });

  it('gestisce password con caratteri speciali e accentati', () => {
    const pw = 'pàsswörd con spazi e €§!';
    expect(dec(enc(pw))).toBe(pw);
  });

  it('ogni cifratura produce un output diverso (IV casuale)', () => {
    const pw = 'stessaPassword';
    expect(enc(pw)).not.toBe(enc(pw));
  });

  it('una chiave diversa non riesce a decifrare', () => {
    const stored = enc('x');
    const wrong = deriveKey('chiave-sbagliata');
    expect(() => decryptBuffer(Buffer.from(stored, 'base64'), wrong)).toThrow();
  });
});
