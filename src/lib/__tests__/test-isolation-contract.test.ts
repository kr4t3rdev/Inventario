/**
 * @description Contrato de la barrera de tests de integración (MM-B).
 * TDD: este test es el contrato que la barrera debe cumplir.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('MM-B barrera de tests de integración', () => {
  it('la suite unitaria corre con una DATABASE_URL inalcanzable (barrera)', () => {
    // La barrera se aplica en vitest.setup.ts y pisamos cualquier valor real.
    const url = process.env.DATABASE_URL ?? '';
    expect(url).toContain('127.0.0.1');
  });

  it('existe un archivo de configuración de integración dedicado', () => {
    const integrationConfig = join(process.cwd(), 'vitest.integration.config.mjs');
    expect(existsSync(integrationConfig)).toBe(true);
  });

  it('vitest.config.mjs excluye el directorio __integration__ por defecto', () => {
    const config = readFileSync(join(process.cwd(), 'vitest.config.mjs'), 'utf-8');
    expect(config).toContain('__integration__');
  });

  it('hay un script package.json para correr integración por separado', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkg.scripts).toHaveProperty('test:integration');
  });

  it('ningún test unitario puede tocar prisma real (contrato estático)', () => {
    // Escanear todos los tests y fallar los que importen actions de escritura
    // de prisma sin mockear @/lib/prisma explícitamente.
    const rd = (dir: string): string[] => {
      const out: string[] = [];
      if (!existsSync(dir)) return out;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...rd(p));
        else if (/\.test\.tsx?$/.test(p)) out.push(p);
      }
      return out;
    };

    const integrationDirs: string[] = [];
    const unitTests: string[] = [];
    for (const f of rd(join(process.cwd(), 'src'))) {
      if (f.includes('__integration__')) integrationDirs.push(f);
      else unitTests.push(f);
    }
    for (const f of rd(join(process.cwd(), 'scripts'))) {
      if (f.includes('__integration__')) integrationDirs.push(f);
    }

    // Regla estática: cualquier test unitario que importe actions de
    // escritura DEBE mockear `@/lib/prisma` directamente, o mockear el
    // módulo service que las usa (indirectamente, via importación de
    // una dependencia también mockeada). El contrato es: no existir
    // test unitario que pueda llamar a la DB real.
    const offenders: string[] = [];
    for (const f of unitTests) {
      const src = readFileSync(f, 'utf-8');
      const touchesWriteActions = /import\s+.*\bfrom\s+["']@\/features\/.*\/actions/.test(src);
      if (!touchesWriteActions) continue;

      const mocksPrisma =
        src.includes('vi.mock("@/lib/prisma"') ||
        src.includes('vi.mock(\'@/lib/prisma\'') ||
        src.includes('doMock("@/lib/prisma"');
      // Si el test mockkea una dependencia específica que ya es la
      // indirección de prisma (service o action mockeada completa),
      // es válido y no necesita prisma.
      const mocksDependency = /vi\.mock\(\s*["']@\/features\/[^"']+["']/.test(src);
      // Cualquier test que no cockpit prisma *y* no tenga otro mock del
      // dominio (servicio de contabilidad, action de reviews/sales-agent)
      // es un candidato a tocar DB real.
      const likelyTouchesDb = !mocksPrisma && !mocksDependency;

      if (likelyTouchesDb) {
        offenders.push(f);
      }
    }
    expect(
      offenders,
      `Tests que importan actions de escritura sin mock de prisma ni de dominio:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('ningún test unitario importa platform-prisma (escape hatch auditado)', () => {
    // platform-prisma es el cliente SIN enforcement: solo auth, admin,
    // seeds, scripts, afiliados y cron (verificado en AS-03). Ningún test
    // unitario debe tocarlo; la integración usa @/lib/prisma (escopado).
    const rd = (dir: string): string[] => {
      const out: string[] = [];
      if (!existsSync(dir)) return out;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...rd(p));
        else if (/\.test\.tsx?$/.test(p) && !p.includes('__integration__')) out.push(p);
      }
      return out;
    };

    const offenders = rd(join(process.cwd(), 'src')).filter((f) => {
      if (f.endsWith('test-isolation-contract.test.ts')) return false;
      return /(?:import|from)\s+["']@\/lib\/db\/platform-prisma["']/.test(
        readFileSync(f, 'utf-8'),
      );
    });
    expect(
      offenders,
      `Tests unitarios que importan platform-prisma:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('el helper withTestTenant está disponible para escopar tests', async () => {
    // Import dinámico para no cargar Prisma en el contrato.
    const { withTestTenant, getTenantContext } = await import('@/lib/db/tenant-context');
    const seen = withTestTenant('tenant-contrato', () => getTenantContext()?.tenantId);
    expect(seen).toBe('tenant-contrato');
    expect(getTenantContext()).toBeUndefined();
  });
});
