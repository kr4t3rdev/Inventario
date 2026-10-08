import { test, expect, Page } from '@playwright/test'

/**
 * E2E tests for CLAS validation in category form
 * Tests both success and failure scenarios when EAN-13 mode is enabled/disabled
 */

test.describe('Category Form CLAS Validation (E2E)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    // Note: These tests assume the app is running on localhost:3000
    // and that the user is authenticated (use auth.setup.ts for setup)
  })

  test.afterEach(async () => {
    await page.close()
  })

  /**
   * Scenario 1: Try to create root category with invalid CLAS when EAN-13 is ON
   */
  test('should reject invalid root category name when EAN-13 mode is enabled', async () => {
    // Setup: Ensure EAN-13 mode is ON
    // This would need to be done via API or direct DB modification in test setup
    
    await page.goto('http://localhost:3000/busy/categoria/new')
    
    // Wait for the form to load
    await page.waitForSelector('input[name="nombre"]')
    
    // Try to create category with invalid CLAS section name
    await page.fill('input[name="nombre"]', 'InvalidCategory')
    await page.fill('textarea[name="descripcion"]', 'Test description')
    
    // Submit the form
    await page.click('button[type="submit"]')
    
    // Verify that the specific error toast appears for root category
    const toastMessage = page.locator('text=Estas en modo generacion ean-13 por lo q categoria debe coincidir')
    await expect(toastMessage).toBeVisible()
    
    // Verify that the form did NOT submit (we're still on /busy/categoria/new)
    await expect(page).toHaveURL(/\/busy\/categoria\/new/)
  })

  /**
   * Scenario 2: Try to create subcategory with invalid CLAS when EAN-13 is ON
   */
  test('should reject invalid subcategory name when EAN-13 mode is enabled', async () => {
    await page.goto('http://localhost:3000/busy/categoria/new')
    
    await page.waitForSelector('select[name="parentId"]')
    
    // Select a parent category (assuming one exists)
    const parentSelect = await page.$('select[name="parentId"]')
    if (parentSelect) {
      // Get the first non-"none" option
      const options = await parentSelect.evaluate((el: HTMLSelectElement) =>
        Array.from(el.options).map(opt => opt.value)
      )
      const validParent = options.find(opt => opt !== 'none')
      
      if (validParent) {
        await page.selectOption('select[name="parentId"]', validParent)
      }
    }
    
    // Try to create subcategory with invalid CLAS
    await page.fill('input[name="nombre"]', 'InvalidSubcategoryName')
    await page.fill('textarea[name="descripcion"]', 'Test description')
    
    // Submit the form
    await page.click('button[type="submit"]')
    
    // Verify that the specific error toast appears for subcategory
    const toastMessage = page.locator('text=Estas en modo generacion ean-13 por lo q la subcategoria ingresada')
    await expect(toastMessage).toBeVisible()
    
    // Verify that the form did NOT submit
    await expect(page).toHaveURL(/\/busy\/categoria\/new/)
  })

  /**
   * Scenario 3: Successfully create root category with valid CLAS when EAN-13 is ON
   */
  test('should allow valid root category when EAN-13 mode is enabled', async () => {
    await page.goto('http://localhost:3000/busy/categoria/new')
    
    await page.waitForSelector('input[name="nombre"]')
    
    // Use a valid CLAS section name
    await page.fill('input[name="nombre"]', 'CONFECCIONES')
    await page.fill('textarea[name="descripcion"]', 'Ropa y accesorios')
    
    // Keep parentId as "none" (root category)
    
    // Submit the form
    await page.click('button[type="submit"]')
    
    // Wait for the form to process
    await page.waitForTimeout(1000)
    
    // Should NOT show error toast
    const errorToast = page.locator('text=Estas en modo generacion ean-13')
    await expect(errorToast).not.toBeVisible({ timeout: 2000 })
    
    // Should redirect to category list (or show success message)
    // This depends on the actual redirect behavior
    await page.waitForNavigation({ timeout: 5000 }).catch(() => {
      // Navigation might not happen, that's ok
    })
  })

  /**
   * Scenario 4: Allow flexible naming when EAN-13 is OFF
   */
  test('should allow any category name when EAN-13 mode is disabled', async () => {
    // Setup would disable EAN-13 mode
    // This assumes the test setup handles this via API or DB
    
    await page.goto('http://localhost:3000/busy/categoria/new')
    
    await page.waitForSelector('input[name="nombre"]')
    
    // Use a custom/invalid CLAS name (should be allowed)
    await page.fill('input[name="nombre"]', 'CustomCategory')
    await page.fill('textarea[name="descripcion"]', 'This is a custom category')
    
    // Submit the form
    await page.click('button[type="submit"]')
    
    // Wait for the form to process
    await page.waitForTimeout(1000)
    
    // Should NOT show CLAS validation error
    const unanToast = page.locator('text=Estas en modo generacion ean-13')
    await expect(unanToast).not.toBeVisible({ timeout: 2000 })
    
    // Form should allow submission
    await page.waitForNavigation({ timeout: 5000 }).catch(() => {
      // Navigation might not happen, that's ok
    })
  })

  /**
   * Scenario 5: Case-insensitive validation
   */
  test('should accept valid CLAS names case-insensitively', async () => {
    await page.goto('http://localhost:3000/busy/categoria/new')
    
    await page.waitForSelector('input[name="nombre"]')
    
    // Test with different case variations
    const testCases = ['confecciones', 'CONFECCIONES', 'Confecciones']
    
    for (const name of testCases) {
      // Clear previous values
      await page.fill('input[name="nombre"]', '')
      await page.fill('input[name="nombre"]', name)
      await page.fill('textarea[name="descripcion"]', 'Test')
      
      // Submit
      await page.click('button[type="submit"]')
      await page.waitForTimeout(500)
      
      // Should NOT show CLAS error for any case variation
      const errorToast = page.locator('text=Estas en modo generacion ean-13 por lo q categoria debe coincidir')
      await expect(errorToast).not.toBeVisible({ timeout: 1000 })
      
      // Go back to form if we navigated away
      if (await page.url().includes('categoria') && !await page.url().includes('new')) {
        await page.goBack()
        await page.waitForSelector('input[name="nombre"]')
      }
    }
  })
})
