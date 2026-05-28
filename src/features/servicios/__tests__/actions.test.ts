import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("@/lib/server-actions/get-current-user");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
	prisma: {
		servicios: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	},
}));
import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import {
	getServiciosAction,
	createServicioAction,
	deleteServicioAction,
} from "@/features/servicios/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";
const u: AuthenticatedUser = {
	userId: "u1",
	name: "T",
	email: "t@t.com",
	role: "admin",
	isActive: true,
	tenantId: "t1",
	tenantRole: "admin",
};
describe("Servicios Actions", () => {
	beforeEach(() => vi.clearAllMocks());
	it("lista", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		vi.mocked(prisma.servicios.findMany).mockResolvedValue([]);
		const r = await getServiciosAction();
		expect(r.success).toBe(true);
	});
	it("crea", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		vi.mocked(prisma.servicios.create).mockResolvedValue({
			servicioId: "s1",
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
		} as any);
		const r = await createServicioAction({
			nombre: "S1",
			descripcion: "D1",
			precio: 1000,
		});
		expect(r.success).toBe(true);
	});
	it("elimina", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(u);
		vi.mocked(prisma.servicios.findFirst).mockResolvedValue({
			servicioId: "s1",
		});
		vi.mocked(prisma.servicios.delete).mockResolvedValue({} as any);
		const r = await deleteServicioAction("s1");
		expect(r.success).toBe(true);
	});
});
