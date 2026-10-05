import { asegurarSesion, flujoPos, pensar, umbralesBase } from './lib/helpers.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: umbralesBase,
};

let logueado = false;

/**
 * @description Smoke test: valida con un solo usuario virtual que el flujo
 * del POS (login, turno activo y catálogo de productos) responde
 * correctamente antes de ejecutar escenarios de carga mayores.
 * @returns {void}
 */
export default function () {
  logueado = asegurarSesion(logueado);
  flujoPos();
  pensar(1, 2);
}
