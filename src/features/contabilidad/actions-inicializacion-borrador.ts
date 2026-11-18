'use server';

import { z } from 'zod';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { withAction } from '@/lib/server-actions';
import { requireTenant } from '@/lib/services/tenant-scope';
import {
  assertInitializationAccess,
  guardarBorradorInicializacion,
  obtenerBorradorInicializacion,
} from './services/initialization-idempotency';

const guardarSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(64),
  borrador: z.unknown(),
}).strict();

const obtenerSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(64),
}).strict();

/**
 * @description Guarda o actualiza el borrador de inicialización del tenant del
 * usuario autenticado. El cliente nunca envía el tenant: se deriva de la
 * sesión y se aplica el gate de apertura (permiso + feature) en servidor.
 * @param input - Clave de idempotencia y carga parcial del borrador.
 * @param user - Usuario autenticado que guarda el borrador.
 * @returns Borrador guardado con su clave, hash y estado BORRADOR.
 */
export const guardarBorradorInicializacionAction = withAction(
  async (input: z.input<typeof guardarSchema>, user: AuthenticatedUser) => {
    assertInitializationAccess(user);
    const parsed = guardarSchema.parse(input);
    const tenantId = requireTenant(user);
    return guardarBorradorInicializacion({ tenantId, ...parsed });
  },
);

/**
 * @description Retoma el borrador de inicialización del tenant del usuario
 * autenticado por su clave. Devuelve null si no hay nada que retomar.
 * @param input - Clave de idempotencia del borrador.
 * @param user - Usuario autenticado que retoma el borrador.
 * @returns Borrador con su clave y hash, o null.
 */
export const obtenerBorradorInicializacionAction = withAction(
  async (input: z.input<typeof obtenerSchema>, user: AuthenticatedUser) => {
    assertInitializationAccess(user);
    const parsed = obtenerSchema.parse(input);
    const tenantId = requireTenant(user);
    return obtenerBorradorInicializacion({ tenantId, ...parsed });
  },
);
