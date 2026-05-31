import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const BASIC_FEATURES = {
	productos: true,
	categorias: true,
	unidades: true,
	almacenes: true,
	ventas: true,
	"venta-servicios": true,
	clientes: true,
	facturas: true,
	"series-facturacion": true,
	gastos: true,
	dashboard: true,
	"reportes-basicos": true,
	"puntos-venta": true,
	"turnos-pos": true,
	"arqueo-caja": true,
	"cuadre-diario": true,
	perfil: true,
	"mi-empresa": true,
	configuracion: true,
	servicios: true,
	notificaciones: true,
	ofertas: true,
	contabilidad: false,
	empleados: false,
	"pago-salario": false,
	compras: false,
	vendors: false,
	mermas: false,
	transferencias: false,
	produccion: false,
	reparaciones: false,
	contratos: false,
	"listas-precios": false,
	"reportes-financieros": false,
	backups: false,
	"cuentas-cobrar": false,
	"cuentas-pagar": false,
	"prestamos-cash": false,
	"deudas-cash": false,
	anticipos: false,
	"multi-moneda": false,
} as const;

const PROFESSIONAL_FEATURES: Record<string, boolean> = {};
for (const key of Object.keys(BASIC_FEATURES)) {
	PROFESSIONAL_FEATURES[key] = true;
}

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
				descripcion: "Operaciones esenciales para negocios en crecimiento.",
				precio: 1500,
				duracionDias: 30,
				maxUsuarios: 2,
				maxAlmacenes: 1,
				maxProductos: 100,
				maxClientes: 200,
				maxPuntosVenta: 1,
				maxFacturasMes: 200,
				maxContratos: 0,
				incluyeBackups: false,
				features: BASIC_FEATURES,
			},
			{
				nombre: "Profesional",
				descripcion: "PYME en crecimiento con automatización y control total.",
				precio: 4500,
				duracionDias: 30,
				maxUsuarios: 10,
				maxAlmacenes: 5,
				maxProductos: 5000,
				maxClientes: 0,
				maxPuntosVenta: 5,
				maxFacturasMes: 0,
				maxContratos: 50,
				incluyeBackups: true,
				features: PROFESSIONAL_FEATURES,
			},
		],
	});

	console.log("Planes Básico y Profesional creados correctamente.");
}

if (require.main === module) {
	seedPlans()
		.catch((e) => {
			console.error(e);
			process.exit(1);
		})
		.finally(() => prisma.$disconnect());
}
