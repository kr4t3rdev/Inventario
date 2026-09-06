import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrato estático del schema TenantRole + Membership.customRoleId (PG-02).
 * Asegura en la suite unitaria, sin base de datos, que la migración mantiene
 * las invariantes de seguridad/diseño del change permisos-granulares.
 * El comportamiento real se valida en `__integration__/tenant-role-model.test.ts`.
 */

const MIGRATION_SQL = readFileSync(
	resolve(process.cwd(), 'prisma/migrations/20260906031708_tenant_custom_roles/migration.sql'),
	'utf-8',
);
const SCHEMA = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf-8');

describe('PG-02 migración tenant_custom_roles — contrato SQL', () => {
	it('crea la tabla tenant_roles con permissions JSONB e isActive default true', () => {
		expect(MIGRATION_SQL).toContain('CREATE TABLE "tenant_roles"');
		expect(MIGRATION_SQL).toContain('"permissions" JSONB NOT NULL');
		expect(MIGRATION_SQL).toContain('"isActive" BOOLEAN NOT NULL DEFAULT true');
	});

	it('impone unicidad (tenantId, nombre) e índice por tenant', () => {
		expect(MIGRATION_SQL).toMatch(
			/CREATE UNIQUE INDEX "tenant_roles_tenantId_nombre_key" ON "tenant_roles"\("tenantId", "nombre"\)/,
		);
		expect(MIGRATION_SQL).toMatch(
			/CREATE INDEX "tenant_roles_tenantId_idx" ON "tenant_roles"\("tenantId"\)/,
		);
	});

	it('añade customRoleId nullable a tenant_memberships con borrado RESTRICT', () => {
		expect(MIGRATION_SQL).toContain(
			'ALTER TABLE "tenant_memberships" ADD COLUMN     "customRoleId" TEXT;',
		);
		expect(MIGRATION_SQL).toContain(
			'REFERENCES "tenant_roles"("roleId") ON DELETE RESTRICT ON UPDATE CASCADE',
		);
	});

	it('borra los roles en cascada al eliminar el tenant', () => {
		expect(MIGRATION_SQL).toContain(
			'REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE',
		);
	});

	it('no contiene operaciones destructivas sobre datos existentes', () => {
		expect(MIGRATION_SQL).not.toMatch(/DROP TABLE/i);
		expect(MIGRATION_SQL).not.toMatch(/DROP COLUMN/i);
		expect(MIGRATION_SQL).not.toMatch(/ALTER COLUMN .* NOT NULL/i);
	});
});

describe('PG-02 schema.prisma — contrato de modelo', () => {
	it('TenantRole declara permissions Json y relación cascade al tenant', () => {
		expect(SCHEMA).toMatch(/model TenantRole \{[\s\S]*?permissions\s+Json/);
		expect(SCHEMA).toMatch(
			/model TenantRole \{[\s\S]*?@relation\(fields: \[tenantId\], references: \[tenantId\], onDelete: Cascade\)/,
		);
	});

	it('TenantMembership vincula customRole opcional con onDelete Restrict', () => {
		expect(SCHEMA).toMatch(/model TenantMembership \{[\s\S]*?customRoleId\s+String\?/);
		expect(SCHEMA).toMatch(
			/customRole\s+TenantRole\?\s+@relation\(fields: \[customRoleId\], references: \[roleId\], onDelete: Restrict\)/,
		);
	});
});
