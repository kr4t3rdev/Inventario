import { describe, expect, it } from 'vitest';
import { getDefaultPermissionsForRole, PERMISSION_REGISTRY } from '@/lib/auth/permission-registry';
import { TENANT_ROLES, type TenantRole } from '@/lib/auth/roles';
import fixture from './__fixtures__/permission-parity.json';

/**
 * Snapshot de paridad día-1 (PG01-T4).
 *
 * Congela, para cada rol fijo, el conjunto de permisos efectivos que el
 * servidor acepta HOY (auditoría en impact-map.md: guards requireManagerRole,
 * allowlist viva de withAuth y acciones sin guard) y exige que el resolutor de
 * defaults del registry produzca exactamente ese conjunto.
 *
 * El fixture es la expectativa versionada. La allowlist legacy (TENANT_PERMISSIONS)
 * fue retirada en PG-05 T6; la política declarada queda fijada en este snapshot.
 */

interface ParityFixture {
	[role: string]: string[];
}

const fixtureRoles = fixture as unknown as ParityFixture;

/** Claves cuya acción NO tiene guard de rol server-side hoy (impact-map, bucket F + ventas). */
const UNGUARDED_KEYS = [
	'inventario.mermas.registrar',
	'inventario.mermas.editar',
	'inventario.mermas.eliminar',
	'inventario.transferencias.gestionar',
	'inventario.categorias.gestionar',
	'inventario.almacenes.gestionar',
	'ventas.venta.registrar',
];

function fixtureFor(role: TenantRole): string[] {
	const list = fixtureRoles[role];
	expect(list, `falta rol ${role} en el fixture`).toBeDefined();
	return list;
}

describe('fixture de paridad — forma', () => {
	it('cubre exactamente los 3 roles fijos', () => {
		expect(Object.keys(fixtureRoles).sort()).toEqual([...TENANT_ROLES].sort());
	});

	it('las listas están ordenadas, sin duplicados y solo con claves del registry', () => {
		const knownKeys = new Set(PERMISSION_REGISTRY.map((p) => p.key));
		for (const [role, keys] of Object.entries(fixtureRoles)) {
			expect([...keys].sort(), `fixture ${role} no está ordenado`).toEqual(keys);
			expect(new Set(keys).size, `fixture ${role} tiene duplicados`).toBe(keys.length);
			for (const key of keys) {
				expect(knownKeys.has(key), `clave desconocida en fixture ${role}: ${key}`).toBe(true);
			}
		}
	});

	it('el fixture de manager contiene todas las claves del registry', () => {
		const allKeys = PERMISSION_REGISTRY.map((p) => p.key).sort();
		expect(fixtureFor('manager')).toEqual(allKeys);
	});
});

describe('paridad día-1 — resolutor del registry ≡ snapshot', () => {
	it.each([...TENANT_ROLES])('defaultPermissions(%s) produce exactamente el snapshot', (role) => {
		const resolved = [...getDefaultPermissionsForRole(role)].sort();
		expect(resolved).toEqual(fixtureFor(role));
	});

	it('las claves sin guard server-side están en los 3 roles (paridad de servidor abierto)', () => {
		for (const role of TENANT_ROLES) {
			const set = new Set(fixtureFor(role));
			for (const key of UNGUARDED_KEYS) {
				expect(set.has(key), `${role} debería conservar ${key}`).toBe(true);
			}
		}
	});

	it('una clave con requireManagerRole (rrhh.nomina.calcular) solo vive en manager', () => {
		expect(fixtureFor('manager')).toContain('rrhh.nomina.calcular');
		expect(fixtureFor('economico')).not.toContain('rrhh.nomina.calcular');
		expect(fixtureFor('dependiente')).not.toContain('rrhh.nomina.calcular');
	});
});

describe('paridad de la política declarada (facturas/empleados) sin allowlist', () => {
		it('ventas.facturas.consultar cubre manager y dependiente (política declarada)', () => {
			expect(fixtureFor('dependiente')).toContain('ventas.facturas.consultar');
			expect(fixtureFor('economico')).not.toContain('ventas.facturas.consultar');
		});

		it('las claves rrhh quedan fuera de economico y dependiente (manager-only)', () => {
			expect(fixtureFor('economico').some((k) => k.startsWith('rrhh.'))).toBe(false);
			expect(fixtureFor('dependiente').some((k) => k.startsWith('rrhh.'))).toBe(false);
		});

		it('las claves derivadas del sidebar económico siguen en economico', () => {
			for (const key of ['financiero.reportes.ver', 'financiero.stats.ver']) {
				expect(fixtureFor('economico')).toContain(key);
			}
		});
	});
