import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'

// Schema para validar configuración de tipo de pago
const ValidacionTipoPagoSchema = z.object({
  nombre: z.string().min(1),
  requiereCuenta: z.boolean(),
  cuentaDefecto: z.string().optional(),
  tipoId: z.string().optional() // Para validaciones de actualización lol
})

// POST /api/contabilidad/tipos-pago/validar - Validar configuración de tipo de pago
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const tenantId = requireTenant(authResult.user as AuthenticatedUser)
    const body = await request.json()
    const validatedData = ValidacionTipoPagoSchema.parse(body)

    const validationResults = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[]
    }

    // 1. Validar nombre único
    const existingTipo = await prisma.tipoPago.findFirst({
      where: {
        nombre: {
          equals: validatedData.nombre,

        },
        tenantId,
        ...(validatedData.tipoId && { tipoId: { not: validatedData.tipoId } })
      }
    })

    if (existingTipo) {
      validationResults.isValid = false
      validationResults.errors.push('Ya existe un tipo de pago con ese nombre')
    }

    // 2. Validar regla de cuenta requerida
    if (validatedData.requiereCuenta && !validatedData.cuentaDefecto) {
      validationResults.isValid = false
      validationResults.errors.push('Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto')
    }

    // 3. Validar cuenta por defecto si se especifica
    if (validatedData.cuentaDefecto) {
      const cuenta = await prisma.cuentaBancaria.findUnique({
        where: { cuentaId: validatedData.cuentaDefecto, tenantId }
      })

      if (!cuenta) {
        validationResults.isValid = false
        validationResults.errors.push('La cuenta por defecto especificada no existe')
      } else if (!cuenta.isActive) {
        validationResults.isValid = false
        validationResults.errors.push('La cuenta por defecto especificada no está activa')
      } else {
        // Sugerencia sobre el tipo de cuenta
        if (cuenta.tipoCuenta === 'ahorros') {
          validationResults.warnings.push('La cuenta por defecto es de tipo ahorros, considere usar una cuenta corriente para mayor flexibilidad')
        }
      }
    }

    // 4. Sugerencias basadas en tipos de pago existentes
    const tiposExistentes = await prisma.tipoPago.findMany({
      where: { isActive: true, tenantId },
      select: { nombre: true, requiereCuenta: true }
    })

    // Sugerir tipos de pago comunes si no existen
    const tiposComunes = ['efectivo', 'transferencia', 'tarjeta', 'cheque']
    const nombresExistentes = tiposExistentes.map((t: any) => t.nombre.toLowerCase())

    const tiposFaltantes = tiposComunes.filter((tipo: string) =>
      !nombresExistentes.includes(tipo) &&
      !validatedData.nombre.toLowerCase().includes(tipo)
    )

    if (tiposFaltantes.length > 0) {
      validationResults.suggestions.push(
        `Considere crear tipos de pago para: ${tiposFaltantes.join(', ')}`
      )
    }

    // 5. Validar coherencia con tipos existentes
    if (validatedData.nombre.toLowerCase().includes('efectivo') && validatedData.requiereCuenta) {
      validationResults.warnings.push('Los pagos en efectivo normalmente no requieren cuenta bancaria')
    }

    if (validatedData.nombre.toLowerCase().includes('transferencia') && !validatedData.requiereCuenta) {
      validationResults.warnings.push('Los pagos por transferencia normalmente requieren cuenta bancaria')
    }

    // 6. Verificar balance de tipos de pago
    const tiposConCuenta = tiposExistentes.filter((t: any) => t.requiereCuenta).length
    const tiposSinCuenta = tiposExistentes.filter((t: any) => !t.requiereCuenta).length

    if (tiposConCuenta === 0 && validatedData.requiereCuenta) {
      validationResults.suggestions.push('Este será el primer tipo de pago que requiere cuenta bancaria')
    }

    if (tiposSinCuenta === 0 && !validatedData.requiereCuenta) {
      validationResults.suggestions.push('Este será el primer tipo de pago que no requiere cuenta bancaria')
    }

    return NextResponse.json({
      success: true,
      data: validationResults
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    console.error('Error validating payment type:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al validar el tipo de pago',
        code: 'VALIDATE_PAYMENT_TYPE_ERROR'
      },
      { status: 500 }
    )
  }
}