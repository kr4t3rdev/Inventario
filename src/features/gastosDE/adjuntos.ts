/**
 * @description Server Actions de adjuntos de comprobante para gastos (F-4).
 * Usa `CloudinaryAsset` con `ownerType: 'gastoDE'` y `slot: 'comprobante'`
 * (0..N por gasto). El binario sube directo a Cloudinary desde el cliente con
 * las firmas existentes; aquí solo se registran/listan/soft-deletan metadatos.
 *
 * @module features/gastosDE/adjuntos
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ActionError, withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { recordOwnerAsset } from '@/lib/upload/cloudinary-admin';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Registra un adjunto de comprobante para un gasto del tenant.
 * @param {object} input - { gastosDEId, publicId, secureUrl, bytes?, mimeType?, originalFilename?, position? }.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} { success } tras registrar los metadatos.
 */
export const registrarAdjuntoGastoAction = withAction(
  async (
    input: {
      gastosDEId: string;
      publicId: string;
      secureUrl: string;
      bytes?: number;
      mimeType?: string;
      originalFilename?: string;
      position?: number;
    },
    user: AuthenticatedUser,
  ) => {
    const parsed = z
      .object({
        gastosDEId: z.string().min(1),
        publicId: z.string().min(1),
        secureUrl: z.string().url('La URL del archivo no es válida'),
        bytes: z.coerce.number().int().nonnegative().optional(),
        mimeType: z.enum([
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
          'image/gif',
        ]).optional(),
        originalFilename: z.string().max(255).optional(),
        position: z.coerce.number().int().nonnegative().optional(),
      })
      .parse(input);
    const tenantId = requireTenant(user);
    requireFeature(user, 'gastos', 'adjuntar comprobantes');

    const gasto = await prisma.gastosDE.findFirst({
      where: { gastosDEId: parsed.gastosDEId, tenantId },
    });
    if (!gasto) {
      throw new ActionError('Gasto no encontrado', 'NOT_FOUND');
    }

    const expectedPrefix = `${tenantId}/gastosDE/${parsed.gastosDEId}/comprobantes/`;
    const publicIdSuffix = parsed.publicId.startsWith(expectedPrefix)
      ? parsed.publicId.slice(expectedPrefix.length)
      : '';
    const attachmentExtension = publicIdSuffix.split('.').at(-1);
    const expectedExtensionByMime: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    let uploadUrl: URL;
    try {
      uploadUrl = new URL(parsed.secureUrl);
    } catch {
      throw new ActionError('La URL del comprobante no es válida', 'INVALID_INPUT');
    }
    const cloudinaryRawPublicId = uploadUrl.pathname.match(
      /^\/[^/]+\/raw\/upload\/(?:v\d+\/)?(.+)$/,
    )?.[1];
    if (
      uploadUrl.protocol !== 'https:' ||
      uploadUrl.hostname !== 'res.cloudinary.com' ||
      !/^[\w-]+\.(pdf|doc|docx|jpg|png|webp|gif)$/.test(publicIdSuffix) ||
      (parsed.mimeType !== undefined &&
        expectedExtensionByMime[parsed.mimeType] !== attachmentExtension) ||
      (parsed.bytes !== undefined && parsed.bytes > 10 * 1024 * 1024) ||
      cloudinaryRawPublicId !== parsed.publicId
    ) {
      throw new ActionError('El comprobante no pertenece a este gasto', 'INVALID_INPUT');
    }

    await recordOwnerAsset({
      tenantId,
      ownerType: 'gastoDE',
      ownerId: parsed.gastosDEId,
      slot: 'comprobante',
      asset: {
        // uploadKey descriptivo: el binario ya subió directo a Cloudinary;
        // aquí solo se registran los metadatos del comprobante.
        uploadKey: `gastoDE:${parsed.gastosDEId}:${parsed.publicId}`,
        publicId: parsed.publicId,
        secureUrl: parsed.secureUrl,
        resourceType: 'raw',
        bytes: parsed.bytes ?? 0,
        mimeType: parsed.mimeType ?? 'application/octet-stream',
        originalFilename: parsed.originalFilename ?? parsed.publicId,
      },
      position: parsed.position ?? null,
    });

    revalidatePath('/busy/gastosDE');
    return { ok: true };
  },
);

/**
 * @description Lista los adjuntos activos de un gasto (ownerType 'gastoDE'),
 * ordenados por posición.
 * @param {string} gastosDEId - Identificador del gasto.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Lista de adjuntos activos.
 */
export const getAdjuntosGastoAction = withAction(
  async (gastosDEId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'gastos', 'consultar comprobantes');

    const adjuntos = await prisma.cloudinaryAsset.findMany({
      where: {
        tenantId,
        ownerType: 'gastoDE',
        ownerId: gastosDEId,
        status: 'active',
      },
      orderBy: { position: 'asc' },
    });
    return adjuntos;
  },
);

/**
 * @description Soft-delete de un adjunto del tenant (status 'deleted' +
 * deletedAt), sin perder historial.
 * @param {string} assetId - Identificador del adjunto.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Adjunto actualizado.
 */
export const removeAdjuntoGastoAction = withAction(
  async (assetId: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    requireFeature(user, 'gastos', 'eliminar comprobantes');

    const adjunto = await prisma.cloudinaryAsset.findFirst({
      where: { assetId, tenantId, ownerType: 'gastoDE' },
    });
    if (!adjunto) {
      throw new ActionError('Adjunto no encontrado', 'NOT_FOUND');
    }

    return prisma.cloudinaryAsset.update({
      where: { assetId },
      data: { status: 'deleted', deletedAt: new Date() },
    });
  },
);
