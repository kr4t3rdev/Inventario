import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuthenticatedUser, AuthSession, TokenPair } from '../../sdks/mobile-v1/typescript/src/models';
import { SessionManager, type AuthClient, type SecureSessionStorage } from './session-manager';

const token = (value: string) => ({ token: value, expiresInSeconds: 3600 });
const user: AuthenticatedUser = { userId: 'user-1', email: 'user@example.com' };
const session = (access: string, refresh: string): AuthSession => ({
  accessToken: token(access),
  refreshToken: token(refresh),
  user,
});
const pair = (access: string, refresh: string): TokenPair => ({
  accessToken: token(access),
  refreshToken: token(refresh),
});

class MemoryStorage implements SecureSessionStorage {
  value?: string;
  writes: string[] = [];

  async getRefreshToken(): Promise<string | null> {
    return this.value ?? null;
  }

  async replaceRefreshToken(refreshToken: string | null): Promise<void> {
    this.writes.push(refreshToken ?? '');
    this.value = refreshToken ?? undefined;
  }
}

function createClient(overrides: Partial<AuthClient> = {}): AuthClient {
  return {
    login: vi.fn(async () => session('access-1', 'refresh-1')),
    refresh: vi.fn(async () => pair('access-2', 'refresh-2')),
    switchTenant: vi.fn(async () => ({ ...pair('access-3', 'refresh-3'), tenantId: 'tenant-2' })),
    logout: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('SessionManager', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('logs in without persisting the password and keeps access token in memory', async () => {
    const client = createClient();
    const manager = new SessionManager({ client, storage });

    const snapshot = await manager.login('user@example.com', 'not-persisted');

    expect(storage.value).toBe('refresh-1');
    expect(storage.writes).toEqual(['refresh-1']);
    expect(manager.getAccessToken()).toBe('access-1');
    expect(storage.value).not.toContain('not-persisted');
    expect(snapshot).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(snapshot)).not.toContain('refresh-1');
  });

  it('clears an active session after a failed login without logging tokens', async () => {
    const logs: string[] = [];
    const client = createClient({
      login: vi.fn()
        .mockResolvedValueOnce(session('access-1', 'refresh-1'))
        .mockRejectedValueOnce(new Error('invalid credentials')),
    });
    const manager = new SessionManager({
      client,
      storage,
      logger: { warn: (message) => logs.push(message) },
    });

    await manager.login('user@example.com', 'password');
    await expect(manager.login('user@example.com', 'wrong-password')).rejects.toThrow('Session expired');

    expect(manager.getAccessToken()).toBeNull();
    expect(storage.value).toBeUndefined();
    expect(storage.writes).toEqual(['refresh-1', '']);
    expect(JSON.stringify(logs)).not.toContain('access-1');
    expect(JSON.stringify(logs)).not.toContain('refresh-1');
  });

  it('keeps explicit light and dark theme tokens in the native app', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'mobile/App.tsx'), 'utf8');

    expect(appSource).toContain('useColorScheme');
    for (const palette of ['lightTheme', 'darkTheme']) {
      expect(appSource).toContain(palette);
    }
    for (const token of ['background', 'text', 'border', 'error']) {
      expect(appSource).toContain(token);
    }
  });

  it('reloads a persisted refresh token and rotates into an authenticated session', async () => {
    storage.value = 'refresh-from-storage';
    const client = createClient({ refresh: vi.fn(async () => pair('access-after-reload', 'refresh-after-reload')) });
    const manager = new SessionManager({ client, storage });

    const result = await manager.restore();

    expect(result?.accessToken).toBe('access-after-reload');
    expect(result).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(result)).not.toContain('refresh-after-reload');
    expect(manager.getAccessToken()).toBe('access-after-reload');
    expect(storage.value).toBe('refresh-after-reload');
    expect(client.refresh).toHaveBeenCalledWith('refresh-from-storage');
  });

  it('replaces access and refresh tokens together during refresh rotation', async () => {
    const client = createClient();
    const manager = new SessionManager({ client, storage });
    await manager.login('user@example.com', 'password');

    const result = await manager.refresh();

    expect(manager.getAccessToken()).toBe('access-2');
    expect(storage.value).toBe('refresh-2');
    expect(storage.writes).toEqual(['refresh-1', 'refresh-2']);
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('replaces both tokens when switching tenant', async () => {
    const client = createClient();
    const manager = new SessionManager({ client, storage });
    await manager.login('user@example.com', 'password');

    const result = await manager.switchTenant('tenant-2');

    expect(result.user?.tenantId).toBe('tenant-2');
    expect(result).not.toHaveProperty('refreshToken');
    expect(manager.getAccessToken()).toBe('access-3');
    expect(storage.value).toBe('refresh-3');
  });

  it('clears local session after tenant switching returns 401', async () => {
    const client = createClient({
      switchTenant: vi.fn(async () => {
        throw Object.assign(new Error('unauthorized'), { response: { status: 401 } });
      }),
    });
    const manager = new SessionManager({ client, storage });
    await manager.login('user@example.com', 'password');

    await expect(manager.switchTenant('tenant-2')).rejects.toThrow('Session expired');

    expect(manager.getAccessToken()).toBeNull();
    expect(storage.value).toBeUndefined();
  });

  it('logs out remotely when possible and clears local session', async () => {
    const client = createClient();
    const manager = new SessionManager({ client, storage });
    await manager.login('user@example.com', 'password');

    await manager.logout();

    expect(client.logout).toHaveBeenCalledOnce();
    expect(manager.getAccessToken()).toBeNull();
    expect(storage.value).toBeUndefined();
  });

  it('clears local session without calling remote logout when data access is unauthorized', async () => {
    const client = createClient();
    const manager = new SessionManager({ client, storage });
    await manager.login('user@example.com', 'password');

    await manager.clearLocalSession();

    expect(client.logout).not.toHaveBeenCalled();
    expect(manager.getAccessToken()).toBeNull();
    expect(storage.value).toBeUndefined();
  });

  it('clears local session when remote logout fails', async () => {
    const client = createClient({ logout: vi.fn(async () => { throw new Error('network'); }) });
    const manager = new SessionManager({ client, storage });
    await manager.login('user@example.com', 'password');

    await expect(manager.logout()).rejects.toThrow('network');

    expect(manager.getAccessToken()).toBeNull();
    expect(storage.value).toBeUndefined();
  });

  it('clears local session after a 401 and does not leak secrets to logs', async () => {
    const logs: unknown[][] = [];
    const client = createClient({
      refresh: vi.fn(async () => {
        throw Object.assign(new Error('unauthorized'), { response: { status: 401 } });
      }),
    });
    const manager = new SessionManager({ client, storage, logger: { warn: (...args) => logs.push(args) } });
    await manager.login('user@example.com', 'password');

    await expect(manager.refresh()).rejects.toThrow('Session expired');

    expect(manager.getAccessToken()).toBeNull();
    expect(storage.value).toBeUndefined();
    expect(JSON.stringify(logs)).not.toContain('access-1');
    expect(JSON.stringify(logs)).not.toContain('refresh-1');
  });
});
