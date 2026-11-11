/**
 * @description Repone `Venta.costoVentaFecha` en las ventas que ya.tenian el
 * devengo consumido antes de que existiera la columna (CT-1).
 *
 * La migracion `20261118000000_venta_costo_fecha` hace el mismo backfill en
 * SQL, pero el sincronizado de esquema de este proyecto usa por defecto
 * `prisma db push` (`scripts/run-prisma-schema-sync.sh`), que **no ejecuta el
 * SQL de las migraciones**. Este script cubre esa via: es idempotente y se
 * puede correr las veces que haga falta.
 *
 * Regla de reposicion (ver `venta-costo-fecha-backfill.ts`): solo se repone la
 * fecha cuando la venta nunca fue modificada despues de crearse
 * (`updatedAt = createdAt`), que es la poblacion que el criterio anterior del
 * replay admitia. Las ventas PVE entregadas mas tarde se quedan sin fecha:
 * su devengo real es desconocido y el replay las omite de forma explicita.
 *
 * Uso (con el entorno del ambiente objetivo):
 *   pnpm exec tsx scripts/ops/backfill-venta-costo-fecha.ts          # simulación
 *   pnpm exec tsx scripts/ops/backfill-venta-costo-fecha.ts --apply  # aplica
 */
import { PrismaClient } from '../../src/generated/prisma';
import {
	aplicarBackfillVentaCostoFecha,
	type ResumenBackfillVentaCostoFecha,
} from '../../src/features/contabilidad-formal/services/venta-costo-fecha-backfill';

const APPLY = process.argv.includes('--apply');

const prisma = new PrismaClient();

/**
 * @description Imprime el resumen del backfill por tenant.
 * @param {ResumenBackfillVentaCostoFecha} resumen - Resultado de la corrida.
 * @returns {void}
 */
function imprimirResumen(resumen: ResumenBackfillVentaCostoFecha): void {
	console.log(
		`[backfill-venta-costo-fecha] evaluadas=${resumen.evaluadas} ` +
		`repostas=${resumen.repostas} omitidas=${resumen.omitidas} ` +
		`actualizadas=${resumen.actualizadas} modo=${APPLY ? 'apply' : 'simular'}`,
	);
	for (const tenant of resumen.porTenant) {
		console.log(
			`[backfill-venta-costo-fecha] tenant=${tenant.tenantId} ` +
			`repostas=${tenant.repostas} omitidas=${tenant.omitidas}`,
		);
	}
	if (!APPLY && resumen.repostas > 0) {
		console.log(
			'[backfill-venta-costo-fecha] Repite con --apply para escribir los cambios.',
		);
	}
	if (resumen.omitidas > 0) {
		console.log(
			'[backfill-venta-costo-fecha] Las ventas omitidas conservan la fecha de ' +
			'devengo desconocida: el replay las omite con FECHA_COSTO_FIFO_NO_PERSISTIDA.',
		);
	}
}

async function main(): Promise<void> {
	const resumen = await aplicarBackfillVentaCostoFecha(prisma as never, { simular: !APPLY });
	imprimirResumen(resumen);
}

main()
	.catch((error: unknown) => {
		console.error('[backfill-venta-costo-fecha] ERROR:', error);
		process.exitCode = 1;
	})
	.finally(() => {
		void prisma.$disconnect();
	});
