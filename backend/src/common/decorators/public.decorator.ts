import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una rotta come pubblica (salta l'autenticazione JWT). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
