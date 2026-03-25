import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import prisma from "@/lib/prisma";

// Mock de prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    reportHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("Report History API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET", () => {
    it("debe retornar historial de reportes sin filtros", async () => {
      const mockReportes = [
        {
          id: "report-1",
          tipoReporte: "COST_IMPACT",
          formato: "pdf",
          nombreArchivo: "cost-impact-2025-01-01.pdf",
          parametros: { fechaDesde: "2025-01-01", fechaHasta: "2025-01-31" },
          tamanoBytes: 1024,
          fechaGeneracion: new Date(),
        },
        {
          id: "report-2",
          tipoReporte: "KPIS",
          formato: "excel",
          nombreArchivo: "kpis-2025-01-01.xlsx",
          parametros: {},
          tamanoBytes: 2048,
          fechaGeneracion: new Date(),
        },
      ];

      prisma.reportHistory.findMany.mockResolvedValue(mockReportes);
      prisma.reportHistory.count.mockResolvedValue(2);

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history")
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(prisma.reportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { fechaGeneracion: "desc" },
        })
      );
    });

    it("debe aplicar filtros por tipo de reporte", async () => {
      prisma.reportHistory.findMany.mockResolvedValue([]);
      prisma.reportHistory.count.mockResolvedValue(0);

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history?tipoReporte=COST_IMPACT")
      );

      await GET(request);

      expect(prisma.reportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipoReporte: "COST_IMPACT",
          }),
        })
      );
    });

    it("debe aplicar filtros por formato", async () => {
      prisma.reportHistory.findMany.mockResolvedValue([]);
      prisma.reportHistory.count.mockResolvedValue(0);

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history?formato=pdf")
      );

      await GET(request);

      expect(prisma.reportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            formato: "pdf",
          }),
        })
      );
    });

    it("debe aplicar filtros de fecha correctamente", async () => {
      prisma.reportHistory.findMany.mockResolvedValue([]);
      prisma.reportHistory.count.mockResolvedValue(0);

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history?fechaDesde=2025-01-01&fechaHasta=2025-12-31")
      );

      await GET(request);

      expect(prisma.reportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fechaGeneracion: expect.objectContaining({
              gte: new Date("2025-01-01"),
              lte: new Date("2025-12-31"),
            }),
          }),
        })
      );
    });

    it("debe aplicar paginación correctamente", async () => {
      prisma.reportHistory.findMany.mockResolvedValue([]);
      prisma.reportHistory.count.mockResolvedValue(50);

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history?limit=20&offset=0")
      );

      await GET(request);

      expect(prisma.reportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        })
      );
    });

    it("debe manejar errores correctamente", async () => {
      prisma.reportHistory.findMany.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history")
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Error al obtener historial de reportes");
    });
  });

  describe("POST", () => {
    it("debe crear un nuevo registro de reporte correctamente", async () => {
      const mockReporte = {
        id: "report-new",
        tipoReporte: "COST_IMPACT",
        formato: "pdf",
        nombreArchivo: "cost-impact-2025-01-15.pdf",
        parametros: { fechaDesde: "2025-01-01", fechaHasta: "2025-01-31" },
        tamanoBytes: 1536,
        fechaGeneracion: new Date(),
      };

      prisma.reportHistory.create.mockResolvedValue(mockReporte);

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history"),
        {
          method: "POST",
          body: JSON.stringify({
            tipoReporte: "COST_IMPACT",
            formato: "pdf",
            nombreArchivo: "cost-impact-2025-01-15.pdf",
            parametros: { fechaDesde: "2025-01-01", fechaHasta: "2025-01-31" },
            tamanoBytes: 1536,
          }),
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.tipoReporte).toBe("COST_IMPACT");
      expect(body.data.formato).toBe("pdf");
      expect(prisma.reportHistory.create).toHaveBeenCalled();
    });

    it("debe retornar error si faltan campos requeridos", async () => {
      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history"),
        {
          method: "POST",
          body: JSON.stringify({
            tipoReporte: "COST_IMPACT",
            // Faltan formato y nombreArchivo
          }),
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe("tipoReporte, formato y nombreArchivo son requeridos");
    });

    it("debe aceptar parametros opcionales", async () => {
      const mockReporte = {
        id: "report-new",
        tipoReporte: "DEBT_EXPOSURE",
        formato: "excel",
        nombreArchivo: "debt-exposure.xlsx",
        parametros: {},
        tamanoBytes: 0,
        fechaGeneracion: new Date(),
      };

      prisma.reportHistory.create.mockResolvedValue(mockReporte);

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history"),
        {
          method: "POST",
          body: JSON.stringify({
            tipoReporte: "DEBT_EXPOSURE",
            formato: "excel",
            nombreArchivo: "debt-exposure.xlsx",
          }),
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(prisma.reportHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipoReporte: "DEBT_EXPOSURE",
            formato: "excel",
            nombre: "debt-exposure.xlsx",
          }),
        })
      );
    });

    it("debe manejar errores al crear registro de reporte", async () => {
      prisma.reportHistory.create.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest(
        new URL("http://localhost/api/contabilidad/exchange/report-history"),
        {
          method: "POST",
          body: JSON.stringify({
            tipoReporte: "KPIS",
            formato: "csv",
            nombreArchivo: "kpis.csv",
          }),
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Error al registrar reporte");
    });
  });
});
