/**
 * @description Server Actions para CRM: segmentación y deduplicación.
 *
 * @module features/crm/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { cumpleSegmento, normalizarClienteParaSegmento } from './services/segmento-engine';
import { encontrarDuplicados } from './services/deduplication-service';

// ─── Segmentos ─────────────────────────────────────────────────────────

/**
 * @description Obtiene todos los segmentos de un tenant.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Lista de segmentos.
 */
export const getSegmentosAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'crm-segmentacion', 'consultar segmentos');
    const tenantId = requireTenant(user);
    return prisma.segmentoCliente.findMany({
      where: { tenantId },
      orderBy: { nombre: 'asc' },
    });
  },
);

/**
 * @description Crea un nuevo segmento de clientes.
 * @param {object} input - Datos del segmento.
 * @param {string} input.nombre - Nombre del segmento.
 * @param {string} input.tipo - Tipo: MANUAL, AUTOMATICO, RFM.
 * @param {object} input.reglas - Reglas JSON del segmento.
 * @param {string} [input.descripcion] - Descripción opcional.
 * @param {string} [input.color] - Color para UI.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Segmento creado.
 */
export const createSegmentoAction = withAction(
  async (
    input: {
      nombre: string;
      tipo: 'MANUAL' | 'AUTOMATICO' | 'RFM';
      reglas: Record<string, unknown>;
      descripcion?: string;
      color?: string;
    },
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'crm-segmentacion', 'crear segmentos');
    const tenantId = requireTenant(user);

    const segmento = await prisma.segmentoCliente.create({
      data: {
        tenantId,
        nombre: input.nombre,
        tipo: input.tipo,
        reglas: input.reglas as any,
        descripcion: input.descripcion ?? null,
        color: input.color ?? null,
      },
    });

    revalidatePath('/busy/crm');
    return segmento;
  },
);

/**
 * @description Asigna un segmento a un cliente manualmente.
 * @param {object} input - IDs del cliente y segmento.
 * @param {string} input.clienteId - ID del cliente.
 * @param {string} input.segmentoId - ID del segmento.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Asignación creada.
 */
export const asignarSegmentoAction = withAction(
  async (input: { clienteId: string; segmentoId: string }, user: AuthenticatedUser) => {
    requireFeature(user, 'crm-segmentacion', 'asignar segmentos');
    const tenantId = requireTenant(user);

    // Verificar que el segmento pertenece al tenant
    const segmento = await prisma.segmentoCliente.findFirst({
      where: { segmentoId: input.segmentoId, tenantId },
    });
    if (!segmento) throw new ActionError('Segmento no encontrado', 'NOT_FOUND');

    // Verificar que el cliente pertenece al tenant
    const cliente = await prisma.cliente.findFirst({
      where: { clienteId: input.clienteId, tenantId },
    });
    if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');

    const asignacion = await prisma.clienteSegmento.create({
      data: {
        tenantId,
        clienteId: input.clienteId,
        segmentoId: input.segmentoId,
        asignadoPor: 'MANUAL',
      },
    });

    revalidatePath('/busy/crm');
    return asignacion;
  },
);

/**
 * @description Ejecuta la segmentación automática: evalúa todos los clientes
 * contra los segmentos automáticos y actualiza las asignaciones.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resumen de la ejecución.
 */
export const ejecutarSegmentacionAutoAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'crm-segmentacion', 'ejecutar segmentación automática');
    const tenantId = requireTenant(user);

    // Obtener segmentos automáticos
    const segmentosAuto = await prisma.segmentoCliente.findMany({
      where: { tenantId, tipo: { in: ['AUTOMATICO', 'RFM'] }, activo: true },
    });

    // Obtener todos los clientes del tenant con campos CDP
    const clientes = await prisma.cliente.findMany({
      where: { tenantId },
      select: {
        clienteId: true,
        ultimaCompra: true,
        cantidadCompras: true,
        totalComprado: true,
        tags: true,
        canalPreferido: true,
        segmento: true,
        metadata: true,
      },
    });

    let asignados = 0;
    let removidos = 0;

    for (const segmento of segmentosAuto) {
      const reglas = segmento.reglas as Record<string, unknown> | null;
      if (!reglas) continue;

      for (const cliente of clientes) {
        const datos = normalizarClienteParaSegmento(cliente as any);
        const cumple = cumpleSegmento(reglas, datos);

        const asignacionExistente = await prisma.clienteSegmento.findFirst({
          where: {
            tenantId,
            clienteId: cliente.clienteId,
            segmentoId: segmento.segmentoId,
          },
        });

        if (cumple && !asignacionExistente) {
          await prisma.clienteSegmento.create({
            data: {
              tenantId,
              clienteId: cliente.clienteId,
              segmentoId: segmento.segmentoId,
              asignadoPor: 'AUTO',
            },
          });
          asignados++;
        } else if (!cumple && asignacionExistente && asignacionExistente.asignadoPor === 'AUTO') {
          await prisma.clienteSegmento.delete({
            where: { id: asignacionExistente.id },
          });
          removidos++;
        }
      }
    }

    // Actualizar clientesCount
    for (const segmento of segmentosAuto) {
      const count = await prisma.clienteSegmento.count({
        where: { tenantId, segmentoId: segmento.segmentoId },
      });
      await prisma.segmentoCliente.update({
        where: { segmentoId: segmento.segmentoId },
        data: { clientesCount: count },
      });
    }

    revalidatePath('/busy/crm');
    return { asignados, removidos, segmentosProcesados: segmentosAuto.length, clientesProcesados: clientes.length };
  },
);

/**
 * @description Obtiene los segmentos asignados a un cliente.
 * @param {string} clienteId - ID del cliente.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Segmentos con detalles.
 */
export const getSegmentosDeClienteAction = withAction(
  async (clienteId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'crm-segmentacion', 'consultar segmentos de cliente');
    const tenantId = requireTenant(user);

    return prisma.clienteSegmento.findMany({
      where: { tenantId, clienteId },
      include: { segmento: true },
    });
  },
);

// ─── Deduplicación ─────────────────────────────────────────────────────

/**
 * @description Busca clientes duplicados potenciales en el tenant.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Pares de clientes duplicados.
 */
export const buscarDuplicadosAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'crm-cdp', 'buscar duplicados');
    const tenantId = requireTenant(user);

    const clientes = await prisma.cliente.findMany({
      where: { tenantId },
      select: {
        clienteId: true,
        nombre: true,
        email: true,
        telefono: true,
        direccion: true,
        taxIdCliente: true,
      },
    });

    const duplicados = encontrarDuplicados(clientes, {
      email: true,
      telefono: true,
      nombre: true,
      taxId: true,
    });

    return duplicados.map((d) => ({
      clienteA: d.clienteA,
      clienteB: d.clienteB,
      criteriosMatch: d.criteriosMatch,
      similitud: d.similitud,
    }));
  },
);

/**
 * @description Fusiona dos clientes duplicados. El cliente principal
 * mantiene su ID; el secundario se elimina y sus relaciones se
 * reasignan al principal.
 * @param {object} input - IDs de los clientes a fusionar.
 * @param {string} input.clientePrincipal - ID del cliente que se mantiene.
 * @param {string} input.clienteSecundario - ID del cliente que se elimina.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado de la fusión.
 */
export const fusionarClientesAction = withAction(
  async (
    input: { clientePrincipal: string; clienteSecundario: string },
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'crm-cdp', 'fusionar clientes duplicados');
    const tenantId = requireTenant(user);

    await prisma.$transaction(async (tx) => {
      // Verificar ambos clientes existen y pertenecen al tenant
      const principal = await tx.cliente.findFirst({
        where: { clienteId: input.clientePrincipal, tenantId },
      });
      const secundario = await tx.cliente.findFirst({
        where: { clienteId: input.clienteSecundario, tenantId },
      });

      if (!principal) throw new ActionError('Cliente principal no encontrado', 'NOT_FOUND');
      if (!secundario) throw new ActionError('Cliente secundario no encontrado', 'NOT_FOUND');

      // Reasignar ventas del secundario al principal
      await tx.venta.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Reasignar facturas
      await tx.factura.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Reasignar cuentas por cobrar
      await tx.cuentaPorCobrar.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Reasignar contratos
      await tx.contrato.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Reasignar ofertas
      await tx.oferta.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Reasignar anticipos
      await tx.anticipo.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Reasignar lealtad si existe
      await tx.clienteLealtad.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Reasignar segmentos
      await tx.clienteSegmento.updateMany({
        where: { clienteId: input.clienteSecundario, tenantId },
        data: { clienteId: input.clientePrincipal },
      });

      // Registrar la fusión
      await tx.clienteDuplicado.create({
        data: {
          tenantId,
          clientePrincipal: input.clientePrincipal,
          clientesFusionados: [input.clientePrincipal, input.clienteSecundario],
          criteriosMatch: { email: true, telefono: true, nombre: true },
          resueltoPor: user.userId,
        },
      });

      // Eliminar el cliente secundario
      await tx.cliente.delete({
        where: { clienteId: input.clienteSecundario },
      });
    });

    revalidatePath('/busy/cliente');
    return { fusionado: true, clientePrincipal: input.clientePrincipal, clienteEliminado: input.clienteSecundario };
  },
);
