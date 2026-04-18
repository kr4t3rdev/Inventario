import { NextRequest, NextResponse } from 'next/server';

import { withAuthGet, withAuthPost } from '@/lib/auth-middleware';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import {
  FindNextAvailableSurtido,
  ValidateAssembledCode,
} from '@/lib/ean13-utils';
import { prisma } from '@/lib/prisma';
import {
  assertServerOwnedCodeFields,
  buildProductBusinessCodeFromSegments,
  normalizeProveedorCodigo,
  resolveTaxonomySegments,
  generateProductCodeWithRetry,
} from '@/lib/product-business-code';

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

/**
 * @description Normaliza el código interno opcional del producto.
 * @param {unknown} value - Valor recibido en el payload.
 * @returns {string | null} Código interno normalizado o null.
 */
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

/**
 * @description Construye una respuesta JSON de error consistente.
 * @param {string} message - Mensaje a devolver.
 * @param {number} status - Código HTTP.
 * @returns {NextResponse} Respuesta JSON tipada.
 */
function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * @description Deriva el código de proveedor desde los productos ya asociados al vendor.
 * @param {Array<{ proveedorCodigo?: string | null }>} productos - Historial de productos del proveedor.
 * @returns {string | null} Código consistente o null si no se puede resolver.
 */
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

/**
 * @description Resuelve el código de proveedor usando vendorId como contrato primario y proveedorCodigo legado como fallback.
 * @param {string | null | undefined} vendorId - Identificador del proveedor seleccionado.
 * @param {unknown} proveedorCodigoInput - Código legado opcional enviado por clientes viejos.
 * @returns {Promise<VendorProviderContext | NextResponse>} Contexto resuelto o error HTTP.
 */
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

    const proveedorCodigoDerivado = deriveProveedorCodigoFromVendorProducts(vendor.productos);

    if (proveedorCodigoDerivado) {
      return {
        vendorId: vendor.vendorId,
        proveedorCodigo: proveedorCodigoDerivado,
      };
    }

    if (proveedorCodigoInput !== undefined && proveedorCodigoInput !== null && proveedorCodigoInput !== '') {
      try {
        return {
          vendorId: vendor.vendorId,
          proveedorCodigo: normalizeProveedorCodigo(proveedorCodigoInput),
        };
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : 'Proveedor inválido', 400);
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
    return jsonError(error instanceof Error ? error.message : 'Proveedor inválido', 400);
  }
}

/**
 * @description Obtiene y valida la taxonomía usada para generar el código de negocio.
 * @param {string | null | undefined} categoriaId - ID de la categoría.
 * @param {string | null | undefined} subcategoriaId - ID de la subcategoría.
 * @returns {Promise<TaxonomyContext | NextResponse>} Contexto listo para generación o un error HTTP.
 */
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
    const resolvedSegments = resolveTaxonomySegments(categoria.nombre, subcategoria.nombre);

    return {
      categoriaId: categoria.catId,
      subcategoriaId: subcategoria.catId,
      idSeccionCodigo: resolvedSegments.idSeccionCodigo,
      especificoCodigo: resolvedSegments.especificoCodigo,
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'No se pudo resolver la taxonomía del código de negocio';

    return jsonError(message, 400);
  }
}

/**
 * @description Verifica unicidad del código de negocio antes de persistir.
 * @param {typeof prisma} prismaClient - Cliente Prisma o transacción.
 * @param {string} codigoNegocio - Código EAN-13 generado.
 * @returns {Promise<void>}
 */
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
    throw new Error('El código de negocio EAN-13 ya está asignado a otro producto');
  }
}

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');

    const whereClause: Record<string, unknown> = {};
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
          subcategoria: { select: { catId: true, nombre: true, parentId: true } },
          unidad: { select: { simbolo: true } },
          vendor: { select: { nombre: true } },
          almacen: { select: { nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.producto.count({ where: whereClause }),
    ]);

    const productos = await Promise.all(
      productosRaw.map(async (producto: { id: string; stock: number }) => {
        const [tEntrada, tSalida, ventasItems, ventasLegacy] = await Promise.all([
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

        const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0);
        const stockEnPVs = (tEntrada._sum.cantidad || 0) - (tSalida._sum.cantidad || 0) - ventasTotal;

        return {
          ...producto,
          stock: producto.stock + Math.max(0, stockEnPVs),
        };
      })
    );

    return NextResponse.json({ productos, totalCount });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return jsonError('Failed to fetch products', 500);
  }
});

export const POST = withAuthPost(async (req: NextRequest) => {
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
      return jsonError(error instanceof Error ? error.message : 'Payload inválido', 400);
    }

    // Verificar si la empresa usa codificación EAN-13
    const miEmpresa = await prisma.miEmpresa.findFirst({ select: { usaCodigoEan13: true } });
    const usaCodigoEan13 = miEmpresa?.usaCodigoEan13 ?? false;
    const normalizedCodigoInterno = normalizeCodigoInterno(codigoInterno);

    if (normalizedCodigoInterno && !CODIGO_INTERNO_REGEX.test(normalizedCodigoInterno)) {
      return jsonError('El código interno debe contener exactamente 11 números', 400);
    }

    if (normalizedCodigoInterno) {
      const existingProducto = await prisma.producto.findFirst({
        where: { codigoInterno: normalizedCodigoInterno },
        select: { id: true },
      });

      if (existingProducto) {
        return jsonError('El código interno ya está asignado a otro producto', 409);
      }
    }

    // ── Rama SIN EAN-13 ──────────────────────────────────────────────────────
    if (!usaCodigoEan13) {
      if (!categoriaId) {
        return jsonError('La categoría es requerida', 400);
      }

      if (
        stockMinimo !== undefined &&
        (typeof stockMinimo !== 'number' || stockMinimo < 0 || !Number.isInteger(stockMinimo))
      ) {
        return jsonError('El stock mínimo debe ser un número entero mayor o igual a 0', 400);
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
                create: precios.map((precio: { listaPrecioId: string; precio: number }) => ({
                  listaPrecioId: precio.listaPrecioId,
                  precio: precio.precio,
                })),
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

    // ── Rama CON EAN-13 (flujo original) ─────────────────────────────────────
    const vendorProviderContext = await resolveVendorProviderContext(
      vendorId ?? null,
      proveedorCodigo
    );
    if (vendorProviderContext instanceof NextResponse) {
      return vendorProviderContext;
    }

    const taxonomyContext = await resolveTaxonomyContext(categoriaId, subcategoriaId);
    if (taxonomyContext instanceof NextResponse) {
      return taxonomyContext;
    }

    if (
      stockMinimo !== undefined &&
      (typeof stockMinimo !== 'number' || stockMinimo < 0 || !Number.isInteger(stockMinimo))
    ) {
      return jsonError('El stock mínimo debe ser un número entero mayor o igual a 0', 400);
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const generatedParentSurtido = await FindNextAvailableSurtido(
        tx as any,
        taxonomyContext.idSeccionCodigo,
        taxonomyContext.especificoCodigo
      );

      // Usa retry logic para generar código padre (maneja conflictos automáticamente)
      const generatedParentCode = await generateProductCodeWithRetry(
        tx,
        {
          proveedorCodigo: vendorProviderContext.proveedorCodigo,
          idSeccionCodigo: taxonomyContext.idSeccionCodigo,
          especificoCodigo: taxonomyContext.especificoCodigo,
          surtidoCodigo: generatedParentSurtido,
        },
        3 // maxAttempts
      );

      if (!ValidateAssembledCode(generatedParentCode.codigoNegocio)) {
        throw new Error('El código EAN-13 generado para el producto padre no pasó validación');
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
                create: precios.map((precio: { listaPrecioId: string; precio: number }) => ({
                  listaPrecioId: precio.listaPrecioId,
                  precio: precio.precio,
                })),
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
      return jsonError('El código generado ya existe. Reintentá la operación.', 409);
    }

    if (error instanceof Error && /código de negocio/i.test(error.message)) {
      return jsonError(error.message, 409);
    }

    return jsonError('Failed to create product', 500);
  }
});
