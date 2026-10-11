import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

/**
 * @description E2E real del flujo "Renovar licencia" del panel admin
 * (/admin/licencias) contra un servidor local con DB desechable. Cubre:
 * renovación sin pago (con recibo idempotente), renovación con cambio de
 * plan y pago presencial validando que el monto exigible mostrado sea el
 * del plan SELECCIONADO (cotización de servidor, no el precio viejo de la
 * licencia), y la verificación en base de datos de expiración, pago,
 * recibo y sincronización de usuarios.
 *
 * @usage
 *   # terminal 1: dev server
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:5433/tcp_test_local \
 *     PORT=3001 pnpm run dev
 *   # terminal 2: tests
 *   ALLOW_DISPOSABLE_TEST_DB=1 \
 *   E2E_TEST_PASSWORD='E2ERenewAdmin123!pass' \
 *     npx playwright test --config playwright.renewal.config.ts
 */
const BASE = process.env.E2E_BASE_URL_LOCAL || 'http://localhost:3001';
const MS_DAY = 86_400_000;

const prisma = new PrismaClient();

const fixtureId = `e2e-renew-${randomUUID().slice(0, 8)}`;
const adminEmail = `${fixtureId}@test.invalid`;
const adminPassword = process.env.E2E_TEST_PASSWORD || 'E2ERenewAdmin123!pass';

let planBasicId = '';
let planProId = '';
let tenantId = '';
let tenantNombre = '';
let adminUserId = '';
let licenseId = '';

let authState: { cookies: unknown[]; origins: unknown[] } | null = null;

test.describe('Renovar licencia — panel admin (E2E real)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Este spec siembra y borra filas crudas (planes/tenant/licencia/usuario):
    // requiere opt-in explícito de DB desechable, como el resto de la suite
    test.skip(
      process.env.ALLOW_DISPOSABLE_TEST_DB !== '1',
      'Requiere ALLOW_DISPOSABLE_TEST_DB=1 con una DB desechable',
    );

    planBasicId = `plan-${fixtureId}-basico`;
    planProId = `plan-${fixtureId}-pro`;
    tenantNombre = `Tenant ${fixtureId}`;

    await prisma.plan.create({
      data: {
        planId: planBasicId,
        nombre: 'Plan Basico E2E',
        precio: 40,
        duracionDias: 30,
        maxUsuarios: 3,
        maxAlmacenes: 2,
        maxProductos: 100,
        maxClientes: 200,
      },
    });
    await prisma.plan.create({
      data: {
        planId: planProId,
        nombre: 'Plan Pro E2E',
        precio: 80,
        duracionDias: 90,
        maxUsuarios: 10,
        maxAlmacenes: 5,
        maxProductos: 500,
        maxClientes: 1000,
      },
    });
    tenantId = (
      await prisma.tenant.create({ data: { nombre: tenantNombre } })
    ).tenantId;
    adminUserId = (
      await prisma.user.create({
        data: {
          name: 'Admin E2E Renew',
          email: adminEmail,
          password: await bcrypt.hash(adminPassword, 10),
          role: 'admin',
          isActive: true,
        },
      })
    ).userId;
    await prisma.tenantMembership.create({
      data: { tenantId, userId: adminUserId, tenantRole: 'admin', isActive: true },
    });
    licenseId = (
      await prisma.tenantLicense.create({
        data: {
          tenantId,
          planId: planBasicId,
          expiracion: new Date(Date.now() + 20 * MS_DAY),
          activa: true,
          isAdminTest: true,
        },
      })
    ).tenantLicenseId;
  });

  test.afterAll(async () => {
    try {
      await prisma.salesAgentCommissionLedger.deleteMany({
        where: { sourceTenantLicenseId: licenseId },
      });
      await prisma.tenantLicensePayment.deleteMany({
        where: { tenantLicenseId: licenseId },
      });
      await prisma.auditLog.deleteMany({
        where: { entidadId: licenseId, entidad: 'TENANT_LICENSE' },
      });
      await prisma.licenseRenewalOperation.deleteMany({
        where: { tenantLicenseId: licenseId },
      });
      await prisma.tenantMembership.deleteMany({ where: { tenantId } });
      await prisma.tenantLicense.deleteMany({ where: { tenantLicenseId: licenseId } });
      await prisma.user.deleteMany({ where: { userId: adminUserId } });
      await prisma.tenant.deleteMany({ where: { tenantId } });
      await prisma.plan.deleteMany({
        where: { planId: { in: [planBasicId, planProId] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  test('prepara sesión admin vía API', async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: BASE });
    const res = await api.post('/api/auth/login', {
      data: { email: adminEmail, password: adminPassword },
    });
    expect(res.status()).toBe(200);

    // APIResponse.headers() une los Set-Cookie múltiples con \n: usar
    // headersArray() para capturar auth_token Y refreshToken por separado
    const setCookies = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value);
    const cookies = setCookies
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .map((pair) => {
        const [name, ...rest] = pair.split('=');
        return {
          name,
          value: rest.join('='),
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax' as const,
        };
      });
    expect(cookies.length).toBeGreaterThanOrEqual(2);
    authState = { cookies, origins: [] };
  });

  test('renueva sin pago desde el panel y persiste recibo + sincronización', async ({ browser }) => {
    test.setTimeout(300_000);
    expect(authState).not.toBeNull();
    const context = await browser.newContext({ storageState: authState as never });
    const page = await context.newPage();

    // Primera compilación del panel puede demorar; margen amplio
    await page.goto('/admin/licencias');
    await expect(page.getByRole('heading', { name: 'Licencias' })).toBeVisible({
      timeout: 240_000,
    });

    // La fila del fixture es visible
    const row = page.locator('tr', { hasText: tenantNombre });
    await expect(row.first()).toBeVisible({ timeout: 30_000 });

    // Abrir el dialog de renovación
    await page
      .getByRole('button', { name: `Renovar licencia ${licenseId}` })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Sin pago: Continuar (la cotización de servidor debe resolver primero;
    // el botón queda deshabilitado mientras "Cotizando...")
    await dialog.getByRole('button', { name: 'Continuar' }).click();

    // Confirmación
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    await confirm.getByRole('button', { name: 'Confirmar renovación' }).click();

    // Toast de éxito con la nueva fecha
    await expect(page.getByText(/Licencia renovada hasta el/)).toBeVisible({
      timeout: 30_000,
    });

    // Verificación en DB: expiración extendida 30 días desde la vigente,
    // recibo de la operación y expiresAt del usuario sincronizado
    const expiracionAntes = new Date(Date.now() + 20 * MS_DAY);
    const lic = await prisma.tenantLicense.findUnique({
      where: { tenantLicenseId: licenseId },
    });
    expect(lic).not.toBeNull();
    const expectedExpiracion = new Date(expiracionAntes.getTime() + 30 * MS_DAY);
    expect(
      Math.abs(
        (lic as { expiracion: Date }).expiracion.getTime() -
          expectedExpiracion.getTime(),
      ),
    ).toBeLessThan(5 * 60_000);

    const receiptCount = await prisma.licenseRenewalOperation.count({
      where: { tenantLicenseId: licenseId },
    });
    expect(receiptCount).toBe(1);

    const member = await prisma.user.findUnique({
      where: { userId: adminUserId },
      select: { expiresAt: true },
    });
    expect(
      Math.abs(
        (member?.expiresAt as Date).getTime() -
          (lic as { expiracion: Date }).expiracion.getTime(),
      ),
    ).toBeLessThan(5 * 60_000);

    await context.close();
  });

  test('renueva con cambio de plan y pago: el exigible mostrado es el del plan nuevo', async ({ browser }) => {
    test.setTimeout(300_000);
    expect(authState).not.toBeNull();
    const context = await browser.newContext({ storageState: authState as never });
    const page = await context.newPage();

    const before = await prisma.tenantLicense.findUnique({
      where: { tenantLicenseId: licenseId },
      select: { expiracion: true },
    });
    const expiracionAntes = (before as { expiracion: Date }).expiracion;

    await page.goto('/admin/licencias');
    await expect(page.getByRole('heading', { name: 'Licencias' })).toBeVisible({
      timeout: 120_000,
    });

    await page
      .getByRole('button', { name: `Renovar licencia ${licenseId}` })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Cambiar al plan Pro en el Select
    await dialog.getByRole('combobox').click();
    await page
      .getByRole('option', { name: /Plan Pro E2E · 90 días · \$80/ })
      .click();

    // Activar el registro de pago
    await dialog.getByText('Registrar pago de renovación').click();

    // REGRESIÓN: el monto exigible debe ser el del plan SELECCIONADO ($80),
    // no el precio viejo de la licencia ($40)
    await expect(dialog.getByText('$80.00')).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText(/\$40/)).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Continuar' }).click();

    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    await confirm.getByRole('button', { name: 'Confirmar renovación' }).click();

    await expect(page.getByText(/Licencia renovada hasta el/)).toBeVisible({
      timeout: 30_000,
    });

    // Verificación en DB: +90 días desde la expiración vigente, plan Pro,
    // pago confirmado de $80 y segundo recibo
    const lic = await prisma.tenantLicense.findUnique({
      where: { tenantLicenseId: licenseId },
    });
    expect(lic?.planId).toBe(planProId);
    expect(lic?.finalPriceUsd?.toNumber()).toBe(80);

    const expectedExpiracion = new Date(
      expiracionAntes.getTime() + 90 * MS_DAY,
    );
    expect(Math.abs((lic as { expiracion: Date }).expiracion.getTime() -
      expectedExpiracion.getTime())).toBeLessThan(5 * 60_000);

    const payments = await prisma.tenantLicensePayment.findMany({
      where: { tenantLicenseId: licenseId },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].paymentKind).toBe('renewal');
    expect(payments[0].expectedAmountUsd.toNumber()).toBe(80);
    expect(payments[0].status).toBe('confirmed');

    const receipts = await prisma.licenseRenewalOperation.count({
      where: { tenantLicenseId: licenseId },
    });
    expect(receipts).toBe(2);

    await context.close();
  });
});
