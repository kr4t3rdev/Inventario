/**
 * @description Servicio de dominio puro para períodos contables.
 *
 * Contiene la lógica de negocio: CRUD, transiciones de estado,
 * resolución de períodos por jerarquía, y validación de solapamiento.
 *
 * Este servicio es testeable en aislamiento y no depende de contexto HTTP.
 */

import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions/types';
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
} from './periodo-contable-types';

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
    const tiposBusqueda = tipo ? [tipo] : [TipoPeriodo.DIARIO, TipoPeriodo.MENSUAL, TipoPeriodo.ANUAL];

    for (const t of tiposBusqueda) {
      const periodo = await prisma.periodoContable.findFirst({
        where: {
          tenantId,
          tipo: t,
          fechaInicio: { lte: fecha },
          fechaFin: { gte: fecha },
        },
        orderBy: { fechaInicio: 'desc' },
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
      estado: 'NO_EXISTE',
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
    _tipoOperacion?: 'caja' | 'devengo',
  ): Promise<ValidacionResult> {
    const resultado = await this.resolverPeriodoActivo(fecha, tenantId);

    if (resultado.estado === 'NO_EXISTE') {
      return {
        permitido: false,
        error: new PeriodoError(
          'No existe un período contable para esta fecha. Creá un período primero.',
          'PERIODO_NO_EXISTE',
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
      orderBy: { timestamp: 'asc' },
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
      case TipoPeriodo.MENSUAL: {
        const month = String(fechaInicio.getUTCMonth() + 1).padStart(2, '0');
        return `M-${year}-${month}`;
      }
      case TipoPeriodo.DIARIO: {
        const month = String(fechaInicio.getUTCMonth() + 1).padStart(2, '0');
        const day = String(fechaInicio.getUTCDate()).padStart(2, '0');
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
   * - MENSUAL → busca ANUAL que contenga las fechas
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
  ): Promise<string | null> {
    // ANUAL no tiene padre en la jerarquía
    if (tipo === TipoPeriodo.ANUAL) return null;

    const padreTipo = tipo === TipoPeriodo.MENSUAL ? TipoPeriodo.ANUAL : TipoPeriodo.MENSUAL;

    const padre = await prisma.periodoContable.findFirst({
      where: {
        tenantId,
        tipo: padreTipo,
        fechaInicio: { lte: fechaInicio },
        fechaFin: { gte: fechaFin },
      },
      orderBy: { fechaInicio: 'desc' },
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
  ) {
    // Validar solapamiento
    const solapado = await this.verificarSolapamiento(
      input.tenantId,
      input.tipo,
      input.fechaInicio,
      input.fechaFin,
    );

    if (solapado) {
      throw new PeriodoError(
        `Ya existe un período ${input.tipo.toLowerCase()} con fechas que se solapan para este tenant.`,
        'PERIODO_SOLAPADO',
      );
    }

    // Generar codigo y resolver jerarquía
    const codigo = this.generarCodigoPeriodo(input.tipo, input.fechaInicio);
    const periodoPadreId = await this.resolverPeriodoPadre(
      input.tenantId,
      input.tipo,
      input.fechaInicio,
      input.fechaFin,
    );

    const periodo = await prisma.periodoContable.create({
      data: {
        tenantId: input.tenantId,
        tipo: input.tipo,
        codigo,
        fechaInicio: input.fechaInicio,
        fechaFin: input.fechaFin,
        estado: EstadoPeriodo.ABIERTO,
        periodoPadreId,
        categoria: input.categoria ?? CategoriaPeriodo.ORDINARIO,
        abiertoPorId: actor,
        fechaApertura: new Date(),
        observaciones: input.observaciones,
      },
    });

    // Registrar auditoría
    await this._registrarAuditoria({
      periodoId: periodo.periodoId,
      tenantId: periodo.tenantId,
      evento: EventoAuditoria.APERTURA,
      actor,
    });

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
  ) {
    const periodo = await prisma.periodoContable.findUnique({
      where: { periodoId },
    });

    if (!periodo) {
      throw new ActionError('Período no encontrado', 'NOT_FOUND');
    }

    // Validar transición
    if (!this.validarTransicion(periodo.estado as EstadoPeriodo, EstadoPeriodo.EN_CIERRE)) {
      throw new PeriodoError(
        `No se puede cerrar un período en estado ${periodo.estado}.`,
        'TRANSICION_INVALIDA',
        toResumen(periodo),
      );
    }

    // Validar que no tenga subperíodos abiertos o en cierre
    // Primero por relación explícita (jerarquía), luego por fechas (legacy compat)
    const hijosPorRelacion = await prisma.periodoContable.count({
      where: {
        periodoPadreId: periodoId,
        estado: { in: [EstadoPeriodo.ABIERTO, EstadoPeriodo.EN_CIERRE] },
      },
    });

    if (hijosPorRelacion > 0) {
      throw new PeriodoError(
        `No se puede cerrar el período porque tiene ${hijosPorRelacion} subperíodo(s) abiertos o en cierre.`,
        'HIJOS_ABIERTOS',
        toResumen(periodo),
      );
    }

    // Fallback: para períodos existentes sin jerarquía explícita, validar por fechas
    if (periodo.tipo !== TipoPeriodo.DIARIO) {
      const hijosLegacy = await prisma.periodoContable.count({
        where: {
          tenantId: periodo.tenantId,
          periodoPadreId: null,  // Solo períodos sin padre explícito (legacy)
          tipo: this._hijoTipo(periodo.tipo as TipoPeriodo),
          fechaInicio: { gte: periodo.fechaInicio },
          fechaFin: { lte: periodo.fechaFin },
          estado: { in: [EstadoPeriodo.ABIERTO, EstadoPeriodo.EN_CIERRE] },
        },
      });

      if (hijosLegacy > 0) {
        throw new PeriodoError(
          `No se puede cerrar el período porque tiene ${hijosLegacy} período(s) legacy(s) abiertos o en cierre.`,
          'HIJOS_ABIERTOS',
          toResumen(periodo),
        );
      }
    }

    // Transición: ABIERTO → EN_CIERRE → CERRADO
    // Nota: En T3 se integrará SnapshotService.generarSnapshot() entre estos dos pasos.
    const cerrado = await prisma.periodoContable.update({
      where: { periodoId },
      data: {
        estado: EstadoPeriodo.CERRADO,
        cerradoPor: actor,
        cerradoAt: new Date(),
      },
    });

    // Registrar auditoría con metadatos del cierre
    await this._registrarAuditoria({
      periodoId,
      tenantId: periodo.tenantId,
      evento: EventoAuditoria.CIERRE,
      actor,
      payload: metadata?.snapshotsCount !== undefined || metadata?.operacionesCount !== undefined
        ? {
            ...(metadata.snapshotsCount !== undefined && { snapshots: metadata.snapshotsCount }),
            ...(metadata.operacionesCount !== undefined && { operaciones: metadata.operacionesCount }),
          }
        : undefined,
    });

    return cerrado;
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
  static async reabrirPeriodo(periodoId: string, actor: string, motivo: string) {
    if (!motivo || motivo.trim().length === 0) {
      throw new PeriodoError(
        'El motivo de reapertura es obligatorio.',
        'MOTIVO_REAPERTURA_REQUERIDO',
      );
    }

    const periodo = await prisma.periodoContable.findUnique({
      where: { periodoId },
    });

    if (!periodo) {
      throw new ActionError('Período no encontrado', 'NOT_FOUND');
    }

    // Validar transición
    if (!this.validarTransicion(periodo.estado as EstadoPeriodo, EstadoPeriodo.REABIERTO)) {
      throw new PeriodoError(
        `No se puede reaperturar un período en estado ${periodo.estado}.`,
        'TRANSICION_INVALIDA',
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
      throw new ActionError('Período no encontrado', 'NOT_FOUND');
    }

    // Validar transición
    if (!this.validarTransicion(periodo.estado as EstadoPeriodo, EstadoPeriodo.APROBADO)) {
      throw new PeriodoError(
        `No se puede aprobar un período en estado ${periodo.estado}.`,
        'TRANSICION_INVALIDA',
        toResumen(periodo),
      );
    }

    // Validar segregación de funciones: quien cerró no puede aprobar
    if (periodo.cerradoPor === actor) {
      throw new PeriodoError(
        'La misma persona que cerró el período no puede aprobarlo. Se requiere otro usuario con permisos de aprobación.',
        'MISMO_ACTOR_CIERRE_APROBACION',
        toResumen(periodo),
      );
    }

    // Si ya está aprobado una vez, es segunda aprobación
    const esSegundaAprobacion = periodo.aprobadoPor !== null && periodo.aprobadoPor !== undefined;

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
        tipo: esSegundaAprobacion ? 'segunda_aprobacion' : 'primera_aprobacion',
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
  ): Promise<boolean> {
    const where: Record<string, unknown> = {
      tenantId,
      tipo,
      // Solapamiento: nuevo inicio <= existente fin AND nuevo fin >= existente inicio
      AND: [
        { fechaInicio: { lte: fechaFin } },
        { fechaFin: { gte: fechaInicio } },
      ],
    };

    if (excludePeriodoId) {
      where.periodoId = { not: excludePeriodoId };
    }

    const count = await prisma.periodoContable.count({ where });
    return count > 0;
  }

  // ── Helpers internos ────────────────────────────────────────────────────

  /**
   * Determina el tipo de período hijo según el tipo padre.
   */
  private static _hijoTipo(padreTipo: TipoPeriodo): TipoPeriodo {
    switch (padreTipo) {
      case TipoPeriodo.ANUAL:
        return TipoPeriodo.MENSUAL;
      case TipoPeriodo.MENSUAL:
        return TipoPeriodo.DIARIO;
      default:
        return TipoPeriodo.DIARIO;
    }
  }

  /**
   * Mapea un estado no-writable a su código de error correspondiente.
   */
  private static _estadoToErrorCode(estado: EstadoPeriodo): PeriodoErrorCode {
    switch (estado) {
      case EstadoPeriodo.CERRADO:
        return 'PERIODO_CERRADO';
      case EstadoPeriodo.APROBADO:
        return 'PERIODO_APROBADO';
      case EstadoPeriodo.EN_CIERRE:
        return 'PERIODO_EN_CIERRE';
      case EstadoPeriodo.BORRADOR:
        return 'PERIODO_CERRADO'; // Borrador tampoco permite escrituras
      default:
        return 'PERIODO_CERRADO';
    }
  }

  /**
   * Registra un evento de auditoría en la base de datos.
   * Este método será reemplazado por PeriodoAuditService en T3.
   */
  private static async _registrarAuditoria(params: {
    periodoId: string;
    tenantId: string;
    evento: EventoAuditoria;
    actor: string;
    motivo?: string;
    entidadAfectada?: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await prisma.auditoriaPeriodo.create({
      data: {
        periodoId: params.periodoId,
        tenantId: params.tenantId,
        evento: params.evento,
        actor: params.actor,
        motivo: params.motivo,
        entidadAfectada: params.entidadAfectada,
        payload: params.payload as Record<string, unknown> | undefined,
      },
    });
  }
}

// ── Re-export de PeriodoError para conveniencia ───────────────────────────

export { PeriodoError };
