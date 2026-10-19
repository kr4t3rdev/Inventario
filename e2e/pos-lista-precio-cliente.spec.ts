import { expect, test } from '@playwright/test';

/**
 * E2E LP-1.4: una venta en POS con un cliente con lista asignada cobra el
 * precio de la lista del cliente (150) y no el de la lista default del tenant
 * (165) ni el precio base (180). Valida en el navegador la misma cadena que
 * el servidor exige: cliente > PV > default > base.
 *
 * Requisitos del entorno (fixtures sembradas por e2e/global-setup en la base
 * local desechable, ver scripts/seed-e2e-user.ts → seedPrecioListaCatalog):
 * - 'E2E Punto de Venta' (sin lista propia) con stock del producto fixture.
 * - 'E2E Lista Default' (esDefault) con entrada 165 para el producto.
 * - 'E2E Cliente Lista' con la 'E2E Lista Cliente' (entrada 150).
 * - Producto 'E2E Aceite Volumen 1L' con precio base 180.
 * - Licencia E2E con facturacion + ventas-factura (flujo POS con cliente).
 *
 * Usa el usuario y contraseña sembrados por e2e/global-setup.ts y el baseURL
 * local de playwright.config.ts; no depende de una sesión estática ni del sitio
 * desplegado.
 */

test.describe('POS — lista de precios del cliente (LP-1.4)', () => {
	test.setTimeout(180_000);

	test('cobra la lista del cliente (150) sobre la default (165) y el base (180)', async ({ page }) => {
		const email = process.env.E2E_USER_EMAIL;
		const password = process.env.E2E_USER_PASSWORD;
		if (!email || !password) {
			throw new Error('globalSetup debe proporcionar las credenciales E2E sembradas.');
		}

		// Autenticar contra la misma instancia local donde globalSetup sembró el tenant.
		await page.goto('/login');
		const loginStatus = await page.evaluate(async (credentials) => {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(credentials),
			});
			return response.status;
		}, { email, password });
		expect(loginStatus).toBe(200);

		await page.goto('/busy/sales/new');

		// La fixture se siembra obligatoriamente en globalSetup; su ausencia es fallo.
		const pvTrigger = page
			.getByRole('combobox')
			.filter({ hasText: 'Seleccionar punto de venta' });
		await expect(pvTrigger).toBeVisible({ timeout: 20_000 });
		await pvTrigger.click();
		const opcionPv = page.getByRole('option', { name: 'E2E Punto de Venta' });
		await expect(opcionPv).toBeVisible();
		await opcionPv.click();

		// Buscar el producto fixture y usar la vista de lista ($X.XX legible).
		const buscar = page.getByPlaceholder('Buscar productos...');
		await expect(buscar).toBeEnabled({ timeout: 15_000 });
		await buscar.fill('E2E Aceite');
		await page
			.getByRole('button', { name: 'Vista de lista', exact: true })
			.click();

		// Sin cliente y sin lista en el PV: la default del tenant aplica (H3/LP-1.2).
		await expect(page.getByText('$165.00').first()).toBeVisible({ timeout: 15_000 });

		// Al carrito; el flujo con cliente vive en "Crear venta y factura".
		await page
			.getByRole('button', { name: 'Agregar E2E Aceite Volumen 1L al carrito' })
			.click();
		const botonFactura = page.getByRole('button', { name: 'Crear venta y factura' });
		await expect(botonFactura).toBeVisible();
		await botonFactura.click();
		await expect(page.getByText('Elige un cliente')).toBeVisible({ timeout: 10_000 });

		// Seleccionar el cliente con lista: la UI re-resuelve con la misma
		// cadena del server y el carrito pasa de 165 a 150 (LP-1.3).
		await page
			.getByRole('combobox')
			.filter({ hasText: 'Elige un cliente' })
			.click();
		await page.getByRole('option', { name: 'E2E Cliente Lista' }).click();
		await expect(page.getByText('$150.00').first()).toBeVisible({ timeout: 15_000 });

		await page.getByRole('button', { name: 'Confirmar y facturar' }).click();

		// El cobro refleja el total de la lista del cliente.
		await expect(page.getByText(/Total a cobrar: \$150/)).toBeVisible({ timeout: 15_000 });

		await page.locator('#monto-recibido').fill('200');
		await page.getByRole('button', { name: 'Cobrar', exact: true }).click();

		// La venta se registra por el precio de la lista del cliente, no por la
		// default: el server habría rechazado cualquier otro precio (PRICE_MISMATCH).
		await expect(page.getByText(/Se ha registrado la venta por \$150/)).toBeVisible({
			timeout: 20_000,
		});
	});
});
