import { chromium } from '@playwright/test';
import { PrismaClient } from '../src/generated/prisma';

const baseUrl = 'http://127.0.0.1:3000';
const adminEmail = 'admin-real-1783109828850@test.local';
const referrerEmail = 'referrer-real-1783109828850@test.local';
const password = 'RealPass123!';
const referrerTenantId = 'cmr5dk2l0000214up1wby9hcy';
const referredEmail = `referred-ui-${Date.now()}@test.local`;
const referredName = `Referred UI ${Date.now()}`;
const prisma = new PrismaClient();

async function login(page: any, email: string, passwordValue: string) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(passwordValue);
  await page.getByRole('button', { name: /iniciar sesión|iniciar sesión|iniciando/i }).click();
  await page.waitForLoadState('networkidle');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const artifactsDir = '/Users/arturo/Documents/Proyecto Inventario/TCP/output/affiliate-real';

  const referrerContext = await browser.newContext();
  const referrerPage = await referrerContext.newPage();
  await login(referrerPage, referrerEmail, password);
  await referrerPage.goto(`${baseUrl}/busy/referidos`, { waitUntil: 'networkidle' });
  await referrerPage.getByRole('heading', { name: /programa de referidos/i }).waitFor();
  const referralCodeText = (await referrerPage.locator('text=/REF-/').first().textContent())?.trim() ?? '';
  await referrerPage.screenshot({ path: `${artifactsDir}/referrer-dashboard.png`, fullPage: true });

  const registrationContext = await browser.newContext();
  const registrationPage = await registrationContext.newPage();
  await registrationPage.goto(`${baseUrl}/register?ref=${encodeURIComponent(referralCodeText)}`, { waitUntil: 'networkidle' });
  await registrationPage.locator('#name').fill(referredName);
  await registrationPage.locator('#email').fill(referredEmail);
  await registrationPage.locator('#password').fill(password);
  await registrationPage.locator('#confirmPassword').fill(password);
  await registrationPage.getByRole('button', { name: /crear cuenta|creando cuenta/i }).click();
  await registrationPage.getByText(/revisá tu correo para verificar la cuenta/i).waitFor({ timeout: 30000 });
  await registrationPage.screenshot({ path: `${artifactsDir}/referred-register.png`, fullPage: true });

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, adminEmail, password);
  await adminPage.goto(`${baseUrl}/admin/referidos`, { waitUntil: 'networkidle' });
  await adminPage.getByRole('heading', { name: /referidos/i }).waitFor();
  const emptyReferralsVisible = await adminPage.getByText(/sin referidos/i).first().isVisible().catch(() => false);
  await adminPage.screenshot({ path: `${artifactsDir}/admin-referidos.png`, fullPage: true });

  const referredUser = await prisma.user.findUnique({
    where: { email: referredEmail },
    select: { userId: true, email: true, onboardingStatus: true, isActive: true },
  });
  const referralCount = await prisma.affiliateReferral.count({
    where: { referrerTenantId },
  });
  const linkedReferral = referredUser
    ? await prisma.affiliateReferral.findFirst({ where: { referredTenantId: referredUser.userId } }).catch(() => null)
    : null;

  console.log(JSON.stringify({
    referralCodeText,
    referredEmail,
    referredUser,
    referralCount,
    linkedReferral,
    emptyReferralsVisible,
    artifactsDir,
  }, null, 2));

  await referrerContext.close();
  await registrationContext.close();
  await adminContext.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
