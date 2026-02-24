// Categoria
export const categorias = [
  { catId: "cat1", nombre: "Electrónica", createdAt: new Date(), updatedAt: new Date() },
  { catId: "cat2", nombre: "Oficina", createdAt: new Date(), updatedAt: new Date() },
]

// Unidad
export const unidades = [
  { unidadId: "unid1", nombre: "Unidad", simbolo: "u", createdAt: new Date(), updatedAt: new Date() },
]

// Vendor
export const vendors = [
  { vendorId: "vend1", nombre: "HP", contacto: "hp@correo.com", createdAt: new Date(), updatedAt: new Date() },
]

// Almacen
export const almacenes = [
  { almacenId: "alm1", nombre: "Central", createdAt: new Date(), updatedAt: new Date() },
]

// PuntoDeVenta
export const puntosDeVenta = [
  { pvId: "pv1", nombre: "Tienda Centro", ubicacion: "Centro", createdAt: new Date(), updatedAt: new Date() },
]

// Producto
export const productos = [
  {
    id: "prod1",
    nombre: "Laptop HP",
    descripcion: "Laptop HP Pavilion",
    precioCosto: 800,
    precioVenta: 1200,
    stock: 10,
    categoriaId: "cat1",
    unidadId: "unid1",
    vendorId: "vend1",
    almacenId: "alm1",
    puntoDeVentaId: "pv1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Venta
export const ventas = [
  {
    ventaId: "v1",
    productoId: "prod1",
    cantidad: 2,
    total: 2400,
    puntoDeVentaId: "pv1",
    empleadoId: "emp1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Merma
export const mermas = [
  {
    mermaId: "m1",
    productoId: "prod1",
    cantidad: 1,
    motivo: "Defecto",
    costoTotal: 800,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Transferencia
export const transferencias = [
  {
    transferenciaId: "t1",
    productoId: "prod1",
    cantidad: 1,
    origenId: "alm1",
    destinoId: "alm1",
    puntoDeVentaOrigenId: "pv1",
    puntoDeVentaDestinoId: "pv1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// User
export const users = [
  {
    userId: "u1",
    name: "Admin",
    email: "admin@correo.com",
    password: "123456",
    role: "admin",
    isActive: true,
    avatar: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Notification
export const notifications = [
  {
    id: "n1",
    title: "Bienvenido",
    message: "Tu cuenta ha sido creada",
    type: "success",
    isRead: false,
    userId: "u1",
    prioridad: "alta",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Empleado
export const empleados = [
  {
    empleadoId: "emp1",
    nombre: "Juan",
    apellido: "Pérez",
    telefono: "555-1234",
    cargo: "Vendedor",
    salarioBases: 1000,
    periodo: "2025-07",
    bonificaciones: 100,
    deducciones: 50,
    horasExtras: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// GastoCompra
export const gastosCompra = [
  {
    gastoCompraId: "gc1",
    productoId: "prod1",
    vendorId: "vend1",
    cantidad: 2,
    precioUnitario: 800,
    total: 1600,
    fechaCompra: new Date(),
    descripcion: "Compra inicial",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// GastosServicios
export const gastosServicios = [
  {
    gastoSId: "gs1",
    tipo: "electricidad",
    proveedor: "Empresa Eléctrica",
    monto: 500,
    periodo: "2025-07",
    descripcion: "Pago mensual",
    isPagado: "sí",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// ReporteFinanciero
export const reportesFinancieros = [
  {
    reporteId: "rf1",
    periodo: "2025-07",
    tipoReporte: "mensual",
    ingresosVentas: 2400,
    cantidadVentas: 2,
    gastosCompras: 1600,
    gastosSalarios: 1000,
    gastosServicios: 500,
    gastosMermas: 800,
    gastosOtros: 100,
    totalIngresos: 2400,
    totalGastos: 3000,
    utilidadBruta: 800,
    utilidadNeta: 700,
    margenUtilidad: 29,
    fechaGeneracion: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]