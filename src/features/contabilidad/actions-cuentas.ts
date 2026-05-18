/**
 * @description Server Actions para Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP).
 *
 * Reemplaza los handlers HTTP actuales con acciones tipadas seguras
 * que aplican `requireTenant()`, validación Zod, y paginación server-side.
 *
 * @module features/contabilidad/actions-cuentas
 */
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { applyPagoGastoWorkflow, isGastoWorkflowError } from '@/lib/services/pago-gastos-workflow';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  getCuentasPorCobrarSchema,
  createCuentaPorCobrarSchema,
  updateCuentaPorCobrarSchema,
  getCuentasPorPagarSchema,
  createCuentaPorPagarSchema,
  pagarCuentaPorPagarSchema,
} from './schemas-cuentas';
import type {
  GetCuentasPorCobrarInput,
  CreateCuentaPorCobrarInput,
  UpdateCuentaPorCobrarInput,
  GetCuentasPorPagarInput,
  CreateCuentaPorPagarInput,
  PagarCuentaPorPagarInput,
} from './schemas-cuentas';

// ═══════════════════════════════════════════════════════════
// Tipos de Resultado
// ═══════════════════════════════════════════════════════════

/** Cuenta por Cobrar con cálculos enriquecidos. */
export interface CuentaPorCobrarEnriquecida {
  id: string;
  idCC: number;
  facturaId: string | null;
  numeroFactura: string | null;
  clienteId: string;
  montoDeuda: number;
  montoPagado: number;
  idTransferencia: string | null;
  estado: 'PENDIENTE' | 'PAGADA' | 'PARCIAL';
  tipoCuenta: string | null;
  fechaVencimiento: string | null;
  totalFactura: number;
  totalPagadoFactura: number;
  saldoFactura: number;
  moneda: string;
  cliente: { clienteId: string; nombre: string } | null;
  factura: Record<string, unknown> | null;
  prestamoCash: Record<string, unknown> | null;
  _reconciliaciones: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GetCuentasPorCobrarResult {
  cuentas: CuentaPorCobrarEnriquecida[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Cuenta por Pagar con antigüedad calculada. */
export interface CuentaPorPagarEnriquecida {
  cuentaPorPagarId: string;
  numeroFactura: string;
  tipo: 'compra' | 'servicio';
  gastoCompraId: string | null;
  gastosDEId: string | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  montoDeuda: number;
  montoPagado: number;
  saldoPendiente: number;
  moneda: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  estado: 'PENDIENTE' | 'PAGADA' | 'PARCIAL';
  tipoDeuda: string | null;
  rangoAntiguedad: string;
  diasTranscurridos: number;
  proveedor: {
    vendorId: string; nombre: string;
    cuentaCUP: string | null; cuentaUSD: string | null;
  } | null;
  pagos: Array<{
    pagoCuentaPorPagarId: string; monto: number;
    numeroTransaccion: string; cuentaProveedor: string;
    fechaPago: Date; observaciones: string | null;
  }>;
  deudaCash: { id: string; idNumerico: number; montoCapital: number; moneda: string; estado: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetCuentasPorPagarResult {
  cuentas: CuentaPorPagarEnriquecida[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface PagarCuentaPorPagarResult {
  cuenta: CuentaPorPagarEnriquecida;
  pago: { pagoCuentaPorPagarId: string; numeroTransaccion: string; monto: number };
}

// ═══════════════════════════════════════════════════════════
// Selects reutilizables
// ═══════════════════════════════════════════════════════════

const CXC_INCLUDE = {
  cliente: { select: { clienteId: true, nombre: true } },
  factura: {
    select: {
      idFactura: true, total: true, numeroFactura: true, createdAt: true,
      venta: {
        select: {
          ventaId: true, total: true,
          reconciliaciones: {
            select: {
              reconciliacionId: true, monto: true, moneda: true,
              tasaCambio: true, idTransferencia: true,
              fechaReconciliacion: true,
              tipoPago: { select: { nombre: true } },
              cuentaBancaria: { select: { nombreBanco: true } },
            },
          },
          cliente: { select: { nombre: true } },
        },
      },
    },
  },
  prestamoCash: {
    select: {
      id: true, idNumerico: true, montoCapital: true,
      moneda: true, tasaCambioAlCrear: true,
      observaciones: true, estado: true,
    },
  },
} as const;

const CXP_INCLUDE = {
  proveedor: {
    select: {
      vendorId: true, nombre: true,
      cuentaCUP: true, cuentaUSD: true,
    },
  },
  pagos: {
    select: {
      pagoCuentaPorPagarId: true, monto: true,
      numeroTransaccion: true, cuentaProveedor: true,
      fechaPago: true, observaciones: true,
    },
    orderBy: { fechaPago: 'desc' as const },
  },
  deudaCash: {
    select: { id: true, idNumerico: true, montoCapital: true, moneda: true, estado: true },
  },
} as const;

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function normalizarMontoReconciliacion(
  monto: number, moneda: string, tasaCambio: number | null,
): number {
  if (moneda === 'USD' && tasaCambio && Number.isFinite(Number(tasaCambio)) && Number(tasaCambio) > 0) {
    return monto * Number(tasaCambio);
  }
  return monto;
}

function enriquecerCuentaPorCobrar(cuenta: Record<string, unknown>): CuentaPorCobrarEnriquecida {
  const facturaRecord = cuenta.factura as Record<string, unknown> | null;
  const ventaRecord = facturaRecord?.venta as Record<string, unknown> | undefined;
  const recs = (ventaRecord?.reconciliaciones ?? []) as Array<{
    monto: number; moneda: string; tasaCambio: number | null;
  }>;

  const totalPagadoFactura = recs.length > 0
    ? recs.reduce(
        (sum, rec) => sum + normalizarMontoReconciliacion(Number(rec.monto), rec.moneda, rec.tasaCambio), 0,
      )
    : Number(cuenta.montoPagado ?? 0);

  const totalFactura = facturaRecord?.total
    ? Number(facturaRecord.total)
    : Number(cuenta.montoDeuda ?? 0);
  const saldoFactura = Math.max(0, totalFactura - totalPagadoFactura);

  return {
    id: cuenta.id as string,
    idCC: cuenta.idCC as number,
    facturaId: cuenta.facturaId as string | null,
    numeroFactura: cuenta.numeroFactura as string | null,
    clienteId: cuenta.clienteId as string,
    montoDeuda: Number(cuenta.montoDeuda),
    montoPagado: Number(cuenta.montoPagado),
    idTransferencia: cuenta.idTransferencia as string | null,
    estado: cuenta.estado as 'PENDIENTE' | 'PAGADA' | 'PARCIAL',
    tipoCuenta: cuenta.tipoCuenta as string | null,
    fechaVencimiento: cuenta.fechaVencimiento as string | null,
    totalFactura,
    totalPagadoFactura,
    saldoFactura,
    moneda: cuenta.moneda as string,
    cliente: cuenta.cliente as { clienteId: string; nombre: string } | null,
    factura: facturaRecord
      ? {
          ...facturaRecord,
          total: Number(facturaRecord.total),
          venta: (facturaRecord.venta as Record<string, unknown> | null)
            ? {
                ...(facturaRecord.venta as Record<string, unknown>),
                total: Number((facturaRecord.venta as Record<string, unknown>).total),
              }
            : null,
        }
      : null,
    prestamoCash: cuenta.prestamoCash as Record<string, unknown> | null,
    _reconciliaciones: recs as Record<string, unknown>[],
    createdAt: cuenta.createdAt as Date,
    updatedAt: cuenta.updatedAt as Date,
  };
}

function computeAging(fecha: Date): { rangoAntiguedad: string; diasTranscurridos: number } {
  const now = new Date();
  const diffMs = now.getTime() - fecha.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let rango: string;
  if (dias <= 30) rango = '0-30';
  else if (dias <= 60) rango = '31-60';
  else if (dias <= 90) rango = '61-90';
  else rango = '90+';
  return { rangoAntiguedad: rango, diasTranscurridos: dias };
}

function enriquecerCuentaPorPagar(cuenta: Record<string, unknown>): CuentaPorPagarEnriquecida {
  const fechaEmision = cuenta.fechaEmision ? new Date(cuenta.fechaEmision as string) : new Date();
  const aging = isNaN(fechaEmision.getTime())
    ? { rangoAntiguedad: '0-30', diasTranscurridos: 0 }
    : computeAging(fechaEmision);
  const pagos = (cuenta.pagos as Array<Record<string, unknown>> | undefined) ?? [];

  return {
    cuentaPorPagarId: cuenta.cuentaPorPagarId as string,
    numeroFactura: cuenta.numeroFactura as string,
    tipo: cuenta.tipo as 'compra' | 'servicio',
    gastoCompraId: cuenta.gastoCompraId as string | null,
    gastosDEId: cuenta.gastosDEId as string | null,
    proveedorId: cuenta.proveedorId as string | null,
    proveedorNombre: cuenta.proveedorNombre as string | null,
    montoDeuda: Number(cuenta.montoDeuda),
    montoPagado: Number(cuenta.montoPagado),
    saldoPendiente: Number(cuenta.saldoPendiente),
    moneda: cuenta.moneda as string,
    fechaEmision: (cuenta.fechaEmision as Date).toISOString(),
    fechaVencimiento: cuenta.fechaVencimiento ? (cuenta.fechaVencimiento as Date).toISOString() : null,
    estado: cuenta.estado as 'PENDIENTE' | 'PAGADA' | 'PARCIAL',
    tipoDeuda: cuenta.tipoDeuda as string | null,
    rangoAntiguedad: aging.rangoAntiguedad,
    diasTranscurridos: aging.diasTranscurridos,
    proveedor: cuenta.proveedor as CuentaPorPagarEnriquecida['proveedor'],
    pagos: pagos.map((p) => ({
      pagoCuentaPorPagarId: p.pagoCuentaPorPagarId as string,
      monto: Number(p.monto),
      numeroTransaccion: p.numeroTransaccion as string,
      cuentaProveedor: p.cuentaProveedor as string,
      fechaPago: p.fechaPago as Date,
      observaciones: p.observaciones as string | null,
    })),
    deudaCash: cuenta.deudaCash as CuentaPorPagarEnriquecida['deudaCash'],
    createdAt: cuenta.createdAt as Date,
    updatedAt: cuenta.updatedAt as Date,
  };
}

// ═══════════════════════════════════════════════════════════
// Cuentas por Cobrar
// ═══════════════════════════════════════════════════════════

/**
 * @description Lista cuentas por cobrar con filtros, paginación y tenant isolation.
 * Calcula totalPagadoFactura/saldoFactura normalizando pagos multi-moneda.
 */
export const getCuentasPorCobrarAction = withAction(
  async (input: GetCuentasPorCobrarInput, user: AuthenticatedUser): Promise<GetCuentasPorCobrarResult> => {
    const tenantId = requireTenant(user);
    const f = getCuentasPorCobrarSchema.parse(input);

    const where: Record<string, unknown> = { tenantId };
    if (f.estado) where.estado = f.estado;
    if (f.clienteId) where.clienteId = f.clienteId;

    const skip = (f.page - 1) * f.limit;

    const [cuentasRaw, total] = await Promise.all([
      prisma.cuentaPorCobrar.findMany({
        where,
        include: CXC_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: f.limit,
      }),
      prisma.cuentaPorCobrar.count({ where }),
    ]);

    const cuentas = cuentasRaw.map((c) =>
      enriquecerCuentaPorCobrar(c as unknown as Record<string, unknown>),
    );

    return {
      cuentas,
      pagination: { page: f.page, limit: f.limit, total, totalPages: Math.ceil(total / f.limit) },
    };
  },
);

/**
 * @description Crea una nueva cuenta por cobrar vinculada a una venta.
 */
export const createCuentaPorCobrarAction = withAction(
  async (input: CreateCuentaPorCobrarInput, user: AuthenticatedUser): Promise<CuentaPorCobrarEnriquecida> => {
    const tenantId = requireTenant(user);
    const p = createCuentaPorCobrarSchema.parse(input);

    const venta = await prisma.venta.findFirst({
      where: { ventaId: p.ventaId, tenantId },
      select: { ventaId: true },
    });
    if (!venta) throw new ActionError('Venta no encontrada o no pertenece al tenant', 'NOT_FOUND');

    const existente = await prisma.cuentaPorCobrar.findFirst({
      where: { facturaId: p.ventaId, tenantId },
    });
    if (existente) throw new ActionError('Ya existe una cuenta por cobrar para esta venta', 'DUPLICATE');

    const cuenta = await prisma.cuentaPorCobrar.create({
      data: {
        tenantId,
        clienteId: p.clienteId,
        montoDeuda: p.monto,
        montoPagado: 0,
  // @ts-expect-error
        moneda: p.moneda,
        estado: 'PENDIENTE',
        facturaId: p.ventaId,
        numeroFactura: p.numeroFactura ?? null,
        fechaVencimiento: p.fechaVencimiento ? new Date(p.fechaVencimiento) : null,
      },
      include: CXC_INCLUDE,
    });

    revalidatePath('/busy/contabilidad/cuentas-por-cobrar');
    return enriquecerCuentaPorCobrar(cuenta as unknown as Record<string, unknown>);
  },
);

/**
 * @description Actualiza una cuenta por cobrar existente con tenant isolation.
 */
export const updateCuentaPorCobrarAction = withAction(
  async (input: UpdateCuentaPorCobrarInput, user: AuthenticatedUser): Promise<CuentaPorCobrarEnriquecida> => {
    const tenantId = requireTenant(user);
    const p = updateCuentaPorCobrarSchema.parse(input);

    const existente = await prisma.cuentaPorCobrar.findFirst({ where: { id: p.id, tenantId } });
    if (!existente) throw new ActionError('Cuenta por cobrar no encontrada', 'NOT_FOUND');

    const data: Record<string, unknown> = {};
    if (p.estado !== undefined) data.estado = p.estado;
    if (p.montoDeuda !== undefined) data.montoDeuda = p.montoDeuda;
    if (p.montoPagado !== undefined) data.montoPagado = p.montoPagado;
    if (p.idTransferencia !== undefined) data.idTransferencia = p.idTransferencia;
    if (p.fechaVencimiento !== undefined)
      data.fechaVencimiento = p.fechaVencimiento ? new Date(p.fechaVencimiento) : null;

    const cuenta = await prisma.cuentaPorCobrar.update({
      where: { id: p.id },
      data,
      include: CXC_INCLUDE,
    });

    revalidatePath('/busy/contabilidad/cuentas-por-cobrar');
    return enriquecerCuentaPorCobrar(cuenta as unknown as Record<string, unknown>);
  },
);

// ═══════════════════════════════════════════════════════════
// Cuentas por Pagar
// ═══════════════════════════════════════════════════════════

/**
 * @description Lista cuentas por pagar con paginación server-side, filtros y tenant isolation.
 */
export const getCuentasPorPagarAction = withAction(
  async (input: GetCuentasPorPagarInput, user: AuthenticatedUser): Promise<GetCuentasPorPagarResult> => {
    const tenantId = requireTenant(user);
    const f = getCuentasPorPagarSchema.parse(input);

    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (f.estado) where.estado = f.estado;
    if (f.tipo) where.tipo = f.tipo;
    if (f.search) {
      where.OR = [
        { numeroFactura: { contains: f.search, mode: 'insensitive' } },
        { proveedorNombre: { contains: f.search, mode: 'insensitive' } },
      ];
    }

    const skip = (f.page - 1) * f.limit;

    const [cuentasRaw, total] = await Promise.all([
      prisma.cuentaPorPagar.findMany({
        where,
        include: CXP_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: f.limit,
      }),
      prisma.cuentaPorPagar.count({ where }),
    ]);

    const cuentas = cuentasRaw.map((c) =>
      enriquecerCuentaPorPagar(c as unknown as Record<string, unknown>),
    );

    return {
      cuentas,
      pagination: { page: f.page, limit: f.limit, total, totalPages: Math.ceil(total / f.limit) },
    };
  },
);

/**
 * @description Crea una nueva cuenta por pagar con tenant isolation.
 */
export const createCuentaPorPagarAction = withAction(
  async (input: CreateCuentaPorPagarInput, user: AuthenticatedUser): Promise<CuentaPorPagarEnriquecida> => {
    const tenantId = requireTenant(user);
    const p = createCuentaPorPagarSchema.parse(input);

    const existente = await prisma.cuentaPorPagar.findFirst({
      where: { numeroFactura: p.numeroFactura, tenantId, deletedAt: null },
    });
    if (existente) throw new ActionError('Ya existe una cuenta por pagar con ese número de factura', 'DUPLICATE');

    const cuenta = await prisma.cuentaPorPagar.create({
      data: {
        tenantId,
        numeroFactura: p.numeroFactura,
        tipo: p.tipo,
        proveedorId: p.proveedorId,
        proveedorNombre: p.proveedorNombre ?? null,
        montoDeuda: p.montoDeuda,
        montoPagado: 0,
        saldoPendiente: p.montoDeuda,
        moneda: p.moneda,
        fechaEmision: p.fechaEmision ? new Date(p.fechaEmision) : new Date(),
        fechaVencimiento: p.fechaVencimiento ? new Date(p.fechaVencimiento) : null,
        estado: 'PENDIENTE',
        gastoCompraId: p.gastoCompraId ?? null,
        gastosDEId: p.gastosDEId ?? null,
      },
      include: CXP_INCLUDE,
    });

    revalidatePath('/busy/contabilidad/cuentas-por-pagar');
    return enriquecerCuentaPorPagar(cuenta as unknown as Record<string, unknown>);
  },
);

/**
 * @description Registra un pago de cuenta por pagar usando el workflow de gastos.
 *
 * Busca la CxP por número de factura y tipo, resuelve la referencia al gasto,
 * y ejecuta `applyPagoGastoWorkflow` en una transacción.
 */
export const pagarCuentaPorPagarAction = withAction(
  async (input: PagarCuentaPorPagarInput, user: AuthenticatedUser): Promise<PagarCuentaPorPagarResult> => {
    const tenantId = requireTenant(user);
    const p = pagarCuentaPorPagarSchema.parse(input);

    const cxp = await prisma.cuentaPorPagar.findFirst({
      where: {
        numeroFactura: p.numeroFactura,
        tipo: p.tipo,
        tenantId,
        deletedAt: null,
      },
      select: {
        cuentaPorPagarId: true,
        gastoCompraId: true,
        gastosDEId: true,
        tipo: true,
        moneda: true,
        estado: true,
        saldoPendiente: true,
      },
    });

    if (!cxp) {
      throw new ActionError(
        p.tipo === 'compra' ? 'Compra no encontrada' : 'Servicio no encontrado',
        'NOT_FOUND',
      );
    }

    if (cxp.estado === 'PAGADA') {
      throw new ActionError('La cuenta por pagar ya está pagada', 'CUENTA_YA_PAGADA');
    }

    if (p.monto > Number(cxp.saldoPendiente)) {
      throw new ActionError(
        `El monto no puede exceder el saldo pendiente de ${Number(cxp.saldoPendiente).toFixed(2)}`,
        'MONTO_EXCEDE_SALDO',
      );
    }

    const tipoGasto = p.tipo === 'compra' ? 'compra' : 'gastoDE';
    const referenciaId = p.tipo === 'compra' ? cxp.gastoCompraId : cxp.gastosDEId;

    if (!referenciaId) {
      throw new ActionError(
        `No se encontró la referencia de ${p.tipo === 'compra' ? 'compra' : 'gasto DE'} para esta cuenta`,
        'REFERENCIA_NO_ENCONTRADA',
      );
    }

    try {
      const resultado = await prisma.$transaction(async (tx) => {
        return applyPagoGastoWorkflow(tx, {
          tipoGasto,
          referenciaId,
          reconciliadoPor: user.userId,
          descripcion: `Pago factura ${p.numeroFactura}`,
          monto: p.monto,
          moneda: cxp.moneda,
          tenantId,
          cuentaPorPagarId: cxp.cuentaPorPagarId,
          numeroTransaccion: p.numeroTransaccion,
          cuentaProveedor: p.cuentaProveedor,
          observaciones: p.observaciones,
          gastoCompraId: cxp.gastoCompraId ?? undefined,
          gastosDEId: cxp.gastosDEId ?? undefined,
        });
      });

      if (!resultado.cuentaPorPagar || !resultado.pagoCuentaPorPagar) {
        throw new ActionError('El pago no generó los resultados esperados', 'WORKFLOW_ERROR');
      }

      const cuentaActualizada = await prisma.cuentaPorPagar.findUnique({
        where: { cuentaPorPagarId: cxp.cuentaPorPagarId },
        include: CXP_INCLUDE,
      });

      revalidatePath('/busy/contabilidad/cuentas-por-pagar');

      return {
        cuenta: enriquecerCuentaPorPagar(cuentaActualizada as unknown as Record<string, unknown>),
        pago: resultado.pagoCuentaPorPagar,
      };
    } catch (error) {
      if (error instanceof ActionError) throw error;
      if (isGastoWorkflowError(error)) throw new ActionError(error.message, error.code);
      throw error;
    }
  },
);
