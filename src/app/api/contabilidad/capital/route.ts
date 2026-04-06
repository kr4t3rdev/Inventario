import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";
import { authenticateUser } from "@/lib/auth-middleware";
import { AuditLogService } from "@/lib/services/audit-log-service";

// Schema for validating capital injection
const inyeccionCapitalSchema = z.object({
  tipo: z.enum(["CAPITAL_SOCIAL", "DEUDA_EXTERNA"]),
  montoRecibido: z.number().positive("El monto debe ser positivo"),
  moneda: z.string().default("CUP"),
  cuentaId: z.string().min(1, "La cuenta bancaria es requerida"),
  descripcion: z.string().optional(),
  
  // Specific fields based on type
  socio: z.string().optional(),
  
  entidadPrestamista: z.string().optional(),
  tasaInteres: z.number().min(0).optional(),
  plazoMeses: z.number().int().positive().optional(),
  fechaInicioPago: z.string().optional().transform(str => str ? new Date(str) : undefined),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get("tipo");
    
    const whereClause: any = {};
    if (tipo) {
      whereClause.tipo = tipo;
    }

    const inyecciones = await prisma.inyeccionCapital.findMany({
      where: whereClause,
      include: {
        cuentaBancaria: {
          select: {
            nombreBanco: true,
            numeroCuenta: true,
            moneda: true
          }
        },
        pagos: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ inyecciones });
  } catch (error) {
    console.error('Error al obtener inyecciones de capital:', error);
    return NextResponse.json({
      error: 'Error al obtener inyecciones de capital',
      code: 'FETCH_INJECTIONS_ERROR'
    }, {
      status: 500
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json();
    const validatedData = inyeccionCapitalSchema.parse(body);

    // Calculate derived fields for debt
    let montoInteres = 0;
    let montoTotalDeuda = 0;
    let saldoPendiente = 0;

    if (validatedData.tipo === "DEUDA_EXTERNA") {
      if (!validatedData.entidadPrestamista) {
        return NextResponse.json({ error: "La entidad prestamista es requerida para deuda externa" }, { status: 400 });
      }
      
      const tasa = validatedData.tasaInteres || 0;
      // Simple interest calculation: Principal * (Rate/100)
      // Note: The requirement didn't specify interest formula (simple vs compound, per month or year).
      // Assuming flat interest percentage on total amount for simplicity as per "Monto Principal + Intereses Totales" implication
      montoInteres = validatedData.montoRecibido * (tasa / 100);
      montoTotalDeuda = validatedData.montoRecibido + montoInteres;
      saldoPendiente = montoTotalDeuda;
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create Injection Record
      const inyeccion = await tx.inyeccionCapital.create({
        data: {
          tipo: validatedData.tipo,
          montoRecibido: validatedData.montoRecibido,
          moneda: validatedData.moneda,
          cuentaId: validatedData.cuentaId,
          descripcion: validatedData.descripcion,
          
          socio: validatedData.socio,
          
          entidadPrestamista: validatedData.entidadPrestamista,
          tasaInteres: validatedData.tasaInteres,
          montoInteres: validatedData.tipo === "DEUDA_EXTERNA" ? montoInteres : null,
          montoTotalDeuda: validatedData.tipo === "DEUDA_EXTERNA" ? montoTotalDeuda : null,
          saldoPendiente: validatedData.tipo === "DEUDA_EXTERNA" ? saldoPendiente : null,
          plazoMeses: validatedData.plazoMeses,
          fechaInicioPago: validatedData.fechaInicioPago,
          
          estado: validatedData.tipo === "DEUDA_EXTERNA" ? "ACTIVA" : null,
        }
      });

      // 2. Update Bank Account Balance
      await tx.cuentaBancaria.update({
        where: { cuentaId: validatedData.cuentaId },
        data: {
          saldo: {
            increment: validatedData.montoRecibido
          }
        }
      });
      
      // 3. Create Bank Adjustment (optional but good for tracking history in AjusteBancario table if that's the source of truth for movements)
      // However, the prompt says "Actualiza saldo de CuentaBancaria" directly. 
      // Looking at `cuenta-bancaria-form.tsx` it mentions "El saldo se actualiza automáticamente con las transacciones".
      // Usually there is a movement log. In this system, `InyeccionCapital` acts as the log itself for this type of transaction.
      // But `AjusteBancario` seems to be for manual adjustments. 
      // I'll stick to updating the balance directly as requested.
      
      return inyeccion;
    });

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "CREATE",
      entidad: "INYECCION_CAPITAL",
      entidadId: result.id,
      usuarioId: user.userId,
      detalles: {
        tipo: result.tipo,
        monto: result.montoRecibido,
        moneda: result.moneda,
        cuentaId: result.cuentaId,
        socio: result.socio,
        entidadPrestamista: result.entidadPrestamista
      }
    });

    return NextResponse.json({ inyeccion: result }, { status: 201 });
  } catch (error) {
    console.error('Error al registrar inyección de capital:', error);
    
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
      error: 'Error al registrar inyección de capital',
      code: 'CREATE_INJECTION_ERROR'
    }, {
      status: 500
    });
  }
}
