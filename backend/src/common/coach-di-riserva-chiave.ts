/**
 * ⚠️ La chiave del parametro e le sue forme «spente», in un file senza dipendenze: le leggono sia
 * `coach-di-riserva.ts` sia `assegnazione-profilo.ts`, e il secondo è importato dal primo — un
 * import in cerchio è la cosa che questo file evita. Il perché della regola sta in
 * `coach-di-riserva.ts`.
 */
export const PARAM_COACH_DI_RISERVA = 'coach_di_riserva';

/**
 * Il valore che spegne la regola. Non una casella vuota: `ConfigParamsService.update` la rifiuta
 * (24/8, «una casella vuota non è uno zero»), e una riga assente vale lo stesso.
 */
export const RISERVA_SPENTA = 'off';

/** Le forme che una persona scrive per dire «nessuna»: si accettano tutte, si salva `off`. */
const FORME_SPENTE = new Set(['', 'off', 'no', '-', '—', 'nessuna', 'nessuno', 'false', '0']);

export const riservaSpenta = (valore: string | null | undefined): boolean =>
  FORME_SPENTE.has(String(valore ?? '').trim().toLowerCase());

/** Il minimo di Prisma che serve a sapere lo staff id della riserva, senza giudicarla. */
export interface PrismaPerChiaveRiserva {
  configParam: { findUnique(args: unknown): Promise<{ value: string } | null> };
}

/**
 * Lo staff id scritto nel parametro, o `null` se la regola è spenta. ⚠️ Non dice se quella
 * persona **può** fare da riserva (per quello c'è `giudicaLaRiserva`): serve a chi deve solo
 * riconoscere «questa coach in scheda è la riserva», e lì una riserva non valida va riconosciuta
 * lo stesso — è comunque un segnaposto, non una coach scelta.
 */
export async function idDellaRiserva(prisma: PrismaPerChiaveRiserva): Promise<string | null> {
  const riga = await prisma.configParam.findUnique({ where: { key: PARAM_COACH_DI_RISERVA }, select: { value: true } });
  const v = String(riga?.value ?? '').trim();
  return riservaSpenta(v) ? null : v;
}
