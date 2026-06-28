import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from '@/lib/auth-middleware'
import { shouldHideBasicAccountingItem } from '@/lib/plan-access'

// Schema for validating a bank transfer
const validarTransferenciaSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Cuenta origen es requerida'),
  cuentaDestinoId: z.string().min(1, 'Cuenta destino es requerida'),
  monto: z.number().positive('El monto debe ser positivo'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
})

// POST /api/contabilidad/transferencias/validar - Validate transfer before execution
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    if (
      user.role !== 'admin' &&
      shouldHideBasicAccountingItem(user, 'Transferencias Bancarias')
    ) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = validarTransferenciaSchema.parse(body)

    const {
      cuentaOrigenId,
      cuentaDestinoId,
      monto,
    } = validatedData

    // Simple response aligned to client expectation
    const advertencias: string[] = []
    let saldoSuficiente = true

    // Validate that origin and destination accounts are different
    if (cuentaOrigenId === cuentaDestinoId) {
      return NextResponse.json(
        { error: 'La cuenta origen y destino deben ser diferentes' },
        { status: 400 }
      )
    }

    // Get both accounts
    const [cuentaOrigen, cuentaDestino] = await Promise.all([
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: cuentaOrigenId },
        select: {
          cuentaId: true,
          nombreBanco: true,
          numeroCuenta: true,
          saldo: true,
          moneda: true,
          isActive: true
        }
      }),
      prisma.cuentaBancaria.findUnique({
        where: { cuentaId: cuentaDestinoId },
        select: {
          cuentaId: true,
          nombreBanco: true,
          numeroCuenta: true,
          saldo: true,
          moneda: true,
          isActive: true
        }
      })
    ])

    if (!cuentaOrigen) {
      return NextResponse.json(
        { error: 'Cuenta origen no encontrada' },
        { status: 400 }
      )
    } else {
      if (!cuentaOrigen.isActive) {
        return NextResponse.json(
          { error: 'La cuenta origen no está activa' },
          { status: 400 }
        )
      }

      // Check sufficient balance
      const saldoNumerico = Number(cuentaOrigen.saldo)
      saldoSuficiente = saldoNumerico >= monto
      if (!saldoSuficiente) {
        advertencias.push(`Saldo insuficiente. Disponible: ${saldoNumerico} ${cuentaOrigen.moneda}`)
      }

      // Check for low balance warning (less than 20% remaining after transfer)
      const saldoRestante = saldoNumerico - monto
      const porcentajeRestante = (saldoRestante / saldoNumerico) * 100

      if (porcentajeRestante < 20 && saldoRestante > 0) {
        advertencias.push(`El saldo restante será bajo: ${saldoRestante.toFixed(2)} ${cuentaOrigen.moneda}`)
      }
    }

    if (!cuentaDestino) {
      return NextResponse.json(
        { error: 'Cuenta destino no encontrada' },
        { status: 400 }
      )
    } else {
      if (!cuentaDestino.isActive) {
        return NextResponse.json(
          { error: 'La cuenta destino no está activa' },
          { status: 400 }
        )
      }
    }

    // Currency conversion note (do not require tasaCambio at this stage)
    if (cuentaOrigen && cuentaDestino && cuentaOrigen.moneda !== cuentaDestino.moneda) {
      advertencias.push('Esta transferencia requiere confirmación de tasa de cambio')
    }

    // Response aligned to client (RTK query) expectation
    return NextResponse.json({
      saldoSuficiente,
      advertencias,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error validating transferencia:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
