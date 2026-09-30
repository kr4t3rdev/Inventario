/**
 * Seed script para provisionar un tenant demo dedicado a pruebas de carga.
 * Reutiliza la fábrica oficial de demos (createDemoTenantForPlan) para crear
 * tenant, licencia demo, usuario manager y datos sembrados del plan.
 *
 * Uso:
 *   npx tsx prisma/seed/create-loadtest-demo.ts <planId> [duracionDias]
 *   npx tsx prisma/seed/create-loadtest-demo.ts            (lista planes)
 */

import { createDemoTenantForPlan } from '../../src/lib/services/demo-tenant-factory';
import { prismaPlatform as prisma } from '../../src/lib/db/platform-prisma';

/**
 * @description Punto de entrada del seed de tenant demo para load testing.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
	const planId = process.argv[2];

	if (!planId) {
		const planes = await prisma.plan.findMany({
			select: { planId: true, nombre: true, maxProductos: true },
		});
		console.log('Planes disponibles:');
		for (const plan of planes) {
			console.log(`  ${plan.planId} | ${plan.nombre} | maxProductos=${plan.maxProductos}`);
		}
		return;
	}

	const durationDays = Number(process.argv[3] ?? '30');
	const demo = await createDemoTenantForPlan({
		planId,
		demoName: 'Load Test',
		durationDays,
	});

	const puntosDeVenta = await prisma.puntoDeVenta.findMany({
		where: { tenantId: demo.tenantId },
		select: { pvId: true, nombre: true },
	});

	console.log('=== TENANT DEMO CREADO ===');
	console.log(JSON.stringify({ ...demo, puntosDeVenta }, null, 2));
}

main()
	.catch((error) => {
		console.error('Error creando tenant demo:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
