/**
 * Seed script para crear los 3 planes de suscripción.
 * Usa las claves del Feature Registry (src/features/planes/feature-registry.ts)
 *
 * Ejecutar: npx tsx prisma/seed/plans-seed.ts
 */

import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

/* ─── Plan 1: Básico — $30/mes ─── */

export const PLAN_BASICO_FEATURES: Record<string, boolean> = {
	// Inventario
	productos: true,
	"productos-stock-masivo": false,
	restock: true,
	categorias: true,
	"categorias-ean13": false,
	unidades: true,
	"listas-precios": false,
	"ficha-costo-bulk": false,
	// Operaciones
	almacenes: true,
	"puntos-venta": true,
	transferencias: true,
	mermas: true,
	// Ventas
	"ventas-pos": true,
	"ventas-factura": false,
	"turnos-pos": true,
	"arqueo-caja": true,
	"cuadre-diario": false,
	ofertas: false,
	// Clientes y Facturación
	clientes: false,
	facturacion: false,
	"series-facturacion": false,
	// Compras
	proveedores: true,
	compras: true,
	servicios: false,
	// Financiero
	gastos: true,
	contabilidad: true,
	"transferencias-bancarias": false,
	"ajustes-bancarios": false,
	"multi-moneda": false,
	"rentabilidad-compra": true,
	"inyeccion-capital": false,
	"reportes-financieros": true,
	"cuentas-cobrar": false,
	"cuentas-pagar": false,
	"prestamos-cash": false,
	"deudas-cash": false,
	anticipos: false,
	"analisis-estado-cuenta": false,
	"facturas-vencidas": false,
	// Producción
	produccion: false,
	reparaciones: false,
	// RRHH
	empleados: true,
	vacaciones: false,
	asistencia: false,
	nomina: false,
	// Empresa y Config
	"mi-empresa": true,
	"mi-empresa-ean13": false,
	contratos: false,
	"gestion-usuarios": true,
	notificaciones: false,
	configuracion: true,
	dashboard: true,
	"upload-mi-empresa-logo": true,
	"upload-clientes-logo": false,
	"upload-vendors-logo": false,
	"upload-profile-avatar": false,
	"upload-deudas-cash-receipt": false,
	"upload-productos-photo": false,
	"upload-contratos-attachment": false,
	"upload-contratos-version": false,
	// Infra
	"backups-semanal": true,
	"backups-diario": false,
	"backups-tiempo-real": false,
	"api-integraciones": false,
};

/* ─── Plan 2: Profesional — $70/mes ─── */

export const PLAN_PROFESIONAL_FEATURES: Record<string, boolean> = {
	...PLAN_BASICO_FEATURES,
	// Habilita adicionales
	"listas-precios": true,
	"cuadre-diario": true,
	ofertas: true,
	clientes: true,
	facturacion: true,
	"series-facturacion": true,
	"multi-moneda": true,
	"transferencias-bancarias": true,
	"ajustes-bancarios": true,
	"servicios": true,
	"reportes-financieros": true,
	empleados: true,
	notificaciones: true,
	"ventas-factura": true,
	"backups-semanal": false,
	"backups-diario": true,
	"upload-clientes-logo": true,
	"upload-vendors-logo": true,
	"upload-profile-avatar": true,
	"upload-deudas-cash-receipt": true,
};

/* ─── Plan 3: Empresarial — $100/mes ─── */

export const PLAN_EMPRESARIAL_FEATURES: Record<string, boolean> = {
	...PLAN_PROFESIONAL_FEATURES,
	// Habilita todo excepto reparaciones y api-integraciones
	"productos-stock-masivo": true,
	"categorias-ean13": true,
	produccion: true,
	nomina: true,
	vacaciones: true,
	asistencia: true,
	"mi-empresa-ean13": true,
	contratos: true,
	"cuentas-cobrar": true,
	"cuentas-pagar": true,
	"prestamos-cash": true,
	"deudas-cash": true,
	anticipos: true,
	"analisis-estado-cuenta": true,
	"facturas-vencidas": true,
	"multitenantmembership": true,
	"inyeccion-capital": true,
	"ficha-costo-bulk": true,
	// Backups cada hora + restauración point-in-time
	"backups-diario": false,
	"backups-tiempo-real": true,
	"upload-productos-photo": true,
	"upload-contratos-attachment": true,
	"upload-contratos-version": true,
	// NO incluidos
	reparaciones: false,
	"api-integraciones": false,
};

/* ─── Seed ─── */

export async function seedPlans() {
	const existing = await prisma.plan.count();
	if (existing > 0) {
		console.log(`Ya existen ${existing} planes. Se omite seed.`);
		return;
	}

	await prisma.plan.createMany({
		data: [
			{
				nombre: "Básico",
				descripcion:
					"Base sólida para arrancar tu negocio. Incluye productos con código, almacenes, POS, contabilidad en CUP y backups semanales.",
				precio: 30,
				duracionDias: 30,
				maxUsuarios: 3,
				maxAlmacenes: 2,
				maxProductos: 500,
				maxClientes: 0,
				maxPuntosVenta: 2,
				maxFacturasMes: 0,
				maxContratos: 0,
				incluyeBackups: true,
				features: PLAN_BASICO_FEATURES,
			},
			{
				nombre: "Profesional",
				descripcion:
					"PYME en crecimiento con facturación electrónica, multi-moneda, empleados, clientes y backups diarios.",
				precio: 70,
				duracionDias: 30,
				maxUsuarios: 5,
				maxAlmacenes: 5,
				maxProductos: 5000,
				maxClientes: 0,
				maxPuntosVenta: 5,
				maxFacturasMes: 0,
				maxContratos: 50,
				incluyeBackups: true,
				features: PLAN_PROFESIONAL_FEATURES,
			},
			{
				nombre: "Empresarial",
				descripcion:
					"Máxima potencia con producción, nómina, generación EAN-13, cuentas por cobrar/pagar y backups cada hora + restauración point-in-time.",
				precio: 100,
				duracionDias: 30,
				maxUsuarios: 10,
				maxAlmacenes: 999,
				maxProductos: 999999,
				maxClientes: 0,
				maxPuntosVenta: 999,
				maxFacturasMes: 0,
				maxContratos: 999,
				incluyeBackups: true,
				features: PLAN_EMPRESARIAL_FEATURES,
			},
		],
	});

	console.log(
		"✅ Planes: Básico ($30), Profesional ($70) y Empresarial ($100) creados.",
	);
}

if (require.main === module) {
	seedPlans()
		.catch((e) => {
			console.error(e);
			process.exit(1);
		})
		.finally(() => prisma.$disconnect());
}
