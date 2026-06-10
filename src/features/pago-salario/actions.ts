/**
 * @description Server Actions para pago de salarios.
 *
 * @module features/pago-salario/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant, requireManagerRole } from "@/lib/services/tenant-scope";
import { pagoSalarioSchema, pagoSalarioUpdateSchema } from "./schemas";
import type { PagoSalarioInput, PagoSalarioUpdateInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

const PAGO_SALARIO_INCLUDE = { empleado: true } as const;

export const getPagoSalariosAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		requireFeature(user, 'nomina', 'gestionar nómina');
		const tenantId = requireTenant(user);
		return prisma.pagosalario.findMany({
			where: { tenantId },
			include: PAGO_SALARIO_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	},
);

export const getPagoSalarioByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'nomina', 'gestionar nómina');
		const tenantId = requireTenant(user);
		const pago = await prisma.pagosalario.findFirst({
			where: { pgId: id, tenantId },
			include: PAGO_SALARIO_INCLUDE,
		});
		if (!pago)
			throw new ActionError("Pago de salario no encontrado", "NOT_FOUND");
		return pago;
	},
);

export const createPagoSalarioAction = withAction(
	async (input: PagoSalarioInput, user: AuthenticatedUser) => {
		requireFeature(user, 'nomina', 'gestionar nómina');
		requireManagerRole(user, "crear pagos de salario");
		const parsed = pagoSalarioSchema.parse(input);
		const tenantId = requireTenant(user);

		const empleado = await prisma.empleado.findFirst({
			where: { empleadoId: parsed.empleadoId, tenantId },
		});
		if (!empleado) throw new ActionError("Empleado no encontrado", "NOT_FOUND");

		const now = new Date();
		const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

		const pago = await prisma.pagosalario.create({
			data: {
				empleadoId: parsed.empleadoId,
				salario: parsed.salario,
				periodo,
				bonificaciones: parsed.bonificaciones ?? 0,
				deducciones: parsed.deducciones ?? 0,
				horasExtras: parsed.horasExtras ?? 0,
				observaciones: parsed.observaciones ?? null,
				tenantId,
			},
			include: PAGO_SALARIO_INCLUDE,
		});

		revalidatePath("/busy/pago-salario");
		return pago;
	},
);

export const updatePagoSalarioAction = withAction(
	async (input: PagoSalarioUpdateInput, user: AuthenticatedUser) => {
		requireFeature(user, 'nomina', 'gestionar nómina');
		requireManagerRole(user, "editar pagos de salario");
		const parsed = pagoSalarioUpdateSchema.parse(input);
		const { pgId, ...data } = parsed;
		const tenantId = requireTenant(user);

		const existing = await prisma.pagosalario.findFirst({
			where: { pgId, tenantId },
		});
		if (!existing)
			throw new ActionError("Pago de salario no encontrado", "NOT_FOUND");

		const pago = await prisma.pagosalario.update({
			where: { pgId },
			data: {
				...(data.empleadoId !== undefined && { empleadoId: data.empleadoId }),
				...(data.salario !== undefined && { salario: data.salario }),
				...(data.bonificaciones !== undefined && {
					bonificaciones: data.bonificaciones,
				}),
				...(data.deducciones !== undefined && {
					deducciones: data.deducciones,
				}),
				...(data.horasExtras !== undefined && {
					horasExtras: data.horasExtras,
				}),
				...(data.observaciones !== undefined && {
					observaciones: data.observaciones,
				}),
			},
			include: PAGO_SALARIO_INCLUDE,
		});

		revalidatePath("/busy/pago-salario");
		return pago;
	},
);

export const deletePagoSalarioAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'nomina', 'gestionar nómina');
		requireManagerRole(user, "eliminar pagos de salario");
		const tenantId = requireTenant(user);
		const existing = await prisma.pagosalario.findFirst({
			where: { pgId: id, tenantId },
		});
		if (!existing)
			throw new ActionError("Pago de salario no encontrado", "NOT_FOUND");

		await prisma.pagosalario.delete({ where: { pgId: id } });
		revalidatePath("/busy/pago-salario");
		return { success: true };
	},
);
