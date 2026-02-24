import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../lib/prisma"
import { verify_token } from "../../../../lib/auth-utils"

import {
  RestockValidator,
  RestockApiErrorHandler
} from "../../../../lib/restock-validation"
import {
  RestockErrorFactory,
  type RestockSuccessResponse
} from "../../../../lib/restock-errors"
import { executeProductInstanceCreationWorkflow } from "../../../../lib/restock-utils"

export async function POST(request: NextRequest) {
  try {
    // JWT Authentication middleware integration
    const user = await verify_token(request)
    if (!user) {
      const authError = RestockErrorFactory.authenticationFailed()
      return RestockApiErrorHandler.handleSingleError(authError)
    }

    // Parse request body
    const body = await request.json()

    // Comprehensive validation using the error handling system
    const validation = await RestockValidator.validateCompleteRestockOperation(
      body,
      user as Record<string, unknown>
    )

    if (!validation.success) {
      return RestockApiErrorHandler.handleValidationErrors(validation.errors || [])
    }

    const { productoId, cantidad, precioCosto, precioVenta, descripcion, numeroFactura, facturaUrl, formaPago, estado, moneda, tasaCambio, montoConvertido, monedaOriginal, montoOriginal, cuentaId: cuentaIdParam } = validation.data!

    // Verify product exists and validate business rules
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: {
        categoria: true,
        unidad: true,
        vendor: true,
        almacen: true
      }
    })

    // Additional business rule validation with the product data
    const businessValidation = RestockValidator.validateBusinessRules(
      producto as Record<string, unknown> | null,
      validation.data!
    )

    if (!businessValidation.success) {
      return RestockApiErrorHandler.handleValidationErrors(businessValidation.errors || [])
    }

    // Execute the complete product instance creation workflow
    const workflowResult = executeProductInstanceCreationWorkflow({
      currentProduct: {
        id: producto!.id,
        nombre: producto!.nombre,
        descripcion: producto!.descripcion,
        precioCosto: producto!.precioCosto,
        precioVenta: producto!.precioVenta,
        stock: producto!.stock,
        fotos: producto!.fotos || [], // Include photos to inherit in new instance
        categoriaId: producto!.categoriaId,
        unidadId: producto!.unidadId,
        vendorId: producto!.vendorId,
        almacenId: producto!.almacenId,
        puntoDeVentaId: producto!.puntoDeVentaId,
      },
      restockQuantity: cantidad,
      newCostPrice: precioCosto,
      newSellingPrice: precioVenta,
    })

    // Validate calculation results
    const calculationValidation = RestockValidator.validateCalculations({
      newStock: workflowResult.originalProductUpdate.newStock,
      totalCost: cantidad * (precioCosto || producto!.precioCosto),
      weightedAverages: workflowResult.weightedAverages
    })

    if (!calculationValidation.success) {
      return RestockApiErrorHandler.handleValidationErrors(calculationValidation.errors || [])
    }

    // Use database transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: any) => {
      // Validate that the original product still exists and hasn't been modified
      const currentProduct = await tx.producto.findUnique({
        where: { id: productoId },
        select: { id: true, stock: true, precioCosto: true, precioVenta: true }
      })

      if (!currentProduct) {
        throw RestockErrorFactory.productNotFound(productoId)
      }

      // Check for concurrent modifications (optimistic locking)
      if (currentProduct.stock !== producto!.stock ||
        currentProduct.precioCosto !== producto!.precioCosto ||
        currentProduct.precioVenta !== producto!.precioVenta) {
        throw RestockErrorFactory.concurrentModification(productoId)
      }

      // Validate stock calculation
      const newStock = workflowResult.originalProductUpdate.newStock
      if (newStock < 0 || !Number.isInteger(newStock)) {
        throw RestockErrorFactory.calculationError("invalid_stock", { newStock, cantidad })
      }

      let updatedProducto
      let newProductInstance = null
      let gastoCompra
      let compraProducto
      let reconciliacionGasto: any = null
      let cuentaPorPagar: any = null

      if (workflowResult.needsNewInstance && workflowResult.newInstance) {
        // Create new product instance
        newProductInstance = await tx.producto.create({
          data: workflowResult.newInstance!.data,
          include: {
            categoria: true,
            unidad: true,
            vendor: true,
            almacen: true
          }
        })

        // Original product keeps its original prices - only fetch it
        updatedProducto = await tx.producto.findUnique({
          where: { id: productoId },
          include: {
            categoria: true,
            unidad: true,
            vendor: true,
            almacen: true
          }
        })

        // Create gastoCompra for the new instance
        const costPrice = precioCosto || newProductInstance.precioCosto
        const totalCost = cantidad * costPrice

        if (totalCost <= 0 || !Number.isFinite(totalCost)) {
          throw RestockErrorFactory.calculationError("invalid_total_cost", { totalCost, cantidad, costPrice })
        }

        const now = new Date()
        const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        gastoCompra = await tx.gastoCompra.create({
          data: {
            productoId: newProductInstance.id,
            vendorId: newProductInstance.vendorId,
            cantidad: cantidad,
            precioUnitario: costPrice,
            total: totalCost,
            fechaCompra: now,
            descripcion: descripcion || `Restock - ${newProductInstance.nombre}`,
            periodo: periodo,
            numeroFactura: numeroFactura || undefined
          },
          include: {
            producto: true,
            vendor: true
          }
        })

        // Create CompraProducto record for RESTOCK
        compraProducto = await tx.compraProducto.create({
          data: {
            productoId: newProductInstance.id,
            proveedorId: newProductInstance.vendorId,
            numeroFactura: numeroFactura || '',
            facturaUrl: facturaUrl || '',
            cantidad: cantidad,
            precioUnitario: costPrice,
            total: totalCost,
            formaPago: formaPago || 'PAGO_COMPLETO',
            estado: estado || 'PAGADA',
            tipoOperacion: 'RESTOCK',
            descripcion: descripcion || `Restock - ${newProductInstance.nombre}`,
            fechaCompra: now,
            gastoCompraId: gastoCompra.gastoCompraId
          }
        })

        // Handle payment method logic for new instance
        const formaPagoFinal = (formaPago || 'PAGO_COMPLETO').toUpperCase()
        const productoForPayment = newProductInstance

        console.log('[RESTOCK DEBUG] === NEW INSTANCE BLOCK ===')
        console.log('[RESTOCK DEBUG] formaPago received:', formaPago)
        console.log('[RESTOCK DEBUG] formaPagoFinal:', formaPagoFinal)
        
        // Reset variables to ensure clean state
        reconciliacionGasto = null
        cuentaPorPagar = null

        if (formaPagoFinal === 'PAGO_COMPLETO') {
          // Use provided account or fallback to default
          let cuentaId = cuentaIdParam

          if (!cuentaId) {
            // Get active tipoPago for fallback
            const tipoPago = await tx.tipoPago.findFirst({
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              select: { tipoId: true, cuentaDefecto: true }
            })

            if (!tipoPago) {
              throw RestockErrorFactory.createBaseError(
                'INTERNAL_SERVER_ERROR' as any,
                'No hay tipos de pago activos disponibles',
                'HIGH' as any
              )
            }

            // Get active bank account from tipoPago or fallback
            cuentaId = tipoPago.cuentaDefecto
            if (!cuentaId) {
              const cuentaFallback = await tx.cuentaBancaria.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { cuentaId: true }
              })
              cuentaId = cuentaFallback?.cuentaId
            }
          }

          // Verify account exists and is active
          if (!cuentaId) {
            throw RestockErrorFactory.createBaseError(
              'INTERNAL_SERVER_ERROR' as any,
              'No hay cuentas bancarias activas disponibles',
              'HIGH' as any
            )
          }

          const cuentaBancaria = await tx.cuentaBancaria.findUnique({
            where: { cuentaId },
            select: { cuentaId: true, isActive: true, moneda: true, tipoPagoId: true }
          })

          if (!cuentaBancaria || !cuentaBancaria.isActive) {
            throw RestockErrorFactory.createBaseError(
              'BAD_REQUEST' as any,
              'La cuenta bancaria seleccionada no está activa',
              'HIGH' as any
            )
          }

          // Get tipoPago from account or fallback
          let tipoPagoId = cuentaBancaria.tipoPagoId
          if (!tipoPagoId) {
            const tipoPago = await tx.tipoPago.findFirst({
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              select: { tipoId: true }
            })
            tipoPagoId = tipoPago?.tipoId
          }

          // Create reconciliacionGasto for full payment
          console.log('[RESTOCK DEBUG] Creating reconciliacionGasto for PAGO_COMPLETO...')
          
          // Determine moneda and monto based on exchange rate data
          const reconciliacionMoneda = (monedaOriginal && monedaOriginal !== 'CUP') ? monedaOriginal : 'CUP'
          const reconciliacionMonto = (montoOriginal && monedaOriginal && monedaOriginal !== 'CUP') ? montoOriginal : totalCost
          const reconciliacionTasaCambio = (tasaCambio && monedaOriginal && monedaOriginal !== 'CUP') ? tasaCambio : null
          const reconciliacionMontoConvertido = (montoConvertido && monedaOriginal && monedaOriginal !== 'CUP') ? montoConvertido : null
          
          console.log('[RESTOCK DEBUG] Currency info:', { reconciliacionMoneda, reconciliacionMonto, reconciliacionTasaCambio, montoOriginal, totalCost })
          
          reconciliacionGasto = await tx.reconciliacionGasto.create({
            data: {
              tipoGasto: 'compra',
              referenciaId: gastoCompra.gastoCompraId,
              cuentaId: cuentaId,
              tipoPagoId: tipoPagoId,
              gastoCompraId: gastoCompra.gastoCompraId,
              monto: reconciliacionMonto,
              moneda: reconciliacionMoneda,
              tasaCambio: reconciliacionTasaCambio,
              montoConvertido: reconciliacionMontoConvertido,
              descripcion: `Restock pagado - ${productoForPayment.nombre}`,
              periodo: periodo,
              estado: 'PAGADA',
              reconciliadoPor: (user as any).userId || 'system'
            }
          })
          console.log('[RESTOCK DEBUG] reconciliacionGasto created:', reconciliacionGasto.reconciliacionId)

          // Update cuenta bancaria saldo - use converted amount if different currency
          const saldoADescontar = (montoConvertido && monedaOriginal && monedaOriginal !== 'CUP') ? montoConvertido : totalCost
          await tx.cuentaBancaria.update({
            where: { cuentaId: cuentaId },
            data: {
              saldo: {
                decrement: saldoADescontar
              }
            }
          })

        } else if (formaPagoFinal === 'PAGO_PARCIAL') {
          console.log('[RESTOCK DEBUG] Entering PAGO_PARCIAL block - creating cuentaPorPagar')
          // Create cuentaPorPagar for partial payment
          // Determine moneda for cuenta por pagar
          const cuentaPorPagarMoneda = (monedaOriginal && monedaOriginal !== 'CUP') ? monedaOriginal : 'CUP'
          const cuentaPorPagarMonto = (montoOriginal && monedaOriginal && monedaOriginal !== 'CUP') ? montoOriginal : totalCost
          
          cuentaPorPagar = await tx.cuentaPorPagar.create({
            data: {
              numeroFactura: numeroFactura || `RESTOCK-${now.getTime()}`,
              tipo: 'compra',
              gastoCompraId: gastoCompra.gastoCompraId,
              proveedorId: productoForPayment.vendorId,
              proveedorNombre: productoForPayment.vendor?.nombre || 'Proveedor no especificado',
              montoDeuda: cuentaPorPagarMonto,
              montoPagado: 0,
              saldoPendiente: cuentaPorPagarMonto,
              moneda: cuentaPorPagarMoneda,
              fechaEmision: now,
              estado: 'PENDIENTE'
            }
          })
          console.log('[RESTOCK DEBUG] cuentaPorPagar created:', cuentaPorPagar.cuentaPorPagarId)

          // Update compraProducto with cuentaPorPagar reference
          await tx.compraProducto.update({
            where: { compraProductoId: compraProducto.compraProductoId },
            data: {
              cuentaPorPagarId: cuentaPorPagar.cuentaPorPagarId
            }
          })
          console.log('[RESTOCK DEBUG] compraProducto updated with cuentaPorPagarId')
        } else {
          console.log('[RESTOCK DEBUG] WARNING: formaPagoFinal is not PAGO_COMPLETO or PAGO_PARCIAL:', formaPagoFinal)
        }
      } else {
        // Update original product stock, and prices only if explicitly changed
        if (precioCosto !== undefined || precioVenta !== undefined) {
          updatedProducto = await tx.producto.update({
            where: { id: productoId },
            data: {
              stock: workflowResult.originalProductUpdate.newStock,
              precioCosto: workflowResult.originalProductUpdate.newPrecioCosto,
              precioVenta: workflowResult.originalProductUpdate.newPrecioVenta,
            },
            include: {
              categoria: true,
              unidad: true,
              vendor: true,
              almacen: true
            }
          })
        } else {
          updatedProducto = await tx.producto.update({
            where: { id: productoId },
            data: {
              stock: workflowResult.originalProductUpdate.newStock,
            },
            include: {
              categoria: true,
              unidad: true,
              vendor: true,
              almacen: true
            }
          })
        }

        // Create gastoCompra for the original product
        const costPrice = precioCosto || producto!.precioCosto
        const totalCost = cantidad * costPrice

        if (totalCost <= 0 || !Number.isFinite(totalCost)) {
          throw RestockErrorFactory.calculationError("invalid_total_cost", { totalCost, cantidad, costPrice })
        }

        const now = new Date()
        const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        gastoCompra = await tx.gastoCompra.create({
          data: {
            productoId: producto!.id,
            vendorId: producto!.vendorId,
            cantidad: cantidad,
            precioUnitario: costPrice,
            total: totalCost,
            fechaCompra: now,
            descripcion: descripcion || `Restock - ${producto!.nombre}`,
            periodo: periodo,
            numeroFactura: numeroFactura || undefined
          },
          include: {
            producto: true,
            vendor: true
          }
        })

        // Create CompraProducto record for RESTOCK
        compraProducto = await tx.compraProducto.create({
          data: {
            productoId: producto!.id,
            proveedorId: producto!.vendorId,
            numeroFactura: numeroFactura || '',
            facturaUrl: facturaUrl || '',
            cantidad: cantidad,
            precioUnitario: costPrice,
            total: totalCost,
            formaPago: formaPago || 'PAGO_COMPLETO',
            estado: estado || 'PAGADA',
            tipoOperacion: 'RESTOCK',
            descripcion: descripcion || `Restock - ${producto!.nombre}`,
            fechaCompra: now,
            gastoCompraId: gastoCompra.gastoCompraId
          }
        })

        // Handle payment method logic
        const formaPagoFinal = (formaPago || 'PAGO_COMPLETO').toUpperCase()

        console.log('[RESTOCK DEBUG] === ELSE BLOCK (original product) ===')
        console.log('[RESTOCK DEBUG] formaPago received:', formaPago)
        console.log('[RESTOCK DEBUG] formaPagoFinal:', formaPagoFinal)

        // Reset variables to ensure clean state
        reconciliacionGasto = null
        cuentaPorPagar = null

        if (formaPagoFinal === 'PAGO_COMPLETO') {
          console.log('[RESTOCK DEBUG] Entering PAGO_COMPLETO block - creating reconciliacionGasto')
          // Use provided account or fallback to default
          let cuentaId = cuentaIdParam

          if (!cuentaId) {
            // Get active tipoPago for fallback
            const tipoPago = await tx.tipoPago.findFirst({
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              select: { tipoId: true, cuentaDefecto: true }
            })

            if (!tipoPago) {
              throw RestockErrorFactory.createBaseError(
                'INTERNAL_SERVER_ERROR' as any,
                'No hay tipos de pago activos disponibles',
                'HIGH' as any
              )
            }

            // Get active bank account from tipoPago or fallback
            cuentaId = tipoPago.cuentaDefecto
            if (!cuentaId) {
              const cuentaFallback = await tx.cuentaBancaria.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
                select: { cuentaId: true }
              })
              cuentaId = cuentaFallback?.cuentaId
            }
          }

          // Verify account exists and is active
          if (!cuentaId) {
            throw RestockErrorFactory.createBaseError(
              'INTERNAL_SERVER_ERROR' as any,
              'No hay cuentas bancarias activas disponibles',
              'HIGH' as any
            )
          }

          const cuentaBancaria = await tx.cuentaBancaria.findUnique({
            where: { cuentaId },
            select: { cuentaId: true, isActive: true, moneda: true, tipoPagoId: true }
          })

          if (!cuentaBancaria || !cuentaBancaria.isActive) {
            throw RestockErrorFactory.createBaseError(
              'BAD_REQUEST' as any,
              'La cuenta bancaria seleccionada no está activa',
              'HIGH' as any
            )
          }

          // Get tipoPago from account or fallback
          let tipoPagoId = cuentaBancaria.tipoPagoId
          if (!tipoPagoId) {
            const tipoPago = await tx.tipoPago.findFirst({
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
              select: { tipoId: true }
            })
            tipoPagoId = tipoPago?.tipoId
          }

          // Create reconciliacionGasto for full payment
          console.log('[RESTOCK DEBUG] ELSE BLOCK: Creating reconciliacionGasto for PAGO_COMPLETO...')
          // Determine moneda and monto based on exchange rate data
          const reconciliacionMoneda = (monedaOriginal && monedaOriginal !== 'CUP') ? monedaOriginal : 'CUP'
          const reconciliacionMonto = (montoOriginal && monedaOriginal && monedaOriginal !== 'CUP') ? montoOriginal : totalCost
          const reconciliacionTasaCambio = (tasaCambio && monedaOriginal && monedaOriginal !== 'CUP') ? tasaCambio : null
          const reconciliacionMontoConvertido = (montoConvertido && monedaOriginal && monedaOriginal !== 'CUP') ? montoConvertido : null

          reconciliacionGasto = await tx.reconciliacionGasto.create({
            data: {
              tipoGasto: 'compra',
              referenciaId: gastoCompra.gastoCompraId,
              cuentaId: cuentaId,
              tipoPagoId: tipoPagoId,
              gastoCompraId: gastoCompra.gastoCompraId,
              monto: reconciliacionMonto,
              moneda: reconciliacionMoneda,
              tasaCambio: reconciliacionTasaCambio,
              montoConvertido: reconciliacionMontoConvertido,
              descripcion: `Restock pagado - ${producto!.nombre}`,
              periodo: periodo,
              estado: 'PAGADA',
              reconciliadoPor: (user as any).userId || 'system'
            }
          })
          console.log('[RESTOCK DEBUG] ELSE BLOCK: reconciliacionGasto created:', reconciliacionGasto.reconciliacionId)

          // Update cuenta bancaria saldo - use converted amount if different currency
          const saldoADescontar = (montoConvertido && monedaOriginal && monedaOriginal !== 'CUP') ? montoConvertido : totalCost
          await tx.cuentaBancaria.update({
            where: { cuentaId: cuentaId },
            data: {
              saldo: {
                decrement: saldoADescontar
              }
            }
          })

        } else if (formaPagoFinal === 'PAGO_PARCIAL') {
          console.log('[RESTOCK DEBUG] ELSE BLOCK: Entering PAGO_PARCIAL block - creating cuentaPorPagar')
          // Determine moneda for cuenta por pagar
          const cuentaPorPagarMoneda = (monedaOriginal && monedaOriginal !== 'CUP') ? monedaOriginal : 'CUP'
          const cuentaPorPagarMonto = (montoOriginal && monedaOriginal && monedaOriginal !== 'CUP') ? montoOriginal : totalCost
          
          // Create cuentaPorPagar for partial payment
          cuentaPorPagar = await tx.cuentaPorPagar.create({
            data: {
              numeroFactura: numeroFactura || `RESTOCK-${now.getTime()}`,
              tipo: 'compra',
              gastoCompraId: gastoCompra.gastoCompraId,
              proveedorId: producto!.vendorId,
              proveedorNombre: producto!.vendor?.nombre || 'Proveedor no especificado',
              montoDeuda: cuentaPorPagarMonto,
              montoPagado: 0,
              saldoPendiente: cuentaPorPagarMonto,
              moneda: cuentaPorPagarMoneda,
              fechaEmision: now,
              estado: 'PENDIENTE'
            }
          })
          console.log('[RESTOCK DEBUG] ELSE BLOCK: cuentaPorPagar created:', cuentaPorPagar.cuentaPorPagarId)

          // Update compraProducto with cuentaPorPagar reference
          await tx.compraProducto.update({
            where: { compraProductoId: compraProducto.compraProductoId },
            data: {
              cuentaPorPagarId: cuentaPorPagar.cuentaPorPagarId
            }
          })
          console.log('[RESTOCK DEBUG] ELSE BLOCK: compraProducto updated with cuentaPorPagarId')
        } else {
          console.log('[RESTOCK DEBUG] ELSE BLOCK: WARNING: formaPagoFinal is not PAGO_COMPLETO or PAGO_PARCIAL:', formaPagoFinal)
        }
      }

      // Validate that all operations completed successfully
      if (!updatedProducto || !gastoCompra) {
        throw RestockErrorFactory.transactionFailed({
          missingData: { updatedProducto: !!updatedProducto, gastoCompra: !!gastoCompra }
        })
      }

      console.log('[RESTOCK DEBUG] Final state before return:')
      console.log('[RESTOCK DEBUG] reconciliacionGasto:', reconciliacionGasto ? reconciliacionGasto.reconciliacionId : null)
      console.log('[RESTOCK DEBUG] cuentaPorPagar:', cuentaPorPagar ? cuentaPorPagar.cuentaPorPagarId : null)

      return {
        updatedProducto,
        gastoCompra,
        newProductInstance,
        workflowResult,
        compraProducto,
        reconciliacionGasto,
        cuentaPorPagar
      }


    }, {
      // Transaction options for better control
      maxWait: 5000, // Maximum time to wait for a transaction slot (5 seconds)
      timeout: 10000, // Maximum time the transaction can run (10 seconds)
      isolationLevel: 'ReadCommitted' // Ensure read committed isolation level
    })

    const pricesChanged = (precioCosto !== undefined && precioCosto !== producto!.precioCosto) || (precioVenta !== undefined && precioVenta !== producto!.precioVenta)

    const successResponse: RestockSuccessResponse = {
      success: true,
      message: "Product restocked successfully",
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
          reason: result.workflowResult.reason
        },
        weightedAverages: {
          precioCosto: result.workflowResult.weightedAverages.costPrice.weightedAverage,
          precioVenta: result.workflowResult.weightedAverages.sellingPrice.weightedAverage
        }
      },
      requestId: RestockErrorFactory.generateRequestId()
    }

    return NextResponse.json(successResponse, { status: 200 })

  } catch (error) {
    console.error("[RESTOCK_POST]", error)

    // Use the comprehensive error handling system
    return RestockApiErrorHandler.handleUnknownError(error, {
      operation: 'restock'
    })
  }
}