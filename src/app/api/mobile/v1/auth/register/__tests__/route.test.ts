import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendEmailVerificationLink: vi.fn(),
}));

vi.mock('@/lib/auth/onboarding', () => ({
  signOnboardingToken: vi.fn(() => 'verification-token'),
}));

vi.mock('@/features/sales-agent/public-url', () => ({
  getConfiguredPublicAppUrl: vi.fn(() => 'https://app.test'),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: 0 })),
}));

import { prisma } from '@/lib/prisma';
import { sendEmailVerificationLink } from '@/lib/email';
import { signOnboardingToken } from '@/lib/auth/onboarding';
import { getConfiguredPublicAppUrl } from '@/features/sales-agent/public-url';
import { checkRateLimit } from '@/lib/rate-limit';
import { POST } from '../route';

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/mobile/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/mobile/v1/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 19, resetAt: 0 });
    vi.mocked(getConfiguredPublicAppUrl).mockReturnValue('https://app.test');
    vi.mocked(sendEmailVerificationLink).mockResolvedValue({ success: true } as never);
  });

  it('creates an inactive user and returns 201 with verification message', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ userId: 'user-new' } as never);

    const response = await POST(buildRequest({
      name: 'Ana Pérez',
      email: 'ANA@example.com',
      password: 'secreta123',
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({
      message: 'Revisá tu correo para verificar la cuenta y continuar con el onboarding',
      success: true,
    });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Ana Pérez',
        email: 'ana@example.com',
        isActive: false,
        onboardingStatus: 'pending_email_verification',
      }),
    }));
    const createdPassword: string = vi.mocked(prisma.user.create).mock.calls[0][0].data.password;
    expect(createdPassword).not.toContain('secreta123');
    expect(signOnboardingToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-new',
      email: 'ana@example.com',
      purpose: 'email-verification',
    }));
    expect(sendEmailVerificationLink).toHaveBeenCalledWith(
      'ana@example.com',
      expect.stringContaining('https://app.test/verify-email?token='),
      'Ana Pérez',
    );
  });

  it('returns 409 when the email is already registered', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ userId: 'user-existing' } as never);

    const response = await POST(buildRequest({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'secreta123',
    }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toMatchObject({ error: 'El usuario ya existe', code: 'USER_EXISTS' });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email or short password', async () => {
    const badEmail = await POST(buildRequest({ name: 'Ana', email: 'no-es-email', password: 'secreta123' }));
    expect(badEmail.status).toBe(400);
    expect(await badEmail.json()).toMatchObject({ code: 'VALIDATION_ERROR' });

    const shortPassword = await POST(buildRequest({ name: 'Ana', email: 'ana@example.com', password: 'corta' }));
    expect(shortPassword.status).toBe(400);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('returns 429 when the rate limiter rejects the request', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });

    const response = await POST(buildRequest({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'secreta123',
    }));

    expect(response.status).toBe(429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 503 when no public verification URL is configured', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ userId: 'user-new' } as never);
    vi.mocked(getConfiguredPublicAppUrl).mockReturnValue(null);

    const response = await POST(buildRequest({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'secreta123',
    }));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({ code: 'VERIFICATION_UNAVAILABLE' });
  });
});
