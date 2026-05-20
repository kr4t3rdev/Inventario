/**
 * @description Segmentos usados para autogenerar código de negocio EAN-13.
 */
export interface Ean13SegmentsInput {
  proveedorCodigo: string
  idSeccionCodigo: string
  especificoCodigo: string
  surtidoCodigo: string
}

/**
 * @description Segmentos normalizados con longitudes fijas.
 */
export interface Ean13SegmentsNormalized {
  proveedorCodigo: string
  idSeccionCodigo: string
  especificoCodigo: string
  surtidoCodigo: string
}

/**
 * @description Contrato mínimo de Prisma requerido para consultar surtidos existentes.
 */
export interface SurtidoLookupClient {
  producto: {
    findMany: (args: {
      where: {
        tenantId: string
        idSeccionCodigo: string
        especificoCodigo: string
        proveedorCodigo?: string
      }
      select: {
        surtidoCodigo: true
      }
    }) => Promise<Array<{ surtidoCodigo: string | null }>>
  }
}

/**
 * @description Normaliza un segmento numérico usando padding a la izquierda.
 * @param {unknown} value - Valor de entrada.
 * @param {number} length - Longitud exacta esperada.
 * @param {string} fieldName - Nombre del campo para mensaje de error.
 * @returns {string} Segmento normalizado.
 */
function normalizeSegment(value: unknown, length: number, fieldName: string): string {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} es requerido`)
  }

  const raw = String(value).trim()
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${fieldName} debe contener solo dígitos`)
  }

  if (raw.length > length) {
    throw new Error(`${fieldName} no puede tener más de ${length} dígitos`)
  }

  return raw.padStart(length, '0')
}

/**
 * @description Normaliza los 4 segmentos base para EAN-13.
 * @param {Ean13SegmentsInput} input - Segmentos de entrada.
 * @returns {Ean13SegmentsNormalized} Segmentos normalizados.
 */
export function normalizeEan13Segments(input: Ean13SegmentsInput): Ean13SegmentsNormalized {
  return {
    proveedorCodigo: normalizeSegment(input.proveedorCodigo, 2, 'Proveedor'),
    idSeccionCodigo: normalizeSegment(input.idSeccionCodigo, 2, 'IdSeccion'),
    especificoCodigo: normalizeSegment(input.especificoCodigo, 4, 'Especifico'),
    surtidoCodigo: normalizeSegment(input.surtidoCodigo, 4, 'Surtido'),
  }
}

/**
 * @description Construye los 12 dígitos base del EAN-13.
 * @param {Ean13SegmentsNormalized} segments - Segmentos normalizados.
 * @returns {string} Base de 12 dígitos.
 */
export function buildEan13Base12(segments: Ean13SegmentsNormalized): string {
  return `${segments.proveedorCodigo}${segments.idSeccionCodigo}${segments.especificoCodigo}${segments.surtidoCodigo}`
}

/**
 * @description Calcula el dígito de control EAN-13 para base de 12 dígitos.
 * @param {string} base12 - Cadena de 12 dígitos.
 * @returns {string} Dígito de control.
 */
export function calculateEan13CheckDigit(base12: string): string {
  if (!/^\d{12}$/.test(base12)) {
    throw new Error('La base EAN debe contener exactamente 12 dígitos')
  }

  let oddSum = 0
  let evenSum = 0

  for (let i = 0; i < base12.length; i += 1) {
    const digit = Number(base12[i])
    if ((i + 1) % 2 === 1) {
      oddSum += digit
    } else {
      evenSum += digit
    }
  }

  const total = oddSum + evenSum * 3
  const checkDigit = (10 - (total % 10)) % 10
  return String(checkDigit)
}

/**
 * @description Genera código de negocio EAN-13 a partir de segmentos.
 * @param {Ean13SegmentsInput} input - Segmentos de entrada.
 * @returns {{ base12: string; dcCodigo: string; codigoNegocio: string; segments: Ean13SegmentsNormalized }} Resultado de generación.
 */
export function generateEan13BusinessCode(input: Ean13SegmentsInput): {
  base12: string
  dcCodigo: string
  codigoNegocio: string
  segments: Ean13SegmentsNormalized
} {
  const segments = normalizeEan13Segments(input)
  const base12 = buildEan13Base12(segments)
  const dcCodigo = calculateEan13CheckDigit(base12)

  return {
    base12,
    dcCodigo,
    codigoNegocio: `${base12}${dcCodigo}`,
    segments,
  }
}

/**
 * @description Ensambla un código EAN-13 desde 4 segmentos componentes.
 * Normaliza valores, calcula dígito de control, y devuelve el código de 13 dígitos.
 *
 * @param proveedorCodigo - Código proveedor (máx 2 dígitos)
 * @param sectionCode - Código sección (máx 2 dígitos)
 * @param specificCode - Código específico (máx 4 dígitos)
 * @param surtidoCodigo - Código surtido (máx 4 dígitos)
 * @returns Código EAN-13 válido (13 dígitos)
 * @throws Error si algún segmento es inválido o excede tamaño máximo
 *
 * @example
 * AssembleEan13Code('01', '14', '0285', '0001') → '0114028500012'
 */
export function AssembleEan13Code(
  proveedorCodigo: string,
  sectionCode: string,
  specificCode: string,
  surtidoCodigo: string
): string {
  // Normalizar y validar cada segmento
  const normalized = normalizeEan13Segments({
    proveedorCodigo,
    idSeccionCodigo: sectionCode,
    especificoCodigo: specificCode,
    surtidoCodigo,
  })

  // Construir base de 12 dígitos
  const base12 = buildEan13Base12(normalized)

  // Calcular y agregar dígito de control
  const checkDigit = calculateEan13CheckDigit(base12)

  return `${base12}${checkDigit}`
}

/**
 * @description Valida un código EAN-13 verificando formato y dígito de control.
 * Retorna true si el código es válido, false en caso contrario.
 *
 * @param code - Código a validar (debe ser string de 13 dígitos)
 * @returns true si válido, false si no
 *
 * @example
 * ValidateAssembledCode('0114028500012') → true
 * ValidateAssembledCode('0114028500011') → false (DC incorrecto)
 */
export function ValidateAssembledCode(code: unknown): boolean {
  // Verificar tipo y longitud
  if (typeof code !== 'string') return false
  if (code.length !== 13) return false

  // Verificar que contiene solo dígitos
  if (!/^\d{13}$/.test(code)) return false

  // Verificar dígito de control
  const base12 = code.slice(0, 12)
  const providedCheckDigit = code[12]

  try {
    const calculatedCheckDigit = calculateEan13CheckDigit(base12)
    return providedCheckDigit === calculatedCheckDigit
  } catch {
    return false
  }
}

/**
 * @description Encuentra el siguiente número de surtido disponible para un par section/specific,
 * dentro de un tenant y opcionalmente por proveedor.
 * Busca en la base de datos todos los productos del mismo tenant con la misma sección y específico,
 * encuentra el máximo surtido existente, y retorna el siguiente (incrementado en 1).
 *
 * @param prismaClient - Cliente de Prisma para consultar productos
 * @param tenantId - ID del tenant para filtrar por inquilino
 * @param sectionCode - Código de sección (2 dígitos)
 * @param specificCode - Código específico (4 dígitos)
 * @param proveedorCodigo - Código de proveedor opcional (2 dígitos) para surtido independiente por proveedor
 * @returns Promise que resuelve al siguiente número de surtido disponible (4 dígitos con padding)
 * @throws Error si se alcanza el máximo de surtido (9999)
 *
 * @example
 * FindNextAvailableSurtido(prisma, 'tenant-1', '14', '0285') → '0000' (si no existen productos)
 * FindNextAvailableSurtido(prisma, 'tenant-1', '14', '0285') → '0002' (si existen 0000 y 0001)
 */
export async function FindNextAvailableSurtido(
  prismaClient: SurtidoLookupClient,
  tenantId: string,
  sectionCode: string,
  specificCode: string,
  proveedorCodigo?: string
): Promise<string> {
  // Validar inputs
  if (!/^\d{1,2}$/.test(sectionCode)) {
    throw new Error('Código de sección inválido')
  }
  if (!/^\d{1,4}$/.test(specificCode)) {
    throw new Error('Código específico inválido')
  }

  try {
    // Buscar todos los productos del tenant con esta sección/específico
    const existingProducts = await prismaClient.producto.findMany({
      where: {
        tenantId,
        idSeccionCodigo: sectionCode.padStart(2, '0'),
        especificoCodigo: specificCode.padStart(4, '0'),
        ...(proveedorCodigo ? { proveedorCodigo } : {}),
      },
      select: {
        surtidoCodigo: true,
      },
    })

    // Extraer números de surtido válidos
    const surtidoNumbers = existingProducts
      .map((product) => {
        const num = parseInt(product.surtidoCodigo, 10)
        return isNaN(num) ? null : num
      })
      .filter((n): n is number => n !== null)
      .sort((a, b) => b - a) // Ordenar descendente para obtener máximo

    // Calcular siguiente
    const maxSurtido = surtidoNumbers.length > 0 ? surtidoNumbers[0] : -1
    const nextSurtido = maxSurtido + 1

    // Validar no desbordamiento
    if (nextSurtido > 9999) {
      throw new Error(
        `Desbordamiento de surtido: no hay más variantes disponibles para sección ${sectionCode}/específico ${specificCode} (máximo: 9999)`
      )
    }

    // Retornar con padding de 4 dígitos
    return nextSurtido.toString().padStart(4, '0')
  } catch (error: any) {
    if (error.message?.includes('Desbordamiento')) {
      throw error
    }
    throw new Error(
      `Error al buscar siguiente surtido: ${error.message}`
    )
  }
}
