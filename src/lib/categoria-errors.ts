/**
 * Comprehensive error handling system for category operations
 * Provides user-friendly error messages in Spanish
 */

import prisma from "@/lib/prisma";
import {
	CategoriaValidationError,
	CategoriaErrorCode,
	CATEGORIA_ERROR_MESSAGES,
} from "./categoria-validation";

/**
 * Category deletion validation result
 */
export interface CategoriaDeletionValidationResult {
	canDelete: boolean;
	errors?: CategoriaValidationError[];
	warnings?: CategoriaValidationError[];
	affectedItems?: {
		productos: number;
		subcategorias: number;
		productosSubcategoria: number;
	};
}

/**
 * Error factory for category operations
 */
export class CategoriaErrorFactory {
	/**
	 * Create a validation error
	 */
	static createValidationError(
		code: CategoriaErrorCode,
		message?: string,
		field?: string,
		details?: Record<string, any>,
	): CategoriaValidationError {
		return {
			code,
			message: message || CATEGORIA_ERROR_MESSAGES[code],
			field,
			details,
		};
	}

	/**
	 * Create error for category with products
	 */
	static categoryHasProducts(
		categoryId: string,
		productCount: number,
	): CategoriaValidationError {
		return this.createValidationError(
			CategoriaErrorCode.CATEGORY_HAS_PRODUCTS,
			`No se puede eliminar una categoría que tiene ${productCount} producto(s) asignado(s). Reasigne los productos a otra categoría primero.`,
			undefined,
			{ categoryId, productCount },
		);
	}

	/**
	 * Create error for category with subcategories
	 */
	static categoryHasSubcategories(
		categoryId: string,
		subcategoryCount: number,
	): CategoriaValidationError {
		return this.createValidationError(
			CategoriaErrorCode.CATEGORY_HAS_SUBCATEGORIES,
			`No se puede eliminar una categoría que tiene ${subcategoryCount} subcategoría(s). Elimine o reasigne las subcategorías primero.`,
			undefined,
			{ categoryId, subcategoryCount },
		);
	}

	/**
	 * Create error for subcategory mismatch
	 */
	static subcategoryMismatch(
		categoriaId: string,
		subcategoriaId: string,
		actualParentId: string | null,
	): CategoriaValidationError {
		return this.createValidationError(
			CategoriaErrorCode.SUBCATEGORY_MISMATCH,
			`La subcategoría seleccionada no pertenece a la categoría especificada.`,
			"subcategoriaId",
			{ categoriaId, subcategoriaId, actualParentId },
		);
	}

	/**
	 * Create error for circular reference
	 */
	static circularReference(
		categoryId: string,
		parentId: string,
	): CategoriaValidationError {
		return this.createValidationError(
			CategoriaErrorCode.CIRCULAR_REFERENCE,
			"No se puede crear una referencia circular. Una categoría no puede ser su propia categoría padre o descendiente.",
			"parentId",
			{ categoryId, parentId },
		);
	}

	/**
	 * Create error for maximum depth exceeded
	 */
	static maxDepthExceeded(
		currentDepth: number,
		maxDepth: number,
	): CategoriaValidationError {
		return this.createValidationError(
			CategoriaErrorCode.MAX_DEPTH_EXCEEDED,
			`Se ha excedido la profundidad máxima de categorías. Máximo permitido: ${maxDepth} niveles, actual: ${currentDepth + 1}.`,
			"parentId",
			{ currentDepth, maxDepth },
		);
	}

	/**
	 * Create error for duplicate name
	 */
	static duplicateName(
		nombre: string,
		parentId: string | null,
	): CategoriaValidationError {
		const scope = parentId ? "en esta categoría padre" : "en el nivel raíz";
		return this.createValidationError(
			CategoriaErrorCode.DUPLICATE_NAME,
			`Ya existe una categoría con el nombre "${nombre}" ${scope}.`,
			"nombre",
			{ nombre, parentId },
		);
	}

	/**
	 * Create error response for API
	 */
	static createErrorResponse(errors: CategoriaValidationError[]): {
		success: false;
		error: string;
		errors: CategoriaValidationError[];
		details?: Record<string, any>;
	} {
		const primaryError = errors[0];
		return {
			success: false,
			error: primaryError.message,
			errors,
			details: primaryError.details,
		};
	}

	/**
	 * Get HTTP status code for error
	 */
	static getHttpStatusCode(error: CategoriaValidationError): number {
		switch (error.code) {
			case CategoriaErrorCode.CATEGORY_NOT_FOUND:
			case CategoriaErrorCode.PARENT_NOT_FOUND:
				return 404;

			case CategoriaErrorCode.INVALID_INPUT:
			case CategoriaErrorCode.CIRCULAR_REFERENCE:
			case CategoriaErrorCode.MAX_DEPTH_EXCEEDED:
			case CategoriaErrorCode.DUPLICATE_NAME:
			case CategoriaErrorCode.CATEGORY_HAS_PRODUCTS:
			case CategoriaErrorCode.CATEGORY_HAS_SUBCATEGORIES:
			case CategoriaErrorCode.SUBCATEGORY_MISMATCH:
				return 400;

			default:
				return 500;
		}
	}
}

/**
 * Category deletion validator
 */
export class CategoriaDeletionValidator {
	/**
	 * Validate if a category can be deleted
	 */
	static async validateDeletion(
		categoryId: string,
		tenantId: string,
	): Promise<CategoriaDeletionValidationResult> {
		try {
			const categoria = await prisma.categoria.findFirst({
				where: { catId: categoryId, tenantId },
				select: {
					catId: true,
					parentId: true,
					productos: { select: { id: true } },
					subcategorias: { select: { catId: true } },
					productosSubcategoria: { select: { id: true } },
				},
			});

			if (!categoria) {
				return {
					canDelete: false,
					errors: [
						CategoriaErrorFactory.createValidationError(
							CategoriaErrorCode.CATEGORY_NOT_FOUND,
							"Categoría no encontrada",
							undefined,
							{ categoryId },
						),
					],
				};
			}

			const errors: CategoriaValidationError[] = [];
			const warnings: CategoriaValidationError[] = [];

			// Check if category has subcategories
			if (categoria.subcategorias.length > 0) {
				errors.push(
					CategoriaErrorFactory.categoryHasSubcategories(
						categoryId,
						categoria.subcategorias.length,
					),
				);
			}

			// Check if category has products assigned directly
			if (categoria.productos.length > 0) {
				errors.push(
					CategoriaErrorFactory.categoryHasProducts(
						categoryId,
						categoria.productos.length,
					),
				);
			}

			// Check if category is used as subcategory for products (this is allowed with reassignment)
			if (categoria.productosSubcategoria.length > 0 && categoria.parentId) {
				warnings.push({
					code: "PRODUCTS_WILL_BE_REASSIGNED" as CategoriaErrorCode,
					message: `${categoria.productosSubcategoria.length} producto(s) serán reasignados a la categoría padre.`,
					details: {
						productCount: categoria.productosSubcategoria.length,
						parentId: categoria.parentId,
					},
				});
			}

			return {
				canDelete: errors.length === 0,
				errors: errors.length > 0 ? errors : undefined,
				warnings: warnings.length > 0 ? warnings : undefined,
				affectedItems: {
					productos: categoria.productos.length,
					subcategorias: categoria.subcategorias.length,
					productosSubcategoria: categoria.productosSubcategoria.length,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				"[CategoriaDeletionValidator.validateDeletion]",
				message,
				error,
			);
			return {
				canDelete: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_INPUT,
						message: "Error al validar la eliminación de la categoría",
						details: { error: message },
					},
				],
			};
		}
	}

	/**
	 * Get detailed deletion impact information
	 */
	static async getDeletionImpact(
		categoryId: string,
		tenantId: string,
	): Promise<{
		directProducts: Array<{ id: string; nombre: string }>;
		subcategories: Array<{
			catId: string;
			nombre: string;
			productCount: number;
		}>;
		subcategoryProducts: Array<{ id: string; nombre: string }>;
	}> {
		try {
			const categoria = await prisma.categoria.findFirst({
				where: { catId: categoryId, tenantId },
				include: {
					productos: {
						select: { id: true, nombre: true },
					},
					subcategorias: {
						include: {
							productos: {
								select: { id: true, nombre: true },
							},
						},
					},
					productosSubcategoria: {
						select: { id: true, nombre: true },
					},
				},
			});

			if (!categoria) {
				return {
					directProducts: [],
					subcategories: [],
					subcategoryProducts: [],
				};
			}

			return {
				directProducts: categoria.productos,
				subcategories: categoria.subcategorias.map(
					(sub: { catId: string; nombre: string; productos: any[] }) => ({
						catId: sub.catId,
						nombre: sub.nombre,
						productCount: sub.productos.length,
					}),
				),
				subcategoryProducts: categoria.productosSubcategoria,
			};
		} catch (error) {
			console.error("Error getting deletion impact:", error);
			return {
				directProducts: [],
				subcategories: [],
				subcategoryProducts: [],
			};
		}
	}
}

/**
 * API error handler for category operations
 */
export class CategoriaApiErrorHandler {
	/**
	 * Handle validation errors in API routes
	 */
	static handleValidationErrors(errors: CategoriaValidationError[]): Response {
		const primaryError = errors[0];
		const statusCode = CategoriaErrorFactory.getHttpStatusCode(primaryError);

		return new Response(
			JSON.stringify(CategoriaErrorFactory.createErrorResponse(errors)),
			{
				status: statusCode,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Handle single error in API routes
	 */
	static handleSingleError(error: CategoriaValidationError): Response {
		const statusCode = CategoriaErrorFactory.getHttpStatusCode(error);

		return new Response(
			JSON.stringify(CategoriaErrorFactory.createErrorResponse([error])),
			{
				status: statusCode,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Handle unknown errors in API routes
	 */
	static handleUnknownError(
		error: unknown,
		context?: Record<string, any>,
	): Response {
		console.error("Unknown category error:", error, context);

		const categoriaError: CategoriaValidationError = {
			code: CategoriaErrorCode.INVALID_INPUT,
			message: "Error interno del servidor",
			details: {
				error: error instanceof Error ? error.message : "Unknown error",
				context,
			},
		};

		return this.handleSingleError(categoriaError);
	}

	/**
	 * Create success response for API
	 */
	static createSuccessResponse(data: any, message?: string): Response {
		return new Response(
			JSON.stringify({
				success: true,
				data,
				message,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	/**
	 * Create deletion success response with details
	 */
	static createDeletionSuccessResponse(
		categoryId: string,
		reassignedProducts?: number,
		message?: string,
	): Response {
		const defaultMessage =
			reassignedProducts && reassignedProducts > 0
				? `Categoría eliminada. ${reassignedProducts} producto(s) reasignado(s) a la categoría padre.`
				: "Categoría eliminada exitosamente.";

		return new Response(
			JSON.stringify({
				success: true,
				id: categoryId,
				message: message || defaultMessage,
				reassignedProducts: reassignedProducts || 0,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
