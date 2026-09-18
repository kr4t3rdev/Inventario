import { chromium } from '@playwright/test';
import * as prismaModule from '../src/generated/prisma/index.js';
const { PrismaClient } = prismaModule;
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const tenant = { value: 'cmr76198n00001496cpdtud0n', label: 'Tenant EAN13 1783218129882' };

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.getByLabel('Correo electrónico').fill('e2e@test.local');
  await page.getByLabel('Contraseña').fill('E2ETest123!');
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
  await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
  await page.waitForTimeout(3000);
}

async function trigger(page, label, tenantOpt) {
  const startedAt = new Date();
  await page.goto(`${BASE_URL}/admin/backups`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.getByRole('button', { name: /Nueva copia/i }).click();
  await page.getByRole('button', { name: new RegExp(label, 'i') }).click();
  if (tenantOpt) {
    const options = await page.locator('#backup-tenant option').evaluateAll((els) => els.map((el) => ({ value: el.value, label: el.textContent?.trim() ?? '' })));
    console.log('options', JSON.stringify(options.slice(0,4)));
    console.log('tenant-submit-disabled-before-selection', await page.getByRole('button', { name: /Iniciar copia/i }).isDisabled());
    await page.locator('#backup-tenant').selectOption({ label: tenantOpt.label });
    await page.waitForTimeout(500);
  }
  await page.getByRole('button', { name: /Iniciar copia/i }).click();
  return startedAt;
}

async function waitFor(type, tenantId, startedAt) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const log = await prisma.backupLog.findFirst({
      where: { type, ...(tenantId ? { tenantId } : {}), createdAt: { gte: startedAt } },
      orderBy: { createdAt: 'desc' },
      select: { backupLogId: true, type: true, tenantId: true, status: true, errorMessage: true, createdAt: true, completedAt: true, fileUrl: true },
    });
    if (log && log.status !== 'running') return log;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return await prisma.backupLog.findFirst({
    where: { type, ...(tenantId ? { tenantId } : {}), createdAt: { gte: startedAt } },
    orderBy: { createdAt: 'desc' },
    select: { backupLogId: true, type: true, tenantId: true, status: true, errorMessage: true, createdAt: true, completedAt: true, fileUrl: true },
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await login(page);
  const configStarted = await trigger(page, 'Solo configuración');
  console.log('config', JSON.stringify(await waitFor('config', null, configStarted)));
  const tenantStarted = await trigger(page, 'Por Tenant', tenant);
  console.log('tenantResult', JSON.stringify(await waitFor('tenant', tenant.value, tenantStarted)));
} finally {
  await browser.close();
  await prisma.$disconnect();
}
