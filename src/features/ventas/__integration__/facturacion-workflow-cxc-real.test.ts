/**
 * @description Integración real (gate 1.2 del change
 * remediacion-integridad-ventas-credito-fiscal): fila CxC existente en
 * PostgreSQL aislado + `applyFacturacionCobroWorkflow` en transacción real.
 *
 * Verifica los contratos actuales del workflow:
 *  1. Un reintento de vencimiento preserva pagos, estado y valoración FX
 *     previamente persistida.
 *  2. MIXTO/vencimiento crea la deuda por el total que recibe el workflow y no
 *     aplica efectivo declarado fuera de este canal.
 *  3. Decimal de PostgreSQL conserva centavos exactos en deuda y pago.
 *  4. Una valoración histórica incompleta se rechaza fail-closed y no inventa
 *     moneda funcional ni tasa.
 *  5. Los efectos del workflow son transaccionales ante un error posterior.
 *  6. `contra_pago` + MIXTO cobra el total sin crear CxC.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { applyFacturacionCobroWorkflow } from '@/features/ventas/services/facturacion-workflow';
import { saldoVivoCliente } from '@/features/crm/services/credito-calculo';
import { buildAppliedFxEvidenceExact } from '@/features/contabilidad/domain/fx-evidence';

const stamp = Date.now();

/**
 * @description Crea un tenant aislado con usuario, punto de venta, cliente,
 * cuenta bancaria CUP activa, tipo de pago activo, venta MIXTO, serie y
 * factura; opcionalmente una CxC existente con pagos aplicados.
 * @param {object} opts - Opciones: `cxcPagada` con montos de deuda/pagado.
 * @returns {Promise<object>} Entidades creadas para las aserciones.
 */
async function crearEscenario(opts?: {
  cxcPagada?: { montoDeuda: number; montoPagado: number };
  monedaOriginal?: string;
}) {
  const scenarioId = crypto.randomUUID();
  const tenant = await prisma.tenant.create({
    data: { nombre: `T-FWC ${stamp}`, slug: `fwc-${stamp}-${scenarioId}` },
  });
  const tenantId = tenant.tenantId;

  const user = await prisma.user.create({
    data: { name: 'Tester FWC', email: `fwc-${stamp}-${scenarioId}@test.local`, password: 'x' },
  });
  const pv = await prisma.puntoDeVenta.create({ data: { nombre: `PV ${stamp}`, tenantId } });
  const cliente = await prisma.cliente.create({ data: { nombre: 'Cliente FWC', tenantId } });
  // La valoración de la CxC de crédito exige política funcional del tenant (R6.1).
  await prisma.tenantAccountingPolicy.create({
    data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: user.userId },
  });
  const cuenta = await prisma.cuentaBancaria.create({
    data: { tenantId, nombreBanco: 'Banco FWC', numeroCuenta: `NC-${scenarioId}`, tipoCuenta: 'AHORRO' },
  });
  const tipoPago = await prisma.tipoPago.create({
    data: { tenantId, nombre: 'Efectivo FWC', requiereCuenta: false, isActive: true },
  });
  const venta = await prisma.venta.create({
    data: {
      tenantId,
      cantidad: 1,
      puntoDeVentaId: pv.pvId,
      clienteId: cliente.clienteId,
      total: 2000,
      estado: 'ENTREGADA',
      metodoPago: 'MIXTO',
      montoEfectivo: 40,
      montoCredito: 1960,
    },
  });
  const serie = await prisma.serieFacturacion.create({
    data: { tenantId, prefijo: 'FV', descripcion: 'Ventas', consecutivo: 1, esPorDefecto: true },
  });
  const factura = await prisma.factura.create({
    data: {
      tenantId,
      serieId: serie.serieId,
      numeroConsecutivo: 1,
      numeroFactura: 'FV-000001',
      clienteId: cliente.clienteId,
      ventaId: venta.ventaId,
      subtotal: 2000,
      total: 2000,
      estado: 'PENDIENTE',
      creadoPor: user.userId,
    },
  });

  let cxc = null;
  if (opts?.cxcPagada) {
    const snapshot = opts.monedaOriginal
      ? null
      : buildAppliedFxEvidenceExact({
          originalAmount: String(opts.cxcPagada.montoDeuda),
          originalCurrency: 'CUP',
          functionalCurrency: 'CUP',
          source: 'facturacion-venta-credito-cxc',
        });
    cxc = await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: cliente.clienteId,
        facturaId: factura.idFactura,
        montoDeuda: opts.cxcPagada.montoDeuda,
        montoPagado: opts.cxcPagada.montoPagado,
        estado: 'PARCIAL',
        fechaVencimiento: new Date('2026-09-20T00:00:00Z'),
        ...(snapshot
          ? {
              monedaOriginal: snapshot.evidence.originalCurrency,
              montoOriginal: snapshot.evidence.originalAmount,
              montoDeudaFuncional: snapshot.montoConvertido,
              monedaFuncional: snapshot.evidence.functionalCurrency,
              tasaCambio: snapshot.tasaCambio,
              rateEffectiveAt: snapshot.rateEffectiveAt,
              fxProvenanceKind: snapshot.evidence.fxProvenanceKind,
              fxProvenanceSource: snapshot.evidence.fxProvenanceSource,
              fxCatalogRateId: snapshot.evidence.fxCatalogRateId,
              fxEvidenceJson: snapshot.evidence,
              fxEvidenceFingerprint: snapshot.evidence.fxEvidenceFingerprint,
              fxEvidenceVersion: snapshot.evidence.fxEvidenceVersion,
            }
          : {}),
        ...(opts.monedaOriginal
          ? {
              monedaOriginal: opts.monedaOriginal,
              montoOriginal: opts.cxcPagada.montoDeuda,
            }
          : {}),
      } as never,
    });
  }

  return { tenantId, user, cliente, cuenta, tipoPago, venta, serie, factura, cxc };
}

/**
 * @description Borra el rastro del tenant por slug, en orden inverso de FK.
 * @param {string} slugBase - Prefijo de slug usado por los escenarios.
 * @returns {Promise<void>} Limpieza best-effort sobre BD desechable.
 */
async function limpiar(slugBase: string): Promise<void> {
  await prisma.reconciliacionVenta.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.cuentaPorCobrar.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.factura.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.venta.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.serieFacturacion.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.tipoPago.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.cuentaBancaria.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.cliente.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.puntoDeVenta.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.tenantAccountingPolicy.deleteMany({ where: { tenant: { slug: { startsWith: slugBase } } } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: slugBase } } });
}

describe('gate 1.2: upsert de facturación sobre CxC real (PostgreSQL aislado)', { timeout: 60_000 }, () => {
  afterAll(async () => {
    await limpiar(`fwc-${stamp}`);
    await prisma.$disconnect();
  });

  it('reejecutar vencimiento preserva pago, estado y snapshot de una CxC pagada', async () => {
    const { tenantId, user, factura, cxc } = await crearEscenario({
      cxcPagada: { montoDeuda: 2000, montoPagado: 400 },
    });

    // Estado previo real: pagado 400 → saldo vivo 1600.
    const pre = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc!.id } });
    expect(Number(pre.montoPagado)).toBe(400);
    expect(pre.estado).toBe('PARCIAL');
    expect(saldoVivoCliente([pre])).toBe(1600);

    // El servicio de facturación reejecuta el workflow con vencimiento.
    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 2000,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
      });
    });

    const post = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc!.id } });
    expect(Number(post.montoPagado)).toBe(400);
    expect(post.estado).toBe('PARCIAL');
    expect(saldoVivoCliente([post])).toBe(1600);
  });

  it('MIXTO/vencimiento: la deuda queda por el total completo con pagado 0 (precommit y postcommit)', async () => {
    const { tenantId, user, factura } = await crearEscenario();

    // Venta MIXTO 40 efectivo / 60 crédito declarados fuera del workflow:
    // el servicio llama al workflow sólo con montoTotal=100.
    let precommit: { montoDeuda: unknown; montoPagado: unknown } | null = null;
    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 100,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
      });
      // Lectura de la deuda dentro de la misma transacción (pre-commit).
      const fila = await tx.cuentaPorCobrar.findUniqueOrThrow({
        where: { facturaId: factura.idFactura },
      });
      precommit = { montoDeuda: fila.montoDeuda, montoPagado: fila.montoPagado };
    });

    expect(precommit).not.toBeNull();
    expect(Number(precommit!.montoDeuda)).toBe(100); // total completo, no 60
    expect(Number(precommit!.montoPagado)).toBe(0); // sin aplicación del efectivo 40

    // Post-commit: idéntico al pre-commit.
    const post = await prisma.cuentaPorCobrar.findUniqueOrThrow({
      where: { facturaId: factura.idFactura },
    });
    expect(Number(post.montoDeuda)).toBe(100);
    expect(Number(post.montoPagado)).toBe(0);
    expect(post.estado).toBe('PENDIENTE');
  });

  it('centavos: Decimal conserva 0,01 exactos en deuda y pago de la fila existente', async () => {
    const { tenantId, user, factura, cxc } = await crearEscenario({
      cxcPagada: { montoDeuda: 2000.01, montoPagado: 400.25 },
    });

    const pre = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc!.id } });
    expect(pre.montoDeuda.toFixed(2)).toBe('2000.01');
    expect(pre.montoPagado.toFixed(2)).toBe('400.25');

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 2000.01,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
      });
    });

    const post = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc!.id } });
    expect(post.montoDeuda.toFixed(2)).toBe('2000.01');
    expect(post.montoPagado.toFixed(2)).toBe('400.25');
    expect(post.estado).toBe('PARCIAL');
  });

  it('moneda: una CxC histórica sin snapshot funcional se rechaza fail-closed', async () => {
    const previousMode = process.env.CONTABILIDAD_FORMAL_MODE;
    process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
    try {
      const { tenantId, user, factura, cxc } = await crearEscenario({
        cxcPagada: { montoDeuda: 2000, montoPagado: 0 },
        monedaOriginal: 'USD',
      });
      expect(cxc!.monedaOriginal).toBe('USD');

      // Esta fila histórica es deliberadamente incompleta: no pasar valoración
      // aquí conserva el contrato fail-closed y evita fabricar una conversión.
      await expect(
        prisma.$transaction(async (tx) => {
          await applyFacturacionCobroWorkflow(tx, {
            ventaId: factura.ventaId as string,
            facturaId: factura.idFactura,
            clienteId: factura.clienteId,
            montoTotal: 2000,
            usuarioId: user.userId,
            tenantId,
            tipoVencimiento: 'fecha',
            fechaVencimiento: '2026-10-15',
          });
        }),
      ).rejects.toMatchObject({ code: 'FX_INSUFICIENTE' });

      const post = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc!.id } });
      expect(post.monedaOriginal).toBe('USD');
      expect(post.monedaFuncional).toBeNull();
      expect(post.montoDeudaFuncional).toBeNull();
      expect(post.montoPagadoFuncional).toBeNull();
      expect(post.tasaCambio).toBeNull();
    } finally {
      if (previousMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousMode;
    }
  });

  it('rollback: tras un error dentro de la tx la CxC queda exactamente como antes', async () => {
    const { tenantId, user, factura, cxc } = await crearEscenario({
      cxcPagada: { montoDeuda: 2000, montoPagado: 400 },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await applyFacturacionCobroWorkflow(tx, {
          ventaId: factura.ventaId as string,
          facturaId: factura.idFactura,
          clienteId: factura.clienteId,
          montoTotal: 2000,
          usuarioId: user.userId,
          tenantId,
          tipoVencimiento: 'fecha',
          fechaVencimiento: '2026-10-15',
        });
        throw new Error('rollback-fuerza');
      }),
    ).rejects.toThrow('rollback-fuerza');

    const post = await prisma.cuentaPorCobrar.findUniqueOrThrow({ where: { id: cxc!.id } });
    expect(Number(post.montoDeuda)).toBe(2000);
    expect(Number(post.montoPagado)).toBe(400);
    expect(post.estado).toBe('PARCIAL');
    expect(post.fechaVencimiento?.toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  it('contra_pago + MIXTO: cobra el total sin CxC y deja la factura PAGADA', async () => {
    const { tenantId, user, factura, cuenta } = await crearEscenario();

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 100,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'contra_pago',
      });
    });

    const rec = await prisma.reconciliacionVenta.findFirstOrThrow({ where: { tenantId } });
    expect(Number(rec.monto)).toBe(100); // cobro por total, no por porción
    expect(rec.moneda).toBe('CUP');
    expect(Number(rec.tasaCambio)).toBe(1);

    const banco = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuenta.cuentaId },
    });
    expect(banco.saldo).toBe(100);

    const facturaPost = await prisma.factura.findUniqueOrThrow({
      where: { idFactura: factura.idFactura },
    });
    expect(facturaPost.estado).toBe('PAGADA');

    const cxcCount = await prisma.cuentaPorCobrar.count({ where: { tenantId } });
    expect(cxcCount).toBe(0); // contra_pago no crea CxC
  });

  it('MIXTO+fecha con porción cobrada hoy: concilia 40 hoy y la CxC queda por 60', async () => {
    const { tenantId, user, factura, cuenta } = await crearEscenario();

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 100,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
        montoCobradoContado: 40,
      });
    });

    // La porción cobrada hoy quedó conciliada y abonada al banco.
    const recContado = await prisma.reconciliacionVenta.findFirstOrThrow({
      where: { tenantId, ventaId: factura.ventaId },
    });
    expect(Number(recContado.monto)).toBe(40);
    const banco = await prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: cuenta.cuentaId },
    });
    expect(banco.saldo).toBe(40);

    // La CxC quedó sólo por la deuda realmente pendiente (60), PENDIENTE y
    // sin pagos. La valoración FX se sella sólo con la capa formal activa
    // (modo off por defecto en este entorno), así que no se afirma aquí.
    const cxc = await prisma.cuentaPorCobrar.findFirstOrThrow({
      where: { tenantId, facturaId: factura.idFactura },
    });
    expect(Number(cxc!.montoDeuda)).toBe(60);
    expect(Number(cxc!.montoPagado)).toBe(0);
    expect(cxc!.estado).toBe('PENDIENTE');

    const facturaPost = await prisma.factura.findUniqueOrThrow({
      where: { idFactura: factura.idFactura },
    });
    expect(facturaPost.estado).toBe('PENDIENTE');
  });

  it('MIXTO+fecha donde lo cobrado hoy cubre el total: sin CxC y factura PAGADA', async () => {
    const { tenantId, user, factura } = await crearEscenario();

    await prisma.$transaction(async (tx) => {
      await applyFacturacionCobroWorkflow(tx, {
        ventaId: factura.ventaId as string,
        facturaId: factura.idFactura,
        clienteId: factura.clienteId,
        montoTotal: 100,
        usuarioId: user.userId,
        tenantId,
        tipoVencimiento: 'fecha',
        fechaVencimiento: '2026-10-15',
        montoCobradoContado: 100,
      });
    });

    const cxcCount = await prisma.cuentaPorCobrar.count({ where: { tenantId } });
    expect(cxcCount).toBe(0);
    const facturaPost = await prisma.factura.findUniqueOrThrow({
      where: { idFactura: factura.idFactura },
    });
    expect(facturaPost.estado).toBe('PAGADA');
  });
});
