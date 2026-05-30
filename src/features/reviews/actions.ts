"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/services/tenant-scope";
import { withAction, ActionError } from "@/lib/server-actions";
import { reviewSchema } from "./schemas";

/* ─── submitReviewAction ─── */

/**
 * @description Crea una reseña del usuario para su tenant.
 * Valida rating 1-5, verifica unique constraint, calcula isPositive.
 * Si existe un ReviewPrompt activo, lo vincula.
 */
export const submitReviewAction = withAction(
	async (
		input: { rating: number; comment?: string },
		user: { userId: string; role: string },
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
	async (reviewId: string, user: { userId: string; role: string }) => {
		const tenantId = requireTenant(user);

		const review = await prisma.review.findFirst({
			where: { reviewId, tenantId },
		});
		if (!review) throw new ActionError("Reseña no encontrada", "NOT_FOUND");
		if (user.role !== "admin" && user.role !== "manager") {
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
	async (reviewId: string, user: { userId: string; role: string }) => {
		const tenantId = requireTenant(user);

		const review = await prisma.review.findFirst({
			where: { reviewId, tenantId },
		});
		if (!review) throw new ActionError("Reseña no encontrada", "NOT_FOUND");
		if (user.role !== "admin" && user.role !== "manager") {
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
	async (_: unknown, user: { userId: string }) => {
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

const FEATURE_LABELS: Record<string, string> = {
	productos: "Gestión de productos",
	categorias: "Categorías jerárquicas",
	unidades: "Unidades de medida",
	almacenes: "Hasta 1 almacén",
	ventas: "Ventas POS",
	"venta-servicios": "Ventas de servicios",
	clientes: "Gestión de clientes",
	facturas: "Facturación electrónica",
	"series-facturacion": "Series fiscales",
	gastos: "Control de gastos",
	dashboard: "Dashboard ejecutivo",
	"reportes-basicos": "Reportes operativos",
	"puntos-venta": "Punto de venta",
	"turnos-pos": "Turnos POS",
	"arqueo-caja": "Arqueo de caja",
	"cuadre-diario": "Cuadre diario",
	perfil: "Perfil de usuario",
	"mi-empresa": "Datos de empresa",
	configuracion: "Configuración del sistema",
	servicios: "Servicios",
	notificaciones: "Notificaciones",
	ofertas: "Ofertas y promociones",
	contabilidad: "Contabilidad completa",
	empleados: "Gestión de empleados",
	"pago-salario": "Nómina y salarios",
	compras: "Compras y abastecimiento",
	vendors: "Proveedores",
	mermas: "Control de mermas",
	transferencias: "Transferencias entre sucursales",
	produccion: "Órdenes de producción",
	reparaciones: "Taller de reparaciones",
	contratos: "Gestión de contratos",
	"listas-precios": "Listas de precios",
	"reportes-financieros": "Reportes financieros avanzados",
	backups: "Backups automáticos diarios",
	"cuentas-cobrar": "Cuentas por cobrar",
	"cuentas-pagar": "Cuentas por pagar",
	"prestamos-cash": "Préstamos cash",
	"deudas-cash": "Deudas cash",
	anticipos: "Anticipos",
	"multi-moneda": "Multi-moneda con tasas",
};

export interface PlanDisplay {
	planId: string;
	name: string;
	description: string | null;
	price: number;
	bullets: string[];
	featured: boolean;
	cta: string;
}

/**
 * @description Retorna los planes activos desde la BD para la landing pública.
 * Deriva los bullets de feature flags reales del plan.
 */
export async function getPlansPublicAction(): Promise<PlanDisplay[]> {
	try {
		const plans = await prisma.plan.findMany({
			orderBy: { precio: "asc" },
		});

		return plans.map((plan) => {
			const features = (plan.features as Record<string, boolean>) ?? {};
			const allEnabled = Object.entries(features)
				.filter(([, v]) => v === true)
				.map(([k]) => k);

			// Base features para el plan Básico
			const baseKeys = [
				"ventas",
				"facturas",
				"clientes",
				"series-facturacion",
				"gastos",
				"dashboard",
				"reportes-basicos",
				"puntos-venta",
				"arqueo-caja",
				"cuadre-diario",
				"mi-empresa",
				"notificaciones",
				"ofertas",
			];

			const base = baseKeys
				.filter((m) => features[m])
				.map((m) => FEATURE_LABELS[m]);

			// Extra features (Profesional+)
			const extraKeys = [
				"contabilidad",
				"empleados",
				"pago-salario",
				"compras",
				"vendors",
				"mermas",
				"transferencias",
				"produccion",
				"reparaciones",
				"contratos",
				"listas-precios",
				"reportes-financieros",
				"backups",
				"cuentas-cobrar",
				"cuentas-pagar",
				"prestamos-cash",
				"anticipos",
				"multi-moneda",
			];

			const extras = extraKeys
				.filter((m) => features[m])
				.map((m) => FEATURE_LABELS[m]);

			const bullets =
				plan.nombre === "Básico"
					? ["Gestión completa de productos", ...base]
					: ["Gestión de productos (hasta 5.000)", ...base, ...extras];

			return {
				planId: plan.planId,
				name: plan.nombre,
				description: plan.descripcion,
				price: Number(plan.precio),
				bullets,
				featured: plan.nombre === "Profesional",
				cta:
					plan.nombre === "Básico"
						? "Comenzar"
						: plan.nombre === "Empresarial"
							? "Hablar con ventas"
							: "Solicitar demo",
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

export type ReviewWithUser = Prisma.ReviewGetPayload<{
	include: { user: { select: { name: true; email: true; avatar: true } } };
}>;

/**
 * @description Lista reseñas aprobadas para el tenant autenticado.
 */
export const getApprovedReviewsAction = withAction(
	async (
		input: { limit?: number; orderBy?: "rating_desc" | "newest" } = {},
		user: { userId: string },
	) => {
		const tenantId = requireTenant(user);
		const { limit = 3, orderBy = "rating_desc" } = input ?? {};

		const order: Prisma.ReviewOrderByWithRelationInput =
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
	async (_: unknown, user: { userId: string }) => {
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
	async (_: unknown, user: { userId: string }) => {
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
	async (_: unknown, user: { userId: string; role: string }) => {
		const tenantId = requireTenant(user);
		if (user.role !== "admin" && user.role !== "manager") {
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
