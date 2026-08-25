// Re-export all models, resolving the Vendor conflict between productos and economicos
export * from "./economicos";
export * from "./punto-venta";
export * from "./ventas";
export * from "./restock";
export * from "./clientes";
export * from "./contabilidad";
export * from "./ofertas";
export * from "./prestamos-cash";
export * from "./facturacion";
export * from "./reparaciones";
export * from "./audit";
export * from "./produccion";
// For productos, we need to avoid re-exporting Vendor (conflicts with economicos.Vendor)
export {
	type Producto,
	type Unidad,
	type Categoria,
	type CategoriaHierarchy,
	type CreateCategoriaRequest,
	type MoveCategoriaRequest,
	type Proveedor,
	type CompraProducto,
	type CompraDocumentoItem,
	type CompraDocumento,
	type CompraDocumentoResponse,
	type CompraProductoResponse,
	type StockUbicacion,
} from "./productos";
