import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const loginErrors = new Counter('tcp_login_errors');

/**
 * Configuración compartida de los scripts de carga.
 * Las variables provienen del archivo .env de este directorio o del entorno real.
 */
export const config = {
  baseUrl: __ENV.BASE_URL,
  email: __ENV.EMAIL,
  password: __ENV.PASSWORD,
  pvId: __ENV.PV_ID,
  clienteId: __ENV.CLIENTE_ID || '',
};

if (!config.baseUrl || !config.email || !config.password || !config.pvId) {
  throw new Error(
    'Faltan variables requeridas: BASE_URL, EMAIL, PASSWORD o PV_ID. ' +
      'Copia .env.loadtest.example a .env y completa los valores.',
  );
}

/**
 * Cookies de sesión del VU. En producción llevan el atributo Secure y el
 * cookie jar de k6 las descarta sobre HTTP plano, por lo que se extraen del
 * header Set-Cookie y se envían manualmente. El token de acceso además viaja
 * como Authorization Bearer (via principal del middleware de la app) y la
 * cookie refreshToken la exige getAuthenticatedContext en el catálogo POS.
 */
let tokenDeSesion = null;
let cookieAuth = null;
let cookieRefresh = null;

/**
 * @description Inicia sesión contra /api/auth/login y extrae las cookies
 * auth_token y refreshToken del header Set-Cookie.
 * @returns {boolean} true si el login fue exitoso y hay sesión disponible.
 */
export function login() {
  const res = http.post(
    `${config.baseUrl}/api/auth/login`,
    JSON.stringify({ email: config.email, password: config.password }),
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'k6-loadtest',
      },
    },
  );
  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
  });
  if (ok) {
    // k6 une los headers Set-Cookie repetidos en un solo string separado
    // por comas; los valores JWT no contienen ';' ni espacios, por lo que
    // regex no ancladas los extraen con seguridad.
    const setCookies = res.headers['Set-Cookie'];
    const joined = Array.isArray(setCookies) ? setCookies.join('\n') : String(setCookies ?? '');
    const auth = /auth_token=([^;\s]+)/.exec(joined);
    const refresh = /refreshToken=([^;\s]+)/.exec(joined);
    cookieAuth = auth ? auth[1] : null;
    cookieRefresh = refresh ? refresh[1] : null;
    tokenDeSesion = cookieAuth;
  }
  if (!cookieAuth || !cookieRefresh || !tokenDeSesion) {
    loginErrors.add(1);
    return false;
  }
  return true;
}

/**
 * @description Encabezados de autenticación para las rutas protegidas:
 * Bearer + cookies manuales (la app valida ambas vias).
 * @returns {Record<string, string>} Headers de autenticación.
 */
export function encabezadosAuth() {
  if (!cookieAuth) return {};
  const headers = {
    Cookie: `auth_token=${cookieAuth}; refreshToken=${cookieRefresh}`,
  };
  if (tokenDeSesion) {
    headers.Authorization = `Bearer ${tokenDeSesion}`;
  }
  return headers;
}

/**
 * @description Flujo de lectura del POS: consulta el turno activo y el
 * catálogo de productos del punto de venta (con lista de precios del
 * cliente si CLIENTE_ID está configurado).
 * @returns {void}
 */
export function flujoPos() {
  const headers = encabezadosAuth();
  const turno = http.get(
    `${config.baseUrl}/api/ventas/punto-venta/${config.pvId}/turno-activo`,
    { headers },
  );
  check(turno, { 'turno-activo: status 200': (r) => r.status === 200 });

  const url = config.clienteId
    ? `${config.baseUrl}/api/ventas/punto-venta/${config.pvId}/productos?clienteId=${config.clienteId}`
    : `${config.baseUrl}/api/ventas/punto-venta/${config.pvId}/productos`;
  const productos = http.get(url, { headers });
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
}

/**
 * @description Pausa pseudo-aleatoria que simula el tiempo de pensamiento
 * de un cajero real entre operaciones.
 * @param {number} [min=1] Segundos mínimos de espera.
 * @param {number} [max=3] Segundos máximos de espera.
 * @returns {void}
 */
export function pensar(min = 1, max = 3) {
  sleep(Math.random() * (max - min) + min);
}

/**
 * @description Asegura que el VU tenga sesión activa. El login se realiza
 * una sola vez por VU y la sesión se reutiliza en las siguientes iteraciones,
 * igual que un cajero real que inicia turno una vez.
 * @param {boolean} logueado Estado de sesión actual del VU.
 * @returns {boolean} true si el VU quedó autenticado.
 */
export function asegurarSesion(logueado) {
  if (!logueado) {
    return login();
  }
  return true;
}

/**
 * Umbrales de calidad compartidos por todos los escenarios.
 * Ajusta el p95 según la línea base medida en el smoke test.
 */
export const umbralesBase = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<800'],
  checks: ['rate>0.99'],
  tcp_login_errors: ['count==0'],
};
