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
    ventaServicios: { count: vi.fn() },
    compraServicio: { count: vi.fn() },
    ofertaItem: { count: vi.fn() },
  },
}));

import { getCurrentUser } from "@/lib/server-actions/get-current-user";
import { prisma } from "@/lib/prisma";
import {
  getServiciosAction,
  getServicioByIdAction,
  createServicioAction,
  updateServicioAction,
  deleteServicioAction,
} from "@/features/servicios/actions";
import type { AuthenticatedUser } from "@/lib/auth-middleware";

const u: AuthenticatedUser = {
  userId: "u1",
  name: "Test",
  email: "t@t.com",
  role: "admin",
  isActive: true,
  tenantId: "t1",
  tenantRole: "manager",
};

const mockServicioRow = {
  servicioId: "s1",
  nombre: "Test Service",
  descripcion: "Test Description",
  precio: 1000,
  moneda: "CUP",
  tenantId: "t1",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

function serialized(s: typeof mockServicioRow) {
  return {
    servicioId: s.servicioId,
    nombre: s.nombre,
    descripcion: s.descripcion,
    precio: s.precio,
    moneda: s.moneda,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getServiciosAction", () => {
  it("lista servicios del tenant", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([mockServicioRow]);
    const r = await getServiciosAction();
    expect(r.success).toBe(true);
    expect(r.data).toEqual([serialized(mockServicioRow)]);
  });

  it("retorna array vacío si no hay servicios", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findMany).mockResolvedValue([]);
    const r = await getServiciosAction();
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });
});

describe("getServicioByIdAction", () => {
  it("retorna servicio existente", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicioRow);
    const r = await getServicioByIdAction("s1");
    expect(r.success).toBe(true);
    expect(r.data).toEqual(serialized(mockServicioRow));
  });

  it("lanza NOT_FOUND si no existe", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(null);
    const r = await getServicioByIdAction("inexistente");
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("NOT_FOUND");
  });
});

describe("createServicioAction", () => {
  it("crea servicio con campos válidos", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.create).mockResolvedValue(mockServicioRow);
    const r = await createServicioAction({
      nombre: "Test Service",
      descripcion: "Test Description",
      precio: 1000,
    });
    expect(r.success).toBe(true);
    expect(r.data).toEqual(serialized(mockServicioRow));
  });

  it("crea servicio con moneda opcional", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.create).mockResolvedValue({ ...mockServicioRow, moneda: "USD" });
    const r = await createServicioAction({
      nombre: "Test",
      descripcion: "Test",
      precio: 1000,
      moneda: "USD",
    });
    expect(r.success).toBe(true);
    expect(r.data?.moneda).toBe("USD");
  });
});

describe("updateServicioAction", () => {
  it("actualiza campos válidos", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicioRow);
    vi.mocked(prisma.servicios.update).mockResolvedValue({
      ...mockServicioRow,
      nombre: "Updated",
    });
    const r = await updateServicioAction({
      servicioId: "s1",
      nombre: "Updated",
    });
    expect(r.success).toBe(true);
    expect(r.data?.nombre).toBe("Updated");
  });

  it("lanza NOT_FOUND si no existe", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(null);
    const r = await updateServicioAction({
      servicioId: "inexistente",
      nombre: "Nope",
    });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("NOT_FOUND");
  });
});

describe("deleteServicioAction (guarded)", () => {
  it("bloquea si existen VentaServicios", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicioRow);
    vi.mocked(prisma.ventaServicios.count).mockResolvedValue(2);
    vi.mocked(prisma.compraServicio.count).mockResolvedValue(0);
    vi.mocked(prisma.ofertaItem.count).mockResolvedValue(0);
    const r = await deleteServicioAction("s1");
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("HAS_REFERENCES");
    expect(r.error?.message).toContain("venta");
    expect(prisma.servicios.delete).not.toHaveBeenCalled();
  });

  it("bloquea si existen CompraServicio", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicioRow);
    vi.mocked(prisma.ventaServicios.count).mockResolvedValue(0);
    vi.mocked(prisma.compraServicio.count).mockResolvedValue(1);
    vi.mocked(prisma.ofertaItem.count).mockResolvedValue(0);
    const r = await deleteServicioAction("s1");
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("HAS_REFERENCES");
    expect(r.error?.message).toContain("compra");
    expect(prisma.servicios.delete).not.toHaveBeenCalled();
  });

  it("bloquea si existen OfertaItem", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicioRow);
    vi.mocked(prisma.ventaServicios.count).mockResolvedValue(0);
    vi.mocked(prisma.compraServicio.count).mockResolvedValue(0);
    vi.mocked(prisma.ofertaItem.count).mockResolvedValue(3);
    const r = await deleteServicioAction("s1");
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("HAS_REFERENCES");
    expect(r.error?.message).toContain("oferta");
    expect(prisma.servicios.delete).not.toHaveBeenCalled();
  });

  it("bloquea si hay referencias múltiples", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicioRow);
    vi.mocked(prisma.ventaServicios.count).mockResolvedValue(2);
    vi.mocked(prisma.compraServicio.count).mockResolvedValue(1);
    vi.mocked(prisma.ofertaItem.count).mockResolvedValue(0);
    const r = await deleteServicioAction("s1");
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("HAS_REFERENCES");
    expect(r.error?.message).toContain("venta");
    expect(r.error?.message).toContain("compra");
  });

  it("elimina si no hay referencias", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(mockServicioRow);
    vi.mocked(prisma.ventaServicios.count).mockResolvedValue(0);
    vi.mocked(prisma.compraServicio.count).mockResolvedValue(0);
    vi.mocked(prisma.ofertaItem.count).mockResolvedValue(0);
    vi.mocked(prisma.servicios.delete).mockResolvedValue({} as any);
    const r = await deleteServicioAction("s1");
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ id: "s1", eliminado: true });
    expect(prisma.servicios.delete).toHaveBeenCalledWith({ where: { servicioId: "s1" } });
  });

  it("lanza NOT_FOUND si el servicio no existe", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(u);
    vi.mocked(prisma.servicios.findFirst).mockResolvedValue(null);
    const r = await deleteServicioAction("inexistente");
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("NOT_FOUND");
  });
});
