import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { sendEmailVerificationLink } from '@/lib/email';

vi.mock('@/lib/prisma', () => ({
  prisma: {
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
});
