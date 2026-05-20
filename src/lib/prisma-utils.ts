/**
 * @description Utilidades para manejar datos de Prisma,
 * especialmente la serialización de objetos Decimal a number
 * para evitar errores al pasarlos de Server Components a Client Components.
 */

/**
 * @description Convierte recursivamente objetos Decimal de Prisma a number.
 * Prisma retorna los campos Decimal como objetos especiales que no son
 * serializables directamente desde Server Components a Client Components.
 *
 * @param data - Datos provenientes de Prisma (objeto, array, o valor primitivo)
 * @returns Los mismos datos con todos los Decimal convertidos a number
 */
export function serializePrismaData<T>(data: T): T {
  if (data === null || data === undefined) return data;

  // Si es un Decimal de Prisma, convertirlo a number
  if (typeof data === 'object' && 's' in (data as object) && 'e' in (data as object) && 'd' in (data as object)) {
    return Number(data) as unknown as T;
  }

  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(serializePrismaData) as unknown as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = serializePrismaData(value);
    }
    return result as T;
  }

  return data;
}
