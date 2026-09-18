import {
  PERMISSION_CATEGORIES,
  PERMISSION_REGISTRY,
  type PermissionDef,
} from '@/lib/auth/permission-registry';

/** Conjunto vacío canónico para roles sin permisos. */
export const EMPTY_PERMISSIONS: readonly string[] = [];

/**
 * @description Agrupa los permisos del registry por categoría, preservando el
 * orden de `PERMISSION_CATEGORIES`. Pérdida: las categorías sin permisos se omiten.
 * @returns {Record<string, PermissionDef[]>} Mapa categoría → permisos.
 */
export function groupPermissionsByCategory(): Record<string, PermissionDef[]> {
  const grouped: Record<string, PermissionDef[]> = {};
  for (const cat of PERMISSION_CATEGORIES) {
    grouped[cat] = [];
  }
  for (const def of PERMISSION_REGISTRY) {
    if (!grouped[def.category]) grouped[def.category] = [];
    grouped[def.category].push(def);
  }
  // Eliminar categorías vacías para no pintar secciones sin contenido.
  return Object.fromEntries(Object.entries(grouped).filter(([, perms]) => perms.length > 0));
}

/**
 * @description Lista de categorías en orden, cada una con sus permisos, para
 * iterar en el render de la matriz.
 * @returns {Array<{ key: string; permissions: PermissionDef[] }>} Secciones ordenadas.
 */
export function getCategoriesWithPermissions(): Array<{
  key: string;
  permissions: PermissionDef[];
}> {
  const grouped = groupPermissionsByCategory();
  return PERMISSION_CATEGORIES
    .filter((cat) => grouped[cat]?.length)
    .map((cat) => ({ key: cat, permissions: grouped[cat] }));
}