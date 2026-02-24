/**
 * @description Contenedor principal del Dashboard de Inteligencia Cambiaria
 * Integra todos los componentes de análisis y proporciona navegación entre secciones
 * Incluye diseño responsivo para móvil, tablet y desktop
 * @returns Componente del dashboard completo
 */
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { SwipeableTabs } from '@/components/ui/swipeable-tabs';
import { useBreakpoints, useResponsiveColumns } from '@/hooks/use-breakpoints';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Loader2, RefreshCw, Settings, TrendingUp, DollarSign, BarChart3, Target, Sliders, AlertTriangle } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useMemoizedCallback, useDebouncedValue } from '@/lib/utils/component-optimization';

import CostImpactSection from './cost-impact-section';
import DebtExposureSection from './debt-exposure-section';
import PaymentEfficiencySection from './payment-efficiency-section';
import KPIDashboard from './kpi-dashboard';
import { ThresholdConfiguration } from './threshold-configuration';
import { ExportDropdown } from './export-dropdown';
import ScenarioSimulator from './scenario-simulator';
import type { ExportDataType } from './export-dropdown';

import { useGetCostImpactQuery, useGetDebtExposureQuery, useGetPaymentEfficiencyQuery, useGetKPIsQuery } from '@/lib/redux/services/exchangeIntelligenceApi';
import { useGetCategoriasQuery } from '@/lib/redux/services/categoriasApi';
import { useGetAlmacenesQuery } from '@/lib/redux/services/almacenesApi';
import { selectActiveAlerts, selectCriticalAlertsCount, selectWarningAlertsCount } from '@/lib/redux/slices/exchangeIntelligenceSlice';
import { useAppSelector } from '@/lib/redux/hooks';
import type { KPIData } from '@/lib/types/exchange-intelligence';

/**
 * @description Tipos de secciones del dashboard
 */
type DashboardSection = 'overview' | 'cost-impact' | 'debt-exposure' | 'payment-efficiency' | 'kpis' | 'simulator';

/**
 * @description Configuración de tabs
 */
const TABS_CONFIG = [
  { value: 'overview', label: 'Resumen', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'cost-impact', label: 'Costos', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'debt-exposure', label: 'Deudas', icon: <DollarSign className="h-4 w-4" /> },
  { value: 'payment-efficiency', label: 'Pagos', icon: <Target className="h-4 w-4" /> },
  { value: 'kpis', label: 'KPIs', icon: <BarChart3 className="h-4 w-4" /> },
  // { value: 'simulator', label: 'Simulador', icon: <Sliders className="h-4 w-4" /> },
];

/**
 * @description Atajos de teclado disponibles
 */
const KEYBOARD_SHORTCUTS = [
  { key: 'r', action: () => window.location.reload(), description: 'Recargar dashboard' },
  { key: 'f', action: () => document.querySelector<HTMLElement>('input')?.focus(), description: 'Enfocar búsqueda' },
];

/**
 * @description Componente principal del Dashboard de Inteligencia Cambiaria
 */
function ExchangeIntelligenceDashboard(): React.JSX.Element {
  // Hooks de responsive design
  const { isMobile, isTablet, isDesktop, windowWidth } = useBreakpoints();
  const columns = useResponsiveColumns({
    xs: 1,
    sm: 1,
    md: 2,
    lg: 2,
    xl: 3,
    '2xl': 4,
  });

  // Estado para filtros globales
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [selectedSection, setSelectedSection] = useState<DashboardSection>('overview');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [almacenId, setAlmacenId] = useState<string>('');

  // Debounce filter changes to avoid excessive API calls
  const debouncedDateRange = useDebouncedValue(dateRange, 300);
  const debouncedCategoriaId = useDebouncedValue(categoriaId, 300);
  const debouncedAlmacenId = useDebouncedValue(almacenId, 300);

  // Memoize query parameters to prevent unnecessary re-renders
  const costImpactParams = useMemo(() => ({
    fecha_inicio: debouncedDateRange?.from?.toISOString() || '',
    fecha_fin: debouncedDateRange?.to?.toISOString() || '',
    categoria_id: debouncedCategoriaId && debouncedCategoriaId !== 'all' ? debouncedCategoriaId : undefined,
    almacen_id: debouncedAlmacenId && debouncedAlmacenId !== 'all' ? debouncedAlmacenId : undefined,
  }), [debouncedDateRange, debouncedCategoriaId, debouncedAlmacenId]);

  const debtExposureParams = useMemo(() => ({
    fecha_corte: debouncedDateRange?.to?.toISOString(),
  }), [debouncedDateRange]);

  const paymentEfficiencyParams = useMemo(() => ({
    fecha_inicio: debouncedDateRange?.from?.toISOString() || '',
    fecha_fin: debouncedDateRange?.to?.toISOString() || '',
  }), [debouncedDateRange]);

  const kpisParams = useMemo(() => ({
    fecha_inicio: debouncedDateRange?.from?.toISOString() || '',
    fecha_fin: debouncedDateRange?.to?.toISOString() || '',
  }), [debouncedDateRange]);

  // Consultas de datos con filtros
  const { data: costImpactData, isLoading: isLoadingCostImpact, refetch: refetchCostImpact } = useGetCostImpactQuery(costImpactParams);

  const { data: debtExposureData, isLoading: isLoadingDebtExposure, refetch: refetchDebtExposure } = useGetDebtExposureQuery(debtExposureParams);

  const { data: paymentEfficiencyData, isLoading: isLoadingPaymentEfficiency, refetch: refetchPaymentEfficiency } = useGetPaymentEfficiencyQuery(paymentEfficiencyParams);

  const { data: kpisData, isLoading: isLoadingKPIs, refetch: refetchKPIs } = useGetKPIsQuery(kpisParams);

  // Consultas de catálogos
  const { data: categorias } = useGetCategoriasQuery();
  const { data: almacenes } = useGetAlmacenesQuery();

  // Selector de alertas desde Redux
  const activeAlerts = useAppSelector(selectActiveAlerts);
  const criticalAlertsCount = useAppSelector(selectCriticalAlertsCount);
  const warningAlertsCount = useAppSelector(selectWarningAlertsCount);

  // Configurar atajos de teclado
  useKeyboardShortcuts(KEYBOARD_SHORTCUTS);

  // Refrescar todos los datos
  const refresh_all_data = useMemoizedCallback(() => {
    refetchCostImpact();
    refetchDebtExposure();
    refetchPaymentEfficiency();
    refetchKPIs();
  }, [refetchCostImpact, refetchDebtExposure, refetchPaymentEfficiency, refetchKPIs]);

  // Determinar si está cargando
  const isLoading = isLoadingCostImpact || isLoadingDebtExposure || isLoadingPaymentEfficiency || isLoadingKPIs;

  // Mapeo de sección a tipo de datos de exportación
  const exportConfig = useMemo(() => {
    switch (selectedSection) {
      case 'cost-impact':
        return { 
          type: 'cost-impact' as ExportDataType, 
          data: {
            sections: [
              { title: 'Resumen de Impacto', data: costImpactData?.resumen || {} },
              { title: 'Histórico de Impacto', data: costImpactData?.timeline || [] }
            ]
          }, 
          title: 'Reporte de Impacto de Costos' 
        };
      case 'debt-exposure':
        return { 
          type: 'debt-exposure' as ExportDataType, 
          data: {
            sections: [
              { 
                title: 'Resumen de Exposición', 
                data: {
                  deuda_original_local: debtExposureData?.deuda_original_local,
                  deuda_actual_local: debtExposureData?.deuda_actual_local,
                  perdida_no_realizada: debtExposureData?.perdida_no_realizada
                }
              },
              { title: 'Desglose por Moneda', data: debtExposureData?.desglose_por_moneda || [] },
              { title: 'Alertas de Deuda', data: debtExposureData?.alertas || [] }
            ]
          }, 
          title: 'Reporte de Exposición de Deuda' 
        };
      case 'payment-efficiency':
        return { 
          type: 'payment-efficiency' as ExportDataType, 
          data: {
            sections: [
              { 
                title: 'Resumen de Eficiencia', 
                data: {
                  spread_promedio: paymentEfficiencyData?.spread_promedio,
                  mejor_tasa: paymentEfficiencyData?.mejor_tasa,
                  peor_tasa: paymentEfficiencyData?.peor_tasa,
                  recomendacion_renegociacion: paymentEfficiencyData?.recomendacion_renegociacion
                }
              },
              { title: 'Todas las Transacciones', data: paymentEfficiencyData?.transacciones || [] },
              { title: 'Transacciones Críticas (Spread Alto)', data: paymentEfficiencyData?.transacciones_superiores_promedio || [] }
            ]
          }, 
          title: 'Reporte de Eficiencia de Pagos' 
        };
      case 'kpis':
      case 'overview':
        return { 
          type: 'kpis' as ExportDataType, 
          data: {
            sections: [
              { title: 'Tasas de Equilibrio por Producto', data: kpisData?.tasa_equilibrio || [] },
              { 
                title: 'Resumen de Margen Real', 
                data: {
                  margen_nominal: kpisData?.margen_real_vs_nominal?.margen_nominal,
                  margen_real: kpisData?.margen_real_vs_nominal?.margen_real,
                  diferencia_porcentual: kpisData?.margen_real_vs_nominal?.diferencia_porcentual
                }
              },
              { title: 'Tendencia de Márgenes', data: kpisData?.margen_real_vs_nominal?.tendencia_historica || [] },
              { title: 'Diferencial Cambiario Acumulado', data: kpisData?.diferencial_cambiario_acumulado?.desglose_mensual || [] },
              { title: 'Envejecimiento de Deuda y Riesgo', data: kpisData?.envejecimiento_deuda || [] }
            ]
          }, 
          title: 'Reporte de KPIs Cambiarios' 
        };
      default:
        return { 
          type: 'kpis' as ExportDataType, 
          data: kpisData || {}, 
          title: 'Reporte de Inteligencia Cambiaria' 
        };
    }
  }, [selectedSection, costImpactData, debtExposureData, paymentEfficiencyData, kpisData]);

  // Mostrar información de atajos en desktop
  useEffect(() => {
    if (isDesktop && process.env.NODE_ENV === 'development') {
      console.log('Atajos de teclado registrados en Dashboard: R (Recargar), F (Buscar)');
    }
  }, [isDesktop]);

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:p-3 focus:underline focus:ring-2 focus:ring-ring focus:ring-offset-2">
        Saltar al contenido principal
      </a>
      {/* Región para anuncios de estado dinámicos */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcements">
        {isLoading && "Cargando datos del dashboard"}
        {activeAlerts.length > 0 && `Hay ${activeAlerts.length} alertas activas`}
      </div>
      <main id="main-content" className={`
        container mx-auto py-4 md:py-6 space-y-4 md:space-y-6
        ${isMobile ? 'px-2' : 'px-4'}
      `} role="main" aria-labelledby="dashboard-title">
       {/* Header del Dashboard - Adaptable a móvil */}
       <div className={`
         flex flex-col
         ${isDesktop ? 'flex-row justify-between items-start md:items-center gap-4' : 'gap-3'}
       `}>
         <div className={isMobile ? 'space-y-1' : 'space-y-1'}>
           <h1 id="dashboard-title" className={`
             font-bold tracking-tight
             ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}
           `}>
             Dashboard de Inteligencia Cambiaria
           </h1>
           <p className="text-muted-foreground text-xs md:text-sm">
             Análisis integral del impacto cambiario en operaciones financieras
           </p>
           {isDesktop && (
             <p className="text-xs text-muted-foreground mt-1">
               Atajos de teclado: R (recargar), Tab (navegar), Enter (seleccionar sección)
             </p>
           )}
         </div>
        
        {/* Botones de acción - Adaptable a móvil */}
        <div className={`
          flex items-center gap-1 md:gap-2
          ${isMobile ? 'flex-wrap' : ''}
        `}>
          <Button 
            variant="outline" 
            size={isMobile ? 'sm' : 'sm'}
            onClick={refresh_all_data} 
            disabled={isLoading}
            className={isMobile ? 'h-8 px-2' : ''}
            aria-label="Refrescar todos los datos del dashboard"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            <span className={isMobile ? 'hidden sm:inline' : ''}>Refrescar</span>
          </Button>
          <ThresholdConfiguration />
          <ExportDropdown 
            dataType={exportConfig.type}
            data={exportConfig.data as any}
            title={exportConfig.title}
            size={isMobile ? 'sm' : 'sm'}
            className={isMobile ? 'h-8 px-2' : ''}
          />
        </div>
      </div>

      {/* Panel de filtros globales */}
      <Card>
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-sm md:text-lg flex items-center gap-2">
            <Settings className="h-4 w-4 md:h-5 md:w-5" />
            Filtros Globales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`
            grid gap-3 md:gap-4
            ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-4'}
          `}>
            {/* Date Range Picker */}
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-medium">Período de Análisis</label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                className={isMobile ? 'w-full' : 'w-full'}
              />
            </div>
            
            {/* Categoría */}
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-medium">Categoría</label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className={isMobile ? 'h-8 text-xs' : ''} aria-label="Seleccionar categoría">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categorias?.map((cat) => (
                    <SelectItem key={cat.catId} value={cat.catId}>
                      {cat.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Almacén */}
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-medium">Almacén</label>
              <Select value={almacenId} onValueChange={setAlmacenId}>
                <SelectTrigger className={isMobile ? 'h-8 text-xs' : ''} aria-label="Seleccionar almacén">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los almacenes</SelectItem>
                  {almacenes?.map((alm) => (
                    <SelectItem key={alm.almacenId} value={alm.almacenId}>
                      {alm.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Alertas */}
            <div className="space-y-1.5 md:space-y-2">
              <label className="text-xs md:text-sm font-medium">Alertas Activas</label>
              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                {criticalAlertsCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    {criticalAlertsCount} Críticas
                  </Badge>
                )}
                {warningAlertsCount > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {warningAlertsCount} Advertencias
                  </Badge>
                )}
                {criticalAlertsCount === 0 && warningAlertsCount === 0 && (
                  <Badge variant="default" className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    Sin alertas
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel de alertas centralizado */}
      {activeAlerts.length > 0 && (
        <Alert variant="default" className="border-yellow-500 bg-yellow-50">
          <AlertTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            Alertas Activas ({activeAlerts.length})
          </AlertTitle>
          <AlertDescription>
            <div className={`
              grid gap-2 mt-2
              ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}
            `}>
              {activeAlerts.slice(0, isMobile ? 2 : 4).map((alert, index) => (
                <div key={index} className="flex items-center gap-2 text-xs md:text-sm">
                  <Badge variant={
                    alert.severity === 'critical' ? 'destructive' :
                    alert.severity === 'warning' ? 'secondary' : 'outline'
                  }>
                    {alert.severity}
                  </Badge>
                  <span className="truncate">{alert.message}</span>
                </div>
              ))}
            </div>
            {activeAlerts.length > (isMobile ? 2 : 4) && (
              <p className="text-xs md:text-sm mt-2 text-muted-foreground">
                +{activeAlerts.length - (isMobile ? 2 : 4)} alertas adicionales
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Sistema de navegación por tabs */}
      {isMobile ? (
        // En móvil, usar tabs deslizables
        <SwipeableTabs
          tabs={TABS_CONFIG}
          value={selectedSection}
          onValueChange={(value) => setSelectedSection(value as DashboardSection)}
          className="border-b"
        />
      ) : (
        // En tablet/desktop, usar tabs regulares
        <div className="border rounded-lg">
          <div className={`
            grid gap-1 p-1
            ${isTablet ? 'grid-cols-2' : 'grid-cols-5'}
          `}>
            {TABS_CONFIG.map((tab) => (
              <button
                key={tab.value}
                id={`tab-${tab.value}`}
                role="tab"
                aria-controls={`panel-${tab.value}`}
                aria-selected={selectedSection === tab.value}
                onClick={() => setSelectedSection(tab.value as DashboardSection)}
                className={`
                  flex items-center justify-center gap-1.5 md:gap-2 px-2 py-1.5 md:py-2 rounded-md text-sm font-medium
                  transition-all duration-200
                  ${selectedSection === tab.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                {tab.icon}
                <span className={isTablet ? 'hidden md:inline' : ''}>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contenido de tabs */}
      <div className="mt-4">
        {/* Contenido del Tab de Resumen */}
        {selectedSection === 'overview' && (
          <div
            id="panel-overview"
            role="tabpanel"
            aria-labelledby="tab-overview"
            className={`
            grid gap-4 md:gap-6
            ${isMobile ? 'grid-cols-1' : columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}
          `}>
            {/* Tarjeta de resumen de costos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                  Impacto en Costos
                </CardTitle>
                <CardDescription className="text-xs">
                  Resumen del período seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costImpactData ? (
                  <div className="space-y-3">
                    <div className={`
                      grid gap-3
                      ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}
                    `}>
                      <div className="text-center">
                        <div className={`
                          font-bold
                          ${costImpactData.resumen.incremento_promedio > 10 ? 'text-red-600' : 'text-green-600'}
                          ${isMobile ? 'text-xl' : 'text-2xl'}
                        `}>
                          {costImpactData.resumen.incremento_promedio.toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Incremento Promedio</div>
                      </div>
                      <div className="text-center">
                        <div className={`
                          font-bold text-blue-600
                          ${isMobile ? 'text-xl' : 'text-2xl'}
                        `}>
                          {costImpactData.resumen.productos_afectados}
                        </div>
                        <div className="text-xs text-muted-foreground">Productos Afectados</div>
                      </div>
                    </div>
                    {costImpactData.resumen.alerta_ajuste_precios && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Incremento significativo detectado
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
                )}
              </CardContent>
            </Card>

            {/* Tarjeta de resumen de deudas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
                  Exposición de Deuda
                </CardTitle>
                <CardDescription className="text-xs">
                  Resumen de riesgos cambiarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                {debtExposureData ? (
                  <div className="space-y-3">
                    <div className={`
                      grid gap-3
                      ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}
                    `}>
                      <div className="text-center">
                        <div className={`
                          font-bold text-blue-600
                          ${isMobile ? 'text-lg' : 'text-2xl'}
                        `}>
                          ${debtExposureData.deuda_original_local.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Deuda Original</div>
                      </div>
                      <div className="text-center">
                        <div className={`
                          font-bold
                          ${debtExposureData.perdida_no_realizada > 0 ? 'text-red-600' : 'text-green-600'}
                          ${isMobile ? 'text-lg' : 'text-2xl'}
                        `}>
                          ${Math.abs(debtExposureData.perdida_no_realizada).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {debtExposureData.perdida_no_realizada > 0 ? 'Pérdida' : 'Ganancia'}
                        </div>
                      </div>
                    </div>
                    {debtExposureData.alertas.length > 0 && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {debtExposureData.alertas[0].mensaje}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
                )}
              </CardContent>
            </Card>

            {/* Tarjeta de resumen de eficiencia de pagos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <Target className="h-4 w-4 md:h-5 md:w-5" />
                  Eficiencia de Pagos
                </CardTitle>
                <CardDescription className="text-xs">
                  Análisis de spreads bancarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentEfficiencyData ? (
                  <div className="space-y-3">
                    <div className={`
                      grid gap-3
                      ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}
                    `}>
                      <div className="text-center">
                        <div className={`
                          font-bold
                          ${paymentEfficiencyData.spread_promedio > 3 ? 'text-red-600' : 'text-green-600'}
                          ${isMobile ? 'text-xl' : 'text-2xl'}
                        `}>
                          {paymentEfficiencyData.spread_promedio.toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Spread Promedio</div>
                      </div>
                      <div className="text-center">
                        <div className={`
                          font-bold text-blue-600
                          ${isMobile ? 'text-xl' : 'text-2xl'}
                        `}>
                          {paymentEfficiencyData.transacciones.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Transacciones</div>
                      </div>
                    </div>
                    {paymentEfficiencyData.recomendacion_renegociacion && (
                      <Alert variant="destructive" className="py-2">
                        <Target className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Spread promedio alto. Considere renegociar tasas.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
                )}
              </CardContent>
            </Card>

            {/* Tarjeta de resumen de KPIs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
                  Indicadores Clave
                </CardTitle>
                <CardDescription className="text-xs">
                  Resumen de KPIs críticos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {kpisData ? (
                  <div className="space-y-3">
                    <div className={`
                      grid gap-3
                      ${isMobile ? 'grid-cols-2' : 'grid-cols-2'}
                    `}>
                      <div className="text-center">
                        <div className={`
                          font-bold text-blue-600
                          ${isMobile ? 'text-xl' : 'text-2xl'}
                        `}>
                          {kpisData.tasa_equilibrio.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Productos en Equilibrio</div>
                      </div>
                      <div className="text-center">
                        <div className={`
                          font-bold text-orange-600
                          ${isMobile ? 'text-xl' : 'text-2xl'}
                        `}>
                          {kpisData.envejecimiento_deuda.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Deudas Activas</div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      {kpisData.tasa_equilibrio.slice(0, isMobile ? 2 : 3).map((producto) => (
                        <div key={producto.producto_id} className="flex justify-between items-center text-xs">
                          <span className="truncate max-w-[120px] md:max-w-none">{producto.nombre}</span>
                          <Badge variant={
                            producto.estado === 'critico' ? 'destructive' :
                            producto.estado === 'advertencia' ? 'secondary' : 'default'
                          } className="text-[10px] md:text-xs">
                            {producto.estado}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No hay datos disponibles</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contenido del Tab de Impacto en Costos */}
        {selectedSection === 'cost-impact' && (
          <div
            id="panel-cost-impact"
            role="tabpanel"
            aria-labelledby="tab-cost-impact"
          >
            {isLoadingCostImpact ? (
              <div className="flex items-center justify-center h-48 md:h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <CostImpactSection
                fecha_inicio={dateRange?.from?.toISOString() || ''}
                fecha_fin={dateRange?.to?.toISOString() || ''}
                categoria_id={categoriaId || undefined}
                almacen_id={almacenId || undefined}
              />
            )}
          </div>
        )}

        {/* Contenido del Tab de Exposición de Deuda */}
        {selectedSection === 'debt-exposure' && (
          <div
            id="panel-debt-exposure"
            role="tabpanel"
            aria-labelledby="tab-debt-exposure"
          >
            {isLoadingDebtExposure ? (
              <div className="flex items-center justify-center h-48 md:h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <DebtExposureSection
                fecha_corte={dateRange?.to?.toISOString()}
              />
            )}
          </div>
        )}

        {/* Contenido del Tab de Eficiencia de Pagos */}
        {selectedSection === 'payment-efficiency' && (
          <div
            id="panel-payment-efficiency"
            role="tabpanel"
            aria-labelledby="tab-payment-efficiency"
          >
            {isLoadingPaymentEfficiency ? (
              <div className="flex items-center justify-center h-48 md:h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <PaymentEfficiencySection
                fecha_inicio={dateRange?.from?.toISOString() || ''}
                fecha_fin={dateRange?.to?.toISOString() || ''}
              />
            )}
          </div>
        )}

        {/* Contenido del Tab de KPIs */}
        {selectedSection === 'kpis' && (
          <div
            id="panel-kpis"
            role="tabpanel"
            aria-labelledby="tab-kpis"
          >
            {isLoadingKPIs ? (
              <div className="flex items-center justify-center h-48 md:h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <KPIDashboard
                fecha_inicio={dateRange?.from?.toISOString() || ''}
                fecha_fin={dateRange?.to?.toISOString() || ''}
              />
            )}
          </div>
        )}

        {/* Contenido del Tab de Simulador */}
        {/* {selectedSection === 'simulator' && (
          <div
            id="panel-simulator"
            role="tabpanel"
            aria-labelledby="tab-simulator"
          >
            <ScenarioSimulator
              datos_actuales={kpisData ? ({
                tasa_equilibrio: {
                  productos: kpisData.tasa_equilibrio
                },
                margen_real_vs_nominal: kpisData.margen_real_vs_nominal,
                diferencial_cambiario_acumulado: kpisData.diferencial_cambiario_acumulado,
                envejecimiento_deuda: kpisData.envejecimiento_deuda
              } as KPIData) : undefined}
            />
          </div>
        )} */}
      </div>

      {/* Indicador de tamaño de pantalla (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
          {isMobile ? 'MÓVIL' : isTablet ? 'TABLET' : 'DESKTOP'} - {windowWidth}px
        </div>
      )}
    </main>
    </>
  );
}

export default ExchangeIntelligenceDashboard;
