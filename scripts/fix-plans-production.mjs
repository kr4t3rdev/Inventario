/**
 * @description Corrige los planes en BD usando la URL pública de Railway.
 * Uso: node scripts/fix-plans-production.mjs
 */
import pg from "pg";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;

// Leer DATABASE_URL del entorno o usar la pública de Railway
// railway variables -s Postgres --json | jq -r '.DATABASE_PUBLIC_URL'
const PUBLIC_URL = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

const PLAN_BASICO_FEATURES = {
	productos: true,
	"productos-stock-masivo": false,
	restock: true,
	categorias: true,
	"categorias-ean13": false,
	unidades: true,
	"listas-precios": false,
	almacenes: true,
	"puntos-venta": true,
	transferencias: true,
	mermas: true,
	"ventas-pos": true,
	"ventas-factura": false,
	"turnos-pos": false,
	"arqueo-caja": true,
	"cuadre-diario": false,
	ofertas: false,
	clientes: false,
	facturacion: false,
	"series-facturacion": false,
	proveedores: true,
	compras: true,
	servicios: true,
	gastos: true,
	contabilidad: true,
	"multi-moneda": false,
	"rentabilidad-compra": true,
	"reportes-financieros": false,
	"cuentas-cobrar": false,
	"cuentas-pagar": false,
	"prestamos-cash": false,
	"deudas-cash": false,
	anticipos: false,
	"analisis-estado-cuenta": false,
	"facturas-vencidas": false,
	produccion: false,
	reparaciones: false,
	empleados: true,
	vacaciones: false,
	asistencia: false,
	nomina: false,
	"mi-empresa": true,
	"mi-empresa-ean13": false,
	contratos: false,
	"gestion-usuarios": true,
	notificaciones: false,
	configuracion: true,
	dashboard: true,
	"backups-semanal": true,
	"backups-diario": false,
	"backups-tiempo-real": false,
	"api-integraciones": false,
};

const PLAN_PROFESIONAL_FEATURES = {
	...PLAN_BASICO_FEATURES,
	"listas-precios": true,
	"turnos-pos": true,
	"cuadre-diario": true,
	ofertas: true,
	clientes: true,
	facturacion: true,
	"series-facturacion": true,
	"multi-moneda": true,
	"reportes-financieros": true,
	empleados: true,
	notificaciones: true,
	"ventas-factura": true,
	"backups-semanal": false,
	"backups-diario": true,
};

const PLAN_EMPRESARIAL_FEATURES = {
	...PLAN_PROFESIONAL_FEATURES,
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
	"backups-diario": false,
	"backups-tiempo-real": true,
	reparaciones: false,
	"api-integraciones": false,
};

const pool = new Pool({
	connectionString: PUBLIC_URL,
	ssl: { rejectUnauthorized: false },
});

const now = new Date();
const planes = [
	{
		nombre: "Básico",
		descripcion:
			"Base sólida para arrancar tu negocio. Incluye productos, almacenes, POS, contabilidad en CUP y backups semanales.",
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
			"Máxima potencia con producción, nómina, generación EAN-13, cuentas por cobrar/pagar y backups cada hora.",
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
];

const cols = `"planId", nombre, descripcion, precio, "duracionDias", "maxUsuarios", "maxAlmacenes", "maxProductos", "maxClientes", "maxPuntosVenta", "maxFacturasMes", "maxContratos", "incluyeBackups", features, "createdAt", "updatedAt"`;
const vals = `$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16`;

try {
	for (const p of planes) {
		await pool.query(`INSERT INTO "Plan" (${cols}) VALUES (${vals})`, [
			uuidv4(),
			p.nombre,
			p.descripcion,
			p.precio,
			p.duracionDias,
			p.maxUsuarios,
			p.maxAlmacenes,
			p.maxProductos,
			p.maxClientes,
			p.maxPuntosVenta,
			p.maxFacturasMes,
			p.maxContratos,
			p.incluyeBackups,
			JSON.stringify(p.features),
			now,
			now,
		]);
		console.log("✅ Creado:", p.nombre, "- $" + p.precio + "/mes");
	}
	console.log("\n✅ Seed completado. 3 planes correctos.");
} catch (e) {
	console.error("Error:", e.message);
} finally {
	await pool.end();
}
