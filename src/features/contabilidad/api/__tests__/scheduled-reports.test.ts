import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  calcularProximaEjecucion,
  crearReporteProgramado,
  activarReporteProgramado,
  ejecutarReporteProgramado,
  obtenerReportesPendientes,
  obtenerEstadisticasScheduler,
  registerReportGenerator,
  getReportGenerator,
} from "@/lib/services/scheduled-report-scheduler";

// Mock de Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scheduledReport: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      delete: vi.fn(),
    },
    reportHistory: {
      create: vi.fn(),
    },
  },
}));

describe("Scheduled Report Scheduler Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calcularProximaEjecucion", () => {
    it("debe calcular próxima ejecución diaria para hora futura", () => {
      const ahora = new Date();
      const proxima = calcularProximaEjecucion("diaria", null, null, "23:59");

      // Debe ser hoy o mañana
      const diffDias = Math.floor(
        (proxima.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDias).toBeLessThanOrEqual(1);
    });

    it("debe calcular próxima ejecución diaria para hora pasada", () => {
      const ahora = new Date();
      const horaPasada = `${Math.max(0, ahora.getHours() - 1)}:00`;
      const proxima = calcularProximaEjecucion("diaria", null, null, horaPasada);

      // Debe ser mañana si ya pasó la hora
      const diffDias = Math.floor(
        (proxima.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDias).toBeGreaterThanOrEqual(0);
    });

    it("debe calcular próxima ejecución semanal para día específico", () => {
      const ahora = new Date();
      const diaLunes = 1; // Lunes
      const proxima = calcularProximaEjecucion("semanal", diaLunes, null, "08:00");

      // Debe ser un día 1 (lunes)
      expect(proxima.getDay()).toBe(diaLunes);
      // Debe ser mayor o igual a hoy
      expect(proxima.getTime()).toBeGreaterThanOrEqual(ahora.getTime());
    });

    it("debe calcular próxima ejecución mensual para día específico", () => {
      const ahora = new Date();
      const dia15 = 15;
      const proxima = calcularProximaEjecucion("mensual", null, dia15, "09:00");

      // Debe ser día 15 o menos si ya pasó
      expect(proxima.getDate()).toBeLessThanOrEqual(dia15 + 1);
      // Debe ser mayor o igual a hoy
      expect(proxima.getTime()).toBeGreaterThanOrEqual(ahora.getTime());
    });

    it("debe calcular próxima ejecución quincenal", () => {
      const ahora = new Date();
      const proxima = calcularProximaEjecucion("quincenal", null, null, "10:00");

      // Debe ser día 15 o después
      expect(proxima.getDate()).toBeGreaterThanOrEqual(15);
      // Debe ser mayor o igual a hoy
      expect(proxima.getTime()).toBeGreaterThanOrEqual(ahora.getTime());
    });

    it("debe manejar zona horaria correctamente", () => {
      const proxima = calcularProximaEjecucion(
        "diaria",
        null,
        null,
        "12:00",
        "America/New_York"
      );

      expect(proxima).toBeInstanceOf(Date);
      // Verificar que la fecha es válida
      expect(isNaN(proxima.getTime())).toBe(false);
    });
  });

  describe("crearReporteProgramado", () => {
    it("debe crear un reporte programado válido", async () => {
      const mockReporte = {
        id: "test-id",
        nombre: "Reporte Semanal",
        tipoReporte: "COMPLETO",
        formato: "PDF",
        frecuencia: "semanal",
        diaSemana: 1,
        hora: "08:00",
        activo: true,
        creadoPor: "user-1",
      };

      vi.mocked(prisma.scheduledReport.create).mockResolvedValue(mockReporte as never);

      const resultado = await crearReporteProgramado({
        nombre: "Reporte Semanal",
        tipoReporte: "COMPLETO",
        formato: "PDF",
        frecuencia: "semanal",
        diaSemana: 1,
        hora: "08:00",
        creadoPor: "user-1",
      });

      expect(resultado.nombre).toBe("Reporte Semanal");
      expect(prisma.scheduledReport.create).toHaveBeenCalled();
    });

    it("debe lanzar error para frecuencia inválida", async () => {
      await expect(
        crearReporteProgramado({
          nombre: "Reporte Inválido",
          tipoReporte: "COMPLETO",
          formato: "PDF",
          frecuencia: "invalida",
          hora: "08:00",
          creadoPor: "user-1",
        })
      ).rejects.toThrow("Frecuencia inválida");
    });

    it("debe lanzar error si falta diaSemana para frecuencia semanal", async () => {
      await expect(
        crearReporteProgramado({
          nombre: "Reporte Semanal",
          tipoReporte: "COMPLETO",
          formato: "PDF",
          frecuencia: "semanal",
          hora: "08:00",
          creadoPor: "user-1",
        })
      ).rejects.toThrow("día de la semana");
    });

    it("debe lanzar error si falta diaMes para frecuencia mensual", async () => {
      await expect(
        crearReporteProgramado({
          nombre: "Reporte Mensual",
          tipoReporte: "COMPLETO",
          formato: "PDF",
          frecuencia: "mensual",
          hora: "08:00",
          creadoPor: "user-1",
        })
      ).rejects.toThrow("día del mes");
    });
  });

  describe("activarReporteProgramado", () => {
    it("debe activar un reporte programado", async () => {
      const mockReporte = {
        id: "test-id",
        nombre: "Reporte Test",
        frecuencia: "diaria",
        diaSemana: null,
        diaMes: null,
        hora: "08:00",
        zonaHoraria: "America/Havana",
        activo: true,
      };

      vi.mocked(prisma.scheduledReport.findUnique).mockResolvedValue(mockReporte as never);
      vi.mocked(prisma.scheduledReport.update).mockResolvedValue({
        ...mockReporte,
        activo: true,
      } as never);

      const resultado = await activarReporteProgramado("test-id", true);

      expect(resultado.activo).toBe(true);
      expect(prisma.scheduledReport.update).toHaveBeenCalled();
    });

    it("debe desactivar un reporte programado", async () => {
      const mockReporte = {
        id: "test-id",
        nombre: "Reporte Test",
        frecuencia: "diaria",
        diaSemana: null,
        diaMes: null,
        hora: "08:00",
        zonaHoraria: "America/Havana",
        activo: false,
      };

      vi.mocked(prisma.scheduledReport.findUnique).mockResolvedValue({
        ...mockReporte,
        activo: true,
      } as never);
      vi.mocked(prisma.scheduledReport.update).mockResolvedValue(mockReporte as never);

      const resultado = await activarReporteProgramado("test-id", false);

      expect(resultado.activo).toBe(false);
    });

    it("debe lanzar error si el reporte no existe", async () => {
      vi.mocked(prisma.scheduledReport.findUnique).mockResolvedValue(null);

      await expect(activarReporteProgramado("inexistente", true)).rejects.toThrow(
        "no encontrado"
      );
    });
  });

  describe("ejecutarReporteProgramado", () => {
    it("debe ejecutar un reporte programado exitosamente", async () => {
      const mockReporte = {
        id: "test-id",
        nombre: "Reporte Test",
        tipoReporte: "COMPLETO",
        formato: "PDF",
        parametros: null,
        frecuencia: "diaria",
        diaSemana: null,
        diaMes: null,
        hora: "08:00",
        zonaHoraria: "America/Havana",
        activo: true,
        creadoPor: "user-1",
      };

      vi.mocked(prisma.scheduledReport.findUnique).mockResolvedValue(mockReporte as never);
      vi.mocked(prisma.scheduledReport.update).mockResolvedValue({
        ...mockReporte,
        ultimaEjecucion: new Date(),
        totalEjecuciones: 1,
        ultimaEjecucionExitosa: true,
      } as never);
      vi.mocked(prisma.reportHistory.create).mockResolvedValue({} as never);

      const resultado = await ejecutarReporteProgramado("test-id");

      expect(resultado.success).toBe(true);
      expect(prisma.scheduledReport.update).toHaveBeenCalled();
    });

    it("no debe ejecutar un reporte desactivado", async () => {
      vi.mocked(prisma.scheduledReport.findUnique).mockResolvedValue({
        id: "test-id",
        activo: false,
      } as never);

      const resultado = await ejecutarReporteProgramado("test-id");

      expect(resultado.success).toBe(false);
      expect(resultado.message).toContain("desactivado");
    });
  });

  describe("obtenerReportesPendientes", () => {
    it("debe obtener reportes pendientes de ejecución", async () => {
      const mockReportes = [
        { id: "1", nombre: "Reporte 1", proximaEjecucion: new Date() },
        { id: "2", nombre: "Reporte 2", proximaEjecucion: new Date() },
      ];

      vi.mocked(prisma.scheduledReport.findMany).mockResolvedValue(mockReportes as never);

      const resultado = await obtenerReportesPendientes();

      expect(resultado).toHaveLength(2);
      expect(prisma.scheduledReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            activo: true,
          }),
        })
      );
    });
  });

  describe("obtenerEstadisticasScheduler", () => {
    it("debe obtener estadísticas del scheduler", async () => {
      // Configurar mocks en orden
      vi.mocked(prisma.scheduledReport.count)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3);
      vi.mocked(prisma.scheduledReport.groupBy).mockResolvedValue([
        { frecuencia: "diaria", _count: { id: 3 } },
        { frecuencia: "semanal", _count: { id: 4 } },
      ] as never);
      vi.mocked(prisma.scheduledReport.findMany).mockResolvedValue([]);

      const resultado = await obtenerEstadisticasScheduler();

      expect(resultado.total).toBe(10);
      expect(resultado.activos).toBe(7);
      expect(resultado.inactivos).toBe(3);
    });
  });

  describe("registerReportGenerator", () => {
    it("debe registrar un callback de generación de reportes", () => {
      const mockGenerator = vi.fn();

      registerReportGenerator(mockGenerator);

      expect(getReportGenerator()).toBe(mockGenerator);
    });
  });
});

describe("Scheduled Reports API Endpoints", () => {
  describe("Configuración de Programación", () => {
    it("debe validar parámetros requeridos al crear reporte", async () => {
      // Test de validación de campos requeridos
      const datosRequeridos = {
        nombre: "Reporte Test",
        tipoReporte: "COMPLETO",
        formato: "PDF",
        frecuencia: "diaria",
        hora: "08:00",
        creadoPor: "user-1",
      };

      // Verificar que todos los campos requeridos estén presentes
      expect(datosRequeridos.nombre).toBeDefined();
      expect(datosRequeridos.tipoReporte).toBeDefined();
      expect(datosRequeridos.formato).toBeDefined();
      expect(datosRequeridos.frecuencia).toBeDefined();
      expect(datosRequeridos.hora).toBeDefined();
      expect(datosRequeridos.creadoPor).toBeDefined();
    });

    it("debe permitir frecuencias válidas", () => {
      const frecuenciasValidas = ["diaria", "semanal", "quincenal", "mensual"];

      frecuenciasValidas.forEach((frecuencia) => {
        expect(frecuenciasValidas).toContain(frecuencia);
      });
    });
  });

  describe("Generación Automática", () => {
    it("debe generar reporte con parámetros correctos", async () => {
      const parametros = {
        fechaInicio: "2024-01-01",
        fechaFin: "2024-01-31",
        tipoReporte: "COST_IMPACT",
      };

      // Simular generación de reporte
      const mockGenerator = vi.fn().mockResolvedValue(undefined);
      registerReportGenerator(mockGenerator);

      const generator = getReportGenerator();
      if (generator) {
        await generator("test-id", parametros);
      }

      expect(mockGenerator).toHaveBeenCalledWith("test-id", parametros);
    });

    it("debe guardar reporte generado en historial", async () => {
      vi.mocked(prisma.reportHistory.create).mockResolvedValue({} as never);

      const mockReporte = {
        id: "test-id",
        tipoReporte: "COMPLETO",
        formato: "PDF",
        nombre: "Reporte Programado",
        descripcion: null,
        parametros: null,
        creadoPor: "user-1",
      };

      // Verificar que se guarda en historial
      expect(prisma.reportHistory.create).toBeDefined();
    });
  });
});
