import { afterEach, describe, expect, it, vi } from 'vitest';

import { getConfiguredPublicAppUrl } from '../public-url';

describe('getConfiguredPublicAppUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns the canonical configured HTTPS origin in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/base/');

    expect(getConfiguredPublicAppUrl()).toBe('https://app.example.com');
  });

  it('fails safely for missing or non-HTTPS production configuration', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(getConfiguredPublicAppUrl()).toBeNull();

    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://attacker.example');
    expect(getConfiguredPublicAppUrl()).toBeNull();
  });

  it('allows HTTP only for localhost during development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    expect(getConfiguredPublicAppUrl()).toBe('http://localhost:3000');

    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://example.com');
    expect(getConfiguredPublicAppUrl()).toBeNull();
  });
});
