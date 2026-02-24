import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { verify_token } from "@/lib/auth-utils";
import { AuditLogService } from "@/lib/services/audit-log-service";

// Schema for validating bank account creation/update
const cuentaBancariaSchema = z.object({
  nombreBanco: z.string().min(1, "El nombre del banco es requerido"),
  numeroCuenta: z.string().min(1, "El número de cuenta es requerido"),
  tipoCuenta: z.string().min(1, "El tipo de cuenta es requerido").optional(),
  saldo: z.number().min(0, "El saldo no puede ser negativo").optional().default(0),
  moneda: z.string().optional().default("CUP"),
  isActive: z.boolean().optional()
});

// GET /api/contabilidad/cuentas - List all bank accounts
export async function GET() {
  try {
    const cuentas = await prisma.cuentaBancaria.findMany({
      include: {
        reconciliacionesVenta: {
          select: {
            reconciliacionId: true,
            monto: true,
            fechaReconciliacion: true
          }
        },
        reconciliacionesServicio: {
          select: {
            reconciliacionId: true,
            monto: true,
            fechaReconciliacion: true
          }
        },
        reconciliacionesGasto: {
          select: {
            reconciliacionId: true,
            monto: true,
            fechaReconciliacion: true
          }
        },
        ajustes: {
          select: {
            ajusteId: true,
            tipo: true,
            monto: true,
            createdAt: true
          }
        },
        transferenciasOrigen: {
          select: {
            transferenciaId: true,
            montoOrigen: true,
            fechaTransferencia: true
          }
        },
        transferenciasDestino: {
          select: {
            transferenciaId: true,
            montoDestino: true,
            fechaTransferencia: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ cuentas });
  } catch (error) {
    console.error('Error al obtener cuentas bancarias:', error);
    return NextResponse.json({
      error: 'Error al obtener cuentas bancarias',
      code: 'FETCH_ACCOUNTS_ERROR'
    }, {
      status: 500
    });
  }
}

// POST /api/contabilidad/cuentas - Create new bank account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input data
    const validatedData = cuentaBancariaSchema.parse(body);

    // Check if account number already exists
    const existingAccount = await prisma.cuentaBancaria.findUnique({
      where: { numeroCuenta: validatedData.numeroCuenta }
    });

    if (existingAccount) {
      return NextResponse.json({
        error: 'Ya existe una cuenta con este número',
        code: 'ACCOUNT_NUMBER_EXISTS'
      }, {
        status: 400
      });
    }

    // Create new bank account
    const user = await verify_token(request);
    const nuevaCuenta = await prisma.cuentaBancaria.create({
      data: {
        nombreBanco: validatedData.nombreBanco,
        numeroCuenta: validatedData.numeroCuenta,
        tipoCuenta: validatedData.tipoCuenta || "",
        saldo: validatedData.saldo || 0,
        moneda: validatedData.moneda || "CUP",
        isActive: validatedData.isActive ?? true
      }
    });

    if (user) {
      await AuditLogService.log({
        accion: "CREATE",
        entidad: "CUENTA_BANCARIA",
        entidadId: nuevaCuenta.cuentaId,
        usuarioId: user.userId,
        detalles: {
          nombreBanco: nuevaCuenta.nombreBanco,
          numeroCuenta: nuevaCuenta.numeroCuenta,
          saldoInicial: nuevaCuenta.saldo,
          moneda: nuevaCuenta.moneda
        }
      });
    }

    return NextResponse.json({ cuenta: nuevaCuenta }, { status: 201 });
  } catch (error) {
    console.error('Error al crear cuenta bancaria:', error);
    
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
      error: 'Error al crear cuenta bancaria',
      code: 'CREATE_ACCOUNT_ERROR'
    }, {
      status: 500
    });
  }
}