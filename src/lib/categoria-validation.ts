/**
 * Validation utilities for category and subcategory operations
 * Implements business rules for hierarchical category management
 */

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getClasClassifierData } from "@/lib/clas-classifier.server";
import {
	isSpecificInSection,
	validateCLASSection,
	validateCLASSpecific,
} from "@/lib/clas-classifier";

// Zod schema for category creation/update
export const CategoriaSchema = z.object({
	nombre: z
		.string()
		.min(1, "El nombre es requerido")
		.max(100, "El nombre no puede exceder 100 caracteres")
		.refine((val) => val.trim().length > 0, "El nombre no puede estar vacío"),

	descripcion: z
		.string()
		.max(500, "La descripción no puede exceder 500 caracteres")
		.optional(),

	parentId: z.string().optional().nullable(),

	clasSectionId: z.string().optional().nullable(),

	clasSpecificId: z.string().optional().nullable(),
});

const CategoriaUpdateSchema = CategoriaSchema.partial().refine(
	(data) => Object.keys(data).length > 0,
	{
		message: "Debe enviar al menos un campo para actualizar",
	},
);

export type CategoriaInput = z.infer<typeof CategoriaSchema>;
export type CategoriaUpdateInput = z.infer<typeof CategoriaUpdateSchema>;

/**
 * Validation result interface
 */
export interface CategoriaValidationResult {
	success: boolean;
	data?: CategoriaInput;
	errors?: CategoriaValidationError[];
}

/**
 * Category validation error interface
 */
export interface CategoriaValidationError {
	code: string;
	message: string;
	field?: string;
	details?: Record<string, any>;
}

/**
 * Error codes for category validation
 */
export enum CategoriaErrorCode {
	INVALID_INPUT = "INVALID_INPUT",
	CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",
	MAX_DEPTH_EXCEEDED = "MAX_DEPTH_EXCEEDED",
	DUPLICATE_NAME = "DUPLICATE_NAME",
	PARENT_NOT_FOUND = "PARENT_NOT_FOUND",
	CATEGORY_HAS_PRODUCTS = "CATEGORY_HAS_PRODUCTS",
	CATEGORY_HAS_SUBCATEGORIES = "CATEGORY_HAS_SUBCATEGORIES",
	SUBCATEGORY_MISMATCH = "SUBCATEGORY_MISMATCH",
	CATEGORY_NOT_FOUND = "CATEGORY_NOT_FOUND",
	INVALID_CLAS_MAPPING = "INVALID_CLAS_MAPPING",
}

/**
 * Error messages in Spanish
 */
export const CATEGORIA_ERROR_MESSAGES = {
	[CategoriaErrorCode.INVALID_INPUT]: "Datos de entrada inválidos",
	[CategoriaErrorCode.CIRCULAR_REFERENCE]:
		"No se puede crear una referencia circular en las categorías",
	[CategoriaErrorCode.MAX_DEPTH_EXCEEDED]:
		"Se ha excedido la profundidad máxima de categorías (3 niveles)",
	[CategoriaErrorCode.DUPLICATE_NAME]:
		"Ya existe una categoría con este nombre en el mismo nivel",
	[CategoriaErrorCode.PARENT_NOT_FOUND]: "Categoría padre no encontrada",
	[CategoriaErrorCode.CATEGORY_HAS_PRODUCTS]:
		"No se puede eliminar una categoría que tiene productos asignados",
	[CategoriaErrorCode.CATEGORY_HAS_SUBCATEGORIES]:
		"No se puede eliminar una categoría que tiene subcategorías",
	[CategoriaErrorCode.SUBCATEGORY_MISMATCH]:
		"La subcategoría debe pertenecer a la misma categoría padre",
	[CategoriaErrorCode.CATEGORY_NOT_FOUND]: "Categoría no encontrada",
	[CategoriaErrorCode.INVALID_CLAS_MAPPING]:
		"Categoria invalida en modo EAN-13",
};

/**
 * Maximum hierarchy depth allowed (3 levels: Category > Subcategory > Sub-subcategory)
 */
export const MAX_HIERARCHY_DEPTH = 3;

/**
 * Validate category against CLAS mapping when EAN-13 mode is enabled
 */
export async function validateCategoryAgainstCLAS(
	nombre: string,
	parentId: string | null,
	tenantId: string,
	clasSectionId?: string | null,
	clasSpecificId?: string | null,
	options?: {
		skipEan13Validation?: boolean;
	},
): Promise<CategoriaValidationResult> {
	try {
		if (options?.skipEan13Validation) {
			return { success: true };
		}

		// Check if EAN-13 mode is enabled for the current tenant.
		// ⚠️ IMPORTANTE: el modelo MiEmpresa es 1:1 por tenant (id siempre vale 1,
		// pero tenantId es UNIQUE). NUNCA buscar por `id: 1` sin filtrar por tenant,
		// porque devuelve el flag de un tenant arbitrario.
		const miEmpresa = await prisma.miEmpresa.findUnique({
			where: { tenantId },
			select: { usaCodigoEan13: true },
		});

		// If EAN-13 is disabled, skip validation
		if (!miEmpresa?.usaCodigoEan13) {
			return { success: true };
		}

		const classifier = getClasClassifierData();
		const normalizedSectionId = clasSectionId?.trim() || null;
		const normalizedSpecificId = clasSpecificId?.trim() || null;

		try {
			if (normalizedSpecificId) {
				if (!normalizedSectionId || !parentId) {
					return {
						success: false,
						errors: [
							{
								code: CategoriaErrorCode.INVALID_CLAS_MAPPING,
								message:
									"Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador",
								field: "clasSpecificId",
								details: { nombre, parentId, clasSectionId, clasSpecificId },
							},
						],
					};
				}

				const matchedSpecificId = validateCLASSpecific(nombre);
				if (matchedSpecificId !== normalizedSpecificId) {
					return {
						success: false,
						errors: [
							{
								code: CategoriaErrorCode.INVALID_CLAS_MAPPING,
								message:
									"Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador",
								field: "clasSpecificId",
								details: { nombre, parentId, clasSectionId, clasSpecificId },
							},
						],
					};
				}

				if (!classifier.specificSectionById[normalizedSpecificId]) {
					return {
						success: false,
						errors: [
							{
								code: CategoriaErrorCode.INVALID_CLAS_MAPPING,
								message:
									"Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador",
								field: "clasSpecificId",
								details: { nombre, parentId, clasSectionId, clasSpecificId },
							},
						],
					};
				}

				if (
					normalizedSectionId &&
					!isSpecificInSection(
						classifier,
						normalizedSectionId,
						normalizedSpecificId,
					)
				) {
					return {
						success: false,
						errors: [
							{
								code: CategoriaErrorCode.INVALID_CLAS_MAPPING,
								message:
									"Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador",
								field: "clasSpecificId",
								details: { nombre, parentId, clasSectionId, clasSpecificId },
							},
						],
					};
				}
			} else {
				const matchedSectionId = validateCLASSection(nombre);

				if (normalizedSectionId && matchedSectionId !== normalizedSectionId) {
					return {
						success: false,
						errors: [
							{
								code: CategoriaErrorCode.INVALID_CLAS_MAPPING,
								message:
									"Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador",
								field: "clasSectionId",
								details: { nombre, parentId, clasSectionId, clasSpecificId },
							},
						],
					};
				}

				if (!matchedSectionId || parentId) {
					return {
						success: false,
						errors: [
							{
								code: CategoriaErrorCode.INVALID_CLAS_MAPPING,
								message:
									"Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador",
								field: "clasSectionId",
								details: { nombre, parentId, clasSectionId, clasSpecificId },
							},
						],
					};
				}
			}
			return { success: true };
		} catch (mapError) {
			const isRootCategory = !normalizedSpecificId && !parentId;
			const message = isRootCategory
				? "Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador"
				: "Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador";

			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_CLAS_MAPPING,
						message,
						field: "nombre",
						details: {
							nombre,
							parentId,
							originalError: (mapError as Error).message,
						},
					},
				],
			};
		}
	} catch (error) {
		return {
			success: false,
			errors: [
				{
					code: CategoriaErrorCode.INVALID_INPUT,
					message: "Error al validar contra clasificador CLAS",
					details: { error },
				},
			],
		};
	}
}

/**
 * Category validation class with comprehensive business rule validation
 */
export class CategoriaValidator {
	/**
	 * Validate category input data
	 */
	static validateCategoriaInput(data: unknown): CategoriaValidationResult {
		try {
			const result = CategoriaSchema.safeParse(data);

			if (result.success) {
				return {
					success: true,
					data: result.data,
				};
			}

			const errors: CategoriaValidationError[] = result.error.errors.map(
				(zodError) => ({
					code: CategoriaErrorCode.INVALID_INPUT,
					message: zodError.message,
					field: zodError.path.join("."),
				}),
			);

			return {
				success: false,
				errors,
			};
		} catch (error) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_INPUT,
						message: "Error al validar los datos de entrada",
						details: { error },
					},
				],
			};
		}
	}

	/**
	 * Validate partial category update input data
	 */
	static validateCategoriaUpdateInput(
		data: unknown,
	): { success: true; data: CategoriaUpdateInput } | CategoriaValidationResult {
		try {
			const result = CategoriaUpdateSchema.safeParse(data);

			if (result.success) {
				return {
					success: true,
					data: result.data,
				};
			}

			const errors: CategoriaValidationError[] = result.error.errors.map(
				(zodError) => ({
					code: CategoriaErrorCode.INVALID_INPUT,
					message: zodError.message,
					field: zodError.path.join("."),
				}),
			);

			return {
				success: false,
				errors,
			};
		} catch (error) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_INPUT,
						message: "Error al validar los datos de actualización",
						details: { error },
					},
				],
			};
		}
	}

	/**
	 * Check if creating/updating a category would create a circular reference
	 */
	static async validateCircularReference(
		categoryId: string | null,
		parentId: string | null,
		tenantId: string,
	): Promise<CategoriaValidationResult> {
		if (!parentId || !categoryId) {
			return { success: true };
		}

		// Category cannot be its own parent
		if (categoryId === parentId) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.CIRCULAR_REFERENCE,
						message:
							CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.CIRCULAR_REFERENCE],
						details: { categoryId, parentId },
					},
				],
			};
		}

		// Check if the new parent is a descendant of the current category
		const isDescendant = await this.checkIfDescendant(
			categoryId,
			parentId,
			tenantId,
		);
		if (isDescendant) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.CIRCULAR_REFERENCE,
						message:
							CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.CIRCULAR_REFERENCE],
						details: { categoryId, parentId },
					},
				],
			};
		}

		return { success: true };
	}

	/**
	 * Check if a category is a descendant of another category
	 */
	private static async checkIfDescendant(
		categoryId: string,
		potentialAncestorId: string,
		tenantId: string,
	): Promise<boolean> {
		try {
			const category = await prisma.categoria.findFirst({
				where: { catId: potentialAncestorId, tenantId },
				include: { parent: true },
			});

			if (!category || !category.parent) {
				return false;
			}

			if (category.parent.catId === categoryId) {
				return true;
			}

			return await this.checkIfDescendant(
				categoryId,
				category.parent.catId,
				tenantId,
			);
		} catch (error) {
			console.error("Error checking descendant relationship:", error);
			return false;
		}
	}

	/**
	 * Validate maximum hierarchy depth
	 */
	static async validateHierarchyDepth(
		parentId: string | null,
		tenantId: string,
	): Promise<CategoriaValidationResult> {
		if (!parentId) {
			return { success: true }; // Root categories are always valid
		}

		try {
			const depth = await this.calculateCategoryDepth(parentId, tenantId);

			if (depth >= MAX_HIERARCHY_DEPTH) {
				return {
					success: false,
					errors: [
						{
							code: CategoriaErrorCode.MAX_DEPTH_EXCEEDED,
							message:
								CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.MAX_DEPTH_EXCEEDED],
							details: { currentDepth: depth, maxDepth: MAX_HIERARCHY_DEPTH },
						},
					],
				};
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_INPUT,
						message: "Error al validar la profundidad de la jerarquía",
						details: { error },
					},
				],
			};
		}
	}

	/**
	 * Calculate the depth of a category in the hierarchy
	 */
	private static async calculateCategoryDepth(
		categoryId: string,
		tenantId: string,
	): Promise<number> {
		try {
			const category = await prisma.categoria.findFirst({
				where: { catId: categoryId, tenantId },
				include: { parent: true },
			});

			if (!category) {
				return 0;
			}

			if (!category.parent) {
				return 1; // Root category
			}

			return (
				1 + (await this.calculateCategoryDepth(category.parent.catId, tenantId))
			);
		} catch (error) {
			console.error("Error calculating category depth:", error);
			return 0;
		}
	}

	/**
	 * Validate unique name within parent scope (case-insensitive)
	 */
	static async validateUniqueName(
		nombre: string,
		parentId: string | null,
		tenantId: string,
		excludeCategoryId?: string,
	): Promise<CategoriaValidationResult> {
		try {
			const existingCategory = await prisma.categoria.findFirst({
				where: {
					nombre: {
						equals: nombre.trim(),
						mode: "insensitive",
					},
					parentId: parentId,
					tenantId,
					...(excludeCategoryId && { catId: { not: excludeCategoryId } }),
				},
			});

			if (existingCategory) {
				return {
					success: false,
					errors: [
						{
							code: CategoriaErrorCode.DUPLICATE_NAME,
							message:
								CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.DUPLICATE_NAME],
							field: "nombre",
							details: {
								nombre,
								parentId,
								existingCategoryId: existingCategory.catId,
							},
						},
					],
				};
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_INPUT,
						message: "Error al validar la unicidad del nombre",
						details: { error },
					},
				],
			};
		}
	}

	/**
	 * Validate that parent category exists
	 */
	static async validateParentExists(
		parentId: string | null,
		tenantId: string,
	): Promise<CategoriaValidationResult> {
		if (!parentId) {
			return { success: true }; // No parent is valid for root categories
		}

		try {
			const parentCategory = await prisma.categoria.findFirst({
				where: { catId: parentId, tenantId },
			});

			if (!parentCategory) {
				return {
					success: false,
					errors: [
						{
							code: CategoriaErrorCode.PARENT_NOT_FOUND,
							message:
								CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.PARENT_NOT_FOUND],
							field: "parentId",
							details: { parentId },
						},
					],
				};
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_INPUT,
						message: "Error al validar la categoría padre",
						details: { error },
					},
				],
			};
		}
	}

	/**
	 * Validate product-subcategory consistency
	 */
	static async validateProductSubcategoryConsistency(
		categoriaId: string,
		subcategoriaId: string | null,
		tenantId: string,
	): Promise<CategoriaValidationResult> {
		if (!subcategoriaId) {
			return { success: true }; // No subcategory is valid
		}

		try {
			const subcategoria = await prisma.categoria.findFirst({
				where: { catId: subcategoriaId, tenantId },
				select: { parentId: true },
			});

			if (!subcategoria) {
				return {
					success: false,
					errors: [
						{
							code: CategoriaErrorCode.CATEGORY_NOT_FOUND,
							message: "Subcategoría no encontrada",
							field: "subcategoriaId",
							details: { subcategoriaId },
						},
					],
				};
			}

			if (subcategoria.parentId !== categoriaId) {
				return {
					success: false,
					errors: [
						{
							code: CategoriaErrorCode.SUBCATEGORY_MISMATCH,
							message:
								CATEGORIA_ERROR_MESSAGES[
									CategoriaErrorCode.SUBCATEGORY_MISMATCH
								],
							field: "subcategoriaId",
							details: {
								categoriaId,
								subcategoriaId,
								actualParentId: subcategoria.parentId,
							},
						},
					],
				};
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.INVALID_INPUT,
						message: "Error al validar la consistencia producto-subcategoría",
						details: { error },
					},
				],
			};
		}
	}

	/**
	 * Comprehensive validation for category creation
	 */
	static async validateCategoryCreation(
		data: unknown,
		tenantId: string,
		options?: {
			skipEan13Validation?: boolean;
		},
	): Promise<CategoriaValidationResult> {
		const allErrors: CategoriaValidationError[] = [];

		// Step 1: Validate input data structure
		const inputValidation = this.validateCategoriaInput(data);
		if (!inputValidation.success) {
			return inputValidation;
		}

		const validatedData = inputValidation.data!;

		// Step 2: Validate against CLAS mapping in EAN-13 mode
		const clasValidation = await validateCategoryAgainstCLAS(
			validatedData.nombre,
			validatedData.parentId ?? null,
			tenantId,
			validatedData.clasSectionId ?? null,
			validatedData.clasSpecificId ?? null,
			options,
		);
		if (!clasValidation.success) {
			allErrors.push(...(clasValidation.errors || []));
		}

		// Step 3: Validate parent exists
		const parentValidation = await this.validateParentExists(
			validatedData.parentId ?? null,
			tenantId,
		);
		if (!parentValidation.success) {
			allErrors.push(...(parentValidation.errors || []));
		}

		// Step 4: Validate hierarchy depth
		const depthValidation = await this.validateHierarchyDepth(
			validatedData.parentId ?? null,
			tenantId,
		);
		if (!depthValidation.success) {
			allErrors.push(...(depthValidation.errors || []));
		}

		// Step 5: Validate unique name
		const nameValidation = await this.validateUniqueName(
			validatedData.nombre,
			validatedData.parentId ?? null,
			tenantId,
		);
		if (!nameValidation.success) {
			allErrors.push(...(nameValidation.errors || []));
		}

		return {
			success: allErrors.length === 0,
			data: validatedData,
			errors: allErrors.length > 0 ? allErrors : undefined,
		};
	}

	/**
	 * Comprehensive validation for category update
	 */
	static async validateCategoryUpdate(
		categoryId: string,
		data: unknown,
		tenantId: string,
		options?: {
			skipEan13Validation?: boolean;
		},
	): Promise<CategoriaValidationResult> {
		const allErrors: CategoriaValidationError[] = [];

		// Step 1: Validate partial input data structure
		const inputValidation = this.validateCategoriaUpdateInput(data);
		if (!inputValidation.success) {
			return inputValidation;
		}

		// Step 2: Load existing category state to validate the effective final shape
		const existingCategory = await prisma.categoria.findFirst({
			where: { catId: categoryId, tenantId },
			select: {
				nombre: true,
				descripcion: true,
				parentId: true,
				clasSectionId: true,
				clasSpecificId: true,
			},
		});

		if (!existingCategory) {
			return {
				success: false,
				errors: [
					{
						code: CategoriaErrorCode.CATEGORY_NOT_FOUND,
						message: CATEGORIA_ERROR_MESSAGES[CategoriaErrorCode.CATEGORY_NOT_FOUND],
						details: { categoryId, tenantId },
					},
				],
			};
		}

		const validatedData: CategoriaInput = {
			nombre: inputValidation.data.nombre ?? existingCategory.nombre,
			descripcion:
				inputValidation.data.descripcion !== undefined
					? inputValidation.data.descripcion
					: existingCategory.descripcion ?? undefined,
			parentId:
				inputValidation.data.parentId !== undefined
					? inputValidation.data.parentId
					: existingCategory.parentId,
			clasSectionId:
				inputValidation.data.clasSectionId !== undefined
					? inputValidation.data.clasSectionId
					: existingCategory.clasSectionId,
			clasSpecificId:
				inputValidation.data.clasSpecificId !== undefined
					? inputValidation.data.clasSpecificId
					: existingCategory.clasSpecificId,
		};

		// Step 3: Validate against CLAS mapping in EAN-13 mode
		const clasValidation = await validateCategoryAgainstCLAS(
			validatedData.nombre,
			validatedData.parentId ?? null,
			tenantId,
			validatedData.clasSectionId ?? null,
			validatedData.clasSpecificId ?? null,
			options,
		);
		if (!clasValidation.success) {
			allErrors.push(...(clasValidation.errors || []));
		}

		// Step 4: Validate parent exists
		const parentValidation = await this.validateParentExists(
			validatedData.parentId ?? null,
			tenantId,
		);
		if (!parentValidation.success) {
			allErrors.push(...(parentValidation.errors || []));
		}

		// Step 5: Validate circular reference
		const circularValidation = await this.validateCircularReference(
			categoryId,
			validatedData.parentId ?? null,
			tenantId,
		);
		if (!circularValidation.success) {
			allErrors.push(...(circularValidation.errors || []));
		}

		// Step 6: Validate hierarchy depth
		const depthValidation = await this.validateHierarchyDepth(
			validatedData.parentId ?? null,
			tenantId,
		);
		if (!depthValidation.success) {
			allErrors.push(...(depthValidation.errors || []));
		}

		// Step 7: Validate unique name (excluding current category)
		const nameValidation = await this.validateUniqueName(
			validatedData.nombre,
			validatedData.parentId ?? null,
			tenantId,
			categoryId,
		);
		if (!nameValidation.success) {
			allErrors.push(...(nameValidation.errors || []));
		}

		return {
			success: allErrors.length === 0,
			data: validatedData,
			errors: allErrors.length > 0 ? allErrors : undefined,
		};
	}
}
