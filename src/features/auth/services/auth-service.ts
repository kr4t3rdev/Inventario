import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getJwtSecret, getRefreshJwtSecret } from '@/lib/secrets';
import { ActionError } from '@/lib/server-actions';
import { resolveTenantContext } from '@/lib/auth-middleware';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { signOnboardingToken } from '@/lib/auth/onboarding';
import type { AuthClientContext, AuthServiceLoginResult, AuthServiceUser, TenantEntry } from '@/features/auth/types';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;
const ACCESS_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const REFRESHED_ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;

const ONBOARDING_MID_FLOW = new Set([
  'pending_email_verification',
  'selecting_user_type',
  'selecting_tenant',
  'awaiting_manager_approval',
  'awaiting_global_approval',
  'awaiting_sales_agent_approval',
]);

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

interface LoginArgs {
  input: z.infer<typeof loginSchema>;
  client?: AuthClientContext;
}

interface RefreshArgs {
  refreshToken: string;
  client?: AuthClientContext;
}

interface SwitchTenantArgs {
  tenantId: string;
  user: AuthenticatedUser;
  client?: AuthClientContext;
}

function isMidOnboarding(onboardingStatus: string | null): boolean {
  if (!onboardingStatus) return false;
  return ONBOARDING_MID_FLOW.has(onboardingStatus);
}

function createTokenPayload(input: {
  userId: string;
  email: string;
  tenantId?: string;
  tenantRole?: string;
  onboardingStatus?: string | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    userId: input.userId,
    email: input.email,
  };

  if (input.tenantId) payload.tenantId = input.tenantId;
  if (input.tenantRole) payload.tenantRole = input.tenantRole;
  if (input.onboardingStatus) payload.onboardingStatus = input.onboardingStatus;

  return payload;
}

function signAuthTokens(
  payload: Record<string, unknown>,
  accessTokenMaxAge = ACCESS_TOKEN_MAX_AGE_SECONDS,
  accessTokenExpiresIn: SignOptions['expiresIn'] = '30d',
) {
  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: accessTokenExpiresIn,
  });
  const refreshToken = jwt.sign(
    { ...payload, refreshId: Date.now() },
    getRefreshJwtSecret(),
    { expiresIn: '30d' },
  );

  return {
    accessToken,
    refreshToken,
    accessTokenMaxAge,
    refreshTokenMaxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  };
}

async function updateUserAuthFields(
  userId: string,
  data: {
    loginAttempts?: number;
    lastFailedLogin?: Date | null;
    lockedUntil?: Date | null;
    expiresAt?: Date | null;
    isActive?: boolean;
  },
): Promise<void> {
  await prisma.user.updateMany({
    where: { userId },
    data,
  });
}

function toPublicUser(
  user: {
    userId: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    expiresAt?: Date | null;
    lockedUntil?: Date | null;
    loginAttempts?: number | null;
    onboardingStatus?: string | null;
  },
  tenantContext: Awaited<ReturnType<typeof resolveTenantContext>>,
): AuthServiceUser {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    expiresAt: user.expiresAt ?? null,
    lockedUntil: user.lockedUntil ?? null,
    loginAttempts: user.loginAttempts ?? 0,
    onboardingStatus: user.onboardingStatus ?? null,
    ...(tenantContext && {
      tenantId: tenantContext.tenantId,
      tenantRole: tenantContext.tenantRole,
      planFeatures: tenantContext.planFeatures,
      planName: tenantContext.planName,
    }),
  };
}

async function notifyAdminsAboutFailedLogin(user: { name: string; email: string }, attempts: number, shouldLock: boolean) {
  if (attempts < 3) return;

  const admins = await prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { userId: true },
  });

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.userId,
        title: shouldLock
          ? 'Usuario bloqueado por intentos fallidos'
          : 'Alerta: Múltiples intentos fallidos',
        message: shouldLock
          ? `El usuario ${user.name} (${user.email}) ha sido bloqueado tras ${MAX_LOGIN_ATTEMPTS} intentos fallidos.`
          : `El usuario ${user.name} (${user.email}) ha realizado ${attempts} intentos fallidos de inicio de sesión.`,
        link: '/admin/usuarios',
        type: shouldLock ? 'error' : 'warning',
        prioridad: 'alta',
      },
    });
  }
}

export const AuthService = {
  /**
   * @description Authenticates a user and returns tokens without touching cookies.
   * @param {LoginArgs} args - Login input and optional client context.
   * @returns {Promise<AuthServiceLoginResult>} Authenticated user and tokens.
   */
  async login({ input, client = {} }: LoginArgs): Promise<AuthServiceLoginResult> {
    const parsed = loginSchema.parse(input);

    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: {
        userId: true,
        name: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        expiresAt: true,
        lockedUntil: true,
        loginAttempts: true,
        onboardingStatus: true,
      },
    });

    if (!user) {
      throw new ActionError('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }

    const rawMidOnboarding =
      user.role !== 'admin' && isMidOnboarding(user.onboardingStatus);
    let midOnboarding = rawMidOnboarding;

    // Self-heal: un worker aprobado (membership activa) no debe quedar atrapado
    // en onboarding aunque su onboardingStatus esté desactualizado (p. ej. si fue
    // activado por updateTenantUserAction o por la API legacy de memberships).
    if (rawMidOnboarding) {
      const activeMembership = await prisma.tenantMembership.findFirst({
        where: { userId: user.userId, isActive: true },
        select: { membershipId: true },
      });
      if (activeMembership) {
        midOnboarding = false;
        await prisma.user.updateMany({
          where: { userId: user.userId, onboardingStatus: { not: null } },
          data: { onboardingStatus: null },
        });
        user.onboardingStatus = null;
      }
    }

    if (!rawMidOnboarding && user.isActive === false) {
      throw new ActionError(
        'Su usuario está inactivo, por favor contacte con el administrador.',
        'USER_INACTIVE',
      );
    }

    if (
      !midOnboarding &&
      user.expiresAt &&
      new Date(user.expiresAt) < new Date() &&
      user.role !== 'admin'
    ) {
      throw new ActionError('Licencia expirada o no válida', 'LICENSE_EXPIRED');
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(user.lockedUntil).getTime() - Date.now()) / (1000 * 60),
      );
      throw new ActionError(
        `Cuenta bloqueada. Intente nuevamente en ${remainingMinutes} minutos.`,
        'ACCOUNT_LOCKED',
      );
    }

    const isValidPassword = await bcrypt.compare(parsed.password, user.password);
    if (!isValidPassword) {
      const newAttempts = (user.loginAttempts || 0) + 1;
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

      await updateUserAuthFields(user.userId, {
        loginAttempts: newAttempts,
        lastFailedLogin: new Date(),
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000)
          : null,
      });

      await notifyAdminsAboutFailedLogin(user, newAttempts, shouldLock);

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
      const message = remainingAttempts > 0
        ? `Credenciales inválidas. ${remainingAttempts} intentos restantes.`
        : `Cuenta bloqueada por ${LOCK_TIME_MINUTES} minutos debido a múltiples intentos fallidos.`;

      throw new ActionError(
        message,
        shouldLock ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
      );
    }

    await updateUserAuthFields(user.userId, {
      loginAttempts: 0,
      lockedUntil: null,
      lastFailedLogin: null,
    });

    let tenantContext: Awaited<ReturnType<typeof resolveTenantContext>> = null;
    if (!midOnboarding) {
      if (user.role === 'salesAgent' && client.tenantId) {
        throw new ActionError(
          'Los Gestores de Ventas no pueden usar contexto de empresa.',
          'FORBIDDEN',
        );
      }
      if (user.role !== 'salesAgent') {
        tenantContext = await resolveTenantContext(user.userId, client.tenantId ?? null);
      }

      if (tenantContext) {
        await updateUserAuthFields(user.userId, {
          expiresAt: tenantContext.licenseExpiresAt ?? null,
        });
      } else if (client.tenantId) {
        throw new ActionError(
          'El tenant solicitado no existe, no está activo o no pertenece a tu usuario.',
          'FORBIDDEN',
        );
      } else if (user.role !== 'admin' && user.role !== 'salesAgent') {
        throw new ActionError('No tenés una empresa activa para iniciar sesión.', 'NO_TENANT');
      }
    }

    const tokenPayload = createTokenPayload({
      userId: user.userId,
      email: user.email,
      tenantId: tenantContext?.tenantId,
      tenantRole: tenantContext?.tenantRole,
      onboardingStatus: midOnboarding ? user.onboardingStatus : null,
    });
    const tokens = signAuthTokens(tokenPayload);

    await prisma.userSession.create({
      data: {
        userId: user.userId,
        token: tokens.accessToken,
        isActive: true,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000),
        ipAddress: client.ipAddress ?? undefined,
        userAgent: client.userAgent ?? undefined,
      },
    });

    await prisma.userActivityLog.create({
      data: {
        userId: user.userId,
        action: 'login',
        details: JSON.stringify({ timestamp: new Date().toISOString() }),
        performedBy: user.userId,
        ipAddress: client.ipAddress ?? undefined,
        userAgent: client.userAgent ?? undefined,
      },
    });

    return {
      user: toPublicUser(user, tenantContext),
      tokens,
      redirectTo: midOnboarding
        ? '/onboarding'
        : user.role === 'admin'
          ? '/admin'
          : user.role === 'salesAgent'
            ? '/sales-agent/referidos'
            : '/busy/dashboard',
      onboardingToken: midOnboarding
        ? signOnboardingToken(
            { userId: user.userId, email: user.email, purpose: 'onboarding' },
            '48h',
          )
        : undefined,
    };
  },

  /**
   * @description Refreshes auth tokens from an explicit refresh token.
   * @param {RefreshArgs} args - Refresh token and optional client context.
   * @returns {Promise<AuthTokens>} New token pair.
   */
  async refresh({ refreshToken, client = {} }: RefreshArgs) {
    if (!refreshToken) {
      throw new ActionError('Sesión expirada', 'SESSION_EXPIRED');
    }

    let payload: {
      userId: string;
      email: string;
      tenantId?: string;
      tenantRole?: string;
    };

    try {
      payload = jwt.verify(refreshToken, getRefreshJwtSecret()) as typeof payload;
    } catch {
      throw new ActionError('Sesión expirada', 'SESSION_EXPIRED');
    }

    const user = await prisma.user.findUnique({
      where: { userId: payload.userId },
      select: { userId: true, isActive: true, expiresAt: true },
    });

    if (!user || !user.isActive) {
      throw new ActionError('Usuario inactivo', 'USER_INACTIVE');
    }

    if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
      await updateUserAuthFields(user.userId, {
        isActive: false,
      });
      throw new ActionError('Licencia expirada', 'USER_INACTIVE');
    }

    const activeSession = await prisma.userSession.findFirst({
      where: { userId: user.userId, isActive: true },
    });
    if (!activeSession) {
      throw new ActionError('Sesión expirada', 'SESSION_EXPIRED');
    }

    const tenantContext = await resolveTenantContext(
      user.userId,
      client.tenantId ?? payload.tenantId ?? null,
    );

    const tokenPayload = createTokenPayload({
      userId: user.userId,
      email: payload.email,
      tenantId: tenantContext?.tenantId,
      tenantRole: tenantContext?.tenantRole,
    });
    const tokens = signAuthTokens(tokenPayload, REFRESHED_ACCESS_TOKEN_MAX_AGE_SECONDS, '15m');

    await prisma.userSession.deleteMany({ where: { userId: user.userId } });
    await prisma.userSession.create({
      data: {
        userId: user.userId,
        token: tokens.accessToken,
        isActive: true,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000),
        ipAddress: client.ipAddress ?? undefined,
        userAgent: client.userAgent ?? undefined,
      },
    });

    return tokens;
  },

  /**
   * @description Deactivates active sessions for a user.
   * @param {AuthenticatedUser} user - Authenticated user context.
   * @returns {Promise<{ success: true }>} Logout result.
   */
  async logout(user: AuthenticatedUser): Promise<{ success: true }> {
    await prisma.userSession.updateMany({
      where: { userId: user.userId, isActive: true },
      data: { isActive: false },
    });

    await prisma.userActivityLog.create({
      data: {
        userId: user.userId,
        action: 'logout',
        details: JSON.stringify({ timestamp: new Date().toISOString() }),
        performedBy: user.userId,
      },
    });

    return { success: true };
  },

  /**
   * @description Returns the current user profile enriched with tenant context.
   * @param {AuthenticatedUser} user - Authenticated user context.
   * @returns {Promise<{ user: Record<string, unknown> }>} Current user payload.
   */
  async me(user: AuthenticatedUser): Promise<{ user: Record<string, unknown> }> {
    const dbUser = await prisma.user.findUnique({
      where: { userId: user.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      throw new ActionError('Usuario no encontrado', 'NOT_FOUND');
    }

    return {
      user: {
        ...dbUser,
        tenantId: user.tenantId,
        tenantRole: user.tenantRole,
        planFeatures: user.planFeatures,
        planName: user.planName,
      },
    };
  },

  /**
   * @description Lists active tenants for the current user.
   * @param {AuthenticatedUser} user - Authenticated user context.
   * @returns {Promise<Array<Record<string, unknown>>>} Tenant memberships.
   */
  async listTenants(user: AuthenticatedUser): Promise<TenantEntry[]> {
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: user.userId, isActive: true },
      include: {
        tenant: { select: { tenantId: true, nombre: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      tenantId: membership.tenantId,
      nombre: membership.tenant.nombre,
      slug: membership.tenant.slug,
      tenantRole: membership.tenantRole,
      isCurrent: membership.tenantId === user.tenantId,
    }));
  },

  /**
   * @description Switches active tenant and returns a fresh token pair.
   * @param {SwitchTenantArgs} args - Tenant switch input.
   * @returns {Promise<{ tenantId: string; tenantRole: string; tokens: AuthTokens }>} Switch result.
   */
  async switchTenant({ tenantId, user, client = {} }: SwitchTenantArgs) {
    const membership = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.userId } },
    });

    if (!membership || !membership.isActive) {
      throw new ActionError('No tenés acceso a esta empresa', 'FORBIDDEN');
    }

    const tenantContext = await resolveTenantContext(user.userId, tenantId);
    if (!tenantContext) {
      throw new ActionError('El tenant ya no está activo para tu usuario', 'FORBIDDEN');
    }

    const tokenPayload = createTokenPayload({
      userId: user.userId,
      email: user.email,
      tenantId: tenantContext.tenantId,
      tenantRole: tenantContext.tenantRole,
    });
    const tokens = signAuthTokens(tokenPayload);

    await prisma.userSession.deleteMany({ where: { userId: user.userId } });
    await prisma.userSession.create({
      data: {
        userId: user.userId,
        token: tokens.accessToken,
        isActive: true,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000),
        ipAddress: client.ipAddress ?? undefined,
        userAgent: client.userAgent ?? undefined,
      },
    });

    return {
      tenantId: tenantContext.tenantId,
      tenantRole: tenantContext.tenantRole,
      tokens,
    };
  },
};
