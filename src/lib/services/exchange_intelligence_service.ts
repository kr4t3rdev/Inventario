import { prisma } from "@/lib/prisma";
import {
  CostImpactResponse,
  DebtExposureResponse,
  PaymentEfficiencyResponse,
  KPIsResponse,
  SimulateScenarioResponse,
  CurrencyCode,
  ExchangeRate,
  BreakEvenExchangeRate,
  RealMargin,
  ExchangeDifferential,
  DebtPriority,
} from "@/lib/types/exchange-intelligence";

/**
 * @description Interfaz para filtros de análisis de costos
 */
interface CostImpactFilters {
  categoria_id?: string;
  almacen_id?: string;
  vendor_id?: string;
}

/**
 * @description Servicio para análisis de inteligencia cambiaria
 */
export class ExchangeIntelligenceService {
  /**
   * @description Calcula el impacto del tipo de cambio en costos de inventario
   * @param fecha_inicio - Fecha de inicio del análisis en formato ISO
   * @param fecha_fin - Fecha de fin del análisis en formato ISO
   * @param filtros - Filtros opcionales (categoría, almacén, proveedor)
   * @returns Datos de impacto en costos con timeline y resumen
   */
  async calculate_cost_impact(
    fecha_inicio: string,
    fecha_fin: string,
    filtros?: CostImpactFilters
  ): Promise<CostImpactResponse> {
    try {
      // Validar fechas
      const fecha_inicio_date = new Date(fecha_inicio);
      const fecha_fin_date = new Date(fecha_fin);

      if (fecha_inicio_date > fecha_fin_date) {
        throw new Error("La fecha de inicio debe ser anterior a la fecha de fin");
      }

      // Construir filtros para la consulta de productos
      const where_productos: any = {};
      
      if (filtros?.categoria_id) {
        where_productos.categoriaId = filtros.categoria_id;
      }
      
      if (filtros?.almacen_id) {
        where_productos.almacenId = filtros.almacen_id;
      }
      
      if (filtros?.vendor_id) {
        where_productos.vendorId = filtros.vendor_id;
      }

      // Obtener productos con su inventario actual
      const productos = await prisma.producto.findMany({
        where: where_productos,
        include: {
          gastoCompras: {
            where: {
              fechaCompra: {
                gte: fecha_inicio_date,
                lte: fecha_fin_date,
              },
            },
            orderBy: {
              fechaCompra: 'desc',
            },
          },
        },
      });

      // Manejar caso de inventario vacío
      if (productos.length === 0) {
        return {
          timeline: [],
          resumen: {
            incremento_promedio: 0,
            productos_afectados: 0,
            alerta_ajuste_precios: false,
          },
        };
      }

      const moneda_principal_record = await prisma.moneda.findFirst({
        where: { esPrincipal: true },
        select: { codigo: true },
      });

      const moneda_principal = moneda_principal_record?.codigo || "CUP";

      const tasas_actuales_records = await prisma.tasaCambio.findMany({
        where: {
          monedaDestino: moneda_principal,
        },
        orderBy: {
          fechaVigencia: 'desc',
        },
      });

      const tasas_actuales: Record<string, number> = {};
      for (const tasa of tasas_actuales_records) {
        if (tasas_actuales[tasa.monedaOrigenId] !== undefined) continue;
        tasas_actuales[tasa.monedaOrigenId] = Number(tasa.tasa);
      }

      const gasto_compra_ids: string[] = [];
      for (const producto of productos) {
        for (const compra of producto.gastoCompras) {
          gasto_compra_ids.push(compra.gastoCompraId);
        }
      }

      const reconciliaciones_compra = gasto_compra_ids.length > 0
        ? await prisma.reconciliacionGasto.findMany({
            where: {
              gastoCompraId: { in: gasto_compra_ids },
            },
            select: {
              gastoCompraId: true,
              moneda: true,
              tasaCambio: true,
              monto: true,
            },
          })
        : [];

      const reconciliacion_por_compra = new Map<string, {
        moneda: string;
        tasaCambio: number | null;
        monto: number;
      }>();

      for (const rec of reconciliaciones_compra) {
        if (!rec.gastoCompraId) continue;
        reconciliacion_por_compra.set(rec.gastoCompraId, {
          moneda: (rec.moneda || moneda_principal).toUpperCase(),
          tasaCambio: rec.tasaCambio ? Number(rec.tasaCambio) : null,
          monto: Number(rec.monto),
        });
      }

      const detalle_reposiciones: NonNullable<CostImpactResponse['detalle_reposiciones']> = [];
      const por_producto_map = new Map<string, {
        producto_id: string;
        nombre: string;
        gasto_historico: number;
        gasto_reposicion: number;
        reposiciones: number;
        impacto_fx_total: number;
      }>();

      const timeline_map = new Map<string, {
        costo_historico: number;
        costo_reposicion: number;
      }>();

      const productos_con_compras = new Set<string>();

      for (const producto of productos) {
        if (producto.gastoCompras.length === 0) continue;

        productos_con_compras.add(producto.id);

        if (!por_producto_map.has(producto.id)) {
          por_producto_map.set(producto.id, {
            producto_id: producto.id,
            nombre: producto.nombre,
            gasto_historico: 0,
            gasto_reposicion: 0,
            reposiciones: 0,
            impacto_fx_total: 0,
          });
        }

        for (const compra of producto.gastoCompras) {
          const fecha_key = compra.fechaCompra.toISOString().split('T')[0];
          const rec = reconciliacion_por_compra.get(compra.gastoCompraId);
          const moneda = (rec?.moneda || moneda_principal).toUpperCase();

          let tasa_original = 1;
          if (moneda !== moneda_principal) {
            if (rec?.tasaCambio) {
              tasa_original = rec.tasaCambio;
            } else {
              const tasa_compra_record = await prisma.tasaCambio.findFirst({
                where: {
                  monedaOrigenId: moneda,
                  monedaDestino: moneda_principal,
                  fechaVigencia: {
                    lte: compra.fechaCompra,
                  },
                },
                orderBy: {
                  fechaVigencia: 'desc',
                },
              });

              tasa_original = tasa_compra_record ? Number(tasa_compra_record.tasa) : 1;
            }
          }

          const tasa_actual = moneda !== moneda_principal
            ? (tasas_actuales[moneda] ?? tasa_original)
            : 1;

          const monto_moneda = moneda !== moneda_principal
            ? (rec?.monto || Number(compra.total) || (compra.precioUnitario * compra.cantidad))
            : (Number(compra.total) || (compra.precioUnitario * compra.cantidad));

          const gasto_historico_local = moneda !== moneda_principal
            ? (monto_moneda * tasa_original)
            : monto_moneda;

          const gasto_reposicion_local = moneda !== moneda_principal
            ? (monto_moneda * tasa_actual)
            : monto_moneda;

          const impacto_fx = gasto_reposicion_local - gasto_historico_local;
          const variacion_porcentual_fx = gasto_historico_local > 0
            ? (impacto_fx / gasto_historico_local) * 100
            : 0;

          detalle_reposiciones.push({
            producto_id: producto.id,
            producto_nombre: producto.nombre,
            fecha: fecha_key,
            moneda,
            monto_moneda,
            tasa_original,
            tasa_actual,
            gasto_historico_local,
            gasto_reposicion_local,
            impacto_fx,
            variacion_porcentual_fx,
          });

          if (!timeline_map.has(fecha_key)) {
            timeline_map.set(fecha_key, {
              costo_historico: 0,
              costo_reposicion: 0,
            });
          }

          const timeline_entry = timeline_map.get(fecha_key)!;
          timeline_entry.costo_historico += gasto_historico_local;
          timeline_entry.costo_reposicion += gasto_reposicion_local;

          const producto_entry = por_producto_map.get(producto.id)!;
          producto_entry.gasto_historico += gasto_historico_local;
          producto_entry.gasto_reposicion += gasto_reposicion_local;
          producto_entry.reposiciones += 1;
          producto_entry.impacto_fx_total += impacto_fx;
        }
      }

      const total_productos_afectados = productos_con_compras.size;

      // Convertir timeline map a array y calcular diferencias porcentuales
      const timeline: Array<{
        fecha: string;
        costo_historico: number;
        costo_reposicion: number;
        diferencia_porcentual: number;
      }> = [];

      for (const [fecha, data] of timeline_map) {
        timeline.push({
          fecha,
          costo_historico: data.costo_historico,
          costo_reposicion: data.costo_reposicion,
          diferencia_porcentual: data.costo_historico > 0
            ? ((data.costo_reposicion - data.costo_historico) / data.costo_historico) * 100
            : 0,
        });
      }

      timeline.sort((a, b) => a.fecha.localeCompare(b.fecha));

      const por_producto = Array.from(por_producto_map.values()).map((p) => ({
        ...p,
        diferencia_porcentual: p.gasto_historico > 0
          ? ((p.gasto_reposicion - p.gasto_historico) / p.gasto_historico) * 100
          : 0,
      }));

      const total_historico = por_producto.reduce((sum, p) => sum + p.gasto_historico, 0);
      const total_reposicion = por_producto.reduce((sum, p) => sum + p.gasto_reposicion, 0);

      const incremento_promedio = total_historico > 0
        ? ((total_reposicion - total_historico) / total_historico) * 100
        : 0;

      // Determinar si se debe generar alerta (incremento > 10%)
      const alerta_ajuste_precios = incremento_promedio > 10;

      return {
        timeline,
        por_producto,
        detalle_reposiciones,
        moneda_principal,
        resumen: {
          incremento_promedio,
          productos_afectados: total_productos_afectados,
          alerta_ajuste_precios,
        },
      };
    } catch (error) {
      console.error("Error en calculate_cost_impact:", error);
      throw error;
    }
  }

  /**
   * @description Analiza la exposición a riesgos cambiarios en deudas
   * @param fecha_corte - Fecha de corte para el análisis (default: hoy)
   * @returns Análisis de exposición de deuda con pérdidas no realizadas
   */
  async calculate_debt_exposure(fecha_corte?: string): Promise<DebtExposureResponse> {
    try {
      const fecha_corte_date = fecha_corte ? new Date(fecha_corte) : new Date();

      // Obtener deudas activas
      const deudas = await prisma.inyeccionCapital.findMany({
        where: {
          estado: 'ACTIVA',
          fechaRegistro: {
            lte: fecha_corte_date,
          },
        },
      });

      // Manejar caso sin deudas
      if (deudas.length === 0) {
        return {
          deuda_original_local: 0,
          deuda_actual_local: 0,
          perdida_no_realizada: 0,
          desglose_por_moneda: [],
          alertas: [],
        };
      }

      // Obtener tasas de cambio actuales
      const tasas_actuales_records = await prisma.tasaCambio.findMany({
        orderBy: {
          fechaVigencia: 'desc',
        },
        distinct: ['monedaOrigenId'],
      });

      const tasas_actuales: Record<string, number> = {};
      for (const tasa of tasas_actuales_records) {
        tasas_actuales[tasa.monedaOrigenId] = Number(tasa.tasa);
      }

      // Calcular exposición
      let deuda_original_local = 0;
      let deuda_actual_local = 0;
      const desglose_por_moneda: DebtExposureResponse['desglose_por_moneda'] = [];

      const moneda_map = new Map<string, {
        monto_original: number;
        monto_actual: number;
        diferencia: number;
        antiguedad_dias: number;
        tendencia: 'alcista' | 'bajista' | 'estable';
      }>();

      for (const deuda of deudas) {
        // Obtener tasa original (al momento de la deuda)
        const tasa_original_record = await prisma.tasaCambio.findFirst({
          where: {
            fechaVigencia: {
              lte: deuda.fechaRegistro,
            },
            monedaOrigenId: deuda.moneda,
          },
          orderBy: {
            fechaVigencia: 'desc',
          },
        });

        const tasa_original = tasa_original_record ? Number(tasa_original_record.tasa) : 1;
        const tasa_actual = tasas_actuales[deuda.moneda] || tasa_original;

        const monto_original_local = Number(deuda.montoRecibido) * tasa_original;
        const monto_actual_local = Number(deuda.saldoPendiente) * tasa_actual;

        deuda_original_local += monto_original_local;
        deuda_actual_local += monto_actual_local;

        // Calcular antigüedad
        const antiguedad_dias = Math.floor(
          (fecha_corte_date.getTime() - deuda.fechaRegistro.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Calcular tendencia (últimos 30 días)
        const fecha_30_dias_atras = new Date(fecha_corte_date);
        fecha_30_dias_atras.setDate(fecha_30_dias_atras.getDate() - 30);

        const tasa_30_dias_record = await prisma.tasaCambio.findFirst({
          where: {
            fechaVigencia: {
              lte: fecha_30_dias_atras,
            },
            monedaOrigenId: deuda.moneda,
          },
          orderBy: {
            fechaVigencia: 'desc',
          },
        });

        const tasa_30_dias = tasa_30_dias_record ? Number(tasa_30_dias_record.tasa) : tasa_original;
        const cambio_30_dias = ((tasa_actual - tasa_30_dias) / tasa_30_dias) * 100;

        let tendencia: 'alcista' | 'bajista' | 'estable' = 'estable';
        if (cambio_30_dias > 2) tendencia = 'alcista';
        else if (cambio_30_dias < -2) tendencia = 'bajista';

        // Agregar a desglose
        if (!moneda_map.has(deuda.moneda)) {
          moneda_map.set(deuda.moneda, {
            monto_original: 0,
            monto_actual: 0,
            diferencia: 0,
            antiguedad_dias: 0,
            tendencia,
          });
        }

        const moneda_entry = moneda_map.get(deuda.moneda)!;
        moneda_entry.monto_original += monto_original_local;
        moneda_entry.monto_actual += monto_actual_local;
        moneda_entry.diferencia += (monto_actual_local - monto_original_local);
        moneda_entry.antiguedad_dias = Math.max(moneda_entry.antiguedad_dias, antiguedad_dias);
      }

      // Convertir mapa a array
      for (const [moneda, data] of moneda_map) {
        desglose_por_moneda.push({
          moneda,
          monto_original: data.monto_original,
          monto_actual: data.monto_actual,
          diferencia: data.diferencia,
          antiguedad_dias: data.antiguedad_dias,
          tendencia: data.tendencia,
        });
      }

      const perdida_no_realizada = deuda_actual_local - deuda_original_local;

      // Generar alertas
      const alertas: DebtExposureResponse['alertas'] = [];
      if (perdida_no_realizada > 0.05 * deuda_original_local) {
        alertas.push({
          mensaje: `Pérdida no realizada significativa: ${(perdida_no_realizada / deuda_original_local * 100).toFixed(2)}%`,
          severidad: 'critical',
        });
      }

      return {
        deuda_original_local,
        deuda_actual_local,
        perdida_no_realizada,
        desglose_por_moneda,
        alertas,
      };
    } catch (error) {
      console.error("Error en calculate_debt_exposure:", error);
      throw error;
    }
  }

  /**
   * @description Evalúa la eficiencia en transacciones de cambio e identifica transacciones con spreads superiores al promedio
   * @param fecha_inicio - Fecha de inicio del período
   * @param fecha_fin - Fecha de fin del período
   * @param moneda - Filtro opcional por moneda
   * @returns Análisis de eficiencia de pagos con spreads bancarios y lista de transacciones ineficientes
   */
  async calculate_payment_efficiency(
    fecha_inicio: string,
    fecha_fin: string,
    moneda?: string
  ): Promise<PaymentEfficiencyResponse> {
    try {
      const fecha_inicio_date = new Date(fecha_inicio);
      const fecha_fin_date = new Date(fecha_fin);

      // Obtener transacciones de cambio (usando TransferenciaBancaria)
      const where_transacciones: any = {
        fechaTransferencia: {
          gte: fecha_inicio_date,
          lte: fecha_fin_date,
        },
      };

      if (moneda) {
        where_transacciones.monedaOrigen = moneda;
      }

      const transacciones = await prisma.transferenciaBancaria.findMany({
        where: where_transacciones,
        orderBy: {
          fechaTransferencia: 'asc',
        },
      });

      // Manejar caso sin transacciones
      if (transacciones.length === 0) {
        return {
          transacciones: [],
          spread_promedio: 0,
          mejor_tasa: 0,
          peor_tasa: 0,
          transacciones_superiores_promedio: [],
          recomendacion_renegociacion: false,
        };
      }

      // Obtener tasas oficiales para cada fecha
      const tasas_oficiales: Record<string, Record<string, number>> = {};

      for (const tx of transacciones) {
        const fecha_key = tx.fechaTransferencia.toISOString().split('T')[0];
        if (!tasas_oficiales[fecha_key]) {
          tasas_oficiales[fecha_key] = {};
        }

        // Buscar tasa oficial para esa fecha y moneda
        const tasa_oficial_record = await prisma.tasaCambio.findFirst({
          where: {
            fechaVigencia: {
              lte: tx.fechaTransferencia,
            },
            monedaOrigenId: tx.monedaOrigen,
          },
          orderBy: {
            fechaVigencia: 'desc',
          },
        });

        tasas_oficiales[fecha_key][tx.monedaOrigen] = tasa_oficial_record
          ? Number(tasa_oficial_record.tasa)
          : Number(tx.tasaCambio) || 1; // Fallback a tasa de la transacción
      }

      // Calcular spreads
      const transacciones_con_spread: PaymentEfficiencyResponse['transacciones'] = [];
      let suma_spread_ponderado = 0;
      let suma_montos = 0;
      let mejor_tasa = Infinity;
      let peor_tasa = 0;

      for (const tx of transacciones) {
        const fecha_key = tx.fechaTransferencia.toISOString().split('T')[0];
        const tasa_oficial = tasas_oficiales[fecha_key]?.[tx.monedaOrigen] || Number(tx.tasaCambio) || 1;
        const tasa_real = Number(tx.tasaCambio) || tasa_oficial;

        const spread_bancario = ((tasa_real - tasa_oficial) / tasa_oficial) * 100;
        const monto = Number(tx.montoOrigen);

        suma_spread_ponderado += spread_bancario * monto;
        suma_montos += monto;

        // Calcular mejor y peor tasa
        if (tasa_real < mejor_tasa) mejor_tasa = tasa_real;
        if (tasa_real > peor_tasa) peor_tasa = tasa_real;

        transacciones_con_spread.push({
          fecha: fecha_key,
          moneda: tx.monedaOrigen,
          monto,
          tasa_oficial,
          tasa_real,
          spread_bancario,
        });
      }

      const spread_promedio = suma_montos > 0 ? suma_spread_ponderado / suma_montos : 0;
      const recomendacion_renegociacion = spread_promedio > 3;

      // Filtrar transacciones con spread superior al promedio
      const transacciones_superiores_promedio = transacciones_con_spread.filter(
        (tx) => tx.spread_bancario > spread_promedio
      );

      return {
        transacciones: transacciones_con_spread,
        spread_promedio,
        mejor_tasa: mejor_tasa === Infinity ? 0 : mejor_tasa,
        peor_tasa,
        transacciones_superiores_promedio,
        recomendacion_renegociacion,
      };
    } catch (error) {
      console.error("Error en calculate_payment_efficiency:", error);
      throw error;
    }
  }

  /**
   * @description Calcula la tasa de equilibrio para un producto
   * @param precio_venta - Precio de venta del producto
   * @param gastos_fijos - Gastos fijos asociados
   * @param costo_divisa - Costo en moneda extranjera
   * @returns Tasa de equilibrio o null si no es calculable
   */
  private calculate_break_even_rate(
    precio_venta: number,
    gastos_fijos: number,
    costo_divisa: number
  ): number | null {
    if (costo_divisa === 0) {
      return null; // No calculable
    }

    const tasa_equilibrio = (precio_venta - gastos_fijos) / costo_divisa;

    if (tasa_equilibrio < 0) {
      return null; // Producto no rentable
    }

    return tasa_equilibrio;
  }

  /**
   * @description Calcula todos los KPIs del dashboard
   * @param fecha_inicio - Fecha de inicio del período
   * @param fecha_fin - Fecha de fin del período
   * @returns Datos de todos los KPIs
   */
  async calculate_kpis(fecha_inicio: string, fecha_fin: string): Promise<KPIsResponse> {
    try {
      const fecha_inicio_date = new Date(fecha_inicio);
      const fecha_fin_date = new Date(fecha_fin);

      // 1. Calcular Tasa de Equilibrio
      const productos = await prisma.producto.findMany({
        include: {
          gastoCompras: {
            where: {
              fechaCompra: {
                gte: fecha_inicio_date,
                lte: fecha_fin_date,
              },
            },
            orderBy: {
              fechaCompra: 'desc',
            },
          },
        },
      });

      const tasa_equilibrio: KPIsResponse['tasa_equilibrio'] = [];

      for (const producto of productos) {
        if (producto.gastoCompras.length === 0) continue;

        // Usar la compra más reciente
        const ultima_compra = producto.gastoCompras[0];

        // Obtener tasa actual
        const tasa_actual_record = await prisma.tasaCambio.findFirst({
          where: {
            monedaOrigenId: 'CUP', // Simplificación: asumir CUP como moneda principal
            fechaVigencia: {
              lte: new Date(),
            },
          },
          orderBy: {
            fechaVigencia: 'desc',
          },
        });

        const tasa_actual = tasa_actual_record ? Number(tasa_actual_record.tasa) : 1;
        const tasa_equilibrio_calc = this.calculate_break_even_rate(
          producto.precioVenta,
          0, // Simplificación: sin gastos fijos por ahora
          ultima_compra.precioUnitario
        );

        if (tasa_equilibrio_calc !== null) {
          const proximidad_porcentaje = ((tasa_actual - tasa_equilibrio_calc) / tasa_equilibrio_calc) * 100;
          let estado: 'seguro' | 'advertencia' | 'critico' = 'seguro';

          if (Math.abs(proximidad_porcentaje) > 100) estado = 'critico';
          else if (Math.abs(proximidad_porcentaje) > 10) estado = 'advertencia';

          tasa_equilibrio.push({
            producto_id: producto.id,
            nombre: producto.nombre,
            tasa_equilibrio: tasa_equilibrio_calc,
            tasa_actual,
            proximidad_porcentaje,
            estado,
          });
        }
      }

      // 2. Calcular Margen Real vs Nominal (simplificado)
      const margen_real_vs_nominal: KPIsResponse['margen_real_vs_nominal'] = {
        margen_nominal: 0,
        margen_real: 0,
        diferencia_porcentual: 0,
        tendencia_historica: [],
      };

      // 3. Diferencial Cambiario Acumulado (simplificado)
      const diferencial_cambiario_acumulado: KPIsResponse['diferencial_cambiario_acumulado'] = {
        ytd: 0,
        desglose_mensual: [],
        comparacion_anio_anterior: 0,
      };

      // 4. Envejecimiento de Deuda
      const envejecimiento_deuda: KPIsResponse['envejecimiento_deuda'] = [];

      const deudas = await prisma.inyeccionCapital.findMany({
        where: {
          estado: 'ACTIVA',
          fechaRegistro: {
            lte: fecha_fin_date,
          },
        },
      });

      for (const deuda of deudas) {
        const antiguedad_dias = Math.floor(
          (fecha_fin_date.getTime() - deuda.fechaRegistro.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Calcular tendencia (simplificada)
        const fecha_30_dias_atras = new Date(fecha_fin_date);
        fecha_30_dias_atras.setDate(fecha_30_dias_atras.getDate() - 30);

        const tasa_30_dias_record = await prisma.tasaCambio.findFirst({
          where: {
            fechaVigencia: {
              lte: fecha_30_dias_atras,
            },
            monedaOrigenId: deuda.moneda,
          },
          orderBy: {
            fechaVigencia: 'desc',
          },
        });

        const tasa_actual_record = await prisma.tasaCambio.findFirst({
          where: {
            fechaVigencia: {
              lte: fecha_fin_date,
            },
            monedaOrigenId: deuda.moneda,
          },
          orderBy: {
            fechaVigencia: 'desc',
          },
        });

        const tasa_30_dias = tasa_30_dias_record ? Number(tasa_30_dias_record.tasa) : 1;
        const tasa_actual = tasa_actual_record ? Number(tasa_actual_record.tasa) : 1;
        const cambio_30_dias = ((tasa_actual - tasa_30_dias) / tasa_30_dias) * 100;

        let tendencia_moneda: 'alcista' | 'bajista' | 'estable' = 'estable';
        if (cambio_30_dias > 2) tendencia_moneda = 'alcista';
        else if (cambio_30_dias < -2) tendencia_moneda = 'bajista';

        const factor_antiguedad = (antiguedad_dias / 365) * 0.3;
        const factor_tendencia = (cambio_30_dias / 100) * 0.7;
        const prioridad = Math.max(0, Math.min(1, factor_antiguedad + factor_tendencia));

        // Calcular impacto 30 días
        const impacto_30_dias = Number(deuda.montoRecibido) * (cambio_30_dias / 100);

        envejecimiento_deuda.push({
          deuda_id: deuda.id,
          entidad: deuda.entidadPrestamista || 'N/A',
          moneda: deuda.moneda,
          monto: Number(deuda.montoRecibido),
          antiguedad_dias,
          tendencia_moneda,
          prioridad,
          impacto_30_dias,
        });
      }

      // Ordenar por prioridad descendente
      envejecimiento_deuda.sort((a, b) => b.prioridad - a.prioridad);

      return {
        tasa_equilibrio,
        margen_real_vs_nominal,
        diferencial_cambiario_acumulado,
        envejecimiento_deuda,
      };
    } catch (error) {
      console.error("Error en calculate_kpis:", error);
      throw error;
    }
  }

  /**
   * @description Simula el impacto de cambios en tasas de cambio
   * @param tasas_simuladas - Tasas de cambio simuladas por moneda
   * @param fecha_proyeccion - Fecha de proyección
   * @returns Resultados de la simulación con KPIs proyectados
   */
  async simulate_scenario(
    tasas_simuladas: Record<string, number>,
    fecha_proyeccion: string
  ): Promise<SimulateScenarioResponse> {
    // Implementación básica - se expandirá en tarea posterior
    try {
      return {
        costo_reposicion_proyectado: 0,
        perdida_no_realizada_proyectada: 0,
        margen_real_proyectado: 0,
        utilidad_neta_proyectada: 0,
        alertas_generadas: [],
      };
    } catch (error) {
      console.error("Error en simulate_scenario:", error);
      throw error;
    }
  }
}

// Exportar instancia singleton del servicio
export const exchange_intelligence_service = new ExchangeIntelligenceService();
