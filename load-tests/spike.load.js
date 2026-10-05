import http from 'k6/http';
import { check, sleep } from 'k6';
import { config } from './lib/helpers.js';

const rps = Number(__ENV.RPS || 300);

/**
 * @description Crea una sesión única en setup() y la comparte con todos los
 * VUs, para medir la rafaga de consultas POS autenticadas (hora pico real)
 * sin mezclarla con el techo de bcrypt de los logins masivos.
 * @returns {{headers: Record<string, string>}} Headers de autenticación.
 */
export function setup() {
  const res = http.post(
    `${config.baseUrl}/api/auth/login`,
    JSON.stringify({ email: config.email, password: config.password }),
    { headers: { 'Content-Type': 'application/json', 'User-Agent': 'k6-loadtest' } },
  );
  if (res.status !== 200) {
    throw new Error(`setup: login falló con status ${res.status}`);
  }
  const setCookies = res.headers['Set-Cookie'];
  const joined = Array.isArray(setCookies) ? setCookies.join('\n') : String(setCookies ?? '');
  const auth = /auth_token=([^;\s]+)/.exec(joined);
  const refresh = /refreshToken=([^;\s]+)/.exec(joined);
  if (!auth || !refresh) {
    throw new Error('setup: no se pudieron extraer las cookies de sesión');
  }
  return {
    headers: {
      Cookie: `auth_token=${auth[1]}; refreshToken=${refresh[1]}`,
      Authorization: `Bearer ${auth[1]}`,
    },
  };
}

export const options = {
  scenarios: {
    hora_pico: {
      executor: 'ramping-arrival-rate',
      startRate: Math.max(5, Math.round(rps / 30)),
      timeUnit: '1s',
      preAllocatedVUs: Math.round(rps * 0.75),
      maxVUs: rps * 2,
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
  },
};

/**
 * @description Rafaga de consultas POS autenticadas con la sesión compartida
 * de setup(): turno activo y catálogo del punto de venta, sin re-login.
 * @param {{headers: Record<string, string>}} data - Headers de la sesión.
 * @returns {void}
 */
export default function (data) {
  const headers = data.headers;
  const turno = http.get(
    `${config.baseUrl}/api/ventas/punto-venta/${config.pvId}/turno-activo`,
    { headers },
  );
  check(turno, { 'turno-activo: status 200': (r) => r.status === 200 });

  const productos = http.get(
    `${config.baseUrl}/api/ventas/punto-venta/${config.pvId}/productos`,
    { headers },
  );
  check(productos, {
    'productos: status 200': (r) => r.status === 200,
    'productos: lista no vacía': (r) => {
      try {
        return Array.isArray(r.json('productos')) && r.json('productos').length > 0;
      } catch {
        return false;
      }
    },
  });

  sleep(0.2);
}
