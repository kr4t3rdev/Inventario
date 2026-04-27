import { ORIGEN_TIPO, resolverCriterio, resolverNaturaleza, type EventoContableSeed, type OrigenTipo } from '@/lib/services/evento-contable-service';

export interface CuentaContableMapping {
  cuentaPrincipal: string;
  cuentaContraria: string;
  etiqueta: string;
}

const CUENTAS_POR_ORIGEN: Record<OrigenTipo, CuentaContableMapping> = {
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

/**
 * @description Resuelve el mapping contable por origen para estandarizar las cuentas del subledger.
 * @param {OrigenTipo} origenTipo - Tipo de origen de la operación.
 * @returns {CuentaContableMapping} Mapping con cuenta principal y contrapartida.
 */
export function resolverCuentaContableMapping(origenTipo: OrigenTipo): CuentaContableMapping {
  return CUENTAS_POR_ORIGEN[origenTipo] ?? {
    cuentaPrincipal: 'RESULTADO_ACUMULADO',
    cuentaContraria: 'AJUSTE_CONTABLE',
    etiqueta: 'Origen desconocido',
  };
}

/**
 * @description Enriquese una semilla de evento contable con cuentas y metadatos contables estables.
 * @param {EventoContableSeed} seed - Semilla base del evento.
 * @returns {EventoContableSeed & { cuentaPrincipal: string; cuentaContraria: string; etiquetaContable: string }} Semilla enriquecida.
 */
export function enriquecerEventoConCuentas(seed: EventoContableSeed): EventoContableSeed & {
  cuentaPrincipal: string;
  cuentaContraria: string;
  etiquetaContable: string;
} {
  const mapping = resolverCuentaContableMapping(seed.origenTipo);

  return {
    ...seed,
    criterio: seed.criterio ?? resolverCriterio(seed.origenTipo),
    naturaleza: seed.naturaleza ?? resolverNaturaleza(seed.origenTipo),
    cuentaPrincipal: mapping.cuentaPrincipal,
    cuentaContraria: mapping.cuentaContraria,
    etiquetaContable: mapping.etiqueta,
  };
}
