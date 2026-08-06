/**
 * @description Server Actions para recuperación de contraseña.
 *
 * Adaptadores web: delegan en PasswordResetService y retornan respuestas
 * estandarizadas { success, data?, error? } para componentes cliente.
 *
 * @module features/auth/actions-password-reset
 */
'use server';

import { z } from 'zod';
import { ActionError } from '@/lib/server-actions';
import {
  requestPasswordReset,
  resetPassword,
} from '@/features/auth/services/password-reset-service';

const requestResetSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

/**
 * @description Solicita un enlace de recuperación de contraseña para un email.
 *
 * Retorna éxito genérico sin revelar si la cuenta existe (anti-enumeración).
 * @param {z.infer<typeof requestResetSchema>} input - Email del usuario.
 * @returns {Promise<{ success: true } | { success: false; error: { message: string; code?: string } }>} Resultado.
 */
export async function requestPasswordResetAction(
  input: z.infer<typeof requestResetSchema>,
): Promise<
  { success: true } | { success: false; error: { message: string; code?: string } }
> {
  try {
    await requestPasswordReset({ input });
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: { message: 'Ingresa un email válido', code: 'VALIDATION_ERROR' } };
    }
    if (error instanceof ActionError) {
      return { success: false, error: { message: error.message, code: error.code } };
    }
    console.error('[requestPasswordResetAction] Error:', error);
    return { success: false, error: { message: 'Error interno del servidor', code: 'INTERNAL_ERROR' } };
  }
}

/**
 * @description Aplica una nueva contraseña usando un token de reseteo.
 * @param {z.infer<typeof resetPasswordSchema>} input - Token y nueva contraseña.
 * @returns {Promise<{ success: true } | { success: false; error: { message: string; code?: string } }>} Resultado.
 */
export async function resetPasswordAction(
  input: z.infer<typeof resetPasswordSchema>,
): Promise<
  { success: true } | { success: false; error: { message: string; code?: string } }
> {
  try {
    await resetPassword({ input });
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: { message: 'Datos inválidos', code: 'VALIDATION_ERROR' } };
    }
    if (error instanceof ActionError) {
      return { success: false, error: { message: error.message, code: error.code } };
    }
    console.error('[resetPasswordAction] Error:', error);
    return { success: false, error: { message: 'Error interno del servidor', code: 'INTERNAL_ERROR' } };
  }
}
