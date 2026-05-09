import { ServerActionError } from '@/lib/api/errors'

/**
 * @description Maneja errores en Server Actions de manera uniforme.
 * Si el error ya es un ServerActionError, lo re-lanza.
 * Si es un Error común, lo envuelve en ServerActionError con status 500.
 * Si es un valor desconocido, usa un mensaje genérico.
 * @param error - El error capturado (unknown)
 * @param action - Nombre de la acción para contexto
 * @throws {ServerActionError} Siempre, nunca retorna
 */
export function handleServerActionError(
  error: unknown,
  action: string
): never {
  if (error instanceof ServerActionError) {
    throw error
  }

  if (error instanceof Error) {
    throw new ServerActionError(
      action,
      'UNKNOWN',
      500,
      error.message,
      error
    )
  }

  throw new ServerActionError(
    action,
    'UNKNOWN',
    500,
    'An unexpected error occurred'
  )
}
