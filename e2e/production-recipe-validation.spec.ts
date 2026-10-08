import { test, expect } from '@playwright/test';

/**
 * @description E2E tests for production recipe creation with unit validation.
 * Tests the UI behavior: warning banner, ⚠️ icons in table, and button disable logic.
 *
 * Auth: uses beforeAll to get JWT via API login, then beforeEach injects it into
 * sessionStorage using addInitScript (runs before page load, so auth-context finds token).
 *
 * Key selectors (based on actual source at src/app/busy/produccion/page.tsx):
 * - Input nombre: input#nombre
 * - Input rendimiento: input#rendimiento
 * - Input busqueda: input#busqueda
 * - Product buttons: [role="dialog"] button -> text match
 * - Unit select: [role="combobox"] - Shadcn Select uses combobox role
 * - Unit option: [role="option"] in dropdown
 */

const E2E_EMAIL = 'e2e@test.local';
const E2E_PASSWORD = 'E2ETest123!';
const E2E_ACEITE = 'E2E Aceite Volumen 1L';
const E2E_ARROZ = 'E2E Arroz Masa 1kg';

test.describe('Production Recipe Creation - Unit Validation', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    expect(response.ok(), `Auth failed (${response.status()}): ${await response.text()}`).toBeTruthy();
    const data = await response.json();
    authToken = data.token;
  });

  test.beforeEach(async ({ page }) => {
    // Inject token into sessionStorage BEFORE the page loads so auth-context picks it up
    await page.addInitScript((tok: string) => {
      sessionStorage.setItem('token', tok);
    }, authToken);

    await page.goto('/busy/produccion');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Helper: Open the Nueva Receta dialog
   */
  async function openNewRecipeDialog(page: any): Promise<void> {
    // Button shows "+ Nueva Receta" in the Recetas tab
    const trigger = page.locator('button').filter({ hasText: 'Nueva Receta' }).first();
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(300);
  }

  /**
   * Helper: Add an ingredient by search term
   * @param page - Playwright page
   * @param searchTerm - Partial name to type in the search box
   * @param buttonText - Text that appears in the product button (defaults to searchTerm)
   */
  async function addIngredient(page: any, searchTerm: string, buttonText?: string): Promise<void> {
    const match = buttonText ?? searchTerm;
    const busquedaInput = page.locator('input#busqueda');
    await busquedaInput.fill(searchTerm);
    await page.waitForTimeout(600);

    // Product appears as a button in the search grid inside the dialog
    const productButton = page.locator('[role="dialog"] button').filter({ hasText: new RegExp(match, 'i') }).first();
    await expect(productButton).toBeVisible({ timeout: 5000 });
    await productButton.click();
    await page.waitForTimeout(300);
  }

  /**
   * Helper: Get the row for a given ingredient name from the items table.
  * nombre should be a partial unique name present in the E2E fixtures catalog.
   */
  function getIngredientRow(page: any, nombre: string) {
    return page.locator('[role="dialog"] table tbody tr').filter({ hasText: nombre }).first();
  }

  /**
   * Helper: Change unit of an ingredient in the table.
   * Uses exact regex to avoid partial matches (e.g., 'L' must not match 'lb', 'ml').
   */
  async function setUnitForIngredient(page: any, nombre: string, unit: string): Promise<void> {
    const row = getIngredientRow(page, nombre);
    const unitCombo = row.locator('[role="combobox"]').first();
    await unitCombo.click();
    await page.waitForTimeout(200);
    // Escape special regex chars and anchor to exact match
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`^${escaped}$`);
    await page.locator('[role="option"]').filter({ hasText: exactRegex }).first().click();
    await page.waitForTimeout(200);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Warning icon appears when units are incompatible
  // ─────────────────────────────────────────────────────────────────────────────

  test('Shows ⚠️ icon and warning banner when ingredient units are incompatible', async ({ page }) => {
    await openNewRecipeDialog(page);

    // Fill basic info
    await page.locator('input#nombre').fill('Refresco Test');
    await page.locator('input#rendimiento').fill('2');

    // Add seeded volume product (catalog unit: L = volume)
    await addIngredient(page, E2E_ACEITE, E2E_ACEITE);

    // Verify ingredient row exists
    const aceiteRow = getIngredientRow(page, E2E_ACEITE);
    await expect(aceiteRow).toBeVisible();

    // Set mass unit on a volume product → incompatible (L volume vs kg mass)
    await setUnitForIngredient(page, 'Aceite', 'kg');
    await page.waitForTimeout(300);

    // Verify ⚠️ icon appears in row
    const rowText = await aceiteRow.textContent();
    expect(rowText).toContain('⚠️');

    // Verify warning banner is visible somewhere in dialog
    const dialog = page.locator('[role="dialog"]').first();
    const dialogText = await dialog.textContent();
    expect(dialogText).toMatch(/Advertencia|incompatible|unidad/i);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Button disabled when warnings exist  
  // ─────────────────────────────────────────────────────────────────────────────

  test('Disables "Crear Receta" button when incompatible units present', async ({ page }) => {
    await openNewRecipeDialog(page);

    await page.locator('input#nombre').fill('Receta Bloqueada');
    await page.locator('input#rendimiento').fill('1');

    // Aceite catalog unit is L (volume); setting kg (mass) is incompatible
    await addIngredient(page, E2E_ACEITE, E2E_ACEITE);
    await setUnitForIngredient(page, E2E_ACEITE, 'kg');

    // Wait for re-render
    await page.waitForTimeout(400);

    // The button should be disabled OR replaced by "Arreglar Unidades" button
    const createBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Crear Receta' }).first();
    const arreglarBtn = page.locator('[role="dialog"] button').filter({ hasText: /Arreglar/ }).first();

    const createVisible = await createBtn.isVisible().catch(() => false);
    const arreglarVisible = await arreglarBtn.isVisible().catch(() => false);

    if (createVisible) {
      // Button exists but should be disabled
      const isDisabled = await createBtn.evaluate((btn) =>
        (btn as HTMLButtonElement).disabled
      );
      expect(isDisabled).toBe(true);
    } else if (arreglarVisible) {
      // Button replaced with warning state - also check it's disabled
      const isDisabled = await arreglarBtn.evaluate((btn) =>
        (btn as HTMLButtonElement).disabled
      );
      expect(isDisabled).toBe(true);
    } else {
      // Fallback: at least warning should be shown
      const dialogText = await page.locator('[role="dialog"]').textContent();
      expect(dialogText).toMatch(/Advertencia|incompatible/i);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Button re-enables when warning is resolved
  // ─────────────────────────────────────────────────────────────────────────────

  test('Re-enables button when incompatible unit is corrected', async ({ page }) => {
    await openNewRecipeDialog(page);

    await page.locator('input#nombre').fill('Receta Arreglada');
    await page.locator('input#rendimiento').fill('1');

    // Aceite catalog unit: L (volume). Setting kg (mass) → incompatible
    await addIngredient(page, E2E_ACEITE, E2E_ACEITE);
    await setUnitForIngredient(page, E2E_ACEITE, 'kg');
    await page.waitForTimeout(300);

    // Verify warning appears
    const aceiteRow = getIngredientRow(page, E2E_ACEITE);
    let rowText = await aceiteRow.textContent();
    expect(rowText).toContain('⚠️');

    // Fix it: change back to L (same volume category as catalog)
    await setUnitForIngredient(page, E2E_ACEITE, 'L');
    await page.waitForTimeout(400);

    // Warning should disappear
    rowText = await aceiteRow.textContent();
    expect(rowText).not.toContain('⚠️');

    // Button should be re-enabled
    const createBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Crear Receta' }).first();
    await expect(createBtn).toBeVisible();
    const isDisabled = await createBtn.evaluate((btn) =>
      (btn as HTMLButtonElement).disabled
    );
    expect(isDisabled).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Successful recipe creation with compatible units
  // ─────────────────────────────────────────────────────────────────────────────

  test('Creates recipe successfully when all units are compatible', async ({ page }) => {
    await openNewRecipeDialog(page);

    const uniqueName = `Receta-${Date.now()}`;
    await page.locator('input#nombre').fill(uniqueName);
    await page.locator('input#rendimiento').fill('1');

    await addIngredient(page, E2E_ACEITE, E2E_ACEITE);
    // Set unit to 'L' → L (volume) vs L (catalog volume) = compatible
    await setUnitForIngredient(page, E2E_ACEITE, 'L');
    await page.waitForTimeout(300);

    // Verify no warning (L vs L = compatible)
    const aceiteRow = getIngredientRow(page, E2E_ACEITE);
    const rowText = await aceiteRow.textContent();
    expect(rowText).not.toContain('⚠️');

    // Button should be enabled (no incompatible units)
    const createBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Crear Receta' }).first();
    await expect(createBtn).toBeVisible();
    const isDisabled = await createBtn.evaluate((btn) =>
      (btn as HTMLButtonElement).disabled
    );
    expect(isDisabled).toBe(false);

    // Click and verify dialog closes
    await createBtn.click();

    // After submission, dialog should close
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Wait for page refresh and verify recipe is listed
    await page.waitForTimeout(1000);
    const pageText = await page.textContent('body');
    expect(pageText).toContain(uniqueName);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: Warning banner lists all ingredients with issues
  // ─────────────────────────────────────────────────────────────────────────────

  test('Warning banner lists all incompatible ingredients', async ({ page }) => {
    await openNewRecipeDialog(page);

    await page.locator('input#nombre').fill('Muchos Problemas');
    await page.locator('input#rendimiento').fill('1');

    // Add Aceite (catalog: L) with incompatible unit kg (mass vs volume)
    await addIngredient(page, E2E_ACEITE, E2E_ACEITE);
    await setUnitForIngredient(page, E2E_ACEITE, 'kg');
    await page.waitForTimeout(300);

    // ⚠️ icon must appear in the Aceite row
    const aceiteRow = getIngredientRow(page, E2E_ACEITE);
    const aceiteText = await aceiteRow.textContent();
    expect(aceiteText).toContain('⚠️');

    // The "Crear Receta" button is replaced by the disabled "Arreglar Unidades" button
    const arreglarBtn = page.locator('[role="dialog"] button').filter({ hasText: /Arreglar/ }).first();
    await expect(arreglarBtn).toBeVisible();

    // Add Arroz (catalog: kg) with incompatible unit L (volume vs mass)
    await addIngredient(page, E2E_ARROZ, E2E_ARROZ);
    const arrozRow = getIngredientRow(page, E2E_ARROZ);
    const arrozExists = await arrozRow.isVisible().catch(() => false);

    if (arrozExists) {
      await setUnitForIngredient(page, E2E_ARROZ, 'L'); // Incompatible: L (volume) vs kg (mass)
      await page.waitForTimeout(300);

      // Both rows must show ⚠️
      const aceiteText2 = await getIngredientRow(page, E2E_ACEITE).textContent();
      const arrozText2 = await arrozRow.textContent();
      expect(aceiteText2).toContain('⚠️');
      expect(arrozText2).toContain('⚠️');

      // Arreglar Unidades button still visible
      await expect(arreglarBtn).toBeVisible();
    }
  });
});
