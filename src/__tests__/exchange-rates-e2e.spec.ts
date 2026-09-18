/**
 * @description E2E del flujo de exchange en /busy/contabilidad/exchange.
 * Cubre conversión exitosa, falla por falta de ruta y visualización del histórico.
 */

import { expect, test, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

function buildUniqueCurrencyCode(): string {
  return Math.random().toString(36).slice(2, 5).toUpperCase();
}

function buildUniqueRate(): number {
  const suffix = String(Date.now()).slice(-6).padStart(6, '0');
  return Number(`121.${suffix}`);
}

async function openSelectAndChoose(page: Page, label: string, option: string) {
  await page.locator(`[aria-label="${label}"]`).click();
  await page.locator('[role="option"]').filter({ hasText: option }).first().click();
}

test.describe('Exchange rates page', () => {
  test('covers success, missing-rate failure, and historized rate display', async ({ page }) => {
    await page.goto(`${BASE_URL}/busy/contabilidad/exchange`);

    await expect(page.getByRole('heading', { name: /Exchange y Monedas/i })).toBeVisible();

    await page.getByRole('button', { name: /Convertir monedas/i }).click();
    await openSelectAndChoose(page, 'Moneda de origen', 'USD');
    await openSelectAndChoose(page, 'Moneda de destino', 'CUP');
    await page.getByLabel('Monto a Convertir').fill('100');
    await page.getByRole('button', { name: /^Convertir$/i }).click();

    await expect(page.getByText(/Resultado de la conversión/i)).toBeVisible();
    await expect(page.getByText(/Ruta direct/i)).toBeVisible();
    await expect(page.getByText(/Tasa aplicada 120\.000000/i)).toBeVisible();

    await page.getByRole('button', { name: /Nueva Conversión/i }).click();
    await page.getByRole('button', { name: /Cerrar/i }).click();

    await page.getByRole('tab', { name: /Monedas/i }).click();
    await page.getByRole('button', { name: /Nueva moneda/i }).click();

    const currencyCode = buildUniqueCurrencyCode();
    await page.getByLabel('Código de Moneda').fill(currencyCode);
    await page.getByLabel('Nombre de la Moneda').fill(`Test ${currencyCode}`);
    await page.getByLabel('Símbolo').fill(currencyCode);
    await page.getByRole('button', { name: /^Crear$/i }).click();

    await expect(page.getByText(currencyCode, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Convertir monedas/i }).click();
    await openSelectAndChoose(page, 'Moneda de origen', currencyCode);
    await openSelectAndChoose(page, 'Moneda de destino', 'CUP');
    await page.getByLabel('Monto a Convertir').fill('100');
    await page.getByRole('button', { name: /^Convertir$/i }).click();

    await expect(page.getByText(/No se pudo completar la conversión/i)).toBeVisible();
    await expect(page.getByText(/No se encontró ruta de conversión/i)).toBeVisible();

    await page.getByRole('button', { name: /Cerrar/i }).click();

    await page.getByRole('tab', { name: /Tasas de cambio/i }).click();
    await page.getByRole('button', { name: /Actualizar tasa/i }).click();

    const rateValue = buildUniqueRate();
    await openSelectAndChoose(page, 'Moneda de origen', 'USD');
    await page.getByLabel('Tasa de Cambio').fill(rateValue.toString());
    await page.getByRole('button', { name: /^Actualizar Tasa$/i }).click();

    await page.getByRole('tab', { name: /Historial/i }).click();

    const expectedHistoryRate = rateValue.toLocaleString('es-ES', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });

    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toContainText('USD → CUP');
    await expect(firstRow).toContainText(expectedHistoryRate);
    await expect(firstRow).toContainText('Sistema');
  });
});
