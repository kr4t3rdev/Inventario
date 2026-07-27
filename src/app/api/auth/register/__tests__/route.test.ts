import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { sendEmailVerificationLink } from '@/lib/email';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    affiliateProfile: {
      findUnique: vi.fn(),
    },
    salesAgentProfile: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth/onboarding', () => ({
  validateCSRF: vi.fn(() => ({ valid: true })),
  signOnboardingToken: vi.fn(() => 'verification-token'),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
}));

vi.mock('@/lib/email', () => ({
  sendEmailVerificationLink: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}));

describe('/api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve 500 cuando falla el envío del correo de verificación', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(sendEmailVerificationLink).mockRejectedValueOnce(new Error('Invalid login'));

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({
        name: 'Nuevo Usuario',
        email: 'new@test.com',
        password: '123456',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Error interno del servidor');
  });

  it('guarda pendingReferralCode cuando llega un referral code válido', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValueOnce({
      affiliateProfileId: 'profile-1',
      isEligible: true,
      status: 'active',
    } as never);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(sendEmailVerificationLink).mockResolvedValueOnce({ success: true } as never);

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({
        name: 'Nuevo Usuario',
        email: 'new-ref@test.com',
        password: '123456',
        referralCode: 'REF-VALID',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingReferralCode: 'REF-VALID',
        }),
      }),
    );
  });

  it('rechaza referral code inválido', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValueOnce(null as never);

    const request = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({
        name: 'Nuevo Usuario',
        email: 'new-invalid-ref@test.com',
        password: '123456',
        referralCode: 'REF-INVALID',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Código de referido inválido o inactivo');
  });

  it('acepta un código activo de Gestor de Ventas sin revelar su propietario', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValueOnce({
      salesAgentProfileId: 'sales-profile-1',
      status: 'active',
    } as never);
    vi.mocked(prisma.user.create).mockResolvedValueOnce({ userId: 'user-1' } as never);
    vi.mocked(sendEmailVerificationLink).mockResolvedValueOnce({ success: true } as never);

    const response = await POST(new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.5',
      },
      body: JSON.stringify({
        name: 'Nuevo Usuario',
        email: 'sales-ref@test.com',
        password: '123456',
        referralCode: 'SA-ACTIVE',
      }),
    }));

    expect(response.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pendingReferralCode: 'SA-ACTIVE' }),
      }),
    );
  });

  it('rechaza de forma genérica un código que colisiona entre ambos programas', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.affiliateProfile.findUnique).mockResolvedValueOnce({
      affiliateProfileId: 'affiliate-profile-1',
      isEligible: true,
      status: 'active',
    } as never);
    vi.mocked(prisma.salesAgentProfile.findUnique).mockResolvedValueOnce({
      salesAgentProfileId: 'sales-profile-1',
      status: 'active',
    } as never);

    const response = await POST(new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': '550e8400-e29b-41d4-a716-446655440000',
        'x-forwarded-for': '1.2.3.6',
      },
      body: JSON.stringify({
        name: 'Nuevo Usuario',
        email: 'collision@test.com',
        password: '123456',
        referralCode: 'COLLISION',
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Código de referido inválido o inactivo',
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
