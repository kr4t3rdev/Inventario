/**
 * @description Server Actions para contratos.
 *
 * @module features/contratos/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { assertTransicionValida, puedeTransicionar } from '@/features/contratos/lib/estado-contrato-machine';
import { generarProximoConsecutivo, formatearNumeroContrato, crearContratoConConsecutivo } from '@/features/contratos/lib/numeroContratoGenerator';
import { contratoSchema, contratoUpdateSchema, cambioEstadoSchema, bulkStatusSchema, bulkDeleteSchema } from './schemas';
import type { ContratoInput, ContratoUpdateInput, CambioEstadoInput, BulkStatusInput, BulkDeleteInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const CONTRATO_LIST_INCLUDE = {
  cliente: true,
  vendor: true,
  creador: { select: { userId: true, name: true, email: true } },
  aprobador: { select: { userId: true, name: true, email: true } },
  versiones: { orderBy: { numeroVersion: 'desc' as const }, take: 1 },
  firmas: true,
  aprobaciones: true,
  archivos: true,
  alertas: { orderBy: { fechaAlerta: 'desc' as const }, take: 5 },
} as const;

const CONTRATO_DETAIL_INCLUDE = {
  cliente: true,
  vendor: true,
  creador: { select: { userId: true, name: true, email: true } },
  aprobador: { select: { userId: true, name: true, email: true } },
  versiones: { orderBy: { numeroVersion: 'desc' as const } },
  firmas: { include: { firmante: { select: { userId: true, name: true, email: true } } } },
  aprobaciones: { include: { aprobador: { select: { userId: true, name: true, email: true } } } },
  archivos: { include: { version: true, generador: { select: { userId: true, name: true, email: true } } } },
  alertas: { orderBy: { fechaAlerta: 'desc' as const } },
} as const;

export interface ContratosListResult {
  data: any[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const getContratosAction = withAction(async (
  input: { page?: number; limit?: number; tipo?: string; estado?: string; fechaInicio?: string; fechaFin?: string } = {},
  user: AuthenticatedUser
) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  const tenantId = requireTenant(user);
  const page = input.page || 1;
  const limit = input.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (input.tipo && input.tipo !== 'ALL') where.tipo = input.tipo;
  if (input.estado && input.estado !== 'ALL') where.estado = input.estado;
  if (input.fechaInicio || input.fechaFin) {
    where.fechaInicio = {};
    if (input.fechaInicio) where.fechaInicio.gte = new Date(input.fechaInicio);
    if (input.fechaFin) where.fechaInicio.lte = new Date(input.fechaFin);
  }

  const [contratos, total] = await Promise.all([
    prisma.contrato.findMany({ where, include: CONTRATO_LIST_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.contrato.count({ where }),
  ]);

  return { data: contratos, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } } satisfies ContratosListResult;
});

export const getContratoByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  const tenantId = requireTenant(user);
  const contrato = await prisma.contrato.findFirst({
    where: { contratoId: id, tenantId },
    include: CONTRATO_DETAIL_INCLUDE,
  });
  if (!contrato) throw new ActionError('Contrato no encontrado', 'NOT_FOUND');
  return contrato;
});

export const createContratoAction = withAction(async (input: ContratoInput, user: AuthenticatedUser) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  const parsed = contratoSchema.parse(input);
  const tenantId = requireTenant(user);

  // Validar pertenencia al tenant de cliente y vendor antes de crear
  if (parsed.clienteId) {
    const cliente = await prisma.cliente.findFirst({ where: { clienteId: parsed.clienteId, tenantId } });
    if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');
  }
  if (parsed.vendorId) {
    const vendor = await prisma.vendor.findFirst({ where: { vendorId: parsed.vendorId, tenantId } });
    if (!vendor) throw new ActionError('Vendor no encontrado', 'NOT_FOUND');
  }

  const contrato = await crearContratoConConsecutivo({
    tenantId,
    tipo: parsed.tipo,
    buildData: (numeroConsecutivo, numeroContrato) => ({
      tipo: parsed.tipo,
      tenantId,
      creadoPor: user.userId,
      numeroContrato,
      numeroConsecutivo,
      numeroContratoClienteProveedor: parsed.numeroContratoClienteProveedor || null,
      fechaInicio: new Date(parsed.fechaInicio),
      fechaFin: parsed.fechaFin ? new Date(parsed.fechaFin) : null,
      monto: parsed.monto || null,
      moneda: parsed.moneda,
      esMultiMoneda: parsed.esMultiMoneda ?? false,
      condiciones: parsed.condiciones ?? undefined,
      observaciones: parsed.observaciones || null,
      clienteId: parsed.clienteId || null,
      vendorId: parsed.vendorId || null,
    }),
    create: async (data) => {
      const c = await prisma.contrato.create({
        data,
        include: { cliente: true, vendor: true, creador: { select: { userId: true, name: true, email: true } } },
      });
      // Crear versión inicial
      await prisma.contratoVersion.create({
        data: {
          contratoId: c.contratoId,
          numeroVersion: 1,
          contenido: { condiciones: parsed.condiciones },
          cambios: 'Versión inicial',
          creadoPor: user.userId,
        },
      });
      // Actualizar número de contrato en el cliente
      if (parsed.clienteId) {
        await prisma.cliente.update({
          where: { clienteId: parsed.clienteId },
          data: { numeroContrato: c.numeroContrato },
        });
      }
      return c;
    },
  });

  revalidatePath('/busy/contratos');
  return contrato;
});

export const updateContratoAction = withAction(async (input: ContratoUpdateInput, user: AuthenticatedUser) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  const parsed = contratoUpdateSchema.parse(input);
  const { contratoId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.contrato.findFirst({
    where: { contratoId, tenantId },
  });
  if (!existing) throw new ActionError('Contrato no encontrado', 'NOT_FOUND');

  const updateData: any = {};
  // CTF-2: estado, fechaAprobacion y aprobadoPor no provienen del payload;
  // el ciclo de vida solo cambia por cambiarEstadoContratoAction (CTF-1).
  if (data.tipo !== undefined) updateData.tipo = data.tipo;
  if (data.monto !== undefined) updateData.monto = data.monto;
  if (data.moneda !== undefined) updateData.moneda = data.moneda;
  if (data.esMultiMoneda !== undefined) updateData.esMultiMoneda = data.esMultiMoneda;
  if (data.condiciones !== undefined) updateData.condiciones = data.condiciones;
  if (data.observaciones !== undefined) updateData.observaciones = data.observaciones;
  if (data.numeroContratoClienteProveedor !== undefined) updateData.numeroContratoClienteProveedor = data.numeroContratoClienteProveedor;
  if (data.fechaInicio !== undefined) updateData.fechaInicio = new Date(data.fechaInicio);
  if (data.fechaFin !== undefined) updateData.fechaFin = data.fechaFin ? new Date(data.fechaFin) : null;
  if (data.clienteId !== undefined) updateData.cliente = data.clienteId ? { connect: { clienteId: data.clienteId } } : { disconnect: true };
  if (data.vendorId !== undefined) updateData.vendor = data.vendorId ? { connect: { vendorId: data.vendorId } } : { disconnect: true };

  const contrato = await prisma.contrato.update({
    where: { contratoId },
    data: updateData,
    include: {
      cliente: true,
      vendor: true,
      creador: { select: { userId: true, name: true, email: true } },
      aprobador: { select: { userId: true, name: true, email: true } },
    },
  });

  if (data.clienteId && contrato.numeroContrato) {
    await prisma.cliente.update({
      where: { clienteId: data.clienteId },
      data: { numeroContrato: contrato.numeroContrato },
    });
  }

  revalidatePath('/busy/contratos');
  return contrato;
});

export const deleteContratoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  const tenantId = requireTenant(user);
  const contrato = await prisma.contrato.findFirst({
    where: { contratoId: id, tenantId },
    select: { clienteId: true, numeroContrato: true },
  });
  if (!contrato) throw new ActionError('Contrato no encontrado', 'NOT_FOUND');

  if (contrato.clienteId) {
    await prisma.cliente.update({
      where: { clienteId: contrato.clienteId },
      data: { numeroContrato: null },
    });
  }

  await prisma.contrato.delete({ where: { contratoId: id } });
  revalidatePath('/busy/contratos');
  return { id, eliminado: true };
});

/**
 * @description Cambia el estado de un contrato validando la transición contra
 *              la máquina de estados (CTF-1). Los efectos sobre el aprobador
 *              son siempre server-side: al aprobar asigna el usuario autenticado;
 *              al volver a estados tempranos o anular limpia el aprobador; al
 *              activar o finalizar lo conserva.
 * @param {CambioEstadoInput} input - contratoId, estado destino y motivo opcional.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<Contrato>} Contrato actualizado con relaciones de interés.
 * @throws {ActionError} NOT_FOUND fuera del tenant; TRANSICION_INVALIDA si la
 *   transición no está permitida.
 */
export const cambiarEstadoContratoAction = withAction(async (input: CambioEstadoInput, user: AuthenticatedUser) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  requirePermission(user, 'ventas.contratos.gestionar', 'gestionar contratos');
  const parsed = cambioEstadoSchema.parse(input);
  const tenantId = requireTenant(user);

  const existing = await prisma.contrato.findFirst({
    where: { contratoId: parsed.contratoId, tenantId },
  });
  if (!existing) throw new ActionError('Contrato no encontrado', 'NOT_FOUND');

  assertTransicionValida(existing.estado, parsed.estado);

  const updateData: any = { estado: parsed.estado };
  if (parsed.estado === 'APROBADO') {
    updateData.aprobadoPor = user.userId;
    updateData.fechaAprobacion = new Date();
  } else if (parsed.estado !== 'ACTIVO' && parsed.estado !== 'FINALIZADO') {
    updateData.aprobadoPor = null;
    updateData.fechaAprobacion = null;
  }

  // B-2: claim condicional sobre el estado leído. Si el contrato cambió de
  // estado entre la validación y la escritura (p. ej. una anulación
  // concurrente), el claim afecta 0 filas y NO se revive un estado terminal.
  const claim = await prisma.contrato.updateMany({
    where: { contratoId: parsed.contratoId, tenantId, estado: existing.estado },
    data: updateData,
  });
  if (claim.count === 0) {
    throw new ActionError(
      `No se puede cambiar un contrato de ${existing.estado} a ${parsed.estado}`,
      'TRANSICION_INVALIDA',
    );
  }

  const contrato = await prisma.contrato.findFirst({
    where: { contratoId: parsed.contratoId, tenantId },
    include: {
      cliente: true,
      vendor: true,
      creador: { select: { userId: true, name: true, email: true } },
      aprobador: { select: { userId: true, name: true, email: true } },
    },
  });
  if (!contrato) throw new ActionError('Contrato no encontrado', 'NOT_FOUND');

  await AuditLogService.log({
    accion: 'UPDATE',
    entidad: 'CONTRATO',
    entidadId: parsed.contratoId,
    usuarioId: user.userId,
    detalles: { desde: existing.estado, hacia: parsed.estado, ...(parsed.motivo ? { motivo: parsed.motivo } : {}) },
  });

  revalidatePath('/busy/contratos');
  return contrato;
});

/**
 * @description Cambio masivo de estado de contratos validando cada transición
 *              contra la máquina de estados (CTF-1). Aplica un único updateMany
 *              con los contratos cuya transición es válida y reporta los
 *              fallidos por id con su motivo; nunca lanza por transiciones inválidas.
 * @param {BulkStatusInput} input - ids de contratos y estado destino.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<{ success: true; actualizados: string[]; fallidos: Array<{ contratoId: string; motivo: string }> }>} Resultado por id.
 */
export const bulkUpdateContratoStatusAction = withAction(async (input: BulkStatusInput, user: AuthenticatedUser) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  const parsed = bulkStatusSchema.parse(input);
  const tenantId = requireTenant(user);

  const contratos = await prisma.contrato.findMany({
    where: { contratoId: { in: parsed.ids }, tenantId },
    select: { contratoId: true, estado: true },
  });

  let actualizados: string[] = [];
  const fallidos: { contratoId: string; motivo: string }[] = [];
  const idsEncontrados = new Set<string>();
  for (const c of contratos) {
    idsEncontrados.add(c.contratoId);
    try {
      assertTransicionValida(c.estado, parsed.estado);
      actualizados.push(c.contratoId);
    } catch (error) {
      fallidos.push({
        contratoId: c.contratoId,
        motivo: error instanceof ActionError ? error.message : 'Error al validar la transición',
      });
    }
  }
  for (const id of parsed.ids) {
    if (!idsEncontrados.has(id)) {
      fallidos.push({ contratoId: id, motivo: 'Contrato no encontrado' });
    }
  }

  if (actualizados.length > 0) {
    // B-2: claim condicional por estado de origen. Solo se reclaman filas cuyo
    // estado vivo sigue siendo uno de los validados; una anulación concurrente
    // gana y el contrato queda fuera del updateMany.
    const estadosOrigen = [...new Set(contratos.filter((c) => actualizados.includes(c.contratoId)).map((c) => c.estado))];
    await prisma.contrato.updateMany({
      where: { contratoId: { in: actualizados }, tenantId, estado: { in: estadosOrigen } },
      data: { estado: parsed.estado },
    });
    // Reconciliación honesta por id: quien no quedó en el estado destino tras
    // el claim se reporta como fallido, no como actualizado.
    const reclamados = await prisma.contrato.findMany({
      where: { contratoId: { in: actualizados }, tenantId, estado: parsed.estado },
      select: { contratoId: true },
    });
    const confirmados = new Set(reclamados.map((c) => c.contratoId));
    const conCambioConcurrente = actualizados.filter((id) => !confirmados.has(id));
    for (const id of conCambioConcurrente) {
      fallidos.push({ contratoId: id, motivo: 'El contrato cambió de estado concurrentemente' });
    }
    actualizados = actualizados.filter((id) => confirmados.has(id));
  }

  revalidatePath('/busy/contratos');
  return { success: true as const, actualizados, fallidos };
});

export const bulkDeleteContratosAction = withAction(async (input: BulkDeleteInput, user: AuthenticatedUser) => {
  requireFeature(user, 'contratos', 'gestionar contratos');
  const parsed = bulkDeleteSchema.parse(input);
  const tenantId = requireTenant(user);

  // Clean up client references
  const contratos = await prisma.contrato.findMany({
    where: { contratoId: { in: parsed.ids }, tenantId },
    select: { contratoId: true, clienteId: true },
  });

  const contratoIds = contratos.map((c) => c.contratoId);

  // Disconnect clients
  for (const c of contratos) {
    if (c.clienteId) {
      await prisma.cliente.update({
        where: { clienteId: c.clienteId },
        data: { numeroContrato: null },
      });
    }
  }

  await prisma.contrato.deleteMany({ where: { contratoId: { in: contratoIds } } });
  revalidatePath('/busy/contratos');
  return { success: true, count: contratoIds.length };
});
