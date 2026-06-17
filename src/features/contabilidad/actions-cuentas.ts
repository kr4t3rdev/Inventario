/**
 * @description Server Actions para Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP).
 *
 * Reemplaza los handlers HTTP actuales con acciones tipadas seguras
 * que aplican `requireTenant()`, validación Zod, y paginación server-side.
 *
 * @module features/contabilidad/actions-cuentas
 */
"use server";

import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import { revalidatePath } from "next/cache";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { AccountingAccountsService } from "@/features/contabilidad/services/accounting-accounts-service";
import {
	getCuentasPorCobrarSchema,
	createCuentaPorCobrarSchema,
	updateCuentaPorCobrarSchema,
	getCuentasPorPagarSchema,
	createCuentaPorPagarSchema,
} from "./schemas-cuentas";
import type {
	GetCuentasPorCobrarInput,
	CreateCuentaPorCobrarInput,
	UpdateCuentaPorCobrarInput,
	GetCuentasPorPagarInput,
	CreateCuentaPorPagarInput,
} from "./schemas-cuentas";

// ═══════════════════════════════════════════════════════════
// Tipos de Resultado
// ═══════════════════════════════════════════════════════════

/** Cuenta por Cobrar con cálculos enriquecidos. */
export interface CuentaPorCobrarEnriquecida {
	id: string;
	idCC: number;
	facturaId: string | null;
	numeroFactura: string | null;
	clienteId: string;
	montoDeuda: number;
	montoPagado: number;
	idTransferencia: string | null;
	estado: "PENDIENTE" | "PAGADA" | "PARCIAL";
	tipoCuenta: string | null;
	fechaVencimiento: string | null;
	totalFactura: number;
	totalPagadoFactura: number;
	saldoFactura: number;
	moneda: string;
	cliente: { clienteId: string; nombre: string } | null;
	factura: Record<string, unknown> | null;
	prestamoCash: Record<string, unknown> | null;
	_reconciliaciones: Record<string, unknown>[];
	diasTranscurridos: number;
	rangoAntiguedad: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface GetCuentasPorCobrarResult {
	cuentas: CuentaPorCobrarEnriquecida[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface CxcMetrics {
	totalPendiente: number;
	porVencer: number;
	vencidas: number;
	totalCuentas: number;
}

/** Cuenta por Pagar con antigüedad calculada. */
export interface CuentaPorPagarEnriquecida {
	cuentaPorPagarId: string;
	numeroFactura: string;
	tipo: "compra" | "servicio";
	gastoCompraId: string | null;
	gastosDEId: string | null;
	proveedorId: string | null;
	proveedorNombre: string | null;
	montoDeuda: number;
	montoPagado: number;
	saldoPendiente: number;
	moneda: string;
	fechaEmision: string;
	fechaVencimiento: string | null;
	estado: "PENDIENTE" | "PAGADA" | "PARCIAL";
	tipoDeuda: string | null;
	rangoAntiguedad: string;
	diasTranscurridos: number;
	proveedor: {
		vendorId: string;
		nombre: string;
		cuentaCUP: string | null;
		cuentaUSD: string | null;
	} | null;
	pagos: Array<{
		pagoCuentaPorPagarId: string;
		monto: number;
		numeroTransaccion: string;
		cuentaProveedor: string;
		fechaPago: Date;
		observaciones: string | null;
	}>;
	deudaCash: {
		id: string;
		idNumerico: number;
		montoCapital: number;
		moneda: string;
		estado: string;
	} | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface GetCuentasPorPagarResult {
	cuentas: CuentaPorPagarEnriquecida[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	/** Métricas agregadas sobre TODOS los registros (no solo la página actual). */
	metricas: {
		totalCuentas: number;
		totalFacturado: number;
		totalPagado: number;
		totalSaldo: number;
		cuentasPendientes: number;
		cuentasPagadas: number;
	};
}

// ═══════════════════════════════════════════════════════════
// Selects reutilizables
// ═══════════════════════════════════════════════════════════

const CXC_INCLUDE = {
	cliente: { select: { clienteId: true, nombre: true } },
	factura: {
		select: {
			idFactura: true,
			total: true,
			numeroFactura: true,
			createdAt: true,
			venta: {
				select: {
					ventaId: true,
					total: true,
					reconciliaciones: {
						select: {
							reconciliacionId: true,
							monto: true,
							moneda: true,
							tasaCambio: true,
							idTransferencia: true,
							fechaReconciliacion: true,
							tipoPago: { select: { nombre: true } },
							cuentaBancaria: { select: { nombreBanco: true } },
						},
					},
					cliente: { select: { nombre: true } },
				},
			},
		},
	},
	prestamoCash: {
		select: {
			id: true,
			idNumerico: true,
			montoCapital: true,
			moneda: true,
			tasaCambioAlCrear: true,
			observaciones: true,
			estado: true,
		},
	},
} as const;

const CXP_INCLUDE = {
	proveedor: {
		select: {
			vendorId: true,
			nombre: true,
			cuentaCUP: true,
			cuentaUSD: true,
		},
	},
	pagos: {
		select: {
			pagoCuentaPorPagarId: true,
			monto: true,
			numeroTransaccion: true,
			cuentaProveedor: true,
			fechaPago: true,
			observaciones: true,
		},
		orderBy: { fechaPago: "desc" as const },
	},
	deudaCash: {
		select: {
			id: true,
			idNumerico: true,
			montoCapital: true,
			moneda: true,
			estado: true,
		},
	},
} as const;

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function normalizarMontoReconciliacion(
	monto: number,
	moneda: string,
	tasaCambio: number | null,
): number {
	if (
		moneda === "USD" &&
		tasaCambio &&
		Number.isFinite(Number(tasaCambio)) &&
		Number(tasaCambio) > 0
	) {
		return monto * Number(tasaCambio);
	}
	return monto;
}

function enriquecerCuentaPorCobrar(
	cuenta: Record<string, unknown>,
): CuentaPorCobrarEnriquecida {
	const facturaRecord = cuenta.factura as Record<string, unknown> | null;
	const ventaRecord = facturaRecord?.venta as
		| Record<string, unknown>
		| undefined;
	const recs = (ventaRecord?.reconciliaciones ?? []) as Array<{
		monto: number;
		moneda: string;
		tasaCambio: number | null;
	}>;

	const totalPagadoFactura =
		recs.length > 0
			? recs.reduce(
					(sum, rec) =>
						sum +
						normalizarMontoReconciliacion(
							Number(rec.monto),
							rec.moneda,
							rec.tasaCambio,
						),
					0,
				)
			: Number(cuenta.montoPagado ?? 0);

	const totalFactura = facturaRecord?.total
		? Number(facturaRecord.total)
		: Number(cuenta.montoDeuda ?? 0);
	const saldoFactura = Math.max(0, totalFactura - totalPagadoFactura);

	const createdAt = cuenta.createdAt as Date;
	const aging = computeAging(createdAt);

	return {
		id: cuenta.id as string,
		idCC: cuenta.idCC as number,
		facturaId: cuenta.facturaId as string | null,
		numeroFactura: cuenta.numeroFactura as string | null,
		clienteId: cuenta.clienteId as string,
		montoDeuda: Number(cuenta.montoDeuda),
		montoPagado: Number(cuenta.montoPagado),
		idTransferencia: cuenta.idTransferencia as string | null,
		estado: cuenta.estado as "PENDIENTE" | "PAGADA" | "PARCIAL",
		tipoCuenta: cuenta.tipoCuenta as string | null,
		fechaVencimiento: cuenta.fechaVencimiento as string | null,
		totalFactura,
		totalPagadoFactura,
		saldoFactura,
		moneda: cuenta.moneda as string,
		cliente: cuenta.cliente as { clienteId: string; nombre: string } | null,
		factura: facturaRecord
			? {
					...facturaRecord,
					total: Number(facturaRecord.total),
					venta: (facturaRecord.venta as Record<string, unknown> | null)
						? {
								...(facturaRecord.venta as Record<string, unknown>),
								total: Number(
									(facturaRecord.venta as Record<string, unknown>).total,
								),
							}
						: null,
				}
			: null,
		prestamoCash: cuenta.prestamoCash as Record<string, unknown> | null,
		_reconciliaciones: recs as Record<string, unknown>[],
		diasTranscurridos: aging.diasTranscurridos,
		rangoAntiguedad: aging.rangoAntiguedad,
		createdAt,
		updatedAt: cuenta.updatedAt as Date,
	};
}

function computeAging(fecha: Date): {
	rangoAntiguedad: string;
	diasTranscurridos: number;
} {
	const now = new Date();
	const diffMs = now.getTime() - fecha.getTime();
	const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	let rango: string;
	if (dias <= 30) rango = "0-30";
	else if (dias <= 60) rango = "31-60";
	else if (dias <= 90) rango = "61-90";
	else rango = "90+";
	return { rangoAntiguedad: rango, diasTranscurridos: dias };
}

function enriquecerCuentaPorPagar(
	cuenta: Record<string, unknown>,
): CuentaPorPagarEnriquecida {
	const fechaEmision = cuenta.fechaEmision
		? new Date(cuenta.fechaEmision as string)
		: new Date();
	const aging = isNaN(fechaEmision.getTime())
		? { rangoAntiguedad: "0-30", diasTranscurridos: 0 }
		: computeAging(fechaEmision);
	const pagos =
		(cuenta.pagos as Array<Record<string, unknown>> | undefined) ?? [];

	return {
		cuentaPorPagarId: cuenta.cuentaPorPagarId as string,
		numeroFactura: cuenta.numeroFactura as string,
		tipo: cuenta.tipo as "compra" | "servicio",
		gastoCompraId: cuenta.gastoCompraId as string | null,
		gastosDEId: cuenta.gastosDEId as string | null,
		proveedorId: cuenta.proveedorId as string | null,
		proveedorNombre: cuenta.proveedorNombre as string | null,
		montoDeuda: Number(cuenta.montoDeuda),
		montoPagado: Number(cuenta.montoPagado),
		saldoPendiente: Number(cuenta.saldoPendiente),
		moneda: cuenta.moneda as string,
		fechaEmision: (cuenta.fechaEmision as Date).toISOString(),
		fechaVencimiento: cuenta.fechaVencimiento
			? (cuenta.fechaVencimiento as Date).toISOString()
			: null,
		estado: cuenta.estado as "PENDIENTE" | "PAGADA" | "PARCIAL",
		tipoDeuda: cuenta.tipoDeuda as string | null,
		rangoAntiguedad: aging.rangoAntiguedad,
		diasTranscurridos: aging.diasTranscurridos,
		proveedor: cuenta.proveedor as CuentaPorPagarEnriquecida["proveedor"],
		pagos: pagos.map((p) => ({
			pagoCuentaPorPagarId: p.pagoCuentaPorPagarId as string,
			monto: Number(p.monto),
			numeroTransaccion: p.numeroTransaccion as string,
			cuentaProveedor: p.cuentaProveedor as string,
			fechaPago: p.fechaPago as Date,
			observaciones: p.observaciones as string | null,
		})),
		deudaCash: cuenta.deudaCash as CuentaPorPagarEnriquecida["deudaCash"],
		createdAt: cuenta.createdAt as Date,
		updatedAt: cuenta.updatedAt as Date,
	};
}

// ═══════════════════════════════════════════════════════════
// Cuentas por Cobrar
// ═══════════════════════════════════════════════════════════

/**
 * @description Lista cuentas por cobrar con filtros, paginación y tenant isolation.
 * Calcula totalPagadoFactura/saldoFactura normalizando pagos multi-moneda.
 */
export const getCuentasPorCobrarAction = withAction(
	async (
		input: GetCuentasPorCobrarInput,
		user: AuthenticatedUser,
	): Promise<GetCuentasPorCobrarResult> => {
		requireFeature(user, 'cuentas-cobrar', 'consultar cuentas por cobrar');
		const tenantId = requireTenant(user);
		const f = getCuentasPorCobrarSchema.parse(input);

		return AccountingAccountsService.listReceivables({
			tenantId,
			estado: f.estado ?? null,
			clienteId: f.clienteId ?? null,
			search: f.search ?? null,
			page: f.page,
			limit: f.limit,
		});
	},
);

/**
 * @description Crea una nueva cuenta por cobrar vinculada a una venta.
 */
export const createCuentaPorCobrarAction = withAction(
	async (
		input: CreateCuentaPorCobrarInput,
		user: AuthenticatedUser,
	): Promise<CuentaPorCobrarEnriquecida> => {
		requireFeature(user, 'cuentas-cobrar', 'crear cuentas por cobrar');
		const tenantId = requireTenant(user);
		const p = createCuentaPorCobrarSchema.parse(input);

		const venta = await prisma.venta.findFirst({
			where: { ventaId: p.ventaId, tenantId },
			select: { ventaId: true, factura: { select: { idFactura: true } } },
		});
		if (!venta)
			throw new ActionError(
				"Venta no encontrada o no pertenece al tenant",
				"NOT_FOUND",
			);

		const facturaIdReal = venta.factura?.idFactura;

		const existente = await prisma.cuentaPorCobrar.findFirst({
			where: {
				OR: [
					{ facturaId: p.ventaId },
					...(facturaIdReal ? [{ facturaId: facturaIdReal }] : []),
				],
				tenantId,
			},
		});
		if (existente)
			throw new ActionError(
				"Ya existe una cuenta por cobrar para esta venta",
				"DUPLICATE",
			);

		const cuenta = await prisma.cuentaPorCobrar.create({
			data: {
				tenantId,
				clienteId: p.clienteId,
				montoDeuda: p.monto,
				montoPagado: 0,
				// @ts-expect-error — Prisma schema has moneda column but type def may lack it
				moneda: p.moneda,
				estado: "PENDIENTE",
				facturaId: facturaIdReal || p.ventaId,
				numeroFactura: p.numeroFactura ?? null,
				fechaVencimiento: p.fechaVencimiento
					? new Date(p.fechaVencimiento)
					: null,
			},
			include: CXC_INCLUDE,
		});

		revalidatePath("/busy/contabilidad/cuentas-por-cobrar");
		return enriquecerCuentaPorCobrar(
			cuenta as unknown as Record<string, unknown>,
		);
	},
);

/**
 * @description Actualiza una cuenta por cobrar existente con tenant isolation.
 */
export const updateCuentaPorCobrarAction = withAction(
	async (
		input: UpdateCuentaPorCobrarInput,
		user: AuthenticatedUser,
	): Promise<CuentaPorCobrarEnriquecida> => {
		requireFeature(user, 'cuentas-cobrar', 'editar cuentas por cobrar');
		const tenantId = requireTenant(user);
		const p = updateCuentaPorCobrarSchema.parse(input);

		const existente = await prisma.cuentaPorCobrar.findFirst({
			where: { id: p.id, tenantId },
		});
		if (!existente)
			throw new ActionError("Cuenta por cobrar no encontrada", "NOT_FOUND");

		const data: Record<string, unknown> = {};
		if (p.estado !== undefined) data.estado = p.estado;
		if (p.montoDeuda !== undefined) data.montoDeuda = p.montoDeuda;
		if (p.montoPagado !== undefined) data.montoPagado = p.montoPagado;
		if (p.idTransferencia !== undefined)
			data.idTransferencia = p.idTransferencia;
		if (p.fechaVencimiento !== undefined)
			data.fechaVencimiento = p.fechaVencimiento
				? new Date(p.fechaVencimiento)
				: null;

		const cuenta = await prisma.cuentaPorCobrar.update({
			where: { id: p.id },
			data,
			include: CXC_INCLUDE,
		});

		revalidatePath("/busy/contabilidad/cuentas-por-cobrar");
		return enriquecerCuentaPorCobrar(
			cuenta as unknown as Record<string, unknown>,
		);
	},
);

// ═══════════════════════════════════════════════════════════
// Métricas del Dashboard
// ═══════════════════════════════════════════════════════════

/**
 * @description Retorna métricas resumidas para el dashboard de CxC.
 */
export const getCxcMetricsAction = withAction(
	async (
		_input: Record<string, never>,
		user: AuthenticatedUser,
	): Promise<CxcMetrics> => {
		requireFeature(user, 'cuentas-cobrar', 'ver métricas de cuentas por cobrar');
		const tenantId = requireTenant(user);

		return AccountingAccountsService.getReceivablesMetrics({ tenantId });
	},
);

// ═══════════════════════════════════════════════════════════
// Cuentas por Pagar
// ═══════════════════════════════════════════════════════════

/**
 * @description Lista cuentas por pagar con paginación server-side, filtros y tenant isolation.
 */
export const getCuentasPorPagarAction = withAction(
	async (
		input: GetCuentasPorPagarInput,
		user: AuthenticatedUser,
	): Promise<GetCuentasPorPagarResult> => {
		requireFeature(user, 'cuentas-pagar', 'consultar cuentas por pagar');
		const tenantId = requireTenant(user);
		const f = getCuentasPorPagarSchema.parse(input);

		return AccountingAccountsService.listPayables({
			tenantId,
			estado: f.estado ?? null,
			tipo: f.tipo ?? null,
			search: f.search ?? null,
			page: f.page,
			limit: f.limit,
		});
	},
);

/**
 * @description Crea una nueva cuenta por pagar con tenant isolation.
 */
export const createCuentaPorPagarAction = withAction(
	async (
		input: CreateCuentaPorPagarInput,
		user: AuthenticatedUser,
	): Promise<CuentaPorPagarEnriquecida> => {
		requireFeature(user, 'cuentas-pagar', 'crear cuentas por pagar');
		const tenantId = requireTenant(user);
		const p = createCuentaPorPagarSchema.parse(input);

		const existente = await prisma.cuentaPorPagar.findFirst({
			where: {
				numeroFactura: p.numeroFactura,
				proveedorId: p.proveedorId,
				tenantId,
				estado: { not: "PAGADA" },
				deletedAt: null,
			},
		});
		if (existente)
			throw new ActionError(
				"Ya existe una cuenta por pagar con ese número de factura",
				"DUPLICATE",
			);

		const cuenta = await prisma.cuentaPorPagar.create({
			data: {
				tenantId,
				numeroFactura: p.numeroFactura,
				tipo: p.tipo,
				proveedorId: p.proveedorId,
				proveedorNombre: p.proveedorNombre ?? null,
				montoDeuda: p.montoDeuda,
				montoPagado: 0,
				saldoPendiente: p.montoDeuda,
				moneda: p.moneda,
				fechaEmision: p.fechaEmision ? new Date(p.fechaEmision) : new Date(),
				fechaVencimiento: p.fechaVencimiento
					? new Date(p.fechaVencimiento)
					: null,
				estado: "PENDIENTE",
				gastoCompraId: p.gastoCompraId ?? null,
				gastosDEId: p.gastosDEId ?? null,
			},
			include: CXP_INCLUDE,
		});

		revalidatePath("/busy/contabilidad/cuentas-por-pagar");
		return enriquecerCuentaPorPagar(
			cuenta as unknown as Record<string, unknown>,
		);
	},
);
