import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticatedUser } from '@/lib/auth-middleware';
type RawHandler = (request: NextRequest, context: any, user?: AuthenticatedUser) => Promise<Response>;

const prismaMock = vi.hoisted(() => ({
	anticipo: {
		findUnique: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/auth-middleware", () => ({
	withAuthGet: (handler: any) => handler,
	withAuthPost: (handler: any) => handler,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: prismaMock,
	default: prismaMock,
}));

describe("API /anticipos/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv("PERIODO_GUARD_ENABLED", "false");
	});

	it("GET devuelve un anticipo por id", async () => {
		prismaMock.anticipo.findUnique.mockResolvedValue({
			anticipoId: "ant-1",
			tipo: "PAGO",
			movimientos: [],
		});

		const { GET } = await import("../route") as unknown as { GET: RawHandler };
		const request = new NextRequest("http://localhost/api/anticipos/ant-1");

		const response = await GET(request, {
			params: Promise.resolve({ id: "ant-1" }),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.anticipo.anticipoId).toBe("ant-1");
	});

	it("PUT rechaza cambios financieros fuera del flujo documental", async () => {
		prismaMock.anticipo.findUnique.mockResolvedValue({ anticipoId: "ant-1" });
		prismaMock.anticipo.update.mockResolvedValue({
			anticipoId: "ant-1",
			estado: "ANULADO",
		});

		const { PUT } = await import("../route") as unknown as { PUT: RawHandler };
		const request = new NextRequest("http://localhost/api/anticipos/ant-1", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ estado: "ANULADO" }),
		});

		const response = await PUT(
			request,
			{ params: Promise.resolve({ id: "ant-1" }) },
			{
				userId: "user-1",
				name: "Test",
				email: "test@test.com",
				role: "admin",
				isActive: true,
				tenantId: "tenant-1",
				tenantRole: "manager",
				permissions: new Set(["financiero.contabilidad.acceder"]),
				planFeatures: { anticipos: true },
			},
		);
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.code).toBe("DOCUMENT_WORKFLOW_REQUIRED");
		expect(prismaMock.anticipo.update).not.toHaveBeenCalled();
	});

	it("DELETE rechaza eliminar un anticipo con efectos financieros", async () => {
		prismaMock.anticipo.findUnique.mockResolvedValue({ anticipoId: "ant-1" });
		prismaMock.anticipo.delete.mockResolvedValue({ anticipoId: "ant-1" });

		const { DELETE } = await import("../route") as unknown as { DELETE: RawHandler };
		const request = new NextRequest("http://localhost/api/anticipos/ant-1", {
			method: "DELETE",
		});

		const response = await DELETE(
			request,
			{ params: Promise.resolve({ id: "ant-1" }) },
			{
				userId: "user-1",
				name: "Test",
				email: "test@test.com",
				role: "admin",
				isActive: true,
				tenantId: "tenant-1",
				tenantRole: "manager",
				permissions: new Set(["financiero.contabilidad.acceder"]),
				planFeatures: { anticipos: true },
			},
		);
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.code).toBe("DOCUMENT_WORKFLOW_REQUIRED");
		expect(prismaMock.anticipo.delete).not.toHaveBeenCalled();
	});
});
