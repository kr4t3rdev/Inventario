/**
 * @description Barrel del feature contabilidad-formal (CTA-0). Las server
 * actions se importan directamente desde `./actions` (convención del proyecto:
 * los barrels no re-exportan actions).
 * @module src/features/contabilidad-formal
 */

export * from './lib/plan-default';
export * from './services/seed-plan-contable';
