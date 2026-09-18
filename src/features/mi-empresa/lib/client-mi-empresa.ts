import {
  fetchClientAuthJson,
  type ClientAuthFetchResult,
} from '@/lib/client-auth-fetch';
import type { MiEmpresaFormValues, MiEmpresaApiResponse } from './miEmpresaUtils';

interface MiEmpresaUpdateResponse {
  data: MiEmpresaApiResponse;
  message?: string;
}

export function fetchMiEmpresaSettings(
  clearState?: () => void,
): Promise<ClientAuthFetchResult<MiEmpresaApiResponse | null>> {
  return fetchClientAuthJson<MiEmpresaApiResponse | null>('/api/mi-empresa', {
    clearState,
    defaultErrorMessage: 'Error al cargar Mi Empresa',
  });
}

export function updateMiEmpresaSettings(
  input: Record<string, unknown> | MiEmpresaFormValues,
  clearState?: () => void,
): Promise<ClientAuthFetchResult<MiEmpresaUpdateResponse>> {
  return fetchClientAuthJson<MiEmpresaUpdateResponse>('/api/mi-empresa', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    clearState,
    defaultErrorMessage: 'Error al actualizar Mi Empresa',
  });
}
