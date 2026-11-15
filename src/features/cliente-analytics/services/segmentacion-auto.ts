/**
 * @description Segmentación automática basada en RFM.
 *
 * Asigna segmentos RFM a clientes y actualiza los registros
 * de ClienteAnalytics y ClienteSegmento.
 *
 * @module features/cliente-analytics/services/segmentacion-auto
 */
import type { ClienteRFMSegmento } from './rfm-calculator';
import { calcularRFMCompleto, diasDesdeUltimaCompra } from './rfm-calculator';

export interface ClienteDatos {
  clienteId: string;
  ultimaCompra: Date | null;
  totalComprado: number; // centavos
  cantidadCompras: number;
}

export interface SegmentacionResultado {
  clienteId: string;
  segmento: ClienteRFMSegmento;
  scoreLealtad: number;
  recenciaScore: number;
  frecuenciaScore: number;
  monetarioScore: number;
}

/**
 * @description Segmenta automáticamente un cliente basado en sus datos RFM.
 * @param {ClienteDatos} cliente - Datos del cliente.
 * @param {Date} ahora - Fecha de referencia.
 * @returns {SegmentacionResultado} Resultado de segmentación.
 */
export function segmentarCliente(cliente: ClienteDatos, ahora: Date = new Date()): SegmentacionResultado {
  const recencia = diasDesdeUltimaCompra(cliente.ultimaCompra, ahora);
  const frecuencia = cliente.cantidadCompras;
  const monetario = cliente.totalComprado;

  const rfm = calcularRFMCompleto({ recencia, frecuencia, monetario });

  return {
    clienteId: cliente.clienteId,
    segmento: rfm.segmento,
    scoreLealtad: rfm.scoreLealtad,
    recenciaScore: rfm.recenciaScore,
    frecuenciaScore: rfm.frecuenciaScore,
    monetarioScore: rfm.monetarioScore,
  };
}

/**
 * @description Segmenta múltiples clientes en lote.
 * @param {ClienteDatos[]} clientes - Lista de clientes.
 * @param {Date} ahora - Fecha de referencia.
 * @returns {SegmentacionResultado[]} Resultados de segmentación.
 */
export function segmentarClientes(
  clientes: ClienteDatos[],
  ahora: Date = new Date()
): SegmentacionResultado[] {
  return clientes.map((cliente) => segmentarCliente(cliente, ahora));
}

/**
 * @description Agrupa los resultados por segmento.
 * @param {SegmentacionResultado[]} resultados - Resultados de segmentación.
 * @returns {Record<string, number>} Conteo por segmento.
 */
export function distribucionSegmentos(resultados: SegmentacionResultado[]): Record<string, number> {
  const distribucion: Record<string, number> = {};
  for (const r of resultados) {
    distribucion[r.segmento] = (distribucion[r.segmento] || 0) + 1;
  }
  return distribucion;
}

/**
 * @description Filtra clientes por segmento.
 * @param {SegmentacionResultado[]} resultados - Resultados de segmentación.
 * @param {ClienteRFMSegmento} segmento - Segmento a filtrar.
 * @returns {string[]} IDs de clientes en el segmento.
 */
export function clientesPorSegmento(
  resultados: SegmentacionResultado[],
  segmento: ClienteRFMSegmento
): string[] {
  return resultados
    .filter((r) => r.segmento === segmento)
    .map((r) => r.clienteId);
}

/**
 * @description Obtiene los clientes con mayor score de lealtad.
 * @param {SegmentacionResultado[]} resultados - Resultados de segmentación.
 * @param {number} topN - Cantidad de clientes top.
 * @returns {SegmentacionResultado[]} Top N clientes por score.
 */
export function topClientesPorScore(
  resultados: SegmentacionResultado[],
  topN: number = 10
): SegmentacionResultado[] {
  return [...resultados]
    .sort((a, b) => b.scoreLealtad - a.scoreLealtad)
    .slice(0, topN);
}
