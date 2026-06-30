// Barrel da camada de API — ponto único de import para as telas.
export * from './client';
export * from './config';
export * from './types';
export * as auth from './auth';
export * as parlamentar from './parlamentar';
export * as sessoes from './sessoes';
export * as legislativo from './legislativo';
export * as noticias from './noticias';
export * as manifestacoes from './manifestacoes';
export { tokenStore } from './token-store';
