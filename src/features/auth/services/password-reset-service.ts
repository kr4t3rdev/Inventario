/**
 * @description Servicio de negocio para recuperación de contraseña:
 *              genera tokens de reseteo, envía el email y aplica el cambio
 *              de contraseña invalidando sesiones activas.
 *
 * @module features/auth/services/password-reset-service
 */
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { getConfiguredPublicAppUrl } from '@/features/sales-agent/public-url';
import { signOnboardingToken, verifyOnboardingToken } from '@/lib/auth/onboarding';
import { sendPasswordResetEmail } from '@/lib/email';

const RESET_TOKEN_EXPIRES_IN = '1h';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const requestResetSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

/**
 * @description Devuelve la URL pública del app para construir el enlace de reseteo.
 * @returns {string} Origen público canónico.
 */
function getResetAppUrl(): string {
  const origin = getConfiguredPublicAppUrl();
  if (!origin) {
    throw new ActionError('El servicio de recuperación no está disponible', 'SERVICE_UNAVAILABLE');
  }
  return origin;
}

export interface RequestPasswordResetResult {
  success: true;
}

export interface ResetPasswordResult {
  success: true;
}

export interface RequestPasswordResetArgs {
  input: z.infer<typeof requestResetSchema>;
}

export interface ResetPasswordArgs {
  input: z.infer<typeof resetPasswordSchema>;
}

/**
 * @description Genera un token de reseteo de contraseña y envía el email.
 *
 * Por seguridad, retorna éxito genérico sin importar si el email existe,
 * para no revelar qué cuentas están registradas.
 *
 * @param {RequestPasswordResetArgs} args - Email del usuario.
 * @returns {Promise<RequestPasswordResetResult>} Resultado genérico exitoso.
 */
export async function requestPasswordReset({
  input,
}: RequestPasswordResetArgs): Promise<RequestPasswordResetResult> {
  const parsed = requestResetSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { email: parsed.email.toLowerCase() },
    select: { userId: true, name: true, email: true },
  });

  if (!user) {
    return { success: true };
  }

  const token = signOnboardingToken(
    { userId: user.userId, email: user.email, purpose: 'password-reset' },
    RESET_TOKEN_EXPIRES_IN,
  );

  await prisma.user.update({
    where: { userId: user.userId },
    data: {
      resetPasswordToken: token,
      resetPasswordExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const origin = getResetAppUrl();
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

  await sendPasswordResetEmail(user.email, resetUrl, user.name);

  return { success: true };
}

/**
 * @description Aplica el cambio de contraseña con token de reseteo válido,
 *              limpia el token y desactiva todas las sesiones activas del usuario.
 * @param {ResetPasswordArgs} args - Token y nueva contraseña.
 * @returns {Promise<ResetPasswordResult>} Resultado exitoso.
 */
export async function resetPassword({
  input,
}: ResetPasswordArgs): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.parse(input);

  let payload;
  try {
    payload = verifyOnboardingToken(parsed.token, ['password-reset']);
  } catch {
    throw new ActionError('El enlace no es válido o ya fue utilizado', 'INVALID_TOKEN');
  }

  const user = await prisma.user.findUnique({
    where: { userId: payload.userId },
    select: {
      userId: true,
      name: true,
      email: true,
      resetPasswordToken: true,
      resetPasswordExpiresAt: true,
    },
  });

  if (
    !user ||
    user.resetPasswordToken !== parsed.token ||
    !user.resetPasswordExpiresAt ||
    new Date(user.resetPasswordExpiresAt) < new Date()
  ) {
    throw new ActionError('El enlace no es válido o ya fue utilizado', 'INVALID_TOKEN');
  }

  const hashedPassword = await bcrypt.hash(parsed.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { userId: user.userId },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        loginAttempts: 0,
        lockedUntil: null,
        lastFailedLogin: null,
      },
    }),
    prisma.userSession.updateMany({
      where: { userId: user.userId, isActive: true },
      data: { isActive: false },
    }),
    prisma.userActivityLog.create({
      data: {
        userId: user.userId,
        action: 'password_reset',
        details: JSON.stringify({ timestamp: new Date().toISOString() }),
        performedBy: user.userId,
      },
    }),
  ]);

  return { success: true };
}
