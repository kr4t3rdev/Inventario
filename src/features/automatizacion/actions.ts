/**
 * @description Server Actions para automatización (triggers y webhooks).
 *
 * @module features/automatizacion/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { triggerAutomatizacionSchema, webhookLealtadSchema } from './schemas';
import type { TriggerAutomatizacionInput, WebhookLealtadInput } from './schemas';

/**
 * @description Crea un nuevo trigger de automatización.
 * @param {TriggerAutomatizacionInput} input - Datos del trigger.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Trigger creado.
 */
export const createTriggerAction = withAction(
  async (input: TriggerAutomatizacionInput, user: AuthenticatedUser) => {
    requireFeature(user, 'automatizacion-triggers', 'crear trigger');
    const parsed = triggerAutomatizacionSchema.parse(input);
    const tenantId = requireTenant(user);

    const trigger = await prisma.triggerAutomatizacion.create({
      data: {
        tenantId,
        nombre: parsed.nombre,
        evento: parsed.evento,
        condiciones: parsed.condiciones as any,
        accion: parsed.accion,
        payload: parsed.payload as any,
        canal: parsed.canal,
        delayMinutos: parsed.delayMinutos,
        activo: parsed.activo,
        vecesMaximo: parsed.vecesMaximo ?? null,
      },
    });

    revalidatePath('/busy/automatizacion');
    return trigger;
  },
);

/**
 * @description Actualiza un trigger existente.
 * @param {object} input - ID y campos a actualizar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Trigger actualizado.
 */
export const updateTriggerAction = withAction(
  async (input: { triggerId: string; [key: string]: unknown }, user: AuthenticatedUser) => {
    requireFeature(user, 'automatizacion-triggers', 'editar trigger');
    const tenantId = requireTenant(user);

    const existente = await prisma.triggerAutomatizacion.findFirst({
      where: { triggerId: input.triggerId, tenantId },
    });
    if (!existente) throw new ActionError('Trigger no encontrado', 'NOT_FOUND');

    const { triggerId, ...data } = input;
    const trigger = await prisma.triggerAutomatizacion.update({
      where: { triggerId },
      data,
    });

    revalidatePath('/busy/automatizacion');
    return trigger;
  },
);

/**
 * @description Obtiene todos los triggers de un tenant.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Lista de triggers.
 */
export const getTriggersAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'automatizacion-triggers', 'consultar triggers');
    const tenantId = requireTenant(user);
    return prisma.triggerAutomatizacion.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  },
);

/**
 * @description Crea un nuevo webhook de lealtad.
 * @param {WebhookLealtadInput} input - Datos del webhook.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Webhook creado.
 */
export const createWebhookAction = withAction(
  async (input: WebhookLealtadInput, user: AuthenticatedUser) => {
    requireFeature(user, 'automatizacion-webhooks', 'crear webhook');
    const parsed = webhookLealtadSchema.parse(input);
    const tenantId = requireTenant(user);

    const webhook = await prisma.webhookLealtad.create({
      data: {
        tenantId,
        url: parsed.url,
        eventos: parsed.eventos,
        secreto: parsed.secreto,
        activo: parsed.activo,
      },
    });

    revalidatePath('/busy/automatizacion');
    return webhook;
  },
);

/**
 * @description Obtiene todos los webhooks de un tenant.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Lista de webhooks.
 */
export const getWebhooksAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'automatizacion-webhooks', 'consultar webhooks');
    const tenantId = requireTenant(user);
    return prisma.webhookLealtad.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  },
);

/**
 * @description Desactiva un trigger.
 * @param {string} triggerId - ID del trigger.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Trigger desactivado.
 */
export const disableTriggerAction = withAction(
  async (triggerId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'automatizacion-triggers', 'desactivar trigger');
    const tenantId = requireTenant(user);

    const existente = await prisma.triggerAutomatizacion.findFirst({
      where: { triggerId, tenantId },
    });
    if (!existente) throw new ActionError('Trigger no encontrado', 'NOT_FOUND');

    const trigger = await prisma.triggerAutomatizacion.update({
      where: { triggerId },
      data: { activo: false },
    });

    revalidatePath('/busy/automatizacion');
    return trigger;
  },
);
