/**
 * @description Server Actions de gastos recurrentes (F-4). Las plantillas
 * `GastoRecurrente` generan `GastosDE` idempotentes por período con la clave
 * `rec:{plantillaId}:{periodo}`; cada ejecución avanza `proximaGeneracion`
 * según la frecuencia y genera todo lo vencido hasta hoy (tope de 12 ciclos
 * por plantilla para evitar explosiones en tenants inactivos).
 *
 * Incluye `ensureConceptoViaticos` (semilla idempotente del concepto Viáticos
 * por tenant) para los gastos de viáticos por empleado.
 *
 * @module features/gastosDE/recurrentes
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ActionError, withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const FRECUENCIAS = [
  'MENSUAL',
  'BIMESTRAL',
  'TRIMESTRAL',
  'SEMESTRAL',
  'ANUAL',
] as const;

type Frecuencia = (typeof FRECUENCIAS)[number];

/** @description Verifica que las referencias opcionales pertenezcan al tenant. */
async function validarReferenciasTenant(
  referencias: { conceptoId?: string | null; elementoId?: string | null; proveedorId?: string | null; empleadoId?: string | null },
  tenantId: string,
): Promise<void> {
  const checks = await Promise.all([
    referencias.conceptoId ? prisma.gastoConcepto.findFirst({ where: { conceptoId: referencias.conceptoId, tenantId }, select: { conceptoId: true } }) : null,
    referencias.elementoId ? prisma.gastoElemento.findFirst({ where: { elementoId: referencias.elementoId, tenantId }, select: { elementoId: true } }) : null,
    referencias.proveedorId ? prisma.vendor.findFirst({ where: { vendorId: referencias.proveedorId, tenantId }, select: { vendorId: true } }) : null,
    referencias.empleadoId ? prisma.empleado.findFirst({ where: { empleadoId: referencias.empleadoId, tenantId }, select: { empleadoId: true } }) : null,
  ]);
  const names = ['concepto', 'elemento', 'proveedor', 'empleado'];
  checks.forEach((check, index) => {
    const key = [referencias.conceptoId, referencias.elementoId, referencias.proveedorId, referencias.empleadoId][index];
    if (key && !check) throw new ActionError(`El ${names[index]} no pertenece a este tenant`, 'NOT_FOUND');
  });
}

const MESES_POR_FRECUENCIA: Record<Frecuencia, number> = {
  MENSUAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

/**
 * @description Avanza una fecha de generación según la frecuencia,
 * preservando el día de generación (1-28 evita problemas de fin de mes).
 */
function avanzarGeneracion(fecha: Date, frecuencia: Frecuencia): Date {
  const siguiente = new Date(fecha);
  siguiente.setUTCMonth(
    siguiente.getUTCMonth() + MESES_POR_FRECUENCIA[frecuencia],
  );
  siguiente.setUTCDate(siguiente.getUTCDate());
  return siguiente;
}

/**
 * @description Período YYYY-MM (UTC) de una fecha de generación.
 */
function periodoDe(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

const gastoRecurrenteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(120),
  conceptoId: z.string().optional().nullable(),
  elementoId: z.string().optional().nullable(),
  proveedorId: z.string().optional().nullable(),
  empleadoId: z.string().optional().nullable(),
  monto: z.coerce
    .number()
    .int('Debe ser un entero')
    .positive('El monto debe ser mayor a 0'),
  moneda: z.enum(['CUP', 'USD', 'EUR', 'MLC']).default('CUP'),
  frecuencia: z.enum(FRECUENCIAS),
  diaGeneracion: z.coerce
    .number()
    .int()
    .min(1, 'El día debe estar entre 1 y 28')
    .max(28, 'El día debe estar entre 1 y 28'),
  notas: z.string().max(500).optional().nullable(),
});

/**
 * @description Crea una plantilla de gasto recurrente con el primer
 * vencimiento calculado a partir del día de generación.
 * @param {z.input<typeof gastoRecurrenteSchema>} input - Datos de la plantilla.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Plantilla creada.
 */
export const crearGastoRecurrenteAction = withAction(
  async (
    input: z.input<typeof gastoRecurrenteSchema>,
    user: AuthenticatedUser,
  ) => {
    const parsed = gastoRecurrenteSchema.parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'gastos', 'gestionar gastos recurrentes');
    await validarReferenciasTenant(parsed, tenantId);

    const hoy = new Date();
    const proxima = new Date(
      Date.UTC(
        hoy.getUTCFullYear(),
        hoy.getUTCMonth(),
        parsed.diaGeneracion,
      ),
    );
    if (proxima <= hoy) {
      proxima.setUTCMonth(proxima.getUTCMonth() + 1);
    }

    const plantilla = await prisma.gastoRecurrente.create({
      data: {
        tenantId,
        nombre: parsed.nombre,
        conceptoId: parsed.conceptoId || null,
        elementoId: parsed.elementoId || null,
        proveedorId: parsed.proveedorId || null,
        empleadoId: parsed.empleadoId || null,
        monto: parsed.monto,
        moneda: parsed.moneda,
        frecuencia: parsed.frecuencia,
        diaGeneracion: parsed.diaGeneracion,
        proximaGeneracion: proxima,
        activo: true,
        notas: parsed.notas || null,
      },
    });

    revalidatePath('/busy/gastosDE');
    return plantilla;
  },
);

/**
 * @description Actualiza una plantilla recurrente (campos editables y estado
 * activo). Solo plantillas del tenant.
 * @param {object} input - { gastoRecurrenteId, ...campos opcionales, activo? }.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Plantilla actualizada.
 */
export const updateGastoRecurrenteAction = withAction(
  async (
    input: Partial<z.input<typeof gastoRecurrenteSchema>> & {
      gastoRecurrenteId: string;
      activo?: boolean;
    },
    user: AuthenticatedUser,
  ) => {
    const parsed = gastoRecurrenteSchema.partial().extend({
      gastoRecurrenteId: z.string().min(1),
      activo: z.boolean().optional(),
    }).parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'gastos', 'gestionar gastos recurrentes');
    await validarReferenciasTenant(parsed, tenantId);

    const existente = await prisma.gastoRecurrente.findFirst({
      where: { gastoRecurrenteId: parsed.gastoRecurrenteId, tenantId },
    });
    if (!existente) {
      throw new ActionError('Plantilla no encontrada', 'NOT_FOUND');
    }

    const data: Record<string, unknown> = {};
    if (parsed.nombre !== undefined) data.nombre = parsed.nombre;
    if (parsed.monto !== undefined) data.monto = parsed.monto;
    if (parsed.frecuencia !== undefined) data.frecuencia = parsed.frecuencia;
    if (parsed.diaGeneracion !== undefined) {
      data.diaGeneracion = parsed.diaGeneracion;
      // Recalcula el próximo vencimiento con el nuevo día (futuro).
      const hoy = new Date();
      const proxima = new Date(
        Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), parsed.diaGeneracion),
      );
      if (proxima <= hoy) proxima.setUTCMonth(proxima.getUTCMonth() + 1);
      data.proximaGeneracion = proxima;
    }
    if (parsed.conceptoId !== undefined) data.conceptoId = parsed.conceptoId;
    if (parsed.elementoId !== undefined) data.elementoId = parsed.elementoId;
    if (parsed.proveedorId !== undefined) data.proveedorId = parsed.proveedorId;
    if (parsed.empleadoId !== undefined) data.empleadoId = parsed.empleadoId;
    if (parsed.notas !== undefined) data.notas = parsed.notas;
    if (parsed.activo !== undefined) data.activo = parsed.activo;

    const actualizada = await prisma.gastoRecurrente.update({
      where: { gastoRecurrenteId: parsed.gastoRecurrenteId },
      data,
    });

    revalidatePath('/busy/gastosDE');
    return actualizada;
  },
);

/**
 * @description Lista las plantillas recurrentes del tenant (activas primero).
 * @param {object} params - { soloActivas?: boolean }.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Lista de plantillas.
 */
export const listarGastoRecurrentesAction = withAction(
  async (
    params: { soloActivas?: boolean } = {},
    user: AuthenticatedUser,
  ) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'gastos', 'consultar gastos recurrentes');

    const items = await prisma.gastoRecurrente.findMany({
      where: {
        tenantId,
        ...(params.soloActivas ? { activo: true } : {}),
      },
      orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }],
    });
    return { items };
  },
);

/**
 * @description Genera los GastosDE vencidos de todas las plantillas activas.
 * Idempotente por `rec:{plantillaId}:{periodo}`: una re-ejecución no duplica.
 * Genera todo lo atrasado hasta hoy con tope de 12 ciclos por plantilla.
 * @param {object} params - Reservado (sin parámetros requeridos).
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} { generados, omitidos } por plantilla procesada.
 */
export const generarGastosRecurrentesAction = withAction(
  async (_params: Record<string, never> = {}, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'gastos', 'generar gastos recurrentes');

    const plantillas = await prisma.gastoRecurrente.findMany({
      where: { tenantId, activo: true },
    });

    const hoy = new Date();
    let generados = 0;
    let omitidos = 0;

    for (const plantilla of plantillas) {
      let proxima = new Date(plantilla.proximaGeneracion);
      const frecuencia = plantilla.frecuencia as Frecuencia;
      let ciclos = 0;

      while (proxima <= hoy && ciclos < 12) {
        const periodo = periodoDe(proxima);
        const clave = `rec:${plantilla.gastoRecurrenteId}:${periodo}`;
        const siguiente = avanzarGeneracion(proxima, frecuencia);

        const existente = await prisma.gastosDE.findUnique({
          where: {
            tenantId_claveIdempotencia: {
              tenantId,
              claveIdempotencia: clave,
            },
          },
        });

        if (existente) {
          omitidos += 1;
          await prisma.gastoRecurrente.update({
            where: { gastoRecurrenteId: plantilla.gastoRecurrenteId },
            data: { proximaGeneracion: siguiente },
          });
        } else {
          let proveedorNombre = 'Gasto recurrente';
          if (plantilla.proveedorId) {
            const vendor = await prisma.vendor.findFirst({
              where: { vendorId: plantilla.proveedorId, tenantId },
              select: { nombre: true },
            });
            if (vendor) proveedorNombre = vendor.nombre;
          }
          await prisma.$transaction(async (tx: any) => {
            await tx.gastosDE.create({
              data: {
                tenantId,
                conceptoId: plantilla.conceptoId,
                elementoId: plantilla.elementoId,
                proveedorId: plantilla.proveedorId,
                empleadoId: plantilla.empleadoId,
                proveedor: proveedorNombre,
                estado: 'PENDIENTE',
                // La plantilla guarda el monto en centavos y GastosDE en
                // unidades enteras: convertir o el gasto sale x100.
                monto: Math.round(plantilla.monto / 100),
                periodo,
                descripcion: `${plantilla.nombre} (recurrente ${periodo})`,
                gastoRecurrenteId: plantilla.gastoRecurrenteId,
                claveIdempotencia: clave,
              },
            });
            await tx.gastoRecurrente.update({
              where: { gastoRecurrenteId: plantilla.gastoRecurrenteId },
              data: { proximaGeneracion: siguiente },
            });
          });
          generados += 1;
        }

        proxima = siguiente;
        ciclos += 1;
      }
    }

    revalidatePath('/busy/gastosDE');
    return { generados, omitidos, plantillasProcesadas: plantillas.length };
  },
);

/**
 * @description Siembra (idempotente) el concepto "Viáticos" por tenant y
 * devuelve su identificador. Usado por el flujo de gastos de viáticos.
 * @param {any} db - Cliente Prisma (global o transacción).
 * @param {string} tenantId - Tenant.
 * @returns {Promise<string>} conceptoId del concepto Viáticos.
 */
export async function ensureConceptoViaticos(
  db: any,
  tenantId: string,
): Promise<string> {
  const existente = await db.gastoConcepto.findFirst({
    where: { tenantId, nombre: 'Viáticos' },
  });
  if (existente) return existente.conceptoId;
  const creado = await db.gastoConcepto.create({
    data: { tenantId, nombre: 'Viáticos', isActive: true },
  });
  return creado.conceptoId;
}
