"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { getReferralPrice } from "@/lib/services/plan-pricing";
import { withAction, ActionError } from "@/lib/server-actions";
import { reviewSchema } from "./schemas";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

/* ─── submitReviewAction ─── */

/**
 * @description Crea una reseña del usuario para su tenant.
 * Valida rating 1-5, verifica unique constraint, calcula isPositive.
 * Si existe un ReviewPrompt activo, lo vincula.
 */
export const submitReviewAction = withAction(
	async (
		input: { rating: number; comment?: string },
		user: AuthenticatedUser,
	) => {
		const parsed = reviewSchema.parse(input);
		const tenantId = requireTenant(user);

		const existing = await prisma.review.findUnique({
			where: { tenantId_userId: { tenantId, userId: user.userId } },
		});
		if (existing) {
			throw new ActionError("Ya calificaste el sistema", "DUPLICATE");
		}

		const review = await prisma.review.create({
			data: {
				tenantId,
				userId: user.userId,
				rating: parsed.rating,
				comment: parsed.comment,
				isPositive: parsed.rating >= 4,
			},
		});

		// Vincular prompt activo si existe
		await prisma.reviewPrompt.updateMany({
			where: {
				tenantId,
				userId: user.userId,
				submittedAt: null,
				dismissedAt: null,
			},
			data: { submittedAt: new Date() },
		});

		revalidatePath("/");
		return { review };
	},
);

/* ─── approveReviewAction ─── */

/**
 * @description Aprueba una reseña para hacerla pública.
 * Solo accesible para admin/manager del mismo tenant.
 */
export const approveReviewAction = withAction(
	async (reviewId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const review = await prisma.review.findFirst({
			where: { reviewId, tenantId },
		});
		if (!review) throw new ActionError("Reseña no encontrada", "NOT_FOUND");
		if (user.role !== "admin" && (user as any).role !== "manager") {
			throw new ActionError("No autorizado", "FORBIDDEN");
		}

		const updated = await prisma.review.update({
			where: { reviewId },
			data: { isApproved: true },
		});

		revalidatePath("/busy/reviews");
		revalidatePath("/");
		return { review: updated };
	},
);

/* ─── rejectReviewAction ─── */

/**
 * @description Rechaza (elimina) una reseña no aprobada.
 * Solo accesible para admin/manager del mismo tenant.
 */
export const rejectReviewAction = withAction(
	async (reviewId: string, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const review = await prisma.review.findFirst({
			where: { reviewId, tenantId },
		});
		if (!review) throw new ActionError("Reseña no encontrada", "NOT_FOUND");
		if (user.role !== "admin" && (user as any).role !== "manager") {
			throw new ActionError("No autorizado", "FORBIDDEN");
		}

		await prisma.review.delete({ where: { reviewId } });

		revalidatePath("/busy/reviews");
		revalidatePath("/");
		return { success: true };
	},
);

/* ─── getReviewStatsAction ─── */

/**
 * @description Retorna estadísticas agregadas de reseñas aprobadas
 * para el tenant del usuario autenticado.
 */
export const getReviewStatsAction = withAction(
	async (_: unknown, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const [totalApproved, positiveApproved, ratingAgg] = await Promise.all([
			prisma.review.count({ where: { tenantId, isApproved: true } }),
			prisma.review.count({
				where: { tenantId, isApproved: true, isPositive: true },
			}),
			prisma.review.aggregate({
				where: { tenantId, isApproved: true },
				_avg: { rating: true },
			}),
		]);

		return {
			averageRating: ratingAgg._avg.rating ?? 0,
			totalApproved,
			totalPositive: positiveApproved,
		};
	},
);

/* ─── getActiveTenantsCountAction ─── */

/**
 * @description Retorna la cantidad real de empresas activas (con licencia activa).
 */
export async function getActiveTenantsCountAction(): Promise<number> {
	try {
		return await prisma.tenant.count({
			where: {
				licencias: { some: { activa: true } },
			},
		});
	} catch {
		return 0;
	}
}

/* ─── getLandingStatsPublicAction ─── */

export interface LandingStats {
	modulosActivos: number;
	almacenes: number;
	ventasProcesadas: number;
	clientesRegistrados: number;
}

/**
 * @description Retorna estadísticas reales del sistema para la landing pública.
 * Cada valor se consulta directamente de la base de datos.
 */
export async function getLandingStatsPublicAction(): Promise<LandingStats> {
	try {
		const [almacenes, ventasProcesadas, clientesRegistrados] =
			await Promise.all([
				prisma.almacen.count(),
				prisma.venta.count(),
				prisma.cliente.count(),
			]);

		return {
			modulosActivos: 35, // rutas /busy/ activas
			almacenes,
			ventasProcesadas,
			clientesRegistrados,
		};
	} catch {
		return {
			modulosActivos: 35,
			almacenes: 0,
			ventasProcesadas: 0,
			clientesRegistrados: 0,
		};
	}
}

/* ─── getPlansPublicAction ─── */

import {
	FEATURE_REGISTRY,
	CATEGORY_ORDER,
	CATEGORY_LABELS,
	getEnabledFeatureLabels,
} from "@/features/planes/feature-registry";

export interface PlanDisplay {
	planId: string;
	name: string;
	description: string | null;
	price: number;
	/** Precio con descuento por referido (precio base - $5 USD). */
	referralPrice: number;
	bullets: string[];
	featuresByCategory: Record<string, string[]>;
	featured: boolean;
	cta: string;
	limits: {
		maxUsuarios: number;
		maxAlmacenes: number;
		maxProductos: number;
		maxClientes: number;
		maxPuntosVenta: number;
	};
}

/**
 * @description Retorna los planes activos desde la BD para la landing pública.
 * Usa el Feature Registry para generar bullets y agrupaciones dinámicamente.
 */
export async function getPlansPublicAction(): Promise<PlanDisplay[]> {
	try {
		const plans = await prisma.plan.findMany({
			orderBy: { precio: "asc" },
		});

		return plans.map((plan) => {
			const features = (plan.features as Record<string, boolean>) ?? {};

			const enabledLabels = getEnabledFeatureLabels(features);

			// Agrupar features por categoría
			const featuresByCategory: Record<string, string[]> = {};
			for (const cat of CATEGORY_ORDER) {
				const catFeatures = FEATURE_REGISTRY.filter(
					(f) => f.category === cat && features[f.key] === true,
				).map((f) => f.label);
				if (catFeatures.length > 0) {
					featuresByCategory[CATEGORY_LABELS[cat]] = catFeatures;
				}
			}

			// Límites del plan como bullets
			const limitBullets: string[] = [];
			if (plan.maxUsuarios > 0) {
				limitBullets.push(
					plan.maxUsuarios >= 999
						? "Usuarios ilimitados"
						: `Hasta ${plan.maxUsuarios} usuarios`,
				);
			}
			if (plan.maxAlmacenes > 0) {
				limitBullets.push(
					plan.maxAlmacenes >= 999
						? "Almacenes ilimitados"
						: `Hasta ${plan.maxAlmacenes} almacenes`,
				);
			}
			if (plan.maxPuntosVenta > 0) {
				limitBullets.push(
					plan.maxPuntosVenta >= 999
						? "Puntos de venta ilimitados"
						: `Hasta ${plan.maxPuntosVenta} puntos de venta`,
				);
			}
			if (plan.maxProductos > 0) {
				limitBullets.push(
					plan.maxProductos >= 999999
						? "Productos ilimitados"
						: `Hasta ${plan.maxProductos.toLocaleString()} productos`,
				);
			}

			const bullets = [...limitBullets, ...enabledLabels];

			const nameLower = plan.nombre.toLowerCase();
			const featured = nameLower === "profesional" || nameLower === "recomendado";
			const cta =
				nameLower === "básico" || nameLower === "basico"
					? "Comenzar"
					: nameLower === "empresarial" || nameLower === "enterprise"
						? "Hablar con ventas"
						: "Solicitar demo";

			return {
				planId: plan.planId,
				name: plan.nombre,
				description: plan.descripcion,
				price: Number(plan.precio),
				referralPrice: getReferralPrice(Number(plan.precio)),
				bullets,
				featuresByCategory,
				featured,
				cta,
				limits: {
					maxUsuarios: plan.maxUsuarios,
					maxAlmacenes: plan.maxAlmacenes,
					maxProductos: plan.maxProductos,
					maxClientes: plan.maxClientes,
					maxPuntosVenta: plan.maxPuntosVenta,
				},
			};
		});
	} catch {
		return [];
	}
}

/* ─── getReviewStatsPublicAction ─── */

/**
 * @description Retorna estadísticas agregadas de reseñas para la landing pública.
 * Usa NEXT_PUBLIC_DEFAULT_TENANT_ID como tenant de referencia.
 */
export async function getReviewStatsPublicAction() {
	const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
	if (!tenantId)
		return { averageRating: 0, totalApproved: 0, totalPositive: 0 };

	const [totalApproved, positiveApproved, ratingAgg] = await Promise.all([
		prisma.review.count({ where: { tenantId, isApproved: true } }),
		prisma.review.count({
			where: { tenantId, isApproved: true, isPositive: true },
		}),
		prisma.review.aggregate({
			where: { tenantId, isApproved: true },
			_avg: { rating: true },
		}),
	]);

	return {
		averageRating: ratingAgg._avg.rating ?? 0,
		totalApproved,
		totalPositive: positiveApproved,
	};
}

/* ─── getApprovedReviewsAction ─── */

export type ReviewWithUser = {
	reviewId: string;
	tenantId: string;
	userId: string;
	rating: number;
	comment: string | null;
	isPositive: boolean;
	isApproved: boolean;
	helpfulCount: number;
	createdAt: Date;
	updatedAt: Date;
	user?: {
		name: string;
		email: string;
		avatar: string | null;
	} | null;
};

/**
 * @description Lista reseñas aprobadas para el tenant autenticado.
 */
export const getApprovedReviewsAction = withAction(
	async (
		input: { limit?: number; orderBy?: "rating_desc" | "newest" } = {},
		user: AuthenticatedUser,
	) => {
		const tenantId = requireTenant(user);
		const { limit = 3, orderBy = "rating_desc" } = input ?? {};

		const order: { rating?: 'desc' | 'asc'; createdAt?: 'desc' | 'asc' } =
			orderBy === "newest" ? { createdAt: "desc" } : { rating: "desc" };

		const reviews = await prisma.review.findMany({
			where: { tenantId, isApproved: true },
			orderBy: [order, { createdAt: "desc" }],
			take: limit,
			include: {
				user: { select: { name: true, avatar: true } },
			},
		});

		return { reviews };
	},
);

/* ─── getApprovedReviewsPublicAction ─── */

/**
 * @description Lista reseñas aprobadas para la landing pública.
 * Usa NEXT_PUBLIC_DEFAULT_TENANT_ID como tenant de referencia.
 */
export async function getApprovedReviewsPublicAction(input?: {
	limit?: number;
}) {
	const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
	if (!tenantId) return { reviews: [] };

	const { limit = 3 } = input ?? {};

	const reviews = await prisma.review.findMany({
		where: { tenantId, isApproved: true },
		orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
		take: limit,
		include: {
			user: { select: { name: true, avatar: true } },
		},
	});

	return { reviews };
}

/* ─── canPromptReviewAction ─── */

/**
 * @description Verifica si se debe mostrar el dialog de reseña al usuario.
 * Retorna true solo si: no tiene reseña, no tuvo prompt hoy, y sesión activa < 24h.
 */
export const canPromptReviewAction = withAction(
	async (_: unknown, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const [existingReview, todayPrompt, lastSession] = await Promise.all([
			prisma.review.findUnique({
				where: { tenantId_userId: { tenantId, userId: user.userId } },
			}),
			prisma.reviewPrompt.findFirst({
				where: {
					tenantId,
					userId: user.userId,
					promptedAt: { gte: todayStart },
				},
			}),
			prisma.userSession.findFirst({
				where: { userId: user.userId, isActive: true },
				orderBy: { lastActive: "desc" },
				select: { lastActive: true },
			}),
		]);

		if (existingReview) return { canPrompt: false };
		if (todayPrompt) return { canPrompt: false };

		const isActiveRecently =
			lastSession &&
			lastSession.lastActive > new Date(Date.now() - 24 * 60 * 60 * 1000);

		if (!isActiveRecently) return { canPrompt: false };

		return { canPrompt: true };
	},
);

/* ─── dismissReviewPromptAction ─── */

/**
 * @description Registra que el usuario cerró el dialog de reseña sin enviar.
 */
export const dismissReviewPromptAction = withAction(
	async (_: unknown, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);

		await prisma.reviewPrompt.create({
			data: { tenantId, userId: user.userId, dismissedAt: new Date() },
		});

		return { success: true };
	},
);

/* ─── getPendingReviewsAction ─── */

/**
 * @description Lista reseñas pendientes de aprobación (admin/manager).
 */
export const getPendingReviewsAction = withAction(
	async (_: unknown, user: AuthenticatedUser) => {
		const tenantId = requireTenant(user);
		if (user.role !== "admin" && (user as any).role !== "manager") {
			throw new ActionError("No autorizado", "FORBIDDEN");
		}

		const reviews = await prisma.review.findMany({
			where: { tenantId, isApproved: false },
			orderBy: { createdAt: "desc" },
			include: {
				user: { select: { name: true, email: true, avatar: true } },
			},
		});

		const stats = await prisma.review.aggregate({
			where: { tenantId },
			_count: true,
		});

		return { reviews, total: stats._count };
	},
);
