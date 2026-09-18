'use client';

/**
 * @description Matriz de permisos por categoría, controlada (checkbox).
 * Renderiza el catálogo del registry agrupado por categoría; cada fila es un
 * checkbox con label + descripción + badge "sensitive" si aplica.
 *
 * @param {object} props - Props del componente.
 * @param {string[]} selectedKeys - Claves seleccionadas actualmente.
 * @param {(keys: string[]) => void} onChange - Callback con el nuevo set de claves.
 * @param {boolean} [disabled] - Deshabilita la matriz (p.ej. editando rol en uso).
 * @returns {JSX.Element} Matriz de permisos agrupada.
 */
import { getCategoriesWithPermissions } from '@/features/roles/lib/role-matrix';

interface PermissionMatrixProps {
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

export function PermissionMatrix({ selectedKeys, onChange, disabled }: PermissionMatrixProps) {
  const categories = getCategoriesWithPermissions();
  const selected = new Set(selectedKeys);

  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange([...next]);
  };

  const categoryAllSelected = (keys: string[]) => keys.every((k) => selected.has(k));
  const toggleCategory = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) if (on) next.add(k);
    else next.delete(k);
    onChange([...next]);
  };

  return (
    <div className="space-y-5" data-testid="permission-matrix">
      {categories.map(({ key: catKey, permissions }) => (
        <fieldset key={catKey} className="border rounded-lg p-4">
          <legend className="px-2 font-semibold capitalize">{catKey}</legend>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              aria-label={`Seleccionar todos en ${catKey}`}
              checked={categoryAllSelected(permissions.map((p) => p.key))}
              onChange={(e) => toggleCategory(permissions.map((p) => p.key), e.target.checked)}
              disabled={disabled || permissions.length === 0}
            />
            <span>Seleccionar todos</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {permissions.map((perm) => (
              <label
                key={perm.key}
                className="flex items-start gap-2 rounded-md border p-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  aria-label={perm.label}
                  checked={selected.has(perm.key)}
                  onChange={(e) => toggle(perm.key, e.target.checked)}
                  disabled={disabled}
                />
                <span className="text-sm">
                  <span className="font-medium">{perm.label}</span>
                  {perm.sensitive && (
                    <span
                      className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700"
                    >
                      sensible
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">{perm.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}