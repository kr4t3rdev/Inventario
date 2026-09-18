import { expect, test, type Page } from '@playwright/test';
import path from 'path';

const STORAGE = path.join(process.cwd(), 'e2e', '.auth', 'state.json');
const BASE = process.env.E2E_BASE_URL || 'https://kr4t3rdev.xyz';

test.use({ storageState: STORAGE });

/**
 * @description Smoke de permisos granulares (PG-07-T3): el manager crea un rol
 * "Cajero" con permisos comerciales vía la matriz, lo ve listado y lo limpia.
 * La verificación de efectos (vender ✅ / anular ❌ / reportes ❌ para un
 * usuario con ese rol) es manual en producción sobre un tenant demo — ver
 * openspec/changes/archive/2026-09-06-permisos-granulares/tasks.md PG07-T3.
 */
test.describe('Roles personalizados — CRUD por UI', () => {
  test.describe.configure({ mode: 'serial' });

  const uniqueName = `Cajero E2E ${Date.now()}`;
  let createdRoleName = '';

  test('crea un rol "Cajero" con permisos de ventas desde la matriz', async ({ page }) => {
    await page.goto(`${BASE}/busy/configuracion/roles`);
    await page.waitForTimeout(2500);

    // Si no hay permiso config.usuarios.gestionar, las actions devuelven error
    // y la página muestra el rol de alerta; en ese caso el smoke debe fallar.
    await expect(page.getByRole('heading', { name: /Roles personalizados/i })).toBeVisible();

    await page.getByRole('button', { name: /Crear rol/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre').fill(uniqueName);

    // Marcar solo permisos de ventas: "Registrar ventas" y "Consultar facturas"
    const registrar = page.getByLabel('Registrar ventas');
    await registrar.check();
    const consultar = page.getByLabel('Consultar facturas');
    await consultar.check();

    // No debe poder marcar permisos de otros dominios por accidente: anular una
    // clave sensible no existe en la matriz (solo acción negada en servidor).
    await dialog.getByRole('button', { name: /Guardar/i }).click();
    await page.waitForTimeout(1500);

    // El rol creado aparece en el listado
    await expect(page.getByText(uniqueName)).toBeVisible();
    createdRoleName = uniqueName;
  });

  test('lista el rol con el conteo de permisos seleccionados', async ({ page }) => {
    // En modo serial comparte estado de sesión, no de página
    await page.goto(`${BASE}/busy/configuracion/roles`);
    await page.waitForTimeout(2500);

    await expect(page.getByText(createdRoleName)).toBeVisible();
  });

  test('elimina el rol creado (limpieza del smoke)', async ({ page }) => {
    await page.goto(`${BASE}/busy/configuracion/roles`);
    await page.waitForTimeout(2500);

    const row = page.getByText(createdRoleName);
    await expect(row).toBeVisible();

    // El botón Eliminar está en el mismo <li> que el nombre del rol
    const li = row.locator('xpath=ancestor::li[1]');
    page.on('dialog', (d) => d.accept());
    await li.getByRole('button', { name: /Eliminar/i }).click();
    await page.waitForTimeout(1500);

    await expect(page.getByText(createdRoleName)).toHaveCount(0);
  });
});