/**
 * @description Server Actions para gestión de períodos contables.
 *
 * Proporciona queries y mutations para apertura, cierre, reapertura
 * y aprobación de períodos contables. Usa el patrón withAction + requireTenant
 * para autenticación y aislamiento multi-tenant.
 *
 * @module actions-periodos
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { requireTenant } from "@/lib/services/tenant-scope";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
import { PeriodoContableService } from "@/lib/services/periodo-contable-service";
import { AperturaPeriodoService } from "@/lib/services/apertura-periodo-service";
import { SnapshotService } from "@/lib/services/periodo-snapshot-service";
import { invalidateCache } from "@/lib/services/periodo-contable-guard";
import {
	TipoPeriodo,
	EstadoPeriodo,
	CategoriaPeriodo,
} from "@/lib/services/periodo-contable-types";
import { isTenantAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
	obtenerBalanceConVariacion,
	obtenerVentasVsReconciliado,
	obtenerResumenDiario,
	obtenerOperacionesPeriodo,
} from "@/features/contabilidad/cuadre-queries";

// ── Period Lock Check (para bloqueos visuales en UI) ─────────────────────

const checkLockSchema = z.object({
	fecha: z.string().min(1, "Fecha requerida"),
});

/**
 * @description Verifica si una fecha (ISO string) está bloqueada por un período contable cerrado.
 * Útil para bloqueos visuales en formularios client-side.
 *
 * @param {Object} params - { fecha: string } — fecha ISO o "YYYY-MM".
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Promise<{ isLocked: boolean; message: string | null; periodo: { nombre: string; estado: string } | null }>}
 */
export const checkPeriodLockAction = withAction(
	async (params: z.infer<typeof checkLockSchema>, user: AuthenticatedUser) => {
		const parsed = checkLockSchema.parse(params);
		const tenantId = requireTenant(user);

		// Si es formato YYYY-MM, usar el primer día del mes
		const fecha = /^\d{4}-\d{2}$/.test(parsed.fecha)
			? new Date(`${parsed.fecha}-01`)
			: new Date(parsed.fecha);

		const result = await PeriodoContableService.validarEscritura(
			fecha,
			tenantId,
		);

		if (!result.permitido && result.periodo) {
			return {
				isLocked: true,
				periodo: {
					nombre: result.periodo.label,
					estado: result.periodo.estado,
				},
				message: `El período ${result.periodo.label} está en estado ${result.periodo.estado === "CERRADO" ? "Cerrado" : result.periodo.estado === "APROBADO" ? "Aprobado" : result.periodo.estado}. No permite escrituras.`,
			};
		}

		return { isLocked: false, message: null, periodo: null };
	},
);

// ── Schemas de validación ─────────────────────────────────────────────────

/**
 * Schema para abrir un nuevo período contable.
 * Valida tipo, fechas ISO y observaciones opcionales.
 */
const abrirPeriodoSchema = z.object({
	tipo: z.nativeEnum(TipoPeriodo),
	fechaInicio: z
		.string()
		.datetime({ message: "La fecha de inicio debe ser una fecha válida" }),
	fechaFin: z
		.string()
		.datetime({ message: "La fecha de fin debe ser una fecha válida" }),
	observaciones: z.string().max(500).optional(),
	categoria: z.nativeEnum(CategoriaPeriodo).optional(),
	modoContable: z.string().optional(),
});

/**
 * Schema para cerrar un período existente.
 */
const cerrarPeriodoSchema = z.object({
	periodoId: z.string().min(1, "El ID del período es obligatorio"),
});

/**
 * Schema para reaperturar un período aprobado.
 * El motivo es obligatorio con mínimo 10 caracteres.
 */
const reabrirPeriodoSchema = z.object({
	periodoId: z.string().min(1, "El ID del período es obligatorio"),
	motivo: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
});

/**
 * Schema para aprobar un período cerrado.
 */
const aprobarPeriodoSchema = z.object({
	periodoId: z.string().min(1, "El ID del período es obligatorio"),
});

// ── Queries ───────────────────────────────────────────────────────────────

/**
 * @description Lista los períodos contables del tenant con filtros opcionales.
 *
 * @param {Object} input - Parámetros de filtrado y paginación.
 * @param {TipoPeriodo} [input.tipo] - Filtrar por tipo de período.
 * @param {EstadoPeriodo} [input.estado] - Filtrar por estado.
 * @param {number} [input.page=1] - Página actual.
 * @param {number} [input.limit=50] - Items por página.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} Lista de períodos con paginación.
 */
export const listarPeriodosAction = withAction(
	async (
		input: {
			tipo?: TipoPeriodo;
			estado?: EstadoPeriodo;
			page?: number;
			limit?: number;
		} = {},
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const { tipo, estado, page = 1, limit = 50 } = input;

		const where: Record<string, unknown> = { tenantId };
		if (tipo) where.tipo = tipo;
		if (estado) where.estado = estado;

		const [periodos, total] = await Promise.all([
			prisma.periodoContable.findMany({
				where,
				orderBy: [{ fechaInicio: "desc" }],
				skip: (page - 1) * limit,
				take: limit,
				include: {
					auditoria: {
						orderBy: { timestamp: "desc" },
						take: 1,
						select: { evento: true, timestamp: true, actor: true },
					},
					_count: {
						select: { subperiodos: true },
					},
				},
			}),
			prisma.periodoContable.count({ where }),
		]);

		// Enriquecer cada período con stats y blockers
		const periodosConStats = await Promise.all(
			periodos.map(async (p) => {
				const blockers: string[] = [];

				// Verificar si tiene hash de integridad cuando está cerrado
				if (
					(p.estado === EstadoPeriodo.CERRADO ||
						p.estado === EstadoPeriodo.APROBADO) &&
					!p.hashIntegridad
				) {
					blockers.push("El período no tiene hash de integridad");
				}

				const ultimaAuditoria = p.auditoria[0] ?? null;

				return {
					...p,
					codigo: p.codigo ?? undefined,
					categoria: p.categoria,
					resumenJson: undefined, // no enviar datos pesados al cliente
					hashIntegridad: p.hashIntegridad ?? null,
					tieneHash: Boolean(p.hashIntegridad),
					subperiodosCount: p._count.subperiodos,
					periodoPadreId: p.periodoPadreId,
					abiertoPorId: p.abiertoPorId,
					fechaApertura: p.fechaApertura?.toISOString() ?? null,
					cerradoPor: p.cerradoPor,
					cerradoAt: p.cerradoAt?.toISOString() ?? null,
					aprobadoPor: p.aprobadoPor,
					aprobadoAt: p.aprobadoAt?.toISOString() ?? null,
					reabiertoPorId: p.reabiertoPorId,
					fechaReapertura: p.fechaReapertura?.toISOString() ?? null,
					segundoAprobadorId: p.segundoAprobadorId,
					ultimaAuditoria: ultimaAuditoria
						? {
								evento: ultimaAuditoria.evento,
								timestamp: ultimaAuditoria.timestamp.toISOString(),
								actor: ultimaAuditoria.actor,
							}
						: null,
					blockers,
				};
			}),
		);

		return {
			periodos: periodosConStats,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		};
	},
);

/**
 * @description Obtiene el detalle de un período con su timeline de auditoría.
 *
 * @param {string} periodoId - ID del período a consultar.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} Detalle del período con auditoría.
 */
export const obtenerPeriodoAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
			include: {
				snapshots: { orderBy: { createdAt: "desc" } },
				auditoria: { orderBy: { timestamp: "desc" } },
				apertura: true,
				subperiodos: {
					select: {
						periodoId: true,
						codigo: true,
						tipo: true,
						estado: true,
						fechaInicio: true,
						fechaFin: true,
					},
					orderBy: { fechaInicio: "asc" },
				},
				periodoPadre: {
					select: {
						periodoId: true,
						codigo: true,
						tipo: true,
						estado: true,
					},
				},
			},
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const timeline = await PeriodoContableService.obtenerTimeline(periodoId);

		return {
			periodo,
			timeline,
		};
	},
);

/**
 * @description Obtiene el timeline de eventos de auditoría de un período.
 *
 * @param {string} periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Array} Timeline de eventos de auditoría ordenado cronológicamente.
 */
export const obtenerTimelineAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		// Verificar que el período pertenece al tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
			select: { periodoId: true },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const timeline = await PeriodoContableService.obtenerTimeline(periodoId);

		return { timeline };
	},
);

// ── Mutations ─────────────────────────────────────────────────────────────

/**
 * @description Abre un nuevo período contable con validación de solapamiento.
 *
 * El período se crea directamente en estado ABIERTO.
 * Valida que no exista otro período del mismo tipo con fechas solapadas.
 *
 * @param {Object} input - Datos del período a crear.
 * @param {TipoPeriodo} input.tipo - Tipo de período (DIARIO, MENSUAL, TRIMESTRAL, SEMESTRAL, ANUAL).
 * @param {string} input.fechaInicio - Fecha de inicio (ISO string).
 * @param {string} input.fechaFin - Fecha de fin (ISO string).
 * @param {string} [input.observaciones] - Observaciones opcionales.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período creado.
 */
export const abrirPeriodoAction = withAction(
	async (
		input: z.infer<typeof abrirPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const parsed = abrirPeriodoSchema.parse(input);

		const fechaInicio = new Date(parsed.fechaInicio);
		const fechaFin = new Date(parsed.fechaFin);

		// Validar que fechaInicio <= fechaFin
		if (fechaInicio > fechaFin) {
			throw new ActionError(
				"La fecha de inicio no puede ser posterior a la fecha de fin",
				"FECHAS_INVALIDAS",
			);
		}

		const periodo = await PeriodoContableService.abrirPeriodo(
			{
				tenantId,
				tipo: parsed.tipo,
				fechaInicio,
				fechaFin,
				observaciones: parsed.observaciones,
				categoria: parsed.categoria,
				modoContable: parsed.modoContable,
			},
			user.userId,
		);

		// Crear asiento de apertura formal con saldos iniciales
		await AperturaPeriodoService.createAperturaPeriodo(
			periodo.periodoId,
			tenantId,
			user.userId,
		);

		// Invalidar caché del guard para este tenant
		await invalidateCache(tenantId);

		revalidatePath("/busy/contabilidad/periodos");

		return { periodo };
	},
);

/**
 * @description Cierra un período contable generando un snapshot automático.
 *
 * Flujo: valida transición → valida hijos → cierra período → genera snapshot.
 * Para períodos mensuales o anuales, verifica que no haya hijos abiertos.
 *
 * @param {Object} input - ID del período a cerrar.
 * @param {string} input.periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período cerrado con snapshot generado.
 */
export const cerrarPeriodoAction = withAction(
	async (
		input: z.infer<typeof cerrarPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const parsed = cerrarPeriodoSchema.parse(input);

		// Verificar ownership del tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		// Usar modo contable del período (CAJA | DEVENGO)
		const modoContable = (periodo.modoContable ?? "CAJA") as "CAJA" | "DEVENGO";
		const modoSnapshot = modoContable === "CAJA" ? "caja" : "devengo";

		// Generar snapshot ANTES de cerrar (captura el estado mientras está ABIERTO)
		const snapshotService = new SnapshotService();
		const snapshots = await snapshotService.generarSnapshot(
			parsed.periodoId,
			modoSnapshot,
			user.userId,
		);

		// Generar resumen agregado con hash de integridad
		const { resumenJson, hashIntegridad } =
			await snapshotService.generarResumenSnapshot(
				tenantId,
				periodo.fechaInicio,
				periodo.fechaFin,
				modoContable,
			);

		// Cerrar período (valida transición e hijos)
		// Managers y admins del tenant auto-aprueban al cerrar
		const esAdminTenant = isTenantAdminRole(user.tenantRole);
		const cerrado = await PeriodoContableService.cerrarPeriodo(
			parsed.periodoId,
			user.userId,
			{ snapshotsCount: snapshots.length },
			esAdminTenant,
		);

		// Persistir resumen y hash en el período (después del close exitoso)
		await prisma.periodoContable.update({
			where: { periodoId: parsed.periodoId },
			data: { resumenJson, hashIntegridad },
		});

		// Crear versión historificada de SnapshotPeriodo
		await snapshotService.crearVersionSnapshot(parsed.periodoId, {
			resumenJson: resumenJson as Record<string, unknown>,
			hashIntegridad,
		});

		// Invalidar caché del guard
		await invalidateCache(tenantId);

		revalidatePath("/busy/contabilidad/periodos");

		return {
			periodo: cerrado,
			snapshots: snapshots.length,
		};
	},
);

/**
 * @description Reabre un período APROBADO con motivo obligatorio.
 *
 * Requiere un motivo de al menos 10 caracteres para trazabilidad.
 * Transición: APROBADO → REABIERTO.
 *
 * @param {Object} input - ID del período y motivo de reapertura.
 * @param {string} input.periodoId - ID del período.
 * @param {string} input.motivo - Motivo de reapertura (mínimo 10 caracteres).
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período reabierto.
 */
export const reabrirPeriodoAction = withAction(
	async (
		input: z.infer<typeof reabrirPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const parsed = reabrirPeriodoSchema.parse(input);

		// Verificar ownership del tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const reabierto = await PeriodoContableService.reabrirPeriodo(
			parsed.periodoId,
			user.userId,
			parsed.motivo,
		);

		// Invalidar caché del guard
		await invalidateCache(tenantId);

		revalidatePath("/busy/contabilidad/periodos");

		return { periodo: reabierto };
	},
);

/**
 * @description Aprueba un período CERRADO.
 *
 * Transición: CERRADO → APROBADO.
 * Esta acción es irreversible excepto vía reapertura con motivo.
 *
 * @param {Object} input - ID del período a aprobar.
 * @param {string} input.periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período aprobado.
 */
export const aprobarPeriodoAction = withAction(
	async (
		input: z.infer<typeof aprobarPeriodoSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const parsed = aprobarPeriodoSchema.parse(input);

		// Verificar ownership del tenant
		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const aprobado = await PeriodoContableService.aprobarPeriodo(
			parsed.periodoId,
			user.userId,
		);

		revalidatePath("/busy/contabilidad/periodos");

		return { periodo: aprobado };
	},
);

// ── Dashboard ──────────────────────────────────────────────────────────────

/**
 * @description Retorna estadísticas agregadas para el dashboard de períodos.
 *
 * Incluye: conteo por estado, períodos listos para cerrar, períodos con issues,
 * y timeline de eventos recientes.
 *
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Object} Dashboard stats.
 */
export const obtenerDashboardPeriodosAction = withAction(
	async (_input: Record<string, never> = {}, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		// 1. Conteo por estado
		const periodos = await prisma.periodoContable.findMany({
			where: { tenantId },
			select: {
				periodoId: true,
				tipo: true,
				codigo: true,
				estado: true,
				fechaInicio: true,
				fechaFin: true,
				hashIntegridad: true,
				periodoPadreId: true,
				cerradoPor: true,
				aprobadoPor: true,
				createdAt: true,
				_count: { select: { subperiodos: true } },
			},
			orderBy: { fechaInicio: "desc" },
		});

		const conteoPorEstado: Record<string, number> = {};
		for (const p of periodos) {
			const estado = p.estado as string;
			conteoPorEstado[estado] = (conteoPorEstado[estado] ?? 0) + 1;
		}

		// 2. Períodos listos para cerrar (ABIERTO/REABIERTO sin blockers)
		const listosParaCerrar = periodos.filter((p) => {
			const estado = p.estado as string;
			if (estado !== "ABIERTO" && estado !== "REABIERTO") return false;

			// Sin blockers: tiene hash si está listo para cerrar
			const blockers: string[] = [];
			if (!p.hashIntegridad) blockers.push("Sin hash de integridad");

			return blockers.length === 0;
		});

		// 3. Períodos con issues (sin hash estando CERRADO/APROBADO)
		const periodosConIssues = periodos.filter((p) => {
			const estado = p.estado as string;
			if (estado !== "CERRADO" && estado !== "APROBADO") return false;
			return !p.hashIntegridad;
		});

		// 4. Timeline de eventos recientes (últimos 10 cierres/aprobaciones)
		const eventosRecientes = await prisma.auditoriaPeriodo.findMany({
			where: {
				tenantId,
				evento: {
					in: ["CIERRE", "APROBACION", "APERTURA", "REAPERTURA"] as never[],
				},
			},
			orderBy: { timestamp: "desc" },
			take: 10,
			select: {
				auditoriaId: true,
				evento: true,
				actor: true,
				timestamp: true,
				motivo: true,
				periodoId: true,
			},
		});

		return {
			stats: {
				total: periodos.length,
				porEstado: conteoPorEstado,
				listosParaCerrar: listosParaCerrar.length,
				conIssues: periodosConIssues.length,
			},
			periodos,
			eventosRecientes: eventosRecientes.map((e) => ({
				...e,
				timestamp: e.timestamp.toISOString(),
			})),
		};
	},
);

/**
 * @description Integra todos los arqueos de caja de un período contable.
 * Recorre los arqueos no contabilizados dentro del rango del período,
 * los acumula y actualiza AperturaPeriodo.detalleJson.
 *
 * @param {string} periodoId - ID del período contable
 * @param {AuthenticatedUser} user - Usuario autenticado
 * @returns {Promise<{ arqueosIntegrados: number }>}
 * @throws {ActionError} Si el período no existe o no pertenece al tenant
 */
export const integrarArqueosEnPeriodoAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
			include: { apertura: true },
		});
		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		// Obtener arqueos del período no contabilizados
		const arqueos = await prisma.arqueoCaja.findMany({
			where: {
				tenantId,
				createdAt: { gte: periodo.fechaInicio, lte: periodo.fechaFin },
				contabilizado: false,
			},
		});

		if (arqueos.length === 0) {
			return { arqueosIntegrados: 0 };
		}

		// Calcular agregados
		const detalle = {
			arqueos: arqueos.map((a) => ({
				arqueoId: a.id,
				puntoDeVentaId: a.puntoDeVentaId,
				totalEfectivoCup: a.totalEfectivoCup,
				totalEfectivoUsd: a.totalEfectivoUsd,
				totalTarjeta: a.totalTarjeta,
				totalTransferencia: a.totalTransferencia,
				totalCredito: a.totalCredito,
				diferenciaCup: a.diferenciaCup,
				diferenciaUsd: a.diferenciaUsd,
			})),
			ventasPorMetodoPago: {} as Record<string, number>,
		};

		// Acumular ventas por metodoPago del período
		const ventasPeriodo = await prisma.venta.findMany({
			where: {
				tenantId,
				createdAt: { gte: periodo.fechaInicio, lte: periodo.fechaFin },
				metodoPago: { not: null },
			},
			select: { metodoPago: true, total: true },
		});

		for (const v of ventasPeriodo) {
			const mp = v.metodoPago?.toLowerCase() ?? "sin_dato";
			detalle.ventasPorMetodoPago[mp] =
				(detalle.ventasPorMetodoPago[mp] ?? 0) + (v.total ?? 0);
		}

		// Actualizar AperturaPeriodo.detalleJson
		await prisma.aperturaPeriodo.upsert({
			where: { periodoId },
			create: {
				periodoId,
				tenantId,
				saldoCajaInicial: 0,
				detalleJson: detalle as Record<string, unknown>,
			},
			update: {
				detalleJson: detalle as Record<string, unknown>,
			},
		});

		// Marcar arqueos como contabilizados
		await prisma.arqueoCaja.updateMany({
			where: { id: { in: arqueos.map((a) => a.id) } },
			data: { contabilizado: true },
		});

		return { arqueosIntegrados: arqueos.length };
	},
);

// ── Cuadre para cierre de período ────────────────────────────────────────

const obtenerCuadreSchema = z.object({
	periodoId: z.string().min(1),
	pageVentas: z.number().int().positive().default(1),
	pageOperaciones: z.number().int().positive().default(1),
	pageSize: z.number().int().positive().max(50).default(20),
	filtroOperacion: z
		.enum(["todas", "venta", "servicio", "gasto", "transferencia", "ajuste"])
		.default("todas"),
});

/**
 * @description Obtiene el cuadre completo de un período para la pantalla de cierre.
 *
 * Retorna balance (saldos por cuenta con variación), ventas vs reconciliado
 * (operación por operación), resumen diario (agregado por día) y operaciones
 * del período. Los datos reflejan el estado en vivo de la base de datos.
 *
 * @param {Object} input - Parámetros de consulta.
 * @param {string} input.periodoId - ID del período.
 * @param {number} [input.pageVentas=1] - Página de ventas.
 * @param {number} [input.pageOperaciones=1] - Página de operaciones.
 * @param {number} [input.pageSize=20] - Items por página.
 * @param {string} [input.filtroOperacion="todas"] - Filtro por tipo.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Promise<Object>} Cuadre completo del período.
 */
export const obtenerCuadrePeriodoAction = withAction(
	async (
		input: z.infer<typeof obtenerCuadreSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const parsed = obtenerCuadreSchema.parse(input);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		if (periodo.estado !== "ABIERTO" && periodo.estado !== "REABIERTO") {
			throw new ActionError(
				"El período debe estar abierto para ver el cuadre",
				"INVALID_STATE",
			);
		}

		const modoContable = periodo.modoContable ?? "CAJA";
		const rango = { gte: periodo.fechaInicio, lte: periodo.fechaFin };

		// Debug: ejecutar cada query por separado para identificar cuál falla
		let balance, ventasVsReconciliado, resumenDiario, operaciones;
		try {
			balance = await obtenerBalanceConVariacion(tenantId, rango, modoContable);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerBalanceConVariacion:", e);
			throw e;
		}
		try {
			ventasVsReconciliado = await obtenerVentasVsReconciliado(
				tenantId,
				rango,
				modoContable,
				parsed.pageVentas,
				parsed.pageSize,
			);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerVentasVsReconciliado:", e);
			throw e;
		}
		try {
			resumenDiario = await obtenerResumenDiario(tenantId, rango, modoContable);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerResumenDiario:", e);
			throw e;
		}
		try {
			operaciones = await obtenerOperacionesPeriodo(
				tenantId,
				rango,
				modoContable,
				parsed.pageOperaciones,
				parsed.pageSize,
				parsed.filtroOperacion,
			);
		} catch (e) {
			console.error("[cuadre] FAILED obtenerOperacionesPeriodo:", e);
			throw e;
		}

		return {
			periodo: {
				periodoId: periodo.periodoId,
				codigo: periodo.codigo,
				tipo: periodo.tipo,
				estado: periodo.estado,
				modoContable: periodo.modoContable,
				fechaInicio: periodo.fechaInicio.toISOString(),
				fechaFin: periodo.fechaFin.toISOString(),
				abiertoPorId: periodo.abiertoPorId,
				fechaApertura: periodo.fechaApertura?.toISOString() ?? null,
			},
			balance,
			ventasVsReconciliado,
			resumenDiario,
			operaciones,
		};
	},
);

const obtenerOperacionesDiaSchema = z.object({
	periodoId: z.string().min(1),
	fecha: z.string().min(10), // YYYY-MM-DD
});

/**
 * @description Obtiene las operaciones detalladas de un día específico dentro de un período.
 * Usado por el tab de Resumen Diario para lazy loading al expandir un día.
 *
 * @param {Object} input - { periodoId, fecha }.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<OperacionItem[]>} Operaciones del día.
 */
export const obtenerOperacionesDiaAction = withAction(
	async (
		input: z.infer<typeof obtenerOperacionesDiaSchema>,
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const parsed = obtenerOperacionesDiaSchema.parse(input);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId: parsed.periodoId, tenantId },
		});
		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const modoContable = periodo.modoContable ?? "CAJA";
		const inicio = new Date(`${parsed.fecha}T00:00:00.000Z`);
		const fin = new Date(`${parsed.fecha}T23:59:59.999Z`);
		const rango = { gte: inicio, lte: fin };

		const result = await obtenerOperacionesPeriodo(
			tenantId,
			rango,
			modoContable,
			1,
			500,
			"todas",
		);

		return result.items;
	},
);

/**
 * @description Verifica si quedan operaciones pendientes (sin reconciliar) en el período.
 *
 * Revisa ventas, servicios y gastos dentro del rango de fechas del período
 * que no tienen reconciliación bancaria asociada. Si hay alguna, el período
 * no puede cerrarse.
 *
 * @param {string} periodoId - ID del período contable.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Promise<{ ventasSinReconciliar: number; serviciosSinReconciliar: number; gastosSinReconciliar: number }>}
 */
export const verificarOperacionesPendientesAction = withAction(
	async (periodoId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const periodo = await prisma.periodoContable.findFirst({
			where: { periodoId, tenantId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		const rango = { gte: periodo.fechaInicio, lte: periodo.fechaFin };

		// Ventas sin reconciliar
		const ventasSinReconciliar = await prisma.venta.count({
			where: {
				tenantId,
				createdAt: rango,
				deletedAt: null,
				reconciliaciones: { none: {} },
			},
		});

		// Servicios sin reconciliar
		const serviciosSinReconciliar = await prisma.ventaServicios.count({
			where: {
				tenantId,
				createdAt: rango,
				reconciliaciones: { none: {} },
			},
		});

		// Gastos sin reconciliar (GastosDE + GastoCompra)
		const gastosSinReconciliar =
			(await prisma.gastosDE.count({
				where: {
					tenantId,
					createdAt: rango,
					reconciliaciones: { none: {} },
				},
			})) +
			(await prisma.gastoCompra.count({
				where: {
					tenantId,
					createdAt: rango,
					deletedAt: null,
					reconciliaciones: { none: {} },
				},
			}));

		// CompraServicio sin reconciliar (vía ReconciliacionGasto tipoGasto="servicio")
		const reconciliadosCS = await prisma.reconciliacionGasto.findMany({
			where: {
				tenantId,
				tipoGasto: "servicio",
				fechaReconciliacion: rango,
			},
			select: { referenciaId: true },
			distinct: ["referenciaId"],
		});
		const idsReconciliadosCS = reconciliadosCS
			.map((r) => r.referenciaId)
			.filter(Boolean);
		const compraServicioSinReconciliar = await prisma.compraServicio.count({
			where: {
				tenantId,
				createdAt: rango,
				compraServicioId:
					idsReconciliadosCS.length > 0
						? { notIn: idsReconciliadosCS }
						: undefined,
			},
		});

		// Costo de servicios vendidos sin reconciliar (vía ReconciliacionGasto tipoGasto="venta_servicio")
		const reconciliadosVSCosto = await prisma.reconciliacionGasto.findMany({
			where: {
				tenantId,
				tipoGasto: "venta_servicio",
				fechaReconciliacion: rango,
			},
			select: { referenciaId: true },
			distinct: ["referenciaId"],
		});
		const idsReconciliadosVSCosto = reconciliadosVSCosto
			.map((r) => r.referenciaId)
			.filter(Boolean);
		const ventaServicioCostoSinReconciliar = await prisma.ventaServicios.count({
			where: {
				tenantId,
				createdAt: rango,
				costo: { gt: 0 },
				ventaServicioId:
					idsReconciliadosVSCosto.length > 0
						? { notIn: idsReconciliadosVSCosto }
						: undefined,
			},
		});

		return {
			ventasSinReconciliar,
			serviciosSinReconciliar,
			gastosSinReconciliar:
				gastosSinReconciliar +
				compraServicioSinReconciliar +
				ventaServicioCostoSinReconciliar,
		};
	},
);
