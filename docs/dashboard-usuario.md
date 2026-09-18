# Guía de Usuario del Dashboard de Inteligencia Cambiaria

## Introducción

El Dashboard de Inteligencia Cambiaria es una herramienta poderosa que te ayuda a entender y gestionar el impacto de las fluctuaciones cambiarias en tu negocio. Esta guía te explicará cómo usar todas las funcionalidades del dashboard de manera efectiva.

## Acceso al Dashboard

1. Navega a la sección **Reportes y Analytics** en el menú principal
2. Selecciona la pestaña **Exchange Intelligence**
3. El dashboard se cargará automáticamente con los datos más recientes

## Secciones del Dashboard

### 1. Impacto en Costos

Esta sección muestra cómo las variaciones cambiarias afectan tus costos de inventario.

#### Gráfico de Línea de Tiempo
- **Línea Azul**: Costo histórico (basado en compras anteriores)
- **Línea Roja**: Costo de reposición (con tasas actuales)
- **Diferencia**: Porcentaje de cambio entre ambas líneas

#### Interpretación
- Si la línea roja está **por encima** de la azul: Tus costos han aumentado debido a la depreciación de la moneda
- Si la línea roja está **por debajo** de la azul: Has tenido ganancias por apreciación cambiaria
- **Alerta**: Se activa cuando la diferencia supera el 10%

#### Filtros Disponibles
- **Categoría**: Filtrar por categorías de productos
- **Almacén**: Ver impacto por ubicación de inventario
- **Proveedor**: Analizar por proveedor específico

### 2. Exposición de Deuda

Analiza cómo las deudas denominadas en moneda extranjera se ven afectadas por las fluctuaciones.

#### Gráfico de Barras Comparativo
- **Barra 1 (Azul)**: Valor original de la deuda
- **Barra 2 (Roja)**: Valor actual con tasas vigentes
- **Pérdida No Realizada**: Diferencia entre ambas barras

#### Tabla de Desglose
- **Moneda**: Tipo de moneda extranjera
- **Monto Original**: Valor al momento de contraer la deuda
- **Monto Actual**: Valor con tasas actuales
- **Pérdida**: Diferencia en moneda local
- **Antigüedad**: Días desde que se contrajo la deuda
- **Tendencia**: Dirección del cambio en los últimos 30 días

#### Interpretación de Alertas
- **Alerta de Pérdida**: Se activa cuando la pérdida no realizada supera el 5%
- **Deudas Prioritarias**: Ordenadas por score de prioridad (antigüedad + tendencia)

### 3. Eficiencia de Pagos

Evalúa la eficiencia de tus transacciones cambiarias comparando con tasas oficiales.

#### Tabla Comparativa
- **Tasa Oficial**: Tasa de referencia del mercado
- **Tasa Real**: Tasa pagada en la transacción
- **Spread Bancario**: Diferencia porcentual entre ambas
- **Monto**: Valor de la transacción

#### Métricas Clave
- **Spread Promedio Ponderado**: Promedio de spreads considerando montos
- **Transacciones con Spread Alto**: Aquellas por encima del promedio

#### Recomendaciones
- Si el spread promedio > 3%: Considerar cambiar de proveedor de cambio
- Identificar patrones de ineficiencia por moneda o período

### 4. Dashboard de KPIs

Vista consolidada de los indicadores clave de rendimiento cambiario.

#### Tasa de Equilibrio
- **Definición**: Tasa cambiaria a la cual el costo = precio de venta
- **Interpretación**:
  - **Verde**: Productos seguros (tasa actual favorable)
  - **Amarillo**: Productos vulnerables (cerca del equilibrio)
  - **Rojo**: Productos críticos (riesgo de pérdidas)

#### Margen Real vs Nominal
- **Margen Nominal**: Precio - Costo original
- **Margen Real**: Precio - Costo ajustado por tasa actual
- **Tendencia**: Evolución histórica del margen

#### Diferencial Cambiario Acumulado
- **Acumulado Anual**: Suma de diferenciales de todas las transacciones
- **Desglose Mensual**: Evolución por mes
- **Comparación Interanual**: Diferencia con el año anterior

#### Envejecimiento de Deuda
- **Lista Priorizada**: Deudas ordenadas por urgencia de pago
- **Score de Prioridad**: Calculado por antigüedad y tendencia de moneda
- **Impacto de Pago**: Ahorro potencial al pagar hoy vs esperar

## Sistema de Alertas

### Tipos de Alertas

#### 🔴 Alta Prioridad
- Pérdida no realizada > 5% del total de deudas
- Incremento de costos > 10% del inventario
- Spread bancario promedio > 3%

#### 🟡 Media Prioridad
- Productos cerca de tasa de equilibrio (90-100%)
- Diferencia de márgenes > 15%
- Diferencial cambiario > 5% de ingresos

#### 🟢 Baja Prioridad
- Tendencia alcista en monedas de deuda (>5% mensual)
- Recomendaciones de eficiencia de pagos

### Cómo Interpretar Alertas

Cada alerta incluye:
- **Descripción**: Explicación del problema
- **Valor Actual**: Medición actual
- **Umbral**: Límite configurado
- **Recomendación**: Acción sugerida

### Gestión de Alertas
- Las alertas se muestran en el panel centralizado
- Historial disponible en la sección de configuración
- Posibilidad de resolver alertas manualmente

## Simulador de Escenarios

### Funcionalidad
El simulador permite probar "qué pasaría si" cambiando las tasas de cambio.

### Cómo Usar
1. **Ajustar Sliders**: Modifica las tasas de cambio para diferentes monedas
2. **Ver Resultados**: Los KPIs se recalculan automáticamente
3. **Analizar Impacto**: Observa cómo cambian márgenes, pérdidas y utilidades
4. **Guardar Escenario**: Almacena configuraciones para referencia futura

### Ejemplos de Uso
- **Escenario Pesimista**: +20% en tasas para evaluar riesgo
- **Escenario Optimista**: -10% en tasas para proyección de ganancias
- **Escenario Base**: Tasas actuales como punto de referencia

### Guardado de Escenarios
- **Nombre**: Identificador descriptivo
- **Descripción**: Notas sobre el escenario
- **Tasas**: Configuración de tasas simuladas
- **Resultados**: KPIs calculados automáticamente

## Filtros Globales

### Rango de Fechas
- Afecta todos los cálculos históricos
- Formato: Desde/Hasta
- Máximo: 2 años de datos

### Moneda
- Filtrar análisis por moneda específica
- Aplicable a: Exposición de deuda, Eficiencia de pagos

### Umbrales Personalizados
- Ajustar sensibilidad de alertas
- Configuración persistente en localStorage
- Valores por defecto recomendados

## Atajos de Teclado

### Navegación
- `Tab`: Mover entre secciones
- `Enter`: Activar elemento seleccionado
- `Escape`: Cerrar modales o menús

### Simulador
- `Ctrl + S`: Guardar escenario actual
- `Ctrl + R`: Resetear sliders a valores actuales
- `Ctrl + Z`: Deshacer último cambio

### Dashboard General
- `F5`: Recargar datos
- `Ctrl + F`: Abrir búsqueda/filtros
- `Ctrl + E`: Exportar vista actual

## Casos de Uso Prácticos

### Caso 1: Evaluación de Riesgo Cambiario
**Contexto**: Empresa importadora con inventario en USD
**Acciones**:
1. Revisar sección "Impacto en Costos"
2. Verificar alertas de incremento > 10%
3. Usar simulador para escenarios de depreciación
4. Identificar productos más vulnerables

### Caso 2: Optimización de Pagos
**Contexto**: Múltiples transacciones cambiarias mensuales
**Acciones**:
1. Analizar "Eficiencia de Pagos"
2. Identificar proveedores con spreads altos
3. Comparar con promedio del mercado
4. Negociar mejores condiciones

### Caso 3: Gestión de Deudas
**Contexto**: Deudas en múltiples monedas
**Acciones**:
1. Revisar "Exposición de Deuda"
2. Priorizar pagos según score de antigüedad
3. Monitorear tendencias de monedas
4. Usar simulador para timing de pagos

### Caso 4: Planificación Presupuestaria
**Contexto**: Preparación de presupuesto anual
**Acciones**:
1. Analizar "Diferencial Cambiario Acumulado"
2. Proyectar márgenes con simulador
3. Evaluar impacto en utilidad neta
4. Configurar reportes automáticos mensuales

## Mejores Prácticas

### Monitoreo Diario
- Revisar alertas activas al inicio del día
- Verificar tendencias de monedas críticas
- Actualizar escenarios según noticias económicas

### Análisis Semanal
- Revisar KPIs completos
- Comparar con semana anterior
- Ajustar umbrales si necesario
- Generar reportes para stakeholders

### Planificación Mensual
- Análisis profundo de eficiencia de pagos
- Evaluación de exposición de deuda
- Actualización de escenarios de riesgo
- Revisión de productos vulnerables

### Reportes y Comunicación
- Usar función de exportación para stakeholders
- Programar reportes automáticos
- Incluir recomendaciones accionables
- Documentar decisiones tomadas

## Solución de Problemas

### Datos No Se Actualizan
- Verificar conexión a internet
- Recargar la página (F5)
- Contactar soporte si persiste

### Gráficos No Cargan
- Verificar que JavaScript esté habilitado
- Intentar con otro navegador
- Limpiar cache del navegador

### Filtros No Aplican
- Verificar formato de fechas
- Revisar que haya datos en el rango seleccionado
- Resetear filtros y aplicar uno por vez

### Simulador Lento
- Reducir rango de fechas
- Cerrar otras pestañas del navegador
- Esperar a que termine el recálculo

## Soporte y Contacto

Para asistencia adicional:
- **Documentación Técnica**: Ver `docs/dashboard-tecnico.md`
- **Soporte Técnico**: Contactar al equipo de desarrollo
- **Capacitación**: Solicitar sesión de training personalizado

---

*Esta guía se actualiza con cada nueva versión del dashboard. Última actualización: Enero 2026*