import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPermissionByKey } from '@/lib/auth/permission-registry';

/**
 * Gate de drift estático (PG-07 T1): garantiza que el código nunca referencie
 * una clave de permiso inexistente en el registry. Escanea el árbol `src`,
 * extrae claves pasadas a requirePermission/hasPermission y valida cada una.
 * CI: este test forma parte de la suite unitaria.
 */

const SRC = join(process.cwd(), 'src');
const KEY_RE = /(requirePermission|hasPermission)\([^,]+,\s*'([a-z0-9]+(?:\.[a-z0-9-]+){2})'/g;
const EXCLUDE = ['__tests__', '__integration__', '__fixtures__'];

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.some((x) => entry === x)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function referencedKeys(): string[] {
  const keys = new Set<string>();
  for (const file of collectFiles(SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(KEY_RE)) keys.add(m[2]);
  }
  return [...keys];
}

describe('PG-07 drift de permisos', () => {
  it('no hay claves referenciadas que falten en el registry', () => {
    const keys = referencedKeys();
    expect(keys.length).toBeGreaterThan(0);
    const missing = keys.filter((k) => !getPermissionByKey(k));
    expect(missing).toEqual([]);
  });

  it('toda clave referenciada tiene defaultRoles no vacíos (nunca fail-open por vacío)', () => {
    const keys = referencedKeys();
    for (const k of keys) {
      const def = getPermissionByKey(k);
      expect(def, `clave inexistente ${k}`).toBeDefined();
      expect(def!.defaultRoles.length, `defaultRoles vacío en ${k}`).toBeGreaterThan(0);
    }
  });
});