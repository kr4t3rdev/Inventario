import { describe, expect, it } from 'vitest';
import { createGeneratedAuthClient, normalizeBasePath } from './sdk-client';

describe('generated SDK adapter', () => {
  it('uses a configurable API base URL without a production default', () => {
    expect(normalizeBasePath('http://localhost:3000/')).toBe('http://localhost:3000/api/mobile/v1');
    expect(normalizeBasePath('https://example.test/api/mobile/v1')).toBe('https://example.test/api/mobile/v1');
  });

  it('passes the configurable base URL to the generated SDK', async () => {
    let requestedUrl = '';
    const fetchApi = async (input: RequestInfo | URL): Promise<Response> => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        accessToken: { token: 'access', expiresInSeconds: 3600 },
        refreshToken: { token: 'refresh', expiresInSeconds: 3600 },
        user: { userId: 'user-1', email: 'user@example.com' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    await createGeneratedAuthClient('https://example.test', () => null, fetchApi)
      .login('user@example.com', 'password');

    expect(requestedUrl).toBe('https://example.test/api/mobile/v1/auth/login');
  });
});
