import { expect, test, type Page, type BrowserContext } from '@playwright/test';

const E2E_EMAIL = 'e2e@test.local';
const E2E_PASSWORD = 'E2ETest123!';
const E2E_VENDOR = 'e2e-proveedor-1';
const E2E_PRODUCT = 'e2e-producto-aceite';

class PurchaseOrderPage {
  constructor(private readonly page: Page) {}

  private latestOrderRow() {
    return this.page.locator('tbody tr').filter({ hasText: 'Proveedor Demo' }).first();
  }

  async createOrder(): Promise<void> {
    await this.page.goto('/busy/compras/ordenes');
    await expect(this.page.getByRole('heading', { name: 'Órdenes de compra' })).toBeVisible({ timeout: 10000 });
    await this.page.getByLabel('Proveedor', { exact: true }).selectOption(E2E_VENDOR);
    await this.page.getByRole('combobox', { name: /Producto/ }).selectOption(E2E_PRODUCT);
    await this.page.getByRole('spinbutton', { name: /Cantidad/ }).fill('100');
    await this.page.getByRole('spinbutton', { name: /Precio unitario/ }).fill('120');
    await this.page.getByRole('button', { name: 'Crear orden' }).click();
    await expect(this.latestOrderRow()).toContainText('BORRADOR');
  }

  async confirm(): Promise<void> {
    await this.latestOrderRow().getByRole('button', { name: 'Confirmar' }).click();
    await expect(this.latestOrderRow()).toContainText('CONFIRMADA');
  }

  async receive(quantity: string, expectedState: string, expectedProgress: string): Promise<void> {
    await this.latestOrderRow().getByRole('button', { name: 'Recibir' }).click();
    await this.page.getByLabel('Cantidad a recibir').fill(quantity);
    await this.page.getByRole('button', { name: 'Guardar recepción' }).click();
    await expect(this.latestOrderRow()).toContainText(expectedState);
    await expect(this.latestOrderRow()).toContainText(expectedProgress);
  }
}

/**
 * @description Verifica el flujo profesional completo de compra: OC, recepción
 * parcial, backorder, recepción final, factura vinculada y kardex.
 */
test.describe('Flujo de orden de compra profesional', () => {
  let authCookie: { name: string; value: string; domain: string; path: string };

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    expect(response.ok(), `Login falló (${response.status()}): ${await response.text()}`).toBeTruthy();

    const setCookieHeader = response.headers()['set-cookie'] ?? '';
    const authMatch = setCookieHeader.match(/auth_token=([^;]+)/);
    expect(authMatch, 'No se encontró auth_token cookie').toBeTruthy();
    authCookie = {
      name: 'auth_token',
      value: authMatch![1],
      domain: 'localhost',
      path: '/',
    };
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([authCookie]);
  });

  test('crea OC, recibe en dos partes, factura y cuadra el kardex', async ({ page }) => {
    const order = new PurchaseOrderPage(page);
    await order.createOrder();
    await order.confirm();
    await order.receive('60', 'PARCIAL', '60/100');
    await order.receive('40', 'RECIBIDA', '100/100');

    await page.goto('/busy/compras-productos/new');
    await expect(page.getByRole('heading', { name: 'Datos de la Compra' })).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Orden de compra (opcional)').click();
    await page.getByRole('option').filter({ hasText: 'Proveedor Demo' }).first().click();
    await page.getByLabel('Nro. Factura').fill(`E2E-${Date.now()}`);
    await page.getByRole('button', { name: /Registrar compra \(1 producto\)/ }).click();
    await expect(page).toHaveURL(/\/busy\/compras-productos$/, { timeout: 10000 });

    await page.goto('/busy/inventario/kardex');
    await page.getByLabel('Producto', { exact: true }).selectOption(E2E_PRODUCT);
    await page.getByLabel('Tipo de ubicación').selectOption('almacen');
    await page.getByLabel('Ubicación', { exact: true }).selectOption('e2e-almacen-principal');
    await page.getByRole('button', { name: 'Consultar' }).click();
    // El kardex tiene al menos dos entradas COMPRA nuevas: recepción parcial (60) + final (40).
    // La factura vinculada no genera movimiento físico. Verificamos las dos más recientes.
    const compraRows = page.locator('tbody tr').filter({ hasText: 'COMPRA' });
    await expect(compraRows.first()).toBeVisible({ timeout: 10000 });
    const firstRow = await compraRows.nth(0).textContent();
    const secondRow = await compraRows.nth(1).textContent();
    const has40and60 = (firstRow?.includes('40') && secondRow?.includes('60')) ||
                       (firstRow?.includes('60') && secondRow?.includes('40'));
    expect(has40and60, `Se esperaban líneas COMPRA con 40 y 60, se obtuvo: ${firstRow}, ${secondRow}`).toBe(true);
  });
});
