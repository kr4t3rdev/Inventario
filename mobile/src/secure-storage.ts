import * as SecureStore from 'expo-secure-store';
import type { SecureSessionStorage } from './session-manager';

const REFRESH_TOKEN_KEY = 'tcp.mobile.refresh-token';

/**
 * @description Adapts Expo SecureStore to the session manager's injectable storage boundary.
 * @returns {SecureSessionStorage} Secure refresh-token storage implementation.
 */
export function createSecureSessionStorage(): SecureSessionStorage {
  return {
    getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    replaceRefreshToken: async (refreshToken) => {
      if (refreshToken === null) {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        return;
      }
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    },
  };
}
