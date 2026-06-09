/**
 * @description Tests unitarios para Server Actions de categorías.
 * Sigue TDD estricto: RED → GREEN → REFACTOR.
 *
 * Escenarios cubiertos:
 * - getCategoriasAction: listado con tenant isolation
 * - createCategoriaAction: creación con validación
 * - updateCategoriaAction: update con existencia check
 * - deleteCategoriaAction: eliminación con dependencias
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mockeamos dependencias ANTES de importar el módulo
vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
	prisma: {
		categoria: {
			findMany: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		producto: {
			updateMany: vi.fn(),
		},
	},
}));
// Mock de validadores — evita queries reales a BD
vi.mock("@/lib/categoria-validation", () => ({
	CategoriaValidator: {
		validateCategoryCreation: vi.fn(),
		validateCategoryUpdate: vi.fn(),
	},
}));
vi.mock("@/lib/categoria-errors", () => ({
	CategoriaDeletionValidator: {
		validateDeletion: vi.fn(),
	},
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import { CategoriaValidator } from "@/lib/categoria-validation";
import { CategoriaDeletionValidator } from "@/lib/categoria-errors";
import {
	getCategoriasAction,
	getCategoriaByIdAction,
	getCategoriaHierarchyAction,
	createCategoriaAction,
	updateCategoriaAction,
	deleteCategoriaAction,
} from "@/features/categorias/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

// ─── Helpers ───────────────────────────────────────────────

const mockUser: AuthenticatedUser = {
	userId: "user-test-1",
	name: "Test",
	email: "test@test.com",
	role: "admin",
	isActive: true,
	tenantId: "tenant-test",
	tenantRole: "admin",
};

const mockCategoriaRow = {
	catId: "cat-1",
	nombre: "Electrónica",
	descripcion: "Productos electrónicos",
	parentId: null,
	clasSectionId: null,
	clasSpecificId: null,
	createdAt: new Date("2025-01-01"),
	updatedAt: new Date("2025-01-01"),
	parent: null,
	subcategorias: [],
};

// ─── Tests ─────────────────────────────────────────────────

describe("Categorias Server Actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ─── getCategoriasAction ─────────────────────────────────

	describe("getCategoriasAction", () => {
		it("retorna lista de categorías del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findMany).mockResolvedValue([
				mockCategoriaRow,
			]);

			const result = await getCategoriasAction();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data![0].nombre).toBe("Electrónica");
			expect(prisma.categoria.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ tenantId: "tenant-test" }),
				}),
			);
		});

		it("retorna lista vacía si no hay categorías", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findMany).mockResolvedValue([]);

			const result = await getCategoriasAction();

			expect(result.success).toBe(true);
			expect(result.data).toEqual([]);
		});
	});

	// ─── getCategoriaByIdAction ─────────────────────────────

	describe("getCategoriaByIdAction", () => {
		it("retorna categoría por ID", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(mockCategoriaRow);

			const result = await getCategoriaByIdAction("cat-1");

			expect(result.success).toBe(true);
			expect(result.data!.nombre).toBe("Electrónica");
			expect(prisma.categoria.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { catId: "cat-1", tenantId: "tenant-test" },
				}),
			);
		});

		it("retorna NOT_FOUND si la categoría no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(null);

			const result = await getCategoriaByIdAction("cat-noexiste");

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
		});

		it("retorna NOT_FOUND para categoría de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(null); // otro tenant devuelve null

			const result = await getCategoriaByIdAction("cat-otro-tenant");

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("NOT_FOUND");
			expect(prisma.categoria.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { catId: "cat-otro-tenant", tenantId: "tenant-test" },
				}),
			);
		});
	});

	// ─── getCategoriaHierarchyAction ─────────────────────────

	describe("getCategoriaHierarchyAction", () => {
		it("retorna jerarquía de categorías del tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findMany).mockResolvedValue([
				mockCategoriaRow,
			]);

			const result = await getCategoriaHierarchyAction();

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(prisma.categoria.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { tenantId: "tenant-test" },
				}),
			);
		});

		it("cuenta productos directos y descendientes en la jerarquía", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findMany).mockResolvedValue([
				{
					...mockCategoriaRow,
					catId: "root-1",
					nombre: "Raíz",
					productos: [{ id: "prod-1" }],
					subcategorias: [],
				},
				{
					...mockCategoriaRow,
					catId: "child-1",
					parentId: "root-1",
					nombre: "Hija",
					productos: [{ id: "prod-2" }, { id: "prod-3" }],
					subcategorias: [],
				},
			] as any);

			const result = await getCategoriaHierarchyAction();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data![0].productCount).toBe(3);
			expect(result.data![0].subcategorias[0].productCount).toBe(2);
		});
	});

	// ─── createCategoriaAction ───────────────────────────────

	describe("createCategoriaAction", () => {
		const validInput = {
			nombre: "Nueva Categoría",
			descripcion: "Descripción",
			parentId: null as string | null,
			clasSectionId: null as string | null,
			clasSpecificId: null as string | null,
		};

		it("crea categoría exitosamente con datos válidos", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(CategoriaValidator.validateCategoryCreation).mockResolvedValue({
				success: true,
				data: validInput as any,
			});
			vi.mocked(prisma.categoria.create).mockResolvedValue(mockCategoriaRow);

			const result = await createCategoriaAction(validInput);

			expect(result.success).toBe(true);
			expect(prisma.categoria.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						nombre: "Nueva Categoría",
						tenantId: "tenant-test",
					}),
				}),
			);
		});

		it("retorna error si el nombre está vacío", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);

			const result = await createCategoriaAction({ ...validInput, nombre: "" });

			expect(result.success).toBe(false);
			expect(result.error!.code).toBeDefined();
		});
	});

	// ─── updateCategoriaAction ───────────────────────────────

	describe("updateCategoriaAction", () => {
		const validUpdate = {
			catId: "cat-1",
			nombre: "Electrónica Actualizada",
			descripcion: "Nueva desc",
			parentId: null as string | null,
			clasSectionId: null as string | null,
			clasSpecificId: null as string | null,
		};

		it("actualiza categoría exitosamente", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(mockCategoriaRow);
			vi.mocked(CategoriaValidator.validateCategoryUpdate).mockResolvedValue({
				success: true,
				data: {
					nombre: "Electrónica Actualizada",
					descripcion: "Nueva desc",
					parentId: null,
					clasSectionId: null,
					clasSpecificId: null,
				} as any,
			});
			vi.mocked(prisma.categoria.update).mockResolvedValue({
				...mockCategoriaRow,
				nombre: "Electrónica Actualizada",
			});

			const result = await updateCategoriaAction(validUpdate);

			expect(result.success).toBe(true);
			expect(prisma.categoria.update).toHaveBeenCalled();
		});

		it("retorna error si la categoría no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(null);

			const result = await updateCategoriaAction(validUpdate);

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("no encontrada");
		});

		it("retorna NOT_FOUND para categoría de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(null); // otro tenant

			const result = await updateCategoriaAction({
				...validUpdate,
				catId: "cat-otro-tenant",
			});

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("no encontrada");
			expect(prisma.categoria.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { catId: "cat-otro-tenant", tenantId: "tenant-test" },
				}),
			);
		});
	});

	// ─── deleteCategoriaAction ───────────────────────────────

	describe("deleteCategoriaAction", () => {
		it("elimina categoría sin dependencias", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst)
				.mockResolvedValueOnce(mockCategoriaRow) // existencia
				.mockResolvedValueOnce({
					...mockCategoriaRow,
					productosSubcategoria: [],
				}); // productos subcat
			vi.mocked(CategoriaDeletionValidator.validateDeletion).mockResolvedValue({
				canDelete: true,
				errors: [],
				warnings: [],
				affectedItems: {},
			});
			vi.mocked(prisma.categoria.delete).mockResolvedValue(mockCategoriaRow);

			const result = await deleteCategoriaAction("cat-1");

			expect(result.success).toBe(true);
			expect(prisma.categoria.delete).toHaveBeenCalledWith(
				expect.objectContaining({ where: { catId: "cat-1" } }),
			);
		});

		it("retorna error si la categoría no existe", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(null);

			const result = await deleteCategoriaAction("cat-noexiste");

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("no encontrada");
		});

		it("retorna NOT_FOUND para categoría de otro tenant", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(null); // otro tenant

			const result = await deleteCategoriaAction("cat-otro-tenant");

			expect(result.success).toBe(false);
			expect(result.error!.message).toContain("no encontrada");
			expect(prisma.categoria.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { catId: "cat-otro-tenant", tenantId: "tenant-test" },
				}),
			);
		});
	});

	// ─── Tenant isolation cross-tenant ───────────────────────

	describe("tenant isolation", () => {
		it("createCategoriaAction usa validator con tenantId", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(CategoriaValidator.validateCategoryCreation).mockResolvedValue({
				success: true,
				data: {
					nombre: "Test",
					descripcion: null,
					parentId: null,
					clasSectionId: null,
					clasSpecificId: null,
				} as any,
			});
			vi.mocked(prisma.categoria.create).mockResolvedValue(mockCategoriaRow);

			await createCategoriaAction({
				nombre: "Test",
				descripcion: null,
				parentId: null as string | null,
				clasSectionId: null as string | null,
				clasSpecificId: null as string | null,
			});

			expect(CategoriaValidator.validateCategoryCreation).toHaveBeenCalledWith(
				expect.anything(),
				"tenant-test",
			);
		});

		it("updateCategoriaAction usa validator con tenantId", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst).mockResolvedValue(mockCategoriaRow);
			vi.mocked(CategoriaValidator.validateCategoryUpdate).mockResolvedValue({
				success: true,
				data: { nombre: "Actualizado" } as any,
			});
			vi.mocked(prisma.categoria.update).mockResolvedValue(mockCategoriaRow);

			await updateCategoriaAction({ catId: "cat-1" });

			expect(CategoriaValidator.validateCategoryUpdate).toHaveBeenCalledWith(
				"cat-1",
				expect.anything(),
				"tenant-test",
			);
		});

		it("deleteCategoriaAction usa validator con tenantId", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
			vi.mocked(prisma.categoria.findFirst)
				.mockResolvedValueOnce(mockCategoriaRow)
				.mockResolvedValueOnce({
					...mockCategoriaRow,
					productosSubcategoria: [],
				});
			vi.mocked(CategoriaDeletionValidator.validateDeletion).mockResolvedValue({
				canDelete: true,
			});

			await deleteCategoriaAction("cat-1");

			expect(CategoriaDeletionValidator.validateDeletion).toHaveBeenCalledWith(
				"cat-1",
				"tenant-test",
			);
		});
	});

	// ─── Auth requerido ──────────────────────────────────────

	describe("auth requerido", () => {
		it("getCategoriasAction retorna AUTH_REQUIRED si no hay usuario", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);

			const result = await getCategoriasAction();

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("AUTH_REQUIRED");
		});

		it("createCategoriaAction retorna AUTH_REQUIRED si no hay usuario", async () => {
			vi.mocked(getCurrentUser).mockResolvedValue(null);

			const result = await createCategoriaAction({
				nombre: "Test",
				descripcion: null,
				parentId: null,
				clasSectionId: null,
				clasSpecificId: null,
			});

			expect(result.success).toBe(false);
			expect(result.error!.code).toBe("AUTH_REQUIRED");
		});
	});
});
