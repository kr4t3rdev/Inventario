import { revalidatePath } from 'next/cache';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

import {
	settleInitialPayableInput,
	settleInitialReceivableInput,
} from './services/initial-subledger-settlement-contract';
import {
	InitialSubledgerSettlementError,
	settleInitialPayable,
	settleInitialReceivable,
} from './services/initial-subledger-settlement-writer';
import { parseCutoffDate } from './services/initialization-coordinator';
import { guardAccountingWriteInTransaction } from './services/period-close-write-guard';

/**
 * @description Server actions de liquidación de submayor inicial externa
 * (tarea 4, tramo 2). Solo ruta de servidor: no hay UI en este tramo.
 *
 * Cada action valida el contrato, el permiso de la familia (cobrar/pagar),
 * el periodo contable de la fecha efectiva y delega en el writer dentro de
 * una transacción. Los errores del writer se trasladan como ActionError con
 * el mismo código para que el cliente los distinga.
 */
function toActionError(error: unknown): unknown {
	if (error instanceof InitialSubledgerSettlementError) {
		return new ActionError(error.message, error.code);
	}
	return error;
}

export const settleInitialReceivableAction = withAction(
	async (input: unknown, user: AuthenticatedUser) => {
		requireFeature(user, 'cuentas-cobrar', 'cobrar cuentas por cobrar');
		const parsed = settleInitialReceivableInput.parse(input);
		const tenantId = requireTenant(user);
		const fechaEfectiva = parseCutoffDate(parsed.fechaEfectiva);
		try {
			const result = await prisma.$transaction(async (tx) => {
				await guardAccountingWriteInTransaction({
					client: tx,
					tenantId,
					businessDate: fechaEfectiva,
					actorId: user.userId,
				});
				const result = await settleInitialReceivable(tx, {
					tenantId,
					cuentaPorCobrarId: parsed.cuentaPorCobrarId,
					cuentaId: parsed.cuentaId,
					tipoPagoId: parsed.tipoPagoId,
					monto: parsed.monto,
					fechaEfectiva,
					referencia: parsed.referencia,
					observaciones: parsed.observaciones,
					actorId: user.userId,
				});
				await AuditLogService.logStrict({
					accion: 'CREATE',
					entidad: 'RECONCILIACION',
					entidadId: result.reconciliacionId!,
					usuarioId: user.userId,
					detalles: {
						origen: 'INICIALIZACION_CONTABLE',
						cuentaPorCobrarId: parsed.cuentaPorCobrarId,
						cuentaId: parsed.cuentaId,
						monto: parsed.monto,
						estado: result.estado,
					},
				}, tx);
				return result;
			});
			revalidatePath('/busy/contabilidad/cuentas-por-cobrar');
			return { success: true, ...result };
		} catch (error) {
			throw toActionError(error);
		}
	},
);

export const settleInitialPayableAction = withAction(
	async (input: unknown, user: AuthenticatedUser) => {
		requireFeature(user, 'cuentas-pagar', 'pagar cuentas por pagar');
		const parsed = settleInitialPayableInput.parse(input);
		const tenantId = requireTenant(user);
		const fechaEfectiva = parseCutoffDate(parsed.fechaEfectiva);
		try {
			const result = await prisma.$transaction(async (tx) => {
				await guardAccountingWriteInTransaction({
					client: tx,
					tenantId,
					businessDate: fechaEfectiva,
					actorId: user.userId,
				});
				const result = await settleInitialPayable(tx, {
					tenantId,
					cuentaPorPagarId: parsed.cuentaPorPagarId,
					cuentaId: parsed.cuentaId,
					monto: parsed.monto,
					fechaEfectiva,
					referencia: parsed.referencia,
					cuentaProveedor: parsed.cuentaProveedor,
					observaciones: parsed.observaciones,
					actorId: user.userId,
				});
				await AuditLogService.logStrict({
					accion: 'CREATE',
					entidad: 'PAGO_CUENTA_POR_PAGAR',
					entidadId: result.pagoCuentaPorPagarId!,
					usuarioId: user.userId,
					detalles: {
						origen: 'INICIALIZACION_CONTABLE',
						cuentaPorPagarId: parsed.cuentaPorPagarId,
						cuentaId: parsed.cuentaId,
						monto: parsed.monto,
						estado: result.estado,
					},
				}, tx);
				return result;
			});
			revalidatePath('/busy/contabilidad/cuentas-por-pagar');
			return { success: true, ...result };
		} catch (error) {
			throw toActionError(error);
		}
	},
);
