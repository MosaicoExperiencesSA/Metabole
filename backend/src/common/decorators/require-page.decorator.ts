import { SetMetadata } from '@nestjs/common';

export const PAGE_KEY = 'requirePage';
export type PageLevel = 'view' | 'manage';

/**
 * Richiede che il ruolo dell'utente abbia il permesso sulla pagina (matrice
 * role_page_permission). Il livello, se non indicato, si deduce dal metodo HTTP:
 * GET → view, resto → manage. Si applica a controller o singolo handler.
 */
export const RequirePage = (pageKey: string, level?: PageLevel) =>
  SetMetadata(PAGE_KEY, { pageKey, level });
