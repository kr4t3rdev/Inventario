import { asegurarSesion, flujoPos, pensar } from './lib/helpers.js';

const rps = Number(__ENV.RPS || 300);

export const options = {
  scenarios: {
    hora_pico: {
      executor: 'ramping-arrival-rate',
      startRate: Math.max(1, Math.round(rps / 30)),
      timeUnit: '1s',
      preAllocatedVUs: rps * 2,
      maxVUs: rps * 4,
      stages: [
        { duration: '10s', target: rps },
        { duration: '30s', target: rps },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(99)<3000'],
    tcp_login_errors: ['count==0'],
  },
};

let logueado = false;

/**
 * @description Escenario de pico: inyecta RPS solicitudes por segundo de
 * golpe para verificar la recuperación del servidor ante ráfagas
 * (por ejemplo, apertura simultánea de varias cajas). Escala con RPS.
 * @returns {void}
 */
export default function () {
  logueado = asegurarSesion(logueado);
  flujoPos();
  pensar(1, 2);
}
