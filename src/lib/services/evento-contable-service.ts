export const ORIGEN_TIPO = {
  VENTA: 'VENTA',
  VENTA_SERVICIO: 'VENTA_SERVICIO',
  GASTO_DE: 'GASTO_DE',
  GASTO_COMPRA: 'GASTO_COMPRA',
  PAGO_SALARIO: 'PAGO_SALARIO',
  COBRO_VENTA: 'COBRO_VENTA',
  COBRO_SERVICIO: 'COBRO_SERVICIO',
  PAGO_GASTO: 'PAGO_GASTO',
  TRANSFERENCIA_BANCARIA: 'TRANSFERENCIA_BANCARIA',
  TRANSFERENCIA_INVENTARIO: 'TRANSFERENCIA_INVENTARIO',
  AJUSTE_BANCARIO: 'AJUSTE_BANCARIO',
  RECONCILIACION_VENTA: 'RECONCILIACION_VENTA',
  RECONCILIACION_SERVICIO: 'RECONCILIACION_SERVICIO',
  RECONCILIACION_GASTO: 'RECONCILIACION_GASTO',
  AJUSTE_CONTABLE: 'AJUSTE_CONTABLE',
} as const;

export type OrigenTipo = (typeof ORIGEN_TIPO)[keyof typeof ORIGEN_TIPO];

export const CRITERIO = {
  CAJA: 'CAJA',
  DEVENGO: 'DEVENGO',
} as const;

export type CriterioContable = (typeof CRITERIO)[keyof typeof CRITERIO];

export const NATURALEZA = {
  INGRESO: 'INGRESO',
  EGRESO: 'EGRESO',
  ACTIVO: 'ACTIVO',
  PASIVO: 'PASIVO',
  PATRIMONIO: 'PATRIMONIO',
  RESULTADO: 'RESULTADO',
} as const;

export type NaturalezaEvento = (typeof NATURALEZA)[keyof typeof NATURALEZA];

export const ESTADO_EVENTO = {
  CONFIRMADO: 'CONFIRMADO',
  PENDIENTE: 'PENDIENTE',
  ANULADO: 'ANULADO',
} as const;

export type EstadoEvento = (typeof ESTADO_EVENTO)[keyof typeof ESTADO_EVENTO];

export interface EventoContableSeed {
  fechaOperacion: Date;
  origenTipo: OrigenTipo;
  origenId: string;
  criterio: CriterioContable;
  monto: number;
  montoConvertido?: number;
  naturaleza: NaturalezaEvento;
  moneda?: string;
  periodoDiarioId?: string;
  periodoMensualId?: string;
  periodoAnualId?: string;
  descripcion?: string;
  metadataJson?: Record<string, unknown>;
}

export interface EventoContableLineaSeed {
  cuenta: string;
  descripcion?: string;
  debito: number;
  credito: number;
  moneda?: string;
  metadataJson?: Record<string, unknown>;
}

const NATURALEZA_POR_ORIGEN: Record<string, NaturalezaEvento> = {
  VENTA: NATURALEZA.INGRESO,
  VENTA_SERVICIO: NATURALEZA.INGRESO,
  GASTO_DE: NATURALEZA.EGRESO,
  GASTO_COMPRA: NATURALEZA.EGRESO,
  PAGO_SALARIO: NATURALEZA.EGRESO,
  COBRO_VENTA: NATURALEZA.INGRESO,
  COBRO_SERVICIO: NATURALEZA.INGRESO,
  PAGO_GASTO: NATURALEZA.EGRESO,
  TRANSFERENCIA_BANCARIA: NATURALEZA.ACTIVO,
  TRANSFERENCIA_INVENTARIO: NATURALEZA.ACTIVO,
  AJUSTE_BANCARIO: NATURALEZA.ACTIVO,
  RECONCILIACION_VENTA: NATURALEZA.INGRESO,
  RECONCILIACION_SERVICIO: NATURALEZA.INGRESO,
  RECONCILIACION_GASTO: NATURALEZA.EGRESO,
  AJUSTE_CONTABLE: NATURALEZA.RESULTADO,
};

const CRITERIO_POR_ORIGEN: Record<string, CriterioContable> = {
  VENTA: CRITERIO.DEVENGO,
  VENTA_SERVICIO: CRITERIO.DEVENGO,
  GASTO_DE: CRITERIO.DEVENGO,
  GASTO_COMPRA: CRITERIO.DEVENGO,
  PAGO_SALARIO: CRITERIO.DEVENGO,
  COBRO_VENTA: CRITERIO.CAJA,
  COBRO_SERVICIO: CRITERIO.CAJA,
  PAGO_GASTO: CRITERIO.CAJA,
  TRANSFERENCIA_BANCARIA: CRITERIO.CAJA,
  TRANSFERENCIA_INVENTARIO: CRITERIO.CAJA,
  AJUSTE_BANCARIO: CRITERIO.CAJA,
  RECONCILIACION_VENTA: CRITERIO.CAJA,
  RECONCILIACION_SERVICIO: CRITERIO.CAJA,
  RECONCILIACION_GASTO: CRITERIO.CAJA,
  AJUSTE_CONTABLE: CRITERIO.DEVENGO,
};

/**
 * @description Resuelve la naturaleza contable predeterminada para un tipo de origen.
 * @param {OrigenTipo} origenTipo - Tipo de origen de la operación.
 * @returns {NaturalezaEvento} Naturaleza contable correspondiente.
 */
export function resolverNaturaleza(origenTipo: OrigenTipo): NaturalezaEvento {
  return NATURALEZA_POR_ORIGEN[origenTipo] ?? NATURALEZA.RESULTADO;
}

/**
 * @description Resuelve el criterio contable predeterminado para un tipo de origen.
 * @param {OrigenTipo} origenTipo - Tipo de origen de la operación.
 * @returns {CriterioContable} Criterio contable correspondiente (CAJA o DEVENGO).
 */
export function resolverCriterio(origenTipo: OrigenTipo): CriterioContable {
  return CRITERIO_POR_ORIGEN[origenTipo] ?? CRITERIO.DEVENGO;
}

/**
 * @description Genera la semilla de un evento contable con valores por defecto.
 * @param {EventoContableSeed} seed - Datos base del evento.
 * @returns {EventoContableSeed} Semilla con valores calculados y por defecto aplicados.
 */
export function generarEventoSeed(seed: EventoContableSeed): EventoContableSeed {
  return {
    origenTipo: seed.origenTipo,
    origenId: seed.origenId,
    fechaOperacion: seed.fechaOperacion,
    criterio: seed.criterio ?? resolverCriterio(seed.origenTipo),
    naturaleza: seed.naturaleza ?? resolverNaturaleza(seed.origenTipo),
    monto: seed.monto,
    montoConvertido: seed.montoConvertido,
    moneda: seed.moneda ?? 'CUP',
    periodoDiarioId: seed.periodoDiarioId,
    periodoMensualId: seed.periodoMensualId,
    periodoAnualId: seed.periodoAnualId,
    descripcion: seed.descripcion ?? `${seed.origenTipo} - ${seed.origenId}`,
    metadataJson: seed.metadataJson,
  };
}

/**
 * @description Genera las líneas de doble partida para un evento contable.
 * @param {EventoContableSeed} evento - Evento contable base.
 * @param {string} cuentaContraria - Cuenta contraria para el asiento de doble partida.
 * @returns {EventoContableLineaSeed[]} Líneas de débito y crédito.
 */
export function generarLineasDoblePartida(
  evento: EventoContableSeed,
  cuentaContraria: string
): EventoContableLineaSeed[] {
  const cuentaPrincipal = `${evento.origenTipo}_${evento.origenId}`;
  const monto = evento.monto;
  const moneda = evento.moneda ?? 'CUP';

  switch (evento.naturaleza) {
    case NATURALEZA.INGRESO:
      return [
        {
          cuenta: cuentaContraria,
          descripcion: `Contraingreso de ${evento.descripcion ?? evento.origenTipo}`,
          debito: monto,
          credito: 0,
          moneda,
        },
        {
          cuenta: cuentaPrincipal,
          descripcion: `Ingreso por ${evento.descripcion ?? evento.origenTipo}`,
          debito: 0,
          credito: monto,
          moneda,
        },
      ];

    case NATURALEZA.EGRESO:
      return [
        {
          cuenta: cuentaPrincipal,
          descripcion: `Egreso por ${evento.descripcion ?? evento.origenTipo}`,
          debito: monto,
          credito: 0,
          moneda,
        },
        {
          cuenta: cuentaContraria,
          descripcion: `Contraegreso de ${evento.descripcion ?? evento.origenTipo}`,
          debito: 0,
          credito: monto,
          moneda,
        },
      ];

    case NATURALEZA.ACTIVO:
      return [
        {
          cuenta: cuentaPrincipal,
          descripcion: `Movimiento de activo: ${evento.descripcion ?? evento.origenTipo}`,
          debito: monto,
          credito: 0,
          moneda,
        },
        {
          cuenta: cuentaContraria,
          descripcion: `Contrapartida de activo`,
          debito: 0,
          credito: monto,
          moneda,
        },
      ];

    case NATURALEZA.PASIVO:
      return [
        {
          cuenta: cuentaContraria,
          descripcion: `Contrapartida de pasivo`,
          debito: monto,
          credito: 0,
          moneda,
        },
        {
          cuenta: cuentaPrincipal,
          descripcion: `Movimiento de pasivo: ${evento.descripcion ?? evento.origenTipo}`,
          debito: 0,
          credito: monto,
          moneda,
        },
      ];

    case NATURALEZA.PATRIMONIO:
      return [
        {
          cuenta: cuentaContraria,
          descripcion: `Contrapartida patrimonial`,
          debito: monto,
          credito: 0,
          moneda,
        },
        {
          cuenta: cuentaPrincipal,
          descripcion: `Movimiento patrimonial: ${evento.descripcion ?? evento.origenTipo}`,
          debito: 0,
          credito: monto,
          moneda,
        },
      ];

    case NATURALEZA.RESULTADO:
    default:
      return [
        {
          cuenta: cuentaPrincipal,
          descripcion: `Ajuste de resultado: ${evento.descripcion ?? evento.origenTipo}`,
          debito: monto,
          credito: 0,
          moneda,
        },
        {
          cuenta: cuentaContraria,
          descripcion: `Contrapartida de ajuste`,
          debito: 0,
          credito: monto,
          moneda,
        },
      ];
  }
}

/**
 * @description Valida que la semilla de un evento contable tenga los campos requeridos y coherentes.
 * @param {EventoContableSeed} seed - Semilla a validar.
 * @returns {{ ok: boolean; errors: string[] }} Resultado de la validación.
 */
export function validarEventoSeed(seed: EventoContableSeed): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!seed.origenTipo) {
    errors.push('origenTipo es requerido');
  }

  if (!seed.origenId) {
    errors.push('origenId es requerido');
  }

  if (!seed.fechaOperacion || Number.isNaN(seed.fechaOperacion.getTime?.())) {
    errors.push('fechaOperacion es requerida y debe ser válida');
  }

  if (seed.monto === undefined || seed.monto === null) {
    errors.push('monto es requerido');
  } else if (typeof seed.monto === 'number' && seed.monto <= 0) {
    errors.push('monto debe ser positivo');
  }

  if (seed.criterio !== CRITERIO.CAJA && seed.criterio !== CRITERIO.DEVENGO) {
    errors.push(`criterio debe ser CAJA o DEVENGO, recibido: ${seed.criterio}`);
  }

  if (
    seed.naturaleza !== NATURALEZA.INGRESO &&
    seed.naturaleza !== NATURALEZA.EGRESO &&
    seed.naturaleza !== NATURALEZA.ACTIVO &&
    seed.naturaleza !== NATURALEZA.PASIVO &&
    seed.naturaleza !== NATURALEZA.PATRIMONIO &&
    seed.naturaleza !== NATURALEZA.RESULTADO
  ) {
    errors.push(`naturaleza inválida: ${seed.naturaleza}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}