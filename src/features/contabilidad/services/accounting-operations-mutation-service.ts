import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

const validateBankTransferSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Cuenta origen es requerida'),
  cuentaDestinoId: z.string().min(1, 'Cuenta destino es requerida'),
  monto: z.number().positive('El monto debe ser positivo'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
});

const createBankTransferSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Cuenta origen es requerida'),
  cuentaDestinoId: z.string().min(1, 'Cuenta destino es requerida'),
  montoOrigen: z.number().positive('El monto debe ser positivo'),
  montoDestino: z.number().positive('El monto debe ser positivo').optional(),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
  tasaCambio: z.number().positive().optional(),
  monedaPrincipal: z.string().optional(),
});

const createBankAdjustmentSchema = z.object({
  cuentaId: z.string().min(1, 'ID de cuenta es requerido'),
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  moneda: z.string().min(1, 'Moneda es requerida').default('CUP'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  motivo: z.string().min(1, 'Motivo es obligatorio'),
  tasaCambio: z.number().positive().optional(),
  fechaOperacion: z.coerce.date().optional(),
});

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const createCapitalInjectionSchema = z.object({
  montoRecibido: z.coerce.number().positive(),
  moneda: z.string().trim().min(1).default('CUP').transform((value) => value.toUpperCase()),
  tipo: z.enum(['CAPITAL_SOCIAL', 'DEUDA_EXTERNA']),
  cuentaId: z.string().min(1),
  descripcion: optionalText,
  socio: optionalText,
  entidadPrestamista: optionalText,
  tasaInteres: z.coerce.number().min(0).optional(),
  plazoMeses: z.coerce.number().int().positive().optional(),
  fechaInicioPago: z.coerce.date().optional(),
  fechaOperacion: z.coerce.date().optional(),
}).superRefine((input, ctx) => {
  if (input.tipo === 'CAPITAL_SOCIAL' && !input.socio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['socio'],
      message: 'El nombre del socio es requerido para Capital Social',
    });
  }
  if (input.tipo === 'DEUDA_EXTERNA' && !input.entidadPrestamista) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['entidadPrestamista'],
      message: 'La entidad prestamista es requerida para Deuda Externa',
    });
  }
});

const registerCapitalPaymentSchema = z.object({
  inyeccionId: z.string().min(1),
  monto: z.coerce.number().positive(),
  cuentaBancariaId: z.string().min(1),
  tipoPagoId: z.string().min(1),
  observaciones: z.string().optional(),
});

/**
 * @description Shared mutation service for accounting operations used by web and mobile adapters.
 */
export const AccountingOperationsMutationService = {
  async validateBankTransfer(input: z.infer<typeof validateBankTransferSchema>) {
    const parsed = validateBankTransferSchema.parse(input);

    if (parsed.cuentaOrigenId === parsed.cuentaDestinoId) {
      throw new ActionError('La cuenta origen y destino deben ser diferentes', 'VALIDATION_ERROR');
    }

    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: parsed.cuentaOrigenId },
        select: {
          cuentaId: true,
          nombreBanco: true,
          numeroCuenta: true,
          saldo: true,
          moneda: true,
          isActive: true,
        },
      }),
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: parsed.cuentaDestinoId },
        select: {
          cuentaId: true,
          nombreBanco: true,
          numeroCuenta: true,
          saldo: true,
          moneda: true,
          isActive: true,
        },
      }),
    ]);

    if (!cuentaOrigen) {
      throw new ActionError('Cuenta origen no encontrada', 'NOT_FOUND');
    }
    if (!cuentaOrigen.isActive) {
      throw new ActionError('La cuenta origen no está activa', 'VALIDATION_ERROR');
    }
    if (!cuentaDestino) {
      throw new ActionError('Cuenta destino no encontrada', 'NOT_FOUND');
    }
    if (!cuentaDestino.isActive) {
      throw new ActionError('La cuenta destino no está activa', 'VALIDATION_ERROR');
    }

    const advertencias: string[] = [];
    const saldoNumerico = Number(cuentaOrigen.saldo);
    const saldoSuficiente = saldoNumerico >= parsed.monto;

    if (!saldoSuficiente) {
      advertencias.push(
        `Saldo insuficiente. Disponible: ${saldoNumerico} ${cuentaOrigen.moneda}`,
      );
    }

    const saldoRestante = saldoNumerico - parsed.monto;
    const porcentajeRestante = (saldoRestante / saldoNumerico) * 100;
    if (porcentajeRestante < 20 && saldoRestante > 0) {
      advertencias.push(
        `El saldo restante será bajo: ${saldoRestante.toFixed(2)} ${cuentaOrigen.moneda}`,
      );
    }

    if (cuentaOrigen.moneda !== cuentaDestino.moneda) {
      advertencias.push('Esta transferencia requiere confirmación de tasa de cambio');
    }

    return { saldoSuficiente, advertencias };
  },

  async createBankTransfer({
    input,
    user,
  }: {
    input: z.infer<typeof createBankTransferSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createBankTransferSchema.parse(input);
    const tenantId = requireTenant(user);

    if (parsed.cuentaOrigenId === parsed.cuentaDestinoId) {
      throw new ActionError('La cuenta origen y destino deben ser diferentes', 'VALIDATION_ERROR');
    }

    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({ where: { cuentaId: parsed.cuentaOrigenId } }),
      prisma.cuentaBancaria.findUnique({ where: { cuentaId: parsed.cuentaDestinoId } }),
    ]);

    if (!cuentaOrigen) {
      throw new ActionError('Cuenta origen no encontrada', 'NOT_FOUND');
    }
    if (!cuentaDestino) {
      throw new ActionError('Cuenta destino no encontrada', 'NOT_FOUND');
    }
    if (!cuentaOrigen.isActive) {
      throw new ActionError('La cuenta origen no está activa', 'VALIDATION_ERROR');
    }
    if (!cuentaDestino.isActive) {
      throw new ActionError('La cuenta destino no está activa', 'VALIDATION_ERROR');
    }
    if (Number(cuentaOrigen.saldo) < parsed.montoOrigen) {
      throw new ActionError('Saldo insuficiente en la cuenta origen', 'VALIDATION_ERROR');
    }

    let montoDestino = parsed.montoDestino || parsed.montoOrigen;
    let tasaCambioFinal = parsed.tasaCambio;

    if (cuentaOrigen.moneda !== cuentaDestino.moneda || cuentaDestino.moneda !== 'CUP') {
      if (!parsed.tasaCambio) {
        throw new ActionError(
          'Tasa de cambio requerida para transferencias entre diferentes monedas',
          'VALIDATION_ERROR',
        );
      }
      montoDestino = parsed.montoOrigen * parsed.tasaCambio;
      tasaCambioFinal = parsed.tasaCambio;
    }

    const lastTransferencia = await prisma.transferenciaBancaria.findFirst({
      orderBy: { numeroComprobante: 'desc' },
      select: { numeroComprobante: true },
    });

    let nextNumber = 1;
    if (lastTransferencia?.numeroComprobante) {
      const lastNumber = Number.parseInt(lastTransferencia.numeroComprobante.replace(/\D/g, ''), 10);
      nextNumber = lastNumber + 1;
    }
    const numeroComprobante = `TRF-${nextNumber.toString().padStart(6, '0')}`;

    const transferencia = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaOrigenId },
        data: { saldo: { decrement: parsed.montoOrigen } },
      });
      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaDestinoId },
        data: { saldo: { increment: montoDestino } },
      });

      return tx.transferenciaBancaria.create({
        data: {
          numeroComprobante,
          cuentaOrigen: { connect: { cuentaId: parsed.cuentaOrigenId } },
          cuentaDestino: { connect: { cuentaId: parsed.cuentaDestinoId } },
          tenant: { connect: { tenantId } },
          montoOrigen: parsed.montoOrigen,
          monedaOrigen: cuentaOrigen.moneda,
          montoDestino,
          monedaDestino: cuentaDestino.moneda,
          tasaCambio: tasaCambioFinal,
          motivo: parsed.motivo,
          descripcion: parsed.descripcion,
          comprobanteGenerado: true,
        },
        include: {
          cuentaOrigen: {
            select: { nombreBanco: true, numeroCuenta: true, moneda: true },
          },
          cuentaDestino: {
            select: { nombreBanco: true, numeroCuenta: true, moneda: true },
          },
        },
      });
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'TRANSFERENCIA',
      entidadId: transferencia.transferenciaId,
      usuarioId: user.userId,
      detalles: {
        numeroComprobante: transferencia.numeroComprobante,
        cuentaOrigen: transferencia.cuentaOrigen.nombreBanco,
        cuentaDestino: transferencia.cuentaDestino.nombreBanco,
        montoOrigen: Number(transferencia.montoOrigen),
        monedaOrigen: transferencia.monedaOrigen,
        montoDestino: Number(transferencia.montoDestino),
        monedaDestino: transferencia.monedaDestino,
        motivo: transferencia.motivo,
      },
    });

    return {
      transferencia: {
        ...transferencia,
        montoOrigen: Number(transferencia.montoOrigen),
        montoDestino: Number(transferencia.montoDestino),
        tasaCambio: transferencia.tasaCambio ? Number(transferencia.tasaCambio) : null,
      },
      numeroComprobante,
    };
  },

  async createBankAdjustment({
    input,
    user,
  }: {
    input: z.infer<typeof createBankAdjustmentSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createBankAdjustmentSchema.parse(input);
    const tenantId = requireTenant(user);

    const cuenta = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: parsed.cuentaId } });
    if (!cuenta) {
      throw new ActionError('Cuenta bancaria no encontrada', 'CUENTA_NO_ENCONTRADA');
    }
    if (!cuenta.isActive) {
      throw new ActionError('La cuenta bancaria está inactiva', 'CUENTA_INACTIVA');
    }

    const montoAjuste = parsed.tipo === 'ingreso' ? parsed.monto : -parsed.monto;
    const nuevoSaldo = Number(cuenta.saldo) + montoAjuste;
    const saldoNegativo = nuevoSaldo < 0;

    const resultado = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);
      const ajuste = await tx.ajusteBancario.create({
        data: {
          cuentaBancaria: { connect: { cuentaId: parsed.cuentaId } },
          tipo: parsed.tipo,
           monto: parsed.monto,
           moneda: parsed.moneda,
           tasaCambio: parsed.moneda.toUpperCase() === 'CUP' ? 1 : parsed.tasaCambio,
           montoConvertido: parsed.moneda.toUpperCase() === 'CUP'
             ? parsed.monto
             : parsed.tasaCambio ? parsed.monto * parsed.tasaCambio : null,
           descripcion: parsed.descripcion,
          motivo: parsed.motivo,
          realizadoPor: user.userId,
          fechaOperacion: parsed.fechaOperacion ?? new Date(),
          tenant: { connect: { tenantId } },
        },
      });

      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaId },
        data: { saldo: nuevoSaldo },
      });

      return ajuste;
    });

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'AJUSTE_BANCARIO',
      entidadId: resultado.ajusteId,
      usuarioId: user.userId,
      detalles: {
        tipo: parsed.tipo,
        monto: parsed.monto,
        moneda: parsed.moneda,
        cuenta: cuenta.nombreBanco,
        motivo: parsed.motivo,
        saldoAnterior: Number(cuenta.saldo),
        saldoNuevo: nuevoSaldo,
      },
    });

    return {
      ajuste: resultado,
      saldoAnterior: Number(cuenta.saldo),
      saldoNuevo: nuevoSaldo,
      advertenciaSaldoNegativo: saldoNegativo,
      message: saldoNegativo
        ? 'Ajuste creado exitosamente. ADVERTENCIA: El saldo de la cuenta es negativo.'
        : 'Ajuste bancario creado exitosamente',
    };
  },

  async createCapitalInjection({
    input,
    user,
  }: {
    input: z.input<typeof createCapitalInjectionSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = createCapitalInjectionSchema.parse(input);
    const tenantId = requireTenant(user);

    const inyeccion = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaId, tenantId },
        select: {
          cuentaId: true,
          saldo: true,
          moneda: true,
          isActive: true,
        },
      });

      if (!cuenta) {
        throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
      }
      if (!cuenta.isActive) {
        throw new ActionError('La cuenta bancaria está inactiva', 'VALIDATION_ERROR');
      }
      if (cuenta.moneda.toUpperCase() !== parsed.moneda) {
        throw new ActionError(
          'La moneda de la inyección debe coincidir con la moneda de la cuenta',
          'VALIDATION_ERROR',
        );
      }

      const isDebt = parsed.tipo === 'DEUDA_EXTERNA';
      const montoInteres = isDebt
        ? parsed.montoRecibido * ((parsed.tasaInteres ?? 0) / 100)
        : null;
      const montoTotalDeuda = isDebt ? parsed.montoRecibido + (montoInteres ?? 0) : null;

      const created = await tx.inyeccionCapital.create({
        data: {
          montoRecibido: parsed.montoRecibido,
          moneda: parsed.moneda,
          tipo: parsed.tipo,
          cuentaId: parsed.cuentaId,
          descripcion: parsed.descripcion,
          socio: isDebt ? null : parsed.socio,
          entidadPrestamista: isDebt ? parsed.entidadPrestamista : null,
          tasaInteres: isDebt ? parsed.tasaInteres ?? 0 : null,
          montoInteres,
          montoTotalDeuda,
          saldoPendiente: montoTotalDeuda,
          plazoMeses: isDebt ? parsed.plazoMeses : null,
          fechaInicioPago: isDebt ? parsed.fechaInicioPago : null,
          fechaRegistro: parsed.fechaOperacion ?? new Date(),
          estado: isDebt ? 'ACTIVA' : null,
        },
      });

      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaId },
        data: { saldo: { increment: parsed.montoRecibido } },
      });

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'INYECCION_CAPITAL',
        entidadId: created.id,
        usuarioId: user.userId,
        detalles: {
          montoRecibido: parsed.montoRecibido,
          moneda: parsed.moneda,
          tipo: parsed.tipo,
          cuentaId: parsed.cuentaId,
        },
      }, tx);

      return created;
    });

    return inyeccion;
  },

  async registerCapitalPayment({
    input,
    user,
  }: {
    input: z.infer<typeof registerCapitalPaymentSchema>;
    user: AuthenticatedUser;
  }) {
    const parsed = registerCapitalPaymentSchema.parse(input);
    const tenantId = requireTenant(user);

    const pago = await prisma.$transaction(async (tx: any) => {
      await acquireAccountingTenantLock(tx, tenantId);

      // InyeccionCapital no tiene tenantId: se escopa por la cuenta bancaria referenciada.
      const inyeccion = await tx.inyeccionCapital.findFirst({
        where: { id: parsed.inyeccionId, cuentaBancaria: { tenantId } },
        select: { id: true, tipo: true, saldoPendiente: true, pagos: { select: { id: true } } },
      });

      if (!inyeccion) {
        throw new ActionError('Inyección de capital no encontrada', 'NOT_FOUND');
      }
      if (inyeccion.tipo !== 'DEUDA_EXTERNA') {
        throw new ActionError('Solo las deudas externas admiten pagos', 'VALIDATION_ERROR');
      }

      const cuenta = await tx.cuentaBancaria.findFirst({
        where: { cuentaId: parsed.cuentaBancariaId, tenantId },
        select: { cuentaId: true, isActive: true },
      });
      if (!cuenta) {
        throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
      }
      if (!cuenta.isActive) {
        throw new ActionError('La cuenta bancaria está inactiva', 'VALIDATION_ERROR');
      }

      const saldoPendiente = Number(inyeccion.saldoPendiente ?? 0);
      if (parsed.monto > saldoPendiente) {
        throw new ActionError('El pago excede el saldo pendiente de la deuda', 'VALIDATION_ERROR');
      }

      // PagoDeuda no tiene columna de tipo de pago: se acepta `tipoPagoId` para
      // mantener el contrato web/móvil, pero sólo se persisten las columnas reales.
      const created = await tx.pagoDeuda.create({
        data: {
          inyeccionId: parsed.inyeccionId,
          montoPagado: parsed.monto,
          cuentaId: parsed.cuentaBancariaId,
          numeroCuota: inyeccion.pagos.length + 1,
          observaciones: parsed.observaciones,
        },
      });

      await tx.cuentaBancaria.update({
        where: { cuentaId: parsed.cuentaBancariaId },
        data: { saldo: { decrement: parsed.monto } },
      });

      await tx.inyeccionCapital.update({
        where: { id: parsed.inyeccionId },
        data: {
          saldoPendiente: { decrement: parsed.monto },
          ...(parsed.monto >= saldoPendiente ? { estado: 'PAGADA' as const } : {}),
        },
      });

      await AuditLogService.logStrict({
        accion: 'CREATE',
        entidad: 'PAGO_DEUDA',
        entidadId: created.id,
        usuarioId: user.userId,
        detalles: { inyeccionId: parsed.inyeccionId, monto: parsed.monto, cuentaId: parsed.cuentaBancariaId },
      }, tx);

      return created;
    });

    return pago;
  },
};
