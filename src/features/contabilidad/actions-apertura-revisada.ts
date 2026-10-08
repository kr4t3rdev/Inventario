'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import {
	approveAperturaRevision,
	createAperturaRevisionDraft,
	submitAperturaRevision,
	type AperturaRevisionLineInput,
} from '@/features/contabilidad-formal/services/apertura-revision-service';

const lineSchema = z.object({
	fechaEfectiva: z.coerce.date(),
	lado: z.enum(['DEBE', 'HABER']),
	rolCuenta: z.string().trim().min(1),
	cuentaId: z.string().trim().min(1),
	monedaNativa: z.literal('CUP'),
	importeNativo: z.string().regex(/^\d+(\.\d+)?$/),
	importeFuncional: z.string().regex(/^\d+(\.\d+)?$/),
	fuenteTipo: z.literal('MANUAL'),
	fuenteId: z.string().trim().min(1),
	evidenciaVersion: z.number().int().positive(),
	fuenteSnapshot: z.record(z.unknown()),
}).strict();

const draftSchema = z.object({
	periodoId: z.string().min(1),
	aperturaId: z.string().min(1),
	fechaCorte: z.coerce.date(),
	lines: z.array(lineSchema).min(1),
}).strict();

const revisionIdSchema = z.string().trim().min(1);
const periodIdSchema = z.string().trim().min(1);
const PERIODS_PATH = '/busy/contabilidad/periodos';

/** @description Obtiene revisiones del tenant autenticado, nunca de un tenant indicado por payload. */
export const getAperturaRevisionAction = withAction(async (revisionId: string, user: AuthenticatedUser) => {
	requireFeature(user, 'contabilidad', 'consultar revisiones de apertura');
	const tenantId = requireTenant(user);
	const parsedId = revisionIdSchema.parse(revisionId);
	const revision = await prisma.aperturaRevision.findFirst({
		where: { revisionId: parsedId, tenantId },
		include: { lineas: { orderBy: { fechaEfectiva: 'asc' } } },
	});
	if (!revision) throw new ActionError('Revisión de apertura no encontrada', 'NOT_FOUND');
	return { revision };
});

/** @description Lee el estado de apertura y los roles activos sin consultar saldos heredados. */
export const getAperturaRevisionContextAction = withAction(async (
	periodoId: string, user: AuthenticatedUser,
) => {
	requireFeature(user, 'contabilidad', 'consultar contexto de apertura');
	const tenantId = requireTenant(user);
	const parsedPeriodId = periodIdSchema.parse(periodoId);
	const [periodo, apertura] = await Promise.all([
		prisma.periodoContable.findFirst({
			where: { periodoId: parsedPeriodId, tenantId },
			select: { fechaInicio: true },
		}),
		prisma.aperturaPeriodo.findFirst({
			where: { periodoId: parsedPeriodId, tenantId },
			select: {
				aperturaId: true,
				revisiones: {
					orderBy: { version: 'desc' },
					select: {
						revisionId: true,
						version: true,
						estado: true,
						fechaCorte: true,
						presentadaAt: true,
						revisadaAt: true,
					},
				},
			},
		}),
	]);
	if (!periodo) throw new ActionError('Período contable no encontrado', 'NOT_FOUND');
	const roles = await prisma.cuentaRolTenant.findMany({
		where: { tenantId, cuenta: { tenantId, activa: true } },
		orderBy: { rol: 'asc' },
		select: {
			rol: true,
			cuentaId: true,
			cuenta: { select: { tenantId: true, codigo: true, nombre: true, naturaleza: true } },
		},
	});
	const revisions = apertura?.revisiones ?? [];
	return {
		apertura: apertura ? {
			aperturaId: apertura.aperturaId,
			fechaCorte: revisions[0]?.fechaCorte ?? periodo.fechaInicio,
		} : null,
		revisiones: revisions,
		roles: roles.filter(({ cuenta }) => cuenta.tenantId === tenantId).map(({ rol, cuentaId, cuenta }) => ({
			role: rol,
			accountId: cuentaId,
			label: `${cuenta.codigo} - ${cuenta.nombre}`,
			normalSide: cuenta.naturaleza,
		})),
	};
});

/** @description Crea un borrador inicial de apertura manual CUP para el tenant autenticado. */
export const createAperturaRevisionDraftAction = withAction(async (
	input: z.input<typeof draftSchema>, user: AuthenticatedUser,
) => {
	requireFeature(user, 'contabilidad', 'crear borradores de apertura');
	const parsed = draftSchema.parse(input);
	const revision = await createAperturaRevisionDraft(user, {
		...parsed,
		lines: parsed.lines as AperturaRevisionLineInput[],
	});
	revalidatePath(PERIODS_PATH);
	return { revision };
});

/** @description Presenta un borrador validado por el servicio de revisiones. */
export const submitAperturaRevisionAction = withAction(async (revisionId: string, user: AuthenticatedUser) => {
	requireFeature(user, 'contabilidad', 'presentar revisiones de apertura');
	const revision = await submitAperturaRevision(user, revisionIdSchema.parse(revisionId));
	revalidatePath(PERIODS_PATH);
	return { revision };
});

/** @description Aprueba una revisión presentada y registra su asiento formal. */
export const approveAperturaRevisionAction = withAction(async (revisionId: string, user: AuthenticatedUser) => {
	requireFeature(user, 'contabilidad', 'aprobar revisiones de apertura');
	const result = await approveAperturaRevision(user, revisionIdSchema.parse(revisionId));
	revalidatePath(PERIODS_PATH);
	return result;
});
