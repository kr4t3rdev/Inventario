import { ORIGEN_TIPO, resolverCriterio, resolverNaturaleza, type EventoContableSeed, type OrigenTipo } from '@/lib/services/evento-contable-service';
import prisma from '@/lib/prisma';

export interface CuentaContableMapping {
  cuentaPrincipal: string;
  cuentaContraria: string;
  etiqueta: string;
}

const CUENTAS_POR_ORIGEN_HARDCODE: Record<OrigenTipo, CuentaContableMapping> = {
  [ORIGEN_TIPO.VENTA]: {
    cuentaPrincipal: 'INGRESOS_POR_VENTAS',
    cuentaContraria: 'CUENTAS_POR_COBRAR',
    etiqueta: 'Venta de mercancías',
  },
  [ORIGEN_TIPO.VENTA_SERVICIO]: {
    cuentaPrincipal: 'INGRESOS_POR_SERVICIOS',
    cuentaContraria: 'CUENTAS_POR_COBRAR',
    etiqueta: 'Venta de servicios',
  },
  [ORIGEN_TIPO.GASTO_DE]: {
    cuentaPrincipal: 'GASTOS_DE_EXPLOTACION',
    cuentaContraria: 'CAJA',
    etiqueta: 'Gasto de explotación',
  },
  [ORIGEN_TIPO.GASTO_COMPRA]: {
    cuentaPrincipal: 'INVENTARIO',
    cuentaContraria: 'CUENTAS_POR_PAGAR',
    etiqueta: 'Compra de inventario',
  },
  [ORIGEN_TIPO.PAGO_SALARIO]: {
    cuentaPrincipal: 'GASTOS_DE_NOMINA',
    cuentaContraria: 'CAJA',
    etiqueta: 'Pago de salario',
  },
  [ORIGEN_TIPO.COBRO_VENTA]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'CUENTAS_POR_COBRAR',
    etiqueta: 'Cobro de venta',
  },
  [ORIGEN_TIPO.COBRO_SERVICIO]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'CUENTAS_POR_COBRAR',
    etiqueta: 'Cobro de servicio',
  },
  [ORIGEN_TIPO.PAGO_GASTO]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'GASTOS_POR_PAGAR',
    etiqueta: 'Pago de gasto',
  },
  [ORIGEN_TIPO.TRANSFERENCIA_BANCARIA]: {
    cuentaPrincipal: 'BANCO',
    cuentaContraria: 'CAJA',
    etiqueta: 'Transferencia bancaria',
  },
  [ORIGEN_TIPO.TRANSFERENCIA_INVENTARIO]: {
    cuentaPrincipal: 'INVENTARIO',
    cuentaContraria: 'ALMACEN_ORIGEN',
    etiqueta: 'Transferencia de inventario',
  },
  [ORIGEN_TIPO.AJUSTE_BANCARIO]: {
    cuentaPrincipal: 'BANCO',
    cuentaContraria: 'AJUSTE_BANCARIO',
    etiqueta: 'Ajuste bancario',
  },
  [ORIGEN_TIPO.RECONCILIACION_VENTA]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'CUENTAS_POR_COBRAR',
    etiqueta: 'Reconciliación de venta',
  },
  [ORIGEN_TIPO.RECONCILIACION_SERVICIO]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'CUENTAS_POR_COBRAR',
    etiqueta: 'Reconciliación de servicio',
  },
  [ORIGEN_TIPO.RECONCILIACION_GASTO]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'CUENTAS_POR_PAGAR',
    etiqueta: 'Reconciliación de gasto',
  },
  [ORIGEN_TIPO.AJUSTE_CONTABLE]: {
    cuentaPrincipal: 'AJUSTE_CONTABLE',
    cuentaContraria: 'RESULTADO_ACUMULADO',
    etiqueta: 'Ajuste contable',
  },
  [ORIGEN_TIPO.COMPRA_SERVICIO]: {
    cuentaPrincipal: 'GASTOS_POR_SERVICIOS',
    cuentaContraria: 'CUENTAS_POR_PAGAR',
    etiqueta: 'Compra de servicios',
  },
  [ORIGEN_TIPO.MERMA]: {
    cuentaPrincipal: 'PERDIDA_POR_MERMA',
    cuentaContraria: 'INVENTARIO',
    etiqueta: 'Merma de inventario',
  },
  [ORIGEN_TIPO.ANTICIPO_PAGO]: {
    cuentaPrincipal: 'ANTICIPO_PAGO',
    cuentaContraria: 'CAJA',
    etiqueta: 'Anticipo de pago',
  },
  [ORIGEN_TIPO.ANTICIPO_COBRO]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'ANTICIPO_COBRO',
    etiqueta: 'Anticipo de cobro',
  },
  [ORIGEN_TIPO.FACTURA]: {
    cuentaPrincipal: 'INGRESOS_POR_FACTURA',
    cuentaContraria: 'CUENTAS_POR_COBRAR',
    etiqueta: 'Facturación',
  },
  [ORIGEN_TIPO.CUENTA_POR_COBRAR]: {
    cuentaPrincipal: 'CUENTAS_POR_COBRAR',
    cuentaContraria: 'INGRESOS_POR_VENTAS',
    etiqueta: 'Cuenta por cobrar',
  },
  [ORIGEN_TIPO.CUENTA_POR_PAGAR]: {
    cuentaPrincipal: 'GASTOS_POR_PAGAR',
    cuentaContraria: 'CUENTAS_POR_PAGAR',
    etiqueta: 'Cuenta por pagar',
  },
  [ORIGEN_TIPO.PAGO_CUENTA_POR_PAGAR]: {
    cuentaPrincipal: 'CUENTAS_POR_PAGAR',
    cuentaContraria: 'CAJA',
    etiqueta: 'Pago de cuenta por pagar',
  },
  [ORIGEN_TIPO.INYECCION_CAPITAL]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'CAPITAL_SOCIAL',
    etiqueta: 'Inyección de capital',
  },
  [ORIGEN_TIPO.PAGO_DEUDA]: {
    cuentaPrincipal: 'GASTOS_FINANCIEROS',
    cuentaContraria: 'CAJA',
    etiqueta: 'Pago de deuda',
  },
  [ORIGEN_TIPO.DEUDA_CASH]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'DEUDA_CASH',
    etiqueta: 'Desembolso de deuda cash',
  },
  [ORIGEN_TIPO.PRESTAMO_CASH]: {
    cuentaPrincipal: 'PRESTAMO_POR_COBRAR',
    cuentaContraria: 'CAJA',
    etiqueta: 'Desembolso de préstamo cash',
  },
  [ORIGEN_TIPO.REVERSION_ANTICIPO]: {
    cuentaPrincipal: 'CAJA',
    cuentaContraria: 'ANTICIPO',
    etiqueta: 'Reversión de anticipo',
  },
};

interface DB_MappingRow {
  origenTipo: string;
  cuentaPrincipalCodigo: string;
  cuentaContrariaCodigo: string;
  etiqueta: string | null;
  cuentaPrincipal: { codigo: string; nombre: string };
  cuentaContraria: { codigo: string; nombre: string };
}

let cacheMappings: Record<string, CuentaContableMapping> | null = null

async function loadDBMappings(): Promise<Record<string, CuentaContableMapping>> {
  try {
    const dbRows = await (prisma as unknown as Record<string, unknown>).mappingContable?.findMany({
      include: {
        cuentaPrincipal: { select: { codigo: true, nombre: true } },
        cuentaContraria: { select: { codigo: true, nombre: true } },
      },
    }) as DB_MappingRow[] | undefined

    if (!dbRows || dbRows.length === 0) return {}

    return Object.fromEntries(
      dbRows.map((row) => [
        row.origenTipo,
        {
          cuentaPrincipal: row.cuentaPrincipalCodigo,
          cuentaContraria: row.cuentaContrariaCodigo,
          etiqueta: row.etiqueta ?? `${row.cuentaPrincipal.nombre} ↔ ${row.cuentaContraria.nombre}`,
        },
      ])
    )
  } catch {
    return {}
  }
}

/**
 * @description Resuelve el mapping contable por origen, consultando primero la DB y cayendo al hardcode como fallback.
 * @param {OrigenTipo} origenTipo - Tipo de origen de la operación.
 * @returns {CuentaContableMapping} Mapping con cuenta principal y contrapartida.
 */
export async function resolverCuentaContableMapping(origenTipo: OrigenTipo): Promise<CuentaContableMapping> {
  if (!cacheMappings) {
    cacheMappings = await loadDBMappings()
  }
  return cacheMappings[origenTipo] ?? CUENTAS_POR_ORIGEN_HARDCODE[origenTipo] ?? {
    cuentaPrincipal: 'RESULTADO_ACUMULADO',
    cuentaContraria: 'AJUSTE_CONTABLE',
    etiqueta: 'Origen desconocido',
  };
}

/**
 * @description Resuelve el mapping contable por origen usando solo el hardcode (sin DB). Útil para contexto sincrónico.
 * @param {OrigenTipo} origenTipo - Tipo de origen de la operación.
 * @returns {CuentaContableMapping} Mapping hardcodeado.
 */
export function resolverCuentaContableMappingHardcode(origenTipo: OrigenTipo): CuentaContableMapping {
  return CUENTAS_POR_ORIGEN_HARDCODE[origenTipo] ?? {
    cuentaPrincipal: 'RESULTADO_ACUMULADO',
    cuentaContraria: 'AJUSTE_CONTABLE',
    etiqueta: 'Origen desconocido',
  };
}

export type EventoEnriquecido = EventoContableSeed & {
  cuentaPrincipal: string;
  cuentaContraria: string;
  etiquetaContable: string;
};

/**
 * @description Enriquese una semilla de evento contable con cuentas y metadatos contables estables.
 * @param {EventoContableSeed} seed - Semilla base del evento.
 * @returns {Promise<EventoEnriquecido>} Semilla enriquecida.
 */
export async function enriquecerEventoConCuentas(seed: EventoContableSeed): Promise<EventoEnriquecido> {
  const mapping = await resolverCuentaContableMapping(seed.origenTipo);

  return {
    ...seed,
    criterio: seed.criterio ?? resolverCriterio(seed.origenTipo),
    naturaleza: seed.naturaleza ?? resolverNaturaleza(seed.origenTipo),
    cuentaPrincipal: mapping.cuentaPrincipal,
    cuentaContraria: mapping.cuentaContraria,
    etiquetaContable: mapping.etiqueta,
  };
}
