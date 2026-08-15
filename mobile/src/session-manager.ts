import type {
  AuthSession,
  AuthenticatedUser,
  SwitchTenantResponse,
  TokenPair,
} from '../../sdks/mobile-v1/typescript/src/models';

export interface SecureSessionStorage {
  getRefreshToken(): Promise<string | null>;
  replaceRefreshToken(refreshToken: string | null): Promise<void>;
}

export interface AuthClient {
  login(email: string, password: string): Promise<AuthSession>;
  refresh(refreshToken: string): Promise<TokenPair>;
  switchTenant(tenantId: string, accessToken: string): Promise<SwitchTenantResponse>;
  logout(accessToken: string): Promise<void>;
}

export interface SessionLogger {
  warn(message: string): void;
}

export interface SessionManagerOptions {
  client: AuthClient;
  storage: SecureSessionStorage;
  logger?: SessionLogger;
}

export interface SessionSnapshot {
  accessToken: string;
  user: AuthenticatedUser | null;
}

/**
 * @description Manages the mobile access-token memory and refresh-token storage boundary.
 * @param {SessionManagerOptions} options - SDK client, secure storage, and optional redacted logger.
 * @returns {SessionManager} Session lifecycle manager.
 */
export class SessionManager {
  private accessToken: string | null = null;
  private user: AuthenticatedUser | null = null;
  private readonly client: AuthClient;
  private readonly storage: SecureSessionStorage;
  private readonly logger: SessionLogger;

  constructor({ client, storage, logger = { warn: () => undefined } }: SessionManagerOptions) {
    this.client = client;
    this.storage = storage;
    this.logger = logger;
  }

  /**
   * @description Authenticates and persists only the refresh token.
   * @param {string} email - Account email.
   * @param {string} password - Account password, never persisted by this manager.
   * @returns {Promise<SessionSnapshot>} Authenticated session snapshot.
   */
  async login(email: string, password: string): Promise<SessionSnapshot> {
    try {
      const result = await this.client.login(email, password);
      await this.commitTokens(result.accessToken.token, result.refreshToken.token);
      this.user = result.user;
      return this.snapshot();
    } catch (error) {
      return this.failAuth(error, 'Login failed');
    }
  }

  /**
   * @description Restores a session by rotating the persisted refresh token.
   * @returns {Promise<SessionSnapshot | null>} Restored session or null without a stored token.
   */
  async restore(): Promise<SessionSnapshot | null> {
    const refreshToken = await this.storage.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const result = await this.client.refresh(refreshToken);
      await this.commitTokens(result.accessToken.token, result.refreshToken.token);
      return this.snapshot();
    } catch (error) {
      return this.failAuth(error, 'Unable to restore session');
    }
  }

  /**
   * @description Rotates both session tokens using the persisted refresh token.
   * @returns {Promise<SessionSnapshot>} Updated session snapshot.
   */
  async refresh(): Promise<SessionSnapshot> {
    const refreshToken = await this.storage.getRefreshToken();
    if (!refreshToken) throw new Error('No active session');

    try {
      const result = await this.client.refresh(refreshToken);
      await this.commitTokens(result.accessToken.token, result.refreshToken.token);
      return this.snapshot();
    } catch (error) {
      return this.failAuth(error, 'Session refresh failed');
    }
  }

  /**
   * @description Switches tenant and atomically replaces the token pair.
   * @param {string} tenantId - Target tenant identifier.
   * @returns {Promise<SwitchTenantResponse>} Token response for the selected tenant.
   */
  async switchTenant(tenantId: string): Promise<SessionSnapshot> {
    if (!this.accessToken) throw new Error('No active session');
    try {
      const result = await this.client.switchTenant(tenantId, this.accessToken);
      await this.commitTokens(result.accessToken.token, result.refreshToken.token);
      this.user = this.user
        ? { ...this.user, tenantId: result.tenantId, tenantRole: result.tenantRole }
        : null;
      return this.snapshot();
    } catch (error) {
      return this.failAuth(error, 'Tenant switch failed');
    }
  }

  /**
   * @description Revokes the remote session when possible and always clears local credentials.
   * @returns {Promise<void>} Resolves after local cleanup.
   */
  async logout(): Promise<void> {
    try {
      if (this.accessToken) await this.client.logout(this.accessToken);
    } finally {
      await this.clearSession('Logged out');
    }
  }

  /**
   * @description Clears local credentials without calling the remote logout endpoint.
   * @returns {Promise<void>} Resolves after secure local storage is cleared.
   */
  async clearLocalSession(): Promise<void> {
    await this.clearSession('Local session cleared');
  }

  /**
   * @description Returns the in-memory access token for authorized SDK requests.
   * @returns {string | null} Access token or null when signed out.
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * @description Replaces the persistent refresh token before updating in-memory access state.
   * @param {string} accessToken - New access token kept in memory.
   * @param {string} refreshToken - New refresh token stored securely.
   * @returns {Promise<void>} Resolves after the storage write succeeds.
   */
  private async commitTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.storage.replaceRefreshToken(refreshToken);
    this.accessToken = accessToken;
  }

  /**
   * @description Clears all locally held authentication state without logging secrets.
   * @param {string} message - Safe diagnostic message.
   * @returns {Promise<void>} Resolves after secure storage is cleared.
   */
  private async clearSession(message: string): Promise<void> {
    this.accessToken = null;
    this.user = null;
    await this.storage.replaceRefreshToken(null);
    this.logger.warn(message);
  }

  /**
   * @description Creates a session snapshot without exposing secure credentials.
   * @returns {SessionSnapshot} Safe session state.
   */
  private snapshot(): SessionSnapshot {
    return { accessToken: this.accessToken as string, user: this.user };
  }

  /**
   * @description Clears local credentials and converts an authentication failure to a safe error.
   * @param {unknown} error - SDK failure retained only as the error cause.
   * @param {string} message - Safe diagnostic message.
   * @returns {Promise<never>} Never resolves because authentication failed.
   */
  private async failAuth(error: unknown, message: string): Promise<never> {
    await this.clearSession(message);
    throw this.sessionExpiredError(error);
  }

  /**
   * @description Converts SDK failures into a stable auth error while preserving the original cause.
   * @param {unknown} error - SDK failure.
   * @returns {Error} Safe session-expired error.
   */
  private sessionExpiredError(error: unknown): Error {
    const safeError = new Error('Session expired');
    safeError.cause = error;
    return safeError;
  }
}
