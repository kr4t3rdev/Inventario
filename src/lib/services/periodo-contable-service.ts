/**
 * @description Servicio de dominio puro para períodos contables.
 *
 * Contiene la lógica de negocio: CRUD, transiciones de estado,
 * resolución de períodos por jerarquía, y validación de solapamiento.
 *
 * Este servicio es testeable en aislamiento y no depende de contexto HTTP.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { ActionError } from "@/lib/server-actions/types";
import {
	EstadoPeriodo,
	TipoPeriodo,
	EventoAuditoria,
	CategoriaPeriodo,
	WRITABLE_STATES,
	VALID_TRANSITIONS,
	generarLabelPeriodo,
	toResumen,
	PeriodoError,
	type CreatePeriodoInput,
	type PeriodoContableResumen,
	type ResolverPeriodoResult,
	type ValidacionResult,
	type AuditEntry,
	type PeriodoErrorCode,
} from "./periodo-contable-types";

/**
 * @description Servicio de dominio para gestión de períodos contables.
 *
 * Todos los métodos son estáticos para facilitar el uso sin instanciación.
 */
export class PeriodoContableService {
	// ── Queries ─────────────────────────────────────────────────────────────

	/**
	 * Resuelve el período activo para una fecha y tenant dados.
	 * Busca en orden: DIARIO → MENSUAL → ANUAL.
	 *
	 * @param {Date} fecha - Fecha de negocio a resolver.
	 * @param {string} tenantId - ID del tenant.
	 * @param {TipoPeriodo} [tipo] - Si se especifica, busca solo ese tipo.
	 * @returns {Promise<ResolverPeriodoResult>} Resultado con período encontrado o null.
	 */
	static async resolverPeriodoActivo(
		fecha: Date,
		tenantId: string,
		tipo?: TipoPeriodo,
	): Promise<ResolverPeriodoResult> {
		const tiposBusqueda = tipo
			? [tipo]
			: [
					TipoPeriodo.DIARIO,
					TipoPeriodo.MENSUAL,
					TipoPeriodo.TRIMESTRAL,
					TipoPeriodo.SEMESTRAL,
					TipoPeriodo.ANUAL,
				];

		for (const t of tiposBusqueda) {
			const periodo = await prisma.periodoContable.findFirst({
				where: {
					tenantId,
					tipo: t as any,
					fechaInicio: { lte: fecha },
					fechaFin: { gte: fecha },
				},
				orderBy: { fechaInicio: "desc" },
			});

			if (periodo) {
				const resumen = toResumen(periodo);
				return {
					periodo: resumen,
					estado: periodo.estado as EstadoPeriodo,
					esWritable: WRITABLE_STATES.includes(periodo.estado as EstadoPeriodo),
				};
			}
		}

		return {
			periodo: null,
			estado: "NO_EXISTE",
			esWritable: false,
		};
	}

	/**
	 * Valida si una fecha permite escritura contable.
	 *
	 * @param {Date} fecha - Fecha de negocio.
	 * @param {string} tenantId - ID del tenant.
	 * @param {'caja' | 'devengo'} [_tipoOperacion] - Tipo de operación (reservado para uso futuro).
	 * @returns {Promise<ValidacionResult>} Resultado de la validación.
	 */
	static async validarEscritura(
		fecha: Date,
		tenantId: string,
		_tipoOperacion?: "caja" | "devengo",
	): Promise<ValidacionResult> {
		const resultado = await this.resolverPeriodoActivo(fecha, tenantId);

		if (resultado.estado === "NO_EXISTE") {
			return {
				permitido: false,
				error: new PeriodoError(
					"No existe un período contable para esta fecha. Creá un período primero.",
					"PERIODO_NO_EXISTE",
				),
			};
		}

		if (!resultado.esWritable) {
			const code = this._estadoToErrorCode(resultado.estado as EstadoPeriodo);
			return {
				permitido: false,
				error: new PeriodoError(
					`El período ${resultado.periodo?.label} está en estado ${resultado.estado}. No permite escrituras.`,
					code,
					resultado.periodo ?? undefined,
				),
			};
		}

		return {
			permitido: true,
			periodo: resultado.periodo ?? undefined,
		};
	}

	/**
	 * Obtiene el timeline de auditoría de un período.
	 *
	 * @param {string} periodoId - ID del período.
	 * @returns {Promise<AuditEntry[]>} Timeline ordenado cronológicamente.
	 */
	static async obtenerTimeline(periodoId: string): Promise<AuditEntry[]> {
		const entries = await prisma.auditoriaPeriodo.findMany({
			where: { periodoId },
			orderBy: { timestamp: "asc" },
		});

		return entries.map((e) => ({
			auditoriaId: e.auditoriaId,
			evento: e.evento as EventoAuditoria,
			actor: e.actor,
			timestamp: e.timestamp,
			motivo: e.motivo ?? undefined,
			payload: (e.payload as Record<string, unknown>) ?? undefined,
			entidadAfectada: e.entidadAfectada ?? undefined,
		}));
	}

	// ── Helpers de codificación ──────────────────────────────────────────────

	/**
	 * Genera un código legible para un período según su tipo y fecha de inicio.
	 *
	 * - ANUAL: "A-2026"
	 * - SEMESTRAL: "S-2026-S1"
	 * - TRIMESTRAL: "T-2026-T1"
	 * - MENSUAL: "M-2026-03"
	 * - DIARIO: "D-2026-03-15"
	 *
	 * @param {TipoPeriodo} tipo - Tipo de período.
	 * @param {Date} fechaInicio - Fecha de inicio del período (se usan métodos UTC).
	 * @returns {string} Código del período.
	 */
	static generarCodigoPeriodo(tipo: TipoPeriodo, fechaInicio: Date): string {
		const year = fechaInicio.getUTCFullYear();
		switch (tipo) {
			case TipoPeriodo.ANUAL:
				return `A-${year}`;
			case TipoPeriodo.SEMESTRAL: {
				const sem = fechaInicio.getUTCMonth() < 6 ? 1 : 2;
				return `S-${year}-S${sem}`;
			}
			case TipoPeriodo.TRIMESTRAL: {
				const trim = Math.ceil((fechaInicio.getUTCMonth() + 1) / 3);
				return `T-${year}-T${trim}`;
			}
			case TipoPeriodo.MENSUAL: {
				const month = String(fechaInicio.getUTCMonth() + 1).padStart(2, "0");
				return `M-${year}-${month}`;
			}
			case TipoPeriodo.DIARIO: {
				const month = String(fechaInicio.getUTCMonth() + 1).padStart(2, "0");
				const day = String(fechaInicio.getUTCDate()).padStart(2, "0");
				return `D-${year}-${month}-${day}`;
			}
			default:
				return `P-${year}`;
		}
	}

	/**
	 * Resuelve el período padre en la jerarquía según tipo y fechas.
	 *
	 * - ANUAL → sin padre
	 * - SEMESTRAL → busca ANUAL que contenga las fechas
	 * - TRIMESTRAL → busca SEMESTRAL que contenga las fechas
	 * - MENSUAL → busca TRIMESTRAL que contenga las fechas
	 * - DIARIO → busca MENSUAL que contenga las fechas
	 *
	 * @param {string} tenantId - ID del tenant.
	 * @param {TipoPeriodo} tipo - Tipo del período hijo.
	 * @param {Date} fechaInicio - Fecha de inicio del hijo.
	 * @param {Date} fechaFin - Fecha de fin del hijo.
	 * @returns {Promise<string | null>} ID del período padre o null.
	 */
	static async resolverPeriodoPadre(
		tenantId: string,
		tipo: TipoPeriodo,
		fechaInicio: Date,
		fechaFin: Date,
		client?: Prisma.TransactionClient,
	): Promise<string | null> {
		if (tipo === TipoPeriodo.ANUAL) return null;

		const padreTipoMap: Partial<Record<TipoPeriodo, TipoPeriodo>> = {
			[TipoPeriodo.DIARIO]: TipoPeriodo.MENSUAL,
			[TipoPeriodo.MENSUAL]: TipoPeriodo.TRIMESTRAL,
			[TipoPeriodo.TRIMESTRAL]: TipoPeriodo.SEMESTRAL,
			[TipoPeriodo.SEMESTRAL]: TipoPeriodo.ANUAL,
		};

		const padreTipo = padreTipoMap[tipo];
		if (!padreTipo) return null;

		const db = client ?? prisma;
		const padre = await db.periodoContable.findFirst({
			where: {
				tenantId,
				tipo: padreTipo as any,
				fechaInicio: { lte: fechaInicio },
				fechaFin: { gte: fechaFin },
			},
			orderBy: { fechaInicio: "desc" },
		});

		return padre?.periodoId ?? null;
	}

	// ── Mutations ───────────────────────────────────────────────────────────

	/**
	 * Crea y abre un nuevo período contable.
	 * Genera codigo, resuelve la jerarquía (periodoPadreId) y registra la apertura.
	 *
	 * @param {CreatePeriodoInput} input - Datos del período.
	 * @param {string} actor - ID del usuario que crea.
	 * @returns {Promise<PeriodoContable>} El período creado.
	 */
	static async abrirPeriodo(
		input: CreatePeriodoInput,
		actor: string,
		client?: Prisma.TransactionClient,
	) {
		const db = client ?? prisma;

		const solapado = await this.verificarSolapamiento(
			input.tenantId,
			input.tipo,
			input.fechaInicio,
			input.fechaFin,
			undefined,
			client,
		);

		if (solapado) {
			throw new PeriodoError(
				`Ya existe un período ${input.tipo.toLowerCase()} con fechas que se solapan para este tenant.`,
				"PERIODO_SOLAPADO",
			);
		}

		const codigo = this.generarCodigoPeriodo(input.tipo, input.fechaInicio);
		const periodoPadreId = await this.resolverPeriodoPadre(
			input.tenantId,
			input.tipo,
			input.fechaInicio,
			input.fechaFin,
			client,
		);

		const periodo = await db.periodoContable.create({
			data: {
				tenantId: input.tenantId,
				tipo: input.tipo as any,
				codigo,
				fechaInicio: input.fechaInicio,
				fechaFin: input.fechaFin,
				estado: EstadoPeriodo.ABIERTO,
				periodoPadreId,
				categoria: (input.categoria as any) ?? CategoriaPeriodo.ORDINARIO,
				modoContable: (input.modoContable ?? "CAJA") as any,
				abiertoPorId: actor,
				fechaApertura: new Date(),
				observaciones: input.observaciones,
			},
		});

		await this._registrarAuditoria(
			{
				periodoId: periodo.periodoId,
				tenantId: periodo.tenantId,
				evento: EventoAuditoria.APERTURA,
				actor,
			},
			client,
		);

		return periodo;
	}

	/**
	 * Inicia el cierre de un período.
	 * Flujo: ABIERTO → EN_CIERRE → CERRADO.
	 *
	 * @param {string} periodoId - ID del período a cerrar.
	 * @param {string} actor - ID del usuario que cierra.
	 * @returns {Promise<PeriodoContable>} El período cerrado.
	 */
	static async cerrarPeriodo(
		periodoId: string,
		actor: string,
		metadata?: { snapshotsCount?: number; operacionesCount?: number },
		esManager: boolean = false,
		client?: Prisma.TransactionClient,
	) {
		const db = client ?? prisma;
		const periodo = await db.periodoContable.findUnique({
			where: { periodoId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		// Definir estado destino: managers saltan directo a APROBADO
		const estadoActual = periodo.estado as EstadoPeriodo;
		const estadoDestino = esManager
			? EstadoPeriodo.APROBADO
			: EstadoPeriodo.CERRADO;
		const estadoValidacion = esManager
			? EstadoPeriodo.APROBADO
			: EstadoPeriodo.EN_CIERRE;

		// Validar transición
		if (!this.validarTransicion(estadoActual, estadoValidacion)) {
			throw new PeriodoError(
				`No se puede cerrar un período en estado ${periodo.estado}.`,
				"TRANSICION_INVALIDA",
				toResumen(periodo),
			);
		}

		// Validar que no tenga subperíodos abiertos o en cierre
		// Primero por relación explícita (jerarquía), luego por fechas (legacy compat)
		const hijosPorRelacion = await db.periodoContable.count({
			where: {
				periodoPadreId: periodoId,
				estado: { in: [EstadoPeriodo.ABIERTO, EstadoPeriodo.EN_CIERRE] },
			},
		});

		if (hijosPorRelacion > 0) {
			throw new PeriodoError(
				`No se puede cerrar el período porque tiene ${hijosPorRelacion} subperíodo(s) abiertos o en cierre.`,
				"HIJOS_ABIERTOS",
				toResumen(periodo),
			);
		}

		// Fallback: para períodos existentes sin jerarquía explícita, validar por fechas
		if (periodo.tipo !== TipoPeriodo.DIARIO) {
			const tiposDescendientes = this._obtenerTiposDescendientes(
				periodo.tipo as TipoPeriodo,
			);
			const hijosLegacy = await db.periodoContable.count({
				where: {
					tenantId: periodo.tenantId,
					periodoPadreId: null, // Solo períodos sin padre explícito (legacy)
					tipo: { in: tiposDescendientes as any },
					fechaInicio: { gte: periodo.fechaInicio },
					fechaFin: { lte: periodo.fechaFin },
					estado: { in: [EstadoPeriodo.ABIERTO, EstadoPeriodo.EN_CIERRE] },
				},
			});

			if (hijosLegacy > 0) {
				throw new PeriodoError(
					`No se puede cerrar el período porque tiene ${hijosLegacy} período(s) legacy(s) abiertos o en cierre.`,
					"HIJOS_ABIERTOS",
					toResumen(periodo),
				);
			}
		}

		// Transición: ABIERTO → CERRADO (o → APROBADO si es manager)
		const updateData: Record<string, unknown> = {
			estado: estadoDestino,
			cerradoPor: actor,
			cerradoAt: new Date(),
		};

		// Managers: auto-aprobación en el mismo paso
		if (esManager && estadoDestino === EstadoPeriodo.APROBADO) {
			updateData.aprobadoPor = actor;
			updateData.aprobadoAt = new Date();
		}

		const resultado = await db.periodoContable.update({
			where: { periodoId },
			data: updateData,
		});

		// Registrar auditoría con metadatos del cierre
		await this._registrarAuditoria({
			periodoId,
			tenantId: periodo.tenantId,
			evento: EventoAuditoria.CIERRE,
			actor,
			payload: {
				...(metadata?.snapshotsCount !== undefined && {
					snapshots: metadata.snapshotsCount,
				}),
				...(metadata?.operacionesCount !== undefined && {
					operaciones: metadata.operacionesCount,
				}),
				...(esManager && { autoAprobado: true }),
			},
		}, client);

		return resultado;
	}

	/**
	 * Reabre un período APROBADO. Requiere motivo obligatorio.
	 * Transición: APROBADO → REABIERTO.
	 *
	 * @param {string} periodoId - ID del período.
	 * @param {string} actor - ID del usuario que reabre.
	 * @param {string} motivo - Motivo obligatorio de reapertura.
	 * @returns {Promise<PeriodoContable>} El período reabierto.
	 */
	static async reabrirPeriodo(
		periodoId: string,
		actor: string,
		motivo: string,
	) {
		if (!motivo || motivo.trim().length === 0) {
			throw new PeriodoError(
				"El motivo de reapertura es obligatorio.",
				"MOTIVO_REAPERTURA_REQUERIDO",
			);
		}

		const periodo = await prisma.periodoContable.findUnique({
			where: { periodoId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		// Validar transición
		if (
			!this.validarTransicion(
				periodo.estado as EstadoPeriodo,
				EstadoPeriodo.REABIERTO,
			)
		) {
			throw new PeriodoError(
				`No se puede reaperturar un período en estado ${periodo.estado}.`,
				"TRANSICION_INVALIDA",
				toResumen(periodo),
			);
		}

		const reabierto = await prisma.periodoContable.update({
			where: { periodoId },
			data: {
				estado: EstadoPeriodo.REABIERTO,
				motivoReapertura: motivo,
				reabiertoPorId: actor,
				fechaReapertura: new Date(),
			},
		});

		// Registrar auditoría
		await this._registrarAuditoria({
			periodoId,
			tenantId: periodo.tenantId,
			evento: EventoAuditoria.REAPERTURA,
			actor,
			motivo,
		});

		return reabierto;
	}

	/**
	 * Aprueba un período CERRADO.
	 * Transición: CERRADO → APROBADO.
	 *
	 * @param {string} periodoId - ID del período.
	 * @param {string} actor - ID del usuario que aprueba.
	 * @returns {Promise<PeriodoContable>} El período aprobado.
	 */
	static async aprobarPeriodo(periodoId: string, actor: string) {
		const periodo = await prisma.periodoContable.findUnique({
			where: { periodoId },
		});

		if (!periodo) {
			throw new ActionError("Período no encontrado", "NOT_FOUND");
		}

		// Validar transición
		if (
			!this.validarTransicion(
				periodo.estado as EstadoPeriodo,
				EstadoPeriodo.APROBADO,
			)
		) {
			throw new PeriodoError(
				`No se puede aprobar un período en estado ${periodo.estado}.`,
				"TRANSICION_INVALIDA",
				toResumen(periodo),
			);
		}

		// Validar segregación de funciones: quien cerró no puede aprobar
		if (periodo.cerradoPor === actor) {
			throw new PeriodoError(
				"La misma persona que cerró el período no puede aprobarlo. Se requiere otro usuario con permisos de aprobación.",
				"MISMO_ACTOR_CIERRE_APROBACION",
				toResumen(periodo),
			);
		}

		// Si ya está aprobado una vez, es segunda aprobación
		const esSegundaAprobacion =
			periodo.aprobadoPor !== null && periodo.aprobadoPor !== undefined;

		const aprobado = await prisma.periodoContable.update({
			where: { periodoId },
			data: {
				estado: EstadoPeriodo.APROBADO,
				aprobadoAt: new Date(),
				...(esSegundaAprobacion
					? { segundoAprobadorId: actor }
					: { aprobadoPor: actor }),
			},
		});

		// Registrar auditoría
		await this._registrarAuditoria({
			periodoId,
			tenantId: periodo.tenantId,
			evento: EventoAuditoria.APROBACION,
			actor,
			payload: {
				tipo: esSegundaAprobacion ? "segunda_aprobacion" : "primera_aprobacion",
				cerradoPor: periodo.cerradoPor,
				primeraAprobacionPor: periodo.aprobadoPor,
			},
		});

		return aprobado;
	}

	// ── Validaciones puras ──────────────────────────────────────────────────

	/**
	 * Valida que una transición de estado sea válida según la matriz definida.
	 *
	 * @param {EstadoPeriodo} estadoActual - Estado actual del período.
	 * @param {EstadoPeriodo} estadoNuevo - Estado al que se quiere transicionar.
	 * @returns {boolean} True si la transición es válida.
	 */
	static validarTransicion(
		estadoActual: EstadoPeriodo,
		estadoNuevo: EstadoPeriodo,
	): boolean {
		const destinosValidos = VALID_TRANSITIONS[estadoActual];
		if (!destinosValidos) return false;
		return destinosValidos.includes(estadoNuevo);
	}

	/**
	 * Verifica solapamiento de fechas para un tenant y tipo.
	 * Dos períodos se solapan si sus rangos de fecha se intersectan.
	 *
	 * @param {string} tenantId - ID del tenant.
	 * @param {TipoPeriodo} tipo - Tipo de período.
	 * @param {Date} fechaInicio - Fecha de inicio del nuevo período.
	 * @param {Date} fechaFin - Fecha de fin del nuevo período.
	 * @param {string} [excludePeriodoId] - ID de período a excluir (para updates).
	 * @returns {Promise<boolean>} True si hay solapamiento.
	 */
	static async verificarSolapamiento(
		tenantId: string,
		tipo: TipoPeriodo,
		fechaInicio: Date,
		fechaFin: Date,
		excludePeriodoId?: string,
		client?: Prisma.TransactionClient,
	): Promise<boolean> {
		const db = client ?? prisma;
		const where: Record<string, unknown> = {
			tenantId,
			tipo,
			AND: [
				{ fechaInicio: { lte: fechaFin } },
				{ fechaFin: { gte: fechaInicio } },
			],
		};

		if (excludePeriodoId) {
			where.periodoId = { not: excludePeriodoId };
		}

		const count = await db.periodoContable.count({ where });
		return count > 0;
	}

	// ── Helpers internos ────────────────────────────────────────────────────

	/**
	 * Determina el tipo de período hijo según el tipo padre.
	 */
	private static _hijoTipo(padreTipo: TipoPeriodo): TipoPeriodo {
		switch (padreTipo) {
			case TipoPeriodo.ANUAL:
				return TipoPeriodo.SEMESTRAL;
			case TipoPeriodo.SEMESTRAL:
				return TipoPeriodo.TRIMESTRAL;
			case TipoPeriodo.TRIMESTRAL:
				return TipoPeriodo.MENSUAL;
			case TipoPeriodo.MENSUAL:
				return TipoPeriodo.DIARIO;
			default:
				return TipoPeriodo.DIARIO;
		}
	}

	/**
	 * Retorna todos los tipos descendientes de un período padre en la jerarquía.
	 *
	 * Para ANUAL: [SEMESTRAL, TRIMESTRAL, MENSUAL, DIARIO]
	 * Para SEMESTRAL: [TRIMESTRAL, MENSUAL, DIARIO]
	 * Para TRIMESTRAL: [MENSUAL, DIARIO]
	 * Para MENSUAL: [DIARIO]
	 * Para DIARIO: [DIARIO]
	 *
	 * @param {TipoPeriodo} padreTipo - Tipo del período padre.
	 * @returns {TipoPeriodo[]} Lista de tipos descendientes.
	 */
	private static _obtenerTiposDescendientes(
		padreTipo: TipoPeriodo,
	): TipoPeriodo[] {
		const tipos: TipoPeriodo[] = [];
		let current = padreTipo;
		// Evitar bucle infinito: máximo 4 iteraciones (ANUAL→SEMESTRAL→TRIMESTRAL→MENSUAL→DIARIO)
		for (let i = 0; i < 4; i++) {
			const child = this._hijoTipo(current);
			tipos.push(child);
			if (child === TipoPeriodo.DIARIO) break;
			current = child;
		}
		return tipos;
	}

	/**
	 * Mapea un estado no-writable a su código de error correspondiente.
	 */
	private static _estadoToErrorCode(estado: EstadoPeriodo): PeriodoErrorCode {
		switch (estado) {
			case EstadoPeriodo.CERRADO:
				return "PERIODO_CERRADO";
			case EstadoPeriodo.APROBADO:
				return "PERIODO_APROBADO";
			case EstadoPeriodo.EN_CIERRE:
				return "PERIODO_EN_CIERRE";
			case EstadoPeriodo.BORRADOR:
				return "PERIODO_CERRADO"; // Borrador tampoco permite escrituras
			default:
				return "PERIODO_CERRADO";
		}
	}

	/**
	 * Registra un evento de auditoría en la base de datos.
	 * Este método será reemplazado por PeriodoAuditService en T3.
	 */
	private static async _registrarAuditoria(
		params: {
			periodoId: string;
			tenantId: string;
			evento: EventoAuditoria;
			actor: string;
			motivo?: string;
			entidadAfectada?: string;
			payload?: Record<string, unknown>;
		},
		client?: Prisma.TransactionClient,
	): Promise<void> {
		const db = client ?? prisma;
		await db.auditoriaPeriodo.create({
			data: {
				periodoId: params.periodoId,
				tenantId: params.tenantId,
				evento: params.evento as any,
				actor: params.actor,
				motivo: params.motivo,
				entidadAfectada: params.entidadAfectada,
				payload: params.payload as any,
			},
		});
	}
}

// ── Re-export de PeriodoError para conveniencia ───────────────────────────

export { PeriodoError };
