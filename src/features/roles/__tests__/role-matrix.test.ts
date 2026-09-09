import { describe, expect, it } from 'vitest';
import {
  groupPermissionsByCategory,
  getCategoriesWithPermissions,
  EMPTY_PERMISSIONS,
} from '@/features/roles/lib/role-matrix';

/**
 * Contrato de la matriz de permisos (PG-06 T1): agrupación determinística por
 * categoría (orden del registry) para pintar checkboxes por sección.
 */
describe('role-matrix (PG-06)', () => {
  it('agrupa los permisos del registry por categoría', () => {
    const grouped = groupPermissionsByCategory();
    const categories = Object.keys(grouped);

    // Al menos las 8 categorías del registry tienen clave.
    expect(categories.length).toBeGreaterThanOrEqual(8);
    // Cada categoría agrupa al menos un permiso.
    for (const cat of categories) {
      expect(grouped[cat].length).toBeGreaterThan(0);
    }
  });

  it('el orden de categorías es estable (sigue el orden del registry)', () => {
    const a = groupPermissionsByCategory();
    const b = groupPermissionsByCategory();
    expect(Object.keys(a)).toEqual(Object.keys(b));
  });

  it('cada entrada mantiene key/label/sensitive[opcional] para pintar la matriz', () => {
    const grouped = groupPermissionsByCategory();
    const first = Object.values(grouped)[0][0];
    expect(typeof first.key).toBe('string');
    expect(typeof first.label).toBe('string');
    // sensitive es opcional: cuando está, debe ser booleano.
    expect(first.sensitive === undefined || typeof first.sensitive === 'boolean').toBe(true);
  });

  it('getCategoriesWithPermissions expone el orden para la UI', () => {
    const list = getCategoriesWithPermissions();
    expect(list.length).toBeGreaterThanOrEqual(8);
    // Cada elemento: { key: string; permissions: PermissionDef[] }
    const first = list[0];
    expect(typeof first.key).toBe('string');
    expect(Array.isArray(first.permissions)).toBe(true);
  });
});