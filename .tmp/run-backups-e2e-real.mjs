import { chromium } from '@playwright/test';
import * as prismaModule from '../src/generated/prisma/index.js';

const { PrismaClient } = prismaModule;
const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';
const EMAIL = 'e2e@test.local';
const PASSWORD = 'E2ETest123!';

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByLabel('Correo electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
  await page.waitForURL(/\/admin(?:\/)?$/, { timeout: 20000 });
  await page.waitForTimeout(3000);
}

async function openBackupDialog(page) {
  await page.goto(`${BASE_URL}/admin/backups`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /Nueva copia/i }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
}

async function loadTenantOption(page) {
  await openBackupDialog(page);
  await page.getByRole('button', { name: /Por Tenant/i }).click();
  for (let i = 0; i < 10; i++) {
    const options = await page.locator('#backup-tenant option').evaluateAll((els) =>
      els.map((el) => ({ value: el.value, label: el.textContent?.trim() ?? '' }))
    );
    const realOption = options.find((option) => option.value && option.label !== 'Seleccioná un tenant');
    if (realOption) {
      return realOption;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('No hay tenants reales disponibles en el select del admin panel');
}

async function triggerBackup(page, typeLabel, tenantName) {
  const startedAt = new Date();
  await openBackupDialog(page);
  await page.getByRole('button', { name: new RegExp(typeLabel, 'i') }).click();

  if (tenantName) {
    const submitBefore = await page.getByRole('button', { name: /Iniciar copia/i }).isDisabled();
    console.log(`tenant-submit-disabled-before-selection=${submitBefore}`);
    await page.locator('#backup-tenant').selectOption({ label: tenantName });
    await page.waitForTimeout(300);
  }

  await page.getByRole('button', { name: /Iniciar copia/i }).click();
  await page.waitForTimeout(1000);
  return startedAt;
}

async function waitForBackup({ type, tenantId, startedAt }) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const log = await prisma.backupLog.findFirst({
      where: {
        type,
        ...(tenantId ? { tenantId } : {}),
        createdAt: { gte: startedAt },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        backupLogId: true,
        type: true,
        tenantId: true,
        status: true,
        errorMessage: true,
        fileUrl: true,
        createdAt: true,
        completedAt: true,
      },
    });

    if (log && log.status !== 'running') return log;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return await prisma.backupLog.findFirst({
    where: {
      type,
      ...(tenantId ? { tenantId } : {}),
      createdAt: { gte: startedAt },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      backupLogId: true,
      type: true,
      tenantId: true,
      status: true,
      errorMessage: true,
      fileUrl: true,
      createdAt: true,
      completedAt: true,
    },
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('console', (msg) => {
  const text = msg.text();
  if (/Failed to load resource|\[HMR\]|Hydration/i.test(text)) {
    console.log('console:', msg.type(), text);
  }
});

try {
  await login(page);
  const tenantOption = await loadTenantOption(page);
  console.log('tenant-option', JSON.stringify(tenantOption));

  const scenarios = [
    { key: 'full', label: 'Base de datos completa', tenantId: null, tenantName: null },
    { key: 'config', label: 'Solo configuración', tenantId: null, tenantName: null },
    { key: 'tenant', label: 'Por Tenant', tenantId: tenantOption.value, tenantName: tenantOption.label },
  ];

  const results = [];
  for (const scenario of scenarios) {
    console.log(`running=${scenario.key}`);
    const startedAt = await triggerBackup(page, scenario.label, scenario.tenantName);
    const result = await waitForBackup({ type: scenario.key, tenantId: scenario.tenantId, startedAt });
    results.push({ scenario: scenario.key, tenantName: scenario.tenantName, result });
    console.log(`result=${scenario.key}`, JSON.stringify(result));
  }

  console.log('FINAL_RESULTS ' + JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await prisma.$disconnect();
}
