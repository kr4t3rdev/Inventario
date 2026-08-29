import { ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';

interface BankTransferFilters {
  tenantId: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  cuentaId?: string | null;
}

interface BankAdjustmentFilters {
  tenantId: string;
  cuentaId: string;
  page?: number;
  limit?: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  tipo?: string | null;
}

interface CapitalInjectionFilters {
  tenantId: string;
  tipo?: string | null;
}

/**
 * @description Shared read service for accounting operations slices.
 */
export const AccountingOperationsReadService = {
  async getBankTransfers(filters: BankTransferFilters) {
    const where: Record<string, any> = { tenantId: filters.tenantId };

    if (filters.fechaInicio || filters.fechaFin) {
      where.createdAt = {};
      if (filters.fechaInicio) where.createdAt.gte = new Date(filters.fechaInicio);
      if (filters.fechaFin) where.createdAt.lte = new Date(filters.fechaFin);
    }

    if (filters.cuentaId) {
      where.cuentaId = filters.cuentaId;
    }

    const [transferencias, total] = await Promise.all([
      prisma.transferenciaBancaria.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          cuentaOrigen: {
            select: { nombreBanco: true, numeroCuenta: true, moneda: true },
          },
          cuentaDestino: {
            select: { nombreBanco: true, numeroCuenta: true, moneda: true },
          },
        },
      }),
      prisma.transferenciaBancaria.count({ where }),
    ]);

    return {
      transferencias: transferencias.map((transferencia) => ({
        ...transferencia,
        montoOrigen: Number(transferencia.montoOrigen),
        montoDestino: Number(transferencia.montoDestino),
        tasaCambio: transferencia.tasaCambio ? Number(transferencia.tasaCambio) : null,
      })),
      pagination: {
        page: 1,
        limit: 50,
        total,
        totalPages: Math.ceil(total / 50),
      },
    };
  },

  async getBankTransferById(id: string, tenantId: string) {
    const transferencia = await prisma.transferenciaBancaria.findFirst({
      where: { transferenciaId: id, tenantId },
      include: {
        cuentaOrigen: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            tipoCuenta: true,
            moneda: true,
          },
        },
        cuentaDestino: {
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            tipoCuenta: true,
            moneda: true,
          },
        },
      },
    });

    if (!transferencia) {
      throw new ActionError('Transferencia no encontrada', 'NOT_FOUND');
    }

    return {
      ...transferencia,
      montoOrigen: Number(transferencia.montoOrigen),
      montoDestino: Number(transferencia.montoDestino),
      tasaCambio: transferencia.tasaCambio ? Number(transferencia.tasaCambio) : null,
    };
  },

  async getBankAdjustments(filters: BankAdjustmentFilters) {
    const {
      cuentaId,
      page = 1,
      limit = 50,
      fechaInicio,
      fechaFin,
      tipo,
    } = filters;

    const where: Record<string, any> = { tenantId: filters.tenantId };
    if (cuentaId !== 'all') where.cuentaId = cuentaId;
    if (tipo) where.tipo = tipo;
    if (fechaInicio || fechaFin) {
      where.fechaOperacion = {};
      if (fechaInicio) where.fechaOperacion.gte = new Date(fechaInicio);
      if (fechaFin) {
        const fecha = new Date(fechaFin);
        fecha.setHours(23, 59, 59, 999);
        where.fechaOperacion.lte = fecha;
      }
    }

    const offset = (page - 1) * limit;

    const [ajustes, totalCount] = await Promise.all([
      prisma.ajusteBancario.findMany({
        where,
        orderBy: { fechaOperacion: 'desc' },
        skip: offset,
        take: limit,
        include: {
          cuentaBancaria: {
            select: { nombreBanco: true, numeroCuenta: true, moneda: true },
          },
        },
      }),
      prisma.ajusteBancario.count({ where }),
    ]);

    const ajustesConUsuario = ajustes.map((ajuste: any) => ({
      ...ajuste,
      realizadoPorInfo: { userId: ajuste.realizadoPor },
    }));

    let cuentaBancariaInfo = null;
    if (cuentaId !== 'all') {
      const cuentaBancaria = await prisma.cuentaBancaria.findFirst({
        where: { cuentaId, tenantId: filters.tenantId },
        select: {
          cuentaId: true,
          nombreBanco: true,
          numeroCuenta: true,
          saldo: true,
          moneda: true,
        },
      });
      if (cuentaBancaria) cuentaBancariaInfo = cuentaBancaria;
    }

    return {
      ajustes: ajustesConUsuario,
      cuentaBancaria: cuentaBancariaInfo,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      },
    };
  },

  async getCapitalInjections(filters: CapitalInjectionFilters) {
    const where: Record<string, unknown> = {
      cuentaBancaria: { tenantId: filters.tenantId },
    };

    if (filters.tipo) {
      where.tipo = filters.tipo;
    }

    const inyecciones = await prisma.inyeccionCapital.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { inyecciones };
  },
};
