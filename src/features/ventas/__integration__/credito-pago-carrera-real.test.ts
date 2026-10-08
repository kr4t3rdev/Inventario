/**
 * @description Integración real (carrera de escritores del cupo, change
 * remediacion-integridad-ventas-credito-fiscal): ejercita el servicio real de
 * pago de préstamos cash y el validador de crédito contra PostgreSQL aislado.
 *
 * Escenarios:
 *  1. Dos pagos simultáneos de 60 sobre una CxC de 100: el lock de cliente +
 *     relectura vigente dejan confirmar uno solo; el otro aborta con
 *     CREDITO_CONFLICTO antes de tocar banco/reconciliación/posting.
 *  2. Pago de 60 concurrente con la validación de nueva deuda de 60 (límite
 *     100, saldo inicial 100): el pago nunca se pierde; la decisión de cupo
 *     observa el saldo serializado (rechaza si valida antes del pago, aprueba
 *     el límite justo si valida después) y el saldo final nunca supera 100.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { validarCreditoOrigen } from '@/features/ventas/services/credito-override';
import { AccountingCashOperationsMutationService } from '@/features/contabilidad/services/accounting-cash-operations-mutation-service';

const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const tenantIds: string[] = [];

/** Usuario manager con tenant, feature y permiso reales del servicio de préstamos. */
function managerUser(userId: string, tenantId: string): AuthenticatedUser {
  return {
    userId,
    tenantId,
    name: 'Manager Carrera',
    email: `${userId}@carrera.test.local`,
    role: 'user',
    isActive: true,
    tenantRole: 'manager',
    planFeatures: { 'prestamos-cash': true },
    permissions: new Set(['financiero.contabilidad.acceder']),
  } as unknown as AuthenticatedUser;
}

/** Operador sin permisos de override para el lado de crédito del race. */
function operadorSinOverride(userId: string, tenantId: string): AuthenticatedUser {
  return {
    ...managerUser(userId, tenantId),
    permissions: new Set<string>(),
  } as unknown as AuthenticatedUser;
}

/**
 * @description Crea tenant aislado con cliente (límite), banco, tipo de pago,
 * préstamo cash y su CxC con deuda/pagado indicados.
 * @param {object} opts - limiteCredito, deuda y pagado inicial de la CxC.
 * @returns {Promise<object>} IDs del escenario.
 */
async function crearEscenario(opts: { limiteCredito: number; deuda: number; pagado: number }) {
  const escenario = crypto.randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({
    data: { nombre: `Carrera Pago ${stamp}`, slug: `carrera-pago-${stamp}-${escenario}` },
  });
  tenantIds.push(tenant.tenantId);
  const tenantId = tenant.tenantId;
  // Política contable requerida por el writer y el guard fail-closed del motor.
  await prisma.tenantAccountingPolicy.create({
    data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: 'integration-carrera' },
  });

  const cliente = await prisma.cliente.create({
    data: { nombre: 'Cliente Carrera', tenantId, limiteCredito: opts.limiteCredito },
  });
  const cuenta = await prisma.cuentaBancaria.create({
    data: { tenantId, nombreBanco: 'Banco Carrera', numeroCuenta: `NC-${stamp}`, tipoCuenta: 'AHORRO' },
  });
  const tipoPago = await prisma.tipoPago.create({
    data: { tenantId, nombre: 'Efectivo Carrera', requiereCuenta: false, isActive: true },
  });
  const cxc = await prisma.cuentaPorCobrar.create({
    data: {
      tenantId,
      clienteId: cliente.clienteId,
      montoDeuda: opts.deuda,
      montoPagado: opts.pagado,
      monedaOriginal: 'CUP',
      montoOriginal: opts.deuda,
      tipoCuenta: 'PRESTAMO_CASH',
      estado: 'PARCIAL',
    },
  });
  const prestamo = await prisma.prestamoCash.create({
    data: {
      tenantId,
      clienteId: cliente.clienteId,
      cuentaPorCobrarId: cxc.id,
      montoCapital: opts.deuda,
      moneda: 'CUP',
      createdById: 'integration-carrera',
    },
  });
  return { tenantId, cliente, cuenta, tipoPago, cxc, prestamo };
}

/** Limpieza best-effort en orden inverso de FK para los tenants del archivo. */
afterAll(async () => {
  for (const tenantId of tenantIds) {
    await prisma.reconciliacionVenta.deleteMany({ where: { tenantId } });
    await prisma.prestamoCash.deleteMany({ where: { tenantId } });
    await prisma.cuentaPorCobrar.deleteMany({ where: { tenantId } });
    await prisma.tipoPago.deleteMany({ where: { tenantId } });
    await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
    await prisma.cliente.deleteMany({ where: { tenantId } });
    await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { tenantId } }).catch(() => undefined);
  }
});

describe('carrera de cupo: pagos y nueva deuda en PostgreSQL real', () => {
  it('dos pagos simultáneos sobre el mismo préstamo confirman uno solo', async () => {
    const { tenantId, cuenta, tipoPago, prestamo, cxc } = await crearEscenario({
      limiteCredito: 100, deuda: 100, pagado: 0,
    });

    const pagar = (userId: string) =>
      AccountingCashOperationsMutationService.registerCashLoanPayment({
        input: { id: prestamo.id, monto: 60, cuentaId: cuenta.cuentaId, tipoPagoId: tipoPago.tipoId },
        user: managerUser(userId, tenantId),
      });

    const resultados = await Promise.allSettled([
      pagar('carrera-pago-a'),
      pagar('carrera-pago-b'),
    ]);
    const confirmados = resultados.filter((r) => r.status === 'fulfilled');
    const rechazados = resultados.filter((r) => r.status === 'rejected');
    expect(confirmados).toHaveLength(1);
    expect(rechazados).toHaveLength(1);
    expect((rechazados[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'CREDITO_CONFLICTO',
    });

    const cxcFinal = await prisma.cuentaPorCobrar.findUnique({ where: { id: cxc.id } });
    expect(Number(cxcFinal?.montoPagado)).toBe(60);
    const reconciliaciones = await prisma.reconciliacionVenta.count({
      where: { tenantId, prestamoCashId: prestamo.id },
    });
    expect(reconciliaciones).toBe(1);
  });

  it('pago concurrente con nueva deuda: el pago nunca se pierde y el cupo se decide serializado', async () => {
    const { tenantId, cuenta, tipoPago, prestamo, cxc, cliente } = await crearEscenario({
      limiteCredito: 100, deuda: 100, pagado: 0,
    });

    const pagar = AccountingCashOperationsMutationService.registerCashLoanPayment({
      input: { id: prestamo.id, monto: 60, cuentaId: cuenta.cuentaId, tipoPagoId: tipoPago.tipoId },
      user: managerUser('carrera-pago-c', tenantId),
    });

    const validarNuevaDeuda = prisma.$transaction(async (tx) => {
      const decision = await validarCreditoOrigen({
        tx,
        user: operadorSinOverride('carrera-credito-c', tenantId),
        tenantId,
        clienteId: cliente.clienteId,
        moneda: 'CUP',
        montoNuevo: 60,
        permiso: 'ventas.venta.credito-override',
      });
      return decision.exceeded;
    }).catch((error: { code?: string }) => error.code ?? 'OK');

    const [resultadoPago, resultadoCredito] = await Promise.all([pagar, validarNuevaDeuda]);

    // El pago siempre se confirma y queda registrado exactamente una vez.
    expect(resultadoPago).toBeTruthy();
    const cxcFinal = await prisma.cuentaPorCobrar.findUnique({ where: { id: cxc.id } });
    expect(Number(cxcFinal?.montoPagado)).toBe(60);

    // La decisión de cupo observó un saldo serializado: 100 → CREDITO_EXCEDIDO
    // (validó antes del pago) o 40 → cupo justo 100 aprobado (validó después).
    expect(['CREDITO_EXCEDIDO', false]).toContain(resultadoCredito);
    if (resultadoCredito === false) {
      // Validó tras el pago: el cupo restante exacto era 40+60=100 (límite justo).
      expect(Number(cxcFinal?.montoDeuda) - Number(cxcFinal?.montoPagado)).toBe(40);
    }

    const reconciliaciones = await prisma.reconciliacionVenta.count({
      where: { tenantId, prestamoCashId: prestamo.id },
    });
    expect(reconciliaciones).toBe(1);
  });
});
