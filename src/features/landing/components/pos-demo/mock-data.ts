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
  { catId: 'cat-limpieza', nombre: 'Limpieza' },
  { catId: 'cat-panaderia', nombre: 'Panadería' },
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
    id: 'prod-002',
    nombre: 'Agua Mineral sin gas 500ml',
    descripcion: 'Agua mineral natural, botella de 500 ml.',
    precioVenta: 1.2,
    codigoBarras: '7790000223456',
    categoriaId: 'cat-bebidas',
    stockEnUbicacion: 120,
    fotos: [],
    unidad: { simbolo: 'u' },
    categoria: { nombre: 'Bebidas' },
  },
  {
    id: 'prod-003',
    nombre: 'Jugo de Naranja 1L',
    descripcion: 'Jugo de naranja pasteurizado, sin azúcar añadida.',
    precioVenta: 3.1,
    codigoBarras: '7790000334567',
    categoriaId: 'cat-bebidas',
    stockEnUbicacion: 4,
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
    id: 'prod-005',
    nombre: 'Barra de Cereal con Avena',
    descripcion: 'Barra energética con avena y miel, pack individual.',
    precioVenta: 0.9,
    codigoBarras: '7790000556789',
    categoriaId: 'cat-snacks',
    stockEnUbicacion: 75,
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
  {
    id: 'prod-007',
    nombre: 'Queso Semiduro 250g',
    descripcion: 'Queso semiduro de pasta firme, barra de 250 g.',
    precioVenta: 4.25,
    codigoBarras: '7790000778901',
    categoriaId: 'cat-lacteos',
    stockEnUbicacion: 0,
    fotos: [],
    unidad: { simbolo: 'u' },
    categoria: { nombre: 'Lácteos' },
  },
  {
    id: 'prod-008',
    nombre: 'Yogur Bebible Frutilla 200ml',
    descripcion: 'Yogur bebible sabor frutilla, vitamina D.',
    precioVenta: 1.6,
    codigoBarras: '7790000889012',
    categoriaId: 'cat-lacteos',
    stockEnUbicacion: 60,
    fotos: [],
    unidad: { simbolo: 'u' },
    categoria: { nombre: 'Lácteos' },
  },
  {
    id: 'prod-009',
    nombre: 'Lavandina 1L',
    descripcion: 'Lavandina concentrada, botella de 1 litro.',
    precioVenta: 2.1,
    codigoBarras: '7790000999023',
    categoriaId: 'cat-limpieza',
    stockEnUbicacion: 18,
    fotos: [],
    unidad: { simbolo: 'u' },
    categoria: { nombre: 'Limpieza' },
  },
  {
    id: 'prod-010',
    nombre: 'Detergente Líquido 750ml',
    descripcion: 'Detergente concentrado para vajilla, aroma limón.',
    precioVenta: 2.8,
    codigoBarras: '7790001009034',
    categoriaId: 'cat-limpieza',
    stockEnUbicacion: 7,
    fotos: [],
    unidad: { simbolo: 'u' },
    categoria: { nombre: 'Limpieza' },
  },
  {
    id: 'prod-011',
    nombre: 'Pan Francés x kg',
    descripcion: 'Pan francés fresco del día, venta por kilogramo.',
    precioVenta: 3.5,
    codigoBarras: '7790001110145',
    categoriaId: 'cat-panaderia',
    stockEnUbicacion: 30,
    fotos: [],
    unidad: { simbolo: 'kg' },
    categoria: { nombre: 'Panadería' },
  },
  {
    id: 'prod-012',
    nombre: 'Facturas surtidas (docena)',
    descripcion: 'Docena de facturas variadas, horneadas en el día.',
    precioVenta: 5.4,
    codigoBarras: '7790001221256',
    categoriaId: 'cat-panaderia',
    stockEnUbicacion: 12,
    fotos: [],
    unidad: { simbolo: 'doc' },
    categoria: { nombre: 'Panadería' },
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

