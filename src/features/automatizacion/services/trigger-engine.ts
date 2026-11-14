/**
 * @description Motor de evaluación de triggers automatizados.
 *
 * Evalúa los triggers configurados contra eventos del sistema
 * y dispara las acciones correspondientes (email, SMS, push, cupón, puntos).
 *
 * @module features/automatizacion/services/trigger-engine
 */

export type TriggerEvento =
  | 'COMPRA_COMPLETADA'
  | 'CUMPLEANOS'
  | 'TIER_ALCANZADO'
  | 'CHURN_RISK'
  | 'CARRITO_ABANDONADO'
  | 'MISION_COMPLETADA';

export type TriggerAccion =
  | 'EMAIL'
  | 'SMS'
  | 'PUSH'
  | 'CUPON'
  | 'PUNTOS_BONUS';

export interface TriggerDefinicion {
  triggerId: string;
  tenantId: string;
  nombre: string;
  evento: TriggerEvento;
  condiciones: Record<string, unknown>;
  accion: TriggerAccion;
  payload: Record<string, unknown>;
  canal: string;
  delayMinutos: number;
  activo: boolean;
  vecesMaximo: number | null;
}

export interface TriggerEventoData {
  clienteId: string;
  tenantId: string;
  evento: TriggerEvento;
  datos: Record<string, unknown>;
}

export interface TriggerEjecucionResultado {
  triggerId: string;
  clienteId: string;
  accion: TriggerAccion;
  canal: string;
  payload: Record<string, unknown>;
  ejecutado: boolean;
  motivo?: string;
}

/**
 * @description Evalúa si un trigger cumple sus condiciones.
 * @param {TriggerDefinicion} trigger - Definición del trigger.
 * @param {TriggerEventoData} evento - Datos del evento.
 * @returns {boolean} True si el trigger debe dispararse.
 */
export function cumpleTrigger(trigger: TriggerDefinicion, evento: TriggerEventoData): boolean {
  // El trigger debe estar activo
  if (!trigger.activo) return false;

  // El evento debe coincidir
  if (trigger.evento !== evento.evento) return false;

  // El tenant debe coincidir
  if (trigger.tenantId !== evento.tenantId) return false;

  // Evaluar condiciones
  return evaluarCondiciones(trigger.condiciones, evento.datos);
}

/**
 * @description Evalúa las condiciones de un trigger contra los datos del evento.
 * @param {Record<string, unknown>} condiciones - Condiciones del trigger.
 * @param {Record<string, unknown>} datos - Datos del evento.
 * @returns {boolean} True si todas las condiciones se cumplen.
 */
export function evaluarCondiciones(
  condiciones: Record<string, unknown>,
  datos: Record<string, unknown>
): boolean {
  for (const [clave, valor] of Object.entries(condiciones)) {
    if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
      // Condiciones con operadores: {minimoGasto: {min: 1000}}
      const condicion = valor as Record<string, number>;
      const datoValor = datos[clave];

      if ('min' in condicion && datoValor !== undefined && datoValor !== null) {
        if (Number(datoValor) < condicion.min) return false;
      }
      if ('max' in condicion && datoValor !== undefined && datoValor !== null) {
        if (Number(datoValor) > condicion.max) return false;
      }
      if ('eq' in condicion && datoValor !== undefined) {
        if (String(datoValor) !== String(condicion.eq)) return false;
      }
    } else if (valor !== undefined) {
      // Condición simple: {segmento: "VIP"}
      if (datos[clave] !== valor) return false;
    }
  }
  return true;
}

/**
 * @description Evalúa todos los triggers activos contra un evento.
 * @param {TriggerDefinicion[]} triggers - Lista de triggers.
 * @param {TriggerEventoData} evento - Datos del evento.
 * @param {Map<string, number>} ejecucionesPorCliente - Contador de ejecuciones.
 * @returns {TriggerEjecucionResultado[]} Resultados de ejecución.
 */
export function evaluarTriggers(
  triggers: TriggerDefinicion[],
  evento: TriggerEventoData,
  ejecucionesPorCliente: Map<string, number> = new Map()
): TriggerEjecucionResultado[] {
  const resultados: TriggerEjecucionResultado[] = [];

  for (const trigger of triggers) {
    if (!cumpleTrigger(trigger, evento)) {
      continue;
    }

    // Verificar límite de ejecuciones
    const key = `${trigger.triggerId}:${evento.clienteId}`;
    const ejecuciones = ejecucionesPorCliente.get(key) || 0;
    if (trigger.vecesMaximo !== null && ejecuciones >= trigger.vecesMaximo) {
      resultados.push({
        triggerId: trigger.triggerId,
        clienteId: evento.clienteId,
        accion: trigger.accion,
        canal: trigger.canal,
        payload: trigger.payload,
        ejecutado: false,
        motivo: 'Límite de ejecuciones alcanzado',
      });
      continue;
    }

    // Incrementar contador
    ejecucionesPorCliente.set(key, ejecuciones + 1);

    resultados.push({
      triggerId: trigger.triggerId,
      clienteId: evento.clienteId,
      accion: trigger.accion,
      canal: trigger.canal,
      payload: trigger.payload,
      ejecutado: true,
    });
  }

  return resultados;
}

/**
 * @description Crea un evento de compra completada.
 * @param {object} params - Datos de la compra.
 * @returns {TriggerEventoData} Evento creado.
 */
export function crearEventoCompraCompletada(params: {
  clienteId: string;
  tenantId: string;
  totalCompra: number;
  canal: string;
  segmento?: string;
}): TriggerEventoData {
  return {
    clienteId: params.clienteId,
    tenantId: params.tenantId,
    evento: 'COMPRA_COMPLETADA',
    datos: {
      totalCompra: params.totalCompra,
      canal: params.canal,
      segmento: params.segmento,
    },
  };
}

/**
 * @description Crea un evento de cumpleaños.
 * @param {object} params - Datos del cliente.
 * @returns {TriggerEventoData} Evento creado.
 */
export function crearEventoCumpleanos(params: {
  clienteId: string;
  tenantId: string;
  segmento?: string;
}): TriggerEventoData {
  return {
    clienteId: params.clienteId,
    tenantId: params.tenantId,
    evento: 'CUMPLEANOS',
    datos: {
      segmento: params.segmento,
    },
  };
}

/**
 * @description Crea un evento de tier alcanzado.
 * @param {object} params - Datos del tier.
 * @returns {TriggerEventoData} Evento creado.
 */
export function crearEventoTierAlcanzado(params: {
  clienteId: string;
  tenantId: string;
  nuevoTier: string;
}): TriggerEventoData {
  return {
    clienteId: params.clienteId,
    tenantId: params.tenantId,
    evento: 'TIER_ALCANZADO',
    datos: {
      nuevoTier: params.nuevoTier,
    },
  };
}

/**
 * @description Crea un evento de churn risk.
 * @param {object} params - Datos del churn.
 * @returns {TriggerEventoData} Evento creado.
 */
export function crearEventoChurnRisk(params: {
  clienteId: string;
  tenantId: string;
  probabilidad: number;
  riesgo: string;
}): TriggerEventoData {
  return {
    clienteId: params.clienteId,
    tenantId: params.tenantId,
    evento: 'CHURN_RISK',
    datos: {
      probabilidad: params.probabilidad,
      riesgo: params.riesgo,
    },
  };
}
