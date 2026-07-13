import { chromium } from '@playwright/test';
import * as prismaModule from '../src/generated/prisma/index.js';
const { PrismaClient } = prismaModule;
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const tenant = { value: 'cmr67komc000114i2d8s3axo8', label: 'Referrer pending-ref-1783160249207' };

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.getByLabel('Correo electrónico').fill('e2e@test.local');
  await page.getByLabel('Contraseña').fill('E2ETest123!');
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
  await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
  await page.waitForTimeout(3000);
}

async function trigger(page) {
  const startedAt = new Date();
  await page.goto(`${BASE_URL}/admin/backups`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.getByRole('button', { name: /Nueva copia/i }).click();
  await page.getByRole('button', { name: /Por Tenant/i }).click();
  const disabledBefore = await page.getByRole('button', { name: /Iniciar copia/i }).isDisabled();
  await page.locator('#backup-tenant').selectOption({ label: tenant.label });
  await page.waitForTimeout(500);
  const disabledAfter = await page.getByRole('button', { name: /Iniciar copia/i }).isDisabled();
  await page.getByRole('button', { name: /Iniciar copia/i }).click();
  return { startedAt, disabledBefore, disabledAfter };
}

async function waitFor(startedAt) {
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const log = await prisma.backupLog.findFirst({
      where: { type: 'tenant', tenantId: tenant.value, createdAt: { gte: startedAt } },
      orderBy: { createdAt: 'desc' },
      select: { backupLogId: true, type: true, tenantId: true, status: true, errorMessage: true, createdAt: true, completedAt: true, fileUrl: true, fileName: true, fileSize: true },
    });
    if (log && log.status !== 'running') return log;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return await prisma.backupLog.findFirst({
    where: { type: 'tenant', tenantId: tenant.value, createdAt: { gte: startedAt } },
    orderBy: { createdAt: 'desc' },
    select: { backupLogId: true, type: true, tenantId: true, status: true, errorMessage: true, createdAt: true, completedAt: true, fileUrl: true, fileName: true, fileSize: true },
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await login(page);
  const ui = await trigger(page);
  const result = await waitFor(ui.startedAt);
  console.log(JSON.stringify({ tenant, ui, result }, null, 2));
} finally {
  await browser.close();
  await prisma.$disconnect();
}
