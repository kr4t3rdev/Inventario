/**
 * @description Estados de órdenes de producción
 * @note Siempre UPPERCASE con underscore para coincidir con Prisma enum
 */
export const PRODUCTION_STATES = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN_PROCESO',
  COMPLETADA: 'COMPLETADA',
  CANCELADA: 'CANCELADA',
} as const;

export type ProductionState = keyof typeof PRODUCTION_STATES;

/**
 * @description Labels legibles para estados
 */
export const PRODUCTION_STATE_LABELS: Record<ProductionState, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

/**
 * @description Variantes de estilo para badges de estado
 */
export const PRODUCTION_STATE_COLORS: Record<ProductionState, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-900 border border-yellow-300',
  EN_PROCESO: 'bg-blue-100 text-blue-900 border border-blue-300',
  COMPLETADA: 'bg-green-100 text-green-900 border border-green-300',
  CANCELADA: 'bg-red-100 text-red-900 border border-red-300',
};
