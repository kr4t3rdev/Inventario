import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Test de páginas públicas: no requiere autenticación ni base de datos.
 * Útil para validar un despliegue nuevo y medir la línea base del SSR
 * (landing, página de login y endpoint de health).
 */
const BASE_URL = __ENV.BASE_URL || 'http://169.254.238.192:3002';

export const options = {
  scenarios: {
    navegantes_anonimos: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '30s', target: 20 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

/**
 * @description Flujo de visitante anónimo: carga la landing, la página de
 * login y el health check, con una pausa de navegación entre ciclos.
 * @returns {void}
 */
export default function () {
  const home = http.get(`${BASE_URL}/`);
  check(home, { 'landing: status 200': (r) => r.status === 200 });

  const login = http.get(`${BASE_URL}/login`);
  check(login, { 'pagina login: status 200': (r) => r.status === 200 });

  const health = http.get(`${BASE_URL}/api/health`);
  check(health, {
    'health: status 200': (r) => r.status === 200,
    'health: estado healthy': (r) => {
      try {
        return r.json('status') === 'healthy';
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
