/**
 * @description Motor de segmentación automática de clientes.
 *
 * Evalúa las reglas de un segmento y determina si un cliente cumple
 * los criterios para ser asignado. Soporta reglas de RFM, comportamiento
 * y campos personalizados.
 *
 * @module features/crm/services/segmento-engine
 */

export type SegmentoTipo = 'MANUAL' | 'AUTOMATICO' | 'RFM';

export interface SegmentoReglas {
  recencia?: { min?: number; max?: number };
  frecuencia?: { min?: number; max?: number };
  monto?: { min?: number; max?: number };
  tags?: string[];
  canalPreferido?: string;
  segmento?: string;
  metadata?: Record<string, unknown>;
}

export interface ClienteDatos {
  diasDesdeUltimaCompra: number | null;
  totalCompras: number;
  totalGastado: number;
  tags: unknown[];
  canalPreferido: string | null;
  segmento: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * @description Evalúa si un cliente cumple las reglas de un segmento.
 * @param {SegmentoReglas} reglas - Reglas del segmento.
 * @param {ClienteDatos} cliente - Datos del cliente a evaluar.
 * @returns {boolean} True si el cliente cumple todas las reglas.
 */
export function cumpleSegmento(reglas: SegmentoReglas, cliente: ClienteDatos): boolean {
  // Si no hay reglas, todos cumplen
  if (!reglas || Object.keys(reglas).length === 0) return true;

  // Recencia: días desde última compra
  if (reglas.recencia) {
    const recencia = cliente.diasDesdeUltimaCompra;
    if (recencia === null) {
      // Sin compras: solo cumple si no hay min (es nuevo)
      if (reglas.recencia.min !== undefined) return false;
    } else {
      if (reglas.recencia.min !== undefined && recencia < reglas.recencia.min) return false;
      if (reglas.recencia.max !== undefined && recencia > reglas.recencia.max) return false;
    }
  }

  // Frecuencia: número de compras
  if (reglas.frecuencia) {
    if (reglas.frecuencia.min !== undefined && cliente.totalCompras < reglas.frecuencia.min) return false;
    if (reglas.frecuencia.max !== undefined && cliente.totalCompras > reglas.frecuencia.max) return false;
  }

  // Monetario: total gastado
  if (reglas.monto) {
    if (reglas.monto.min !== undefined && cliente.totalGastado < reglas.monto.min) return false;
    if (reglas.monto.max !== undefined && cliente.totalGastado > reglas.monto.max) return false;
  }

  // Tags: el cliente debe tener al menos uno de los tags
  if (reglas.tags && reglas.tags.length > 0) {
    const clienteTags = (cliente.tags || []) as string[];
    const tieneTag = reglas.tags.some((tag) => clienteTags.includes(tag));
    if (!tieneTag) return false;
  }

  // Canal preferido
  if (reglas.canalPreferido) {
    if (cliente.canalPreferido !== reglas.canalPreferido) return false;
  }

  // Segmento existente
  if (reglas.segmento) {
    if (cliente.segmento !== reglas.segmento) return false;
  }

  return true;
}

/**
 * @description Calcula los días desde la última compra.
 * @param {Date | null} ultimaCompra - Fecha de última compra.
 * @param {Date} ahora - Fecha actual (para testing).
 * @returns {number | null} Días transcurridos o null si nunca compró.
 */
export function calcularDiasDesdeUltimaCompra(
  ultimaCompra: Date | null,
  ahora: Date = new Date(),
): number | null {
  if (!ultimaCompra) return null;
  const diffMs = ahora.getTime() - ultimaCompra.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * @description Convierte los datos de un cliente Prisma al formato
 * necesario para evaluar segmentos.
 * @param {object} cliente - Cliente desde Prisma.
 * @param {Date} ahora - Fecha actual (para testing).
 * @returns {ClienteDatos} Datos normalizados para evaluación.
 */
export function normalizarClienteParaSegmento(
  cliente: {
    ultimaCompra: Date | null;
    cantidadCompras: number | null;
    totalComprado: number | null;
    tags: unknown[] | null;
    canalPreferido: string | null;
    segmento: string | null;
    metadata?: Record<string, unknown> | null;
  },
  ahora: Date = new Date(),
): ClienteDatos {
  return {
    diasDesdeUltimaCompra: calcularDiasDesdeUltimaCompra(cliente.ultimaCompra, ahora),
    totalCompras: cliente.cantidadCompras ?? 0,
    totalGastado: cliente.totalComprado ?? 0,
    tags: cliente.tags ?? [],
    canalPreferido: cliente.canalPreferido,
    segmento: cliente.segmento,
    metadata: cliente.metadata ?? {},
  };
}
