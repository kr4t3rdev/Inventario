import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATEGORIES,
  PERMISSION_REGISTRY,
  getDefaultPermissionsForRole,
  getPermissionByKey,
  type PermissionCategory,
} from '@/lib/auth/permission-registry';
import { TENANT_ROLES } from '@/lib/auth/roles';

/**
 * Contrato del registry de permisos (PG01-T2).
 * Valida forma del catálogo; la paridad efectiva rol↔capacidad vive en
 * permission-parity.test.ts (PG01-T4).
 */

const KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){2}$/;
const DESTRUCTIVE_ACTIONS = new Set(['eliminar', 'anular', 'cerrar', 'bulk']);
const EXPECTED_CATEGORIES: PermissionCategory[] = [
  'inventario',
  'operaciones',
  'ventas',
  'compras',
  'financiero',
  'produccion',
  'rrhh',
  'config',
];
// Voseo rioplatense prohibido por las reglas de copy del repo.
const FORBIDDEN_VOSEO = /\b(vos|sos|tenés|querés|podés|probá|hacé|elegí|compartí|ganá|registrate)\b/i;

describe('PERMISSION_REGISTRY — estructura', () => {
  it('contiene entre 45 y 60 claves (inventario PG01)', () => {
    expect(PERMISSION_REGISTRY.length).toBeGreaterThanOrEqual(45);
    expect(PERMISSION_REGISTRY.length).toBeLessThanOrEqual(60);
  });

  it('las claves son únicas', () => {
    const keys = PERMISSION_REGISTRY.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('todas las claves siguen el formato <categoria>.<recurso>.<accion>', () => {
    for (const def of PERMISSION_REGISTRY) {
      expect(def.key, `clave mal formateada: ${def.key}`).toMatch(KEY_PATTERN);
    }
  });

  it('el primer segmento de la clave coincide con la categoría declarada', () => {
    for (const def of PERMISSION_REGISTRY) {
      expect(def.key.split('.')[0], `categoría inconsistente en ${def.key}`).toBe(def.category);
    }
  });

  it('las categorías declaradas pertenecen al conjunto válido', () => {
    for (const def of PERMISSION_REGISTRY) {
      expect(EXPECTED_CATEGORIES).toContain(def.category);
    }
    expect([...PERMISSION_CATEGORIES].sort()).toEqual([...EXPECTED_CATEGORIES].sort());
  });

  it('toda categoría válida tiene al menos una clave registrada', () => {
    const used = new Set(PERMISSION_REGISTRY.map((p) => p.category));
    for (const cat of EXPECTED_CATEGORIES) {
      expect(used.has(cat), `categoría vacía: ${cat}`).toBe(true);
    }
  });

  it('label y description son textos no vacíos', () => {
    for (const def of PERMISSION_REGISTRY) {
      expect(def.label.trim().length, `label vacío en ${def.key}`).toBeGreaterThan(0);
      expect(def.description.trim().length, `description vacía en ${def.key}`).toBeGreaterThan(0);
    }
  });

  it('el copy usa español neutro (sin voseo rioplatense)', () => {
    for (const def of PERMISSION_REGISTRY) {
      expect(def.label, `voseo en label de ${def.key}`).not.toMatch(FORBIDDEN_VOSEO);
      expect(def.description, `voseo en description de ${def.key}`).not.toMatch(FORBIDDEN_VOSEO);
    }
  });

  it('defaultRoles no está vacío y es subconjunto de TENANT_ROLES', () => {
    for (const def of PERMISSION_REGISTRY) {
      expect(def.defaultRoles.length, `defaultRoles vacío en ${def.key}`).toBeGreaterThan(0);
      expect(new Set(def.defaultRoles).size, `defaultRoles duplicados en ${def.key}`).toBe(
        def.defaultRoles.length,
      );
      for (const role of def.defaultRoles) {
        expect(TENANT_ROLES as readonly string[]).toContain(role);
      }
    }
  });

  it('toda clave con acción destructiva está marcada como sensitive', () => {
    for (const def of PERMISSION_REGISTRY) {
      const action = def.key.split('.').pop() ?? '';
      if (DESTRUCTIVE_ACTIONS.has(action)) {
        expect(def.sensitive, `${def.key} destructiva sin flag sensitive`).toBe(true);
      }
    }
  });

  it('hay claves sensitive en todas las categorías con operaciones destructivas', () => {
    const sensitive = new Set(
      PERMISSION_REGISTRY.filter((p) => p.sensitive === true).map((p) => p.category),
    );
    for (const cat of [
      'inventario',
      'rrhh',
      'config',
      'produccion',
      'compras',
      'ventas',
      'operaciones',
      'financiero',
    ] as const) {
      expect(sensitive.has(cat), `falta clave sensitive en ${cat}`).toBe(true);
    }
  });
});

describe('getPermissionByKey', () => {
  it('devuelve la definición para una clave existente', () => {
    const def = getPermissionByKey('rrhh.nomina.calcular');
    expect(def).toBeDefined();
    expect(def?.key).toBe('rrhh.nomina.calcular');
  });

  it('devuelve undefined para clave desconocida', () => {
    expect(getPermissionByKey('inventario.fantasma.inexistente')).toBeUndefined();
  });
});

describe('defaults por rol (anclas de la matriz actual)', () => {
  it('rrhh.nomina.calcular es manager-only y sensitive', () => {
    const def = getPermissionByKey('rrhh.nomina.calcular');
    expect(def?.defaultRoles).toEqual(['manager']);
    expect(def?.sensitive).toBe(true);
  });

  it('financiero.auditoria.ver cubre manager y economico (gate real vigente)', () => {
    const def = getPermissionByKey('financiero.auditoria.ver');
    expect(def?.defaultRoles).toEqual(expect.arrayContaining(['manager', 'economico']));
    expect(def?.defaultRoles).not.toContain('dependiente');
  });

  it('ventas.facturas.consultar cubre manager y dependiente (allowlist REST viva), no economico', () => {
    const def = getPermissionByKey('ventas.facturas.consultar');
    expect(def?.defaultRoles).toEqual(expect.arrayContaining(['manager', 'dependiente']));
    expect(def?.defaultRoles).not.toContain('economico');
  });

  it('inventario.mermas.registrar cubre los 3 roles (sin guard server-side hoy)', () => {
    const def = getPermissionByKey('inventario.mermas.registrar');
    expect(def?.defaultRoles).toEqual(
      expect.arrayContaining(['manager', 'economico', 'dependiente']),
    );
  });

  it('las claves derivadas del sidebar económico existen con defaults [manager, economico]', () => {
    for (const key of [
      'financiero.reportes.ver',
      'financiero.stats.ver',
      'financiero.contabilidad.acceder',
      'financiero.gastos.acceder',
    ]) {
      const def = getPermissionByKey(key);
      expect(def, `falta clave ${key}`).toBeDefined();
      expect(def?.defaultRoles).toEqual(expect.arrayContaining(['manager', 'economico']));
      expect(def?.defaultRoles).not.toContain('dependiente');
    }
  });
});

describe('getDefaultPermissionsForRole', () => {
  it('manager recibe TODAS las claves del registry', () => {
    const perms = getDefaultPermissionsForRole('manager');
    expect(perms.size).toBe(PERMISSION_REGISTRY.length);
    for (const def of PERMISSION_REGISTRY) {
      expect(perms.has(def.key)).toBe(true);
    }
  });

  it('economico recibe exactamente las claves con economico en defaultRoles', () => {
    const expected = PERMISSION_REGISTRY.filter((p) => p.defaultRoles.includes('economico')).map(
      (p) => p.key,
    );
    const actual = getDefaultPermissionsForRole('economico');
    expect([...actual].sort()).toEqual(expected.sort());
    expect(actual.size).toBeGreaterThan(0);
  });

  it('dependiente recibe exactamente las claves con dependiente en defaultRoles', () => {
    const expected = PERMISSION_REGISTRY.filter((p) =>
      p.defaultRoles.includes('dependiente'),
    ).map((p) => p.key);
    const actual = getDefaultPermissionsForRole('dependiente');
    expect([...actual].sort()).toEqual(expected.sort());
    expect(actual.size).toBeGreaterThan(0);
  });

  it('rol desconocido recibe conjunto vacío (fail-safe, nunca fail-open)', () => {
    // @ts-expect-error — se prueba comportamiento defensivo ante rol no registrado
    expect(getDefaultPermissionsForRole('intruso').size).toBe(0);
  });
});
