/**
 * @description Generador de numeración de ofertas por tenant con reintento ante
 * colisión de unicidad (P2002). Réplica del patrón de contratos
 * (`features/contratos/lib/numeroContratoGenerator.ts`): el índice
 * `@@unique([tenantId, numeroOferta])` es la autoridad; el retry cubre la ventana
 * de carrera entre lectura del último número y el `create`.
 */
import { prisma } from '@/lib/prisma';

const MAX_INTENTOS = 3;

/**
 * @description Formatea el consecutivo como OF-XXXXXX (seis dígitos mínimos).
 * @param {number} consecutivo - Número consecutivo de la oferta.
 * @returns {string} Número de oferta formateado.
 */
export function formatearNumeroOferta(consecutivo: number): string {
  return `OF-${String(consecutivo).padStart(6, '0')}`;
}

/**
 * @description Calcula el próximo consecutivo de oferta del tenant leyendo el
 * último número registrado.
 * @param {string} tenantId - Tenant propietario de la numeración.
 * @returns {Promise<number>} Próximo número consecutivo.
 */
export async function generarProximoNumeroOferta(tenantId: string): Promise<number> {
  const ultimaOferta = await prisma.oferta.findFirst({
    where: { tenantId },
    orderBy: { numeroOferta: 'desc' },
    select: { numeroOferta: true },
  });
  if (!ultimaOferta) return 1;
  const ultimoConsecutivo = parseInt(ultimaOferta.numeroOferta.replace('OF-', ''), 10);
  return (Number.isFinite(ultimoConsecutivo) ? ultimoConsecutivo : 0) + 1;
}

/**
 * @description Ejecuta la creación con numeración secuencial; reintenta hasta
 * MAX_INTENTOS veces cuando el create colisiona con el índice único (P2002).
 * Cualquier otro error se propaga sin reintentar.
 * @param {object} input - tenantId, buildData que arma el payload con el número,
 * y create re-ejecutable por intento.
 * @template T - Tipo de los datos que se construyen para cada intento.
 * @template TResult - Tipo del resultado de la creación exitosa.
 * @returns {Promise<TResult>} Resultado del create exitoso.
 */
export async function crearOfertaConNumero<T, TResult>(input: {
  tenantId: string;
  buildData: (numeroOferta: string) => T;
  create: (data: T) => Promise<TResult>;
}): Promise<TResult> {
  let ultimoError: unknown = null;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const numeroOferta = formatearNumeroOferta(await generarProximoNumeroOferta(input.tenantId));
    try {
      return await input.create(input.buildData(numeroOferta));
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        ultimoError = error;
        continue;
      }
      throw error;
    }
  }
  throw ultimoError;
}
