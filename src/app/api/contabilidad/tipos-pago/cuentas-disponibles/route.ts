import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateUser, type AuthenticatedUser } from '@/lib/auth-middleware'
import { requireTenant } from '@/lib/services/tenant-scope'

// GET /api/contabilidad/tipos-pago/cuentas-disponibles - Obtener cuentas disponibles para tipos de pago
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response
    const tenantId = requireTenant(authResult.user as AuthenticatedUser)
    const { searchParams } = new URL(request.url)
    const moneda = searchParams.get('moneda')
    const tipoCuenta = searchParams.get('tipoCuenta')

    // Construir filtros
    const where: any = {
      isActive: true,
      tenantId
    }

    if (moneda) {
      where.moneda = moneda
    }

    if (tipoCuenta) {
      where.tipoCuenta = tipoCuenta
    }

    // Obtener cuentas bancarias activas
    const cuentas = await prisma.cuentaBancaria.findMany({
      where,
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        tipoCuenta: true,
        saldo: true,
        moneda: true,
        createdAt: true
      },
      orderBy: [
        { nombreBanco: 'asc' },
        { numeroCuenta: 'asc' }
      ]
    })

    // Obtener información de uso de cada cuenta como defecto
    const cuentasConUso = await Promise.all(
      cuentas.map(async (cuenta: any) => {
        const tiposPagoUsando = await prisma.tipoPago.findMany({
          where: {
            cuentaDefecto: cuenta.cuentaId,
            isActive: true,
            tenantId
          },
          select: {
            tipoId: true,
            nombre: true
          }
        })

        return {
          ...cuenta,
          saldo: Number(cuenta.saldo),
          usadaEnTiposPago: tiposPagoUsando,
          esUsadaComoDefecto: tiposPagoUsando.length > 0
        }
      })
    )

    // Obtener estadísticas generales
    const estadisticas = {
      totalCuentas: cuentas.length,
      cuentasPorMoneda: await prisma.cuentaBancaria.groupBy({
        by: ['moneda'],
        where: { isActive: true, tenantId },
        _count: { cuentaId: true }
      }),
      cuentasPorTipo: await prisma.cuentaBancaria.groupBy({
        by: ['tipoCuenta'],
        where: { isActive: true, tenantId },
        _count: { cuentaId: true }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        cuentas: cuentasConUso,
        estadisticas
      }
    })

  } catch (error) {
    console.error('Error fetching available accounts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener las cuentas disponibles',
        code: 'FETCH_AVAILABLE_ACCOUNTS_ERROR'
      },
      { status: 500 }
    )
  }
}