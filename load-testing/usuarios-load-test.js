/**
 * Prueba de carga k6 para el flujo de usuarios: login (/api/auth/login) y
 * sesión autenticada (/api/auth/me).
 *
 * Uso:
 *   USER_EMAIL=qa@demo.com USER_PASSWORD=secreto k6 run load-testing/usuarios-load-test.js
 *   SMOKE=true k6 run ...          # solo 1 VU, valida configuración
 *   k6 run --out web-dashboard ... # UI en http://localhost:5665
 *
 * Variables de entorno:
 *   BASE_URL       (default http://localhost:3000)
 *   USER_EMAIL     requerido — usuario QA con licencia activa
 *   USER_PASSWORD  requerido
 *   SMOKE          "true" reduce la carga al mínimo
 */
import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const USER_EMAIL = __ENV.USER_EMAIL;
const USER_PASSWORD = __ENV.USER_PASSWORD;
const SMOKE = __ENV.SMOKE === 'true';

const loginLatency = new Trend('auth_login_latency', true);
const meLatency = new Trend('auth_me_latency', true);
const loginOk = new Rate('auth_login_ok');

if (!USER_EMAIL || !USER_PASSWORD) {
  fail('Faltan USER_EMAIL y USER_PASSWORD. Ej: USER_EMAIL=qa@demo.com USER_PASSWORD=secreto k6 run load-testing/usuarios-load-test.js');
}

export const options = {
  scenarios: {
    logins: {
      executor: 'ramping-arrival-rate',
      exec: 'loginFlow',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: SMOKE ? 2 : 20,
      maxVUs: SMOKE ? 5 : 100,
      stages: SMOKE
        ? [{ target: 1, duration: '10s' }]
        : [
            { target: 5, duration: '30s' },
            { target: 20, duration: '1m' },
            { target: 50, duration: '1m' },
            { target: 0, duration: '30s' },
          ],
    },
    sesiones: {
      executor: 'constant-vus',
      exec: 'sessionFlow',
      vus: SMOKE ? 1 : 10,
      duration: SMOKE ? '15s' : '3m',
      startTime: SMOKE ? '0s' : '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    auth_login_latency: ['p(95)<2000'],
    auth_me_latency: ['p(95)<800'],
    auth_login_ok: ['rate>0.95'],
  },
};

function postLogin() {
  return http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/auth/login' },
    },
  );
}

export function setup() {
  const res = postLogin();
  if (res.status !== 200) {
    fail(`Credenciales inválidas (status ${res.status}). Abortando para no bloquear la cuenta por intentos fallidos.`);
  }
  check(res, { 'setup: login 200': (r) => r.status === 200 });
}

export function loginFlow() {
  const res = postLogin();
  loginLatency.add(res.timings.duration);
  loginOk.add(res.status === 200);
  check(res, {
    'login 200': (r) => r.status === 200,
    'auth_token presente': (r) => r.cookies['auth_token'] !== undefined,
  });
  sleep(0.5);
}

let sesionIniciada = false;

export function sessionFlow() {
  if (!sesionIniciada) {
    const res = postLogin();
    loginLatency.add(res.timings.duration);
    loginOk.add(res.status === 200);
    check(res, { 'login de sesión 200': (r) => r.status === 200 });
    if (res.status !== 200) {
      sleep(2);
      return;
    }
    sesionIniciada = true;
  }

  const me = http.get(`${BASE_URL}/api/auth/me`, { tags: { name: 'GET /api/auth/me' } });
  meLatency.add(me.timings.duration);
  check(me, {
    'me 200': (r) => r.status === 200,
  });
  sleep(1);
}
