/**
 * @description Script para verificar si los planes están seedeados en BD.
 * Uso: railway run npx tsx scripts/check-plans-seed.ts
 */
import { PrismaClient } from "../src/generated/prisma";

async function main() {
	const prisma = new PrismaClient();
	try {
		const count = await prisma.plan.count();
		console.log(`📊 Planes en BD: ${count}`);

		if (count > 0) {
			const planes = await prisma.plan.findMany({
				select: { nombre: true, precio: true },
			});
			planes.forEach((p) =>
				console.log(`   ✅ ${p.nombre} — $${p.precio}/mes`),
			);
		} else {
			console.log("   ❌ No hay planes. Hay que correr el seed.");
		}
	} finally {
		await prisma.$disconnect();
	}
}

main();
