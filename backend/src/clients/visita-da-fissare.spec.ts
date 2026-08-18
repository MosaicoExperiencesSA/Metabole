import { testoVisitaDaFissare } from './visita-da-fissare';

describe('testoVisitaDaFissare — il testo che la coach legge prima di chiamare', () => {
  it('col nome, la nutrizionista e le visite disponibili', () => {
    const t = testoVisitaDaFissare({ nome: 'Sonia', nutrizionista: 'Dr.ssa Bini', visiteDisponibili: 2 });
    expect(t.title).toBe('Fissa la visita per Sonia');
    expect(t.description).toContain('Ha 2 visite già disponibili');
    expect(t.description).toContain('Dr.ssa Bini');
  });

  it('una sola visita si dice al singolare: lo legge una persona', () => {
    expect(testoVisitaDaFissare({ nome: 'Sonia', visiteDisponibili: 1 }).description).toContain('Ha 1 visita già disponibile');
  });

  /**
   * ⚠️ IL NUMERO CHE CAMBIA LA TELEFONATA. `prenotazioni.service` lascia prenotare solo chi una
   * visita l'ha comprata: senza questa riga la coach propone un orario, la cliente apre l'app e
   * trova «serve prima acquistarla dal negozio» — una figura fatta fare a lei su una cosa che
   * sapevamo già.
   */
  it('⚠️ senza visite comprate lo dice PRIMA, che è il caso in cui l\'app la ferma', () => {
    const t = testoVisitaDaFissare({ nome: 'Sonia', nutrizionista: 'Dr.ssa Bini', visiteDisponibili: 0 });
    expect(t.description).toContain('NON ha visite disponibili');
    expect(t.description).toContain('negozio');
  });

  /**
   * ⚠️ Tre stati, e il terzo è «non lo so»: se il conto non si è potuto fare non si scrive né «ne
   * ha» né «non ne ha». Un numero inventato manda la coach a dire la cosa sbagliata a una persona
   * che si fida di lei.
   */
  it('⚠️ credito non calcolabile ≠ zero visite', () => {
    const t = testoVisitaDaFissare({ nome: 'Sonia', visiteDisponibili: null });
    expect(t.description).toContain('Non sono riuscito a contare');
    expect(t.description).not.toContain('NON ha visite disponibili');
  });

  it('senza nutrizionista assegnata lo dice: senza, non ci sono orari da scegliere', () => {
    expect(testoVisitaDaFissare({ nome: 'Sonia', visiteDisponibili: 1, coach: 'Marta' }).description).toContain('Non ha una nutrizionista assegnata');
  });

  /**
   * ⚠️ Il motivo clinico NON si copia nell'attività: la nota della nutrizionista è già nella lista
   * note, con autore e ora. Due copie di un dato sanitario divergono, e la seconda non ha firma.
   */
  it('⚠️ manda a leggere la nota invece di ricopiarla', () => {
    const t = testoVisitaDaFissare({ nome: 'Sonia', visiteDisponibili: 1 });
    expect(t.description).toContain('lista note');
  });

  /**
   * ⚠️ IL CASO TROVATO RILEGGENDO (18/8 sera): senza coach assegnata l'attività **non la riceve
   * nessuno** — niente push, e in elenco la vedono solo responsabile e admin. E capita proprio
   * all'inizio del percorso, che è quando il via libera clinico si decide.
   */
  it('⚠️ senza COACH assegnata lo dice: l\'attività non arriva a nessuno', () => {
    const t = testoVisitaDaFissare({ nome: 'Sonia', nutrizionista: 'Dr.ssa Bini', visiteDisponibili: 1 });
    expect(t.description).toContain('non ha una COACH assegnata');
    expect(t.description).toContain('nessuna push');
  });

  it('con la coach, di lei non si parla: è chi sta leggendo', () => {
    const t = testoVisitaDaFissare({ nome: 'Sonia', nutrizionista: 'Dr.ssa Bini', visiteDisponibili: 1, coach: 'Marta' });
    expect(t.description).not.toContain('COACH assegnata');
  });

  it('senza nome non si scrive un vuoto', () => {
    expect(testoVisitaDaFissare({ visiteDisponibili: 1 }).title).toBe('Fissa la visita per la cliente');
  });
});
