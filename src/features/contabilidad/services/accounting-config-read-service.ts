import { prisma } from '@/lib/prisma';

interface PaymentTypeFilters {
  includeInactive?: boolean;
  requiereCuenta?: boolean;
}

interface AvailableAccountsFilters {
  moneda?: string | null;
  tipoCuenta?: string | null;
}

const paymentTypeCountSelect = {
  select: {
    reconciliacionesVenta: true,
    reconciliacionesServicio: true,
    reconciliacionesGasto: true,
  },
} as const;

async function enrichPaymentTypes(tipos: any[], tenantId: string) {
  return Promise.all(
    tipos.map(async (tipo: any) => {
      let cuentaDefectoInfo = null;
      if (tipo.cuentaDefecto) {
        cuentaDefectoInfo = await prisma.cuentaBancaria.findFirst({
          where: { cuentaId: tipo.cuentaDefecto, tenantId },
          select: {
            cuentaId: true,
            nombreBanco: true,
            numeroCuenta: true,
            tipoCuenta: true,
            moneda: true,
            isActive: true,
          },
        });
      }

      return { ...tipo, cuentaDefectoInfo };
    }),
  );
}

/**
 * @description Shared read service for accounting configuration slices.
 * All public methods require tenantId for proper multi-tenant isolation.
 */
export const AccountingConfigReadService = {
  /**
   * @description Lists payment types scoped to a tenant.
   * @param tenantId - Tenant ID for isolation
   * @param filters - Optional filters
   */
  async getPaymentTypes(tenantId: string, filters: PaymentTypeFilters = {}) {
    const where: Record<string, unknown> = { tenantId };
    if (filters.includeInactive !== true) where.isActive = true;
    if (filters.requiereCuenta !== undefined) where.requiereCuenta = filters.requiereCuenta;

    const tipos = await prisma.tipoPago.findMany({
      where,
      include: { _count: paymentTypeCountSelect },
      orderBy: [{ isActive: 'desc' }, { nombre: 'asc' }],
    });

    return { data: await enrichPaymentTypes(tipos, tenantId) };
  },

  /**
   * @description Lists active bank accounts available for payment-type configuration, scoped to a tenant.
   * @param tenantId - Tenant ID for isolation
   * @param filters - Optional filters
   */
  async getAvailableAccounts(tenantId: string, filters: AvailableAccountsFilters = {}) {
    const where: Record<string, unknown> = { isActive: true, tenantId };
    if (filters.moneda) where.moneda = filters.moneda;
    if (filters.tipoCuenta) where.tipoCuenta = filters.tipoCuenta;

    const cuentas = await prisma.cuentaBancaria.findMany({
      where,
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        tipoCuenta: true,
        saldo: true,
        moneda: true,
        createdAt: true,
      },
      orderBy: [{ nombreBanco: 'asc' }, { numeroCuenta: 'asc' }],
    });

    const cuentasConUso = await Promise.all(
      cuentas.map(async (cuenta: any) => {
        const tiposPagoUsando = await prisma.tipoPago.findMany({
          where: {
            cuentaDefecto: cuenta.cuentaId,
            isActive: true,
            tenantId,
          },
          select: {
            tipoId: true,
            nombre: true,
          },
        });

        return {
          ...cuenta,
          saldo: Number(cuenta.saldo),
          usadaEnTiposPago: tiposPagoUsando,
          esUsadaComoDefecto: tiposPagoUsando.length > 0,
        };
      }),
    );

    const estadisticas = {
      totalCuentas: cuentas.length,
      cuentasPorMoneda: await prisma.cuentaBancaria.groupBy({
        by: ['moneda'],
        where: { isActive: true, tenantId },
        _count: { cuentaId: true },
      }),
      cuentasPorTipo: await prisma.cuentaBancaria.groupBy({
        by: ['tipoCuenta'],
        where: { isActive: true, tenantId },
        _count: { cuentaId: true },
      }),
    };

    return { cuentas: cuentasConUso, estadisticas };
  },
};
