import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";
import { authenticateUser } from "@/lib/auth-middleware";
import { AuditLogService } from "@/lib/services/audit-log-service";

const pagoDeudaSchema = z.object({
  montoPagado: z.number().positive("El monto debe ser positivo"),
  cuentaId: z.string().min(1, "La cuenta bancaria es requerida"),
  comprobante: z.string().optional(),
  observaciones: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params;
    const body = await request.json();
    const validatedData = pagoDeudaSchema.parse(body);

    // Verify Injection exists and is eligible for payment
    const inyeccion = await prisma.inyeccionCapital.findUnique({
      where: { id },
      include: { pagos: true }
    });

    if (!inyeccion) {
      return NextResponse.json({ error: "Inyección de capital no encontrada" }, { status: 404 });
    }

    if (inyeccion.tipo !== "DEUDA_EXTERNA") {
      return NextResponse.json({ error: "Solo se pueden registrar pagos para deuda externa" }, { status: 400 });
    }

    if (inyeccion.estado === "PAGADA") {
      return NextResponse.json({ error: "Esta deuda ya está pagada" }, { status: 400 });
    }

    // Check bank account balance
    const cuenta = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: validatedData.cuentaId }
    });

    if (!cuenta) {
      return NextResponse.json({ error: "Cuenta bancaria no encontrada" }, { status: 404 });
    }

    if (cuenta.saldo < validatedData.montoPagado) {
      return NextResponse.json({ error: "Saldo insuficiente en la cuenta bancaria" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create Payment Record
      const pago = await tx.pagoDeuda.create({
        data: {
          inyeccionId: id,
          montoPagado: validatedData.montoPagado,
          cuentaId: validatedData.cuentaId,
          comprobante: validatedData.comprobante,
          observaciones: validatedData.observaciones,
          numeroCuota: inyeccion.pagos.length + 1
        }
      });

      // 2. Update Bank Account (Decrease Balance)
      await tx.cuentaBancaria.update({
        where: { cuentaId: validatedData.cuentaId },
        data: {
          saldo: {
            decrement: validatedData.montoPagado
          }
        }
      });

      // 3. Update Injection (Decrease Pending Balance and Check Status)
      const currentSaldoPendiente = Number(inyeccion.saldoPendiente);
      const newSaldoPendiente = currentSaldoPendiente - validatedData.montoPagado;
      const isPaid = newSaldoPendiente <= 0;

      await tx.inyeccionCapital.update({
        where: { id },
        data: {
          saldoPendiente: newSaldoPendiente,
          estado: isPaid ? "PAGADA" : "ACTIVA"
        }
      });

      return pago;
    });

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "CREATE",
      entidad: "PAGO_DEUDA",
      entidadId: result.id,
      usuarioId: user.userId,
      detalles: {
        inyeccionId: id,
        monto: result.montoPagado,
        cuentaId: result.cuentaId,
        numeroCuota: result.numeroCuota,
        entidadPrestamista: inyeccion.entidadPrestamista
      }
    });

    return NextResponse.json({ pago: result }, { status: 201 });
  } catch (error) {
    console.error('Error al registrar pago de deuda:', error);
    
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
      error: 'Error al registrar pago de deuda',
      code: 'CREATE_PAYMENT_ERROR'
    }, {
      status: 500
    });
  }
}
