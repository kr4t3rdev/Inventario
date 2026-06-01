/**
 * @description Server Actions de autenticación.
 *
 * loginAction es pública (no requiere autenticación previa).
 * logoutAction, meAction, refreshSessionAction requieren autenticación
 * y están envueltas con withAction().
 *
 * Las cookies httpOnly se setean desde el servidor.
 * El cliente NUNCA almacena el token JWT.
 *
 * @module features/auth/actions
 */
"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { withAction, ActionError } from "@/lib/server-actions";
import { prisma } from "@/lib/prisma";
import { getJwtSecret, getRefreshJwtSecret } from "@/lib/secrets";
import { resolveTenantContext } from "@/lib/auth-middleware";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ─── Constantes ─────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 15;
const ONBOARDING_MID_FLOW = new Set([
	"pending_email_verification",
	"selecting_user_type",
	"selecting_tenant",
	"awaiting_manager_approval",
	"awaiting_global_approval",
]);

function isMidOnboarding(onboardingStatus: string | null): boolean {
	if (!onboardingStatus) return false;
	return ONBOARDING_MID_FLOW.has(onboardingStatus);
}

// ─── Schemas ────────────────────────────────────────────

const loginSchema = z.object({
	email: z.string().email("Email inválido"),
	password: z.string().min(1, "Contraseña requerida"),
});

// ─── loginAction (pública — sin withAction) ──────────────

/**
 * @description Inicia sesión de usuario.
 * Pública: no requiere autenticación previa.
 * Setea cookies httpOnly (auth_token, refreshToken) desde el servidor.
 * NO devuelve el token JWT en el body.
 *
 * Retorna ActionResponse para consistencia con el resto del sistema.
 */
export async function loginAction(
	input: z.infer<typeof loginSchema>,
): Promise<
	| { success: true; data: { user: Record<string, unknown> } }
	| { success: false; error: { message: string; code: string } }
> {
	try {
		const parsed = loginSchema.parse(input);
		const { email, password } = parsed;

		const user = await prisma.user.findUnique({
			where: { email },
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
			return {
				success: false,
				error: { message: "Credenciales inválidas", code: "INVALID_CREDENTIALS" },
			};
		}

		const midOnboarding = isMidOnboarding(user.onboardingStatus);

		if (!midOnboarding && user.isActive === false) {
			return {
				success: false,
				error: {
					message: "Su usuario está inactivo, por favor contacte con el administrador.",
					code: "USER_INACTIVE",
				},
			};
		}

		if (
			!midOnboarding &&
			user.expiresAt &&
			new Date(user.expiresAt) < new Date() &&
			user.role !== "admin"
		) {
			return {
				success: false,
				error: { message: "Licencia expirada o no válida", code: "LICENSE_EXPIRED" },
			};
		}

		if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
			const remainingMinutes = Math.ceil(
				(new Date(user.lockedUntil).getTime() - Date.now()) / (1000 * 60),
			);
			return {
				success: false,
				error: {
					message: `Cuenta bloqueada. Intente nuevamente en ${remainingMinutes} minutos.`,
					code: "ACCOUNT_LOCKED",
				},
			};
		}

		const isValidPassword = await bcrypt.compare(password, user.password);

		if (!isValidPassword) {
			const newAttempts = (user.loginAttempts || 0) + 1;
			const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

			await prisma.user.update({
				where: { userId: user.userId },
				data: {
					loginAttempts: newAttempts,
					lastFailedLogin: new Date(),
					lockedUntil: shouldLock
						? new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000)
						: null,
				},
			});

			if (newAttempts >= 3 && !shouldLock) {
				const admins = await prisma.user.findMany({
					where: { role: "admin", isActive: true },
					select: { userId: true },
				});
				for (const admin of admins) {
					await prisma.notification.create({
						data: {
							userId: admin.userId,
							title: "Alerta: Múltiples intentos fallidos",
							message: `El usuario ${user.name} (${user.email}) ha realizado ${newAttempts} intentos fallidos de inicio de sesión.`,
							type: "warning",
							prioridad: "alta",
						},
					});
				}
			}

			if (shouldLock) {
				const admins = await prisma.user.findMany({
					where: { role: "admin", isActive: true },
					select: { userId: true },
				});
				for (const admin of admins) {
					await prisma.notification.create({
						data: {
							userId: admin.userId,
							title: "Usuario bloqueado por intentos fallidos",
							message: `El usuario ${user.name} (${user.email}) ha sido bloqueado tras ${MAX_LOGIN_ATTEMPTS} intentos fallidos.`,
							type: "error",
							prioridad: "alta",
						},
					});
				}
			}

			const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
			const message =
				remainingAttempts > 0
					? `Credenciales inválidas. ${remainingAttempts} intentos restantes.`
					: `Cuenta bloqueada por ${LOCK_TIME_MINUTES} minutos debido a múltiples intentos fallidos.`;

			return {
				success: false,
				error: {
					message,
					code: shouldLock ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
				},
			};
		}

		// Resetear intentos fallidos
		await prisma.user.update({
			where: { userId: user.userId },
			data: { loginAttempts: 0, lockedUntil: null, lastFailedLogin: null },
		});

		// Resolver tenant context
		let tenantContext: Awaited<ReturnType<typeof resolveTenantContext>> = null;

		if (!midOnboarding) {
			tenantContext = await resolveTenantContext(user.userId, null);

			if (tenantContext) {
				await prisma.user.update({
					where: { userId: user.userId },
					data: { expiresAt: tenantContext.licenseExpiresAt ?? null },
				});
			} else if (user.role !== "admin") {
				return {
					success: false,
					error: {
						message: "No tenés una empresa activa para iniciar sesión.",
						code: "NO_TENANT",
					},
				};
			}
		}

		// Generar JWT
		const tokenPayload: Record<string, unknown> = {
			userId: user.userId,
			email: user.email,
		};
		if (tenantContext) {
			tokenPayload.tenantId = tenantContext.tenantId;
			tokenPayload.tenantRole = tenantContext.tenantRole;
		}
		if (midOnboarding) {
			tokenPayload.onboardingStatus = user.onboardingStatus;
		}

		const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: "30d" });
		const refreshToken = jwt.sign(
			{ ...tokenPayload, refreshId: Date.now() },
			getRefreshJwtSecret(),
			{ expiresIn: "30d" },
		);

		await prisma.userSession.create({
			data: {
				userId: user.userId,
				token,
				isActive: true,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
		});

		// Setear cookies httpOnly
		const cookieStore = await cookies();
		cookieStore.set("auth_token", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 30 * 24 * 60 * 60,
		});
		cookieStore.set("refreshToken", refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 30 * 24 * 60 * 60,
		});

		await prisma.userActivityLog.create({
			data: {
				userId: user.userId,
				action: "login",
				details: JSON.stringify({ timestamp: new Date().toISOString() }),
				performedBy: user.userId,
			},
		});

		const { password: _, ...userWithoutPassword } = user;
		return {
			success: true,
			data: {
				user: {
					...userWithoutPassword,
					...(tenantContext && {
						tenantId: tenantContext.tenantId,
						tenantRole: tenantContext.tenantRole,
					}),
				},
			},
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: { message: "Datos inválidos", code: "VALIDATION_ERROR" },
			};
		}
		console.error("[loginAction] Error:", error);
		return {
			success: false,
			error: { message: "Error interno del servidor", code: "INTERNAL_ERROR" },
		};
	}
}

// ─── logoutAction (autenticada) ──────────────────────────

/**
 * @description Cierra sesión del usuario actual.
 * Desactiva todas las UserSession activas y elimina las cookies.
 */
export const logoutAction = withAction(async (_void: void, user: AuthenticatedUser) => {
	await prisma.userSession.updateMany({
		where: { userId: user.userId, isActive: true },
		data: { isActive: false },
	});

	await prisma.userActivityLog.create({
		data: {
			userId: user.userId,
			action: "logout",
			details: JSON.stringify({ timestamp: new Date().toISOString() }),
			performedBy: user.userId,
		},
	});

	const cookieStore = await cookies();
	cookieStore.delete("auth_token");
	cookieStore.delete("refreshToken");

	revalidatePath("/login");
	return { success: true };
});

// ─── meAction (autenticada) ──────────────────────────────

/**
 * @description Devuelve el usuario autenticado actual.
 */
export const meAction = withAction(async (_void: void, user: AuthenticatedUser) => {
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
		throw new ActionError("Usuario no encontrado", "NOT_FOUND");
	}

	return {
		user: {
			...dbUser,
			tenantId: user.tenantId,
			tenantRole: user.tenantRole,
		},
	};
});

// ─── refreshSessionAction (autenticada) ──────────────────

/**
 * @description Refresca la sesión del usuario usando refreshToken.
 * Lee refreshToken de la cookie, verifica, y emite nuevos tokens.
 */
export const refreshSessionAction = withAction(async (_void: void) => {
	const cookieStore = await cookies();
	const refreshTokenCookie = cookieStore.get("refreshToken");

	if (!refreshTokenCookie?.value) {
		throw new ActionError("Sesión expirada", "SESSION_EXPIRED");
	}

	try {
		const payload = jwt.verify(refreshTokenCookie.value, getRefreshJwtSecret()) as {
			userId: string;
			email: string;
		};

		const user = await prisma.user.findUnique({
			where: { userId: payload.userId },
			select: { userId: true, isActive: true, expiresAt: true },
		});

		if (!user || !user.isActive) {
			cookieStore.delete("auth_token");
			cookieStore.delete("refreshToken");
			throw new ActionError("Usuario inactivo", "USER_INACTIVE");
		}

		const newToken = jwt.sign(
			{ userId: user.userId, email: payload.email },
			getJwtSecret(),
			{ expiresIn: "15m" },
		);
		const newRefreshToken = jwt.sign(
			{ userId: user.userId, email: payload.email, refreshId: Date.now() },
			getRefreshJwtSecret(),
			{ expiresIn: "30d" },
		);

		await prisma.userSession.deleteMany({ where: { userId: user.userId } });
		await prisma.userSession.create({
			data: {
				userId: user.userId,
				token: newRefreshToken,
				isActive: true,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
		});

		cookieStore.set("auth_token", newToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 900,
		});
		cookieStore.set("refreshToken", newRefreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 30 * 24 * 60 * 60,
		});

		return { success: true };
	} catch (err) {
		cookieStore.delete("auth_token");
		cookieStore.delete("refreshToken");
		throw new ActionError("Sesión expirada", "SESSION_EXPIRED");
	}
});

// ─── handleAuthCallback (pública — sin withAction) ───────

/**
 * @description Procesa un callback de autenticación externo (OAuth, etc.).
 * Setea las cookies httpOnly con los tokens recibidos.
 * Pública: recibe tokens ya validados por el provider externo.
 */
export async function handleAuthCallback(input: {
	token: string;
	refreshToken?: string;
}) {
	try {
		const cookieStore = await cookies();

		cookieStore.set("auth_token", input.token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 30 * 24 * 60 * 60,
		});

		if (input.refreshToken) {
			cookieStore.set("refreshToken", input.refreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				path: "/",
				maxAge: 30 * 24 * 60 * 60,
			});
		}

		return { success: true };
	} catch (error) {
		console.error("[handleAuthCallback] Error:", error);
		return { success: false, error: "Error al procesar autenticación" };
	}
}
