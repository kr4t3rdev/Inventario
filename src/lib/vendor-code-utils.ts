import { calculateEan13CheckDigit } from '@/lib/ean13-utils'
import { PrismaClient } from '@/generated/prisma'

/**
 * @description Normaliza un número (1-99) a código de vendor de 2 dígitos
 * @param {number} num - Número a normalizar (1-99)
 * @returns {string} Código normalizado (ej: "05")
 * @throws Error si el número está fuera de rango
 */
export function normalizeVendorCode(num: number): string {
  if (!Number.isInteger(num) || num < 1 || num > 99) {
    throw new Error('Código debe estar entre 1 y 99')
  }
  return String(num).padStart(2, '0')
}

/**
 * @description Valida que un string sea un código vendor válido (2 dígitos)
 * @param {unknown} code - Valor a validar
 * @returns {boolean} True si es válido
 */
export function isValidVendorCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{2}$/.test(code)
}

/**
 * @description Genera EAN13 para un Vendor a partir de su código
 * Estructura: CC + 0000 + 0000 + 0001 + DC
 * @param {string} vendorCode - Código vendor (2 dígitos, ej: "05")
 * @returns {string} EAN13 válido (13 dígitos)
 * @throws Error si vendorCode es inválido
 *
 * @example
 * generateVendorEan13("05") → "0500000000011"
 */
export function generateVendorEan13(vendorCode: string): string {
  if (!isValidVendorCode(vendorCode)) {
    throw new Error('vendorCode debe ser exactamente 2 dígitos numéricos')
  }

  // Estructura: vendorCode(2) + 0000000001 = 12 dígitos
  const base12 = `${vendorCode}0000000001`

  // Validar que base12 es numérico y tiene 12 dígitos
  if (!/^\d{12}$/.test(base12)) {
    throw new Error('Error interno: base12 no es válido')
  }

  // Calcular dígito de control
  const dc = calculateEan13CheckDigit(base12)

  return `${base12}${dc}`
}

/**
 * @description Obtiene el siguiente código vendor disponible de forma atómica
 * @param {PrismaClient} prisma - Cliente Prisma
 * @returns {Promise<string>} Código vendor asignado (2 dígitos)
 * @throws Error si límite de 99 proveedores alcanzado
 */
export async function getNextVendorCode(prisma: PrismaClient): Promise<string> {
  try {
    // Transacción atómica: incrementar nextNumber y obtener valor
    const sequence = await prisma.vendorCodeSequence.update({
      where: { id: 1 },
      data: { nextNumber: { increment: 1 } },
    })

    // Validar que no se excedió el límite
    if (sequence.nextNumber > 99) {
      // Revertir el incremento
      await prisma.vendorCodeSequence.update({
        where: { id: 1 },
        data: { nextNumber: { decrement: 1 } },
      })
      throw new Error('Límite de 99 proveedores alcanzado')
    }

    // Retornar el código previo (el que ahora está asignado)
    return normalizeVendorCode(sequence.nextNumber - 1)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Límite')) {
      throw error
    }
    throw new Error(`Error al obtener código vendor: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

/**
 * @description Inicializa VendorCodeSequence si no existe
 * @param {PrismaClient} prisma - Cliente Prisma
 * @returns {Promise<void>}
 */
export async function initializeVendorCodeSequence(prisma: PrismaClient): Promise<void> {
  try {
    // Intentar actualizar; si no existe, crear (upsert)
    await prisma.vendorCodeSequence.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, nextNumber: 1 },
    })
  } catch (error) {
    throw new Error(`Error al inicializar secuencia: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

/**
 * @description Valida que un Vendor tenga código completo
 * @param {Object} vendor - Objeto Vendor
 * @returns {Object} { isValid, reason? }
 */
export function validateVendorCodeState(vendor: { vendorCode: string | null | undefined } | null): {
  isValid: boolean
  reason?: string
} {
  if (!vendor) {
    return { isValid: false, reason: 'Vendor no encontrado' }
  }

  if (!vendor.vendorCode) {
    return { isValid: false, reason: 'Vendor sin código asignado' }
  }

  if (!isValidVendorCode(vendor.vendorCode)) {
    return { isValid: false, reason: 'Código malformado' }
  }

  return { isValid: true }
}

/**
 * @description Obtiene la siguiente secuencia sin incrementar
 * Útil para debugging/auditoría
 * @param {PrismaClient} prisma - Cliente Prisma
 * @returns {Promise<number>} Número de la próxima secuencia
 */
export async function peekNextVendorNumber(prisma: PrismaClient): Promise<number> {
  const sequence = await prisma.vendorCodeSequence.findUnique({
    where: { id: 1 },
  })
  return sequence?.nextNumber ?? 1
}
