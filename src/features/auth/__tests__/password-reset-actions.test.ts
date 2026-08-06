/**
 * @description Tests unitarios para las Server Actions de recuperación de contraseña.
 *
 * @module features/auth/__tests__/password-reset-actions.test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
		},
		userSession: {
			updateMany: vi.fn(),
		},
		userActivityLog: {
			create: vi.fn(),
		},
		$transaction: vi.fn((queries) => Promise.all(queries)),
	},
}));

vi.mock("bcryptjs", () => ({
	default: { compare: vi.fn(), hash: vi.fn() },
	compare: vi.fn(),
	hash: vi.fn(),
}));

vi.mock("@/lib/secrets", () => ({
	getJwtSecret: vi.fn(() => "test-secret"),
	getRefreshJwtSecret: vi.fn(() => "test-refresh-secret"),
}));

vi.mock("jsonwebtoken", () => ({
	default: {
		sign: vi.fn(() => "signed.jwt.token"),
		verify: vi.fn((token: string) => {
			if (token === "valid.jwt.token") {
				return { userId: "user-1", email: "test@example.com", purpose: "password-reset" };
			}
			throw new Error("invalid token");
		}),
	},
	sign: vi.fn(() => "signed.jwt.token"),
	verify: vi.fn((token: string) => {
		if (token === "valid.jwt.token") {
			return { userId: "user-1", email: "test@example.com", purpose: "password-reset" };
		}
		throw new Error("invalid token");
	}),
}));

vi.mock("@/lib/email", () => ({
	sendPasswordResetEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/features/sales-agent/public-url", () => ({
	getConfiguredPublicAppUrl: vi.fn(() => "https://app.example.com"),
}));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/email";
import { getConfiguredPublicAppUrl } from "@/features/sales-agent/public-url";
import {
	requestPasswordResetAction,
	resetPasswordAction,
} from "../actions-password-reset";

// ─── Helpers ─────────────────────────────────────────────

function createMockUser(overrides: Record<string, unknown> = {}) {
	return {
		userId: "user-1",
		name: "Test User",
		email: "test@example.com",
		password: "$2a$12$hashedpassword",
		role: "regularUser",
		...overrides,
	};
}

// ─── Tests requestPasswordResetAction ───────────────────

describe("requestPasswordResetAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("envía email de reseteo cuando el usuario existe", async () => {
		const mockUser = createMockUser();
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
		vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

		const result = await requestPasswordResetAction({ email: "test@example.com" });

		expect(result.success).toBe(true);
		expect(sendPasswordResetEmail).toHaveBeenCalledWith(
			"test@example.com",
			expect.stringContaining("/reset-password?token="),
			"Test User",
		);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					resetPasswordToken: expect.any(String),
					resetPasswordExpiresAt: expect.any(Date),
				}),
			}),
		);
	});

	it("retorna éxito genérico cuando el email no existe (anti-enumeración)", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

		const result = await requestPasswordResetAction({ email: "no-existe@example.com" });

		expect(result.success).toBe(true);
		expect(sendPasswordResetEmail).not.toHaveBeenCalled();
		expect(prisma.user.update).not.toHaveBeenCalled();
	});

	it("devuelve VALIDATION_ERROR con email inválido", async () => {
		const result = await requestPasswordResetAction({ email: "no-es-un-email" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
	});

	it("no envía email si el servicio de URL no está disponible", async () => {
		const mockUser = createMockUser();
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
		vi.mocked(getConfiguredPublicAppUrl).mockReturnValue(null);

		const result = await requestPasswordResetAction({ email: "test@example.com" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("SERVICE_UNAVAILABLE");
		expect(sendPasswordResetEmail).not.toHaveBeenCalled();
	});
});

// ─── Tests resetPasswordAction ──────────────────────────

describe("resetPasswordAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const validToken = "valid.jwt.token";

	it("actualiza la contraseña y limpia el token con token válido", async () => {
		const mockUser = createMockUser({
			resetPasswordToken: validToken,
			resetPasswordExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
		});
		vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
		vi.mocked(bcrypt.hash).mockResolvedValue("hashed-new-password" as never);

		const result = await resetPasswordAction({ token: validToken, password: "nueva123" });

		expect(result.success).toBe(true);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					password: "hashed-new-password",
					resetPasswordToken: null,
					resetPasswordExpiresAt: null,
				}),
			}),
		);
		expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "user-1", isActive: true },
				data: { isActive: false },
			}),
		);
	});

	it("devuelve INVALID_TOKEN si el usuario no existe para ese token", async () => {
		vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

		const result = await resetPasswordAction({ token: validToken, password: "nueva123" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("INVALID_TOKEN");
		expect(prisma.user.update).not.toHaveBeenCalled();
	});

	it("devuelve VALIDATION_ERROR con contraseña corta", async () => {
		const result = await resetPasswordAction({ token: validToken, password: "123" });

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("VALIDATION_ERROR");
	});
});
