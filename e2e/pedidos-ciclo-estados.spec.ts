import { test, expect, Page } from '@playwright/test'

/**
 * E2E del ciclo de vida de pedidos de venta (PVE):
 * nuevo pedido → entregar → facturar, con badges PEDIDO → ENTREGADA → FACTURADA.
 *
 * Requisitos del entorno:
 * - Migración add_estado_ciclo_venta aplicada y plan del usuario e2e con la
 *   feature "ventas-pedidos" activa (si no, cada test se omite con aviso).
 * - Usuario autenticado vía auth.setup.ts.
 *
 * Este spec corre manual tras el deploy (workflow e2e-prod / pnpm run test:e2e:prod).
 */

test.describe('Pedidos de venta: ciclo de estados (E2E)', () => {
	test.setTimeout(180_000)

	async function ensurePedidosEnabled(page: Page, testInfo: any) {
		const botonNuevoPedido = page.getByRole('button', { name: /nuevo pedido/i })
		if (!(await botonNuevoPedido.isVisible().catch(() => false))) {
			testInfo.skip(true, 'El plan del usuario e2e no tiene la feature ventas-pedidos')
		}
		return botonNuevoPedido
	}

	test('flujo completo: pedido → entregada → facturada', async ({ page }) => {
		await page.goto('/busy/sales')
		await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible()

		const botonNuevoPedido = await ensurePedidosEnabled(page, test.info())

		// ── Crear pedido ──
		await botonNuevoPedido.click()
		await expect(page.getByText('Nuevo pedido', { exact: true })).toBeVisible()

		await page.locator('#pedido-pv').click()
		await page.getByRole('option').first().click()

		await page.getByRole('button', { name: 'Agregar' }).click()
		const contenedorItems = page.getByText('Productos').locator('..')
		await page.locator('[role="dialog"] button[role="combobox"]').nth(-1).click()
		await page.getByRole('option').first().click()
		void contenedorItems

		await page.getByRole('button', { name: 'Crear pedido' }).click()
		await expect(page.getByText('Pedido creado', { exact: false })).toBeVisible({
			timeout: 15_000,
		})

		// ── Badge PEDIDO en la tabla (filtro por estado) ──
		await page.getByLabel('Filtrar por estado').selectOption('PEDIDO')
		await expect(page.getByText('Pedido').first()).toBeVisible()

		// ── Entregar ──
		const botonEntregar = page.locator('button[aria-label^="Entregar pedido"]').first()
		await expect(botonEntregar).toBeVisible({ timeout: 10_000 })
		await botonEntregar.click()
		await expect(page.getByText('Pedido entregado', { exact: false })).toBeVisible({
			timeout: 15_000,
		})

		await page.getByLabel('Filtrar por estado').selectOption('ENTREGADA')
		await expect(page.getByText('Entregada').first()).toBeVisible()

		// ── Facturar ──
		const botonFacturar = page.locator('button[aria-label^="Facturar venta"]').first()
		await expect(botonFacturar).toBeVisible({ timeout: 10_000 })
		await botonFacturar.click()
		await expect(page.getByText('Facturar pedido')).toBeVisible()
		await page.getByRole('button', { name: 'Facturar', exact: true }).click()
		await expect(page.getByText('Pedido facturado', { exact: false })).toBeVisible({
			timeout: 15_000,
		})

		await page.getByLabel('Filtrar por estado').selectOption('FACTURADA')
		await expect(page.getByText('Facturada').first()).toBeVisible()
	})
})
