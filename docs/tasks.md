# Implementation Plan: Dashboard de Inteligencia Cambiaria

## Overview

Este plan de implementación transforma el diseño del Dashboard de Inteligencia Cambiaria en tareas incrementales de desarrollo. El enfoque es construir primero la infraestructura backend (APIs y servicios), luego los componentes frontend core, seguido por características avanzadas, y finalmente integración y pulido. Cada tarea construye sobre las anteriores y termina con código integrado y funcional.

## Tasks

- [x] 1. Configurar infraestructura base y tipos TypeScript
  - Crear tipos e interfaces para todas las estructuras de datos del dashboard
  - Definir tipos para requests y responses de APIs
  - Crear tipos para estados de Redux
  - Configurar fast-check para property-based testing
  - _Requirements: Todos los requerimientos (tipos base)_

- [-] 2. Implementar servicio de cálculo de impacto en costos
  - [x] 2.1 Crear ExchangeIntelligenceService con método calculate_cost_impact
    - Implementar algoritmo de cálculo de costo histórico
    - Implementar algoritmo de cálculo de costo de reposición
    - Calcular diferencia porcentual
    - Manejar casos edge (inventario vacío, tasas faltantes)
    - _Requirements: 1.2, 1.3, 1.6_

  - [x] 2.2 Escribir property test para cálculo de impacto en costos
    - **Property 1: Cost Impact Calculation Accuracy**
    - **Validates: Requirements 1.2, 1.3, 1.6**

  - [ ]* 2.3 Escribir unit tests para casos edge de impacto en costos
    - Test con inventario vacío
    - Test con tasas de cambio faltantes
    - Test con productos sin historial de compra
    - _Requirements: 1.2, 1.3, 1.6_

- [ ] 3. Implementar API endpoint para impacto en costos
  - [ ] 3.1 Crear GET /api/contabilidad/exchange/cost-impact
    - Validar parámetros de entrada (fechas, filtros)
    - Obtener datos de productos y compras desde Prisma
    - Obtener tasas de cambio actuales
    - Llamar a calculate_cost_impact del servicio
    - Generar alerta si diferencia > 10%
    - Retornar respuesta con timeline y resumen
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [ ]* 3.2 Escribir integration tests para endpoint de impacto en costos
    - Test con diferentes rangos de fechas
    - Test con filtros aplicados
    - Test de generación de alertas
    - _Requirements: 1.1, 1.4_

- [ ] 4. Checkpoint - Verificar cálculos de impacto en costos
  - Asegurar que todos los tests pasen
  - Verificar que el endpoint retorna datos correctos
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [ ] 5. Implementar servicio de análisis de exposición de deuda
  - [ ] 5.1 Crear método calculate_debt_exposure en ExchangeIntelligenceService
    - Implementar cálculo de deuda original en moneda local
    - Implementar cálculo de deuda actual con tasas vigentes
    - Calcular pérdida no realizada
    - Generar desglose por moneda
    - Calcular antigüedad de cada deuda
    - Determinar tendencia de cada moneda (últimos 30 días)
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.7_

  - [ ]* 5.2 Escribir property test para cálculo de exposición de deuda
    - **Property 2: Debt Exposure Calculation Accuracy**
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [ ]* 5.3 Escribir unit tests para casos edge de exposición de deuda
    - Test sin deudas
    - Test con deudas en una sola moneda
    - Test con tasas históricas faltantes
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 6. Implementar API endpoint para exposición de deuda
  - [ ] 6.1 Crear GET /api/contabilidad/exchange/debt-exposure
    - Validar fecha de corte
    - Obtener deudas desde InyeccionCapital con estado ACTIVA
    - Obtener tasas de cambio históricas y actuales
    - Llamar a calculate_debt_exposure del servicio
    - Generar alertas si pérdida no realizada > 5%
    - Retornar respuesta con desglose y alertas
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 6.2 Escribir integration tests para endpoint de exposición de deuda
    - Test con diferentes fechas de corte
    - Test de generación de alertas
    - Test con múltiples monedas
    - _Requirements: 2.1, 2.5_


- [ ] 7. Implementar servicio de eficiencia de pagos
  - [ ] 7.1 Crear método calculate_payment_efficiency en ExchangeIntelligenceService
    - Obtener transacciones de cambio del período
    - Obtener tasas oficiales del mercado para cada fecha
    - Calcular spread bancario para cada transacción
    - Calcular spread promedio ponderado por volumen
    - Identificar transacciones con spread superior al promedio
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 7.2 Escribir property test para cálculo de eficiencia de pagos
    - **Property 3: Payment Efficiency Calculation Accuracy**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [ ]* 7.3 Escribir unit tests para casos edge de eficiencia de pagos
    - Test sin transacciones
    - Test con tasas oficiales faltantes
    - Test con spread negativo
    - _Requirements: 3.2, 3.3, 3.4_

- [ ] 8. Implementar API endpoint para eficiencia de pagos
  - [ ] 8.1 Crear GET /api/contabilidad/exchange/payment-efficiency
    - Validar parámetros (fechas, moneda opcional)
    - Obtener transacciones de MovimientoBancario
    - Obtener tasas oficiales de fuente externa o TasaCambio
    - Llamar a calculate_payment_efficiency del servicio
    - Generar recomendación si spread promedio > 3%
    - Retornar respuesta con transacciones y métricas
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 8.2 Escribir integration tests para endpoint de eficiencia de pagos
    - Test con filtro por moneda
    - Test de generación de recomendación
    - Test con diferentes períodos
    - _Requirements: 3.1, 3.7_

- [ ] 9. Checkpoint - Verificar servicios de análisis backend
  - Asegurar que todos los tests de servicios pasen
  - Verificar que los 3 endpoints principales funcionan correctamente
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [ ] 10. Implementar cálculos de KPIs
  - [ ] 10.1 Implementar cálculo de Tasa de Equilibrio
    - Crear función calculate_break_even_rate
    - Manejar división por cero
    - Calcular para todos los productos
    - Comparar con tasa actual
    - Clasificar productos por proximidad (seguro/advertencia/crítico)
    - _Requirements: 4.1, 4.3_

  - [ ]* 10.2 Escribir property test para tasa de equilibrio
    - **Property 4: Break-Even Exchange Rate Calculation**
    - **Validates: Requirements 4.1, 4.3**

  - [ ] 10.3 Implementar cálculo de Margen Real vs Nominal
    - Crear función calculate_real_margin
    - Calcular margen nominal (precio - costo original)
    - Ajustar costo por tasa actual
    - Calcular margen real (precio - costo ajustado)
    - Calcular diferencia porcentual
    - Generar tendencia histórica
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ]* 10.4 Escribir property test para cálculo de márgenes
    - **Property 5: Margin Calculation Accuracy**
    - **Validates: Requirements 5.1, 5.2, 5.4**

  - [ ] 10.5 Implementar cálculo de Diferencial Cambiario Acumulado
    - Crear función calculate_exchange_differential
    - Calcular diferencial para cada transacción
    - Acumular diferencial del año fiscal
    - Generar desglose mensual
    - Comparar con año anterior
    - _Requirements: 6.1, 6.4, 6.6_

  - [ ]* 10.6 Escribir property test para diferencial cambiario
    - **Property 6: Exchange Differential Accumulation**
    - **Validates: Requirements 6.1, 6.4, 6.6**

  - [ ] 10.7 Implementar cálculo de Envejecimiento de Deuda
    - Crear función calculate_debt_priority
    - Calcular antigüedad en días
    - Calcular tendencia de moneda (30 días)
    - Calcular score de prioridad
    - Ordenar deudas por prioridad
    - Calcular impacto de pagar hoy vs 30 días
    - _Requirements: 7.1, 7.2, 7.4, 7.6_

  - [ ]* 10.8 Escribir property test para priorización de deuda
    - **Property 7: Debt Aging and Priority Calculation**
    - **Validates: Requirements 7.1, 7.2, 7.4**

- [ ] 11. Implementar API endpoint para KPIs
  - [ ] 11.1 Crear GET /api/contabilidad/exchange/kpis
    - Validar parámetros de entrada
    - Calcular tasa de equilibrio para todos los productos
    - Calcular márgenes real y nominal
    - Calcular diferencial cambiario acumulado
    - Calcular priorización de deudas
    - Agregar todos los KPIs en respuesta unificada
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.4, 6.6, 7.1, 7.2, 7.3, 7.4, 7.6_

  - [ ]* 11.2 Escribir integration tests para endpoint de KPIs
    - Test de cálculo completo de KPIs
    - Test con diferentes períodos
    - Test de consistencia entre KPIs
    - _Requirements: 4.2, 5.3, 6.2, 7.3_

- [ ] 12. Implementar sistema de alertas
  - [ ] 12.1 Crear servicio de generación de alertas
    - Implementar función generate_alerts
    - Evaluar umbral de incremento de costos (>10%)
    - Evaluar umbral de pérdida no realizada (>5%)
    - Evaluar umbral de spread bancario (>3%)
    - Evaluar proximidad a tasa de equilibrio (90% y 100%)
    - Evaluar diferencia de márgenes (>15%)
    - Evaluar diferencial cambiario (>5% de ingresos)
    - Evaluar deudas con tendencia alcista (>5% mensual)
    - Asignar severidad a cada alerta
    - _Requirements: 1.4, 2.5, 3.7, 4.4, 4.5, 5.5, 6.5, 7.7, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 12.2 Escribir property test para generación de alertas
    - **Property 9: Alert Generation Thresholds**
    - **Validates: Requirements 1.4, 2.5, 3.7, 4.4, 4.5, 5.5, 6.5, 7.7, 9.1, 9.2, 9.3, 9.4**

  - [ ]* 12.3 Escribir unit tests para casos edge de alertas
    - Test con valores exactamente en umbral
    - Test con múltiples alertas simultáneas
    - Test con umbrales personalizados
    - _Requirements: 9.6_

- [ ] 13. Checkpoint - Verificar cálculos de KPIs y alertas
  - Asegurar que todos los tests de KPIs pasen
  - Verificar que las alertas se generan correctamente
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [ ] 14. Implementar simulador de escenarios
  - [ ] 14.1 Crear POST /api/contabilidad/exchange/simulate-scenario
    - Validar tasas simuladas
    - Recalcular costo de reposición con tasas simuladas
    - Recalcular pérdida no realizada con tasas simuladas
    - Recalcular margen real con tasas simuladas
    - Calcular utilidad neta proyectada
    - Generar alertas basadas en escenario simulado
    - Retornar resultados de simulación
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 14.2 Escribir property test para simulación de escenarios
    - **Property 8: Scenario Simulation Consistency**
    - **Validates: Requirements 8.2, 8.3, 8.5**

  - [ ]* 14.3 Escribir unit tests para simulador
    - Test con escenarios predefinidos (+10%, -10%)
    - Test con múltiples monedas
    - Test de consistencia de cálculos
    - _Requirements: 8.7_

- [ ] 15. Implementar Redux slice para Exchange Intelligence
  - [ ] 15.1 Crear exchangeIntelligenceSlice
    - Definir estado inicial con todas las secciones
    - Crear reducers para actualizar cada sección
    - Crear reducers para loading states
    - Crear reducers para error states
    - Crear reducers para filtros
    - Crear reducers para umbrales personalizados
    - _Requirements: Todos (state management)_

  - [ ] 15.2 Crear RTK Query endpoints
    - Definir getCostImpact query
    - Definir getDebtExposure query
    - Definir getPaymentEfficiency query
    - Definir getKPIs query
    - Definir simulateScenario mutation
    - Configurar cache tags y invalidación
    - _Requirements: Todos (data fetching)_


- [ ] 16. Implementar componente CostImpactSection
  - [ ] 16.1 Crear componente CostImpactSection
    - Implementar estructura del componente con TypeScript
    - Integrar con Redux para obtener datos
    - Crear gráfico de línea de tiempo con Recharts
    - Implementar línea azul (costo histórico)
    - Implementar línea roja (costo de reposición)
    - Agregar tooltips interactivos en hover
    - Mostrar alerta cuando diferencia > 10%
    - Implementar filtros (categoría, almacén, proveedor)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 16.2 Escribir tests de componente para CostImpactSection
    - Test de renderizado con datos
    - Test de renderizado sin datos
    - Test de aplicación de filtros
    - Test de visualización de alerta
    - _Requirements: 1.1, 1.4, 1.5_

- [ ] 17. Implementar componente DebtExposureSection
  - [ ] 17.1 Crear componente DebtExposureSection
    - Implementar estructura del componente
    - Integrar con Redux para obtener datos
    - Crear gráfico de barras comparativo con Recharts
    - Implementar Barra 1 (deuda original)
    - Implementar Barra 2 (deuda actual)
    - Destacar pérdida no realizada
    - Mostrar alerta cuando pérdida > 5%
    - Crear tabla de desglose por moneda
    - Mostrar antigüedad de cada deuda
    - Implementar selección de deuda para ver detalle
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 17.2 Escribir tests de componente para DebtExposureSection
    - Test de renderizado con deudas
    - Test de renderizado sin deudas
    - Test de visualización de alerta
    - Test de selección de deuda
    - _Requirements: 2.1, 2.5, 2.8_

- [ ] 18. Implementar componente PaymentEfficiencySection
  - [ ] 18.1 Crear componente PaymentEfficiencySection
    - Implementar estructura del componente
    - Integrar con Redux para obtener datos
    - Crear tabla comparativa de tasas
    - Mostrar tasa oficial vs tasa real
    - Calcular y mostrar spread bancario
    - Destacar spread promedio ponderado
    - Resaltar transacciones con spread superior al promedio
    - Mostrar recomendación cuando spread > 3%
    - Implementar filtro por moneda
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 18.2 Escribir tests de componente para PaymentEfficiencySection
    - Test de renderizado con transacciones
    - Test de renderizado sin transacciones
    - Test de filtro por moneda
    - Test de visualización de recomendación
    - _Requirements: 3.1, 3.7_

- [ ] 19. Checkpoint - Verificar componentes de análisis
  - Asegurar que los 3 componentes principales renderizan correctamente
  - Verificar integración con Redux
  - Verificar que los gráficos muestran datos correctos
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [ ] 20. Implementar componente KPIDashboard
  - [ ] 20.1 Crear componente KPIDashboard
    - Implementar estructura del componente
    - Integrar con Redux para obtener KPIs
    - Crear tarjeta para Tasa de Equilibrio
    - Mostrar productos vulnerables
    - Implementar filtro por proximidad
    - Crear tarjeta para Margen Real vs Nominal
    - Mostrar gráfico de tendencia histórica
    - Crear tarjeta para Diferencial Cambiario Acumulado
    - Mostrar desglose mensual
    - Mostrar comparación con año anterior
    - Crear tarjeta para Envejecimiento de Deuda
    - Mostrar tabla de deudas priorizadas
    - Resaltar deudas en monedas con tendencia alcista
    - Implementar código de colores (verde/rojo)
    - _Requirements: 4.2, 4.3, 4.6, 4.7, 5.3, 5.4, 5.6, 5.7, 6.2, 6.3, 6.4, 6.6, 7.3, 7.5, 7.6_

  - [ ]* 20.2 Escribir tests de componente para KPIDashboard
    - Test de renderizado de todos los KPIs
    - Test de código de colores
    - Test de filtros
    - _Requirements: 4.2, 5.3, 6.2, 6.3, 7.3_

- [ ] 21. Implementar componente ScenarioSimulator
  - [ ] 21.1 Crear componente ScenarioSimulator
    - Implementar estructura del componente
    - Crear sliders para ajustar tasas de cambio
    - Implementar actualización en tiempo real de KPIs
    - Crear gráfico de utilidad neta proyectada
    - Permitir simulación de múltiples monedas
    - Mostrar impacto en todos los KPIs afectados
    - Implementar botón para guardar escenario
    - Crear botones para escenarios predefinidos
    - Implementar debounce para cálculos (300ms)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 21.2 Escribir tests de componente para ScenarioSimulator
    - Test de actualización de sliders
    - Test de recálculo de KPIs
    - Test de escenarios predefinidos
    - Test de guardado de escenarios
    - _Requirements: 8.1, 8.2, 8.6, 8.7_

- [ ] 22. Implementar componente ExchangeIntelligenceDashboard (contenedor principal)
  - [ ] 22.1 Crear componente ExchangeIntelligenceDashboard
    - Implementar estructura del contenedor
    - Integrar todos los sub-componentes
    - Implementar sistema de tabs/secciones
    - Crear panel de filtros globales
    - Implementar DateRangePicker
    - Crear panel de alertas centralizado
    - Mostrar alertas con indicadores de prioridad
    - Implementar navegación entre secciones
    - Agregar loading states
    - Agregar empty states
    - _Requirements: Todos (integración)_

  - [ ]* 22.2 Escribir tests de integración para dashboard completo
    - Test de navegación entre secciones
    - Test de aplicación de filtros globales
    - Test de visualización de alertas
    - _Requirements: 9.5_

- [ ] 23. Checkpoint - Verificar dashboard completo
  - Asegurar que todos los componentes están integrados
  - Verificar que la navegación funciona correctamente
  - Verificar que los filtros se aplican a todas las secciones
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [ ] 24. Implementar funcionalidad de exportación
  - [ ] 24.1 Crear servicio de exportación
    - Implementar exportación a PDF con jsPDF
    - Implementar exportación a CSV
    - Implementar exportación a Excel con xlsx
    - Incluir todos los KPIs en exportación
    - Incluir gráficos como imágenes en PDF
    - Incluir alertas activas
    - Generar resumen ejecutivo de una página
    - Incluir recomendaciones accionables
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6_

  - [ ]* 24.2 Escribir property test para completitud de exportación
    - **Property 15: Export Data Completeness**
    - **Validates: Requirements 11.3, 11.6**

  - [ ]* 24.3 Escribir unit tests para exportación
    - Test de generación de PDF
    - Test de generación de CSV
    - Test de generación de Excel
    - Test de inclusión de todos los datos
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 25. Implementar configuración de umbrales personalizados
  - [x] 25.1 Crear componente de configuración de umbrales
    - Implementar formulario de configuración
    - Permitir ajustar umbral de incremento de costos
    - Permitir ajustar umbral de pérdida no realizada
    - Permitir ajustar umbral de spread bancario
    - Permitir ajustar umbral de proximidad a equilibrio
    - Permitir ajustar umbral de diferencia de márgenes
    - Permitir ajustar umbral de diferencial cambiario
    - Permitir ajustar umbral de tendencia de moneda
    - Validar que umbrales están en rangos válidos
    - Guardar configuración en Redux y localStorage
    - _Requirements: 9.6_

  - [ ]* 25.2 Escribir property test para configuración de umbrales
    - **Property 10: Custom Threshold Configuration**
    - **Validates: Requirements 9.6**

- [x] 26. Implementar integración con módulo de tesorería
  - [x] 26.1 Crear acciones de integración
    - Implementar botón "Iniciar Pago" en deudas prioritarias
    - Implementar navegación a módulo de presupuestos
    - Implementar pre-llenado de formulario de pago
    - Implementar actualización de KPIs después de pago
    - Implementar sincronización bidireccional con cuentas por pagar
    - Implementar creación de recordatorios de pago
    - Implementar registro de auditoría de acciones
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 26.2 Escribir property test para sincronización de datos
    - **Property 14: Bidirectional Data Synchronization**
    - **Validates: Requirements 10.5**

  - [x] 26.3 Escribir integration tests para integración con tesorería
    - Test de navegación a módulo de pagos
    - Test de pre-llenado de formulario
    - Test de actualización de KPIs
    - _Requirements: 10.1, 10.2, 10.3, 10.4_


- [x] 27. Implementar historial de alertas y reportes
  - [x] 27.1 Crear sistema de historial
    - [x] Implementar registro de alertas en base de datos
    - [x] Crear tabla AlertHistory en Prisma schema
    - [x] Implementar endpoint para obtener historial de alertas
    - [x] Implementar componente de visualización de historial
    - [x] Implementar registro de reportes generados
    - [x] Crear tabla ReportHistory en Prisma schema
    - [x] Implementar endpoint para obtener historial de reportes
    - [x] Implementar componente de visualización de historial de reportes
    - [x] Permitir comparación temporal de reportes
    - _Requirements: 9.7, 11.7_

  - [x]* 27.2 Escribir tests para historial
    - [x] Test de registro de alertas
    - [x] Test de registro de reportes
    - [x] Test de recuperación de historial
    - _Requirements: 9.7, 11.7_

- [x] 28. Implementar programación de reportes automáticos
  - [x] 28.1 Crear sistema de reportes programados
    - [x] Implementar configuración de reportes automáticos
    - [x] Permitir programar reportes semanales
    - [x] Permitir programar reportes mensuales
    - [x] Crear servicio de scheduler
    - [x] Implementar generación automática de reportes
    - [x] Implementar envío de reportes por email (configuración)
    - [x] Guardar reportes generados en historial
    - _Requirements: 11.5_

  - [x]* 28.2 Escribir tests para reportes programados
    - [x] Test de configuración de programación
    - [x] Test de generación automática
    - _Requirements: 11.5_

- [x] 29. Implementar guardado y carga de escenarios
  - [x] 29.1 Crear persistencia de escenarios
    - Crear tabla ScenarioSimulation en Prisma schema
    - Implementar endpoint POST para guardar escenario
    - Implementar endpoint GET para listar escenarios guardados
    - Implementar endpoint GET para cargar escenario específico
    - Implementar componente de lista de escenarios guardados
    - Permitir nombrar y describir escenarios
    - Implementar carga de escenario en simulador
    - _Requirements: 8.6_

  - [x] 29.2 Escribir property test para round-trip de escenarios
    - **Property 16: Scenario Save and Load Round-Trip**
    - **Validates: Requirements 8.6**

- [x] 30. Checkpoint - Verificar características avanzadas
  - Asegurar que exportación funciona correctamente
  - Verificar que integración con tesorería funciona
  - Verificar que historial y programación funcionan
  - Preguntar al usuario si hay dudas o ajustes necesarios

- [x] 31. Implementar diseño responsivo
  - [x] 31.1 Optimizar para móvil
    - Adaptar layout a pantalla móvil (single column)
    - Implementar tabs deslizables (swipeable)
    - Simplificar gráficos para móvil
    - Hacer sliders touch-friendly
    - Implementar bottom sheet para detalles
    - Priorizar KPIs críticos en vista inicial
    - _Requirements: 12.1, 12.2_

  - [x] 31.2 Optimizar para tablet
    - Adaptar layout a pantalla tablet (two columns)
    - Implementar comparaciones lado a lado
    - _Requirements: 12.1_

  - [x] 31.3 Optimizar para desktop
    - Implementar layout de tres columnas
    - Agregar atajos de teclado
    - Implementar vista multi-panel
    - _Requirements: 12.1_

  - [ ]* 31.4 Escribir tests de responsive design
    - Test de renderizado en diferentes viewports
    - Test de funcionalidad en móvil
    - _Requirements: 12.1, 12.2_

- [x] 32. Implementar características de accesibilidad
  - [x] 32.1 Mejorar accesibilidad
    - Agregar ARIA labels a todos los gráficos
    - Implementar ARIA live regions para actualizaciones dinámicas
    - Agregar alt text descriptivo a elementos visuales
    - Asegurar estructura HTML semántica
    - Implementar navegación por teclado completa
    - Agregar skip to main content link
    - Documentar atajos de teclado
    - Agregar focus indicators visibles
    - Implementar tooltips explicativos para KPIs
    - Usar colores accesibles con contraste suficiente
    - Asegurar que no se use solo color para información
    - _Requirements: 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 32.2 Escribir tests de accesibilidad
    - Test con axe-core
    - Test de navegación por teclado
    - Test de contraste de colores
    - _Requirements: 12.4, 12.6, 12.7_

- [ ] 33. Implementar optimizaciones de performance
  - [ ] 33.1 Optimizar frontend
    - Implementar code splitting para componentes pesados
    - Implementar lazy loading de gráficos
    - Memoizar cálculos costosos con useMemo
    - Memoizar componentes puros con React.memo
    - Implementar virtual scrolling para tablas grandes
    - Optimizar re-renders innecesarios
    - _Requirements: Performance (no específico)_

  - [ ] 33.2 Implementar caching
    - Configurar cache de tasas de cambio (1 hora)
    - Configurar cache de KPIs (5 minutos)
    - Configurar cache de tendencias históricas (24 horas)
    - Implementar invalidación de cache en cambios de datos
    - _Requirements: Performance (no específico)_

  - [ ]* 33.3 Escribir tests de performance
    - Test de tiempo de carga inicial
    - Test de tiempo de recálculo de KPIs
    - Test de tiempo de renderizado de gráficos
    - Test con datasets grandes
    - _Requirements: Performance (no específico)_

- [x] 34. Implementar property tests para filtros y agregaciones
  - [x]* 34.1 Escribir property test para aplicación de filtros
    - **Property 11: Filter Application Consistency**
    - **Validates: Requirements 1.5, 3.1, 5.7**

  - [x]* 34.2 Escribir property test para agregación de datos
    - **Property 12: Data Aggregation Correctness**
    - **Validates: Requirements 2.6, 2.7, 6.4**

- [x] 35. Implementar property tests para sincronización y tendencias
  - [x]* 35.1 Escribir property test para actualización de KPIs en tiempo real
    - **Property 13: Real-Time KPI Update Consistency**
    - **Validates: Requirements 10.4**
  - [x]* 35.2 Escribir property test para clasificación de tendencias
    - **Property 17: Currency Trend Classification Stability**
    - **Validates: Requirements 7.2**
  - [x]* 35.3 Escribir property test para ranking de deudas
    - **Property 18: Debt Priority Ranking Consistency**
    - **Validates: Requirements 7.3**

- [x] 36. Checkpoint final - Verificar sistema completo
  - Ejecutar todos los tests (unit, property, integration, accessibility)
  - Verificar que todos los requerimientos están implementados
  - Verificar performance con datos reales
  - Verificar accesibilidad con herramientas automatizadas
  - Realizar pruebas manuales de flujos completos
  - Preguntar al usuario si hay ajustes finales necesarios

- [x] 37. Integrar dashboard en ReportesAnalyticsPage
  - [ ] 37.1 Actualizar ReportesAnalyticsPage
    - Importar ExchangeIntelligenceDashboard
    - Reemplazar ExchangeImpactAnalysis con nuevo dashboard
    - Mantener compatibilidad con filtros globales
    - Asegurar que tab "Exchange" muestra nuevo dashboard
    - Verificar que navegación funciona correctamente
    - _Requirements: Integración con sistema existente_

  - [ ]* 37.2 Escribir tests de integración final
    - Test de integración con ReportesAnalyticsPage
    - Test de compatibilidad con filtros globales
    - Test de navegación entre tabs
    - _Requirements: Integración con sistema existente_

- [x] 38. Documentación y capacitación
   - [x] 38.1 Crear documentación técnica
     - Documentar arquitectura del dashboard
     - Documentar APIs y endpoints
     - Documentar algoritmos de cálculo
     - Documentar estructura de datos
     - Crear guía de troubleshooting
     - _Requirements: Documentación_

   - [x] 38.2 Crear documentación de usuario
     - Crear guía de usuario del dashboard
     - Documentar cada sección y KPI
     - Explicar cómo interpretar alertas
     - Documentar cómo usar el simulador
     - Crear ejemplos de casos de uso
     - Documentar atajos de teclado
     - _Requirements: Documentación_

- [x] 39. Deployment y monitoreo
  - [ ] 39.1 Preparar para deployment
    - Configurar variables de entorno
    - Configurar logging y error tracking
    - Configurar performance monitoring
    - Crear scripts de migración de base de datos
    - Configurar backup y disaster recovery
    - _Requirements: Deployment_

  - [ ] 39.2 Configurar monitoreo
    - Configurar alertas de errores
    - Configurar alertas de performance
    - Configurar tracking de uso
    - Configurar dashboards de monitoreo
    - _Requirements: Monitoring_

- [x] 40. Checkpoint final - Listo para producción
  - Verificar que todos los tests pasan
  - Verificar que documentación está completa
  - Verificar que monitoreo está configurado
  - Realizar deployment a staging
  - Realizar pruebas de aceptación de usuario
  - Obtener aprobación final del usuario

## Notes

- Cada tarea referencia los requerimientos específicos que implementa
- Los checkpoints aseguran validación incremental
- Los property tests validan corrección universal con 100+ iteraciones
- Los unit tests validan casos específicos y edge cases
- La implementación sigue un enfoque bottom-up: backend → frontend → integración
