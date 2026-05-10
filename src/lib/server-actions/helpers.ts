/**
 * @description Utilidades para trabajar con ActionResponse de forma segura.
 *
 * Proporciona funciones para desempaquetar y castear ActionResponse sin
 * necesidad de repetir patrones de casting en cada archivo.
 */

import { type ActionResponse } from './types'

/**
 * Extrae `.data` de una ActionResponse manteniendo la tipificación.
 *
 * @description
 * Desempaqueta ActionResponse<T> → T | undefined
 * Si la respuesta falló o no tiene data, retorna undefined.
 *
 * @template T - Tipo de datos envueltos
 * @param response - ActionResponse a desempaquetar
 * @returns Los datos desempaquetados o undefined
 *
 * @example
 * const result = await getClientesAction({})
 * const clientes = unwrapActionResponse(result) // ActionResponse<Cliente[]> → Cliente[] | undefined
 */
export function unwrapActionResponse<T>(
  response: ActionResponse<T> | undefined
): T | undefined {
  if (!response || !response.success) {
    return undefined
  }
  return response.data
}

/**
 * Extrae `.data` de ActionResponse con valor por defecto.
 *
 * @description
 * Desempaqueta ActionResponse<T> → T
 * Si la respuesta falló o no tiene data, retorna el valor por defecto.
 *
 * @template T - Tipo de datos envueltos
 * @param response - ActionResponse a desempaquetar
 * @param defaultValue - Valor retornado si la respuesta es falsa o vacía
 * @returns Los datos desempaquetados o el valor por defecto
 *
 * @example
 * const clientes = unwrapActionResponseWithDefault(
 *   await getClientesAction({}),
 *   []
 * ) // ActionResponse<Cliente[]> → Cliente[]
 */
export function unwrapActionResponseWithDefault<T>(
  response: ActionResponse<T> | undefined,
  defaultValue: T
): T {
  if (!response || !response.success) {
    return defaultValue
  }
  return response.data ?? defaultValue
}

/**
 * Castea ActionResponse<T> a un tipo específico con seguridad.
 *
 * @description
 * Combina unwrap + casting en una sola operación para casos donde
 * necesitamos garantizar un tipo específico pero permitir undefined.
 *
 * @template T - Tipo de destino
 * @param response - ActionResponse a desempaquetar y castear
 * @returns Datos casteados como T | undefined
 *
 * @example
 * const clientes = unsafeUnwrapAs<Cliente[]>(result)
 * // Usa en último recurso cuando el tipo genérico de ActionResponse no está disponible
 */
export function unsafeUnwrapAs<T>(
  response: ActionResponse<unknown> | undefined
): T | undefined {
  if (!response || !response.success) {
    return undefined
  }
  return (response.data as unknown as T) ?? undefined
}
