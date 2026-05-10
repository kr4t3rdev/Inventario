/**
 * @description Funciones puras para normalización y mapeo de datos de Mi Empresa.
 * Son 100% testables, no dependen de React ni del navegador.
 *
 * @module features/mi-empresa/lib/miEmpresaUtils
 */

// ─── Tipos ───────────────────────────────────────────────

export interface MiEmpresaApiResponse {
  nombre: string
  propietario: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  carnetIdentidad: string | null
  nit: string | null
  licenciaOperacion: string | null
  logoUrl: string | null
  cuentaBancariaId: string | null
  usaCodigoEan13: boolean
}

export interface CuentaBancariaItem {
  cuentaId: string
  nombreBanco: string
  numeroCuenta?: string
  moneda?: string
  tipoCuenta?: string
  isActive?: boolean
}

export interface MiEmpresaFormValues {
  nombre?: string
  propietario?: string
  direccion?: string
  telefono?: string
  email?: string
  carnetIdentidad?: string
  nit?: string
  licenciaOperacion?: string
  logoUrl?: string
  cuentaBancariaId?: string
  usaCodigoEan13?: boolean
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * @description Normaliza los valores del formulario antes de enviarlos al servidor.
 * - Trim de strings
 * - Strings vacíos o solo whitespace → null
 * - undefined → null o false según el campo
 * - "none" en cuentaBancariaId → null
 */
export function normalizeMiEmpresaFormValues(
  values: MiEmpresaFormValues,
): Record<string, unknown> {
  const trimOrNull = (v: string | undefined | null): string | null =>
    v != null && v.trim().length > 0 ? v.trim() : null

  return {
    nombre: values.nombre?.trim() ?? 'Mi Empresa',
    propietario: trimOrNull(values.propietario),
    direccion: trimOrNull(values.direccion),
    telefono: trimOrNull(values.telefono),
    email: trimOrNull(values.email),
    carnetIdentidad: trimOrNull(values.carnetIdentidad),
    nit: trimOrNull(values.nit),
    licenciaOperacion: trimOrNull(values.licenciaOperacion),
    logoUrl: trimOrNull(values.logoUrl),
    cuentaBancariaId:
      !values.cuentaBancariaId || values.cuentaBancariaId === 'none'
        ? null
        : values.cuentaBancariaId.trim(),
    usaCodigoEan13: values.usaCodigoEan13 ?? false,
  }
}

/**
 * @description Convierte la respuesta de la API al shape que espera el formulario.
 * null → "" para inputs de texto.
 */
export function mapMiEmpresaApiToFormValues(
  apiData: MiEmpresaApiResponse,
): MiEmpresaFormValues {
  return {
    nombre: apiData.nombre ?? 'Mi Empresa',
    propietario: apiData.propietario ?? '',
    direccion: apiData.direccion ?? '',
    telefono: apiData.telefono ?? '',
    email: apiData.email ?? '',
    carnetIdentidad: apiData.carnetIdentidad ?? '',
    nit: apiData.nit ?? '',
    licenciaOperacion: apiData.licenciaOperacion ?? '',
    logoUrl: apiData.logoUrl ?? '',
    cuentaBancariaId: apiData.cuentaBancariaId ?? 'none',
    usaCodigoEan13: apiData.usaCodigoEan13 ?? false,
  }
}

/**
 * @description Filtra solo las cuentas bancarias activas.
 * Una cuenta se considera activa si isActive no es false explícitamente.
 */
export function filterActiveCuentasBancarias(
  cuentas: CuentaBancariaItem[],
): CuentaBancariaItem[] {
  return cuentas.filter((c) => c.isActive !== false)
}
