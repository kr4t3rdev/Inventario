/**
 * @description Integración real de R6/R0.5 filas 3 y 24: verifica valoración y
 * rollback del writer de venta a crédito, y éxito/rollback tardío de contra_pago.
 * También valida la rama shadow durable y límites de valoración FX.
 * Corre con base desechable verificada (`assertDisposableDatabase`) y prepara
 * licencia, plan formal y período contable por escenario.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertDisposableDatabase } from '../../../../../scripts/ci/disposable-database.mjs';
import { Prisma } from '@/generated/prisma';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';

assertDisposableDatabase(process.env);

let prisma!: typeof import('@/lib/prisma').prisma;
let applyFacturacionCobroWorkflow!: typeof import('@/features/ventas/services/facturacion-workflow').applyFacturacionCobroWorkflow;

const stamp = Date.now();
const prefix = `r61-${stamp}`;
const monedaExtranjera = `R61F${stamp}`;
const tasasCreadas: string[] = [];
const monedasCreadas: string[] = [];
const originalFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
let trigger = '';
let functionName = '';
let asientoTrigger = '';
let asientoFunctionName = '';

/**
 * @description Convierte valores completos de Prisma a una representación estable para comparar snapshots.
 * @param {unknown} value - Valor devuelto por Prisma.
 * @returns {unknown} Valor normalizado, sin perder campos escalares.
 */
function normalizarFila(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizarFila);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizarFila(nested)]),
    );
  }
  return value;
}

/**
 * @description Captura filas completas del documento y sus efectos contables persistidos.
 * @param {string} tenantId - Tenant aislado del escenario.
 * @param {string} facturaId - Factura procesada por el writer.
 * @returns {Promise<unknown>} Snapshot estable con filas completas y líneas de asiento.
 */
async function capturarSnapshotCredito(tenantId: string, facturaId: string): Promise<unknown> {
  const factura = await prisma.factura.findUniqueOrThrow({ where: { idFactura: facturaId } });
  const cuentasPorCobrar = await prisma.cuentaPorCobrar.findMany({
    where: { tenantId, facturaId },
    orderBy: { id: 'asc' },
  });
  const asientos = await prisma.asiento.findMany({
    where: { tenantId, origenTipo: 'factura', origenId: facturaId },
    include: { lineas: { orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }] } },
    orderBy: { asientoId: 'asc' },
  });
  return normalizarFila({ factura, cuentasPorCobrar, asientos });
}

/**
 * @description Captura todos los efectos persistidos del flujo de factura contra pago.
 * @param {string} tenantId - Tenant aislado del escenario.
 * @param {string} facturaId - Factura procesada por el writer.
 * @param {string} ventaId - Venta enlazada a la reconciliación.
 * @param {string} cuentaId - Cuenta bancaria que recibe el cobro.
 * @returns {Promise<unknown>} Filas completas normalizadas, incluidas líneas de asiento.
 */
async function capturarSnapshotContraPago(
  tenantId: string,
  facturaId: string,
  ventaId: string,
  cuentaId: string,
): Promise<unknown> {
  const factura = await prisma.factura.findUniqueOrThrow({ where: { idFactura: facturaId } });
  const venta = await prisma.venta.findUniqueOrThrow({ where: { ventaId } });
  const cuentasPorCobrar = await prisma.cuentaPorCobrar.findMany({
    where: { tenantId, facturaId },
    orderBy: { id: 'asc' },
  });
  const cuentaBancaria = await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId } });
  const reconciliaciones = await prisma.reconciliacionVenta.findMany({
    where: { tenantId, ventaId },
    orderBy: { reconciliacionId: 'asc' },
  });
  const asientos = await prisma.asiento.findMany({
    where: { tenantId },
    include: { lineas: { orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }] } },
    orderBy: { asientoId: 'asc' },
  });
  const outbox = await prisma.shadowPosteoOutbox.findMany({
    where: { tenantId },
    orderBy: { id: 'asc' },
  });
  return normalizarFila({
    factura,
    venta,
    cuentasPorCobrar,
    cuentaBancaria,
    reconciliaciones,
    asientos,
    outbox,
  });
}

/**
 * @description Crea un escenario aislado: tenant, usuario, punto de venta,
 * cliente, política contable, venta, serie y factura; opcionalmente agrega
 * tesorería y una tasa de cambio publicada.
 * @param {object} opts - Opciones del escenario.
 * @param {string} [opts.monedaCuenta] - Moneda exclusiva de la cuenta bancaria.
 * @param {boolean} [opts.sinTesoreria] - Omite cuenta bancaria y tipo de pago.
 * @param {object} [opts.conTasa] - Tasa persistida y moneda de origen.
 * @returns {Promise<object>} Entidades creadas para las aserciones.
 */
async function crearEscenario(opts?: {
  monedaCuenta?: string;
  sinTesoreria?: boolean;
  conTasa?: { monedaOrigen: string; tasa: string; fechaVigencia: Date };
}) {
  const scenarioId = crypto.randomUUID();
  const monedaCuenta = opts?.monedaCuenta;
  const monedaTasa = opts?.conTasa?.monedaOrigen;
  const monedasEscenario = new Set(
    [monedaCuenta, monedaTasa].filter(
      (codigo): codigo is string =>
        typeof codigo === 'string' && codigo.length > 0 && !['CUP', 'USD'].includes(codigo),
    ),
  );
  for (const codigo of monedasEscenario) {
    await prisma.moneda.upsert({
      where: { codigo },
      create: { codigo, nombre: `Moneda ${codigo}`, simbolo: codigo },
      update: {},
    });
    monedasCreadas.push(codigo);
  }
  const tenant = await prisma.tenant.create({
    data: { nombre: `T-R61 ${stamp}`, slug: `${prefix}-${scenarioId}` },
  });
  const tenantId = tenant.tenantId;
  const user = await prisma.user.create({
    data: { name: 'Tester R61', email: `r61-${stamp}-${scenarioId}@test.local`, password: 'x' },
  });
  const pv = await prisma.puntoDeVenta.create({ data: { nombre: `PV ${stamp}`, tenantId } });
  const cliente = await prisma.cliente.create({ data: { nombre: 'Cliente R61', tenantId } });
  const cuenta = opts?.sinTesoreria
    ? null
    : await prisma.cuentaBancaria.create({
        data: {
          tenantId,
          nombreBanco: 'Banco R61',
          numeroCuenta: `NC-${scenarioId}`,
          tipoCuenta: 'AHORRO',
          ...(monedaCuenta ? { moneda: monedaCuenta } : {}),
        },
      });
  const tipoPago = opts?.sinTesoreria
    ? null
    : await prisma.tipoPago.create({
        data: { tenantId, nombre: 'Efectivo R61', requiereCuenta: false, isActive: true },
      });
  await prisma.tenantAccountingPolicy.create({
    data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: user.userId },
  });
  await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
  await prisma.tenantLicense.create({
    data: {
      tenantId,
      expiracion: new Date('2099-01-01T00:00:00Z'),
      features: { 'contabilidad-formal': true },
    },
  });
  const now = new Date();
  await prisma.periodoContable.create({
    data: {
      tenantId,
      tipo: 'MENSUAL',
      estado: 'ABIERTO',
      codigo: `R61-${scenarioId.slice(0, 12)}`,
      fechaInicio: new Date(now.getFullYear(), now.getMonth(), 1),
      fechaFin: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    },
  });
  const venta = await prisma.venta.create({
    data: {
      tenantId,
      cantidad: 1,
      puntoDeVentaId: pv.pvId,
      clienteId: cliente.clienteId,
      total: 900,
      estado: 'ENTREGADA',
    },
  });
  const serie = await prisma.serieFacturacion.create({
    data: { tenantId, prefijo: 'R6', descripcion: 'Ventas', consecutivo: 1, esPorDefecto: true },
  });
  const factura = await prisma.factura.create({
    data: {
      tenantId,
      serieId: serie.serieId,
      numeroConsecutivo: 1,
      numeroFactura: `R6-${scenarioId.slice(0, 8)}`,
      clienteId: cliente.clienteId,
      ventaId: venta.ventaId,
      subtotal: 900,
      total: 900,
      estado: 'PENDIENTE',
      creadoPor: user.userId,
    },
  });
  let tasa = null;
  if (opts?.conTasa) {
    tasa = await prisma.tasaCambio.create({
      data: {
        monedaOrigenId: opts.conTasa.monedaOrigen,
        monedaDestino: 'CUP',
        tasa: opts.conTasa.tasa,
        fechaVigencia: opts.conTasa.fechaVigencia,
      },
    });
    tasasCreadas.push(tasa.tasaId);
  }
  return { tenantId, user, cliente, cuenta, tipoPago, venta, serie, factura, tasa };
}

/**
 * @description Borra el rastro de los escenarios del slice en orden inverso de FK.
 * @returns {Promise<void>} Limpieza best-effort sobre BD desechable.
 */
async function limpiar(): Promise<void> {
  if (asientoTrigger) {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${asientoTrigger} ON "asientos"`);
    asientoTrigger = '';
  }
  if (asientoFunctionName) {
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${asientoFunctionName}()`);
    asientoFunctionName = '';
  }
  if (trigger) {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "CuentaPorCobrar"`);
    trigger = '';
  }
  if (functionName) {
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
    functionName = '';
  }
  if (tasasCreadas.length > 0) {
    await prisma.tasaCambio.deleteMany({ where: { tasaId: { in: tasasCreadas } } });
    tasasCreadas.length = 0;
  }
  if (monedasCreadas.length > 0) {
    await prisma.moneda.deleteMany({ where: { codigo: { in: monedasCreadas } } });
    monedasCreadas.length = 0;
  }
  const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: prefix } } });
  const tenantIds = tenants.map((tenant) => tenant.tenantId);
  if (tenantIds.length === 0) return;
  await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.asiento.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.reconciliacionVenta.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.factura.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.venta.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.serieFacturacion.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tipoPago.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.cuentaBancaria.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.cliente.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.puntoDeVenta.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantLicense.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.cuentaRolTenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.cuentaContable.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.diario.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.periodoCache.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.periodoContable.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: `r61-${stamp}` } } });
  await prisma.tenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
}

/** @description Valida atomicidad y valoración FX del writer de venta a crédito. */
describe('writers de facturación — PostgreSQL aislado', { timeout: 90_000 }, () => {
  beforeAll(async () => {
    const [prismaModule, workflowModule] = await Promise.all([
      import('@/lib/prisma'),
      import('@/features/ventas/services/facturacion-workflow'),
    ]);
    prisma = prismaModule.prisma;
    applyFacturacionCobroWorkflow = workflowModule.applyFacturacionCobroWorkflow;

    const target = new URL(process.env.DATABASE_URL ?? '');
    const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
      SELECT current_database() AS db, inet_server_port() AS port
    `;
    expect(identity[0]).toMatchObject({
      db: target.pathname.slice(1),
      port: Number(target.port),
    });

    await prisma.moneda.upsert({
      where: { codigo: 'CUP' },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
      update: {},
    });
    await prisma.moneda.upsert({
      where: { codigo: 'USD' },
      create: { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'USD' },
      update: {},
    });
    await prisma.$transaction((tx) => seedPlantillasGlobales(tx));
  });

  beforeEach(() => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
  });

  afterEach(async () => {
    try {
      if (!prisma) return;
      if (tasasCreadas.length > 0) {
        await prisma.tasaCambio.deleteMany({ where: { tasaId: { in: tasasCreadas } } });
        tasasCreadas.length = 0;
      }
      if (monedasCreadas.length > 0) {
        await prisma.moneda.deleteMany({ where: { codigo: { in: monedasCreadas } } });
        monedasCreadas.length = 0;
      }
    } finally {
      if (originalFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = originalFormalMode;
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await limpiar();
    await prisma.$disconnect();
  });

  it('persista el snapshot de valoración en la CxC creada (precommit y postcommit)', async () => {
    const { tenantId, user, factura } = await crearEscenario({ sinTesoreria: true });

    expect(await prisma.cuentaBancaria.count({ where: { tenantId } })).toBe(0);
    expect(await prisma.tipoPago.count({ where: { tenantId } })).toBe(0);

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 900,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
      });
      const fila = await tx.cuentaPorCobrar.findUniqueOrThrow({
        where: { facturaId: factura.idFactura },
      });
      expect(fila.monedaOriginal).toBe('CUP');
      expect(fila.montoOriginal?.eq(new Prisma.Decimal('900'))).toBe(true);
      expect(fila.montoDeudaFuncional?.eq(new Prisma.Decimal('900'))).toBe(true);
      expect(fila.montoPagadoFuncional).toBeNull();
      expect(fila.monedaFuncional).toBe('CUP');
      expect(fila.fxEvidenceJson).toMatchObject({
        fxProvenanceKind: 'SAME_CURRENCY',
        originalCurrency: 'CUP',
        functionalCurrency: 'CUP',
        fxEvidenceVersion: 2,
      });
      expect(fila.fxEvidenceFingerprint).toBeTypeOf('string');
      expect(fila.fxEvidenceVersion).toBe(2);
    });

    const post = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { facturaId: factura.idFactura },
    });
    expect(post.monedaOriginal).toBe('CUP');
    expect(post.montoDeudaFuncional?.eq(new Prisma.Decimal('900'))).toBe(true);
    expect(post.monedaFuncional).toBe('CUP');

    const asiento = await prisma.asiento.findFirstOrThrow({
      where: { tenantId, origenTipo: 'factura', origenId: factura.idFactura },
      include: { lineas: true },
    });
    expect(asiento.tenantId).toBe(tenantId);
    expect(asiento.createdBy).toBe(user.userId);
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas.every((linea) => linea.monedaOriginal === 'CUP')).toBe(true);
    const debe = asiento.lineas.reduce((suma, linea) => suma.add(linea.debe), new Prisma.Decimal(0));
    const haber = asiento.lineas.reduce((suma, linea) => suma.add(linea.haber), new Prisma.Decimal(0));
    expect(debe.eq(haber)).toBe(true);

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 900,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
      });
    });
    const asientoReintentado = await prisma.asiento.findMany({
      where: { tenantId, origenTipo: 'factura', origenId: factura.idFactura },
    });
    const cxcReintentada = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { facturaId: factura.idFactura },
    });
    expect(asientoReintentado).toHaveLength(1);
    expect(cxcReintentada.fxEvidenceFingerprint).toBe(post.fxEvidenceFingerprint);
  });

  it('contra_pago en enforce persiste reconciliación, banco, factura y asiento balanceado', async () => {
    const { tenantId, user, factura, cuenta } = await crearEscenario();
    if (!cuenta) throw new Error('El escenario contra_pago requiere una cuenta bancaria');

    const result = await prisma.$transaction((tx) => applyFacturacionCobroWorkflow(tx, {
      ventaId: factura.ventaId as string,
      facturaId: factura.idFactura,
      clienteId: factura.clienteId,
      montoTotal: 900,
      usuarioId: user.userId,
      tenantId,
      tipoVencimiento: 'contra_pago',
    }));

    expect(result.tipoVencimiento).toBe('contra_pago');
    expect(result.reconciliacionId).toBeTruthy();
    const reconciliacion = await prisma.reconciliacionVenta.findUniqueOrThrow({
      where: { reconciliacionId: result.reconciliacionId! },
    });
    expect(reconciliacion).toMatchObject({
      tenantId,
      ventaId: factura.ventaId,
      cuentaId: cuenta.cuentaId,
      reconciliadoPor: user.userId,
      moneda: 'CUP',
      monedaCuenta: 'CUP',
    });
    expect(reconciliacion.monto.eq(new Prisma.Decimal('900'))).toBe(true);
    expect(reconciliacion.montoCuenta?.eq(new Prisma.Decimal('900'))).toBe(true);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuenta.cuentaId },
    })).saldo).toBe(900);
    expect((await prisma.factura.findUniqueOrThrow({
      where: { idFactura: factura.idFactura },
    })).estado).toBe('PAGADA');
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId, facturaId: factura.idFactura } }))
      .toBe(0);

    const asiento = await prisma.asiento.findFirstOrThrow({
      where: {
        tenantId,
        origenTipo: 'reconciliacion_venta',
        origenId: reconciliacion.reconciliacionId,
      },
      include: { lineas: { orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }] } },
    });
    expect(asiento.createdBy).toBe(user.userId);
    expect(asiento.lineas).toHaveLength(2);
    const debe = asiento.lineas.reduce((sum, linea) => sum.add(linea.debe), new Prisma.Decimal(0));
    const haber = asiento.lineas.reduce((sum, linea) => sum.add(linea.haber), new Prisma.Decimal(0));
    expect(debe.eq(haber)).toBe(true);
  });

  it('VENTACONTADO parcial en enforce conserva CxC y postea cobro con origen único', async () => {
    const { tenantId, user, factura, cuenta } = await crearEscenario();
    if (!cuenta) throw new Error('El escenario parcial requiere una cuenta bancaria');

    const result = await prisma.$transaction((tx) => applyFacturacionCobroWorkflow(tx, {
      ventaId: factura.ventaId as string,
      facturaId: factura.idFactura,
      clienteId: factura.clienteId,
      montoTotal: 900,
      montoCobradoContado: 300,
      usuarioId: user.userId,
      tenantId,
      tipoVencimiento: 'fecha',
      fechaVencimiento: '2026-10-15',
    }));

    expect(result.tipoVencimiento).toBe('fecha');
    expect(result.reconciliacionId).toBeTruthy();
    const reconciliaciones = await prisma.reconciliacionVenta.findMany({
      where: { tenantId, ventaId: factura.ventaId },
    });
    expect(reconciliaciones).toHaveLength(1);
    const reconciliacion = reconciliaciones[0];
    expect(reconciliacion).toMatchObject({
      tenantId,
      ventaId: factura.ventaId,
      cuentaId: cuenta.cuentaId,
      reconciliadoPor: user.userId,
      moneda: 'CUP',
      monedaCuenta: 'CUP',
    });
    expect(reconciliacion.reconciliacionId).toBe(result.reconciliacionId);
    expect(reconciliacion.monto.eq(new Prisma.Decimal('300'))).toBe(true);
    expect(reconciliacion.montoCuenta?.eq(new Prisma.Decimal('300'))).toBe(true);
    expect((await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuenta.cuentaId },
    })).saldo).toBe(300);

    const facturaPersistida = await prisma.factura.findUniqueOrThrow({
      where: { idFactura: factura.idFactura },
    });
    expect(facturaPersistida.estado).toBe('PENDIENTE');
    expect(facturaPersistida.fechaVencimiento?.toISOString().slice(0, 10)).toBe('2026-10-15');
    const cuentasPorCobrar = await prisma.cuentaPorCobrar.findMany({
      where: { tenantId, facturaId: factura.idFactura },
    });
    expect(cuentasPorCobrar).toHaveLength(1);
    expect(cuentasPorCobrar[0].montoDeuda.eq(new Prisma.Decimal('600'))).toBe(true);
    expect(cuentasPorCobrar[0].montoPagado.eq(new Prisma.Decimal('0'))).toBe(true);

    const [bancos, clientesPorVentas, ventasProductos] = await Promise.all([
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '1.1.02' } },
      }),
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '1.2.01' } },
      }),
      prisma.cuentaContable.findUniqueOrThrow({
        where: { tenantId_codigo: { tenantId, codigo: '4.1' } },
      }),
    ]);

    const asientosCobro = await prisma.asiento.findMany({
      where: {
        tenantId,
        origenTipo: 'reconciliacion_venta',
        origenId: reconciliacion.reconciliacionId,
      },
      include: {
        lineas: {
          include: { cuenta: { select: { codigo: true } } },
          orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }],
        },
      },
    });
    expect(asientosCobro).toHaveLength(1);
    expect(asientosCobro[0].createdBy).toBe(user.userId);
    expect(asientosCobro[0].lineas).toHaveLength(2);
    expect(asientosCobro[0].lineas.map((linea) => ({
      cuentaId: linea.cuentaId,
      cuentaCodigo: linea.cuenta.codigo,
      debe: linea.debe.toString(),
      haber: linea.haber.toString(),
      monedaOriginal: linea.monedaOriginal,
      montoOriginal: linea.montoOriginal.toString(),
    }))).toEqual([
      {
        cuentaId: bancos.cuentaContableId,
        cuentaCodigo: '1.1.02',
        debe: '300',
        haber: '0',
        monedaOriginal: 'CUP',
        montoOriginal: '300',
      },
      {
        cuentaId: ventasProductos.cuentaContableId,
        cuentaCodigo: '4.1',
        debe: '0',
        haber: '300',
        monedaOriginal: 'CUP',
        montoOriginal: '300',
      },
    ]);
    const debeCobro = asientosCobro[0].lineas.reduce(
      (sum, linea) => sum.add(linea.debe), new Prisma.Decimal(0),
    );
    const haberCobro = asientosCobro[0].lineas.reduce(
      (sum, linea) => sum.add(linea.haber), new Prisma.Decimal(0),
    );
    expect(debeCobro.eq(haberCobro)).toBe(true);

    const asientoFactura = await prisma.asiento.findMany({
      where: { tenantId, origenTipo: 'factura', origenId: factura.idFactura },
      include: {
        lineas: {
          include: { cuenta: { select: { codigo: true } } },
          orderBy: [{ orden: 'asc' }, { lineaId: 'asc' }],
        },
      },
    });
    expect(asientoFactura).toHaveLength(1);
    expect(asientoFactura[0].createdBy).toBe(user.userId);
    expect(asientoFactura[0].lineas).toHaveLength(2);
    expect(asientoFactura[0].lineas.map((linea) => ({
      cuentaId: linea.cuentaId,
      cuentaCodigo: linea.cuenta.codigo,
      debe: linea.debe.toString(),
      haber: linea.haber.toString(),
      monedaOriginal: linea.monedaOriginal,
      montoOriginal: linea.montoOriginal.toString(),
    }))).toEqual([
      {
        cuentaId: clientesPorVentas.cuentaContableId,
        cuentaCodigo: '1.2.01',
        debe: '600',
        haber: '0',
        monedaOriginal: 'CUP',
        montoOriginal: '600',
      },
      {
        cuentaId: ventasProductos.cuentaContableId,
        cuentaCodigo: '4.1',
        debe: '0',
        haber: '600',
        monedaOriginal: 'CUP',
        montoOriginal: '600',
      },
    ]);
    const debeFactura = asientoFactura[0].lineas.reduce(
      (sum, linea) => sum.add(linea.debe), new Prisma.Decimal(0),
    );
    const haberFactura = asientoFactura[0].lineas.reduce(
      (sum, linea) => sum.add(linea.haber), new Prisma.Decimal(0),
    );
    expect(debeFactura.eq(haberFactura)).toBe(true);
  });

  it('revierte VENTACONTADO parcial y CxC ante fallo SQL de postEvento', async () => {
    const { tenantId, user, factura, cuenta } = await crearEscenario();
    if (!cuenta) throw new Error('El escenario parcial requiere una cuenta bancaria');
    const ventaId = factura.ventaId as string;
    const marker = `r61_venta_contado_parcial_${crypto.randomUUID().replaceAll('-', '')}`;
    asientoTrigger = marker;
    asientoFunctionName = `${marker}_fn`;

    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${asientoFunctionName}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."tenantId" = '${tenantId}'
          AND NEW."origenTipo" = 'reconciliacion_venta'
          AND EXISTS (
            SELECT 1 FROM "ReconciliacionVenta" r
            WHERE r."reconciliacionId" = NEW."origenId"
              AND r."tenantId" = NEW."tenantId"
              AND r."ventaId" = '${ventaId}'
          ) THEN
          RAISE EXCEPTION 'VENTACONTADO_PARCIAL_POSTEVENTO_FAILPOINT'
            USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${asientoTrigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW EXECUTE FUNCTION ${asientoFunctionName}()`);

    const snapshotBefore = await capturarSnapshotContraPago(
      tenantId,
      factura.idFactura,
      ventaId,
      cuenta.cuentaId,
    );
    try {
      const rejection = await prisma.$transaction((tx) => applyFacturacionCobroWorkflow(tx, {
        ventaId,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 900,
        montoCobradoContado: 300,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
      })).then(() => null, (error: unknown) => error);

      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toContain('code: "22012"');
      expect((rejection as Error).message).toContain('VENTACONTADO_PARCIAL_POSTEVENTO_FAILPOINT');
      expect(await capturarSnapshotContraPago(
        tenantId,
        factura.idFactura,
        ventaId,
        cuenta.cuentaId,
      )).toEqual(snapshotBefore);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${asientoTrigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${asientoFunctionName}()`);
      asientoTrigger = '';
      asientoFunctionName = '';
    }
  });

  it('revierte contra_pago, reconciliación y banco ante fallo SQL tardío del posteo', async () => {
    const { tenantId, user, factura, cuenta } = await crearEscenario();
    if (!cuenta) throw new Error('El escenario contra_pago requiere una cuenta bancaria');
    const ventaId = factura.ventaId as string;
    const marker = `r61_contra_pago_asiento_${crypto.randomUUID().replaceAll('-', '')}`;
    asientoTrigger = marker;
    asientoFunctionName = `${marker}_fn`;

    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${asientoFunctionName}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."tenantId" = '${tenantId}'
          AND NEW."origenTipo" = 'reconciliacion_venta'
          AND EXISTS (
            SELECT 1 FROM "ReconciliacionVenta" r
            WHERE r."reconciliacionId" = NEW."origenId"
              AND r."tenantId" = NEW."tenantId"
              AND r."ventaId" = '${ventaId}'
          ) THEN
          RAISE EXCEPTION 'VENTA_CONTADO_CONTRA_PAGO_ASIENTO_FAILPOINT'
            USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${asientoTrigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW EXECUTE FUNCTION ${asientoFunctionName}()`);

    const snapshotBefore = await capturarSnapshotContraPago(
      tenantId,
      factura.idFactura,
      ventaId,
      cuenta.cuentaId,
    );
    try {
      const rejection = await prisma.$transaction((tx) => applyFacturacionCobroWorkflow(tx, {
        ventaId,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 900,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'contra_pago',
      })).then(() => null, (error: unknown) => error);

      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toContain('code: "22012"');
      expect((rejection as Error).message)
        .toContain('VENTA_CONTADO_CONTRA_PAGO_ASIENTO_FAILPOINT');
      expect(await capturarSnapshotContraPago(
        tenantId,
        factura.idFactura,
        ventaId,
        cuenta.cuentaId,
      )).toEqual(snapshotBefore);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${asientoTrigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${asientoFunctionName}()`);
      asientoTrigger = '';
      asientoFunctionName = '';
    }
  });

  it('factura extranjera persista tasa histórica y fingerprint comparable desde la fila leída', async () => {
    const vigencia = new Date('2026-09-15T00:00:00Z');
    const { tenantId, user, factura, tasa } = await crearEscenario({
      monedaCuenta: 'CUP',
      conTasa: { monedaOrigen: monedaExtranjera, tasa: '24', fechaVigencia: vigencia },
    });
    const monedaOriginal = tasa!.monedaOrigenId;
    const valoracion = buildAppliedFxEvidenceExact({
      originalAmount: '900.0000',
      originalCurrency: monedaOriginal,
      functionalCurrency: 'CUP',
      exchangeRate: '24.0000000000',
      rateEffectiveAt: vigencia,
      source: 'facturacion-venta-credito-cxc',
      fxCatalogRateId: tasa!.tasaId,
      fxProvenanceKind: 'CATALOG_RATE',
    });

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 900,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
        monedaOriginal,
        valoracion,
      });
    });

    const post = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { facturaId: factura.idFactura },
    });
    expect(post.monedaOriginal).toBe(monedaExtranjera);
    expect(post.montoOriginal?.eq(new Prisma.Decimal('900'))).toBe(true);
    expect(post.montoDeudaFuncional?.eq(new Prisma.Decimal('21600'))).toBe(true);
    expect(post.monedaFuncional).toBe('CUP');
    expect(post.tasaCambio?.eq(new Prisma.Decimal('24'))).toBe(true);
    expect(post.rateEffectiveAt?.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(post.fxProvenanceKind).toBe('CATALOG_RATE');
    expect(post.fxProvenanceSource).toBe('facturacion-venta-credito-cxc');
    expect(post.fxCatalogRateId).toBeTypeOf('string');
    expect(post.fxEvidenceVersion).toBe(2);

    // El contrato de comparabilidad de la conciliación (R4): reconstruir la
    // evidencia canónica desde la fila leída debe coincidir exactamente con
    // el JSON y el fingerprint persistidos.
    const canonico = buildAppliedFxEvidenceExact({
      originalAmount: post.montoOriginal!,
      originalCurrency: monedaExtranjera,
      functionalCurrency: post.monedaFuncional!,
      exchangeRate: post.tasaCambio!,
      convertedAmount: post.montoDeudaFuncional!,
      rateEffectiveAt: post.rateEffectiveAt!,
      source: post.fxProvenanceSource!,
      fxCatalogRateId: post.fxCatalogRateId,
      fxProvenanceKind: 'CATALOG_RATE',
    });
    expect(post.fxEvidenceFingerprint).toBe(canonico.evidence.fxEvidenceFingerprint);
    expect(post.fxEvidenceJson).toEqual(canonico.evidence);

    const asiento = await prisma.asiento.findFirstOrThrow({
      where: { tenantId, origenTipo: 'factura', origenId: factura.idFactura },
      include: { lineas: true },
    });
    expect(asiento.lineas).toHaveLength(2);
    expect(asiento.lineas.every((linea) =>
      linea.monedaOriginal === monedaExtranjera &&
      linea.montoOriginal.eq(new Prisma.Decimal('900')) &&
      linea.tasaCambio?.eq(new Prisma.Decimal('24')) &&
      linea.fxEvidenceFingerprint === canonico.evidence.fxEvidenceFingerprint,
    )).toBe(true);
    const debe = asiento.lineas.reduce((suma, linea) => suma.add(linea.debe), new Prisma.Decimal(0));
    const haber = asiento.lineas.reduce((suma, linea) => suma.add(linea.haber), new Prisma.Decimal(0));
    expect(debe.eq(haber)).toBe(true);
  });

  it('moneda extranjera sin valoración explícita rechaza antes de escribir', async () => {
    const { tenantId, user, factura } = await crearEscenario({ monedaCuenta: `R61X${stamp}` });
    const cxcBefore = await prisma.cuentaPorCobrar.count({ where: { tenantId } });

    await expect(
      prisma.$transaction(async (tx) => {
        await applyFacturacionCobroWorkflow(tx, {
          ventaId: factura.ventaId as string,
          facturaId: factura.idFactura,
          clienteId: factura.clienteId,
          montoTotal: 900,
          usuarioId: user.userId,
          tenantId,
          tipoVencimiento: 'fecha',
          fechaVencimiento: '2026-10-15',
          monedaOriginal: `R61X${stamp}`,
        });
      }),
    ).rejects.toThrow('valoración FX explícita');

    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId } })).toBe(cxcBefore);
    const facturaPost = await prisma.factura.findUniqueOrThrow({
      where: { idFactura: factura.idFactura },
    });
    expect(facturaPost.fechaVencimiento).toBeNull();
  });

  it('shadow conserva crédito sin FX y deja causa durable en el outbox', async () => {
    process.env.CONTABILIDAD_FORMAL_MODE = 'shadow';
    const { tenantId, user, factura } = await crearEscenario({ sinTesoreria: true });
    const monedaSinTasa = `R61S${stamp}`;

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 900,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
        monedaOriginal: monedaSinTasa,
      });
    });

    const cxc = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { facturaId: factura.idFactura },
    });
    expect(cxc.montoDeuda.toFixed()).toBe('900');
    expect(cxc.monedaOriginal).toBeNull();
    expect(cxc.fxEvidenceFingerprint).toBeNull();

    const outbox = await prisma.shadowPosteoOutbox.findFirstOrThrow({
      where: {
        tenantId,
        tipoEvento: 'VENTA_CREDITO',
        origenTipo: 'factura',
        origenId: factura.idFactura,
      },
    });
    expect(outbox.estado).toBe('ERROR_SHADOW');
    expect(outbox.causa).toContain('valoración monetaria');
    expect(await prisma.asiento.count({ where: { tenantId } })).toBe(0);
  });

  it('serializa reintentos concurrentes y conserva un único asiento por factura', async () => {
    const { tenantId, user, factura } = await crearEscenario({ sinTesoreria: true });
    const ejecutar = () => prisma.$transaction((tx) => applyFacturacionCobroWorkflow(tx, {
      ventaId: factura.ventaId as string,
      facturaId: factura.idFactura,
      clienteId: factura.clienteId,
      montoTotal: 900,
      usuarioId: user.userId,
      tenantId,
      tipoVencimiento: 'fecha',
      fechaVencimiento: '2026-10-15',
    }));

    const resultados = await Promise.allSettled([ejecutar(), ejecutar()]);
    expect(resultados.every((resultado) => resultado.status === 'fulfilled')).toBe(true);
    expect(await prisma.cuentaPorCobrar.count({ where: { tenantId, facturaId: factura.idFactura } }))
      .toBe(1);
    expect(await prisma.asiento.count({
      where: { tenantId, origenTipo: 'factura', origenId: factura.idFactura },
    })).toBe(1);
  });

  it('revierte la transacción cuando PostgreSQL rechaza el INSERT de la CxC', async () => {
    const { tenantId, user, factura } = await crearEscenario();
    const cxcBefore = await prisma.cuentaPorCobrar.count({ where: { tenantId } });

    trigger = `r61_cxc_${crypto.randomUUID().replaceAll('-', '')}`;
    functionName = `${trigger}_fn`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'posteo SQL rechazado: inserción de CxC fallida' USING ERRCODE = '22012';
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "CuentaPorCobrar"
      FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${functionName}()`);

    try {
      await expect(
        prisma.$transaction(async (tx) => {
          await applyFacturacionCobroWorkflow(tx, {
            ventaId: factura.ventaId as string,
            facturaId: factura.idFactura,
            clienteId: factura.clienteId,
            montoTotal: 900,
            usuarioId: user.userId,
            tenantId,
            tipoVencimiento: 'fecha',
            fechaVencimiento: '2026-10-15',
          });
        }),
      ).rejects.toThrow('inserción de CxC fallida');

      expect(await prisma.cuentaPorCobrar.count({ where: { tenantId } })).toBe(cxcBefore);
      const facturaPost = await prisma.factura.findUniqueOrThrow({
        where: { idFactura: factura.idFactura },
      });
      expect(facturaPost.fechaVencimiento).toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "CuentaPorCobrar"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
      trigger = '';
      functionName = '';
    }
  });

  it('revierte factura, CxC y asiento ante fallo SQL tardío del posteo VENTA_CREDITO', async () => {
    const { tenantId, user, factura } = await crearEscenario({ sinTesoreria: true });
    const marker = `r61_asiento_${crypto.randomUUID().replaceAll('-', '')}`;
    asientoTrigger = marker;
    asientoFunctionName = `${marker}_fn`;

    await prisma.$executeRawUnsafe(`CREATE FUNCTION ${asientoFunctionName}() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN
        IF NEW."tenantId" = '${tenantId}'
          AND NEW."origenTipo" = 'factura'
          AND NEW."origenId" = '${factura.idFactura}' THEN
          RAISE EXCEPTION 'VENTA_CREDITO_ASIENTO_FAILPOINT'
            USING ERRCODE = '22012';
        END IF;
        RETURN NEW;
      END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER ${asientoTrigger} BEFORE INSERT ON "asientos"
      FOR EACH ROW EXECUTE FUNCTION ${asientoFunctionName}()`);

    const snapshotBefore = await capturarSnapshotCredito(tenantId, factura.idFactura);
    try {
      const rejection = await prisma.$transaction(async (tx) => {
        await applyFacturacionCobroWorkflow(tx, {
          ventaId: factura.ventaId as string,
          facturaId: factura.idFactura,
          clienteId: factura.clienteId,
          montoTotal: 900,
          usuarioId: user.userId,
          tenantId,
          tipoVencimiento: 'fecha',
          fechaVencimiento: '2026-10-15',
        });
      }).then(() => null, (error: unknown) => error);

      expect(rejection).toBeInstanceOf(Error);
      expect((rejection as Error).message).toContain('code: "22012"');
      expect((rejection as Error).message).toContain('VENTA_CREDITO_ASIENTO_FAILPOINT');
      expect(await capturarSnapshotCredito(tenantId, factura.idFactura)).toEqual(snapshotBefore);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${asientoTrigger} ON "asientos"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${asientoFunctionName}()`);
      asientoTrigger = '';
      asientoFunctionName = '';
    }
  });

  it('aislamiento tenant: la CxC creada pertenece al tenant del writer y no toca filas ajenas', async () => {
    const { tenantId, user, factura } = await crearEscenario();
    const otroTenant = await prisma.tenant.create({
      data: { nombre: `T-R61-other ${stamp}`, slug: `${prefix}-other-${crypto.randomUUID()}` },
    });
    const cxcOtroAntes = await prisma.cuentaPorCobrar.count({
      where: { tenantId: otroTenant.tenantId },
    });

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 900,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
      });
    });

    const cxc = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { facturaId: factura.idFactura },
    });
    expect(cxc.tenantId).toBe(tenantId);
    expect(await prisma.cuentaPorCobrar.count({
      where: { tenantId: otroTenant.tenantId },
    })).toBe(cxcOtroAntes);
    await prisma.tenant.delete({ where: { tenantId: otroTenant.tenantId } });
  });
});
