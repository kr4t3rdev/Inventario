import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const roots: string[] = [];
const script = join(process.cwd(), 'scripts/check-dominio-imports.mjs');

/** @description Crea un árbol de prueba aislado. @returns {string} Raíz temporal. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dominio-gate-'));
  roots.push(root);
  return root;
}

/** @description Escribe un módulo de prueba. @param {string} root - Raíz. @param {string} path - Ruta relativa. @param {string} body - Código. @returns {void} */
function put(root: string, path: string, body: string): void {
  const target = join(root, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, body);
}

/** @description Ejecuta el gate contra la fixture. @param {string} root - Raíz. @returns {ReturnType<typeof spawnSync>} Resultado. */
function run(root: string) {
  return spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
}

afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('frontera src/dominio', () => {
  it('reporta PENDIENTE si el núcleo no existe, validando configuración', () => {
    const root = fixture();
    expect(run(root)).toMatchObject({ status: 0 });
    expect(run(root).stdout).toContain('PENDIENTE');
  });

  it.each([
    ['directo', "import 'next/headers';"],
    ['tipo', "import type { PrismaClient } from '@prisma/client';"],
    ['global request', 'export const cookie = globalThis.headers;'],
    ['efecto de entrada', "console.log('side effect'); export const x = 1;"],
    ['app', "export { x } from '@/app/server';"],
    ['adaptador', "import '@/features/productos/adapters/prisma';"],
  ])('rechaza %s con diagnóstico', (_, body) => {
    const root = fixture();
    put(root, 'src/dominio/application/index.ts', body);
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('src/dominio/application/index.ts');
  });

  it('sigue relativos, alias, reexports y dependencias transitivas con cadena', () => {
    const root = fixture();
    put(root, 'src/dominio/index.ts', "export * from './application/list';");
    put(root, 'src/dominio/application/list.ts', "import '@/lib/bridge';");
    put(root, 'src/lib/bridge.ts', "export * from '../features/productos/adapters/db';");
    put(root, 'src/features/productos/adapters/db.ts', "import 'next/server';");
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/dominio\/index\.ts.*application\/list\.ts.*lib\/bridge\.ts.*adapters\/db\.ts/s);
  });

  it('admite módulos puros, incluidos imports de tipo y efectos locales sin runtime', () => {
    const root = fixture();
    put(root, 'src/dominio/index.ts', "import type { Id } from '@/lib/pure'; export { id } from './id';");
    put(root, 'src/dominio/id.ts', "import { id } from '@/lib/pure'; export { id };");
    put(root, 'src/lib/pure.ts', 'export type Id = string; export const id = 1;');
    expect(run(root).status).toBe(0);
  });

  it('rechaza imports dinámicos, require y efectos en inicializadores', () => {
    for (const body of ["export async function load() { return import('next/headers'); }",
      "export const db = require('@prisma/client');",
      "export const db = globalThis.fetch('/api');"]) {
      const root = fixture();
      put(root, 'src/dominio/index.ts', body);
      expect(run(root).status).not.toBe(0);
    }
  });
});
