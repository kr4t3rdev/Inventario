import { asegurarSesion, flujoPos, pensar } from './lib/helpers.js';

const vus = Number(__ENV.VUS || 30);
const duration = __ENV.DURATION || '2h';

export const options = {
  scenarios: {
    sostenido: {
      executor: 'constant-vus',
      vus,
      duration,
      gracefulStop: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.99'],
    tcp_login_errors: ['count==0'],
  },
};

let logueado = false;

/**
 * @description Escenario de resistencia (soak): carga moderada y constante
 * durante horas para detectar fugas de memoria, degradación lenta y
 * saturación progresiva del pool de conexiones. Escala con VUS y DURATION.
 * @returns {void}
 */
export default function () {
  logueado = asegurarSesion(logueado);
  flujoPos();
  pensar(2, 5);
}
