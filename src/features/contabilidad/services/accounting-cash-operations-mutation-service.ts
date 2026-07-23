import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { calcularSaldoPendientePrestamo } from '@/lib/utils/prestamo-cash';
import {
  calcularSaldoPendienteDeuda,
  calcularTotalDeudaConInteres,
} from '@/lib/utils/deuda-cash';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireTenant } from '@/lib/services/tenant-scope';

function prestamosCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== 'false';
}

function deudasCashEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== 'false';
}

/**
 * @description Servicio compartido de mutaciones para préstamos/deudas cash reutilizable por web y mobile.
 */
export const AccountingCashOperationsMutationService = {
  async createCashLoan({
    input,
    user,
  }: {
    input: {
      clienteId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      tasaCambioAlCrear?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      cuentaBancariaId: string;
    };
    user: AuthenticatedUser;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);

    const cuentaOrigen = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: input.cuentaBancariaId },
      select: { cuentaId: true, saldo: true, isActive: true },
    });
    if (!cuentaOrigen || !cuentaOrigen.isActive) {
      throw new ActionError('Cuenta bancaria no encontrada o inactiva', 'VALIDATION_ERROR');
    }
    if (cuentaOrigen.saldo < input.montoCapital) {
      throw new ActionError(
        `Saldo insuficiente en la cuenta. Disponible: ${cuentaOrigen.saldo}`,
        'VALIDATION_ERROR',
      );
    }

    const tp =
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
      (await prisma.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }));
    if (!tp) {
      throw new ActionError(
        'No existe un tipo de pago válido para registrar el desembolso',
        'VALIDATION_ERROR',
      );
    }

    const prestamo = await prisma.$transaction(async (tx: any) => {
      await tx.cuentaBancaria.update({
        where: { cuentaId: input.cuentaBancariaId },
        data: { saldo: { decrement: input.montoCapital } },
      });

      const montoDeuda = input.tasaInteres
        ? Number((input.montoCapital * (1 + input.tasaInteres / 100)).toFixed(2))
        : input.montoCapital;

      const cxcData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cliente: { connect: { clienteId: input.clienteId } },
        montoDeuda,
        montoPagado: 0,
        tipoCuenta: 'PRESTAMO_CASH',
        estado: 'PENDIENTE',
      };
      if (input.fechaVencimiento) cxcData.fechaVencimiento = new Date(input.fechaVencimiento);

      const cxc = await tx.cuentaPorCobrar.create({ data: cxcData });

      const reconciliacionData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaBancariaId } },
        tipoPago: { connect: { tipoId: tp.tipoId } },
        monto: input.montoCapital,
        moneda: input.moneda || 'CUP',
        montoConvertido: input.tasaCambioAlCrear
          ? input.montoCapital * input.tasaCambioAlCrear
          : input.montoCapital,
        fechaReconciliacion: new Date(),
        observaciones:
          input.observaciones || `Desembolso de préstamo cash para cliente ${input.clienteId}`,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH_DESEMBOLSO',
      };
      if (input.tasaCambioAlCrear !== undefined) {
        reconciliacionData.tasaCambio = input.tasaCambioAlCrear;
      }

      await tx.reconciliacionVenta.create({ data: reconciliacionData });

      const prestamoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cliente: { connect: { clienteId: input.clienteId } },
        cuentaPorCobrar: { connect: { id: cxc.id } },
        montoCapital: input.montoCapital,
        moneda: input.moneda || 'CUP',
        createdById: user.userId,
        cuentaBancariaId: input.cuentaBancariaId,
      };
      if (input.tasaInteres !== undefined) prestamoData.tasaInteres = input.tasaInteres;
      if (input.tasaCambioAlCrear !== undefined) prestamoData.tasaCambioAlCrear = input.tasaCambioAlCrear;
      if (input.fechaVencimiento) prestamoData.fechaVencimiento = new Date(input.fechaVencimiento);
      if (input.observaciones) prestamoData.observaciones = input.observaciones;

      return tx.prestamoCash.create({
        data: prestamoData,
        include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
      });
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PRESTAMO_CASH',
      entidadId: prestamo.id,
      usuarioId: user.userId,
      detalles: {
        clienteId: input.clienteId,
        montoCapital: input.montoCapital,
        moneda: input.moneda || 'CUP',
      },
    });

    return prestamo;
  },

  async updateCashLoan({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const existing = await prisma.prestamoCash.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');

    const prestamo = await prisma.prestamoCash.update({
      where: { id: input.id },
      data: {
        ...(input.fechaVencimiento ? { fechaVencimiento: new Date(input.fechaVencimiento) } : {}),
        ...(input.tasaInteres !== undefined ? { tasaInteres: input.tasaInteres } : {}),
        ...(input.observaciones !== undefined ? { observaciones: input.observaciones } : {}),
      },
      include: { cliente: { select: { clienteId: true, nombre: true } }, cuentaPorCobrar: true },
    });

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'PRESTAMO_CASH',
      entidadId: input.id,
      usuarioId: user.userId,
      detalles: { cambios: { ...input } },
    });

    return prestamo;
  },

  async registerCashLoanPayment({
    input,
    user,
  }: {
    input: {
      id: string;
      monto: number;
      cuentaId: string;
      tipoPagoId: string;
      moneda?: string;
      tasaCambio?: number;
      observaciones?: string;
    };
    user: AuthenticatedUser;
  }) {
    if (!prestamosCashEnabled()) {
      throw new ActionError('Módulo de préstamos cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    const prestamo = await prisma.prestamoCash.findFirst({
      where: { id: input.id, deletedAt: null },
      include: { cuentaPorCobrar: true },
    });
    if (!prestamo) throw new ActionError('Préstamo no encontrado', 'NOT_FOUND');
    if (prestamo.estado === 'PAGADO' || prestamo.estado === 'CANCELADO') {
      throw new ActionError('El préstamo no admite más pagos', 'VALIDATION_ERROR');
    }

    const saldoPendiente = calcularSaldoPendientePrestamo(
      Number(prestamo.cuentaPorCobrar.montoDeuda),
      Number(prestamo.cuentaPorCobrar.montoPagado),
    );
    if (input.monto > saldoPendiente) {
      throw new ActionError(`El monto excede el saldo pendiente de ${saldoPendiente}`, 'VALIDATION_ERROR');
    }

    const resultado = await prisma.$transaction(async (tx: any) => {
      const pagoData: Record<string, unknown> = {
        tenant: { connect: { tenantId } },
        cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
        tipoPago: { connect: { tipoId: input.tipoPagoId } },
        prestamoCash: { connect: { id: prestamo.id } },
        monto: input.monto,
        moneda: input.moneda || prestamo.moneda,
        reconciliadoPor: user.userId,
        tipoReconciliacion: 'PRESTAMO_CASH',
      };
      if (input.tasaCambio != null) pagoData.tasaCambio = input.tasaCambio;
      if (input.observaciones != null) pagoData.observaciones = input.observaciones;

      const reconciliacion = await tx.reconciliacionVenta.create({ data: pagoData });
      await tx.cuentaBancaria.update({
        where: { cuentaId: input.cuentaId },
        data: { saldo: { increment: input.monto } },
      });
      const nuevoMontoPagado = Number((Number(prestamo.cuentaPorCobrar.montoPagado) + input.monto).toFixed(2));
      const totalDeuda = Number(prestamo.cuentaPorCobrar.montoDeuda);
      const nuevoSaldo = calcularSaldoPendientePrestamo(totalDeuda, nuevoMontoPagado);
      const nuevoEstadoCuenta = nuevoSaldo <= 0.01 ? 'PAGADA' : 'PARCIAL';
      await tx.cuentaPorCobrar.update({
        where: { id: prestamo.cuentaPorCobrarId },
        data: { montoPagado: nuevoMontoPagado, estado: nuevoEstadoCuenta },
      });
      if (nuevoEstadoCuenta === 'PAGADA') {
        await tx.prestamoCash.update({ where: { id: prestamo.id }, data: { estado: 'PAGADO' } });
      }
      return reconciliacion;
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PAGO_PRESTAMO',
      entidadId: resultado.reconciliacionId,
      usuarioId: user.userId,
      detalles: { prestamoId: prestamo.id, monto: input.monto, moneda: input.moneda || prestamo.moneda },
    });

    return resultado;
  },

  async createCashDebt({
    input,
    user,
  }: {
    input: {
      proveedorId: string;
      montoCapital: number;
      moneda?: string;
      tasaInteres?: number;
      fechaVencimiento?: string;
      observaciones?: string;
      comprobanteUrl?: string;
      cuentaBancariaId: string;
    };
    user: AuthenticatedUser;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    const totalDeuda = calcularTotalDeudaConInteres(input.montoCapital, input.tasaInteres);
    const proveedor = await prisma.vendor.findUnique({
      where: { vendorId: input.proveedorId },
      select: { nombre: true },
    });
    if (!proveedor) throw new ActionError('Proveedor no encontrado', 'NOT_FOUND');

    const deuda = await prisma.$transaction(async (tx: any) => {
      const tp =
        (await tx.tipoPago.findFirst({ where: { nombre: 'Transferencia', isActive: true, tenantId } })) ||
        (await tx.tipoPago.findFirst({ where: { nombre: 'Efectivo', isActive: true, tenantId } }));
      if (!tp) {
        throw new ActionError('No existe un tipo de pago válido para el desembolso de deuda', 'VALIDATION_ERROR');
      }

      await tx.cuentaBancaria.update({
        where: { cuentaId: input.cuentaBancariaId },
        data: { saldo: { increment: input.montoCapital } },
      });

      const lastDeuda = await tx.deudaCash.findFirst({ orderBy: { idNumerico: 'desc' }, select: { idNumerico: true } });
      const nextNum = (lastDeuda?.idNumerico ?? 0) + 1;

      const cxp = await tx.cuentaPorPagar.create({
        data: {
          tenantId,
          numeroFactura: `DC-${nextNum}`,
          proveedorId: input.proveedorId,
          proveedorNombre: proveedor.nombre,
          montoDeuda: totalDeuda,
          montoPagado: 0,
          saldoPendiente: totalDeuda,
          moneda: input.moneda || 'CUP',
          tipo: 'compra',
          tipoDeuda: 'DEUDA_CASH',
          estado: 'PENDIENTE',
          fechaVencimiento: input.fechaVencimiento ? new Date(input.fechaVencimiento) : undefined,
        },
      });

      await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: input.cuentaBancariaId } },
          tipoPago: { connect: { tipoId: tp.tipoId } },
          monto: input.montoCapital,
          moneda: input.moneda || 'CUP',
          montoConvertido: input.montoCapital,
          fechaReconciliacion: new Date(),
          observaciones:
            input.observaciones || `Desembolso de deuda cash para proveedor ${input.proveedorId}`,
          reconciliadoPor: user.userId,
          tipoReconciliacion: 'DEUDA_CASH_DESEMBOLSO',
        },
      });

      return tx.deudaCash.create({
        data: {
          tenantId,
          proveedorId: input.proveedorId,
          cuentaPorPagarId: cxp.cuentaPorPagarId,
          montoCapital: input.montoCapital,
          moneda: input.moneda || 'CUP',
          tasaInteres: input.tasaInteres,
          fechaVencimiento: input.fechaVencimiento ? new Date(input.fechaVencimiento) : undefined,
          observaciones: input.observaciones,
          comprobanteUrl: input.comprobanteUrl,
          cuentaBancariaId: input.cuentaBancariaId,
          createdById: user.userId,
        },
        include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
      });
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'DEUDA_CASH',
      entidadId: deuda.id,
      usuarioId: user.userId,
      detalles: { proveedorId: input.proveedorId, montoCapital: input.montoCapital, moneda: input.moneda || 'CUP' },
    });

    return deuda;
  },

  async updateCashDebt({ input, user }: { input: { id: string; fechaVencimiento?: string; tasaInteres?: number; observaciones?: string }; user: AuthenticatedUser }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const existing = await prisma.deudaCash.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');

    const deuda = await prisma.deudaCash.update({
      where: { id: input.id },
      data: {
        ...(input.fechaVencimiento ? { fechaVencimiento: new Date(input.fechaVencimiento) } : {}),
        ...(input.tasaInteres !== undefined ? { tasaInteres: input.tasaInteres } : {}),
        ...(input.observaciones !== undefined ? { observaciones: input.observaciones } : {}),
      },
      include: { proveedor: { select: { vendorId: true, nombre: true } }, cuentaPorPagar: true },
    });

    await AuditLogService.log({
      accion: 'UPDATE',
      entidad: 'DEUDA_CASH',
      entidadId: input.id,
      usuarioId: user.userId,
      detalles: { cambios: { ...input } },
    });

    return deuda;
  },

  async registerCashDebtPayment({
    input,
    user,
  }: {
    input: {
      id: string;
      monto: number;
      cuentaId: string;
      tipoPagoId: string;
      moneda?: string;
      tasaCambio?: number;
      observaciones?: string;
    };
    user: AuthenticatedUser;
  }) {
    if (!deudasCashEnabled()) {
      throw new ActionError('Módulo de deudas cash deshabilitado', 'DISABLED');
    }

    const tenantId = requireTenant(user);
    const deuda = await prisma.deudaCash.findFirst({
      where: { id: input.id, deletedAt: null },
      include: { cuentaPorPagar: true },
    });
    if (!deuda) throw new ActionError('Deuda no encontrada', 'NOT_FOUND');
    if (deuda.estado === 'PAGADO' || deuda.estado === 'CANCELADO') {
      throw new ActionError('La deuda no admite más pagos', 'VALIDATION_ERROR');
    }

    const saldoPendiente = calcularSaldoPendienteDeuda(
      Number(deuda.cuentaPorPagar.montoDeuda),
      Number(deuda.cuentaPorPagar.montoPagado),
    );
    if (input.monto > saldoPendiente) {
      throw new ActionError(`El monto excede el saldo pendiente de ${saldoPendiente}`, 'VALIDATION_ERROR');
    }

    const resultado = await prisma.$transaction(async (tx: any) => {
      const reconciliacion = await tx.reconciliacionVenta.create({
        data: {
          tenant: { connect: { tenantId } },
          cuentaBancaria: { connect: { cuentaId: input.cuentaId } },
          tipoPago: { connect: { tipoId: input.tipoPagoId } },
          monto: input.monto,
          moneda: input.moneda || deuda.moneda,
          ...(input.tasaCambio != null && { tasaCambio: input.tasaCambio }),
          ...(input.observaciones != null && { observaciones: input.observaciones }),
          reconciliadoPor: user.userId,
          deudaCash: { connect: { id: deuda.id } },
          tipoReconciliacion: 'DEUDA_CASH',
        },
      });
      await tx.cuentaBancaria.update({
        where: { cuentaId: input.cuentaId },
        data: { saldo: { decrement: input.monto } },
      });
      const nuevoMontoPagado = Number((Number(deuda.cuentaPorPagar.montoPagado) + input.monto).toFixed(2));
      const totalDeuda = Number(deuda.cuentaPorPagar.montoDeuda);
      const nuevoSaldoPendiente = calcularSaldoPendienteDeuda(totalDeuda, nuevoMontoPagado);
      const nuevoEstadoCuenta = nuevoSaldoPendiente <= 0.01 ? 'PAGADA' : 'PARCIAL';
      await tx.cuentaPorPagar.update({
        where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
        data: {
          montoPagado: nuevoMontoPagado,
          saldoPendiente: nuevoSaldoPendiente,
          estado: nuevoEstadoCuenta,
        },
      });
      if (nuevoEstadoCuenta === 'PAGADA') {
        await tx.deudaCash.update({ where: { id: deuda.id }, data: { estado: 'PAGADO' } });
      }
      return reconciliacion;
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'PAGO_DEUDA',
      entidadId: resultado.reconciliacionId,
      usuarioId: user.userId,
      detalles: { deudaId: deuda.id, monto: input.monto, moneda: input.moneda || deuda.moneda },
    });

    return resultado;
  },
};
