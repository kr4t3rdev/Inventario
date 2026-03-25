
import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware";
import { generateEan13BusinessCode } from '@/lib/ean13-utils';

const CODIGO_INTERNO_REGEX = /^[0-9]{11}$/;

function normalizeCodigoInterno(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const categoryId = searchParams.get('categoryId')
        const subcategoryId = searchParams.get('subcategoryId')
        const esCompuesto = searchParams.get('esCompuesto')

        // Build where clause - incluir todos los productos para reportes
        const whereClause: Record<string, any> = {}
        const andConditions: Record<string, any> = []

        // Add esCompuesto filter
        if (esCompuesto !== null) {
            andConditions.push({ esCompuesto: esCompuesto === 'true' })
        }

        // Add search functionality
        if (search) {
            andConditions.push({
                OR: [
                    {
                        nombre: {
                            contains: search
                        }
                    },
                    {
                        descripcion: {
                            contains: search
                        }
                    },
                    {
                        codigoInterno: {
                            contains: search
                        }
                    },
                    {
                        codigoNegocio: {
                            contains: search
                        }
                    },
                    {
                        categoria: {
                            nombre: {
                                contains: search
                            }
                        }
                    },
                    {
                        subcategoria: {
                            nombre: {
                                contains: search
                            }
                        }
                    },
                    {
                        vendor: {
                            nombre: {
                                contains: search
                            }
                        }
                    }
                ]
            })
        }

        // Add category filter
        if (categoryId) {
            if (subcategoryId) {
                // Filter by specific subcategory
                andConditions.push({ subcategoriaId: subcategoryId })
            } else {
                // Filter by category and its subcategories
                andConditions.push({
                    OR: [
                        { categoriaId: categoryId },
                        {
                            subcategoria: {
                                parentId: categoryId
                            }
                        }
                    ]
                })
            }
        } else if (subcategoryId) {
            andConditions.push({ subcategoriaId: subcategoryId })
        }

        if (andConditions.length > 0) {
            whereClause.AND = andConditions
        }

        // Optimized: Use select to fetch only needed fields and add pagination with better defaults
        // const page = parseInt(searchParams.get('page') || '1')
        // const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Cap limit at 100 for performance
        // const offset = (page - 1) * limit

        const [productosRaw, totalCount] = await Promise.all([
            prisma.producto.findMany({
                where: whereClause,
                include: {
                    categoria: {
                        select: { catId: true, nombre: true }
                    },
                    subcategoria: {
                        select: { catId: true, nombre: true, parentId: true }
                    },
                    unidad: {
                        select: { simbolo: true }
                    },
                    vendor: {
                        select: { nombre: true }
                    },
                    almacen: {
                        select: { nombre: true}
                    }
                },
                orderBy: {
                    nombre: 'asc'
                },
            }),
            prisma.producto.count({ where: whereClause })
        ])

        // Calcular el stock total para cada producto incluyendo lo que hay en puntos de venta
        const productos = await Promise.all(productosRaw.map(async (producto: { id: string; stock: number }) => {
            // Calcular stock en puntos de venta (Transferencias entrada - Transferencias salida - Ventas)
            const [tEntrada, tSalida, ventasItems, ventasLegacy] = await Promise.all([
                prisma.transferencia.aggregate({
                    where: {
                        productoId: producto.id,
                        puntoDeVentaDestinoId: { not: null }
                    },
                    _sum: { cantidad: true }
                }),
                prisma.transferencia.aggregate({
                    where: {
                        productoId: producto.id,
                        puntoDeVentaOrigenId: { not: null }
                    },
                    _sum: { cantidad: true }
                }),
                prisma.ventaItem.aggregate({
                    where: {
                        productoId: producto.id,
                    },
                    _sum: { cantidad: true }
                }),
                prisma.venta.aggregate({
                    where: {
                        productoId: producto.id,
                        items: { none: {} }
                    },
                    _sum: { cantidad: true }
                })
            ])

            const ventasTotal = (ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0)
            const stockEnPVs = (tEntrada._sum.cantidad || 0) - (tSalida._sum.cantidad || 0) - ventasTotal
            
            return {
                ...producto,
                stock: producto.stock + Math.max(0, stockEnPVs)
            }
        }))

        return NextResponse.json({
            productos
        })
    } catch (error) {
        console.log('Error fetch:',error)
        return NextResponse.json({
            error: 'Failed to fetch products'
        },{
            status:500
        })
    }
})

export const POST = withAuthPost(async (req: NextRequest, context: any, user: any) => {
    
    try {
        const body = await req.json()
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
            precios, // Array of { listaPrecioId: string, precio: number }
            // Compound product fields
            esCompuesto,
            cantidadEnPack,
            nombreHijo,
            codigoNegocioHijo
        } = body
        
        // Validación de producto compuesto
        if (esCompuesto === true) {
            if (!cantidadEnPack || cantidadEnPack <= 0) {
                return NextResponse.json({
                    error: 'La cantidad en pack debe ser mayor a 0 para productos compuestos'
                }, {
                    status: 400
                })
            }

            if (!nombreHijo || nombreHijo.trim() === '') {
                return NextResponse.json({
                    error: 'El nombre del producto hijo es requerido para productos compuestos'
                }, {
                    status: 400
                })
            }

            if (!codigoNegocioHijo || codigoNegocioHijo.trim() === '') {
                return NextResponse.json({
                    error: 'El código de negocio del producto hijo es requerido para productos compuestos'
                }, {
                    status: 400
                })
            }

            // Validar que el código de negocio del hijo sea único
            const existingCodigoHijo = await prisma.producto.findFirst({
                where: { codigoNegocio: codigoNegocioHijo },
                select: { id: true }
            })

            if (existingCodigoHijo) {
                return NextResponse.json({
                    error: 'El código de negocio del producto hijo ya está asignado a otro producto'
                }, {
                    status: 409
                })
            }
        }
        
        // vendorId es opcional para registro directo de productos (inventario inicial)
        
        // Validate stockMinimo
        if (stockMinimo !== undefined && (typeof stockMinimo !== 'number' || stockMinimo < 0 || !Number.isInteger(stockMinimo))) {
            return NextResponse.json({
                error: 'El stock mínimo debe ser un número entero mayor o igual a 0'
            }, {
                status: 400
            })
        }

        if (codigoInterno !== undefined && codigoInterno !== null && typeof codigoInterno !== 'string') {
            return NextResponse.json({
                error: 'El código interno debe enviarse como texto'
            }, {
                status: 400
            })
        }

        const normalizedCodigoInterno = normalizeCodigoInterno(codigoInterno)
        let generatedBusinessCode: ReturnType<typeof generateEan13BusinessCode>
        try {
            generatedBusinessCode = generateEan13BusinessCode({
                proveedorCodigo,
                idSeccionCodigo,
                especificoCodigo,
                surtidoCodigo,
            })
        } catch (error) {
            return NextResponse.json({
                error: error instanceof Error ? error.message : 'Error validando segmentos EAN-13'
            }, { status: 400 })
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
                where: { codigoInterno: normalizedCodigoInterno },
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

        const existingCodigoNegocio = await prisma.producto.findFirst({
            where: { codigoNegocio: generatedBusinessCode.codigoNegocio },
            select: { id: true }
        })

        if (existingCodigoNegocio) {
            return NextResponse.json({
                error: 'El código de negocio EAN-13 ya está asignado a otro producto'
            }, {
                status: 409
            })
        }

        // Validate subcategory belongs to category if both are provided
        if (subcategoriaId && categoriaId) {
            const subcategoria = await prisma.categoria.findUnique({
                where: { catId: subcategoriaId },
                select: { parentId: true }
            })
            
            if (!subcategoria || subcategoria.parentId !== categoriaId) {
                return NextResponse.json({
                    error: 'La subcategoría debe pertenecer a la categoría seleccionada'
                }, {
                    status: 400
                })
            }
        }
        
        // Crear producto(s) compuesto(s) dentro de transacción
        const resultado = await prisma.$transaction(async (tx) => {
            // Crear producto padre (compuesto)
            const producto = await tx.producto.create({
                data: {
                    nombre,
                    descripcion,
                    codigoInterno: normalizedCodigoInterno,
                    codigoNegocio: generatedBusinessCode.codigoNegocio,
                    proveedorCodigo: generatedBusinessCode.segments.proveedorCodigo,
                    idSeccionCodigo: generatedBusinessCode.segments.idSeccionCodigo,
                    especificoCodigo: generatedBusinessCode.segments.especificoCodigo,
                    surtidoCodigo: generatedBusinessCode.segments.surtidoCodigo,
                    dcCodigo: generatedBusinessCode.dcCodigo,
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
                    // Campos de producto compuesto
                    esCompuesto: esCompuesto === true,
                    cantidadEnPack: cantidadEnPack || null,
                    precios: precios && Array.isArray(precios) ? {
                        create: precios.map((p: any) => ({
                            listaPrecioId: p.listaPrecioId,
                            precio: p.precio
                        }))
                    } : undefined
                }
            })

            // Si es compuesto, crear el producto hijo
            let productoHijo = null
            if (esCompuesto === true && cantidadEnPack && nombreHijo && codigoNegocioHijo) {
                // Calcular precio del hijo
                const precioVentaHijo = Math.round(precioVenta / cantidadEnPack)
                const precioCostoHijo = Math.round(precioCosto / cantidadEnPack)

                productoHijo = await tx.producto.create({
                    data: {
                        nombre: nombreHijo,
                        descripcion: `${nombre} (unidad)`,
                        codigoNegocio: codigoNegocioHijo,
                        proveedorCodigo: generatedBusinessCode.segments.proveedorCodigo,
                        idSeccionCodigo: generatedBusinessCode.segments.idSeccionCodigo,
                        especificoCodigo: generatedBusinessCode.segments.especificoCodigo,
                        surtidoCodigo: generatedBusinessCode.segments.surtidoCodigo,
                        dcCodigo: generatedBusinessCode.dcCodigo,
                        precioCosto: precioCostoHijo,
                        precioVenta: precioVentaHijo,
                        stock: 0, // El stock del hijo se gestiona independientemente
                        stockMinimo: 0,
                        fotos: fotos || [],
                        categoriaId,
                        subcategoriaId: subcategoriaId || null,
                        unidadId,
                        vendorId: vendorId || null,
                        almacenId,
                        // Campos que lo identifican como hijo
                        esCompuesto: false,
                        cantidadEnPack: cantidadEnPack,
                        productoPadreId: producto.id
                    }
                })
            }

            return { producto, productoHijo }
        })
        
        const producto = resultado.producto
        const productoHijo = resultado.productoHijo
        
     // Crear registro en gastos de compra cuando se añade un producto (solo si hay vendorId)
   if (stock > 0 && vendorId) {
   const now = new Date()
   const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
   await prisma.gastoCompra.create({
   data: {
       productoId: producto.id,
       vendorId: vendorId,
       cantidad: stock,
       precioUnitario: precioCosto,
       total: stock * precioCosto,
       fechaCompra: now,
       descripcion: `Compra inicial - ${nombre}`,
       periodo: periodo,
   },

   })
   }

     return NextResponse.json({
        producto,
        productoHijo
    }, { status: 201 })
    } catch (error) {
        console.log('Error al crear producto:',error)
        return NextResponse.json({
            error: 'Failed to create product'
        },{
            status:500
        })
    }
})
