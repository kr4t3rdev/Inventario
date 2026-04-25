import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

// Schema de validación para crear ajuste bancario
const createAjusteSchema = z.object({
  cuentaId: z.string().min(1, 'ID de cuenta es requerido'),
  tipo: z.enum(['ingreso', 'egreso'], {
    errorMap: () => ({ message: 'Tipo debe ser "ingreso" o "egreso"' })
  }),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  moneda: z.string().min(1, 'Moneda es requerida').default('CUP'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  motivo: z.string().min(1, 'Motivo es obligatorio')
})

export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const validatedData = createAjusteSchema.parse(body)

    await assertOperationAllowed(new Date(), 'AJUSTE_BANCARIO')

    // Verificar que la cuenta bancaria existe y está activa
    const cuentaBancaria = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: validatedData.cuentaId }
    })

    if (!cuentaBancaria) {
      return NextResponse.json(
        { error: 'Cuenta bancaria no encontrada', code: 'CUENTA_NO_ENCONTRADA' },
        { status: 404 }
      )
    }

    if (!cuentaBancaria.isActive) {
      return NextResponse.json(
        { error: 'La cuenta bancaria está inactiva', code: 'CUENTA_INACTIVA' },
        { status: 400 }
      )
    }

    // Para ajustes bancarios, no se realiza conversión de moneda
    // El monto se aplica directamente en la moneda de la cuenta
    const tasaCambioFinal = null
    const montoConvertido = validatedData.monto

    // Calcular el nuevo saldo después del ajuste
    const montoAjuste = validatedData.tipo === 'ingreso' ? montoConvertido : -montoConvertido
    const nuevoSaldo = Number(cuentaBancaria.saldo) + montoAjuste

    // Advertencia si el saldo queda negativo
    const saldoNegativo = nuevoSaldo < 0

    // Crear el ajuste bancario en una transacción
    const resultado = await prisma.$transaction(async (tx: any) => {
      // Crear el ajuste
      const ajuste = await tx.ajusteBancario.create({
        data: {
          cuentaId: validatedData.cuentaId,
          tipo: validatedData.tipo,
          monto: validatedData.monto,
          moneda: validatedData.moneda,
          descripcion: validatedData.descripcion,
          motivo: validatedData.motivo,
          realizadoPor: user.userId
        }
      })

      // Actualizar el saldo de la cuenta bancaria
      const cuentaActualizada = await tx.cuentaBancaria.update({
        where: { cuentaId: validatedData.cuentaId },
        data: { saldo: nuevoSaldo }
      })

      return { ajuste, cuentaActualizada, saldoNegativo }
    })

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "CREATE",
      entidad: "AJUSTE_BANCARIO",
      entidadId: resultado.ajuste.ajusteId,
      usuarioId: user.userId,
      detalles: {
        tipo: validatedData.tipo,
        monto: validatedData.monto,
        moneda: validatedData.moneda,
        cuenta: resultado.cuentaActualizada.nombreBanco,
        motivo: validatedData.motivo,
        saldoAnterior: Number(cuentaBancaria.saldo),
        saldoNuevo: nuevoSaldo
      }
    });

    await registrarEventoContable({
      origenTipo: 'AJUSTE_BANCARIO',
      origenId: resultado.ajuste.ajusteId,
      monto: Number(validatedData.monto),
      moneda: validatedData.moneda,
      fechaOperacion: new Date(),
      descripcion: `Ajuste bancario ${validatedData.tipo} - ${validatedData.motivo}`,
      usuarioId: user.userId,
    })

    return NextResponse.json({
      success: true,
      ajuste: resultado.ajuste,
      saldoAnterior: Number(cuentaBancaria.saldo),
      saldoNuevo: nuevoSaldo,
      advertenciaSaldoNegativo: resultado.saldoNegativo,
      message: resultado.saldoNegativo
        ? 'Ajuste creado exitosamente. ADVERTENCIA: El saldo de la cuenta es negativo.'
        : 'Ajuste bancario creado exitosamente'
    })

  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    console.error('Error al crear ajuste bancario:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Datos de entrada inválidos',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}