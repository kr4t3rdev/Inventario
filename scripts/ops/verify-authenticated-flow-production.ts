/**
 * @description Verifica el flujo autenticado completo contra el despliegue de
 * produccion: crea una sesion efimera para un usuario manager de un tenant con
 * licencia vigente y periodo contable abierto, sondea las superficies de la
 * cadena #62 (lectura de deudas/prestamos/CxC/CxP existentes, bloqueo de
 * nuevas obligaciones y liquidacion de deudas heredadas) y finalmente elimina
 * la sesion creada.
 *
 * No deja datos de negocio: las sondas de creacion usan el gate de plan del
 * tenant (que no habilita 'deudas-cash' ni 'prestamos-cash') y las sondas de
 * liquidacion apuntan a un identificador inexistente.
 *
 * Uso:
 *   DATABASE_URL_PUBLIC=<url publica> JWT_SECRET=<secreto> \
 *   pnpm exec tsx scripts/ops/verify-authenticated-flow-production.ts
 */
import jwt from 'jsonwebtoken';

const BASE_URL = process.env.VERIFY_BASE_URL ?? 'https://financemdm.kr4t3rdev.xyz';
const DURACION_SESION_MIN = 15;

interface ResultadoSonda {
  grupo: string;
  nombre: string;
  metodo: string;
  ruta: string;
  esperado: number | number[];
  obtenido: number;
  codigo?: string;
  detalle?: string;
  ok: boolean;
}

/**
 * @description Indica si un codigo de estado cumple la expectativa de la sonda.
 * @param {number} obtenido - Codigo HTTP recibido.
 * @param {number | number[]} esperado - Codigo o rango de codigos aceptados.
 * @returns {boolean} true cuando la sonda cumple la expectativa.
 */
function cumpleEsperado(obtenido: number, esperado: number | number[]): boolean {
  if (Array.isArray(esperado)) return esperado.includes(obtenido);
  return obtenido === esperado;
}

/**
 * @description Extrae el codigo de error y un resumen del cuerpo de la respuesta.
 * @param {Response} response - Respuesta HTTP recibida.
 * @returns {Promise<{ codigo?: string; detalle?: string }>} Codigo y detalle.
 */
async function leerError(response: Response): Promise<{ codigo?: string; detalle?: string }> {
  try {
    const texto = await response.text();
    if (!texto) return {};
    try {
      const json = JSON.parse(texto) as Record<string, unknown>;
      const codigo = typeof json.code === 'string' ? json.code : undefined;
      const mensaje =
        typeof json.error === 'string'
          ? json.error
          : typeof json.message === 'string'
            ? json.message
            : undefined;
      return { codigo, detalle: mensaje?.slice(0, 160) };
    } catch {
      return { detalle: texto.slice(0, 160).replace(/\s+/g, ' ') };
    }
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const urlPublica = process.env.DATABASE_URL_PUBLIC;
  if (!urlPublica) throw new Error('DATABASE_URL_PUBLIC es obligatoria (proxy publico de Postgres).');
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET es obligatoria (inyectada por `railway run`).');

  // El cliente de plataforma se construye al importar el modulo, por eso la
  // URL publica se inyecta en process.env antes de la importacion dinamica.
  process.env.DATABASE_URL = urlPublica;
  const { prismaPlatform: prisma } = await import('@/lib/db/platform-prisma');

  console.log(`=== VERIFICACION FLUJO AUTENTICADO (${BASE_URL}) ===\n`);

  // ── Seleccion del tenant: plan Basico, licencia vigente y periodo abierto ──
  const ahora = new Date();
  const licencias = await prisma.tenantLicense.findMany({
    where: { activa: true, expiracion: { gt: ahora } },
    select: {
      tenantId: true,
      planId: true,
      expiracion: true,
      plan: { select: { nombre: true, features: true } },
    },
  });
  const periodos = await prisma.periodoContable.findMany({
    where: { estado: 'ABIERTO' },
    select: { tenantId: true, periodoId: true, tipo: true, fechaInicio: true, fechaFin: true },
  });
  const periodosPorTenant = new Map<string, typeof periodos>();
  for (const periodo of periodos) {
    const lista = periodosPorTenant.get(periodo.tenantId) ?? [];
    lista.push(periodo);
    periodosPorTenant.set(periodo.tenantId, lista);
  }

  const cubreHoy = (periodo: { fechaInicio: Date; fechaFin: Date }): boolean =>
    periodo.fechaInicio <= ahora && periodo.fechaFin >= ahora;

  const candidatos = licencias
    .filter((lic) => lic.plan?.nombre === 'Básico')
    .filter((lic) => (periodosPorTenant.get(lic.tenantId) ?? []).length > 0)
    .sort((a, b) => {
      const aCubre = (periodosPorTenant.get(a.tenantId) ?? []).some(cubreHoy);
      const bCubre = (periodosPorTenant.get(b.tenantId) ?? []).some(cubreHoy);
      if (aCubre !== bCubre) return aCubre ? -1 : 1;
      return b.expiracion.getTime() - a.expiracion.getTime();
    });

  if (candidatos.length === 0) {
    throw new Error('No hay tenant Basico con licencia vigente y periodo abierto.');
  }

  const licencia = candidatos[0];
  const periodosTenant = periodosPorTenant.get(licencia.tenantId) ?? [];
  const periodoCubreHoy = periodosTenant.find(cubreHoy);
  const periodo = periodoCubreHoy ?? periodosTenant[0];
  const tenantCubreHoy = Boolean(periodoCubreHoy);

  const membresia = await prisma.tenantMembership.findFirst({
    where: { tenantId: licencia.tenantId, isActive: true },
    select: { userId: true, tenantRole: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membresia) throw new Error(`El tenant ${licencia.tenantId} no tiene membresias activas.`);
  const usuario = await prisma.user.findUnique({
    where: { userId: membresia.userId },
    select: { userId: true, email: true, isActive: true, emailVerifiedAt: true },
  });
  if (!usuario || !usuario.isActive) throw new Error('El usuario seleccionado no esta activo.');

  // Referencias reales del tenant para armar cuerpos de pago validos.
  const tipoPago = await prisma.tipoPago.findFirst({
    where: { tenantId: licencia.tenantId },
    select: { tipoId: true },
    orderBy: { tipoId: 'asc' },
  });
  const cuentaBancaria = await prisma.cuentaBancaria.findFirst({
    where: { tenantId: licencia.tenantId },
    select: { cuentaId: true },
    orderBy: { cuentaId: 'asc' },
  });

  const features = (licencia.plan?.features ?? {}) as Record<string, unknown>;
  console.log('[CONTEXTO]');
  console.log(`    tenant=${licencia.tenantId}`);
  console.log(`    plan=${licencia.plan?.nombre} licenciaExpira=${licencia.expiracion.toISOString().slice(0, 10)}`);
  console.log(
    `    periodo=${periodo?.tipo} ${periodo?.fechaInicio.toISOString().slice(0, 10)}..${periodo?.fechaFin.toISOString().slice(0, 10)} estado=ABIERTO cubreHoy=${tenantCubreHoy ? 'si' : 'no'}`,
  );
  console.log(`    usuario=${usuario.email} rol=${membresia.tenantRole} verificado=${usuario.emailVerifiedAt ? 'si' : 'no'}`);
  console.log(
    `    features plan: contabilidad=${String(features.contabilidad)} deudas-cash=${String(features['deudas-cash'])} prestamos-cash=${String(features['prestamos-cash'])}`,
  );
  if (!tenantCubreHoy) {
    console.log(
      `    AVISO: ningun tenant Basico de produccion tiene un periodo abierto que cubra hoy (${ahora.toISOString().slice(0, 10)}); las escrituras fechadas hoy se rechazan con PERIODO_NO_EXISTE.`,
    );
  }
  console.log('');

  // ── Sesion efimera (equivalente a un login, se elimina al finalizar) ───────
  const token = jwt.sign(
    {
      userId: usuario.userId,
      email: usuario.email,
      tenantId: licencia.tenantId,
      tenantRole: membresia.tenantRole,
    },
    secret,
    { expiresIn: `${DURACION_SESION_MIN}m` },
  );
  const sesion = await prisma.userSession.create({
    data: {
      userId: usuario.userId,
      token,
      isActive: true,
      expiresAt: new Date(Date.now() + DURACION_SESION_MIN * 60 * 1000),
      userAgent: 'verificacion-ops-cadena-62',
    },
    select: { id: true },
  });

  const cabeceras = {
    Authorization: `Bearer ${token}`,
    Cookie: `auth_token=${token}`,
    'User-Agent': 'verificacion-ops-cadena-62',
  };

  const resultados: ResultadoSonda[] = [];

  /**
   * @description Ejecuta una sonda HTTP y registra el resultado.
   * @param {string} grupo - Grupo funcional de la sonda.
   * @param {string} nombre - Descripcion corta de la sonda.
   * @param {string} metodo - Metodo HTTP.
   * @param {string} ruta - Ruta relativa o absoluta.
   * @param {number | number[]} esperado - Codigo(s) HTTP esperado(s).
   * @param {unknown} body - Cuerpo opcional de la peticion.
   * @returns {Promise<void>} Registra el resultado de la sonda.
   */
  async function sondear(
    grupo: string,
    nombre: string,
    metodo: string,
    ruta: string,
    esperado: number | number[],
    body?: unknown,
  ): Promise<void> {
    const url = ruta.startsWith('http') ? ruta : `${BASE_URL}${ruta}`;
    let obtenido = 0;
    let codigo: string | undefined;
    let detalle: string | undefined;
    try {
      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          ...cabeceras,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
      obtenido = respuesta.status;
      if (obtenido >= 400) {
        const error = await leerError(respuesta);
        codigo = error.codigo;
        detalle = error.detalle;
      }
    } catch (error) {
      detalle = error instanceof Error ? error.message.slice(0, 120) : 'error de red';
    }
    resultados.push({
      grupo,
      nombre,
      metodo,
      ruta,
      esperado,
      obtenido,
      codigo,
      detalle,
      ok: cumpleEsperado(obtenido, esperado),
    });
  }

  const cuerpoDeudaInvalido = {
    proveedorId: 'verificacion-inexistente',
    montoCapital: 1,
    moneda: 'CUP',
    tasaInteres: 0,
    tasaInteresMoratorio: 0,
    cuentaBancariaId: 'verificacion-inexistente',
  };
  const cuerpoPrestamoInvalido = {
    clienteId: 'verificacion-inexistente',
    montoCapital: 1,
    moneda: 'CUP',
    tasaInteres: 0,
    tasaInteresMoratorio: 0,
    cuentaBancariaId: 'verificacion-inexistente',
  };

  // Fecha interior al periodo abierto: el route web valida el periodo con la
  // fecha extraida del cuerpo, por eso la liquidacion llega a la busqueda de
  // la deuda (que debe responder NOT_FOUND y no crear nada). Se usa un dia
  // dentro del rango, nunca los bordes (el fin de periodo se almacena a
  // medianoche UTC y el cuerpo se interpreta en hora local).
  const fechaEnPeriodo = periodo
    ? (() => {
        const inicio = periodo.fechaInicio.getTime();
        const fin = periodo.fechaFin.getTime();
        const interior = Math.min(inicio + 24 * 3600 * 1000, (inicio + fin) / 2);
        return new Date(interior).toISOString().slice(0, 10);
      })()
    : ahora.toISOString().slice(0, 10);

  const cuerpoPagoWeb = {
    monto: 1,
    cuentaId: cuentaBancaria?.cuentaId ?? 'verificacion-inexistente',
    tipoPagoId: tipoPago?.tipoId ?? 'verificacion-inexistente',
    moneda: 'CUP',
    fechaOperacion: fechaEnPeriodo,
  };
  const cuerpoPagoMovil = {
    monto: 1,
    cuentaBancariaId: cuentaBancaria?.cuentaId ?? 'verificacion-inexistente',
    moneda: 'CUP',
  };

  try {
    // ── 1. Identidad ────────────────────────────────────────────────────────
    await sondear('identidad', 'Sesion autenticada (api/auth/me)', 'GET', '/api/auth/me', 200);

    // ── 2. Lecturas existentes (permitidas en plan Basico) ─────────────────
    await sondear('lectura-movil', 'Deudas cash existentes', 'GET', '/api/mobile/v1/accounting/cash-debts', 200);
    await sondear('lectura-movil', 'Estadisticas de deudas cash', 'GET', '/api/mobile/v1/accounting/cash-debts/stats', 200);
    await sondear('lectura-movil', 'Prestamos cash existentes', 'GET', '/api/mobile/v1/accounting/cash-loans', 200);
    await sondear('lectura-movil', 'Estadisticas de prestamos cash', 'GET', '/api/mobile/v1/accounting/cash-loans/stats', 200);
    await sondear('lectura-movil', 'Cuentas por cobrar existentes', 'GET', '/api/mobile/v1/accounting/accounts-receivable', 200);
    await sondear('lectura-movil', 'Metricas de cuentas por cobrar', 'GET', '/api/mobile/v1/accounting/accounts-receivable/metrics', 200);
    await sondear('lectura-movil', 'Cuentas por pagar existentes', 'GET', '/api/mobile/v1/accounting/accounts-payable', 200);

    await sondear('lectura-web', 'API web de deudas cash', 'GET', '/api/contabilidad/deudas-cash', 200);
    await sondear('lectura-web', 'API web de deudas cash (stats)', 'GET', '/api/contabilidad/deudas-cash/stats', 200);
    await sondear('lectura-web', 'API web de prestamos cash', 'GET', '/api/contabilidad/prestamos-cash', 200);
    await sondear('lectura-web', 'API web de prestamos cash (stats)', 'GET', '/api/contabilidad/prestamos-cash/stats', 200);

    // ── 3. Pantallas de contabilidad (con cookie de sesion) ─────────────────
    await sondear('pantallas', 'Contabilidad (raiz)', 'GET', '/busy/contabilidad', 200);
    await sondear('pantallas', 'Cuentas por cobrar', 'GET', '/busy/contabilidad/cuentas-por-cobrar', 200);
    await sondear('pantallas', 'Cuentas por pagar', 'GET', '/busy/contabilidad/cuentas-por-pagar', 200);
    await sondear('pantallas', 'Deudas en efectivo', 'GET', '/busy/contabilidad/deudas-cash', 200);
    await sondear('pantallas', 'Prestamos en efectivo', 'GET', '/busy/contabilidad/prestamos-cash', 200);

    // ── 4. Crear nuevas obligaciones: debe estar BLOQUEADO en plan Basico ───
    await sondear('bloqueo-creacion', 'Crear deuda cash (movil)', 'POST', '/api/mobile/v1/accounting/cash-debts', 403, cuerpoDeudaInvalido);
    await sondear('bloqueo-creacion', 'Crear prestamo cash (movil)', 'POST', '/api/mobile/v1/accounting/cash-loans', 403, cuerpoPrestamoInvalido);
    await sondear('bloqueo-creacion', 'Crear deuda cash (web)', 'POST', '/api/contabilidad/deudas-cash', 403, cuerpoDeudaInvalido);
    await sondear('bloqueo-creacion', 'Crear prestamo cash (web)', 'POST', '/api/contabilidad/prestamos-cash', 403, cuerpoPrestamoInvalido);

    // ── 5. Liquidar deudas heredadas: debe estar PERMITIDO ─────────────────
    // Las rutas de pago NO tienen gate de feature (solo permiso), asi que el
    // plan Basico no bloquea la liquidacion. Lo que puede rechazarla es el
    // gate de periodo: el movil fecha la operacion con la fecha actual y el
    // web la toma del cuerpo YA parseado por Zod (que descarta cualquier
    // fecha enviada), por lo que ambos validan contra hoy.
    const esperadoMovil = tenantCubreHoy ? 404 : 400;
    const esperadoWeb = tenantCubreHoy ? 404 : 400;
    await sondear('liquidacion', 'Pagar deuda cash existente (movil)', 'POST', '/api/mobile/v1/accounting/cash-debts/id-inexistente/payments', esperadoMovil, cuerpoPagoMovil);
    await sondear('liquidacion', 'Pagar prestamo cash existente (movil)', 'POST', '/api/mobile/v1/accounting/cash-loans/id-inexistente/payments', esperadoMovil, cuerpoPagoMovil);
    await sondear('liquidacion', 'Pagar deuda cash existente (web)', 'POST', '/api/contabilidad/deudas-cash/id-inexistente/pagar', esperadoWeb, cuerpoPagoWeb);
    await sondear('liquidacion', 'Consultar deuda cash existente', 'GET', '/api/mobile/v1/accounting/cash-debts/id-inexistente', 404);
    await sondear('liquidacion', 'Comprobante de prestamo cash existente', 'GET', '/api/mobile/v1/accounting/cash-loans/id-inexistente/comprobante', 400);
  } finally {
    await prisma.userSession.delete({ where: { id: sesion.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  // ── Reporte ───────────────────────────────────────────────────────────────
  let grupoActual = '';
  for (const resultado of resultados) {
    if (resultado.grupo !== grupoActual) {
      grupoActual = resultado.grupo;
      console.log(`[${grupoActual.toUpperCase()}]`);
    }
    const marca = resultado.ok ? 'OK  ' : 'FALLA';
    const esperado = Array.isArray(resultado.esperado)
      ? resultado.esperado.join('/')
      : String(resultado.esperado);
    console.log(
      `    ${marca} ${resultado.nombre.padEnd(46)} ${resultado.metodo.padEnd(4)} ${resultado.ruta}`,
    );
    console.log(
      `         esperado=${esperado} obtenido=${resultado.obtenido}${resultado.codigo ? ` codigo=${resultado.codigo}` : ''}${resultado.detalle ? ` detalle="${resultado.detalle}"` : ''}`,
    );
  }

  const fallas = resultados.filter((r) => !r.ok);
  console.log('');
  console.log(`Sondas ejecutadas: ${resultados.length} | OK: ${resultados.length - fallas.length} | FALLAS: ${fallas.length}`);
  console.log(`Sesion efimera eliminada: ${sesion.id}`);
  console.log('=== FIN VERIFICACION FLUJO AUTENTICADO ===');
  process.exit(fallas.length === 0 ? 0 : 1);
}

void main().catch((error: unknown) => {
  console.error('ERROR en la verificacion del flujo autenticado:', error);
  process.exit(1);
});
