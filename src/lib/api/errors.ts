/**
 * @description Clase de error unificada para Server Actions.
 * Proporciona contexto completo (endpoint, método HTTP, status, mensaje y error original)
 * para todos los errores de Server Actions en el sistema.
 */
export class ServerActionError extends Error {
  public readonly endpoint: string
  public readonly method: string
  public readonly status: number
  public readonly originalError?: Error

  constructor(
    endpoint: string,
    method: string,
    status: number,
    message: string,
    originalError?: Error
  ) {
    super(message)
    this.name = 'ServerActionError'
    this.endpoint = endpoint
    this.method = method
    this.status = status
    this.originalError = originalError
  }
}
