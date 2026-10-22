import { asegurarSesion, flujoPos, pensar, umbralesBase } from './lib/helpers.js';

const maxVus = Number(__ENV.MAX_VUS || 200);

export const options = {
  scenarios: {
    apertura_tienda: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.max(1, Math.round(maxVus * 0.1)) },
        { duration: '3m', target: Math.round(maxVus * 0.5) },
        { duration: '2m', target: maxVus },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: umbralesBase,
};

let logueado = false;

/**
 * @description Escenario de rampa: simula la apertura de una tienda con
 * cajeros que consultan turno y catálogo mientras la carga sube gradualmente
 * hasta MAX_VUS. Escala con la variable MAX_VUS (por defecto 200).
 * @returns {void}
 */
export default function () {
  logueado = asegurarSesion(logueado);
  flujoPos();
  pensar(1, 3);
}
