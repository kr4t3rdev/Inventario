/**
 * @description Tipos compartidos para Server Actions en Next.js 15+.
 *
 * Define el contrato de respuesta estandarizado que toda Server Action debe cumplir.
 */

/**
 * Respuesta estandarizada de toda Server Action.
 *
 * @template T - Tipo de datos devueltos en caso de éxito
 */
export interface ActionResponse<T = unknown> {
  /** Indica si la operación fue exitosa */
  success: boolean;
  /** Datos devueltos (solo presente si success es true) */
  data?: T;
  /** Información del error (solo presente si success es false) */
  error?: {
    /** Mensaje descriptivo para el usuario */
    message: string;
    /** Código de error para tratamiento programático */
    code?: string;
    /** Errores por campo (ej. errores de validación Zod) */
    details?: Record<string, string[]>;
  };
}

/**
 * Tipo de una Server Action envuelta con withAction.
 *
 * @template TInput - Tipo del input que recibe la acción
 * @template TOutput - Tipo de los datos que devuelve en caso de éxito
 */
export type ServerAction<TInput = void, TOutput = unknown> = (
  input: TInput
) => Promise<ActionResponse<TOutput>>;

/**
 * Error de dominio para Server Actions.
 *
 * Lanzá este error desde tus funciones de negocio para retornar
 * mensajes específicos al cliente sin exponer detalles internos.
 *
 * @example
 * throw new ActionError('Categoría no encontrada', 'NOT_FOUND')
 * // → { success: false, error: { message: 'Categoría no encontrada', code: 'NOT_FOUND' } }
 */
export class ActionError extends Error {
  /** Código de error para tratamiento programático */
  code: string;

  constructor(message: string, code: string = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'ActionError';
    this.code = code;
  }
}
