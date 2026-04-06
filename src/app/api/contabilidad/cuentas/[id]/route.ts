import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { authenticateUser } from "@/lib/auth-middleware";
import { AuditLogService } from "@/lib/services/audit-log-service";

// Schema for validating bank account updates
const updateCuentaBancariaSchema = z.object({
  nombreBanco: z.string().min(1, "El nombre del banco es requerido").optional(),
  tipoCuenta: z.string().min(1, "El tipo de cuenta es requerido").optional(),
  saldo: z.number().min(0, "El saldo no puede ser negativo").optional(),
  moneda: z.string().optional(),
  isActive: z.boolean().optional()
});

// GET /api/contabilidad/cuentas/[id] - Get specific bank account
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const cuenta = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: id },
      include: {
        reconciliacionesVenta: {
          include: {
            venta: {
              select: {
                ventaId: true,
                total: true,
                createdAt: true,
                puntoDeVenta: {
                  select: {
                    nombre: true
                  }
                }
              }
            },
            tipoPago: {
              select: {
                nombre: true
              }
            }
          },
          orderBy: {
            fechaReconciliacion: 'desc'
          }
        },
        reconciliacionesServicio: {
          include: {
            
            tipoPago: {
              select: {
                nombre: true
              }
            }
          },
          orderBy: {
            fechaReconciliacion: 'desc'
          }
        },
        reconciliacionesGasto: {
          include: {
            tipoPago: {
              select: {
                nombre: true
              }
            }
          },
          orderBy: {
            fechaReconciliacion: 'desc'
          }
        },
        ajustes: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        transferenciasOrigen: {
          include: {
            cuentaDestino: {
              select: {
                nombreBanco: true,
                numeroCuenta: true
              }
            }
          },
          orderBy: {
            fechaTransferencia: 'desc'
          }
        },
        transferenciasDestino: {
          include: {
            cuentaOrigen: {
              select: {
                nombreBanco: true,
                numeroCuenta: true
              }
            }
          },
          orderBy: {
            fechaTransferencia: 'desc'
          }
        }
      }
    });

    if (!cuenta) {
      return NextResponse.json({ 
        error: "Cuenta bancaria no encontrada",
        code: "ACCOUNT_NOT_FOUND"
      }, { 
        status: 404 
      });
    }

    return NextResponse.json(cuenta);
  } catch (error) {
    console.error("Error al obtener cuenta bancaria:", error);
    return NextResponse.json({ 
      error: "Error al obtener cuenta bancaria",
      code: "FETCH_ACCOUNT_ERROR"
    }, { 
      status: 500 
    });
  }
}

// PUT /api/contabilidad/cuentas/[id] - Update bank account
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await context.params;
    const body = await request.json();

    // Prevent updating account number for security reasons
    if (body.numeroCuenta !== undefined) {
      return NextResponse.json({
        error: 'No se puede modificar el número de cuenta',
        code: 'CANNOT_UPDATE_ACCOUNT_NUMBER'
      }, {
        status: 400
      });
    }

    // Validate input data
    const validatedData = updateCuentaBancariaSchema.parse(body);

    // Check if account exists
    const existingAccount = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: id }
    });

    if (!existingAccount) {
      return NextResponse.json({
        error: "Cuenta bancaria no encontrada",
        code: "ACCOUNT_NOT_FOUND"
      }, {
        status: 404
      });
    }

    // Update bank account (note: numeroCuenta cannot be updated for security)
    const cuentaActualizada = await prisma.cuentaBancaria.update({
      where: { cuentaId: id },
      data: validatedData
    });

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "UPDATE",
      entidad: "CUENTA_BANCARIA",
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        cambios: validatedData,
        nombreBanco: existingAccount.nombreBanco,
        numeroCuenta: existingAccount.numeroCuenta
      }
    });

    return NextResponse.json(cuentaActualizada);
  } catch (error) {
    console.error("Error al actualizar cuenta bancaria:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: error.errors
      }, {
        status: 400
      });
    }

    return NextResponse.json({ 
      error: "Error al actualizar cuenta bancaria",
      code: "UPDATE_ACCOUNT_ERROR"
    }, { 
      status: 500 
    });
  }
}

// DELETE /api/contabilidad/cuentas/[id] - Delete bank account with validation
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await context.params;
    // Check if account exists
    const existingAccount = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: id }
    });

    if (!existingAccount) {
      return NextResponse.json({
        error: "Cuenta bancaria no encontrada",
        code: "ACCOUNT_NOT_FOUND"
      }, {
        status: 404
      });
    }

    // Check if account has any movements (reconciliations, adjustments, or transfers)
    const [
      reconciliacionesVenta,
      reconciliacionesServicio, 
      reconciliacionesGasto,
      ajustes,
      transferenciasOrigen,
      transferenciasDestino
    ] = await Promise.all([
      prisma.reconciliacionVenta.count({ where: { cuentaId: id } }),
      prisma.reconciliacionServicio.count({ where: { cuentaId: id } }),
      prisma.reconciliacionGasto.count({ where: { cuentaId: id } }),
      prisma.ajusteBancario.count({ where: { cuentaId: id } }),
      prisma.transferenciaBancaria.count({ where: { cuentaOrigenId: id } }),
      prisma.transferenciaBancaria.count({ where: { cuentaDestinoId: id } })
    ]);

    const totalMovements = reconciliacionesVenta + reconciliacionesServicio + 
                          reconciliacionesGasto + ajustes + 
                          transferenciasOrigen + transferenciasDestino;

    if (totalMovements > 0) {
      return NextResponse.json({
        error: "No se puede eliminar la cuenta porque tiene movimientos asociados",
        code: "ACCOUNT_HAS_MOVEMENTS",
        details: {
          reconciliacionesVenta,
          reconciliacionesServicio,
          reconciliacionesGasto,
          ajustes,
          transferenciasOrigen,
          transferenciasDestino,
          totalMovements
        }
      }, {
        status: 400
      });
    }

    // Delete the account
    await prisma.cuentaBancaria.delete({
      where: { cuentaId: id }
    });

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "DELETE",
      entidad: "CUENTA_BANCARIA",
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        nombreBanco: existingAccount.nombreBanco,
        numeroCuenta: existingAccount.numeroCuenta,
        saldo: existingAccount.saldo,
        moneda: existingAccount.moneda
      }
    });

    return NextResponse.json({ 
      success: true, 
      id: id,
      message: "Cuenta bancaria eliminada exitosamente"
    });
  } catch (error) {
    console.error("Error al eliminar cuenta bancaria:", error);
    return NextResponse.json({ 
      error: "Error al eliminar cuenta bancaria",
      code: "DELETE_ACCOUNT_ERROR"
    }, { 
      status: 500 
    });
  }
}
