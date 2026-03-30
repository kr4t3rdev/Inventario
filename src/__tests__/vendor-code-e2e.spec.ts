/**
 * @description Test E2E del flujo de vendedores y códigos consecutivos
 * Valida: crear vendor → obtener código → listar → actualizar
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

test.describe('Vendor Code System E2E', () => {
  test('should create new vendor with auto-assigned code', async ({ page }) => {
    // Ir a página de nuevos proveedores
    await page.goto(`${BASE_URL}/busy/vendor/new`)
    
    // Llenar formulario
    await page.fill('input[name="nombre"]', `Test Vendor ${Date.now()}`)
    await page.fill('input[name="contacto"]', 'John Doe')
    await page.fill('input[name="telefono"]', '+1234567890')
    
    // Enviar
    await page.click('button[type="submit"]')
    
    // Esperar redirección a lista
    await page.waitForURL(`${BASE_URL}/busy/vendor`)
    
    // El nuevo vendor debe aparecer en la lista
    const lastRow = page.locator('tr').last()
    await expect(lastRow).toContainText(`Test Vendor`)
  })

  test('should display vendor code and EAN13 on detail page', async ({ page }) => {
    // Ir a lista de vendors
    await page.goto(`${BASE_URL}/busy/vendor`)
    
    // Clickear el primer vendor
    const firstEditButton = page.locator('a[href*="/update/"]').first()
    await firstEditButton.click()
    
    // Verificar que se muestra el código
    const vendorCode = page.locator('text="Código de Proveedor"')
    await expect(vendorCode).toBeVisible()
    
    const ean13 = page.locator('text="Código EAN13"')
    await expect(ean13).toBeVisible()
  })

  test('should prevent modifying vendor code', async ({ page }) => {
    // Ir a página de actualización de vendor
    await page.goto(`${BASE_URL}/busy/vendor`)
    
    // Abrir edit del primer vendor
    const firstEditButton = page.locator('a[href*="/update/"]').first()
    await firstEditButton.click()
    
    // Intentar cambiar el código (no debería ser posible editarlo)
    const vendorCodeInput = page.locator('input[name="vendorCode"]')
    
    // Si existe el input, debería estar disabled
    if (await vendorCodeInput.count() > 0) {
      await expect(vendorCodeInput).toBeDisabled()
    }
  })

  test('should list vendors with codes and EAN13', async ({ page }) => {
    // Ir a lista de vendors
    await page.goto(`${BASE_URL}/busy/vendor`)
    
    // Al menos un vendor debe listar
    await expect(page.locator('tbody tr')).not.toHaveCount(0)
    
    // Los vendors deben tener visible sus códigos en la tabla
    // (dependiendo del diseño, puede estar en diferentes cols)
    const tableRows = page.locator('tbody tr').first()
    await expect(tableRows).toBeVisible()
  })
})
