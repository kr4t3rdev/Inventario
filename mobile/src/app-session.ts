import { createSecureSessionStorage } from './secure-storage';
import { SessionManager } from './session-manager';
import { createGeneratedAuthClient } from './sdk-client';

/**
 * @description Builds the reference session manager from runtime API configuration.
 * @param {string} baseUrl - API origin or mobile v1 base path.
 * @returns {SessionManager} Configured session manager.
 */
export function createAppSessionManager(baseUrl: string): SessionManager {
  let manager: SessionManager | undefined;
  const client = createGeneratedAuthClient(baseUrl, () => manager?.getAccessToken() ?? null);
  manager = new SessionManager({ client, storage: createSecureSessionStorage() });
  return manager;
}
