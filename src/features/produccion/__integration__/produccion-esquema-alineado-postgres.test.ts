/**
 * @description Test de integración real del módulo de producción contra el
 * esquema declarado en Prisma.
 *
 * El módulo arrastraba dos desajustes entre el código y la base de datos:
 *
 * 1. `Receta.costoUnitario` estaba declarado como `Float` en
 *    `prisma/schema.prisma`, pero las migraciones lo dejaron como `INTEGER`.
 *    Como el costo unitario de una receta se calcula dividiendo entre el
 *    rendimiento, el valor normal de esa columna es fraccionario (por ejemplo
 *    `100 / 3 = 33.33`): escribirlo contra una columna entera fallaba con
 *    "column costoUnitario is of type integer but expression is of type double
 *    precision".
 * 2. Las writers del módulo no escribían los campos que el esquema declara
 *    obligatorios y sin valor por defecto (`Receta.recetaId`,
 *    `Receta.updatedAt`, `RecetaIngrediente.id`, `RecetaIngrediente.updatedAt`,
 *    `OrdenProduccion.ordenProduccionId` y `OrdenProduccion.updatedAt`), de
 *    modo que crear una receta, guardar sus ingredientes o abrir una orden
 *    fallaba en tiempo de ejecución.
 *
 * El test comprueba, contra PostgreSQL desechable, que las tres writers del
 * módulo escriben filas completas y que la columna de costo unitario acepta
 * el valor fraccionario que produce el calculo real del modulo.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { calculateCostoUnitarioReceta } from '@/lib/utils/produccion';
import {
	assertDisposableDatabase,
	assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
	getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
	createRecetaProduccionAction,
	setIngredientesRecetaProduccionAction,
	createOrdenProduccionAction,
} = await import('@/features/produccion/actions');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `produccion_esquema_${suffix}`;
const userId = `produccion_esquema_user_${suffix}`;
const email = `${userId}@test.local`;

let productoId = '';

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @returns {AuthenticatedUser} Actor con tenant y plan fijo.
 */
function actor(): AuthenticatedUser {
	return {
		userId,
		name: `Actor ${userId}`,
		email,
		role: 'admin',
		isActive: true,
		tenantId,
		planFeatures: { produccion: true, inventario: true },
	} as unknown as AuthenticatedUser;
}

/**
 * @description Crea una receta directa en la base para las pruebas que la
 * necesitan como entrada de otra writer.
 * @param {string} nombre - Nombre de la receta.
 * @param {number} costoUnitario - Costo unitario de la receta.
 * @returns {Promise<string>} Identificador de la receta creada.
 */
async function crearRecetaBase(nombre: string, costoUnitario = 0): Promise<string> {
	const receta = await prisma.receta.create({
		data: {
			recetaId: `esquema-receta-${randomUUID()}`,
			tenantId,
			nombre,
			rendimiento: 1,
			costoUnitario,
			updatedAt: new Date(),
		},
	});
	return receta.recetaId;
}

describe('modulo de produccion — escritura alineada con el esquema', { timeout: 120_000 }, () => {
	beforeAll(async () => {
		const identity = await prisma.$queryRaw<
			Array<{ databaseName: string; roleName: string; serverPort: number }>
		>`
			SELECT current_database() AS "databaseName", current_user AS "roleName", inet_server_port() AS "serverPort"
		`;
		expect(identity).toHaveLength(1);
		assertDisposableDatabaseIdentity(identity[0], process.env);

		await prisma.tenant.create({
			data: {
				tenantId,
				nombre: `produccion-esquema-${suffix}`,
				slug: `produccion-esquema-${suffix}`,
			},
		});
		await prisma.user.create({
			data: {
				userId,
				name: `Actor ${userId}`,
				email,
				password: 'x',
			},
		});
		const categoria = await prisma.categoria.create({
			data: { nombre: `Cat ${suffix}`, tenantId },
		});
		const almacen = await prisma.almacen.create({
			data: { nombre: `Alm ${suffix}`, tenantId },
		});
		const producto = await prisma.producto.create({
			data: {
				nombre: `Ingrediente ${suffix}`,
				precioCosto: 100,
				precioVenta: 150,
				stock: 20,
				tenant: { connect: { tenantId } },
				categoria: { connect: { catId: categoria.catId } },
				almacen: { connect: { almacenId: almacen.almacenId } },
			},
		});
		productoId = producto.id;
		auth.user = actor();
	}, 120_000);

	afterAll(async () => {
		if (!prisma) return;
		await prisma.recetaIngrediente.deleteMany({ where: { tenantId } });
		await prisma.ordenProduccionHistorial.deleteMany({ where: { tenantId } });
		await prisma.ordenProduccion.deleteMany({ where: { tenantId } });
		await prisma.receta.deleteMany({ where: { tenantId } });
		await prisma.stockUbicacion.deleteMany({ where: { tenantId } });
		await prisma.producto.deleteMany({ where: { tenantId } });
		await prisma.categoria.deleteMany({ where: { tenantId } });
		await prisma.almacen.deleteMany({ where: { tenantId } });
		await prisma.tenant.deleteMany({ where: { tenantId } });
		await prisma.user.deleteMany({ where: { userId } });
	}, 120_000);

	it('persiste el costo unitario fraccionario que calcula el modulo', async () => {
		// El calculo real del modulo: costo del producto final dividido entre
		// el rendimiento de la receta.
		const costoUnitario = calculateCostoUnitarioReceta(100, [], 3);
		expect(costoUnitario).toBe(33.33);

		const receta = await prisma.receta.create({
			data: {
				recetaId: `esquema-receta-${randomUUID()}`,
				tenantId,
				nombre: `Receta fraccionaria ${suffix}`,
				rendimiento: 3,
				costoUnitario,
				updatedAt: new Date(),
			},
		});

		const persistida = await prisma.receta.findUniqueOrThrow({
			where: { recetaId: receta.recetaId },
		});
		expect(persistida.costoUnitario).toBe(33.33);
	});

	it('la action de receta escribe identidad y marca de actualizacion', async () => {
		const resultado = await createRecetaProduccionAction({
			nombre: `Receta de action ${suffix}`,
			rendimiento: 2,
		});

		expect(resultado.success, JSON.stringify(resultado)).toBe(true);
		if (!resultado.success) throw new Error(resultado.error.message);

		const recetaId = resultado.data.recetaId;
		expect(recetaId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

		const persistida = await prisma.receta.findUniqueOrThrow({ where: { recetaId } });
		expect(persistida.tenantId).toBe(tenantId);
		expect(persistida.nombre).toBe(`Receta de action ${suffix}`);
		expect(persistida.rendimiento).toBe(2);
		expect(persistida.updatedAt).toBeInstanceOf(Date);
	});

	it('la action de ingredientes escribe id, unidad y marca de actualizacion', async () => {
		const recetaId = await crearRecetaBase(`Receta con ingredientes ${suffix}`);

		const resultado = await setIngredientesRecetaProduccionAction({
			recetaId,
			ingredientes: [
				{ productoId, cantidad: 2, unidad: 'kg', desperdicio: 0.05 },
			],
		});

		expect(resultado.success, JSON.stringify(resultado)).toBe(true);
		if (!resultado.success) throw new Error(resultado.error.message);

		const ingrediente = await prisma.recetaIngrediente.findFirstOrThrow({
			where: { recetaId, tenantId },
		});
		expect(ingrediente.id).toBeTruthy();
		expect(ingrediente.productoId).toBe(productoId);
		expect(ingrediente.cantidad).toBe(2);
		expect(ingrediente.unidadSimbolo).toBe('kg');
		expect(ingrediente.desperdicio).toBeCloseTo(0.05, 5);
		expect(ingrediente.updatedAt).toBeInstanceOf(Date);
	});

	it('la action de orden escribe identidad y marca de actualizacion', async () => {
		const recetaId = await crearRecetaBase(`Receta con orden ${suffix}`);

		const resultado = await createOrdenProduccionAction({
			recetaId,
			cantidad: 3,
			fechaProduccion: new Date('2026-11-05T00:00:00.000Z').toISOString(),
		});

		expect(resultado.success, JSON.stringify(resultado)).toBe(true);
		if (!resultado.success) throw new Error(resultado.error.message);

		const orden = await prisma.ordenProduccion.findUniqueOrThrow({
			where: { ordenProduccionId: resultado.data.ordenProduccionId },
		});
		expect(orden.tenantId).toBe(tenantId);
		expect(orden.recetaId).toBe(recetaId);
		expect(orden.cantidad).toBe(3);
		expect(orden.estado).toBe('PENDIENTE');
		expect(orden.updatedAt).toBeInstanceOf(Date);
	});
});
