import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"
import {
  assertServerOwnedCodeFields,
  normalizeProveedorCodigo,
} from '@/lib/product-business-code'

type ProductoRouteContext = { params: Promise<{ id: string }> }
const CODIGO_INTERNO_REGEX = /^[0-9]{11}$/

function normalizeCodigoInterno(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    return undefined
  }

  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return null
  }

  return normalizedValue
}

export const GET = withAuth(async (_request: NextRequest, context: ProductoRouteContext, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const { id } = await context.params
    const producto = await prisma.producto.findUnique({
      where: { id: id, tenantId },
      include: {
        categoria: true,
        subcategoria: true,
        unidad: true,
        vendor: true,
        almacen: true,
        precios: true
      },
    })

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    return NextResponse.json(producto)
  } catch (error) {
    console.error("Error al obtener producto:", error)
    return NextResponse.json({ error: "Error al obtener producto" }, { status: 500 })
  }
})

export const PATCH = withAuth(async (request: NextRequest, context: ProductoRouteContext, _user: any) => {
  try {
    const { id } = await context.params;
    const body = await request.json()
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
      precios
    } = body

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
    })

    if (!currentProducto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Validate stockMinimo if provided
    if (stockMinimo !== undefined && (typeof stockMinimo !== 'number' || stockMinimo < 0 || !Number.isInteger(stockMinimo))) {
      return NextResponse.json({
        error: 'El stock mínimo debe ser un número entero mayor o igual a 0'
      }, {
        status: 400
      })
    }

    if (codigoInterno !== undefined && codigoInterno !== null && typeof codigoInterno !== "string") {
      return NextResponse.json({
        error: 'El código interno debe enviarse como texto'
      }, {
        status: 400
      })
    }

    const normalizedCodigoInterno = normalizeCodigoInterno(codigoInterno)
    const miEmpresa = await prisma.miEmpresa.findFirst({ select: { usaCodigoEan13: true } })
    const usaEan13 = miEmpresa?.usaCodigoEan13 ?? false

    const effectiveCategoriaId = categoriaId ?? currentProducto.categoriaId
    const effectiveSubcategoriaId =
      subcategoriaId === undefined ? currentProducto.subcategoriaId : subcategoriaId
    const effectiveVendorId = vendorId === undefined ? currentProducto.vendorId : vendorId
    const effectiveProveedorCodigoRaw =
      proveedorCodigo === undefined ? currentProducto.proveedorCodigo : proveedorCodigo

    let normalizedProveedorCodigo: string | undefined

    if (usaEan13) {
      try {
        assertServerOwnedCodeFields({
          idSeccionCodigo,
          especificoCodigo,
          surtidoCodigo,
        })
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Error validando segmentos EAN-13'
        }, { status: 400 })
      }

      if (!effectiveCategoriaId) {
        return NextResponse.json({
          error: 'La categoría es requerida para productos con EAN-13'
        }, { status: 400 })
      }

      if (!effectiveSubcategoriaId) {
        return NextResponse.json({
          error: 'La subcategoría es requerida para productos con EAN-13'
        }, { status: 400 })
      }

      if (
        effectiveProveedorCodigoRaw === undefined ||
        effectiveProveedorCodigoRaw === null ||
        String(effectiveProveedorCodigoRaw).trim() === ''
      ) {
        return NextResponse.json({
          error: 'Seleccione un proveedor para generar el EAN-13'
        }, { status: 400 })
      }

      try {
        normalizedProveedorCodigo = normalizeProveedorCodigo(effectiveProveedorCodigoRaw)
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error ? error.message : 'Proveedor inválido'
        }, { status: 400 })
      }

      if (effectiveVendorId) {
        const existingVendor = await prisma.vendor.findUnique({
          where: { vendorId: effectiveVendorId },
          select: { vendorId: true },
        })

        if (!existingVendor) {
          return NextResponse.json({
            error: 'El proveedor seleccionado no existe'
          }, { status: 400 })
        }
      }

      const isCategoriaChanging =
        categoriaId !== undefined && categoriaId !== currentProducto.categoriaId
      const isSubcategoriaChanging =
        subcategoriaId !== undefined && subcategoriaId !== currentProducto.subcategoriaId

      if (isCategoriaChanging || isSubcategoriaChanging) {
        return NextResponse.json({
          error: 'La categoría y la subcategoría no se pueden cambiar en productos con EAN-13 ya generado'
        }, { status: 400 })
      }
    }

    if (normalizedCodigoInterno && !CODIGO_INTERNO_REGEX.test(normalizedCodigoInterno)) {
      return NextResponse.json({
        error: 'El código interno debe contener exactamente 11 números'
      }, {
        status: 400
      })
    }

    if (normalizedCodigoInterno) {
      const existingProducto = await prisma.producto.findFirst({
        where: {
          codigoInterno: normalizedCodigoInterno,
          NOT: { id }
        },
        select: { id: true }
      })

      if (existingProducto) {
        return NextResponse.json({
          error: 'El código interno ya está asignado a otro producto'
        }, {
          status: 409
        })
      }
    }

    // Validate subcategory belongs to category if both are provided
    if (effectiveSubcategoriaId && effectiveCategoriaId) {
      const subcategoria = await prisma.categoria.findUnique({
        where: { catId: effectiveSubcategoriaId },
        select: { parentId: true }
      })
      
      if (!subcategoria || subcategoria.parentId !== effectiveCategoriaId) {
        return NextResponse.json({
          error: 'La subcategoría debe pertenecer a la categoría seleccionada'
        }, {
          status: 400
        })
      }
    }

    if (precios && Array.isArray(precios)) {
      await Promise.all(precios.map((p: any) => 
        prisma.precioProducto.upsert({
          where: {
            listaPrecioId_productoId: {
              listaPrecioId: p.listaPrecioId,
              productoId: id
            }
          },
          update: { precio: p.precio },
          create: {
            listaPrecioId: p.listaPrecioId,
            productoId: id,
            precio: p.precio
          }
        })
      ))
    }

    // Use transaction to ensure atomicity: update product + log cost change together
    const producto = await prisma.$transaction(async (tx) => {
      // Update the product
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
          ...(normalizedCodigoInterno !== undefined && { codigoInterno: normalizedCodigoInterno }),
          ...(normalizedProveedorCodigo !== undefined && { proveedorCodigo: normalizedProveedorCodigo }),
          ...(categoriaId !== undefined && { categoriaId }),
          ...(subcategoriaId !== undefined && { subcategoriaId: subcategoriaId || null }),
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
      })

      // Record cost change if prices changed
      if (
        (precioCosto !== undefined && precioCosto !== currentProducto.precioCosto) ||
        (precioVenta !== undefined && precioVenta !== currentProducto.precioVenta)
      ) {
        try {
          await tx.productoCostHistory.create({
            data: {
              productoId: id,
              oldPrecioCosto: currentProducto.precioCosto,
              newPrecioCosto: precioCosto !== undefined ? precioCosto : currentProducto.precioCosto,
              oldPrecioVenta: currentProducto.precioVenta,
              newPrecioVenta: precioVenta !== undefined ? precioVenta : currentProducto.precioVenta,
              reason: 'MANUAL_EDIT',
              changedBy: _user?.id || 'system',
              changedAt: new Date(),
              notes: null,
            },
          })
        } catch (historyError) {
          console.error('Error recording cost history:', historyError)
          // Don't fail the update if history recording fails, but log it
        }
      }

      return updated
    })

    return NextResponse.json(producto)
  } catch (error) {
    console.error("Error al actualizar producto:", error)
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_request: NextRequest, context: ProductoRouteContext, _user: any) => {
  try {
    const { id } = await context.params;

    await prisma.producto.delete({
      where: { id: id },
    })

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    console.error("Error al eliminar producto:", error)
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 })
  }
})
