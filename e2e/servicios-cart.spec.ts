import { expect, test, type Page } from '@playwright/test';
import path from 'path';

const STORAGE = path.join(process.cwd(), 'e2e', '.auth', 'state.json');

test.use({ storageState: STORAGE });

test.describe('Carrito — Venta / Compra (modo toggle)', () => {
  test.describe.configure({ mode: 'serial' });

  test('muestra el toggle y cambia a modo Compra', async ({ page }) => {
    await page.goto(`${process.env.E2E_BASE_URL || 'https://kr4t3rdev.xyz'}/busy/servicios`);
    await page.waitForTimeout(3000);

    // Cerrar diálogo de feedback si bloquea (¿Cómo calificas tu experiencia?)
    const feedback = page.getByRole('dialog', { name: /¿Cómo calificas tu experiencia\?/i });
    if (await feedback.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }

    // El carrito debe verse (los badges de query-params no persisten siempre)
    const addButtons = page.getByRole('button', { name: /Agregar al Carrito/i });
    await expect(addButtons.first()).toBeVisible({ timeout: 20000 });
    await addButtons.first().click();

    const cartBtn = page.getByRole('button', { name: /Carrito \(\d+\)/i });
    await cartBtn.click();
    await page.waitForTimeout(1000);

    // Confirmar que el dialog que se abrió es del carrito
    await expect(page.getByText('Carrito de Servicios')).toBeVisible();

    // Cambiar a modo COMPRA
    const compraTab = page.getByRole('tab', { name: /Compra \(servicio recibido\)/i });
    await expect(compraTab).toBeVisible();
    await compraTab.click();

    // En modo Compra aparecen los campos propios
    await expect(page.getByText(/Proveedor \*/i)).toBeVisible();
    await expect(page.getByText(/No\. de factura/i)).toBeVisible();
    await expect(page.getByText(/Forma de pago/i)).toBeVisible();
    // Y el dashboard pasa a la subjercicio de "Servicios prestados" queda oculto
    await expect(page.getByText(/Cliente \*/i)).not.toBeVisible();
  });
});
