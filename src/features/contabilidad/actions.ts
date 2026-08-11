"use server";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { requireFeature, requireTenant } from "@/lib/services/tenant-scope";
import { endOfDay } from "@/lib/date-range";
import { withPeriodValidation } from "@/lib/services/with-period-validation";
import { AccountingOperationsReadService } from "@/features/contabilidad/services/accounting-operations-read-service";
import { AccountingOperationsMutationService } from "@/features/contabilidad/services/accounting-operations-mutation-service";
import type { AuthenticatedUser } from "@/lib/auth-middleware";


 

export const getTransferenciasBancariasAction = withAction(
	async (
		params: { fechaInicio?: string; fechaFin?: string; cuentaId?: string } = {},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'transferencias-bancarias', 'consultar transferencias bancarias');
		return AccountingOperationsReadService.getBankTransfers(params);
	},
);

function bdf(fi: string | null, ff: string | null): Record<string, Date> {
	const r: Record<string, Date> = {};
	if (fi) r.gte = new Date(fi);
	if (ff) r.lte = endOfDay(ff);
	return r;
}

export const getResumenFinancieroAction = withAction(
	async (
		f: {
			fechaInicio?: string;
			fechaFin?: string;
			cuentaId?: string;
			moneda?: string;
		},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'contabilidad', 'consultar resumen financiero');
		const tenantId = requireTenant(user);
		const df = bdf(f.fechaInicio || null, f.fechaFin || null),
			sf = Object.keys(df).length ? { gte: df.gte, lte: df.lte } : {},
			af = f.cuentaId ? { cuentaId: f.cuentaId } : {};
		const wf = Object.keys(sf).length ? { fechaReconciliacion: sf } : {};
		const sfVenta = Object.keys(sf).length
			? { createdAt: { gte: sf.gte, lte: sf.lte } }
			: {};

		const hasPrestamosCash = user.planFeatures?.['prestamos-cash'] === true;
		const hasDeudasCash = user.planFeatures?.['deudas-cash'] === true;

		const [
			cuentas,
			ventasRealizadas,
			serviciosRealizados,
			rG,
			tfs,
			ajs,
			iC,
			pD,
			mPC,
			dC,
			rV_especiales,
			reconVentasCount,
			reconServiciosCount,
		] = await Promise.all([
			prisma.cuentaBancaria.findMany({
				where: { tenantId, isActive: true, ...af },
				select: {
					cuentaId: true,
					nombreBanco: true,
					numeroCuenta: true,
					saldo: true,
					moneda: true,
					tipoCuenta: true,
				},
			}),
			// Ingresos reales por ventas de productos (desde Venta, no desde reconciliación)
			prisma.venta.findMany({
				where: { tenantId, deletedAt: null, ...sfVenta },
				select: { total: true },
			}),
			// Ingresos reales por ventas de servicios
			prisma.ventaServicios.findMany({
				where: { tenantId, ...sfVenta },
				select: { total: true },
			}),
			prisma.reconciliacionGasto.findMany({
				where: { tenantId, ...af, ...wf },
				select: { monto: true, moneda: true, tipoGasto: true },
			}),
			prisma.transferenciaBancaria.findMany({
				where: {
					tenantId,
					...(Object.keys(sf).length ? { fechaTransferencia: sf } : {}),
					...(f.cuentaId
						? {
								OR: [
									{ cuentaOrigenId: f.cuentaId },
									{ cuentaDestinoId: f.cuentaId },
								],
							}
						: {}),
				},
				select: {
					montoOrigen: true,
					monedaOrigen: true,
					montoDestino: true,
					monedaDestino: true,
				},
			}),
			prisma.ajusteBancario.findMany({
				where: { tenantId, ...af, ...(Object.keys(sf).length ? { createdAt: sf } : {}) },
				select: { tipo: true, monto: true, moneda: true },
			}),
			prisma.inyeccionCapital.findMany({
				where: {
					...af,
					cuentaBancaria: { tenantId },
					...(Object.keys(sf).length ? { createdAt: sf } : {}),
				},
				select: { montoRecibido: true, moneda: true },
			}),
			prisma.pagoDeuda.findMany({
				where: {
					...af,
					cuentaBancaria: { tenantId },
					...(Object.keys(sf).length ? { fechaPago: sf } : {}),
				},
				select: {
					montoPagado: true,
					cuentaBancaria: { select: { moneda: true } },
				},
			}),
			// Desembolsos de préstamos (dinero que sale) → egreso
			hasPrestamosCash
				? prisma.reconciliacionVenta.findMany({
						where: {
							tenantId,
							...af,
							...wf,
							tipoReconciliacion: { in: ["PRESTAMO_CASH_DESEMBOLSO"] },
						},
						select: {
							monto: true,
							moneda: true,
							cuentaBancaria: { select: { moneda: true } },
						},
					})
				: [],
			// Pagos de deudas cash (dinero que sale para pagar deuda con vendor) → egreso
			hasDeudasCash
				? prisma.reconciliacionVenta.findMany({
					where: {
						tenantId,
						...af,
						...wf,
						tipoReconciliacion: { in: ["DEUDA_CASH"] },
					},
					select: { monto: true, moneda: true },
				})
				: [],
			// Cobros de préstamos cash (ingreso, no egreso)
			hasPrestamosCash
				? prisma.reconciliacionVenta.findMany({
					where: {
						tenantId,
						...af,
						...wf,
						tipoReconciliacion: { in: ["PRESTAMO_CASH"] },
					},
					select: { monto: true, moneda: true },
				})
				: [],
			// Total de reconciliaciones de ventas para estadísticas
			prisma.reconciliacionVenta.count({
				where: { tenantId, ...af, ...wf },
			}),
			// Total de reconciliaciones de servicios para estadísticas
			prisma.reconciliacionServicio.count({
				where: { tenantId, ...af, ...wf },
			}),
		]);

		const sumBy = (items: any[], key: string, val: string) =>
			items.reduce(
				(acc: any, i: any) => {
					const m = i[key] || "CUP";
					acc[m] = (acc[m] || 0) + Number(i[val]);
					return acc;
				},
				{} as Record<string, number>,
			);
		const sPD = (items: any[]) =>
			items.reduce(
				(acc: any, i: any) => {
					const m = i.cuentaBancaria?.moneda || "CUP";
					acc[m] = (acc[m] || 0) + Number(i.montoPagado);
					return acc;
				},
				{} as Record<string, number>,
			);
		const sPC = (items: any[]) =>
			items.reduce(
				(acc: any, i: any) => {
					const m = i.moneda || i.cuentaBancaria?.moneda || "CUP";
					acc[m] = (acc[m] || 0) + Number(i.monto);
					return acc;
				},
				{} as Record<string, number>,
			);

		// Ingresos reales: ventas de productos + servicios desde tablas fuente
		const ingresosVentasCUP = ventasRealizadas.reduce(
			(sum: number, v: any) => sum + Number(v.total || 0),
			0,
		);
		const ingresosServiciosCUP = serviciosRealizados.reduce(
			(sum: number, v: any) => sum + Number(v.total || 0),
			0,
		);
		// Ingresos especiales (cobros de préstamos cash) desde reconciliaciones
		const rV_especial_sum = sumBy(rV_especiales, "moneda", "monto");

		const iV: Record<string, number> = { CUP: ingresosVentasCUP };
		for (const [m, val] of Object.entries(rV_especial_sum)) {
			iV[m] = (iV[m] || 0) + (val as number);
		}
		const iS: Record<string, number> = { CUP: ingresosServiciosCUP };
		const iI = sumBy(iC, "moneda", "montoRecibido");
		const eG = sumBy(rG, "moneda", "monto"),
			eA = ajs
				.filter((a: any) => a.tipo === "egreso")
				.reduce(
					(acc: any, a: any) => {
						const m = a.moneda || "CUP";
						acc[m] = (acc[m] || 0) + Number(a.monto);
						return acc;
					},
					{} as Record<string, number>,
				);
		const iA = ajs
			.filter((a: any) => a.tipo === "ingreso")
			.reduce(
				(acc: any, a: any) => {
					const m = a.moneda || "CUP";
					acc[m] = (acc[m] || 0) + Number(a.monto);
					return acc;
				},
				{} as Record<string, number>,
			);
		const ePD = sPD(pD),
			ePC = sPC(mPC),
			eDC = sumBy(dC, "moneda", "monto");

		const todas = new Set([
			...Object.keys(
				cuentas.reduce(
					(acc: any, c: any) => {
						acc[c.moneda || "CUP"] = 0;
						return acc;
					},
					{} as Record<string, number>,
				),
			),
			...Object.keys(iV),
			...Object.keys(iS),
			...Object.keys(iI),
			...Object.keys(eG),
			...Object.keys(ePD),
			...Object.keys(ePC),
			...Object.keys(eDC),
			...Object.keys(eA),
			...Object.keys(iA),
		]);

		const resumenPorMoneda = Array.from(todas).map((m: string) => ({
			moneda: m,
			saldoActual: cuentas
				.filter((c: any) => (c.moneda || "CUP") === m)
				.reduce((s: number, c: any) => s + Number(c.saldo || 0), 0),
			totalIngresos: (iV[m] || 0) + (iS[m] || 0) + (iA[m] || 0) + (iI[m] || 0),
			totalEgresos:
				(eG[m] || 0) +
				(eA[m] || 0) +
				(ePD[m] || 0) +
				(ePC[m] || 0) +
				(eDC[m] || 0),
			flujoNeto:
				(iV[m] || 0) +
				(iS[m] || 0) +
				(iA[m] || 0) +
				(iI[m] || 0) -
				((eG[m] || 0) +
					(eA[m] || 0) +
					(ePD[m] || 0) +
					(ePC[m] || 0) +
					(eDC[m] || 0)),
			desglose: {
				ingresos: {
					ventas: iV[m] || 0,
					servicios: iS[m] || 0,
					ajustes: iA[m] || 0,
					inyecciones: iI[m] || 0,
				},
				egresos: {
					gastos: eG[m] || 0,
					ajustes: eA[m] || 0,
					pagosDeuda: ePD[m] || 0,
					prestamosCash: ePC[m] || 0,
					deudasCash: eDC[m] || 0,
				},
			},
		}));

		return {
			resumenPorMoneda,
			cuentasBancarias: cuentas.map((c) => ({ ...c, saldo: Number(c.saldo) })),
			estadisticas: {
				totalCuentas: cuentas.length,
				totalReconciliaciones:
					reconVentasCount + reconServiciosCount + rG.length,
				totalTransferencias: tfs.length,
				totalAjustes: ajs.length,
				totalInyecciones: iC.length,
				periodo: {
					fechaInicio: f.fechaInicio || "Sin límite",
					fechaFin: f.fechaFin || "Sin límite",
				},
			},
			filtros: {
				fechaInicio: f.fechaInicio || null,
				fechaFin: f.fechaFin || null,
				cuentaId: f.cuentaId || null,
				moneda: f.moneda || "CUP",
			},
		};
	},
);

export const getMovimientosReportAction = withAction(
	async (
		f: {
			busqueda?: string;
			fechaInicio?: string;
			fechaFin?: string;
			cuentaId?: string;
			tipoMovimiento?: string;
			moneda?: string;
			page?: number;
			limit?: number;
		},
		_user: AuthenticatedUser,
	) => {
		requireFeature(_user, 'contabilidad', 'consultar reportes financieros');
		const {
			busqueda: bq,
			fechaInicio: fi,
			fechaFin: ff,
			cuentaId: cid,
			tipoMovimiento: tm,
			moneda: mo,
			page: pg = 1,
			limit: lm = 10,
		} = f;
		const df = bdf(fi || null, ff || null),
			af = cid ? { cuentaId: cid } : {};
		const [v, s, g] = await Promise.all([
			prisma.reconciliacionVenta.findMany({
				where: {
					...af,
					...(Object.keys(df).length ? { fechaReconciliacion: df } : {}),
					...(mo ? { moneda: mo } : {}),
				},
				select: {
					reconciliacionId: true,
					monto: true,
					montoConvertido: true,
					tasaCambio: true,
					moneda: true,
					fechaReconciliacion: true,
					observaciones: true,
					tipoReconciliacion: true,
					venta: { select: { ventaId: true, total: true } },
					cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } },
					tipoPago: { select: { nombre: true } },
				},
			}),
			prisma.reconciliacionServicio.findMany({
				where: {
					...af,
					...(Object.keys(df).length ? { fechaReconciliacion: df } : {}),
					...(mo ? { moneda: mo } : {}),
				},
				select: {
					reconciliacionId: true,
					monto: true,
					montoConvertido: true,
					tasaCambio: true,
					moneda: true,
					fechaReconciliacion: true,
					ventasServicio: { select: { ventaServicioId: true } },
					cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } },
					tipoPago: { select: { nombre: true } },
				},
			}),
			prisma.reconciliacionGasto.findMany({
				where: {
					...af,
					...(Object.keys(df).length ? { fechaReconciliacion: df } : {}),
					...(mo ? { moneda: mo } : {}),
				},
				select: {
					reconciliacionId: true,
					monto: true,
					montoConvertido: true,
					tasaCambio: true,
					moneda: true,
					tipoGasto: true,
					descripcion: true,
					fechaReconciliacion: true,
					cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true } },
					tipoPago: { select: { nombre: true } },
				},
			}),
		]);
		const mvs = [].concat(
			// @ts-expect-error: Prisma response is wider than mapped type
			v.map((m: any) => ({
				id: m.reconciliacionId,
				tipo:
					m.tipoReconciliacion === "PRESTAMO_CASH"
						? "prestamo_cash_pago"
						: "venta",
				fecha: m.fechaReconciliacion,
				monto: Number(m.monto),
				montoConvertido:
					m.montoConvertido != null ? Number(m.montoConvertido) : null,
				tasaCambio: m.tasaCambio != null ? Number(m.tasaCambio) : null,
				moneda: m.moneda || "CUP",
				descripcion: m.venta ? "Venta " + m.venta.ventaId : "Cobro",
				cuenta: m.cuentaBancaria.nombreBanco,
				observaciones: m.observaciones,
			})),
			s.map((m: any) => ({
				id: m.reconciliacionId,
				tipo: "servicio",
				fecha: m.fechaReconciliacion,
				monto: Number(m.monto),
				montoConvertido:
					m.montoConvertido != null ? Number(m.montoConvertido) : null,
				tasaCambio: m.tasaCambio != null ? Number(m.tasaCambio) : null,
				moneda: m.moneda || "CUP",
				descripcion: "Servicio " + m.ventasServicio.ventaServicioId,
				cuenta: m.cuentaBancaria.nombreBanco,
			})),
			g.map((m: any) => ({
				id: m.reconciliacionId,
				tipo: m.tipoGasto || "gasto",
				fecha: m.fechaReconciliacion,
				monto: Number(m.monto),
				montoConvertido:
					m.montoConvertido != null ? Number(m.montoConvertido) : null,
				tasaCambio: m.tasaCambio != null ? Number(m.tasaCambio) : null,
				moneda: m.moneda || "CUP",
				descripcion: m.descripcion,
				cuenta: m.cuentaBancaria.nombreBanco,
			})),
		);
		let mf = tm && tm !== "all" ? mvs.filter((x: any) => x.tipo === tm) : mvs;
		if (bq)
			mf = mf.filter((x: any) =>
				(x.descripcion || "").toLowerCase().includes(bq.toLowerCase()),
			);
		mf.sort(
			(a: any, b: any) =>
				new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
		);
		const off = (pg - 1) * lm,
			mp = mf.slice(off, off + lm);
		return {
			data: mp,
			pagination: {
				page: pg,
				limit: lm,
				total: mf.length,
				totalPages: Math.ceil(mf.length / lm),
			},
		};
	},
);

export const validarTransferenciaAction = withAction(
	async (
		input: {
			cuentaOrigenId: string;
			cuentaDestinoId: string;
			monto: number;
			motivo: string;
			descripcion?: string;
		},
		_user: AuthenticatedUser,
	) => {
		requireFeature(_user, 'transferencias-bancarias', 'validar transferencias bancarias');
		return AccountingOperationsMutationService.validateBankTransfer(input);
	},
);

export const createTransferenciaBancariaAction = withAction(
	withPeriodValidation(
		// Transferencias usan la fecha actual como fecha de negocio
		() => new Date(),
		async (
			input: {
				cuentaOrigenId: string;
				cuentaDestinoId: string;
				montoOrigen: number;
				montoDestino?: number;
				motivo: string;
				descripcion?: string;
				tasaCambio?: number;
				monedaPrincipal?: string;
			},
			user: AuthenticatedUser,
		) => {
			requireFeature(user, 'transferencias-bancarias', 'registrar transferencias bancarias');
			return AccountingOperationsMutationService.createBankTransfer({
				input,
				user,
			});
		},
	),
);
