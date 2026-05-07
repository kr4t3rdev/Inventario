import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock de prisma con todos los métodos necesarios
const mockAlertHistory = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
};

const mockReportHistory = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  default: {
    alertHistory: mockAlertHistory,
    reportHistory: mockReportHistory,
  },
}));

// Importar después del mock
type AlertHistory = {
  id: string;
  tipoAlerta: string;
  severidad: string;
  titulo: string;
  mensaje: string;
  moneda: string;
  metric: string;
  umbral: number;
  fechaAlerta: Date | string;
  estado: string;
};

type ReportHistory = {
  id: string;
  tipoReporte: string;
  nombre: string;
  formato: string;
  parametros: Record<string, unknown> | string;
  fechaGeneracion: Date | string;
  generadoPor: string;
  numeroAlertas: number;
  rutaArchivo: string | null;
};

describe("Historial de Alertas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/contabilidad/exchange/alert-history", () => {
    it("debe obtener historial de alertas sin filtros", async () => {
      const { GET } = await import("../alert-history/route");
      
      const mockAlerts = [
        {
          id: "alert-1",
          tipoAlerta: "COST_INCREASE",
          severidad: "ALTA",
          titulo: "Incremento de costos",
          mensaje: "Incremento de costos > 10%",
          moneda: "USD",
          metric: "12.5",
          umbral: 10,
          fechaAlerta: new Date("2025-01-01"),
          estado: "ACTIVA",
        },
        {
          id: "alert-2",
          tipoAlerta: "DEBT_LOSS",
          severidad: "MEDIA",
          titulo: "Pérdida en deuda",
          mensaje: "Pérdida no realizada > 5%",
          moneda: "EUR",
          metric: "7.2",
          umbral: 5,
          fechaAlerta: new Date("2025-01-02"),
          estado: "LEIDA",
        },
      ];

      const mockCount = 2;

      const mockEstadisticas = [
        { severidad: "ALTA", _count: 1 },
        { severidad: "MEDIA", _count: 1 },
      ];

      mockAlertHistory.findMany.mockResolvedValue(mockAlerts);
      mockAlertHistory.count.mockResolvedValue(mockCount);
      mockAlertHistory.groupBy.mockResolvedValue(mockEstadisticas);

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual(
        expect.objectContaining({
          id: "alert-1",
          tipoAlerta: "COST_INCREASE",
          severidad: "ALTA"
        })
      );
      expect(body.total).toBe(mockCount);
      expect(mockAlertHistory.findMany).toHaveBeenCalled();
      expect(mockAlertHistory.count).toHaveBeenCalled();
    });

    it("debe filtrar alertas por severidad", async () => {
      const { GET } = await import("../alert-history/route");
      
      const mockAlerts: AlertHistory[] = [
        {
          id: "alert-1",
          tipoAlerta: "COST_INCREASE",
          severidad: "ALTA",
          titulo: "Alerta crítica",
          mensaje: "Incremento de costos > 10%",
          moneda: "USD",
          metric: "12.5",
          umbral: 10,
          fechaAlerta: new Date(),
          estado: "ACTIVA",
        },
      ];

      mockAlertHistory.findMany.mockResolvedValue(mockAlerts);
      mockAlertHistory.count.mockResolvedValue(1);
      mockAlertHistory.groupBy.mockResolvedValue([{ severidad: "ALTA", _count: 1 }]);

      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/alert-history?severidad=ALTA"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.estadisticas).toEqual([{ severidad: "ALTA", _count: 1 }]);
      expect(mockAlertHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severidad: "ALTA",
          }),
        })
      );
    });

    it("debe filtrar alertas por tipo", async () => {
      const { GET } = await import("../alert-history/route");
      
      const mockAlerts: AlertHistory[] = [
        {
          id: "alert-1",
          tipoAlerta: "SPREAD_HIGH",
          severidad: "BAJA",
          titulo: "Spread bancario alto",
          mensaje: "Spread bancario > 3%",
          moneda: "USD",
          metric: "4.5",
          umbral: 3,
          fechaAlerta: new Date(),
          estado: "ACTIVA",
        },
      ];

      mockAlertHistory.findMany.mockResolvedValue(mockAlerts);
      mockAlertHistory.count.mockResolvedValue(1);
      mockAlertHistory.groupBy.mockResolvedValue([{ severidad: "BAJA", _count: 1 }]);

      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/alert-history?tipoAlerta=SPREAD_HIGH"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.estadisticas).toEqual([{ severidad: "BAJA", _count: 1 }]);
      expect(mockAlertHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipoAlerta: "SPREAD_HIGH",
          }),
        })
      );
    });

    it("debe paginar resultados correctamente", async () => {
      const { GET } = await import("../alert-history/route");
      
      const mockAlerts: AlertHistory[] = [
        {
          id: "alert-1",
          tipoAlerta: "COST_INCREASE",
          severidad: "ALTA",
          titulo: "Alerta 1",
          mensaje: "Test",
          moneda: "USD",
          metric: "10",
          umbral: 10,
          fechaAlerta: new Date(),
          estado: "ACTIVA",
        },
      ];

      mockAlertHistory.findMany.mockResolvedValue(mockAlerts);
      mockAlertHistory.count.mockResolvedValue(10);
      mockAlertHistory.groupBy.mockResolvedValue([{ severidad: "ALTA", _count: 10 }]);

      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/alert-history?limit=1&offset=0"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
      expect(body.estadisticas).toEqual([{ severidad: "ALTA", _count: 10 }]);
      expect(mockAlertHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
          skip: 0,
        })
      );
    });

    it("debe retornar lista vacía cuando no hay alertas", async () => {
      const { GET } = await import("../alert-history/route");
      
      mockAlertHistory.findMany.mockResolvedValue([]);
      mockAlertHistory.count.mockResolvedValue(0);
      mockAlertHistory.groupBy.mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.estadisticas).toEqual([]);
    });

    it("debe manejar errores de base de datos", async () => {
      const { GET } = await import("../alert-history/route");
      
      mockAlertHistory.findMany.mockRejectedValue(new Error("Database error"));
      mockAlertHistory.count.mockRejectedValue(new Error("Database error"));
      mockAlertHistory.groupBy.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Error al obtener historial de alertas");
    });

    it("debe validar fechaDesde inválida", async () => {
      const { GET } = await import("../alert-history/route");
      
      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/alert-history?fechaDesde=invalid-date"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("fechaDesde inválida");
    });

    it("debe validar fechaHasta inválida", async () => {
      const { GET } = await import("../alert-history/route");
      
      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/alert-history?fechaHasta=invalid-date"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("fechaHasta inválida");
    });
  });

  describe("POST /api/contabilidad/exchange/alert-history", () => {
    it("debe registrar una nueva alerta", async () => {
      const { POST } = await import("../alert-history/route");
      
      const mockCreatedAlert: AlertHistory = {
        id: "new-alert-1",
        tipoAlerta: "MARGIN_DIFF",
        severidad: "MEDIA",
        titulo: "Diferencia de márgenes",
        mensaje: "Diferencia de márgenes > 15%",
        moneda: "USD",
        metric: "18.5",
        umbral: 15,
        fechaAlerta: new Date(),
        estado: "ACTIVA",
      };

      mockAlertHistory.create.mockResolvedValue(mockCreatedAlert);

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history", {
        method: "POST",
        body: JSON.stringify({
          tipoAlerta: "MARGIN_DIFF",
          severidad: "MEDIA",
          titulo: "Diferencia de márgenes",
          mensaje: "Diferencia de márgenes > 15%",
          moneda: "USD",
          metric: "18.5",
          umbral: 15,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(
        expect.objectContaining({
          id: "new-alert-1",
          tipoAlerta: "MARGIN_DIFF",
          severidad: "MEDIA"
        })
      );
    });

    it("debe rechazar alertas sin tipoAlerta requerido", async () => {
      const { POST } = await import("../alert-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history", {
        method: "POST",
        body: JSON.stringify({
          severidad: "ALTA",
          titulo: "Alerta sin tipo",
          mensaje: "Falta tipoAlerta",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("tipoAlerta");
    });

    it("debe rechazar alertas sin severidad requerida", async () => {
      const { POST } = await import("../alert-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history", {
        method: "POST",
        body: JSON.stringify({
          tipoAlerta: "COST_INCREASE",
          titulo: "Alerta sin severidad",
          mensaje: "Falta severidad",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("severidad");
    });

    it("debe rechazar alertas sin titulo requerido", async () => {
      const { POST } = await import("../alert-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history", {
        method: "POST",
        body: JSON.stringify({
          tipoAlerta: "COST_INCREASE",
          severidad: "ALTA",
          mensaje: "Falta titulo",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("titulo");
    });

    it("debe rechazar alertas sin mensaje requerido", async () => {
      const { POST } = await import("../alert-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history", {
        method: "POST",
        body: JSON.stringify({
          tipoAlerta: "COST_INCREASE",
          severidad: "ALTA",
          titulo: "Alerta",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("mensaje");
    });

    it("debe manejar errores al crear alerta", async () => {
      const { POST } = await import("../alert-history/route");
      
      mockAlertHistory.create.mockRejectedValue(new Error("Create error"));

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/alert-history", {
        method: "POST",
        body: JSON.stringify({
          tipoAlerta: "COST_INCREASE",
          severidad: "ALTA",
          titulo: "Test alert",
          mensaje: "Test alert message",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Error al registrar alerta");
    });
  });
});

describe("Historial de Reportes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/contabilidad/exchange/report-history", () => {
    it("debe obtener historial de reportes sin filtros", async () => {
      const { GET } = await import("../report-history/route");
      
      const mockReports = [
        {
          id: "report-1",
          tipoReporte: "EXCHANGE_SUMMARY",
          nombre: "Reporte de Cambio Semanal",
          formato: "PDF",
          parametros: JSON.stringify({ fechaInicio: "2025-01-01", fechaFin: "2025-01-07" }),
          fechaGeneracion: new Date("2025-02-01"),
          generadoPor: "sistema",
          numeroAlertas: 5,
          rutaArchivo: "/reports/exchange-summary-2025-02-01.pdf",
        },
        {
          id: "report-2",
          tipoReporte: "COST_IMPACT",
          nombre: "Impacto en Costos Mensual",
          formato: "Excel",
          parametros: JSON.stringify({ fechaInicio: "2025-01-01", fechaFin: "2025-01-31" }),
          fechaGeneracion: new Date("2025-02-02"),
          generadoPor: "admin",
          numeroAlertas: 3,
          rutaArchivo: "/reports/cost-impact-2025-02-02.xlsx",
        },
      ];

      const mockCount = 2;

      mockReportHistory.findMany.mockResolvedValue(mockReports);
      mockReportHistory.count.mockResolvedValue(mockCount);

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual(
        expect.objectContaining({
          id: "report-1",
          tipoReporte: "EXCHANGE_SUMMARY",
          formato: "PDF"
        })
      );
      expect(body.total).toBe(mockCount);
      expect(mockReportHistory.findMany).toHaveBeenCalled();
      expect(mockReportHistory.count).toHaveBeenCalled();
    });

    it("debe filtrar reportes por tipo", async () => {
      const { GET } = await import("../report-history/route");
      
      const mockReports: ReportHistory[] = [
        {
          id: "report-1",
          tipoReporte: "COST_IMPACT",
          nombre: "Impacto en Costos",
          formato: "PDF",
          parametros: "{}",
          fechaGeneracion: new Date(),
          generadoPor: "sistema",
          numeroAlertas: 2,
          rutaArchivo: "/reports/test.pdf",
        },
      ];

      mockReportHistory.findMany.mockResolvedValue(mockReports);
      mockReportHistory.count.mockResolvedValue(1);

      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/report-history?tipoReporte=COST_IMPACT"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(mockReportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipoReporte: "COST_IMPACT",
          }),
        })
      );
    });

    it("debe filtrar reportes por formato", async () => {
      const { GET } = await import("../report-history/route");
      
      const mockReports: ReportHistory[] = [
        {
          id: "report-1",
          tipoReporte: "EXCHANGE_SUMMARY",
          nombre: "Reporte de Cambio",
          formato: "Excel",
          parametros: "{}",
          fechaGeneracion: new Date(),
          generadoPor: "sistema",
          numeroAlertas: 0,
          rutaArchivo: "/reports/test.xlsx",
        },
      ];

      mockReportHistory.findMany.mockResolvedValue(mockReports);
      mockReportHistory.count.mockResolvedValue(1);

      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/report-history?formato=Excel"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(mockReportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            formato: "Excel",
          }),
        })
      );
    });

    it("debe paginar resultados correctamente", async () => {
      const { GET } = await import("../report-history/route");
      
      const mockReports: ReportHistory[] = [
        {
          id: "report-1",
          tipoReporte: "EXCHANGE_SUMMARY",
          nombre: "Reporte 1",
          formato: "PDF",
          parametros: "{}",
          fechaGeneracion: new Date(),
          generadoPor: "sistema",
          numeroAlertas: 0,
          rutaArchivo: "/reports/test.pdf",
        },
      ];

      mockReportHistory.findMany.mockResolvedValue(mockReports);
      mockReportHistory.count.mockResolvedValue(10);

      const request = new NextRequest(
        "http://localhost/api/contabilidad/exchange/report-history?limit=1&offset=0"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.limit).toBe(1);
      expect(body.offset).toBe(0);
      expect(mockReportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
          skip: 0,
        })
      );
    });

    it("debe retornar lista vacía cuando no hay reportes", async () => {
      const { GET } = await import("../report-history/route");
      
      mockReportHistory.findMany.mockResolvedValue([]);
      mockReportHistory.count.mockResolvedValue(0);

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("debe manejar errores de base de datos", async () => {
      const { GET } = await import("../report-history/route");
      
      mockReportHistory.findMany.mockRejectedValue(new Error("Database error"));
      mockReportHistory.count.mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Error al obtener historial de reportes");
    });
  });

  describe("POST /api/contabilidad/exchange/report-history", () => {
    it("debe registrar un nuevo reporte", async () => {
      const { POST } = await import("../report-history/route");
      
      const mockCreatedReport = {
        id: "new-report-1",
        tipoReporte: "EXCHANGE_SUMMARY",
        nombre: "Reporte de Cambio Semanal",
        formato: "PDF",
        parametros: JSON.stringify({ fechaInicio: "2025-01-01", fechaFin: "2025-01-07" }),
        fechaGeneracion: new Date(),
        generadoPor: "sistema",
        numeroAlertas: 5,
        rutaArchivo: "/reports/exchange-summary-2025-02-01.pdf",
      };

      mockReportHistory.create.mockResolvedValue(mockCreatedReport);

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history", {
        method: "POST",
        body: JSON.stringify({
          tipoReporte: "EXCHANGE_SUMMARY",
          nombreArchivo: "Reporte de Cambio Semanal",
          formato: "PDF",
          parametros: { fechaInicio: "2025-01-01", fechaFin: "2025-01-07" },
          generadoPor: "sistema",
          numeroAlertas: 5,
          rutaArchivo: "/reports/exchange-summary-2025-02-01.pdf",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(
        expect.objectContaining({
          id: "new-report-1",
          tipoReporte: "EXCHANGE_SUMMARY",
          formato: "PDF"
        })
      );
    });

    it("debe rechazar reportes sin tipoReporte requerido", async () => {
      const { POST } = await import("../report-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history", {
        method: "POST",
        body: JSON.stringify({
          titulo: "Reporte sin tipo",
          formato: "PDF",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("tipoReporte");
    });

    it("debe rechazar reportes sin nombreArchivo requerido", async () => {
      const { POST } = await import("../report-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history", {
        method: "POST",
        body: JSON.stringify({
          tipoReporte: "EXCHANGE_SUMMARY",
          formato: "PDF",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("nombreArchivo");
    });

    it("debe rechazar reportes sin formato requerido", async () => {
      const { POST } = await import("../report-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history", {
        method: "POST",
        body: JSON.stringify({
          tipoReporte: "EXCHANGE_SUMMARY",
          titulo: "Reporte",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("formato");
    });

    it("debe permitir reportes sin rutaArchivo", async () => {
      const { POST } = await import("../report-history/route");
      
      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history", {
        method: "POST",
        body: JSON.stringify({
          tipoReporte: "EXCHANGE_SUMMARY",
          nombreArchivo: "Reporte",
          formato: "PDF",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it("debe manejar errores al crear reporte", async () => {
      const { POST } = await import("../report-history/route");
      
      mockReportHistory.create.mockRejectedValue(new Error("Create error"));

      const request = new NextRequest("http://localhost/api/contabilidad/exchange/report-history", {
        method: "POST",
        body: JSON.stringify({
          tipoReporte: "EXCHANGE_SUMMARY",
          nombreArchivo: "Reporte de Test",
          formato: "PDF",
          rutaArchivo: "/reports/test.pdf",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Error al registrar reporte");
    });
  });
});
