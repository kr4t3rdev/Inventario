import { ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';

export const PRODUCTO_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  precioCosto: true,
  precioVenta: true,
  stock: true,
  stockMinimo: true,
  codigoInterno: true,
  codigoNegocio: true,
  proveedorCodigo: true,
  idSeccionCodigo: true,
  especificoCodigo: true,
  surtidoCodigo: true,
  categoriaId: true,
  subcategoriaId: true,
  unidadId: true,
  vendorId: true,
  almacenId: true,
  puntoDeVentaId: true,
  fotos: true,
  esCompuesto: true,
  createdAt: true,
  updatedAt: true,
  tenantId: true,
  categoria: { select: { catId: true, nombre: true } },
  subcategoria: { select: { catId: true, nombre: true, parentId: true } },
  unidad: { select: { unidadId: true, nombre: true, simbolo: true } },
  vendor: { select: { vendorId: true, nombre: true } },
  precios: { select: { listaPrecioId: true, precio: true } },
} as const;

interface GetByIdArgs {
  productId: string;
  tenantId: string;
}

interface ProductListFilters {
  categoryId?: string | null;
  search?: string | null;
  subcategoryId?: string | null;
}

interface ListByLocationArgs extends ProductListFilters {
  includeZero?: boolean;
  tenantId: string;
  tipoUbicacion: 'almacen' | 'punto_venta';
  ubicacionId: string;
}

const PRODUCTO_CON_STOCK_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  codigoInterno: true,
  codigoNegocio: true,
  proveedorCodigo: true,
  idSeccionCodigo: true,
  especificoCodigo: true,
  surtidoCodigo: true,
  dcCodigo: true,
  fotos: true,
  precioCosto: true,
  precioVenta: true,
  stock: true,
  stockMinimo: true,
  categoriaId: true,
  subcategoriaId: true,
  unidadId: true,
  vendorId: true,
  almacenId: true,
  categoria: { select: { catId: true, nombre: true } },
  subcategoria: { select: { catId: true, nombre: true, parentId: true } },
  unidad: { select: { unidadId: true, nombre: true, simbolo: true } },
  vendor: { select: { vendorId: true, nombre: true } },
} as const;

function buildProductWhere(
  tenantId: string,
  filters?: ProductListFilters,
): Record<string, unknown> {
  const where: Record<string, unknown> = { tenantId };
  const search = filters?.search?.trim();

  if (filters?.categoryId) {
    where.categoriaId = filters.categoryId;
  }

  if (filters?.subcategoryId) {
    where.subcategoriaId = filters.subcategoryId;
  }

  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' } },
      { descripcion: { contains: search, mode: 'insensitive' } },
      { codigoInterno: { contains: search, mode: 'insensitive' } },
      { codigoNegocio: { contains: search, mode: 'insensitive' } },
      { categoria: { nombre: { contains: search, mode: 'insensitive' } } },
      { subcategoria: { nombre: { contains: search, mode: 'insensitive' } } },
      { vendor: { nombre: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

/**
 * @description Shared product read service for web and mobile adapters.
 */
export const ProductoService = {
  /**
   * @description Lists tenant-scoped products for web/mobile reads.
   * @param {string} tenantId - Authenticated tenant identifier.
   * @returns {Promise<unknown[]>} Product list.
   */
  async list(tenantId: string, filters?: ProductListFilters) {
    return prisma.producto.findMany({
      where: buildProductWhere(tenantId, filters),
      select: PRODUCTO_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * @description Returns one tenant-scoped product by id.
   * @param {GetByIdArgs} args - Product and tenant identifiers.
   * @returns {Promise<unknown>} Product detail.
   */
  async getById({ productId, tenantId }: GetByIdArgs) {
    const producto = await prisma.producto.findFirst({
      where: { id: productId, tenantId },
      select: PRODUCTO_SELECT,
    });

    if (!producto) {
      throw new ActionError('Producto no encontrado', 'NOT_FOUND');
    }

    return producto;
  },

  /**
   * @description Lists tenant products for a specific location with optional stock/search/category filters.
   * @param {ListByLocationArgs} args - Location and filter arguments.
   * @returns {Promise<Array<Record<string, unknown>>>} Products with `stockUbicacion` and `stockTotal`.
   */
  async listByLocation({
    tenantId,
    ubicacionId,
    tipoUbicacion,
    includeZero = true,
    search,
    categoryId,
    subcategoryId,
  }: ListByLocationArgs) {
    const productWhere = buildProductWhere(tenantId, {
      search,
      categoryId,
      subcategoryId,
    });

    if (!includeZero) {
      const registros = await prisma.stockUbicacion.findMany({
        where: {
          ubicacionId,
          tipoUbicacion,
          tenantId,
          cantidad: { gt: 0 },
          producto: productWhere,
        },
        include: {
          producto: { select: PRODUCTO_CON_STOCK_SELECT },
        },
      });

      return registros.map((registro) => ({
        ...registro.producto,
        stockUbicacion: registro.cantidad,
        stockTotal: registro.producto.stock,
      }));
    }

    const whereProductos: Record<string, unknown> = { ...productWhere };
    if (tipoUbicacion === 'almacen') {
      whereProductos.almacenId = ubicacionId;
    }

    const [productosBase, registrosStock] = await Promise.all([
      prisma.producto.findMany({
        where: whereProductos,
        select: PRODUCTO_CON_STOCK_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockUbicacion.findMany({
        where: { ubicacionId, tipoUbicacion, tenantId },
        select: { productoId: true, cantidad: true },
      }),
    ]);

    const stockMap = new Map(
      registrosStock.map((registro) => [registro.productoId, registro.cantidad]),
    );

    return productosBase.map((producto) => ({
      ...producto,
      stockUbicacion: stockMap.get(producto.id) ?? 0,
      stockTotal: producto.stock,
    }));
  },
};
