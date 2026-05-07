import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import {
  FindNextAvailableSurtido,
  ValidateAssembledCode,
} from '@/lib/ean13-utils';
import {
  assertServerOwnedCodeFields,
  normalizeProveedorCodigo,
  resolveTaxonomySegments,
  generateProductCodeWithRetry,
} from '@/lib/product-business-code';
import {
  RestockValidator,
  RestockApiErrorHandler,
} from '@/lib/restock-validation';
import {
  RestockErrorFactory,
  type RestockSuccessResponse,
} from '@/lib/restock-errors';
import { executeProductInstanceCreationWorkflow } from '@/lib/restock-utils';
import { authenticateUser, type AuthenticatedUser } from '@/lib/auth-middleware';

const CODIGO_INTERNO_REGEX = /^[0-9]{11}$/;

interface TaxonomyContext {
  categoriaId: string;
  subcategoriaId: string;
  idSeccionCodigo: string;
  especificoCodigo: string;
}

interface VendorProviderContext {
  vendorId: string | null;
  proveedorCodigo: string;
}

interface BulkStockMinimoUpdate {
  updates: {
    productoId: string;
    stockMinimo: number;
  }[];
}

interface BulkUpdateResponse {
  success: boolean;
  updated: number;
  errors: {
    productoId: string;
    error: string;
  }[];
  results: {
    productoId: string;
    success: boolean;
    previousStockMinimo?: number;
    newStockMinimo?: number;
  }[];
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function normalizeCodigoInterno(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

function normalizeCodigoInternoUpdate(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

function deriveProveedorCodigoFromVendorProducts(
  productos: Array<{ proveedorCodigo?: string | null }>
): string | null {
  const codigos = Array.from(
    new Set(
      productos
        .map((producto) => producto.proveedorCodigo?.trim())
        .filter((codigo): codigo is string => Boolean(codigo))
    )
  );

  if (codigos.length !== 1) {
    return null;
  }

  return codigos[0];
}

async function resolveVendorProviderContext(
  vendorId: string | null | undefined,
  proveedorCodigoInput: unknown
): Promise<VendorProviderContext | NextResponse> {
  if (vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { vendorId },
      include: {
        productos: {
          select: { proveedorCodigo: true },
          where: { proveedorCodigo: { not: null } },
        },
      },
    });

    if (!vendor) {
      return jsonError('El proveedor seleccionado no existe', 400);
    }

    const proveedorCodigoDerivado = deriveProveedorCodigoFromVendorProducts(
      vendor.productos
    );

    if (proveedorCodigoDerivado) {
      return {
        vendorId: vendor.vendorId,
        proveedorCodigo: proveedorCodigoDerivado,
      };
    }

    if (
      proveedorCodigoInput !== undefined &&
      proveedorCodigoInput !== null &&
      proveedorCodigoInput !== ''
    ) {
      try {
        return {
          vendorId: vendor.vendorId,
          proveedorCodigo: normalizeProveedorCodigo(proveedorCodigoInput),
        };
      } catch (error) {
        return jsonError(
          error instanceof Error ? error.message : 'Proveedor inválido',
          400
        );
      }
    }

    return jsonError(
      'El proveedor seleccionado no tiene un código configurado para generar el EAN-13',
      400
    );
  }

  try {
    return {
      vendorId: null,
      proveedorCodigo: normalizeProveedorCodigo(proveedorCodigoInput),
    };
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Proveedor inválido',
      400
    );
  }
}

async function resolveTaxonomyContext(
  categoriaId: string | null | undefined,
  subcategoriaId: string | null | undefined
): Promise<TaxonomyContext | NextResponse> {
  if (!categoriaId) {
    return jsonError('La categoría es requerida para generar el código de negocio', 400);
  }

  if (!subcategoriaId) {
    return jsonError('La subcategoría es requerida para generar el código de negocio', 400);
  }

  const [categoria, subcategoria] = await Promise.all([
    prisma.categoria.findUnique({
      where: { catId: categoriaId },
      select: { catId: true, nombre: true },
    }),
    prisma.categoria.findUnique({
      where: { catId: subcategoriaId },
      select: { catId: true, nombre: true, parentId: true },
    }),
  ]);

  if (!categoria) {
    return jsonError('La categoría seleccionada no existe', 400);
  }

  if (!subcategoria) {
    return jsonError('La subcategoría seleccionada no existe', 400);
  }

  if (subcategoria.parentId !== categoriaId) {
    return jsonError('La subcategoría debe pertenecer a la categoría seleccionada', 400);
  }

  try {
    const resolvedSegments = resolveTaxonomySegments(
      categoria.nombre,
      subcategoria.nombre
    );

    return {
      categoriaId: categoria.catId,
      subcategoriaId: subcategoria.catId,
      idSeccionCodigo: resolvedSegments.idSeccionCodigo,
      especificoCodigo: resolvedSegments.especificoCodigo,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo resolver la taxonomía del código de negocio';

    return jsonError(message, 400);
  }
}

async function ensureBusinessCodeIsUnique(
  prismaClient: {
    producto: {
      findFirst: typeof prisma.producto.findFirst;
    };
  },
  codigoNegocio: string
): Promise<void> {
  const existingProducto = await prismaClient.producto.findFirst({
    where: { codigoNegocio },
    select: { id: true },
  });

  if (existingProducto) {
    throw new Error(
      'El código de negocio EAN-13 ya está asignado a otro producto'
    );
  }
}

const validateStockMinimo = (
  stockMinimo: number
): { valid: boolean; error?: string } => {
  if (typeof stockMinimo !== 'number') {
    return { valid: false, error: 'El stock mínimo debe ser un número' };
  }
  if (stockMinimo < 0) {
    return { valid: false, error: 'El stock mínimo no puede ser negativo' };
  }
  if (!Number.isInteger(stockMinimo)) {
    return { valid: false, error: 'El stock mínimo debe ser un número entero' };
  }
  return { valid: true };
};

const validateBulkUpdateRequest = (
  body: any
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    errors.push('El cuerpo de la petición debe ser un objeto');
    return { valid: false, errors };
  }

  if (!Array.isArray(body.updates)) {
    errors.push("El campo 'updates' debe ser un array");
    return { valid: false, errors };
  }

  if (body.updates.length === 0) {
    errors.push("El array 'updates' no puede estar vacío");
    return { valid: false, errors };
  }

  if (body.updates.length > 100) {
    errors.push('No se pueden actualizar más de 100 productos a la vez');
    return { valid: false, errors };
  }

  body.updates.forEach((update: any, index: number) => {
    if (!update || typeof update !== 'object') {
      errors.push(`Actualización ${index + 1}: debe ser un objeto`);
      return;
    }

    if (!update.productoId || typeof update.productoId !== 'string') {
      errors.push(
        `Actualización ${index + 1}: productoId es requerido y debe ser una cadena`
      );
    }

    if (update.stockMinimo === undefined || update.stockMinimo === null) {
      errors.push(`Actualización ${index + 1}: stockMinimo es requerido`);
    } else {
      const validation = validateStockMinimo(update.stockMinimo);
      if (!validation.valid) {
        errors.push(`Actualización ${index + 1}: ${validation.error}`);
      }
    }
  });

  const productIds = body.updates.map((update: any) => update.productoId);
  const duplicates = productIds.filter(
    (id: string, index: number) => productIds.indexOf(id) !== index
  );
  if (duplicates.length > 0) {
    errors.push(`IDs de productos duplicados: ${duplicates.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export async function getProductosHandler(
  request: NextRequest,
  _context: unknown,
  user: AuthenticatedUser
): Promise<NextResponse> {
  try {
    const tenantId = requireTenant(user);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');

    const whereClause: Record<string, unknown> = { tenantId };
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { codigoInterno: { contains: search } },
          { nombre: { contains: search } },
          { descripcion: { contains: search } },
          { codigoNegocio: { contains: search } },
          { categoria: { nombre: { contains: search } } },
          { subcategoria: { nombre: { contains: search } } },
          { vendor: { nombre: { contains: search } } },
        ],
      });
    }

    if (categoryId) {
      if (subcategoryId) {
        andConditions.push({ subcategoriaId: subcategoryId });
      } else {
        andConditions.push({
          OR: [
            { categoriaId: categoryId },
            { subcategoria: { parentId: categoryId } },
          ],
        });
      }
    } else if (subcategoryId) {
      andConditions.push({ subcategoriaId: subcategoryId });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const [productosRaw, totalCount] = await Promise.all([
      prisma.producto.findMany({
        where: whereClause,
        include: {
          categoria: { select: { catId: true, nombre: true } },
          subcategoria: {
            select: { catId: true, nombre: true, parentId: true },
          },
          unidad: { select: { simbolo: true } },
          vendor: { select: { nombre: true } },
          almacen: { select: { nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.producto.count({ where: whereClause }),
    ]);

    const productos = await Promise.all(
      productosRaw.map(
        async (producto: { id: string; stock: number }) => {
          const [tEntrada, tSalida, ventasItems, ventasLegacy] =
            await Promise.all([
              prisma.transferencia.aggregate({
                where: {
                  productoId: producto.id,
                  puntoDeVentaDestinoId: { not: null },
                },
                _sum: { cantidad: true },
              }),
              prisma.transferencia.aggregate({
                where: {
                  productoId: producto.id,
                  puntoDeVentaOrigenId: { not: null },
                },
                _sum: { cantidad: true },
              }),
              prisma.ventaItem.aggregate({
                where: { productoId: producto.id },
                _sum: { cantidad: true },
              }),
              prisma.venta.aggregate({
                where: {
                  productoId: producto.id,
                  items: { none: {} },
                },
                _sum: { cantidad: true },
              }),
            ]);

          const ventasTotal =
            (ventasItems._sum.cantidad || 0) +
            (ventasLegacy._sum.cantidad || 0);
          const stockEnPVs =
            (tEntrada._sum.cantidad || 0) -
            (tSalida._sum.cantidad || 0) -
            ventasTotal;

          return {
            ...producto,
            stock: producto.stock + Math.max(0, stockEnPVs),
          };
        }
      )
    );

    return NextResponse.json({ productos, totalCount });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return jsonError('Failed to fetch products', 500);
  }
}

export async function createProductoHandler(
  req: NextRequest,
  _context: unknown,
  _user: AuthenticatedUser
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const {
      nombre,
      descripcion,
      codigoInterno,
      proveedorCodigo,
      idSeccionCodigo,
      especificoCodigo,
      surtidoCodigo,
      precioCosto,
      precioVenta,
      stock,
      stockMinimo,
      fotos,
      categoriaId,
      subcategoriaId,
      unidadId,
      vendorId,
      almacenId,
      precios,
    } = body;

    try {
      assertServerOwnedCodeFields({
        idSeccionCodigo,
        especificoCodigo,
        surtidoCodigo,
      });
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : 'Payload inválido',
        400
      );
    }

    const miEmpresa = await prisma.miEmpresa.findFirst({
      select: { usaCodigoEan13: true },
    });
    const usaCodigoEan13 = miEmpresa?.usaCodigoEan13 ?? false;
    const normalizedCodigoInterno = normalizeCodigoInterno(codigoInterno);

    if (
      normalizedCodigoInterno &&
      !CODIGO_INTERNO_REGEX.test(normalizedCodigoInterno)
    ) {
      return jsonError(
        'El código interno debe contener exactamente 11 números',
        400
      );
    }

    if (normalizedCodigoInterno) {
      const existingProducto = await prisma.producto.findFirst({
        where: { codigoInterno: normalizedCodigoInterno },
        select: { id: true },
      });

      if (existingProducto) {
        return jsonError(
          'El código interno ya está asignado a otro producto',
          409
        );
      }
    }

    if (!usaCodigoEan13) {
      if (!categoriaId) {
        return jsonError('La categoría es requerida', 400);
      }

      if (
        stockMinimo !== undefined &&
        (typeof stockMinimo !== 'number' ||
          stockMinimo < 0 ||
          !Number.isInteger(stockMinimo))
      ) {
        return jsonError(
          'El stock mínimo debe ser un número entero mayor o igual a 0',
          400
        );
      }

      const productoSimple = await prisma.producto.create({
        data: {
          nombre,
          descripcion,
          codigoInterno: normalizedCodigoInterno,
          codigoNegocio: null,
          proveedorCodigo: null,
          idSeccionCodigo: null,
          especificoCodigo: null,
          surtidoCodigo: null,
          dcCodigo: null,
          precioCosto,
          precioVenta,
          stock,
          stockMinimo: stockMinimo ?? 0,
          fotos: fotos || [],
          categoriaId,
          subcategoriaId: subcategoriaId || null,
          unidadId,
          vendorId: vendorId || null,
          almacenId,
          precios: Array.isArray(precios)
            ? {
                create: precios.map(
                  (precio: { listaPrecioId: string; precio: number }) => ({
                    listaPrecioId: precio.listaPrecioId,
                    precio: precio.precio,
                  })
                ),
              }
            : undefined,
        },
      });

      if (stock > 0) {
        await upsertStockUbicacion(prisma as any, {
          productoId: productoSimple.id,
          tipoUbicacion: 'almacen',
          ubicacionId: almacenId,
          modo: 'set',
          valor: stock,
        });
      }

      return NextResponse.json({ producto: productoSimple }, { status: 201 });
    }

    const vendorProviderContext = await resolveVendorProviderContext(
      vendorId ?? null,
      proveedorCodigo
    );
    if (vendorProviderContext instanceof NextResponse) {
      return vendorProviderContext;
    }

    const taxonomyContext = await resolveTaxonomyContext(
      categoriaId,
      subcategoriaId
    );
    if (taxonomyContext instanceof NextResponse) {
      return taxonomyContext;
    }

    if (
      stockMinimo !== undefined &&
      (typeof stockMinimo !== 'number' ||
        stockMinimo < 0 ||
        !Number.isInteger(stockMinimo))
    ) {
      return jsonError(
        'El stock mínimo debe ser un número entero mayor o igual a 0',
        400
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const generatedParentSurtido = await FindNextAvailableSurtido(
        tx as any,
        taxonomyContext.idSeccionCodigo,
        taxonomyContext.especificoCodigo
      );

      const generatedParentCode = await generateProductCodeWithRetry(
        tx,
        {
          proveedorCodigo: vendorProviderContext.proveedorCodigo,
          idSeccionCodigo: taxonomyContext.idSeccionCodigo,
          especificoCodigo: taxonomyContext.especificoCodigo,
          surtidoCodigo: generatedParentSurtido,
        },
        3
      );

      if (!ValidateAssembledCode(generatedParentCode.codigoNegocio)) {
        throw new Error(
          'El código EAN-13 generado para el producto padre no pasó validación'
        );
      }

      const producto = await tx.producto.create({
        data: {
          nombre,
          descripcion,
          codigoInterno: normalizedCodigoInterno,
          codigoNegocio: generatedParentCode.codigoNegocio,
          proveedorCodigo: generatedParentCode.proveedorCodigo,
          idSeccionCodigo: generatedParentCode.idSeccionCodigo,
          especificoCodigo: generatedParentCode.especificoCodigo,
          surtidoCodigo: generatedParentCode.surtidoCodigo,
          dcCodigo: generatedParentCode.dcCodigo,
          precioCosto,
          precioVenta,
          stock,
          stockMinimo: stockMinimo ?? 0,
          fotos: fotos || [],
          categoriaId: taxonomyContext.categoriaId,
          subcategoriaId: taxonomyContext.subcategoriaId,
          unidadId,
          vendorId: vendorProviderContext.vendorId,
          almacenId,
          precios: Array.isArray(precios)
            ? {
                create: precios.map(
                  (precio: { listaPrecioId: string; precio: number }) => ({
                    listaPrecioId: precio.listaPrecioId,
                    precio: precio.precio,
                  })
                ),
              }
            : undefined,
        },
      });

      if (stock > 0) {
        await upsertStockUbicacion(tx, {
          productoId: producto.id,
          tipoUbicacion: 'almacen',
          ubicacionId: almacenId,
          modo: 'set',
          valor: stock,
        });
      }

      return { producto };
    });

    if (stock > 0 && vendorProviderContext.vendorId) {
      const now = new Date();
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      await prisma.gastoCompra.create({
        data: {
          productoId: resultado.producto.id,
          vendorId: vendorProviderContext.vendorId,
          cantidad: stock,
          precioUnitario: precioCosto,
          total: stock * precioCosto,
          fechaCompra: now,
          descripcion: `Compra inicial - ${nombre}`,
          periodo,
        },
      });
    }

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    console.error('Error al crear producto:', error);

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return jsonError(
        'El código generado ya existe. Reintentá la operación.',
        409
      );
    }

    if (error instanceof Error && /código de negocio/i.test(error.message)) {
      return jsonError(error.message, 409);
    }

    return jsonError('Failed to create product', 500);
  }
}

export async function getProductoByIdHandler(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  user: AuthenticatedUser
): Promise<NextResponse> {
  try {
    const tenantId = requireTenant(user);
    const { id } = await context.params;
    const producto = await prisma.producto.findUnique({
      where: { id: id, tenantId },
      include: {
        categoria: true,
        subcategoria: true,
        unidad: true,
        vendor: true,
        almacen: true,
        precios: true,
      },
    });

    if (!producto) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return NextResponse.json(
      { error: 'Error al obtener producto' },
      { status: 500 }
    );
  }
}

export async function updateProductoHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  _user: any
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const {
      nombre,
      descripcion,
      codigoInterno,
      proveedorCodigo,
      idSeccionCodigo,
      especificoCodigo,
      surtidoCodigo,
      precioCosto,
      precioVenta,
      stock,
      stockMinimo,
      fotos,
      categoriaId,
      subcategoriaId,
      unidadId,
      vendorId,
      almacenId,
      precios,
    } = body;

    const currentProducto = await prisma.producto.findUnique({
      where: { id },
      select: {
        id: true,
        precioCosto: true,
        precioVenta: true,
        categoriaId: true,
        subcategoriaId: true,
        vendorId: true,
        proveedorCodigo: true,
      },
    });

    if (!currentProducto) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    if (
      stockMinimo !== undefined &&
      (typeof stockMinimo !== 'number' ||
        stockMinimo < 0 ||
        !Number.isInteger(stockMinimo))
    ) {
      return NextResponse.json(
        {
          error:
            'El stock mínimo debe ser un número entero mayor o igual a 0',
        },
        { status: 400 }
      );
    }

    if (
      codigoInterno !== undefined &&
      codigoInterno !== null &&
      typeof codigoInterno !== 'string'
    ) {
      return NextResponse.json(
        { error: 'El código interno debe enviarse como texto' },
        { status: 400 }
      );
    }

    const normalizedCodigoInterno =
      normalizeCodigoInternoUpdate(codigoInterno);
    const miEmpresa = await prisma.miEmpresa.findFirst({
      select: { usaCodigoEan13: true },
    });
    const usaEan13 = miEmpresa?.usaCodigoEan13 ?? false;

    const effectiveCategoriaId =
      categoriaId ?? currentProducto.categoriaId;
    const effectiveSubcategoriaId =
      subcategoriaId === undefined
        ? currentProducto.subcategoriaId
        : subcategoriaId;
    const effectiveVendorId =
      vendorId === undefined ? currentProducto.vendorId : vendorId;
    const effectiveProveedorCodigoRaw =
      proveedorCodigo === undefined
        ? currentProducto.proveedorCodigo
        : proveedorCodigo;

    let normalizedProveedorCodigo: string | undefined;

    if (usaEan13) {
      try {
        assertServerOwnedCodeFields({
          idSeccionCodigo,
          especificoCodigo,
          surtidoCodigo,
        });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : 'Error validando segmentos EAN-13',
          },
          { status: 400 }
        );
      }

      if (!effectiveCategoriaId) {
        return NextResponse.json(
          {
            error:
              'La categoría es requerida para productos con EAN-13',
          },
          { status: 400 }
        );
      }

      if (!effectiveSubcategoriaId) {
        return NextResponse.json(
          {
            error:
              'La subcategoría es requerida para productos con EAN-13',
          },
          { status: 400 }
        );
      }

      if (
        effectiveProveedorCodigoRaw === undefined ||
        effectiveProveedorCodigoRaw === null ||
        String(effectiveProveedorCodigoRaw).trim() === ''
      ) {
        return NextResponse.json(
          {
            error:
              'Seleccione un proveedor para generar el EAN-13',
          },
          { status: 400 }
        );
      }

      try {
        normalizedProveedorCodigo = normalizeProveedorCodigo(
          effectiveProveedorCodigoRaw
        );
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : 'Proveedor inválido',
          },
          { status: 400 }
        );
      }

      if (effectiveVendorId) {
        const existingVendor = await prisma.vendor.findUnique({
          where: { vendorId: effectiveVendorId },
          select: { vendorId: true },
        });

        if (!existingVendor) {
          return NextResponse.json(
            { error: 'El proveedor seleccionado no existe' },
            { status: 400 }
          );
        }
      }

      const isCategoriaChanging =
        categoriaId !== undefined &&
        categoriaId !== currentProducto.categoriaId;
      const isSubcategoriaChanging =
        subcategoriaId !== undefined &&
        subcategoriaId !== currentProducto.subcategoriaId;

      if (isCategoriaChanging || isSubcategoriaChanging) {
        return NextResponse.json(
          {
            error:
              'La categoría y la subcategoría no se pueden cambiar en productos con EAN-13 ya generado',
          },
          { status: 400 }
        );
      }
    }

    if (
      normalizedCodigoInterno &&
      !CODIGO_INTERNO_REGEX.test(normalizedCodigoInterno)
    ) {
      return NextResponse.json(
        {
          error:
            'El código interno debe contener exactamente 11 números',
        },
        { status: 400 }
      );
    }

    if (normalizedCodigoInterno) {
      const existingProducto = await prisma.producto.findFirst({
        where: {
          codigoInterno: normalizedCodigoInterno,
          NOT: { id },
        },
        select: { id: true },
      });

      if (existingProducto) {
        return NextResponse.json(
          {
            error:
              'El código interno ya está asignado a otro producto',
          },
          { status: 409 }
        );
      }
    }

    if (effectiveSubcategoriaId && effectiveCategoriaId) {
      const subcategoria = await prisma.categoria.findUnique({
        where: { catId: effectiveSubcategoriaId },
        select: { parentId: true },
      });

      if (
        !subcategoria ||
        subcategoria.parentId !== effectiveCategoriaId
      ) {
        return NextResponse.json(
          {
            error:
              'La subcategoría debe pertenecer a la categoría seleccionada',
          },
          { status: 400 }
        );
      }
    }

    if (precios && Array.isArray(precios)) {
      await Promise.all(
        precios.map((p: any) =>
          prisma.precioProducto.upsert({
            where: {
              listaPrecioId_productoId: {
                listaPrecioId: p.listaPrecioId,
                productoId: id,
              },
            },
            update: { precio: p.precio },
            create: {
              listaPrecioId: p.listaPrecioId,
              productoId: id,
              precio: p.precio,
            },
          })
        )
      );
    }

    const producto = await prisma.$transaction(async (tx) => {
      const updated = await tx.producto.update({
        where: { id: id },
        data: {
          nombre,
          descripcion,
          precioCosto,
          precioVenta,
          stock,
          ...(stockMinimo !== undefined && { stockMinimo }),
          ...(fotos !== undefined && { fotos }),
          ...(normalizedCodigoInterno !== undefined && {
            codigoInterno: normalizedCodigoInterno,
          }),
          ...(normalizedProveedorCodigo !== undefined && {
            proveedorCodigo: normalizedProveedorCodigo,
          }),
          ...(categoriaId !== undefined && { categoriaId }),
          ...(subcategoriaId !== undefined && {
            subcategoriaId: subcategoriaId || null,
          }),
          unidadId,
          ...(vendorId !== undefined && { vendorId }),
          almacenId,
        },
        include: {
          categoria: true,
          subcategoria: true,
          unidad: true,
          vendor: true,
          almacen: true,
        },
      });

      if (
        (precioCosto !== undefined &&
          precioCosto !== currentProducto.precioCosto) ||
        (precioVenta !== undefined &&
          precioVenta !== currentProducto.precioVenta)
      ) {
        try {
          await tx.productoCostHistory.create({
            data: {
              productoId: id,
              oldPrecioCosto: currentProducto.precioCosto,
              newPrecioCosto:
                precioCosto !== undefined
                  ? precioCosto
                  : currentProducto.precioCosto,
              oldPrecioVenta: currentProducto.precioVenta,
              newPrecioVenta:
                precioVenta !== undefined
                  ? precioVenta
                  : currentProducto.precioVenta,
              reason: 'MANUAL_EDIT',
              changedBy: _user?.id || 'system',
              changedAt: new Date(),
              notes: null,
            },
          });
        } catch (historyError) {
          console.error(
            'Error recording cost history:',
            historyError
          );
        }
      }

      return updated;
    });

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status: 500 }
    );
  }
}

export async function deleteProductoHandler(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
  _user: any
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    await prisma.producto.delete({
      where: { id: id },
    });

    return NextResponse.json({ success: true, id: id });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    );
  }
}

export async function bulkUpdateStockMinimoHandler(
  request: NextRequest,
  _context: any,
  _user: any
): Promise<NextResponse> {
  try {
    const body = await request.json();

    const validation = validateBulkUpdateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          updated: 0,
          errors: validation.errors.map((error) => ({
            productoId: 'validation',
            error,
          })),
          results: [],
        } as BulkUpdateResponse,
        { status: 400 }
      );
    }

    const { updates }: BulkStockMinimoUpdate = body;

    const result = await prisma.$transaction(async (tx: any) => {
      const results: BulkUpdateResponse['results'] = [];
      const errors: BulkUpdateResponse['errors'] = [];
      let successCount = 0;

      for (const update of updates) {
        try {
          const existingProduct = await tx.producto.findUnique({
            where: { id: update.productoId },
            select: {
              id: true,
              stockMinimo: true,
              nombre: true,
            },
          });

          if (!existingProduct) {
            errors.push({
              productoId: update.productoId,
              error: 'Producto no encontrado',
            });
            results.push({
              productoId: update.productoId,
              success: false,
            });
            continue;
          }

          const updatedProduct = await tx.producto.update({
            where: { id: update.productoId },
            data: { stockMinimo: update.stockMinimo },
            select: { id: true, stockMinimo: true },
          });

          results.push({
            productoId: update.productoId,
            success: true,
            previousStockMinimo: existingProduct.stockMinimo,
            newStockMinimo: updatedProduct.stockMinimo,
          });

          successCount++;
        } catch (error) {
          console.error(
            `Error updating product ${update.productoId}:`,
            error
          );

          let errorMessage = 'Error interno del servidor';
          if (error instanceof Error) {
            if (
              error.message.includes(
                'Record to update not found'
              )
            ) {
              errorMessage = 'Producto no encontrado';
            } else if (
              error.message.includes(
                'Foreign key constraint'
              )
            ) {
              errorMessage = 'Error de integridad de datos';
            } else {
              errorMessage = error.message;
            }
          }

          errors.push({
            productoId: update.productoId,
            error: errorMessage,
          });

          results.push({
            productoId: update.productoId,
            success: false,
          });
        }
      }

      return {
        success: errors.length === 0,
        updated: successCount,
        errors,
        results,
      };
    });

    const statusCode = result.success
      ? 200
      : result.updated > 0
        ? 207
        : 400;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error('Error in bulk stock minimo update:', error);

    return NextResponse.json(
      {
        success: false,
        updated: 0,
        errors: [
          {
            productoId: 'system',
            error: 'Error interno del servidor',
          },
        ],
        results: [],
      } as BulkUpdateResponse,
      { status: 500 }
    );
  }
}

export async function restockProductoHandler(
  request: NextRequest
) {
  try {
    const authResultUser = await authenticateUser(request);
    if ('status' in authResultUser)
      return authResultUser as Response;
    const user = authResultUser.user;

    const body = await request.json();

    const validation =
      await RestockValidator.validateCompleteRestockOperation(
        body,
        user
      );

    if (!validation.success) {
      return RestockApiErrorHandler.handleValidationErrors(
        validation.errors || []
      );
    }

    const {
      productoId,
      cantidad,
      precioCosto,
      precioVenta,
      descripcion,
      numeroFactura,
      facturaUrl,
      formaPago,
      estado,
      moneda,
      tasaCambio,
      montoConvertido,
      monedaOriginal,
      montoOriginal,
      cuentaId: cuentaIdParam,
      tipoRestock,
    } = validation.data!;

    const forceNewInstance = tipoRestock === 'nueva_instancia';
    const forceSumStock = tipoRestock === 'sumar_stock';

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: {
        categoria: true,
        unidad: true,
        vendor: true,
        almacen: true,
      },
    });

    const businessValidation =
      RestockValidator.validateBusinessRules(
        producto as Record<string, unknown> | null,
        validation.data!
      );

    if (!businessValidation.success) {
      return RestockApiErrorHandler.handleValidationErrors(
        businessValidation.errors || []
      );
    }

    const workflowResult =
      executeProductInstanceCreationWorkflow({
        currentProduct: {
          id: producto!.id,
          nombre: producto!.nombre,
          descripcion: producto!.descripcion,
          codigoInterno: producto!.codigoInterno,
          precioCosto: producto!.precioCosto,
          precioVenta: producto!.precioVenta,
          stock: producto!.stock,
          fotos: producto!.fotos || [],
          categoriaId: producto!.categoriaId,
          unidadId: producto!.unidadId,
          vendorId: producto!.vendorId,
          almacenId: producto!.almacenId,
          puntoDeVentaId: producto!.puntoDeVentaId,
        },
        restockQuantity: cantidad,
        newCostPrice: precioCosto,
        newSellingPrice: precioVenta,
        forceNewInstance,
        forceSumStock,
      });

    const calculationValidation =
      RestockValidator.validateCalculations({
        newStock: workflowResult.originalProductUpdate.newStock,
        totalCost:
          cantidad * (precioCosto || producto!.precioCosto),
        weightedAverages: workflowResult.weightedAverages,
      });

    if (!calculationValidation.success) {
      return RestockApiErrorHandler.handleValidationErrors(
        calculationValidation.errors || []
      );
    }

    const result = await prisma.$transaction(
      async (tx: any) => {
        const currentProduct = await tx.producto.findUnique({
          where: { id: productoId },
          select: {
            id: true,
            stock: true,
            precioCosto: true,
            precioVenta: true,
          },
        });

        if (!currentProduct) {
          throw RestockErrorFactory.productNotFound(productoId);
        }

        if (
          currentProduct.stock !== producto!.stock ||
          currentProduct.precioCosto !== producto!.precioCosto ||
          currentProduct.precioVenta !== producto!.precioVenta
        ) {
          throw RestockErrorFactory.concurrentModification(
            productoId
          );
        }

        const newStock =
          workflowResult.originalProductUpdate.newStock;
        if (newStock < 0 || !Number.isInteger(newStock)) {
          throw RestockErrorFactory.calculationError(
            'invalid_stock',
            { newStock, cantidad }
          );
        }

        let updatedProducto;
        let newProductInstance = null;
        let gastoCompra;
        let compraProducto;
        let reconciliacionGasto: any = null;
        let cuentaPorPagar: any = null;

        if (
          workflowResult.needsNewInstance &&
          workflowResult.newInstance
        ) {
          newProductInstance = await tx.producto.create({
            data: workflowResult.newInstance!.data,
            include: {
              categoria: true,
              unidad: true,
              vendor: true,
              almacen: true,
            },
          });

          updatedProducto = await tx.producto.findUnique({
            where: { id: productoId },
            include: {
              categoria: true,
              unidad: true,
              vendor: true,
              almacen: true,
            },
          });

          const costPrice =
            precioCosto || newProductInstance.precioCosto;
          const totalCost = cantidad * costPrice;

          if (
            totalCost <= 0 ||
            !Number.isFinite(totalCost)
          ) {
            throw RestockErrorFactory.calculationError(
              'invalid_total_cost',
              { totalCost, cantidad, costPrice }
            );
          }

          const now = new Date();
          const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          gastoCompra = await tx.gastoCompra.create({
            data: {
              productoId: newProductInstance.id,
              vendorId: newProductInstance.vendorId,
              cantidad: cantidad,
              precioUnitario: costPrice,
              total: totalCost,
              fechaCompra: now,
              descripcion:
                descripcion ||
                `Restock - ${newProductInstance.nombre}`,
              periodo: periodo,
              numeroFactura: numeroFactura || undefined,
            },
            include: {
              producto: true,
              vendor: true,
            },
          });

          compraProducto = tx.compraProducto?.create
            ? await tx.compraProducto.create({
                data: {
                  productoId: newProductInstance.id,
                  proveedorId:
                    newProductInstance.vendorId,
                  numeroFactura: numeroFactura || '',
                  facturaUrl: facturaUrl || '',
                  cantidad: cantidad,
                  precioUnitario: costPrice,
                  total: totalCost,
                  formaPago:
                    formaPago || 'PAGO_COMPLETO',
                  estado: estado || 'PAGADA',
                  tipoOperacion: 'RESTOCK',
                  descripcion:
                    descripcion ||
                    `Restock - ${newProductInstance.nombre}`,
                  fechaCompra: now,
                  gastoCompraId:
                    gastoCompra.gastoCompraId,
                },
              })
            : null;

          const formaPagoFinal = (
            formaPago || 'PAGO_COMPLETO'
          ).toUpperCase();
          const productoForPayment = newProductInstance;

          reconciliacionGasto = null;
          cuentaPorPagar = null;

          const canRunPaymentWorkflow =
            !!tx.tipoPago?.findFirst &&
            !!tx.cuentaBancaria?.findUnique &&
            !!tx.reconciliacionGasto?.create &&
            !!tx.cuentaBancaria?.update &&
            !!tx.cuentaPorPagar?.create;

          if (
            canRunPaymentWorkflow &&
            formaPagoFinal === 'PAGO_COMPLETO'
          ) {
            let cuentaId = cuentaIdParam;

            if (!cuentaId) {
              const tipoPago =
                await tx.tipoPago.findFirst({
                  where: { isActive: true },
                  orderBy: { createdAt: 'asc' },
                  select: {
                    tipoId: true,
                    cuentaDefecto: true,
                  },
                });

              if (!tipoPago) {
                throw RestockErrorFactory.createBaseError(
                  'INTERNAL_SERVER_ERROR' as any,
                  'No hay tipos de pago activos disponibles',
                  'HIGH' as any
                );
              }

              cuentaId = tipoPago.cuentaDefecto;
              if (!cuentaId) {
                const cuentaFallback =
                  await tx.cuentaBancaria.findFirst({
                    where: { isActive: true },
                    orderBy: { createdAt: 'asc' },
                    select: { cuentaId: true },
                  });
                cuentaId =
                  cuentaFallback?.cuentaId;
              }
            }

            if (!cuentaId) {
              throw RestockErrorFactory.createBaseError(
                'INTERNAL_SERVER_ERROR' as any,
                'No hay cuentas bancarias activas disponibles',
                'HIGH' as any
              );
            }

            const cuentaBancaria =
              await tx.cuentaBancaria.findUnique({
                where: { cuentaId },
                select: {
                  cuentaId: true,
                  isActive: true,
                  moneda: true,
                },
              });

            if (
              !cuentaBancaria ||
              !cuentaBancaria.isActive
            ) {
              throw RestockErrorFactory.createBaseError(
                'BAD_REQUEST' as any,
                'La cuenta bancaria seleccionada no está activa',
                'HIGH' as any
              );
            }

            const tipoPagoData =
              await tx.tipoPago.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { tipoId: true },
              });
            const tipoPagoId =
              tipoPagoData?.tipoId;

            const reconciliacionMoneda =
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? monedaOriginal
                : 'CUP';
            const reconciliacionMonto =
              montoOriginal &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoOriginal
                : totalCost;
            const reconciliacionTasaCambio =
              tasaCambio &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? tasaCambio
                : null;
            const reconciliacionMontoConvertido =
              montoConvertido &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoConvertido
                : null;

            reconciliacionGasto =
              await tx.reconciliacionGasto.create({
                data: {
                  tipoGasto: 'compra',
                  referenciaId:
                    gastoCompra.gastoCompraId,
                  cuentaId: cuentaId,
                  tipoPagoId: tipoPagoId,
                  gastoCompraId:
                    gastoCompra.gastoCompraId,
                  monto: reconciliacionMonto,
                  moneda: reconciliacionMoneda,
                  tasaCambio:
                    reconciliacionTasaCambio,
                  montoConvertido:
                    reconciliacionMontoConvertido,
                  descripcion: `Restock pagado - ${productoForPayment.nombre}`,
                  periodo: periodo,
                  estado: 'PAGADA',
                  reconciliadoPor:
                    (user as any).userId || 'system',
                },
              });

            const saldoADescontar =
              montoConvertido &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoConvertido
                : totalCost;
            await tx.cuentaBancaria.update({
              where: { cuentaId: cuentaId },
              data: {
                saldo: { decrement: saldoADescontar },
              },
            });
          } else if (
            canRunPaymentWorkflow &&
            formaPagoFinal === 'PAGO_PARCIAL'
          ) {
            const cuentaPorPagarMoneda =
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? monedaOriginal
                : 'CUP';
            const cuentaPorPagarMonto =
              montoOriginal &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoOriginal
                : totalCost;

            cuentaPorPagar =
              await tx.cuentaPorPagar.create({
                data: {
                  numeroFactura:
                    numeroFactura ||
                    `RESTOCK-${now.getTime()}`,
                  tipo: 'compra',
                  gastoCompraId:
                    gastoCompra.gastoCompraId,
                  proveedorId:
                    productoForPayment.vendorId,
                  proveedorNombre:
                    productoForPayment.vendor
                      ?.nombre ||
                    'Proveedor no especificado',
                  montoDeuda: cuentaPorPagarMonto,
                  montoPagado: 0,
                  saldoPendiente: cuentaPorPagarMonto,
                  moneda: cuentaPorPagarMoneda,
                  fechaEmision: now,
                  estado: 'PENDIENTE',
                },
              });

            if (
              compraProducto &&
              tx.compraProducto?.update
            ) {
              await tx.compraProducto.update({
                where: {
                  compraProductoId:
                    compraProducto.compraProductoId,
                },
                data: {
                  cuentaPorPagarId:
                    cuentaPorPagar.cuentaPorPagarId,
                },
              });
            }
          }
        } else {
          if (
            precioCosto !== undefined ||
            precioVenta !== undefined
          ) {
            updatedProducto = await tx.producto.update({
              where: { id: productoId },
              data: {
                stock:
                  workflowResult.originalProductUpdate
                    .newStock,
                precioCosto:
                  workflowResult.originalProductUpdate
                    .newPrecioCosto,
                precioVenta:
                  workflowResult.originalProductUpdate
                    .newPrecioVenta,
              },
              include: {
                categoria: true,
                unidad: true,
                vendor: true,
                almacen: true,
              },
            });
            await upsertStockUbicacion(tx, {
              productoId,
              tipoUbicacion: 'almacen',
              ubicacionId: producto!.almacenId,
              modo: 'set',
              valor:
                workflowResult.originalProductUpdate
                  .newStock,
            });
          } else {
            updatedProducto = await tx.producto.update({
              where: { id: productoId },
              data: {
                stock:
                  workflowResult.originalProductUpdate
                    .newStock,
              },
              include: {
                categoria: true,
                unidad: true,
                vendor: true,
                almacen: true,
              },
            });
            await upsertStockUbicacion(tx, {
              productoId,
              tipoUbicacion: 'almacen',
              ubicacionId: producto!.almacenId,
              modo: 'set',
              valor:
                workflowResult.originalProductUpdate
                  .newStock,
            });
          }

          const costPrice =
            precioCosto || producto!.precioCosto;
          const totalCost = cantidad * costPrice;

          if (
            totalCost <= 0 ||
            !Number.isFinite(totalCost)
          ) {
            throw RestockErrorFactory.calculationError(
              'invalid_total_cost',
              { totalCost, cantidad, costPrice }
            );
          }

          const now = new Date();
          const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          gastoCompra = await tx.gastoCompra.create({
            data: {
              productoId: producto!.id,
              vendorId: producto!.vendorId,
              cantidad: cantidad,
              precioUnitario: costPrice,
              total: totalCost,
              fechaCompra: now,
              descripcion:
                descripcion ||
                `Restock - ${producto!.nombre}`,
              periodo: periodo,
              numeroFactura:
                numeroFactura || undefined,
            },
            include: {
              producto: true,
              vendor: true,
            },
          });

          compraProducto = tx.compraProducto?.create
            ? await tx.compraProducto.create({
                data: {
                  productoId: producto!.id,
                  proveedorId:
                    producto!.vendorId,
                  numeroFactura:
                    numeroFactura || '',
                  facturaUrl: facturaUrl || '',
                  cantidad: cantidad,
                  precioUnitario: costPrice,
                  total: totalCost,
                  formaPago:
                    formaPago || 'PAGO_COMPLETO',
                  estado: estado || 'PAGADA',
                  tipoOperacion: 'RESTOCK',
                  descripcion:
                    descripcion ||
                    `Restock - ${producto!.nombre}`,
                  fechaCompra: now,
                  gastoCompraId:
                    gastoCompra.gastoCompraId,
                },
              })
            : null;

          const formaPagoFinal = (
            formaPago || 'PAGO_COMPLETO'
          ).toUpperCase();

          reconciliacionGasto = null;
          cuentaPorPagar = null;

          const canRunPaymentWorkflowElse =
            !!tx.tipoPago?.findFirst &&
            !!tx.cuentaBancaria?.findUnique &&
            !!tx.reconciliacionGasto?.create &&
            !!tx.cuentaBancaria?.update &&
            !!tx.cuentaPorPagar?.create;

          if (
            canRunPaymentWorkflowElse &&
            formaPagoFinal === 'PAGO_COMPLETO'
          ) {
            let cuentaId = cuentaIdParam;

            if (!cuentaId) {
              const tipoPago =
                await tx.tipoPago.findFirst({
                  where: { isActive: true },
                  orderBy: { createdAt: 'asc' },
                  select: {
                    tipoId: true,
                    cuentaDefecto: true,
                  },
                });

              if (!tipoPago) {
                throw RestockErrorFactory.createBaseError(
                  'INTERNAL_SERVER_ERROR' as any,
                  'No hay tipos de pago activos disponibles',
                  'HIGH' as any
                );
              }

              cuentaId = tipoPago.cuentaDefecto;
              if (!cuentaId) {
                const cuentaFallback =
                  await tx.cuentaBancaria.findFirst({
                    where: { isActive: true },
                    orderBy: { createdAt: 'asc' },
                    select: { cuentaId: true },
                  });
                cuentaId =
                  cuentaFallback?.cuentaId;
              }
            }

            if (!cuentaId) {
              throw RestockErrorFactory.createBaseError(
                'INTERNAL_SERVER_ERROR' as any,
                'No hay cuentas bancarias activas disponibles',
                'HIGH' as any
              );
            }

            const cuentaBancaria =
              await tx.cuentaBancaria.findUnique({
                where: { cuentaId },
                select: {
                  cuentaId: true,
                  isActive: true,
                  moneda: true,
                },
              });

            if (
              !cuentaBancaria ||
              !cuentaBancaria.isActive
            ) {
              throw RestockErrorFactory.createBaseError(
                'BAD_REQUEST' as any,
                'La cuenta bancaria seleccionada no está activa',
                'HIGH' as any
              );
            }

            const tipoPagoData =
              await tx.tipoPago.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { tipoId: true },
              });
            const tipoPagoId =
              tipoPagoData?.tipoId;

            const reconciliacionMoneda =
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? monedaOriginal
                : 'CUP';
            const reconciliacionMonto =
              montoOriginal &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoOriginal
                : totalCost;
            const reconciliacionTasaCambio =
              tasaCambio &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? tasaCambio
                : null;
            const reconciliacionMontoConvertido =
              montoConvertido &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoConvertido
                : null;

            reconciliacionGasto =
              await tx.reconciliacionGasto.create({
                data: {
                  tipoGasto: 'compra',
                  referenciaId:
                    gastoCompra.gastoCompraId,
                  cuentaId: cuentaId,
                  tipoPagoId: tipoPagoId,
                  gastoCompraId:
                    gastoCompra.gastoCompraId,
                  monto: reconciliacionMonto,
                  moneda: reconciliacionMoneda,
                  tasaCambio:
                    reconciliacionTasaCambio,
                  montoConvertido:
                    reconciliacionMontoConvertido,
                  descripcion: `Restock pagado - ${producto!.nombre}`,
                  periodo: periodo,
                  estado: 'PAGADA',
                  reconciliadoPor:
                    (user as any).userId || 'system',
                },
              });

            const saldoADescontar =
              montoConvertido &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoConvertido
                : totalCost;
            await tx.cuentaBancaria.update({
              where: { cuentaId: cuentaId },
              data: {
                saldo: { decrement: saldoADescontar },
              },
            });
          } else if (
            canRunPaymentWorkflowElse &&
            formaPagoFinal === 'PAGO_PARCIAL'
          ) {
            const cuentaPorPagarMoneda =
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? monedaOriginal
                : 'CUP';
            const cuentaPorPagarMonto =
              montoOriginal &&
              monedaOriginal &&
              monedaOriginal !== 'CUP'
                ? montoOriginal
                : totalCost;

            cuentaPorPagar =
              await tx.cuentaPorPagar.create({
                data: {
                  numeroFactura:
                    numeroFactura ||
                    `RESTOCK-${now.getTime()}`,
                  tipo: 'compra',
                  gastoCompraId:
                    gastoCompra.gastoCompraId,
                  proveedorId:
                    producto!.vendorId,
                  proveedorNombre:
                    producto!.vendor?.nombre ||
                    'Proveedor no especificado',
                  montoDeuda: cuentaPorPagarMonto,
                  montoPagado: 0,
                  saldoPendiente:
                    cuentaPorPagarMonto,
                  moneda: cuentaPorPagarMoneda,
                  fechaEmision: now,
                  estado: 'PENDIENTE',
                },
              });

            if (
              compraProducto &&
              tx.compraProducto?.update
            ) {
              await tx.compraProducto.update({
                where: {
                  compraProductoId:
                    compraProducto.compraProductoId,
                },
                data: {
                  cuentaPorPagarId:
                    cuentaPorPagar.cuentaPorPagarId,
                },
              });
            }
          }
        }

        if (!updatedProducto || !gastoCompra) {
          throw RestockErrorFactory.transactionFailed({
            missingData: {
              updatedProducto: !!updatedProducto,
              gastoCompra: !!gastoCompra,
            },
          });
        }

        return {
          updatedProducto,
          gastoCompra,
          newProductInstance,
          workflowResult,
          compraProducto,
          reconciliacionGasto,
          cuentaPorPagar,
        };
      },
      {
        maxWait: 5000,
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      }
    );

    const pricesChanged =
      (precioCosto !== undefined &&
        precioCosto !== producto!.precioCosto) ||
      (precioVenta !== undefined &&
        precioVenta !== producto!.precioVenta);

    const successResponse: RestockSuccessResponse = {
      success: true,
      message: 'Product restocked successfully',
      data: {
        producto: result.updatedProducto,
        compraProducto: result.compraProducto,
        gastoCompra: result.gastoCompra,
        productInstance: result.newProductInstance,
        reconciliacionGasto: result.reconciliacionGasto,
        cuentaPorPagar: result.cuentaPorPagar,
        restockDetails: {
          cantidadAnterior: producto!.stock,
          cantidadNueva: result.updatedProducto.stock,
          cantidadAgregada: cantidad,
          costoTotal: result.gastoCompra.total,
          pricesChanged,
          reason: result.workflowResult.reason,
        },
        weightedAverages: {
          precioCosto:
            result.workflowResult.weightedAverages.costPrice
              .weightedAverage,
          precioVenta:
            result.workflowResult.weightedAverages.sellingPrice
              .weightedAverage,
        },
      },
      requestId: RestockErrorFactory.generateRequestId(),
    };

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    console.error('[RESTOCK_POST]', error);

    return RestockApiErrorHandler.handleUnknownError(error, {
      operation: 'restock',
    });
  }
}

export async function getStockUbicacionHandler(
  request: Request
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const ubicacionId = searchParams.get('ubicacionId');
    const tipoUbicacion = searchParams.get('tipoUbicacion');
    const includeZero =
      searchParams.get('includeZero') === 'true';

    if (!ubicacionId || !tipoUbicacion) {
      return NextResponse.json(
        {
          error:
            'ubicacionId y tipoUbicacion son requeridos',
        },
        { status: 400 }
      );
    }

    if (
      tipoUbicacion !== 'almacen' &&
      tipoUbicacion !== 'punto_venta'
    ) {
      return NextResponse.json(
        { error: 'tipoUbicacion inválido' },
        { status: 400 }
      );
    }

    const registros = await prisma.stockUbicacion.findMany({
      where: {
        ubicacionId,
        tipoUbicacion,
        ...(includeZero ? {} : { cantidad: { gt: 0 } }),
      },
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            codigoInterno: true,
            codigoNegocio: true,
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
            categoria: {
              select: { catId: true, nombre: true },
            },
            subcategoria: {
              select: {
                catId: true,
                nombre: true,
                parentId: true,
              },
            },
            unidad: {
              select: {
                unidadId: true,
                nombre: true,
                simbolo: true,
              },
            },
            vendor: {
              select: { vendorId: true, nombre: true },
            },
          },
        },
      },
    });

    if (!includeZero) {
      const resultado = registros.map((r) => ({
        ...r.producto,
        stockUbicacion: r.cantidad,
        stockTotal: r.producto.stock,
      }));

      return NextResponse.json(resultado);
    }

    const productosBase = await prisma.producto.findMany({
      where:
        tipoUbicacion === 'almacen'
          ? { almacenId: ubicacionId }
          : undefined,
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        codigoInterno: true,
        codigoNegocio: true,
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
        categoria: {
          select: { catId: true, nombre: true },
        },
        subcategoria: {
          select: {
            catId: true,
            nombre: true,
            parentId: true,
          },
        },
        unidad: {
          select: {
            unidadId: true,
            nombre: true,
            simbolo: true,
          },
        },
        vendor: {
          select: { vendorId: true, nombre: true },
        },
      },
    });

    const stockPorProducto = new Map(
      registros.map((registro) => [
        registro.productoId,
        registro.cantidad,
      ])
    );

    const productosMap = new Map(
      productosBase.map((producto) => [
        producto.id,
        {
          ...producto,
          stockUbicacion:
            stockPorProducto.get(producto.id) ?? 0,
          stockTotal: producto.stock,
        },
      ])
    );

    for (const registro of registros) {
      if (!productosMap.has(registro.productoId)) {
        productosMap.set(registro.productoId, {
          ...registro.producto,
          stockUbicacion: registro.cantidad,
          stockTotal: registro.producto.stock,
        });
      }
    }

    const resultado = Array.from(productosMap.values());

    return NextResponse.json(resultado);
  } catch (error) {
    console.error(
      'Error al obtener stock por ubicación:',
      error
    );
    return NextResponse.json(
      {
        error:
          'Error interno del servidor al calcular stock',
      },
      { status: 500 }
    );
  }
}
