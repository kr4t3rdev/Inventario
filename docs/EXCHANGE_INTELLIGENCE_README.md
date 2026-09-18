# Dashboard de Inteligencia Cambiaria

## Descripción General

El Dashboard de Inteligencia Cambiaria es un sistema integral de análisis financiero que proporciona insights avanzados sobre el impacto de las fluctuaciones cambiarias en las operaciones empresariales. Desarrollado con tecnologías modernas de frontend y backend, ofrece una interfaz intuitiva y potente para la toma de decisiones estratégicas.

## Arquitectura del Sistema

### Componentes Principales

#### 1. Dashboard Principal (`ExchangeIntelligenceDashboard`)
- **Ubicación**: `src/components/contabilidad/exchange-intelligence/exchange-intelligence-dashboard.tsx`
- **Función**: Contenedor principal que integra todos los componentes de análisis
- **Características**:
  - Diseño responsivo (móvil, tablet, desktop)
  - Sistema de navegación por tabs
  - Gestión de filtros globales
  - Panel de alertas centralizado

#### 2. Servicios Backend (`ExchangeIntelligenceService`)
- **Ubicación**: `src/lib/services/exchange_intelligence_service.ts`
- **Funciones**:
  - `calculate_cost_impact()`: Análisis de impacto en costos de inventario
  - `calculate_debt_exposure()`: Exposición de deuda cambiaria
  - `calculate_payment_efficiency()`: Eficiencia de pagos transfronterizos

#### 3. Funciones de KPIs (`exchange_intelligence_kpis.ts`)
- **Ubicación**: `src/lib/services/exchange_intelligence_kpis.ts`
- **Funciones**:
  - `calculate_break_even_rate()`: Cálculo de tasa de equilibrio
  - `calculate_real_margin()`: Márgenes reales vs nominales
  - `calculate_debt_priority_score()`: Priorización de deudas
  - `classify_currency_trend()`: Clasificación de tendencias

### APIs y Endpoints

#### Endpoints Implementados
- `GET /api/contabilidad/exchange/cost-impact`
- `GET /api/contabilidad/exchange/debt-exposure`
- `GET /api/contabilidad/exchange/payment-efficiency`
- `GET /api/contabilidad/exchange/kpis`
- `POST /api/contabilidad/exchange/simulate-scenario`

#### Historial y Reportes
- `GET /api/contabilidad/exchange/alert-history`
- `POST /api/contabilidad/exchange/alert-history`
- `GET /api/contabilidad/exchange/report-history`
- `POST /api/contabilidad/exchange/report-history`

### Estado y Gestión de Datos

#### Redux Slice
- **Ubicación**: `src/lib/redux/slices/exchangeIntelligenceSlice.ts`
- **Estado**: Alertas activas, configuración de umbrales, filtros aplicados

#### RTK Query
- **Ubicación**: `src/lib/redux/services/exchangeIntelligenceApi.ts`
- **Queries**: getCostImpact, getDebtExposure, getPaymentEfficiency, getKPIs
- **Mutations**: simulateScenario

## Funcionalidades Implementadas

### 1. Análisis de Impacto en Costos
- **Propósito**: Evaluar cómo las fluctuaciones cambiarias afectan los costos de reposición de inventario
- **Métricas**: Incremento promedio, productos afectados, alerta de ajuste de precios
- **Visualización**: Gráfico de línea comparativo (costo histórico vs reposición)

### 2. Exposición de Deuda Cambiaria
- **Propósito**: Analizar riesgos asociados a deudas denominadas en monedas extranjeras
- **Métricas**: Deuda original/local, pérdida no realizada, antigüedad promedio
- **Visualización**: Gráfico de barras comparativo y tabla de desglose por moneda

### 3. Eficiencia de Pagos
- **Propósito**: Evaluar la eficiencia de transacciones transfronterizas
- **Métricas**: Spread bancario promedio, transacciones analizadas
- **Visualización**: Tabla comparativa de tasas oficiales vs reales

### 4. Indicadores Clave de Performance (KPIs)
- **Tasa de Equilibrio**: Punto donde precio de venta cubre costos en moneda extranjera
- **Margen Real vs Nominal**: Impacto real de fluctuaciones en rentabilidad
- **Diferencial Cambiario**: Acumulador de diferencias cambiarias del período
- **Envejecimiento de Deuda**: Priorización de deudas por riesgo cambiario

### 5. Simulador de Escenarios
- **Propósito**: Proyectar impacto de cambios hipotéticos en tasas de cambio
- **Funcionalidad**: Sliders interactivos, escenarios predefinidos, guardado de escenarios
- **Resultados**: KPIs recalculados, alertas generadas

## Características Avanzadas

### Sistema de Alertas
- **Umbrales configurables**: Incremento de costos >10%, pérdida no realizada >5%
- **Severidad**: Crítica, advertencia, información
- **Historial**: Registro completo de alertas activas e históricas

### Exportación y Reportes
- **Formatos**: PDF, CSV, Excel
- **Contenido**: Todos los KPIs, gráficos, alertas activas
- **Programación**: Reportes automáticos semanales/mensuales

### Configuración Personalizable
- **Umbrales**: Ajustables por usuario
- **Monedas**: Soporte multi-moneda
- **Períodos**: Análisis flexible por fechas

### Accesibilidad
- **WCAG 2.1**: Cumplimiento de estándares de accesibilidad
- **Navegación por teclado**: Completa en todos los componentes
- **Lectores de pantalla**: Etiquetas ARIA descriptivas
- **Contraste de colores**: Colores accesibles con buen contraste

## Testing

### Estrategia de Testing
- **Property-based Testing**: Validación de propiedades matemáticas con fast-check
- **Unit Tests**: Funciones individuales y componentes
- **Integration Tests**: APIs y flujos completos
- **Accessibility Tests**: Cumplimiento de estándares WCAG

### Cobertura de Tests
- **Property Tests**: 18 propiedades principales validadas
- **Unit Tests**: Funciones de cálculo y componentes
- **API Tests**: Endpoints REST con diferentes escenarios
- **E2E Tests**: Flujos completos de usuario

## Performance

### Optimizaciones Implementadas
- **Lazy Loading**: Componentes cargados bajo demanda
- **Memoización**: Cálculos costosos cacheados con useMemo
- **Virtualización**: Tablas grandes con scroll virtual
- **Code Splitting**: División de bundles por rutas

### Métricas de Performance
- **Tiempo de carga inicial**: <3 segundos
- **Tiempo de recálculo de KPIs**: <500ms
- **Uso de memoria**: Optimizado para datasets grandes

## Seguridad

### Medidas Implementadas
- **Validación de entrada**: En frontend y backend
- **Sanitización**: Prevención de XSS y inyección
- **Autenticación**: JWT tokens requeridos
- **Autorización**: Control de acceso basado en roles

## Deployment y Monitoreo

### Variables de Entorno
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

### Monitoreo
- **Logging**: Winston para registro estructurado
- **Métricas**: Prometheus para métricas de sistema
- **Alertas**: Configuración de alertas para errores y performance
- **Health Checks**: Endpoints de verificación de salud

## Guía de Uso

### Para Usuarios Finales

#### Navegación Básica
1. Accede al tab "Exchange" en la página de Reportes y Analytics
2. Selecciona el período de análisis usando el DateRangePicker
3. Aplica filtros por categoría, almacén o proveedor si es necesario
4. Navega entre las diferentes secciones usando los tabs

#### Interpretación de KPIs
- **Tasa de Equilibrio**: Valores por encima de 100% indican vulnerabilidad
- **Margen Real**: Diferencias negativas indican impacto cambiario adverso
- **Diferencial Cambiario**: Valores positivos representan ganancias por fluctuaciones

#### Uso del Simulador
1. Haz clic en el tab "Simulador"
2. Ajusta las tasas usando los sliders o botones predefinidos
3. Observa el impacto en tiempo real en todos los KPIs
4. Guarda escenarios importantes para referencia futura

### Para Desarrolladores

#### Agregar Nuevos KPIs
1. Implementar función de cálculo en `exchange_intelligence_kpis.ts`
2. Agregar endpoint en `exchangeIntelligenceApi.ts`
3. Crear componente de visualización
4. Agregar al dashboard principal

#### Testing
```bash
# Ejecutar todos los tests
pnpm test

# Ejecutar solo tests de propiedad
pnpm test -- --grep "Property Tests"

# Ejecutar tests de accesibilidad
pnpm test accessibility.test.tsx
```

## Troubleshooting

### Problemas Comunes

#### Error de carga de datos
- Verificar conexión a base de datos
- Revisar logs del servidor para errores de API
- Confirmar permisos de usuario

#### Gráficos no se renderizan
- Verificar que Recharts esté instalado correctamente
- Revisar datos de entrada para valores NaN o undefined
- Confirmar que el contenedor tiene dimensiones definidas

#### Alertas no aparecen
- Verificar configuración de umbrales
- Confirmar que los cálculos de KPIs sean correctos
- Revisar logs para errores en la generación de alertas

### Logs y Debugging

#### Niveles de Log
- `ERROR`: Errores críticos que requieren atención inmediata
- `WARN`: Advertencias que pueden afectar funcionalidad
- `INFO`: Información general de operaciones
- `DEBUG`: Detalles técnicos para desarrollo

#### Ubicación de Logs
- **Desarrollo**: Consola del navegador y terminal
- **Producción**: Archivos en `/logs/` y servicios de monitoreo

## Soporte y Mantenimiento

### Contactos
- **Equipo de Desarrollo**: dev@empresa.com
- **Soporte Técnico**: support@empresa.com
- **Documentación**: https://docs.empresa.com/exchange-intelligence

### Versionado
- **Versión Actual**: 1.0.0
- **Última Actualización**: Enero 2026
- **Próxima Versión**: 1.1.0 (febrero 2026)

---

*Esta documentación se mantiene actualizada con cada release. Para contribuciones o correcciones, por favor contactar al equipo de desarrollo.*