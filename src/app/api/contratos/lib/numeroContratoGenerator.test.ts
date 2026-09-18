import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generarProximoConsecutivo,
  formatearNumeroContrato,
  validarFormatoNumeroContrato,
  extraerTipoDelNumero,
} from './numeroContratoGenerator'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contrato: {
      findFirst: vi.fn(),
    },
  },
}))

describe('numeroContratoGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generarProximoConsecutivo', () => {
    it('debería retornar 1 cuando no hay contratos del tipo', async () => {
      ;(prisma.contrato.findFirst as any).mockResolvedValueOnce(null)

      const resultado = await generarProximoConsecutivo('tenant-1', 'COMPRA_VENTA')
      expect(resultado).toBe(1)
    })

    it('debería retornar el siguiente consecutivo cuando hay contratos', async () => {
      ;(prisma.contrato.findFirst as any).mockResolvedValueOnce({
        numeroConsecutivo: 5,
      })

      const resultado = await generarProximoConsecutivo('tenant-1', 'SERVICIO')
      expect(resultado).toBe(6)
    })

    it('debería buscar por tenant y tipo correctos', async () => {
      ;(prisma.contrato.findFirst as any).mockResolvedValueOnce(null)

      await generarProximoConsecutivo('tenant-1', 'SUMINISTROS')

      expect(prisma.contrato.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', tipo: 'SUMINISTROS' },
        orderBy: { numeroConsecutivo: 'desc' },
        select: { numeroConsecutivo: true },
      })
    })

    it('debería aislar consecutivos por tenant', async () => {
      ;(prisma.contrato.findFirst as any).mockResolvedValueOnce({ numeroConsecutivo: 3 })
      ;(prisma.contrato.findFirst as any).mockResolvedValueOnce({ numeroConsecutivo: 7 })

      const a = await generarProximoConsecutivo('tenant-A', 'COMPRA_VENTA')
      const b = await generarProximoConsecutivo('tenant-B', 'COMPRA_VENTA')

      expect(a).toBe(4)
      expect(b).toBe(8)
      expect(prisma.contrato.findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-A' }),
      }))
      expect(prisma.contrato.findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-B' }),
      }))
    })

    it('debería ordenar por numeroConsecutivo descendente', async () => {
      ;(prisma.contrato.findFirst as any).mockResolvedValueOnce(null)

      await generarProximoConsecutivo('tenant-1', 'COMPRA_VENTA')

      const llamada = (prisma.contrato.findFirst as any).mock.calls[0][0]
      expect(llamada.orderBy).toEqual({ numeroConsecutivo: 'desc' })
    })
  })

  describe('formatearNumeroContrato', () => {
    it('debería formatear COMPRA_VENTA correctamente', () => {
      const resultado = formatearNumeroContrato('COMPRA_VENTA', 1)
      expect(resultado).toBe('CV-0001')
    })

    it('debería formatear SERVICIO correctamente', () => {
      const resultado = formatearNumeroContrato('SERVICIO', 42)
      expect(resultado).toBe('SER-0042')
    })

    it('debería formatear SUMINISTROS correctamente', () => {
      const resultado = formatearNumeroContrato('SUMINISTROS', 157)
      expect(resultado).toBe('SUM-0157')
    })

    it('debería formatear tipos personalizados usando sus primeras tres letras', () => {
      const resultado = formatearNumeroContrato('Mantenimiento', 1)
      expect(resultado).toBe('MAN-0001')
    })

    it('debería rellenar con ceros a la izquierda', () => {
      expect(formatearNumeroContrato('COMPRA_VENTA', 1)).toBe('CV-0001')
      expect(formatearNumeroContrato('COMPRA_VENTA', 10)).toBe('CV-0010')
      expect(formatearNumeroContrato('COMPRA_VENTA', 100)).toBe('CV-0100')
      expect(formatearNumeroContrato('COMPRA_VENTA', 1000)).toBe('CV-1000')
      expect(formatearNumeroContrato('COMPRA_VENTA', 9999)).toBe('CV-9999')
    })

    it('debería formatear tipos arbitrarios sin romper el consecutivo', () => {
      expect(formatearNumeroContrato('TIPO_INEXISTENTE', 1)).toBe('TIP-0001')
    })
  })

  describe('validarFormatoNumeroContrato', () => {
    it('debería validar formato COMPRA_VENTA', () => {
      expect(validarFormatoNumeroContrato('CV-0001')).toBe(true)
      expect(validarFormatoNumeroContrato('CV-0042')).toBe(true)
      expect(validarFormatoNumeroContrato('CV-1000')).toBe(true)
    })

    it('debería validar formato SERVICIO', () => {
      expect(validarFormatoNumeroContrato('SER-0001')).toBe(true)
      expect(validarFormatoNumeroContrato('SER-0999')).toBe(true)
    })

    it('debería validar formato SUMINISTROS', () => {
      expect(validarFormatoNumeroContrato('SUM-0001')).toBe(true)
      expect(validarFormatoNumeroContrato('SUM-9999')).toBe(true)
    })

    it('debería rechazar formatos inválidos', () => {
      expect(validarFormatoNumeroContrato('XX-0001')).toBe(false)
      expect(validarFormatoNumeroContrato('CV-001')).toBe(false) // Solo 3 dígitos
      expect(validarFormatoNumeroContrato('CV-00001')).toBe(false) // 5 dígitos
      expect(validarFormatoNumeroContrato('CV0001')).toBe(false) // Sin guión
      expect(validarFormatoNumeroContrato('CV-abcd')).toBe(false) // Letras en número
    })

    it('debería ser case-sensitive con prefijos', () => {
      expect(validarFormatoNumeroContrato('cv-0001')).toBe(false)
      expect(validarFormatoNumeroContrato('Cv-0001')).toBe(false)
    })
  })

  describe('extraerTipoDelNumero', () => {
    it('debería extraer COMPRA_VENTA desde CV', () => {
      expect(extraerTipoDelNumero('CV-0001')).toBe('COMPRA_VENTA')
      expect(extraerTipoDelNumero('CV-9999')).toBe('COMPRA_VENTA')
    })

    it('debería extraer SERVICIO desde SER', () => {
      expect(extraerTipoDelNumero('SER-0001')).toBe('SERVICIO')
      expect(extraerTipoDelNumero('SER-5000')).toBe('SERVICIO')
    })

    it('debería extraer SUMINISTROS desde SUM', () => {
      expect(extraerTipoDelNumero('SUM-0001')).toBe('SUMINISTROS')
      expect(extraerTipoDelNumero('SUM-1234')).toBe('SUMINISTROS')
    })

    it('debería retornar null para tipo inválido', () => {
      expect(extraerTipoDelNumero('XX-0001')).toBeNull()
      expect(extraerTipoDelNumero('INVALID')).toBeNull()
      expect(extraerTipoDelNumero('')).toBeNull()
    })

    it('debería tolerar formato incompleto extrayendo prefijo', () => {
      // Note: función solo extrae prefijo, por eso funciona
      expect(extraerTipoDelNumero('CV-')).toBe('COMPRA_VENTA')
      expect(extraerTipoDelNumero('SER-anything')).toBe('SERVICIO')
    })
  })
})
