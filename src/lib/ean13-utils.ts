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
