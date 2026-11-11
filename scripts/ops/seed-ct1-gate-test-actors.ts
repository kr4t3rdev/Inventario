import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import bcrypt from 'bcryptjs';

import { PrismaClient } from '../../src/generated/prisma';
import {
	assertDisposableDatabase,
	assertDisposableDatabaseIdentity,
} from '../ci/disposable-database.mjs';

const DATABASE_NAME = 'tcp_test_ct1_gates_ready_20261110';
const CREDENTIALS_PATH = resolve(
	process.env.CT1_GATE_CREDENTIALS_PATH
		?? join(tmpdir(), 'opencode', 'ct1-gates-ready-credentials.json'),
);

const ACTORS = [
	{ key: 'r6-technical-owner', name: 'R6 Technical Owner', role: 'regularUser' },
	{ key: 'qa', name: 'QA Gate Reviewer', role: 'regularUser' },
	{ key: 'sre-dba', name: 'SRE DBA Gate Operator', role: 'regularUser' },
	{ key: 'global-controller', name: 'Global Finance Controller', role: 'regularUser' },
	{ key: 'rollout-operator', name: 'Tenant Rollout Operator', role: 'admin' },
	{ key: 'tenant-owner', name: 'Pilot Tenant Owner', role: 'regularUser' },
	{ key: 'tenant-finance-approver', name: 'Pilot Tenant Finance Approver', role: 'regularUser' },
	{ key: 'release-approver', name: 'Release Approver', role: 'regularUser' },
	{ key: 'product-operations-owner', name: 'Product Operations Owner', role: 'regularUser' },
] as const;

/**
 * @description Crea un entorno de prueba aislado y actores sintéticos para los gates CT-1.
 * @returns {Promise<void>} Completa la siembra y guarda credenciales fuera del repositorio.
 */
async function main(): Promise<void> {
	const databaseUrl = assertDisposableDatabase(process.env);
	const target = new URL(databaseUrl);
	if (target.pathname.slice(1) !== DATABASE_NAME) {
		throw new Error('DATABASE_URL no apunta a la base CT-1 aprobada para esta siembra.');
	}

	const prisma = new PrismaClient();
	const credentials: Array<{ email: string; password: string; role: string }> = [];
	try {
		const identity = await prisma.$queryRaw<Array<{
			databaseName: string;
			roleName: string;
			serverPort: number;
		}>>`
			SELECT current_database() AS "databaseName",
			       current_user AS "roleName",
			       current_setting('port')::int AS "serverPort"
		`;
		assertDisposableDatabaseIdentity(identity[0], process.env);

		const existingCounts = await Promise.all([
			prisma.tenant.count(),
			prisma.user.count(),
			prisma.tenantMembership.count(),
			prisma.tenantRole.count(),
			prisma.tenantLicense.count(),
		]);
		if (existingCounts.some((count) => count !== 0)) {
			throw new Error('La base local debe estar vacía antes de sembrar actores.');
		}
		if (existsSync(CREDENTIALS_PATH)) {
			throw new Error('El archivo de credenciales ya existe; no se sobrescribirá.');
		}

		await prisma.$transaction(async (tx) => {
			const pilotTenant = await tx.tenant.create({
				data: { tenantId: 'ct1-gates-pilot', nombre: 'CT1 Gate Local - Piloto' },
			});
			const controlTenant = await tx.tenant.create({
				data: { tenantId: 'ct1-gates-control', nombre: 'CT1 Gate Local - Control' },
			});
			const expiration = new Date();
			expiration.setFullYear(expiration.getFullYear() + 1);
			await tx.tenantLicense.createMany({
				data: [pilotTenant, controlTenant].map((tenant) => ({
					tenantId: tenant.tenantId,
					expiracion: expiration,
					isDemo: true,
					features: {},
					featureOverrides: {},
				})),
			});

			const roleIds = new Map<string, string>();
			for (const tenant of [pilotTenant, controlTenant]) {
				const customRoles = [
					{ nombre: 'CT1 - Ejecutor de rollout', descripcion: 'Identidad sintética de operador.' },
					{
						nombre: 'CT1 - Aprobador de Finanzas',
						descripcion: 'Identidad sintética de aprobación tenant.',
						permissions: ['config.contabilidad.politica'],
					},
					{ nombre: 'CT1 - Owner del tenant', descripcion: 'Identidad sintética de owner.' },
				];
				for (const role of customRoles) {
					const { permissions = [], ...roleData } = role;
					const created = await tx.tenantRole.create({
						data: { ...roleData, tenantId: tenant.tenantId, permissions },
					});
					roleIds.set(`${tenant.tenantId}:${role.nombre}`, created.roleId);
				}
			}

			for (const actor of ACTORS) {
				const email = `ct1-${actor.key}@test.invalid`;
				const password = randomBytes(24).toString('base64url');
				const user = await tx.user.create({
					data: {
						name: actor.name,
						email,
						password: await bcrypt.hash(password, 12),
						role: actor.role,
						onboardingStatus: 'completed',
						emailVerifiedAt: new Date(),
						isActive: true,
					},
				});

				const memberships = actor.key === 'tenant-owner'
					? [{ tenantId: pilotTenant.tenantId, tenantRole: 'manager', customRoleId: null }]
					: actor.key === 'tenant-finance-approver'
						? [{
							tenantId: pilotTenant.tenantId,
							tenantRole: 'dependiente',
							customRoleId: roleIds.get(`${pilotTenant.tenantId}:CT1 - Aprobador de Finanzas`) ?? null,
						}]
						: [];
				for (const membership of memberships) {
					await tx.tenantMembership.create({ data: { ...membership, userId: user.userId } });
				}
				credentials.push({ email, password, role: actor.key });
			}
		});

		mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true, mode: 0o700 });
		writeFileSync(CREDENTIALS_PATH, `${JSON.stringify({
			database: DATABASE_NAME,
			tenants: ['ct1-gates-pilot', 'ct1-gates-control'],
			actors: credentials,
		}, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
		chmodSync(CREDENTIALS_PATH, 0o600);
		console.log(JSON.stringify({
			database: DATABASE_NAME,
			tenantIds: ['ct1-gates-pilot', 'ct1-gates-control'],
			actors: credentials.map(({ email, role }) => ({ email, role })),
			credentialsPath: CREDENTIALS_PATH,
			tenantFeatureOverrides: 'none; effective mode not asserted by this seed',
		}));
	} finally {
		await prisma.$disconnect();
	}
}

void main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : 'CT1 gate seed failed.');
	process.exitCode = 1;
});
