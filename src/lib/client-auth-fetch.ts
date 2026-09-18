export interface ClientAuthFetchError {
  message: string;
  code?: string;
  status: number;
}

export type ClientAuthFetchResult<T> =
  | {
      success: true;
      data: T;
      status: number;
      shouldClearState: false;
    }
  | {
      success: false;
      error: ClientAuthFetchError;
      status: number;
      shouldClearState: boolean;
    };

interface FetchClientAuthJsonOptions extends Omit<RequestInit, 'headers'> {
  headers?: HeadersInit;
  clearState?: () => void;
  defaultErrorMessage?: string;
  resetOnStatuses?: number[];
  resetOnCodes?: string[];
}

const DEFAULT_RESET_STATUSES = [401, 403];
const DEFAULT_RESET_CODES = [
  'AUTH_REQUIRED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NO_TENANT',
  'STALE_CLIENT_VERSION',
];

/**
 * @description Determina si una respuesta debe invalidar estado cliente potencialmente stale.
 * @param {number} status - Código HTTP de la respuesta.
 * @param {string | undefined} code - Código de error del payload JSON.
 * @param {number[]} resetOnStatuses - Status que fuerzan limpieza.
 * @param {string[]} resetOnCodes - Códigos lógicos que fuerzan limpieza.
 * @returns {boolean} True si corresponde limpiar estado cliente.
 */
export function shouldClearClientAuthState(
  status: number,
  code: string | undefined,
  resetOnStatuses: number[] = DEFAULT_RESET_STATUSES,
  resetOnCodes: string[] = DEFAULT_RESET_CODES,
): boolean {
  if (resetOnStatuses.includes(status)) {
    return true;
  }

  if (!code) {
    return false;
  }

  return resetOnCodes.includes(code);
}

/**
 * @description Ejecuta un fetch browser-safe para rutas autenticadas y normaliza errores/limpieza de estado.
 * @param {RequestInfo | URL} input - URL de la ruta estable.
 * @param {FetchClientAuthJsonOptions} options - Configuración del request y estrategia de limpieza.
 * @returns {Promise<ClientAuthFetchResult<T>>} Resultado normalizado del request.
 */
export async function fetchClientAuthJson<T>(
  input: RequestInfo | URL,
  options: FetchClientAuthJsonOptions = {},
): Promise<ClientAuthFetchResult<T>> {
  const {
    clearState,
    defaultErrorMessage = 'Error al procesar la solicitud',
    resetOnStatuses = DEFAULT_RESET_STATUSES,
    resetOnCodes = DEFAULT_RESET_CODES,
    headers,
    credentials,
    ...init
  } = options;

  try {
    const response = await fetch(input, {
      credentials: credentials ?? 'include',
      ...init,
      headers: {
        ...(init.method === undefined || init.method === 'GET'
          ? { 'cache-control': 'no-store' }
          : {}),
        ...headers,
      },
    });

    const payload = await response.json().catch(() => null) as
      | T
      | { error?: string; code?: string }
      | null;

    if (response.ok) {
      return {
        success: true,
        data: (payload ?? {}) as T,
        status: response.status,
        shouldClearState: false,
      };
    }

    const code = payload && typeof payload === 'object' && 'code' in payload
      ? String(payload.code)
      : undefined;
    const message = payload && typeof payload === 'object' && 'error' in payload && payload.error
      ? String(payload.error)
      : defaultErrorMessage;
    const shouldClearState = shouldClearClientAuthState(
      response.status,
      code,
      resetOnStatuses,
      resetOnCodes,
    );

    if (shouldClearState) {
      clearState?.();
    }

    return {
      success: false,
      error: {
        message,
        code,
        status: response.status,
      },
      status: response.status,
      shouldClearState,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : defaultErrorMessage,
        status: 0,
      },
      status: 0,
      shouldClearState: false,
    };
  }
}
