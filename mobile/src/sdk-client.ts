import { AuthApi, Configuration } from '../../sdks/mobile-v1/typescript/src';
import type { FetchAPI } from '../../sdks/mobile-v1/typescript/src/runtime';
import type { AuthClient } from './session-manager';

/**
 * @description Creates an AuthClient backed by the generated TypeScript mobile SDK.
 * @param {string} baseUrl - API origin or complete mobile v1 base path from runtime config.
 * @param {() => string | null} getAccessToken - Access-token provider kept in memory by the session manager.
 * @param {FetchAPI} fetchApi - Optional fetch implementation for tests or platform adapters.
 * @returns {AuthClient} Session-focused SDK adapter.
 */
export function createGeneratedAuthClient(
  baseUrl: string,
  getAccessToken: () => string | null,
  fetchApi?: FetchAPI,
): AuthClient {
  const configuration = new Configuration({
    basePath: normalizeBasePath(baseUrl),
    accessToken: () => getAccessToken() ?? '',
    fetchApi,
  });
  const api = new AuthApi(configuration);

  return {
    login: async (email, password) => api.mobilePostAuthLogin({ loginRequest: { email, password } }),
    refresh: async (refreshToken) => api.mobilePostAuthRefresh({ refreshRequest: { refreshToken } }),
    switchTenant: async (tenantId, accessToken) => {
      const tenantApi = new AuthApi(new Configuration({
        basePath: normalizeBasePath(baseUrl),
        accessToken,
        fetchApi,
      }));
      return tenantApi.mobilePostAuthTenants({ switchTenantRequest: { tenantId } });
    },
    logout: async (accessToken) => {
      const logoutApi = new AuthApi(new Configuration({
        basePath: normalizeBasePath(baseUrl),
        accessToken,
        fetchApi,
      }));
      await logoutApi.mobilePostAuthLogout();
    },
  };
}

/**
 * @description Normalizes an API origin into the generated SDK's mobile v1 base path.
 * @param {string} baseUrl - Configured API origin or mobile v1 base path.
 * @returns {string} SDK base path without a trailing slash.
 */
export function normalizeBasePath(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/api/mobile/v1') ? normalized : `${normalized}/api/mobile/v1`;
}
