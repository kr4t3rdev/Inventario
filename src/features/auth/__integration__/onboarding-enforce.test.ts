import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'pe04-integration-jwt-secret';
process.env.REFRESH_JWT_SECRET =
  process.env.REFRESH_JWT_SECRET ?? 'pe04-integration-refresh-secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

vi.mock('@/lib/email', () => ({
  sendEmailVerificationLink: vi.fn(async () => ({ success: true, messageId: 'pe04' })),
  sendFailedLoginAttemptsNotification: vi.fn(async () => undefined),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { prismaPlatform } from '@/lib/db/platform-prisma';
import { setViolationReporter, createViolationCollector } from '@/lib/db/scoped-prisma';
import { approveAdminMembership } from '@/features/admin/server/admin-global-queries';
import { AuthService } from '@/features/auth/services/auth-service';
import {
  onboardingMe,
  onboardingTenant,
  onboardingType,
  register,
  verifyEmail,
} from '@/features/auth/api/handlers';
import { createTenantForUser } from '@/lib/services/tenant-factory';
import { sendEmailVerificationLink } from '@/lib/email';

type Fixture = {
  userIds: string[];
  tenantIds: string[];
  planIds: string[];
};

const fixtures: Fixture = { userIds: [], tenantIds: [], planIds: [] };
const password = 'pe04-password';
let requestIpCounter = 1;

function request(path: string, body: Record<string, unknown>, token?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': crypto.randomUUID(),
      'x-forwarded-for': `198.51.100.${requestIpCounter++ % 254 || 1}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function createPlan() {
  const plan = await prismaPlatform.plan.create({
    data: {
      nombre: `PE04 plan ${Date.now()}-${Math.random()}`,
      precio: 0,
      duracionDias: 30,
      maxUsuarios: 20,
      maxAlmacenes: 5,
      maxProductos: 500,
      maxClientes: 500,
      features: {},
    },
  });
  fixtures.planIds.push(plan.planId);
  return plan;
}

async function createTenantWithOwner(suffix: string) {
  const plan = await createPlan();
  const tenant = await prismaPlatform.tenant.create({
    data: {
      nombre: `PE04 tenant ${suffix} ${Date.now()}`,
      slug: `pe04-${suffix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    },
  });
  fixtures.tenantIds.push(tenant.tenantId);
  const owner = await prismaPlatform.user.create({
    data: {
      name: `PE04 owner ${suffix}`,
      email: `pe04-owner-${suffix}-${Date.now()}@test.invalid`,
      password: 'not-used',
      role: 'regularUser',
      isActive: true,
      onboardingStatus: null,
    },
  });
  fixtures.userIds.push(owner.userId);
  await prismaPlatform.tenantMembership.create({
    data: {
      tenantId: tenant.tenantId,
      userId: owner.userId,
      tenantRole: 'manager',
      isActive: true,
    },
  });
  await prismaPlatform.tenantLicense.create({
    data: {
      tenantId: tenant.tenantId,
      planId: plan.planId,
      expiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      activa: true,
      maxUsuarios: 20,
      maxAlmacenes: 5,
      maxProductos: 500,
      maxClientes: 500,
      features: {},
      featureOverrides: {},
    },
  });
  return { tenant, owner, plan };
}

async function registerAndVerify(
  email: string,
  referralCode?: string,
): Promise<{ userId: string; onboardingToken: string }> {
  vi.mocked(sendEmailVerificationLink).mockClear();
  const registered = await register(
    request('/api/auth/register', {
      name: `PE04 user ${email}`,
      email,
      password,
      ...(referralCode ? { referralCode } : {}),
    }),
  );
  expect(registered.status).toBe(200);

  const call = vi.mocked(sendEmailVerificationLink).mock.calls.at(-1);
  expect(call?.[1]).toBeTypeOf('string');
  const verificationToken = new URL(call![1]).searchParams.get('token');
  expect(verificationToken).toBeTruthy();

  const verified = await verifyEmail(
    request('/api/auth/verify-email', { token: verificationToken }),
  );
  expect(verified.status).toBe(200);
  const verifiedBody = await verified.json();
  expect(verifiedBody.success).toBe(true);
  fixtures.userIds.push(verifiedBody.user.userId);
  return {
    userId: verifiedBody.user.userId,
    onboardingToken: verifiedBody.onboardingToken,
  };
}

async function cleanupFixtures() {
  for (const tenantId of fixtures.tenantIds.splice(0)) {
    await prismaPlatform.tenantAccountingPolicy.deleteMany({ where: { tenantId } });
    await prismaPlatform.tenant.delete({ where: { tenantId } }).catch(() => undefined);
  }
  for (const userId of fixtures.userIds.splice(0)) {
    await prismaPlatform.user.delete({ where: { userId } }).catch(() => undefined);
  }
  for (const planId of fixtures.planIds.splice(0)) {
    await prismaPlatform.plan.delete({ where: { planId } }).catch(() => undefined);
  }
}

beforeEach(() => {
  process.env.TENANT_ISOLATION_MODE = 'enforce';
});

afterEach(async () => {
  setViolationReporter(null);
  await cleanupFixtures();
  delete process.env.TENANT_ISOLATION_MODE;
});

afterAll(async () => {
  const residualUsers = await prismaPlatform.user.count({
    where: { email: { startsWith: 'pe04-' } },
  });
  expect(residualUsers).toBe(0);
});

describe('PE-04 onboarding and multi-tenant integration gate', { timeout: 120_000 }, () => {
  it('registers with a valid affiliate referral and reads onboarding state', async () => {
    const affiliateTenant = await prismaPlatform.tenant.create({
      data: {
        nombre: `PE04 affiliate ${Date.now()}`,
        slug: `pe04-affiliate-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      },
    });
    fixtures.tenantIds.push(affiliateTenant.tenantId);
    const referralCode = `PE04-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await prismaPlatform.affiliateProfile.create({
      data: { tenantId: affiliateTenant.tenantId, referralCode, isEligible: true, status: 'active' },
    });

    const flow = await registerAndVerify(
      `pe04-referral-${Date.now()}@test.invalid`,
      referralCode,
    );
    const me = await onboardingMe(
      request('/api/auth/onboarding/me', {}, flow.onboardingToken),
    );
    expect(me.status).toBe(200);
    expect((await me.json()).hasActiveMembership).toBe(false);

    const stored = await prismaPlatform.user.findUnique({ where: { userId: flow.userId } });
    expect(stored?.pendingReferralCode).toBe(referralCode);
  });

  it('runs the worker flow through manager approval and login', async () => {
    const { tenant } = await createTenantWithOwner('worker');
    const email = `pe04-worker-${Date.now()}@test.invalid`;
    const worker = await registerAndVerify(email);

    const typed = await onboardingType(
      request('/api/auth/onboarding/type', { userType: 'worker' }, worker.onboardingToken),
    );
    expect(typed.status).toBe(200);

    const selected = await onboardingTenant(
      request(
        '/api/auth/onboarding/tenant',
        { tenantId: tenant.tenantId },
        worker.onboardingToken,
      ),
    );
    expect(selected.status).toBe(200);

    const pending = await prismaPlatform.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId: worker.userId } },
    });
    expect(pending?.isActive).toBe(false);

    await approveAdminMembership(
      { membershipId: pending!.membershipId, tenantRole: 'dependiente' },
      { userId: 'pe04-admin', role: 'admin', isActive: true } as never,
    );
    const loggedIn = await AuthService.login({ input: { email, password } });
    expect(loggedIn.user.tenantId).toBe(tenant.tenantId);
  });

  it('runs the company flow through global approval and manager login', async () => {
    const plan = await createPlan();
    await prismaPlatform.moneda.upsert({
      where: { codigo: 'CUP' },
      update: { isActive: true },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: '$', isActive: true },
    });
    const email = `pe04-company-${Date.now()}@test.invalid`;
    const company = await registerAndVerify(email);
    const typed = await onboardingType(
      request(
        '/api/auth/onboarding/type',
        { userType: 'company', functionalCurrencyCode: 'CUP' },
        company.onboardingToken,
      ),
    );
    expect(typed.status).toBe(200);

    const created = await createTenantForUser({
      userId: company.userId,
      planId: plan.planId,
      tenantName: `PE04 Company ${Date.now()}`,
    });
    fixtures.tenantIds.push(created.tenantId);
    const loggedIn = await AuthService.login({ input: { email, password } });
    expect(loggedIn.user.tenantId).toBe(created.tenantId);
    expect(loggedIn.user.tenantRole).toBe('manager');
  });

  it('switches an authenticated user from tenant A to B and back under enforce', async () => {
    const tenantA = await createTenantWithOwner('switch-a');
    const tenantB = await createTenantWithOwner('switch-b');
    const email = `pe04-switch-${Date.now()}@test.invalid`;
    const user = await prismaPlatform.user.create({
      data: {
        name: 'PE04 switch user',
        email,
        password: await bcrypt.hash(password, 4),
        role: 'regularUser',
        isActive: true,
        onboardingStatus: null,
      },
    });
    fixtures.userIds.push(user.userId);
    await prismaPlatform.tenantMembership.createMany({
      data: [
        { tenantId: tenantA.tenant.tenantId, userId: user.userId, tenantRole: 'manager', isActive: true },
        { tenantId: tenantB.tenant.tenantId, userId: user.userId, tenantRole: 'manager', isActive: true },
      ],
    });

    const loginA = await AuthService.login({
      input: { email, password },
      client: { tenantId: tenantA.tenant.tenantId },
    });
    expect(loginA.user.tenantId).toBe(tenantA.tenant.tenantId);

    const switchedB = await AuthService.switchTenant({ tenantId: tenantB.tenant.tenantId, user: loginA.user });
    expect(switchedB.tenantId).toBe(tenantB.tenant.tenantId);
    expect((jwt.verify(switchedB.tokens.accessToken, process.env.JWT_SECRET!) as { tenantId: string }).tenantId)
      .toBe(tenantB.tenant.tenantId);

    const switchedA = await AuthService.switchTenant({
      tenantId: tenantA.tenant.tenantId,
      user: { ...loginA.user, tenantId: tenantB.tenant.tenantId, tenantRole: 'manager' },
    });
    expect(switchedA.tenantId).toBe(tenantA.tenant.tenantId);
  });

  it('keeps the onboarding pre-auth flow at zero shadow violations', async () => {
    process.env.TENANT_ISOLATION_MODE = 'shadow';
    const collector = createViolationCollector();
    const { tenant } = await createTenantWithOwner('shadow-worker');
    const worker = await registerAndVerify(`pe04-shadow-${Date.now()}@test.invalid`);
    expect((await onboardingType(
      request('/api/auth/onboarding/type', { userType: 'worker' }, worker.onboardingToken),
    )).status).toBe(200);
    expect((await onboardingTenant(
      request('/api/auth/onboarding/tenant', { tenantId: tenant.tenantId }, worker.onboardingToken),
    )).status).toBe(200);
    expect(collector.flush()).toEqual([]);
  });

  it('keeps referral registration at zero shadow violations', async () => {
    process.env.TENANT_ISOLATION_MODE = 'shadow';
    const collector = createViolationCollector();
    const affiliateTenant = await prismaPlatform.tenant.create({
      data: {
        nombre: `PE04 shadow affiliate ${Date.now()}`,
        slug: `pe04-shadow-affiliate-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      },
    });
    fixtures.tenantIds.push(affiliateTenant.tenantId);
    const referralCode = `PE04-SHADOW-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await prismaPlatform.affiliateProfile.create({
      data: { tenantId: affiliateTenant.tenantId, referralCode, isEligible: true, status: 'active' },
    });

    const flow = await registerAndVerify(
      `pe04-shadow-referral-${Date.now()}@test.invalid`,
      referralCode,
    );
    expect((await onboardingMe(
      request('/api/auth/onboarding/me', {}, flow.onboardingToken),
    )).status).toBe(200);
    expect(collector.flush()).toEqual([]);
  });

  it('keeps company provisioning at zero shadow violations', async () => {
    process.env.TENANT_ISOLATION_MODE = 'shadow';
    const collector = createViolationCollector();
    const plan = await createPlan();
    await prismaPlatform.moneda.upsert({
      where: { codigo: 'CUP' },
      update: { isActive: true },
      create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: '$', isActive: true },
    });
    const email = `pe04-shadow-company-${Date.now()}@test.invalid`;
    const company = await registerAndVerify(email);
    expect((await onboardingType(
      request(
        '/api/auth/onboarding/type',
        { userType: 'company', functionalCurrencyCode: 'CUP' },
        company.onboardingToken,
      ),
    )).status).toBe(200);

    const created = await createTenantForUser({
      userId: company.userId,
      planId: plan.planId,
      tenantName: `PE04 Shadow Company ${Date.now()}`,
    });
    fixtures.tenantIds.push(created.tenantId);
    expect((await AuthService.login({ input: { email, password } })).user.tenantId)
      .toBe(created.tenantId);
    expect(collector.flush()).toEqual([]);
  });

  it('keeps tenant switching at zero shadow violations', async () => {
    process.env.TENANT_ISOLATION_MODE = 'shadow';
    const collector = createViolationCollector();
    const tenantA = await createTenantWithOwner('shadow-switch-a');
    const tenantB = await createTenantWithOwner('shadow-switch-b');
    const email = `pe04-shadow-switch-${Date.now()}@test.invalid`;
    const user = await prismaPlatform.user.create({
      data: {
        name: 'PE04 shadow switch user',
        email,
        password: await bcrypt.hash(password, 4),
        role: 'regularUser',
        isActive: true,
        onboardingStatus: null,
      },
    });
    fixtures.userIds.push(user.userId);
    await prismaPlatform.tenantMembership.createMany({
      data: [
        { tenantId: tenantA.tenant.tenantId, userId: user.userId, tenantRole: 'manager', isActive: true },
        { tenantId: tenantB.tenant.tenantId, userId: user.userId, tenantRole: 'manager', isActive: true },
      ],
    });

    const loginA = await AuthService.login({
      input: { email, password },
      client: { tenantId: tenantA.tenant.tenantId },
    });
    await AuthService.switchTenant({ tenantId: tenantB.tenant.tenantId, user: loginA.user });
    await AuthService.switchTenant({
      tenantId: tenantA.tenant.tenantId,
      user: { ...loginA.user, tenantId: tenantB.tenant.tenantId, tenantRole: 'manager' },
    });
    expect(collector.flush()).toEqual([]);
  });
});
