import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://169.254.238.192:3002';
const PV = __ENV.PV_ID;
const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;

if (!BASE || !PV || !EMAIL || !PASSWORD) {
  throw new Error('Faltan variables: BASE_URL, EMAIL, PASSWORD, PV_ID');
}

const ventaDuration = new Trend('basico_venta_ms', true);
const ventasOk = new Counter('basico_ventas_ok');
const ventasFail = new Counter('basico_ventas_fail');

/**
 * @description Prepara el ciclo de caja del plan Básico una sola vez con el
 * API móvil (auth Bearer puro): login, catálogo con precios reales y apertura
 * de turno. El token se comparte con todos los VUs.
 * @returns {{headers: Record<string, string>, productos: Array<{id: string, precio: number}>}} Sesión y catálogo.
 */
export function setup() {
  const loginRes = http.post(
    `${BASE}/api/mobile/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json', 'User-Agent': 'k6-loadtest' } },
  );
  if (loginRes.status !== 200) {
    throw new Error(`setup: login móvil falló (${loginRes.status})`);
  }
  const token = loginRes.json('accessToken.token');
  if (!token) {
    throw new Error('setup: sin accessToken en el login móvil');
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const catRes = http.get(`${BASE}/api/mobile/v1/products`, { headers });
  const items = catRes.json('items') || [];
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('setup: catálogo vacío — falta stock del PV');
  }
  const productos = items.map((p) => ({
    id: String(p.id),
    precio: Number(p.precioVenta),
  }));

  const activo = http.get(
    `${BASE}/api/mobile/pos/turnos/activo?puntoDeVentaId=${PV}`,
    { headers },
  );
  const turnoActivo = activo.json('turno');
  if (!turnoActivo) {
    const apertura = http.post(
      `${BASE}/api/mobile/pos/turnos`,
      JSON.stringify({ puntoDeVentaId: PV, fondoInicialCup: 5000 }),
      { headers },
    );
    check(apertura, {
      'setup: turno abierto': (r) => r.status === 200 || r.status === 201,
    });
  }

  return { headers, productos };
}

export const options = {
  scenarios: {
    cajeros_vendiendo: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.round(Number(__ENV.MAX_VUS || 50) * 0.25) },
        { duration: '3m', target: Math.round(Number(__ENV.MAX_VUS || 50) * 0.6) },
        { duration: '3m', target: Number(__ENV.MAX_VUS || 50) },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    basico_venta_ms: ['p(95)<1500'],
    basico_ventas_fail: ['count<10'],
  },
};

/**
 * @description Ciclo de venta del cajero del plan Básico contra el API móvil:
 * registra una venta real de 1 a 3 productos en efectivo. El server valida
 * features del plan, stock por ubicación, resuelve el precio, exige/encuentra
 * el turno, descuenta inventario y registra kardex en una transacción.
 * @param {{headers: Record<string, string>, productos: Array<{id: string, precio: number}>}} data - Sesión y catálogo de setup.
 * @returns {void}
 */
export default function (data) {
  const { headers, productos } = data;

  const itemsCount = 1 + Math.floor(Math.random() * 3);
  const items = [];
  for (let i = 0; i < itemsCount; i += 1) {
    const p = productos[Math.floor(Math.random() * productos.length)];
    const yaEnCarrito = items.find((it) => it.productoId === p.id);
    if (yaEnCarrito) {
      yaEnCarrito.cantidad += 1;
      continue;
    }
    items.push({ productoId: p.id, cantidad: 1, precioUnitario: p.precio });
  }

  const total = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  const payload = {
    puntoDeVentaId: PV,
    items,
    estado: 'ENTREGADA',
    metodoPago: 'EFECTIVO',
    montoEfectivo: total,
    montoRecibidoEfectivo: total,
    cambioDevuelto: 0,
  };

  const inicio = Date.now();
  const res = http.post(`${BASE}/api/mobile/v1/sales/create`, JSON.stringify(payload), {
    headers,
  });
  ventaDuration.add(Date.now() - inicio);

  const ok = check(res, {
    'venta: status 200/201': (r) => r.status === 200 || r.status === 201,
  });
  if (ok) {
    ventasOk.add(1);
  } else {
    ventasFail.add(1);
  }

  sleep(Math.random() * 2 + 1);
}
