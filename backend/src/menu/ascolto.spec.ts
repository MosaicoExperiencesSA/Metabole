/**
 * I tre difetti della conversazione del 12/8, uno per gruppo.
 *
 * Gaia: «Quale alimento vuoi cambiare? Oggi hai — pranzo: Curry di Ceci e Spinaci · … · cena:
 * Insalata Tiepida Tacchino e Quinoa.»
 * Cliente: «Voglio cambiare il menu di oggi **a pranzo** con verdura cruda e tonno al naturale»
 * Gaia: «**A cena** … ci sono 50 g di **quinoa cruda**. Perché lo vuoi cambiare?»
 */
import { combaciaAlimento } from '../common/nomi-alimento';
import { QUALIFICATORI, nonHoCapito, pastoNominato, proponeUnPastoIntero } from './ascolto';
import { terminiCandidati } from './sostituzione-chat';

const FRASE_DEL_12_8 = 'Voglio cambiare il menu di oggi a pranzo con verdura cruda e tonno al naturale';

describe('ascoltare meglio', () => {
  describe('gli aggettivi non sono alimenti', () => {
    it('⚠️ «cruda» non è più un termine con cui cercare un ingrediente', () => {
      // È la parola che ha fatto rispondere della quinoa della cena.
      expect(terminiCandidati(FRASE_DEL_12_8)).not.toContain('cruda');
      expect(terminiCandidati('la carne è cruda')).not.toContain('cruda');
    });

    it('ma in COPPIA restano: «verdura cruda» e «tonno naturale» sono nomi veri', () => {
      const t = terminiCandidati(FRASE_DEL_12_8);
      expect(t).toContain('verdura cruda');
      expect(t).toContain('tonno naturale');
    });

    it('i cibi veri della frase passano lo stesso', () => {
      const t = terminiCandidati(FRASE_DEL_12_8);
      expect(t).toContain('verdura');
      expect(t).toContain('tonno');
    });

    it('con questo filtro «quinoa cruda» non risponde più a chi ha scritto «cruda»', () => {
      // Il controllo end-to-end della riga che ha prodotto il difetto: nessuno dei termini
      // estratti dalla frase combacia con l'ingrediente della cena.
      const combacianti = terminiCandidati(FRASE_DEL_12_8).filter((t) => combaciaAlimento('quinoa cruda', t));
      expect(combacianti).toEqual([]);
    });

    it('l\'elenco copre le forme, non le singole parole', () => {
      // Una voce per radice: crudo/cruda/crude/crudi sono la stessa cosa.
      expect(QUALIFICATORI.has('crud')).toBe(true);
      expect(QUALIFICATORI.has('natural')).toBe(true);
      expect(terminiCandidati('lo voglio cotto')).not.toContain('cotto');
      expect(terminiCandidati('yogurt magro')).not.toContain('magro');
      expect(terminiCandidati('yogurt magro')).toContain('yogurt');
    });
  });

  describe('il pasto nominato', () => {
    it('«a pranzo» dice dove guardare', () => {
      expect(pastoNominato(FRASE_DEL_12_8)).toBe('lunch');
    });

    it('riconosce tutti i pasti, con le parole che usa la gente', () => {
      expect(pastoNominato('stasera non mi va')).toBe('dinner');
      expect(pastoNominato('a colazione vorrei altro')).toBe('breakfast');
      expect(pastoNominato('lo spuntino del pomeriggio')).toBe('afternoon_snack');
      expect(pastoNominato('lo spuntino della mattina')).toBe('morning_snack');
      expect(pastoNominato('la merenda')).toBe('snack');
    });

    it('⚠️ le chiavi sono quelle vere degli slot: sbagliarle non dà errore, dà un filtro inerte', () => {
      // `SLOT_LABEL` usa `morning_snack`, non `snack_morning`.
      expect(pastoNominato('spuntino di mattina')).toBe('morning_snack');
    });

    it('senza un pasto nominato non ne inventa uno', () => {
      expect(pastoNominato('vorrei togliere le carote')).toBeNull();
      expect(pastoNominato('')).toBeNull();
    });
  });

  describe('il pasto intero non è un ingrediente', () => {
    it('riconosce la frase del 12/8', () => {
      expect(proponeUnPastoIntero(FRASE_DEL_12_8)).toBe(true);
    });

    it('e quella del 6/8, che l\'AI aveva approvato senza cambiare niente', () => {
      expect(
        proponeUnPastoIntero(
          'potrei sostituire questo menu con insalata iceberg, qualche fettina di pomodoro, mezzo cetriolo e 80 gr di tonno al naturale?',
        ),
      ).toBe(true);
    });

    it('⚠️ serve il CONNETTIVO: «voglio cambiare il pranzo» resta un cambio di piatto', () => {
      // Quello il dialogo lo sa fare benissimo, e mandarlo alla nutrizionista sarebbe un passo
      // indietro.
      expect(proponeUnPastoIntero('voglio cambiare il pranzo')).toBe(false);
      expect(proponeUnPastoIntero('vorrei una colazione proteica')).toBe(false);
    });

    it('e non scatta su una sostituzione di ingrediente', () => {
      expect(proponeUnPastoIntero('vorrei sostituire le carote con le zucchine')).toBe(false);
      expect(proponeUnPastoIntero('posso mettere il burro al posto dell\'olio?')).toBe(false);
    });
  });

  describe('quando non ha capito lo dice, e ripete la domanda', () => {
    it('la domanda si ripete IDENTICA', () => {
      const domanda = 'Quale alimento vuoi cambiare?\n\nOggi hai — pranzo: Curry di Ceci e Spinaci.';
      const risposta = nonHoCapito(domanda, 'Gioia');
      expect(risposta).toContain('Perdonami Gioia, non ho capito');
      expect(risposta).toContain(domanda);
    });

    it('senza nome resta una frase corretta', () => {
      expect(nonHoCapito('La mia domanda.', null)).toContain('Perdonami, non ho capito');
    });

    it('senza la domanda di prima non se ne inventa una', () => {
      // Riformularla sembra gentile ed è il modo più rapido di confondere chi già non aveva capito.
      expect(nonHoCapito(null, 'Gioia')).toBe('Perdonami Gioia, non ho capito. Me lo riscrivi in altre parole?');
      expect(nonHoCapito('   ')).toContain('Me lo riscrivi in altre parole?');
    });
  });
});
