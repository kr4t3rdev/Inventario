/**
 * @description Tests para getCurrentUser — unificación de tenant context.
 *
 * Comportamiento esperado:
 * 1. JWT con tenantId/tenantRole → usar ese contexto
 * 2. JWT con tenantId pero membresía inactiva en DB → user sin tenant
 * 3. JWT sin tenantId → fallback a resolveTenantContext (primera activa)
 * 4. JWT inválido o ausente → null
 * 5. Sesión inactiva en DB → null
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const cookieGet = vi.fn();
  const headerGet = vi.fn();
  return {
    cookieGet,
    headerGet,
    prisma: {
      userSession: { findUnique: vi.fn(), update: vi.fn() },
      user: { findUnique: vi.fn() },
      tenantMembership: { findUnique: vi.fn(), findFirst: vi.fn() },
      tenantLicense: { findFirst: vi.fn() },
    },
    jwt: { verify: vi.fn(), sign: vi.fn() },
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ get: mocks.cookieGet })),
  headers: vi.fn(() => ({ get: mocks.headerGet })),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

// resolveTenantContext (auth-middleware) usa prismaPlatform tras AS-02; alias al
// mismo mock para que la resolución de contexto quede determinista en units.
vi.mock("@/lib/db/platform-prisma", () => ({ prismaPlatform: mocks.prisma }));

vi.mock("jsonwebtoken", () => ({ default: mocks.jwt }));

vi.mock("@/lib/secrets", () => ({
  getJwtSecret: vi.fn(() => "test-secret"),
  getRefreshJwtSecret: vi.fn(() => "test-refresh-secret"),
}));

import { getCurrentUser } from "../get-current-user";

function setValidJwtCookie(payload: Record<string, unknown>) {
  mocks.cookieGet.mockReturnValue({
    name: "auth_token",
    value: "valid.jwt.token",
  });
  mocks.jwt.verify.mockReturnValue(payload);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.userSession.update.mockResolvedValue({});
  mocks.prisma.tenantMembership.findUnique.mockResolvedValue(null);
  mocks.prisma.tenantMembership.findFirst.mockResolvedValue(null);
  mocks.prisma.tenantLicense.findFirst.mockResolvedValue(null);
});

describe("getCurrentUser", () => {
  it("devuelve null si no hay cookie auth_token", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("devuelve null si el JWT no es válido (verify lanza)", async () => {
    mocks.cookieGet.mockReturnValue({
      name: "auth_token",
      value: "bad.token",
    });
    mocks.jwt.verify.mockImplementation(() => {
      const err = new Error("invalid");
      err.name = "JsonWebTokenError";
      throw err;
    });
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("usa tenantId/tenantRole del JWT cuando están presentes y la membresía es activa", async () => {
    setValidJwtCookie({
      userId: "u1",
      email: "u@test.com",
      tenantId: "tenant-X",
      tenantRole: "manager",
    });
    mocks.prisma.userSession.findUnique.mockResolvedValue({
      isActive: true,
      expiresAt: null,
      userId: "u1",
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      userId: "u1",
      name: "User",
      email: "u@test.com",
      role: "user",
      isActive: true,
    });
    mocks.prisma.tenantMembership.findUnique.mockResolvedValue({
      membershipId: "m1",
      tenantId: "tenant-X",
      userId: "u1",
      tenantRole: "manager",
      isActive: true,
    });
    mocks.prisma.tenantLicense.findFirst.mockResolvedValue({
      plan: { nombre: 'Básico' },
      features: { empleados: true, nomina: true },
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 500,
      maxClientes: 150,
    });

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user!.tenantId).toBe("tenant-X");
    expect(user!.tenantRole).toBe("manager");
    expect(user!.planName).toBe('Básico');
    expect(user!.planLimits).toEqual({
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 500,
      maxClientes: 150,
    });
    // Los permisos efectivos resueltos en contexto deben propagarse al user
    // (prerrequisito del guard requirePermission en server actions, PG-05).
    expect(user!.permissions).toBeInstanceOf(Set);
    expect(user!.permissions!.has('ventas.venta.registrar')).toBe(true);
    expect(mocks.prisma.tenantMembership.findUnique).toHaveBeenCalled();
    expect(mocks.prisma.tenantMembership.findFirst).not.toHaveBeenCalled();
  });

  it("mergea plan.features con featureOverrides cuando existen", async () => {
    setValidJwtCookie({
      userId: "u1",
      email: "u@test.com",
      tenantId: "tenant-X",
      tenantRole: "manager",
    });
    mocks.prisma.userSession.findUnique.mockResolvedValue({
      isActive: true,
      expiresAt: null,
      userId: "u1",
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      userId: "u1",
      name: "User",
      email: "u@test.com",
      role: "user",
      isActive: true,
    });
    mocks.prisma.tenantMembership.findUnique.mockResolvedValue({
      membershipId: "m1",
      tenantId: "tenant-X",
      userId: "u1",
      tenantRole: "manager",
      isActive: true,
    });
    mocks.prisma.tenantLicense.findFirst.mockResolvedValue({
      plan: {
        nombre: "Básico",
        features: { contabilidad: true, "reportes-financieros": true },
      },
      features: { contabilidad: false },
      featureOverrides: { "reportes-financieros": false },
      maxUsuarios: 3,
      maxAlmacenes: 2,
      maxProductos: 500,
      maxClientes: 150,
    });

    const user = await getCurrentUser();

    expect(user).not.toBeNull();
    expect(user!.planFeatures).toEqual({
      contabilidad: true,
      "reportes-financieros": false,
    });
  });

  it("ignora tenantId del JWT si la membresía está inactiva en DB", async () => {
    setValidJwtCookie({
      userId: "u1",
      email: "u@test.com",
      tenantId: "tenant-X",
      tenantRole: "manager",
    });
    mocks.prisma.userSession.findUnique.mockResolvedValue({
      isActive: true,
      expiresAt: null,
      userId: "u1",
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      userId: "u1",
      name: "User",
      email: "u@test.com",
      role: "user",
      isActive: true,
    });
    mocks.prisma.tenantMembership.findUnique.mockResolvedValue(null);

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user!.tenantId).toBeUndefined();
    expect(user!.tenantRole).toBeUndefined();
  });

  it("admin sin tenantId en JWT devuelve user sin tenant (caso platform admin)", async () => {
    setValidJwtCookie({ userId: "admin1", email: "a@test.com" });
    mocks.prisma.userSession.findUnique.mockResolvedValue({
      isActive: true,
      expiresAt: null,
      userId: "admin1",
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      userId: "admin1",
      name: "Admin",
      email: "a@test.com",
      role: "admin",
      isActive: true,
    });

    const user = await getCurrentUser();
    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
    expect(user!.tenantId).toBeUndefined();
  });

  it("devuelve null si el rol persistido no se puede normalizar", async () => {
    setValidJwtCookie({ userId: "u1", email: "u@test.com" });
    mocks.prisma.userSession.findUnique.mockResolvedValue({
      isActive: true,
      expiresAt: null,
      userId: "u1",
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      userId: "u1",
      name: "User",
      email: "u@test.com",
      role: "guest",
      isActive: true,
    });

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("devuelve null si la sesión en DB no está activa", async () => {
    setValidJwtCookie({ userId: "u1", email: "u@test.com" });
    mocks.prisma.userSession.findUnique.mockResolvedValue({
      isActive: false,
      expiresAt: null,
      userId: "u1",
    });
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
