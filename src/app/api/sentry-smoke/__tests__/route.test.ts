import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { captureException, logSafeOperationalEvent, flush, getCurrentUser, checkRateLimit } = vi.hoisted(() => ({
  captureException: vi.fn(),
  logSafeOperationalEvent: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
  getCurrentUser: vi.fn(),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 })),
}));

vi.mock('@sentry/nextjs', () => ({ captureException, flush }));
vi.mock('@/lib/observability/safe-sentry-logger', () => ({
  logSafeOperationalEvent,
}));
vi.mock('@/lib/server-actions/get-current-user', () => ({ getCurrentUser }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit }));

import { GET, POST } from '../route';

const originalEnv = {
  token: process.env.SENTRY_SMOKE_TOKEN,
  dsn: process.env.SENTRY_DSN,
  logs: process.env.SENTRY_ENABLE_LOGS,
  origin: process.env.SENTRY_SMOKE_ORIGIN,
  expiresAt: process.env.SENTRY_SMOKE_EXPIRES_AT,
};

const authenticatedUser = {
  userId: 'smoke-user',
  name: 'Smoke User',
  email: 'smoke@example.invalid',
  role: 'admin',
  isActive: true,
};

const ORIGIN = 'https://tcp.example.test';
const TOKEN = 'e'.repeat(64);

beforeEach(() => {
  getCurrentUser.mockResolvedValue(authenticatedUser);
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 });
});

afterEach(() => {
  vi.clearAllMocks();
  flush.mockResolvedValue(true);
  getCurrentUser.mockResolvedValue(authenticatedUser);
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 1, resetAt: Date.now() + 60_000 });
  if (originalEnv.token === undefined) delete process.env.SENTRY_SMOKE_TOKEN;
  else process.env.SENTRY_SMOKE_TOKEN = originalEnv.token;
  if (originalEnv.dsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = originalEnv.dsn;
  if (originalEnv.logs === undefined) delete process.env.SENTRY_ENABLE_LOGS;
  else process.env.SENTRY_ENABLE_LOGS = originalEnv.logs;
  if (originalEnv.origin === undefined) delete process.env.SENTRY_SMOKE_ORIGIN;
  else process.env.SENTRY_SMOKE_ORIGIN = originalEnv.origin;
  if (originalEnv.expiresAt === undefined) delete process.env.SENTRY_SMOKE_EXPIRES_AT;
  else process.env.SENTRY_SMOKE_EXPIRES_AT = originalEnv.expiresAt;
});

function configureSmoke(): void {
  process.env.SENTRY_SMOKE_TOKEN = TOKEN;
  process.env.SENTRY_DSN = 'https://example.invalid/1';
  process.env.SENTRY_ENABLE_LOGS = 'true';
  process.env.SENTRY_SMOKE_ORIGIN = ORIGIN;
  process.env.SENTRY_SMOKE_EXPIRES_AT = new Date(Date.now() + 60_000).toISOString();
}

function postRequest(
  body: BodyInit = new URLSearchParams({ token: TOKEN }).toString(),
  headers: Record<string, string> = {},
): Request {
  return new Request(`${ORIGIN}/api/sentry-smoke`, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/x-www-form-urlencoded',
      cookie: 'auth_token=browser-session',
      ...headers,
    },
    body,
  });
}

describe('GET /api/sentry-smoke', () => {
  it('requires authenticated session and returns a no-store password form', async () => {
    configureSmoke();

    const response = await GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('type="password"');
    expect(html).toContain('method="post"');
    expect(html).not.toContain(TOKEN);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-security-policy')).toContain("form-action 'self'");
    expect(getCurrentUser).toHaveBeenCalledOnce();
  });

  it('denies users without the global admin role', async () => {
    configureSmoke();
    getCurrentUser.mockResolvedValue({ ...authenticatedUser, role: 'user', tenantRole: 'manager' });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it('does not render a form for unauthenticated users', async () => {
    configureSmoke();
    getCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('');
  });
});

describe('POST /api/sentry-smoke', () => {
  it('fails closed when required configuration is missing', async () => {
    delete process.env.SENTRY_SMOKE_TOKEN;
    process.env.SENTRY_DSN = 'https://example.invalid/1';
    process.env.SENTRY_ENABLE_LOGS = 'true';
    process.env.SENTRY_SMOKE_ORIGIN = ORIGIN;
    process.env.SENTRY_SMOKE_EXPIRES_AT = new Date(Date.now() + 60_000).toISOString();

    const response = await POST(postRequest());

    expect(response.status).toBe(404);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('fails closed when the configured probe expiry is invalid or elapsed', async () => {
    configureSmoke();
    process.env.SENTRY_SMOKE_EXPIRES_AT = new Date(Date.now() - 1).toISOString();
    const expired = await POST(postRequest());
    process.env.SENTRY_SMOKE_EXPIRES_AT = 'not-a-date';
    const invalid = await POST(postRequest());
    process.env.SENTRY_SMOKE_EXPIRES_AT = new Date(Date.now() + 31 * 60_000).toISOString();
    const tooFarAhead = await POST(postRequest());

    expect(expired.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect(tooFarAhead.status).toBe(404);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('rejects a configured token outside the allowed length range', async () => {
    configureSmoke();
    process.env.SENTRY_SMOKE_TOKEN = 'short';

    const response = await POST(postRequest(new URLSearchParams({ token: 'short' }).toString()));

    expect(response.status).toBe(404);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('rejects a configured token above the maximum length', async () => {
    configureSmoke();
    process.env.SENTRY_SMOKE_TOKEN = 'x'.repeat(257);

    const response = await POST(postRequest());

    expect(response.status).toBe(404);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('requires an exact same-origin Origin header', async () => {
    configureSmoke();

    const response = await POST(postRequest(undefined, { origin: 'https://attacker.test' }));

    expect(response.status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('rejects wrong media types and oversized bodies before authentication or Sentry', async () => {
    configureSmoke();

    const wrongType = await POST(postRequest(undefined, { 'content-type': 'application/json' }));
    const tooLarge = await POST(postRequest('token=' + 'x'.repeat(5_000)));

    expect(wrongType.status).toBe(415);
    expect(tooLarge.status).toBe(413);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('rejects an incorrect token without exposing it in the URL', async () => {
    configureSmoke();
    const request = postRequest(new URLSearchParams({ token: 'wrong' }).toString());

    const response = await POST(request);

    expect(new URL(request.url).search).toBe('');
    expect(response.status).toBe(403);
    expect(await response.text()).toContain('Invalid');
    expect(getCurrentUser).toHaveBeenCalledOnce();
    expect(checkRateLimit).toHaveBeenCalledWith('smoke-user', '/api/sentry-smoke');
  });

  it('rejects duplicate token fields', async () => {
    configureSmoke();

    const response = await POST(postRequest(new URLSearchParams([
      ['token', TOKEN],
      ['token', TOKEN],
    ]).toString()));

    expect(response.status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('requires an authenticated browser session before running withAction', async () => {
    configureSmoke();
    getCurrentUser.mockResolvedValue(null);

    const response = await POST(postRequest());

    expect(response.status).toBe(401);
    expect(getCurrentUser).toHaveBeenCalledOnce();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('returns a controlled bad request for malformed UTF-8', async () => {
    configureSmoke();
    const request = postRequest(new Uint8Array([0xff, 0xfe]));

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('enforces global admin role, not tenant manager role', async () => {
    configureSmoke();
    getCurrentUser.mockResolvedValue({ ...authenticatedUser, role: 'user', tenantRole: 'manager' });

    const response = await POST(postRequest());

    expect(response.status).toBe(403);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('rate limits by authenticated user id before capturing an event', async () => {
    configureSmoke();
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const response = await POST(postRequest());

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith('smoke-user', '/api/sentry-smoke');
    expect(getCurrentUser).toHaveBeenCalledOnce();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('runs a real withAction failure and flushes the Sentry exception and operational log', async () => {
    configureSmoke();

    const response = await POST(postRequest());

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('Sentry smoke event accepted.');
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
    expect(checkRateLimit).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledOnce();
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(logSafeOperationalEvent).toHaveBeenCalledWith({
      event: 'tcp.operation.failed',
      runtime: 'server',
      result: 'failure',
    });
    expect(flush).toHaveBeenCalledWith(2_000);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('reports delivery timeout without claiming success', async () => {
    configureSmoke();
    flush.mockResolvedValue(false);

    const response = await POST(postRequest());

    expect(response.status).toBe(503);
  });
});
