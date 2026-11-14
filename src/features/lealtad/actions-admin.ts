/**
 * @description Server Actions administrativas para el programa de lealtad.
 *
 * CRUD de programas, tiers, misiones y referidos. Requiere permisos
 * de administración del tenant.
 *
 * @module features/lealtad/actions-admin
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import {
  programaLealtadSchema,
  programaLealtadUpdateSchema,
  tierLealtadSchema,
  tierLealtadUpdateSchema,
  misionLealtadSchema,
  referidoSchema,
} from './schemas';
import type {
  ProgramaLealtadInput,
  ProgramaLealtadUpdateInput,
  TierLealtadInput,
  TierLealtadUpdateInput,
  MisionLealtadInput,
  ReferidoInput,
} from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { generarCodigoReferido } from './services/referido-engine';

// ─── Programa de Lealtad ──────────────────────────────────────────────

/**
 * @description Crea un nuevo programa de lealtad para el tenant.
 * @param {ProgramaLealtadInput} input - Datos del programa.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Programa creado.
 */
export const createProgramaLealtadAction = withAction(
  async (input: ProgramaLealtadInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'crear programa de lealtad');
    const parsed = programaLealtadSchema.parse(input);
    const tenantId = requireTenant(user);

    const existente = await prisma.programaLealtad.findFirst({
      where: { tenantId, activo: true },
    });
    if (existente) throw new ActionError('Ya existe un programa activo', 'DUPLICATE');

    const programa = await prisma.programaLealtad.create({
      data: {
        tenantId,
        nombre: parsed.nombre,
        activo: parsed.activo ?? true,
        puntosPorPeso: parsed.puntosPorPeso,
        puntosMinimos: parsed.puntosMinimos,
        valorCanje: parsed.valorCanje,
        reglas: (parsed.reglas ?? null) as any,
      },
    });

    revalidatePath('/busy/lealtad');
    return programa;
  },
);

/**
 * @description Actualiza un programa de lealtad existente.
 * @param {ProgramaLealtadUpdateInput} input - ID y campos a actualizar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Programa actualizado.
 */
export const updateProgramaLealtadAction = withAction(
  async (input: ProgramaLealtadUpdateInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'editar programa de lealtad');
    const parsed = programaLealtadUpdateSchema.parse(input);
    const tenantId = requireTenant(user);

    const existente = await prisma.programaLealtad.findFirst({
      where: { programaId: parsed.programaId, tenantId },
    });
    if (!existente) throw new ActionError('Programa no encontrado', 'NOT_FOUND');

    const { programaId, ...data } = parsed;
    const programa = await prisma.programaLealtad.update({
      where: { programaId },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(data.puntosPorPeso !== undefined && { puntosPorPeso: data.puntosPorPeso }),
        ...(data.puntosMinimos !== undefined && { puntosMinimos: data.puntosMinimos }),
        ...(data.valorCanje !== undefined && { valorCanje: data.valorCanje }),
        ...(data.reglas !== undefined && { reglas: data.reglas as any }),
      } as any,
    });

    revalidatePath('/busy/lealtad');
    return programa;
  },
);

// ─── Tiers ─────────────────────────────────────────────────────────────

/**
 * @description Crea un nuevo tier en el programa de lealtad.
 * @param {TierLealtadInput} input - Datos del tier.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Tier creado.
 */
export const createTierLealtadAction = withAction(
  async (input: TierLealtadInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'crear tier de lealtad');
    const parsed = tierLealtadSchema.parse(input);
    const tenantId = requireTenant(user);

    const programa = await prisma.programaLealtad.findFirst({
      where: { programaId: parsed.programaId, tenantId },
    });
    if (!programa) throw new ActionError('Programa no encontrado', 'NOT_FOUND');

    const tier = await prisma.tierLealtad.create({
      data: {
        programaId: parsed.programaId,
        nombre: parsed.nombre,
        orden: parsed.orden,
        umbralGasto: parsed.umbralGasto,
        umbralFrecuencia: parsed.umbralFrecuencia ?? null,
        beneficios: parsed.beneficios,
        color: parsed.color ?? null,
        icono: parsed.icono ?? null,
        activo: parsed.activo ?? true,
      },
    });

    revalidatePath('/busy/lealtad');
    return tier;
  },
);

/**
 * @description Actualiza un tier existente.
 * @param {TierLealtadUpdateInput} input - ID y campos a actualizar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Tier actualizado.
 */
export const updateTierLealtadAction = withAction(
  async (input: TierLealtadUpdateInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'editar tier de lealtad');
    const parsed = tierLealtadUpdateSchema.parse(input);
    const tenantId = requireTenant(user);

    const existente = await prisma.tierLealtad.findFirst({
      where: { tierId: parsed.tierId },
      include: { programa: true },
    });
    if (!existente) throw new ActionError('Tier no encontrado', 'NOT_FOUND');
    if (existente.programa.tenantId !== tenantId) throw new ActionError('No autorizado', 'FORBIDDEN');

    const { tierId, ...data } = parsed;
    const tier = await prisma.tierLealtad.update({
      where: { tierId },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.orden !== undefined && { orden: data.orden }),
        ...(data.umbralGasto !== undefined && { umbralGasto: data.umbralGasto }),
        ...(data.umbralFrecuencia !== undefined && { umbralFrecuencia: data.umbralFrecuencia }),
        ...(data.beneficios !== undefined && { beneficios: data.beneficios }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icono !== undefined && { icono: data.icono }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    });

    revalidatePath('/busy/lealtad');
    return tier;
  },
);

/**
 * @description Obtiene todos los tiers de un programa.
 * @param {string} programaId - ID del programa.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Lista de tiers ordenados.
 */
export const getTiersAction = withAction(
  async (programaId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'consultar tiers');
    const tenantId = requireTenant(user);

    const programa = await prisma.programaLealtad.findFirst({
      where: { programaId, tenantId },
    });
    if (!programa) throw new ActionError('Programa no encontrado', 'NOT_FOUND');

    return prisma.tierLealtad.findMany({
      where: { programaId },
      orderBy: { orden: 'asc' },
    });
  },
);

// ─── Misiones ──────────────────────────────────────────────────────────

/**
 * @description Crea una nueva misión de gamificación.
 * @param {MisionLealtadInput} input - Datos de la misión.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Misión creada.
 */
export const createMisionLealtadAction = withAction(
  async (input: MisionLealtadInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-gamificacion', 'crear misión de gamificación');
    const parsed = misionLealtadSchema.parse(input);
    const tenantId = requireTenant(user);

    const programa = await prisma.programaLealtad.findFirst({
      where: { programaId: parsed.programaId, tenantId },
    });
    if (!programa) throw new ActionError('Programa no encontrado', 'NOT_FOUND');

    const mision = await prisma.misionLealtad.create({
      data: {
        tenantId,
        programaId: parsed.programaId,
        nombre: parsed.nombre,
        descripcion: parsed.descripcion ?? null,
        tipo: parsed.tipo,
        reglas: parsed.reglas,
        recompensaPuntos: parsed.recompensaPuntos,
        validoDesde: parsed.validoDesde,
        validoHasta: parsed.validoHasta ?? null,
        activo: parsed.activo ?? true,
        vecesMaximo: parsed.vecesMaximo ?? null,
      },
    });

    revalidatePath('/busy/lealtad');
    return mision;
  },
);

/**
 * @description Obtiene las misiones activas de un programa.
 * @param {string} programaId - ID del programa.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Misiones activas.
 */
export const getMisionesActivasAction = withAction(
  async (programaId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-gamificacion', 'consultar misiones');
    const tenantId = requireTenant(user);

    const programa = await prisma.programaLealtad.findFirst({
      where: { programaId, tenantId },
    });
    if (!programa) throw new ActionError('Programa no encontrado', 'NOT_FOUND');

    const ahora = new Date();
    return prisma.misionLealtad.findMany({
      where: {
        programaId,
        activo: true,
        validoDesde: { lte: ahora },
        OR: [{ validoHasta: null }, { validoHasta: { gte: ahora } }],
      },
      orderBy: { validoDesde: 'asc' },
    });
  },
);

/**
 * @description Obtiene el progreso de misiones de un cliente.
 * @param {string} clienteId - ID del cliente.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Progreso con detalles de cada misión.
 */
export const getProgresoMisionesAction = withAction(
  async (clienteId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-gamificacion', 'consultar progreso de misiones');
    const tenantId = requireTenant(user);

    return prisma.progresoMision.findMany({
      where: { tenantId, clienteId },
      include: { mision: true },
      orderBy: { completado: 'asc' },
    });
  },
);

// ─── Referidos ─────────────────────────────────────────────────────────

/**
 * @description Genera un código de referido para un cliente.
 * @param {ReferidoInput} input - ID del refiriente y incentivos.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Referido creado con código.
 */
export const createReferidoAction = withAction(
  async (input: ReferidoInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-referidos', 'crear código de referido');
    const parsed = referidoSchema.parse(input);
    const tenantId = requireTenant(user);

    const codigo = generarCodigoReferido(parsed.refirienteId);

    const referido = await prisma.referidoLealtad.create({
      data: {
        tenantId,
        codigoReferral: codigo,
        refirienteId: parsed.refirienteId,
        estado: 'PENDIENTE',
        incentivoRefiriente: parsed.incentivoRefiriente,
        incentivoReferido: parsed.incentivoReferido,
      },
    });

    revalidatePath('/busy/lealtad');
    return referido;
  },
);

/**
 * @description Obtiene los referidos de un cliente.
 * @param {string} refirienteId - ID del cliente refiriente.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Referidos con estado.
 */
export const getReferidosAction = withAction(
  async (refirienteId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-referidos', 'consultar referidos');
    const tenantId = requireTenant(user);

    return prisma.referidoLealtad.findMany({
      where: { tenantId, refirienteId },
      orderBy: { createdAt: 'desc' },
    });
  },
);
