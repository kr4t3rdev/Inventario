/**
 * @description Verificación runtime, de solo lectura, de los asientos formales
 * en la base de datos de producción. Compara la cobertura formal de los pagos
 * Cash (deudas/préstamos en efectivo) contra la de los abonos no Cash
 * (Cuentas por Cobrar / Cuentas por Pagar) y valida la integridad contable
 * de los asientos existentes: partida doble, estado y cadena de hash.
 *
 * No escribe ni modifica datos: todas las consultas son de lectura.
 *
 * Uso:
 *   DATABASE_URL=<url de producción> pnpm exec tsx scripts/ops/verify-formal-postings-production.ts
 */
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';

const UMBRAL_DE_IMBALANCE = 0.000001;
const TIPOS_RECONCILIACION_CASH = [
  'DEUDA_CASH',
  'PRESTAMO_CASH',
  'DEUDA_CASH_DESEMBOLSO',
  'PRESTAMO_CASH_DESEMBOLSO',
];

/**
 * @description Enmascara un correo para no exponer datos personales en la salida.
 * @param {string} email - Correo del usuario.
 * @returns {string} Correo enmascarado.
 */
function enmascarar(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return '***';
  const visible = usuario.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(usuario.length - 1, 2))}@${dominio}`;
}

/**
 * @description Suma los campos debe/haber de las líneas de un asiento.
 * @param {{ debe: unknown; haber: unknown }[]} lineas - Líneas del asiento.
 * @returns {{ debe: number; haber: number }} Totales acumulados.
 */
function sumarLineas(lineas: { debe: unknown; haber: unknown }[]): {
  debe: number;
  haber: number;
} {
  return lineas.reduce<{ debe: number; haber: number }>(
    (acc, linea) => ({
      debe: acc.debe + Number(linea.debe),
      haber: acc.haber + Number(linea.haber),
    }),
    { debe: 0, haber: 0 },
  );
}

/**
 * @description Ejecuta la verificación runtime y escribe el reporte en stdout.
 * @returns {Promise<void>} Finaliza al imprimir el reporte.
 */
async function main(): Promise<void> {
  console.log('=== VERIFICACION RUNTIME ASIENTOS FORMALES (solo lectura) ===\n');

  // ── 0. Censo de datos contables (distingue "sin datos" de "sin contabilizar") ─
  const [
    countAsientos,
    countAsientoLineas,
    countReconciliacionesVenta,
    countReconciliacionesGasto,
    countCxC,
    countCxP,
    countPagosCxP,
    countDeudaCash,
    countPrestamoCash,
    countPagoDeuda,
    countDiarios,
    countPeriodos,
    countCuentasBancarias,
    countVentas,
    countCompras,
  ] = await Promise.all([
    prisma.asiento.count(),
    prisma.asientoLinea.count(),
    prisma.reconciliacionVenta.count(),
    prisma.reconciliacionGasto.count(),
    prisma.cuentaPorCobrar.count(),
    prisma.cuentaPorPagar.count(),
    prisma.pagoCuentaPorPagar.count(),
    prisma.deudaCash.count(),
    prisma.prestamoCash.count(),
    prisma.pagoDeuda.count(),
    prisma.diario.count(),
    prisma.periodoContable.count(),
    prisma.cuentaBancaria.count(),
    prisma.venta.count(),
    prisma.gastoCompra.count(),
  ]);

  console.log('[0] Censo de datos contables en produccion');
  console.log(`    asientos / lineas:               ${countAsientos} / ${countAsientoLineas}`);
  console.log(`    reconciliaciones venta / gasto:  ${countReconciliacionesVenta} / ${countReconciliacionesGasto}`);
  console.log(`    CxC / CxP:                       ${countCxC} / ${countCxP}`);
  console.log(`    pagos CxP:                       ${countPagosCxP}`);
  console.log(`    deudas cash / prestamos cash:    ${countDeudaCash} / ${countPrestamoCash}`);
  console.log(`    pagos de deuda:                  ${countPagoDeuda}`);
  console.log(`    diarios / periodos:              ${countDiarios} / ${countPeriodos}`);
  console.log(`    cuentas bancarias:               ${countCuentasBancarias}`);
  console.log(`    ventas / compras:                ${countVentas} / ${countCompras}`);
  const tiposReconciliacion = await prisma.reconciliacionVenta.groupBy({
    by: ['tipoReconciliacion'],
    _count: { _all: true },
  });
  console.log(
    `    tipos de reconciliacion (venta): ${tiposReconciliacion
      .map((t) => `${t.tipoReconciliacion ?? 'null'}=${t._count._all}`)
      .join(', ') || '(sin datos)'}`,
  );
  console.log('');

  // ── 1. Panorama de asientos formales por origen ────────────────────────────
  const porOrigen = await prisma.asiento.groupBy({
    by: ['origenTipo'],
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const totalAsientos = porOrigen.reduce((acc, fila) => acc + fila._count._all, 0);

  console.log('[1] Asientos formales por tipo de origen');
  if (porOrigen.length === 0) {
    console.log('    (sin asientos formales registrados)');
  }
  for (const fila of porOrigen.sort((a, b) => b._count._all - a._count._all)) {
    const ultimo = fila._max.createdAt ? fila._max.createdAt.toISOString() : 'n/d';
    console.log(`    ${fila.origenTipo.padEnd(28)} ${String(fila._count._all).padStart(6)}  ultimo=${ultimo}`);
  }
  console.log(`    TOTAL: ${totalAsientos}\n`);

  // ── 2. Integridad contable de los asientos ────────────────────────────────
  const asientos = await prisma.asiento.findMany({
    select: {
      asientoId: true,
      tenantId: true,
      periodoId: true,
      diarioId: true,
      numero: true,
      estado: true,
      hash: true,
      hashAnterior: true,
      tenantSequence: true,
      createdAt: true,
      lineas: {
        select: {
          orden: true,
          debe: true,
          haber: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const sinLineas: string[] = [];
  const desbalanceados: string[] = [];
  const importesCero: string[] = [];
  const anulados: string[] = [];

  for (const asiento of asientos) {
    const etiqueta = `${asiento.tenantId}/${asiento.asientoId}`;
    if (asiento.lineas.length < 2) sinLineas.push(etiqueta);
    const { debe, haber } = sumarLineas(asiento.lineas);
    if (Math.abs(debe - haber) > UMBRAL_DE_IMBALANCE) {
      desbalanceados.push(`${etiqueta} debe=${debe} haber=${haber}`);
    }
    if (debe <= 0 && haber <= 0) importesCero.push(etiqueta);
    if (asiento.estado === 'ANULADO') anulados.push(etiqueta);
  }

  console.log('[2] Integridad contable (partida doble)');
  console.log(`    asientos analizados:            ${asientos.length}`);
  console.log(`    con menos de 2 lineas:          ${sinLineas.length}`);
  console.log(`    desbalanceados (debe != haber): ${desbalanceados.length}`);
  console.log(`    con importe cero:               ${importesCero.length}`);
  console.log(`    en estado ANULADO:              ${anulados.length}`);
  for (const detalle of desbalanceados.slice(0, 10)) console.log(`      ! ${detalle}`);
  for (const detalle of sinLineas.slice(0, 10)) console.log(`      ! ${detalle}`);
  console.log('');

  // ── 3. Cadena de hash por tenant ──────────────────────────────────────────
  const porTenant = new Map<string, typeof asientos>();
  for (const asiento of asientos) {
    const lista = porTenant.get(asiento.tenantId) ?? [];
    lista.push(asiento);
    porTenant.set(asiento.tenantId, lista);
  }

  const rotas: string[] = [];
  for (const [tenantId, lista] of porTenant) {
    const ordenados = [...lista].sort((a, b) => {
      const seqA = a.tenantSequence ?? BigInt(Number.MAX_SAFE_INTEGER);
      const seqB = b.tenantSequence ?? BigInt(Number.MAX_SAFE_INTEGER);
      if (seqA !== seqB) return seqA < seqB ? -1 : 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    let anterior: string | null = null;
    for (const asiento of ordenados) {
      if (!asiento.hash) rotas.push(`${tenantId}/${asiento.asientoId}: hash vacio`);
      if ((asiento.hashAnterior ?? null) !== anterior) {
        rotas.push(
          `${tenantId}/${asiento.asientoId}: hashAnterior esperado=${anterior ?? 'null'} real=${asiento.hashAnterior ?? 'null'}`,
        );
      }
      anterior = asiento.hash;
    }
  }

  console.log('[3] Cadena de hash (encadenamiento por tenant)');
  console.log(`    tenants con asientos:            ${porTenant.size}`);
  console.log(`    eslabones rotos:                 ${rotas.length}`);
  for (const detalle of rotas.slice(0, 10)) console.log(`      ! ${detalle}`);
  console.log('');

  // ── 4. Cobertura formal de los pagos Cash ─────────────────────────────────
  const reconciliacionesCash = await prisma.reconciliacionVenta.findMany({
    where: { tipoReconciliacion: { in: TIPOS_RECONCILIACION_CASH } },
    select: {
      reconciliacionId: true,
      tenantId: true,
      tipoReconciliacion: true,
      monto: true,
      fechaReconciliacion: true,
    },
    orderBy: { fechaReconciliacion: 'desc' },
    take: 100,
  });
  // El motor formal etiqueta el origen segun el evento: los cobros de prestamo
  // usan 'reconciliacion_venta' y los pagos de deuda 'reconciliacion_gasto',
  // aunque ambos registros viven en ReconciliacionVenta.
  const origenes = new Map<
    string,
    { tenantId: string; tipo: string; monto: string; origenEsperado: string }
  >();
  for (const rec of reconciliacionesCash) {
    const origenEsperado = rec.tipoReconciliacion?.startsWith('DEUDA_CASH')
      ? 'reconciliacion_gasto'
      : 'reconciliacion_venta';
    origenes.set(rec.reconciliacionId, {
      tenantId: rec.tenantId,
      tipo: rec.tipoReconciliacion ?? 'n/d',
      monto: rec.monto.toString(),
      origenEsperado,
    });
  }

  const cashConAsiento: string[] = [];
  const cashSinAsiento: string[] = [];
  const cashOrigenDistinto: string[] = [];
  for (const [origenId, meta] of origenes) {
    const existe = await prisma.asiento.findFirst({
      where: { tenantId: meta.tenantId, origenId },
      select: { asientoId: true, estado: true, origenTipo: true },
    });
    if (!existe) {
      cashSinAsiento.push(`${origenId} (${meta.tipo}, monto=${meta.monto})`);
      continue;
    }
    cashConAsiento.push(`${origenId} (${meta.tipo}, monto=${meta.monto})`);
    if (existe.origenTipo !== meta.origenEsperado) {
      cashOrigenDistinto.push(
        `${origenId}: esperado=${meta.origenEsperado} real=${existe.origenTipo}`,
      );
    }
  }

  console.log('[4] Cobertura formal de pagos Cash (deudas/prestamos en efectivo)');
  console.log(`    reconciliaciones cash revisadas: ${origenes.size}`);
  console.log(`    con asiento formal:               ${cashConAsiento.length}`);
  console.log(`    sin asiento formal:               ${cashSinAsiento.length}`);
  console.log(`    origenTipo distinto al esperado:  ${cashOrigenDistinto.length}`);
  for (const detalle of cashSinAsiento.slice(0, 10)) console.log(`      ! ${detalle}`);
  for (const detalle of cashOrigenDistinto.slice(0, 10)) console.log(`      ! ${detalle}`);
  console.log('');

  // ── 5. Cobertura formal de los abonos no Cash (CxC / CxP) ─────────────────
  const ventasCredito = await prisma.reconciliacionVenta.findMany({
    where: { tipoReconciliacion: { in: ['VENTA', 'NORMAL'] } },
    select: {
      reconciliacionId: true,
      tenantId: true,
      tipoReconciliacion: true,
      monto: true,
      fechaReconciliacion: true,
    },
    orderBy: { fechaReconciliacion: 'desc' },
    take: 100,
  });
  const cobrosCxc = await prisma.cuentaPorCobrar.findMany({
    where: { montoPagado: { gt: 0 } },
    select: {
      id: true,
      tenantId: true,
      montoDeuda: true,
      montoPagado: true,
      estado: true,
    },
    orderBy: { id: 'desc' },
    take: 100,
  });
  const pagosCxp = await prisma.pagoCuentaPorPagar.findMany({
    select: {
      pagoCuentaPorPagarId: true,
      tenantId: true,
      monto: true,
      fechaPago: true,
    },
    orderBy: { fechaPago: 'desc' },
    take: 100,
  });

  const ventasCreditoConAsiento: string[] = [];
  for (const rec of ventasCredito) {
    const existe = await prisma.asiento.findFirst({
      where: { tenantId: rec.tenantId, origenId: rec.reconciliacionId },
      select: { asientoId: true, origenTipo: true },
    });
    if (existe) {
      ventasCreditoConAsiento.push(
        `${rec.reconciliacionId} (origen=${existe.origenTipo}, asiento=${existe.asientoId})`,
      );
    }
  }
  const cxcConAsiento: string[] = [];
  const cxpConAsiento: string[] = [];
  for (const cxc of cobrosCxc) {
    const existe = await prisma.asiento.findFirst({
      where: { tenantId: cxc.tenantId, origenId: cxc.id },
      select: { asientoId: true, origenTipo: true },
    });
    if (existe) {
      cxcConAsiento.push(`${cxc.id} (origen=${existe.origenTipo}, asiento=${existe.asientoId})`);
    }
  }
  for (const pago of pagosCxp) {
    const existe = await prisma.asiento.findFirst({
      where: { tenantId: pago.tenantId, origenId: pago.pagoCuentaPorPagarId },
      select: { asientoId: true, origenTipo: true },
    });
    if (existe) {
      cxpConAsiento.push(
        `${pago.pagoCuentaPorPagarId} (origen=${existe.origenTipo}, asiento=${existe.asientoId})`,
      );
    }
  }

  console.log('[5] Cobertura formal de abonos no Cash');
  console.log(`    reconciliaciones de venta (muestra): ${ventasCredito.length}`);
  console.log(`      con asiento formal:              ${ventasCreditoConAsiento.length}`);
  console.log(`    CxC con monto pagado (muestra):    ${cobrosCxc.length}`);
  console.log(`      con asiento formal:              ${cxcConAsiento.length}`);
  console.log(`    CxP pagos (muestra):               ${pagosCxp.length}`);
  console.log(`      con asiento formal:              ${cxpConAsiento.length}`);
  for (const detalle of ventasCreditoConAsiento.slice(0, 5)) console.log(`      + ${detalle}`);
  for (const detalle of cxcConAsiento.slice(0, 5)) console.log(`      + ${detalle}`);
  for (const detalle of cxpConAsiento.slice(0, 5)) console.log(`      + ${detalle}`);
  console.log('');

  // ── 6. Contexto de licencia y periodo vigente por tenant ──────────────────
  const ahora = new Date();
  const licencias = await prisma.tenantLicense.findMany({
    where: { activa: true, expiracion: { gt: ahora } },
    select: {
      tenantId: true,
      planId: true,
      isDemo: true,
      expiracion: true,
      features: true,
    },
  });
  const periodos = await prisma.periodoContable.findMany({
    where: { estado: 'ABIERTO' },
    select: {
      tenantId: true,
      periodoId: true,
      tipo: true,
      fechaInicio: true,
      fechaFin: true,
    },
  });
  const empresas = await prisma.miEmpresa.findMany({
    select: { tenantId: true, nombre: true },
  });
  const planes = await prisma.plan.findMany({
    select: { planId: true, nombre: true, features: true },
  });

  const planPorId = new Map(planes.map((plan) => [plan.planId, plan]));
  const empresaPorTenant = new Map(
    empresas.filter((e) => e.tenantId).map((e) => [e.tenantId as string, e.nombre]),
  );
  const periodosPorTenant = new Map<string, typeof periodos>();
  for (const periodo of periodos) {
    const lista = periodosPorTenant.get(periodo.tenantId) ?? [];
    lista.push(periodo);
    periodosPorTenant.set(periodo.tenantId, lista);
  }

  console.log('[6] Licencias vigentes y periodos abiertos');
  console.log(`    licencias activas y vigentes: ${licencias.length}`);
  console.log(`    periodos contables abiertos:  ${periodos.length}`);
  const tenantsOperativos: string[] = [];
  for (const licencia of licencias) {
    const plan = licencia.planId ? planPorId.get(licencia.planId) : undefined;
    const periodosTenant = periodosPorTenant.get(licencia.tenantId) ?? [];
    const tienePeriodo = periodosTenant.length > 0;
    if (tienePeriodo) tenantsOperativos.push(licencia.tenantId);
    const features = plan?.features ?? licencia.features;
    const listaFeatures =
      features && typeof features === 'object' && !Array.isArray(features)
        ? Object.keys(features as Record<string, unknown>)
        : [];
    console.log(
      `    tenant=${licencia.tenantId} empresa=${empresaPorTenant.get(licencia.tenantId) ?? 'n/d'} plan=${plan?.nombre ?? 'n/d'} demo=${licencia.isDemo} expira=${licencia.expiracion.toISOString().slice(0, 10)} periodoAbierto=${tienePeriodo ? 'si' : 'no'} features=${listaFeatures.length}`,
    );
  }
  console.log('');

  // ── 7. Candidatos para el flujo autenticado ───────────────────────────────
  const membresias = await prisma.tenantMembership.findMany({
    where: { tenantId: { in: tenantsOperativos } },
    select: {
      membershipId: true,
      tenantId: true,
      userId: true,
      tenantRole: true,
      isActive: true,
    },
  });
  const usuarios = await prisma.user.findMany({
    where: { userId: { in: membresias.map((m) => m.userId) } },
    select: { userId: true, email: true, isActive: true, emailVerifiedAt: true },
  });
  const usuarioPorId = new Map(usuarios.map((u) => [u.userId, u]));

  console.log('[7] Candidatos para flujo autenticado (licencia vigente + periodo abierto)');
  console.log(`    membresias: ${membresias.length}`);
  for (const membresia of membresias.slice(0, 20)) {
    const usuario = usuarioPorId.get(membresia.userId);
    console.log(
      `    tenant=${membresia.tenantId} rol=${membresia.tenantRole} membresiaActiva=${membresia.isActive} email=${usuario ? enmascarar(usuario.email) : 'n/d'} usuarioActivo=${usuario?.isActive ?? 'n/d'} verificado=${usuario?.emailVerifiedAt ? 'si' : 'no'}`,
    );
  }

  console.log('\n=== FIN VERIFICACION ===');
}

/**
 * @description Punto de entrada del verificador runtime.
 * @returns {Promise<void>} Finaliza con el codigo de salida correspondiente.
 */
main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error('ERROR en la verificacion runtime:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
