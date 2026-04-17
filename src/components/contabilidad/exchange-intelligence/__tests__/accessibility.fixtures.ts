/**
 * @description Fixtures reales para pruebas de accesibilidad del módulo de inteligencia cambiaria.
 */
export const costImpactSectionProps = {
  fecha_inicio: '2024-01-01',
  fecha_fin: '2024-01-31',
  categoria_id: undefined,
  almacen_id: undefined,
  vendor_id: undefined,
};

export const costImpactApiFixture = {
  timeline: [
    { fecha: '2024-01-01', costo_historico: 1000, costo_reposicion: 1200 },
    { fecha: '2024-01-02', costo_historico: 1050, costo_reposicion: 1250 },
  ],
  por_producto: [
    {
      producto_id: 'p1',
      nombre: 'Producto A',
      gasto_historico: 1000,
      gasto_reposicion: 1200,
      diferencia_porcentual: 20,
      reposiciones: 1,
      impacto_fx_total: 200,
      stock_actual: 2,
      nivel_reorden: 5,
      precio_venta: 1300,
    },
    {
      producto_id: 'p2',
      nombre: 'Producto B',
      gasto_historico: 1050,
      gasto_reposicion: 1250,
      diferencia_porcentual: 19.05,
      reposiciones: 1,
      impacto_fx_total: 200,
      stock_actual: 1,
      nivel_reorden: 4,
      precio_venta: 1365,
    },
  ],
  detalle_reposiciones: [
    {
      producto_id: 'p1',
      producto_nombre: 'Producto A',
      fecha: '2024-01-01T00:00:00.000Z',
      moneda: 'USD',
      monto_moneda: 50,
      tasa_original: 20,
      tasa_actual: 24,
      gasto_historico_local: 1000,
      gasto_reposicion_local: 1200,
      impacto_fx: 200,
      variacion_porcentual_fx: 20,
    },
    {
      producto_id: 'p2',
      producto_nombre: 'Producto B',
      fecha: '2024-01-02T00:00:00.000Z',
      moneda: 'EUR',
      monto_moneda: 50,
      tasa_original: 21,
      tasa_actual: 25,
      gasto_historico_local: 1050,
      gasto_reposicion_local: 1250,
      impacto_fx: 200,
      variacion_porcentual_fx: 19.05,
    },
  ],
  moneda_principal: 'CUP',
  resumen: {
    incremento_promedio: 15.5,
    productos_afectados: 25,
    alerta_ajuste_precios: true,
  },
};

export const scenarioSimulatorFixture = {
  margen_real_vs_nominal: {
    margen_real: 18.5,
    margen_nominal: 24,
    diferencia_porcentual: -5.5,
  },
  diferencial_cambiario_acumulado: {
    ytd: -1250,
    comparacion_anio_anterior: -7.2,
  },
};

export const kpiApiFixture = {
  tasa_equilibrio: [
    {
      producto_id: 'prod-1',
      nombre: 'Producto A',
      tasa_equilibrio: 265,
      tasa_actual: 250,
      proximidad_porcentaje: 94.3,
      estado: 'advertencia',
    },
    {
      producto_id: 'prod-2',
      nombre: 'Producto B',
      tasa_equilibrio: 280,
      tasa_actual: 240,
      proximidad_porcentaje: 85.7,
      estado: 'estable',
    },
  ],
  margen_real_vs_nominal: {
    margen_real: 18.5,
    margen_nominal: 24,
    diferencia_porcentual: -5.5,
  },
  diferencial_cambiario_acumulado: {
    ytd: -1250,
    comparacion_anio_anterior: -7.2,
  },
};

export const thresholdsFixture = {
  cost_increase_alert: 10,
  debt_exposure_alert: 5,
  spread_alert: 3,
  break_even_warning: 90,
  break_even_critical: 100,
  margin_alert: 15,
  differential_alert: 5,
  currency_trend_alert: 5,
};
