/**
 * @description Datos mockeados para la demo pública del POS en el landing.
 *              Estructura compatible con los componentes reales ProductoCard y CartItem
 *              para que el acabado visual sea idéntico al POS en producción.
 * @module pos-demo/mock-data
 */

export interface DemoPuntoVenta {
  pvId: string;
  nombre: string;
}

export const DEMO_PUNTO_VENTA: DemoPuntoVenta = {
  pvId: 'demo-pv-001',
  nombre: 'Sucursal Demo — Microcentro',
};

export const DEMO_CATEGORIAS = [
  { catId: 'cat-bebidas', nombre: 'Bebidas' },
  { catId: 'cat-snacks', nombre: 'Snacks' },
  { catId: 'cat-lacteos', nombre: 'Lácteos' },
] as const;

/**
 * Tipo de producto demo. No reutiliza ProductoConStock para acoplar lo mínimo
 * al backend (la demo no toca la BD). Es estructuralmente compatible con la
 * prop `producto` de ProductoCard y CartItem, que es lo único que importa
 * para garantizar el acabado visual idéntico.
 */
export interface DemoProducto {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioVenta: number;
  codigoBarras?: string;
  categoriaId: string;
  stockEnUbicacion: number;
  fotos: string[];
  unidad?: { simbolo: string };
  categoria?: { nombre: string };
  subcategoria?: { nombre: string };
}

export const DEMO_PRODUCTOS: DemoProducto[] = [
	{
		id: 'prod-001',
		nombre: 'Gaseosa Cola 1.5L',
		descripcion: 'Refresco carbonatado sabor col, botella PET retornable.',
		precioVenta: 2.5,
		codigoBarras: '7790000112345',
		categoriaId: 'cat-bebidas',
		stockEnUbicacion: 48,
		fotos: [],
		unidad: { simbolo: 'u' },
		categoria: { nombre: 'Bebidas' },
	},
	{
		id: 'prod-004',
		nombre: 'Papas Clásicas 45g',
		descripcion: 'Papas fritas de paquete, sabor clásico.',
		precioVenta: 1.8,
		codigoBarras: '7790000445678',
		categoriaId: 'cat-snacks',
		stockEnUbicacion: 32,
		fotos: [],
		unidad: { simbolo: 'u' },
		categoria: { nombre: 'Snacks' },
	},
	{
		id: 'prod-006',
		nombre: 'Leche Entera 1L',
		descripcion: 'Leche entera pasteurizada, saché tetra-pack.',
		precioVenta: 1.4,
		codigoBarras: '7790000667890',
		categoriaId: 'cat-lacteos',
		stockEnUbicacion: 24,
		fotos: [],
		unidad: { simbolo: 'u' },
		categoria: { nombre: 'Lácteos' },
	},
];

/* ─── Empleados demo (para apertura de turno) ─── */

export interface DemoEmpleado {
  empleadoId: string;
  nombre: string;
  apellido: string;
}

export const DEMO_EMPLEADOS: DemoEmpleado[] = [
  { empleadoId: 'emp-001', nombre: 'María', apellido: 'González' },
  { empleadoId: 'emp-002', nombre: 'Carlos', apellido: 'Rodríguez' },
  { empleadoId: 'emp-003', nombre: 'Lucía', apellido: 'Pérez' },
  { empleadoId: 'emp-004', nombre: 'Jorge', apellido: 'Martínez' },
];

/* ─── Turno activo demo ─── */

export interface DemoTurnoActivo {
  id: string;
  puntoDeVentaId: string;
  puntoDeVentaNombre: string;
  empleado: { nombre: string; apellido: string } | null;
  fondoInicialCup: number; // en centavos
  fondoInicialUsd: number; // en centavos
  fechaApertura: Date;
  estado: 'ABIERTO' | 'CERRADO';
  observacionesApertura: string | null;
}

/**
 * Crea un turno demo nuevo. Las ventas se trackean aparte en el state del
 * componente (no acoplamos este tipo a `ventas` para mantener el mock liviano).
 */
export function createDemoTurno(input: {
  empleadoId: string | null;
  fondoInicialCup: number; // en centavos
  fondoInicialUsd: number; // en centavos
  observaciones: string | null;
}): DemoTurnoActivo {
  const empleado = input.empleadoId
    ? (DEMO_EMPLEADOS.find((e) => e.empleadoId === input.empleadoId) ?? null)
    : null;

  return {
    id: `turno-${Date.now()}`,
    puntoDeVentaId: DEMO_PUNTO_VENTA.pvId,
    puntoDeVentaNombre: DEMO_PUNTO_VENTA.nombre,
    empleado: empleado ? { nombre: empleado.nombre, apellido: empleado.apellido } : null,
    fondoInicialCup: input.fondoInicialCup,
    fondoInicialUsd: input.fondoInicialUsd,
    fechaApertura: new Date(),
    estado: 'ABIERTO',
    observacionesApertura: input.observaciones,
  };
}
