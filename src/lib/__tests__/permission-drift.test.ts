import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPermissionByKey } from '@/lib/auth/permission-registry';
import {
  getMobilePermissionKey,
  getRoutePermissionKey,
  MOBILE_ACTION_KEYS,
  MOBILE_GROUP_KEYS,
  ROUTE_PERMISSION_MAP,
} from '@/lib/auth/route-permissions';

/**
 * Gate de drift estático (PG-07 T1, endurecido en hallazgo #7).
 *
 * Garantías:
 * 1. Ninguna clave pasada a requirePermission/hasPermission (literal, constante
 *    local tipo `const GESTIONAR = 'cat.rec.x` o identificador dinámico
 *    whitelisteado) falta en el registry.
 * 2. Toda clave referenciada tiene defaultRoles no vacíos (nunca fail-open por vacío).
 * 3. Toda clave del route-map REST y de los mapas mobile existe en el registry.
 * 4. Cada ruta mobile en disco tiene clave mapeada o exención explícita.
 * 5. Cada método exportado de una ruta `withAuth(...)` está cubierto por el mapa.
 */

const SRC = join(process.cwd(), 'src');
const APP_ROOT = join(SRC, 'app');
const EXCLUDE = ['__tests__', '__integration__', '__fixtures__'];

// Captura del segundo argumento de requirePermission/hasPermission.
// LITERAL: la clave entre comillas (simples o dobles). El primer argumento se
// acepta de forma no-codiciosa hasta la coma previa a la clave.
const LITERAL_CALL_RE =
  /(?:requirePermission|hasPermission)\([\s\S]*?,\s*['"]([a-z0-9]+(?:\.[a-z0-9-]+){2})['"]/g;

// IDENTIFICADOR: segundo argumento que no es un literal (constante local del
// mismo archivo, o dinámico whitelisteado). El primer argumento no puede
// contener comas, por lo que el match no puede "saltar" sobre otros statements.
const IDENT_CALL_RE =
  /(?:requirePermission|hasPermission)\(\s*(\w[\w$.]*)\s*,\s*([A-Za-z_$][\w$]*)\s*[,)]/g;

// Identificadores cuyo valor deriva de los mapas de rutas (cubiertos por los
// tests de mapa más abajo) — no resolvibles a literal sin evaluar.
const DYNAMIC_ARG_WHITELIST: Record<string, string[]> = {
  'src/lib/auth-middleware.ts': ['routeKey', 'mobileKey'],
};

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE.some((x) => entry === x)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function relKey(file: string): string {
  return `src/${relative(SRC, file)}`.replace(/\\/g, '/');
}

function toWebPath(file: string): string {
  // src/app/api/empleados/asistencia/[id]/route.ts → /api/empleados/asistencia/[id]
  const rel = relative(APP_ROOT, file).replace(/\\/g, '/');
  return `/${rel.replace(/\/route\.ts$/, '')}`;
}

/** Extrae claves de permiso referenciadas y tokens de segundo argumento sin resolver. */
function referencedKeys(): { keys: string[]; unresolved: string[] } {
  const keys = new Set<string>();
  const unresolved: string[] = [];

  for (const file of collectFiles(SRC)) {
    const src = readFileSync(file, 'utf8');

    for (const m of src.matchAll(LITERAL_CALL_RE)) {
      keys.add(m[1]);
    }

    for (const m of src.matchAll(IDENT_CALL_RE)) {
      const ident = m[2];
      // identificador == clave literal definida en el mismo archivo: resolverla
      const defRe = new RegExp(
        `const\\s+${ident}\\s*(?::[^=]+)?=\\s*["']([a-z0-9]+(?:\\.[a-z0-9-]+){2})["']`,
      );
      const def = src.match(defRe);
      if (def) {
        keys.add(def[1]);
        continue;
      }

      if (!(DYNAMIC_ARG_WHITELIST[relKey(file)] ?? []).includes(ident)) {
        unresolved.push(`${relKey(file)}: '${ident}' no es literal ni constante local resoluble`);
      }
    }
  }

  return { keys: [...keys], unresolved };
}

/** Métodos exportados de ruta que usan explícitamente el wrapper `withAuth(...)`. */
function withAuthMethods(src: string): string[] {
  const found = new Set<string>();
  const re = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*withAuth\(/g;
  for (const m of src.matchAll(re)) found.add(m[1]);
  return [...found];
}

describe('PG-07 drift de permisos', () => {
  it('no hay claves referenciadas que falten en el registry', () => {
    const { keys, unresolved } = referencedKeys();
    expect(unresolved, unresolved.join('\n')).toEqual([]);
    expect(keys.length).toBeGreaterThan(0);
    const missing = keys.filter((k) => !getPermissionByKey(k));
    expect(missing).toEqual([]);
  });

  it('toda clave referenciada tiene defaultRoles no vacíos (nunca fail-open por vacío)', () => {
    const { keys } = referencedKeys();
    for (const k of keys) {
      const def = getPermissionByKey(k);
      expect(def, `clave inexistente ${k}`).toBeDefined();
      expect(def!.defaultRoles.length, `defaultRoles vacío en ${k}`).toBeGreaterThan(0);
    }
  });

  it('toda clave de los mapas de rutas (web y mobile) existe en el registry', () => {
    const keys = [
      ...ROUTE_PERMISSION_MAP.map((r) => r.key),
      ...Object.values(MOBILE_GROUP_KEYS).filter((k): k is string => k !== null),
      ...Object.values(MOBILE_ACTION_KEYS).flatMap((byAction) => Object.values(byAction)),
    ];
    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      const def = getPermissionByKey(key);
      expect(def, `clave de mapa sin registro: ${key}`).toBeDefined();
      expect(def!.defaultRoles.length, `defaultRoles vacío en ${key}`).toBeGreaterThan(0);
    }
  });

  it('cada ruta del API mobile tiene clave mapeada o exención explícita', () => {
    const mobileRoot = join(APP_ROOT, 'api', 'mobile');
    const EXEMPT_GROUPS = new Set(['auth', 'plans']);
    const offenders: string[] = [];

    for (const file of collectFiles(mobileRoot)) {
      if (!file.endsWith('route.ts')) continue;
      const webPath = toWebPath(file);
      const key = getMobilePermissionKey(webPath);
      if (key !== null) {
        expect(
          getPermissionByKey(key),
          `ruta mobile ${webPath} usa clave sin registro: ${key}`,
        ).toBeDefined();
        continue;
      }
      // Exentas: auth/* (público o sesión), plans/* (catálogo), admin/* (plataforma,
      // salvo admin/memberships que sí está mapeado a config.usuarios.gestionar).
      const segments = webPath.replace(/^\/api\/mobile\/(v1\/)?/, '').split('/');
      const [group, sub] = segments;
      const exempt = EXEMPT_GROUPS.has(group) || (group === 'admin' && sub !== 'memberships');
      if (!exempt) offenders.push(webPath);
    }

    expect(offenders, `rutas mobile sin permiso ni exención: ${offenders.join(', ')}`).toEqual([]);
  });

  it('cada método exportado de una ruta con withAuth está cubierto por el route-map', () => {
    const apiRoot = join(APP_ROOT, 'api');
    const offenders: string[] = [];

    for (const file of collectFiles(apiRoot)) {
      if (!file.endsWith('route.ts')) continue;
      const src = readFileSync(file, 'utf8');
      const methods = withAuthMethods(src);
      if (methods.length === 0) continue;

      const webPath = toWebPath(file);
      for (const method of methods) {
        const key = getRoutePermissionKey(webPath, method);
        if (!key) offenders.push(`${method} ${webPath}`);
        else expect(getPermissionByKey(key)).toBeDefined();
      }
    }

    expect(offenders, `rutas withAuth sin clave en el route-map: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });
});
