/**
 * @description Server Actions para el feature de Ventas.
 *
 * @module features/ventas/actions
 */
"use server";

import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import { revalidatePath } from "next/cache";
import type { CreateVentaInput, AnularVentaInput, FacturarVentaInput } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { VentaReadService, VENTA_SELECT } from "./services/venta-read-service";
import { VentaMutationService } from "./services/venta-mutation-service";
import { VentaLifecycleService } from "./services/venta-lifecycle-service";

// ─── Server Actions ────────────────────────────────────────

/**
 * @description Lista todas las ventas del tenant.
 */
export const getVentasAction = withAction(
	async (_input: void, user: AuthenticatedUser) => {
		requireFeature(user, 'ventas-pos', 'ver ventas');
		const tenantId = requireTenant(user);
		return VentaReadService.list(tenantId);
	},
);

/**
 * @description Crea una venta con sus líneas y genera la factura correspondiente.
 * Calcula totales, descuenta stock, y maneja facturación.
 */
export const createVentaAction = withAction(
	async (input: CreateVentaInput, user: AuthenticatedUser) => {
		const result = await VentaMutationService.create({ input, user });
		revalidatePath("/busy/sales");
		return result;
	},
);

/**
 * @description Anula una venta por ID.
 *
 * @throws ActionError si la venta no existe
 */
/**
 * @description Obtiene una venta por ID del tenant autenticado.
 *
 * @throws ActionError si la venta no existe
 */
export const getVentaByIdAction = withAction(
	async (id: string, user: AuthenticatedUser) => {
		requireFeature(user, 'ventas-pos', 'ver ventas');
		const tenantId = requireTenant(user);
		return VentaReadService.getById({ tenantId, ventaId: id });
	},
);

/**
 * @description Actualiza datos básicos de una venta (no items).
 *
 * @throws ActionError si la venta no existe
 */
export const updateVentaAction = withAction(
	async (
		input: { ventaId: string } & Partial<{
			observaciones: string;
			descuento: number;
		}>,
		user: AuthenticatedUser,
	) => {
		const updated = await VentaMutationService.update({ input, user });
		revalidatePath("/busy/sales");
		return updated;
	},
);

export const anularVentaAction = withAction(
	async (input: AnularVentaInput, user: AuthenticatedUser) => {
		const result = await VentaMutationService.cancel({ input, user });
		revalidatePath("/busy/sales");
		return result;
	},
);

/**
 * @description Entrega un pedido de venta (PEDIDO → ENTREGADA): descuenta stock,
 * registra kardex y aplica FIFO. Permiso: ventas.pedido.gestionar.
 */
export const entregarVentaAction = withAction(
	async (ventaId: string, user: AuthenticatedUser) => {
		requireFeature(user, 'ventas-pedidos', 'gestionar pedidos de venta');
		const result = await VentaLifecycleService.entregarVenta({ ventaId, user });
		revalidatePath("/busy/sales");
		return result;
	},
);

/**
 * @description Factura una venta entregada (ENTREGADA → FACTURADA): crea la
 * factura con serie y registra el cobro/CxC. Permiso: ventas.pedido.gestionar.
 */
export const facturarVentaAction = withAction(
	async (
		params: { ventaId: string; input: FacturarVentaInput },
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'ventas-pedidos', 'gestionar pedidos de venta');
		const result = await VentaLifecycleService.facturarVenta({
			ventaId: params.ventaId,
			input: params.input,
			user,
		});
		revalidatePath("/busy/sales");
		return result;
	},
);
