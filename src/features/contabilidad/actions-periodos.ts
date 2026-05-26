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
		invalidateCache(tenantId);

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

		// Generar snapshot ANTES de cerrar (captura el estado mientras está ABIERTO)
		const snapshotService = new SnapshotService();
		const snapshots = await snapshotService.generarSnapshot(
			parsed.periodoId,
			"caja",
			user.userId,
		);

		// Generar resumen agregado con hash de integridad
		const { resumenJson, hashIntegridad } =
			await snapshotService.generarResumenSnapshot(
				tenantId,
				periodo.fechaInicio,
				periodo.fechaFin,
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
