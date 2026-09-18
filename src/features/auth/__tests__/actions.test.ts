/**
 * @description Tests TDD para auth actions.
 *
 * strict TDD: RED → GREEN → REFACTOR
 *
 * @module features/auth/__tests__/actions.test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────

const mockCookieSet = vi.fn();
const mockCookieDelete = vi.fn();
const mockCookieGet = vi.fn();

vi.mock("next/headers", () => ({
	cookies: vi.fn(() => ({
		set: mockCookieSet,
		delete: mockCookieDelete,
		get: mockCookieGet,
	})),
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
			findMany: vi.fn(),
		},
		userSession: {
			create: vi.fn(),
			updateMany: vi.fn(),
			findUnique: vi.fn(),
			findFirst: vi.fn(),
			deleteMany: vi.fn(),
		},
		userActivityLog: {
			create: vi.fn(),
		},
		notification: {
			create: vi.fn(),
		},
		tenantMembership: {
			findUnique: vi.fn(),
			findFirst: vi.fn(),
		},
		tenantLicense: {
			findFirst: vi.fn(),
		},
	},
}));

// resolveTenantContext (auth-middleware) usa prismaPlatform tras AS-02; alias al
// mismo mock para que la resolución de tenant quede determinista en units.
vi.mock("@/lib/db/platform-prisma", async () => {
	const { prisma } = await import("@/lib/prisma");
	return { prismaPlatform: prisma, default: prisma };
});

vi.mock("bcryptjs", () => ({
	default: { compare: vi.fn(), hash: vi.fn() },
	compare: vi.fn(),
	hash: vi.fn(),
}));

vi.mock("@/lib/secrets", () => ({
	getJwtSecret: vi.fn(() => "test-secret"),
	getRefreshJwtSecret: vi.fn(() => "test-refresh-secret"),
}));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { loginAction } from "../actions";

// ─── Helpers ─────────────────────────────────────────────

function createMockUser(overrides: Record<string, unknown> = {}) {
	return {
		userId: "user-1",
		name: "Test User",
		email: "test@example.com",
		password: "$2a$12$hashedpassword",
		role: "regularUser",
		isActive: true,
		expiresAt: null,
		lockedUntil: null,
		loginAttempts: 0,
		onboardingStatus: null,
		...overrides,
	};
}

// ─── Tests loginAction ───────────────────────────────────

describe("loginAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("RED: login con credenciales válidas setea cookie auth_token", async () => {
		const mockUser = createMockUser();
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
		vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
		vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);
		vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
			tenantId: "tenant-1",
			tenantRole: "dependiente",
			isActive: true,
		} as any);
		vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
			maxUsuarios: 10, maxAlmacenes: 5, maxProductos: 100,
			expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
		} as any);
		vi.mocked(prisma.userSession.create).mockResolvedValue({ id: "session-1" } as any);
		vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as any);

		const result = await loginAction({ email: "test@example.com", password: "password123" });

		expect(result.success).toBe(true);
		expect(mockCookieSet).toHaveBeenCalledWith(
			"auth_token",
			expect.any(String),
			expect.objectContaining({ httpOnly: true, path: "/" }),
		);
		expect(mockCookieSet).toHaveBeenCalledWith(
			"refreshToken",
			expect.any(String),
			expect.objectContaining({ httpOnly: true }),
		);
	});

	it("RED: login con password incorrecto devuelve INVALID_CREDENTIALS", async () => {
		const mockUser = createMockUser({ loginAttempts: 0 });
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
		vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
		vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

		const result = await loginAction({ email: "test@example.com", password: "wrong" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("INVALID_CREDENTIALS");
		expect(mockCookieSet).not.toHaveBeenCalled();
	});

	it("RED: login con usuario inactivo devuelve USER_INACTIVE", async () => {
		const mockUser = createMockUser({ isActive: false });
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

		const result = await loginAction({ email: "test@example.com", password: "password123" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("USER_INACTIVE");
		expect(mockCookieSet).not.toHaveBeenCalled();
	});

	it("RED: login con usuario bloqueado devuelve ACCOUNT_LOCKED", async () => {
		const futureDate = new Date(Date.now() + 60 * 60 * 1000);
		const mockUser = createMockUser({ lockedUntil: futureDate });
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

		const result = await loginAction({ email: "locked@example.com", password: "password123" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("ACCOUNT_LOCKED");
		expect(mockCookieSet).not.toHaveBeenCalled();
	});

	it("RED: login incrementa loginAttempts en fallo", async () => {
		const mockUser = createMockUser({ loginAttempts: 0 });
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
		vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
		vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

		await loginAction({ email: "test@example.com", password: "wrong" });

		expect(prisma.user.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "user-1" },
				data: expect.objectContaining({ loginAttempts: 1 }),
			}),
		);
	});

	it("RED: login con email inválido devuelve VALIDATION_ERROR", async () => {
		const result = await loginAction({ email: "no-es-un-email", password: "password123" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
	});

	it("RED: loginAction no devuelve token JWT en el body", async () => {
		const mockUser = createMockUser();
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
		vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
		vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);
		vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValue({
			tenantId: "tenant-1",
			tenantRole: "dependiente",
			isActive: true,
		} as any);
		vi.mocked(prisma.tenantLicense.findFirst).mockResolvedValue({
			maxUsuarios: 10, maxAlmacenes: 5, maxProductos: 100,
			expiracion: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
		} as any);
		vi.mocked(prisma.userSession.create).mockResolvedValue({ id: "session-1" } as any);
		vi.mocked(prisma.userActivityLog.create).mockResolvedValue({} as any);

		const result = await loginAction({ email: "test@example.com", password: "password123" });

		expect(result.success).toBe(true);
		if (result.success) {
			expect((result.data as any).token).toBeUndefined();
			expect(result.data.user).toBeDefined();
		}
	});
});
