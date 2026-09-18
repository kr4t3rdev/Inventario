# Guía de Usuario: Dashboard de Inteligencia Cambiaria

## Introducción

El Dashboard de Inteligencia Cambiaria es una herramienta poderosa que te ayuda a entender y gestionar los riesgos asociados con las fluctuaciones de las tasas de cambio. Esta guía te enseñará cómo usar todas las funcionalidades del sistema de manera efectiva.

## Acceso al Dashboard

1. Ve a la sección de **Reportes y Analytics** de tu sistema
2. Haz clic en el tab **"Exchange"**
3. El dashboard se cargará mostrando el resumen general por defecto

## Navegación Básica

### Secciones Principales
- **Resumen**: Vista general de todos los indicadores clave
- **Costos**: Análisis del impacto en costos de inventario
- **Deudas**: Exposición de deuda cambiaria
- **Pagos**: Eficiencia de transacciones transfronterizas
- **KPIs**: Indicadores clave de performance detallados
- **Simulador**: Herramienta para escenarios hipotéticos

### Navegación por Teclado
- **Tab**: Moverse entre secciones
- **Enter**: Seleccionar sección activa
- **Flechas**: Navegar dentro de componentes
- **R**: Recargar datos (atajo global)

## Filtros Globales

### Configuración de Período
1. Haz clic en el selector de fechas en la parte superior
2. Elige el rango de fechas para tu análisis
3. Los datos se actualizarán automáticamente

### Filtros Adicionales
- **Categoría**: Filtrar por categorías de productos
- **Almacén**: Limitar análisis a almacenes específicos
- **Cuenta**: Analizar cuentas bancarias específicas

## Sección de Resumen

Esta vista proporciona un panorama general de tu exposición cambiaria:

### Tarjetas de Métricas
- **Ingresos Totales**: Ingresos en moneda principal
- **Egresos Totales**: Gastos en moneda principal
- **Saldo Neto**: Posición financiera neta
- **Alertas Activas**: Número de alertas críticas/advertencias

### Panel de Alertas
Si hay alertas activas, aparecerán en la parte superior con:
- Indicador de severidad (crítico/advertencia)
- Descripción del problema
- Recomendaciones de acción

## Análisis de Costos

### Gráfico de Impacto
- **Línea Azul**: Costos históricos (lo que pagaste originalmente)
- **Línea Roja**: Costos de reposición (lo que costaría hoy)
- **Diferencia**: Impacto de la fluctuación cambiaria

### Interpretación
- Si la línea roja está **por encima** de la azul: Has ganado con la fluctuación
- Si la línea roja está **por debajo** de la azul: Has perdido dinero
- **Alerta roja**: Diferencia > 10% requiere atención inmediata

### Estadísticas Clave
- **Incremento Promedio**: Cambio porcentual promedio
- **Productos Afectados**: Número de productos impactados
- **Estado**: Verde (estable), Amarillo (advertencia), Rojo (crítico)

## Exposición de Deuda

### Gráfico Comparativo
- **Barras Azules**: Deuda original (monto prestado)
- **Barras Rojas**: Deuda actual (valor actual debido a fluctuaciones)

### Tabla de Desglose
- **Moneda**: Moneda de la deuda
- **Monto Original**: Cantidad original prestada
- **Monto Actual**: Valor actual ajustado por cambio
- **Diferencia**: Pérdida/ganancia no realizada
- **Antigüedad**: Días desde que se tomó la deuda
- **Tendencia**: alcista/bajista/estable

### Interpretación de Riesgos
- **Deudas en monedas alcistas**: Riesgo de pérdidas futuras
- **Antigüedad alta**: Mayor exposición al riesgo
- **Diferencias negativas**: Ya has perdido dinero

## Eficiencia de Pagos

### Tabla de Transacciones
- **Fecha**: Cuando se realizó la transacción
- **Moneda**: Moneda de la transacción
- **Tasa Oficial**: Tasa oficial del mercado
- **Tasa Real**: Tasa que pagaste al banco
- **Spread**: Diferencia porcentual (cuánto te cobraron de más)

### Recomendaciones
- **Spread > 3%**: Considera renegociar con tu banco
- **Transacciones frecuentes**: Evalúa cuentas multi-moneda
- **Patrones estacionales**: Identifica mejores momentos para transacciones

## Indicadores Clave (KPIs)

### Tasa de Equilibrio
**¿Qué significa?** La tasa de cambio a la que tu precio de venta cubre exactamente los costos.

**Interpretación:**
- **< 80%**: Zona segura (tienes buen margen)
- **80-100%**: Zona de advertencia (vigila fluctuaciones)
- **> 100%**: Zona crítica (precios podrían no cubrir costos)

### Margen Real vs Nominal
**¿Qué significa?** Diferencia entre el margen que planeaste y el margen real debido a cambios cambiarios.

**Interpretación:**
- **Positivo**: Ganaste más de lo esperado
- **Negativo**: Perdiste dinero por fluctuaciones
- **> 15%**: Requiere revisión de estrategia de precios

### Diferencial Cambiario
**¿Qué significa?** Ganancias o pérdidas acumuladas por diferencias cambiarias en el período.

**Interpretación:**
- **Positivo**: Beneficio neto por fluctuaciones
- **Negativo**: Costo neto por fluctuaciones
- **> 5% de ingresos**: Impacto significativo en resultados

### Envejecimiento de Deuda
**¿Qué significa?** Priorización de deudas por riesgo cambiario.

**Interpretación:**
- **Prioridad Alta**: Deudas antiguas en monedas volátiles
- **Monedas Alcistas**: Mayor riesgo de pérdidas futuras
- **Impacto 30 días**: Costo potencial de esperar un mes

## Simulador de Escenarios

### Uso Básico
1. Ve al tab "Simulador"
2. Ajusta las tasas de cambio usando los sliders
3. Observa cómo cambian todos los KPIs en tiempo real

### Escenarios Predefinidos
- **+10%**: Simula apreciación de monedas extranjeras
- **-10%**: Simula depreciación de monedas extranjeras
- **Crisis**: Cambios extremos en múltiples monedas

### Guardado de Escenarios
1. Configura un escenario interesante
2. Haz clic en "Guardar Escenario"
3. Asigna un nombre y descripción
4. Accede a escenarios guardados desde la lista

## Sistema de Alertas

### Tipos de Alertas
- **Críticas (🔴)**: Requieren acción inmediata
- **Advertencias (🟡)**: Merecen atención
- **Información (🔵)**: Información relevante

### Umbrales Configurables
Ve a la configuración para ajustar:
- Incremento de costos máximo tolerable
- Pérdida no realizada máxima
- Spread bancario máximo aceptable

## Exportación y Reportes

### Formatos Disponibles
- **PDF**: Reporte completo con gráficos
- **CSV**: Datos tabulares para análisis
- **Excel**: Formato nativo para edición

### Contenido del Reporte
- Todos los KPIs calculados
- Gráficos en formato imagen
- Alertas activas
- Resumen ejecutivo
- Recomendaciones accionables

### Reportes Automáticos
Configura reportes que se envíen automáticamente:
- **Semanales**: Resumen semanal
- **Mensuales**: Análisis mensual completo

## Configuración Personalizada

### Umbrales de Alerta
Ajusta los niveles que activan alertas según tu tolerancia al riesgo.

### Preferencias de Visualización
- Tema claro/oscuro
- Idioma de la interfaz
- Formato de números y fechas

### Notificaciones
Configura cómo quieres recibir alertas:
- Correo electrónico
- Notificaciones en aplicación
- Frecuencia de actualizaciones

## Mejores Prácticas

### Monitoreo Diario
1. Revisa el resumen general cada mañana
2. Presta atención a alertas críticas
3. Monitorea tendencias en monedas clave

### Análisis Semanal
1. Revisa KPIs detallados
2. Analiza eficiencia de pagos
3. Evalúa exposición de deuda

### Planificación Estratégica
1. Usa el simulador para escenarios de riesgo
2. Ajusta precios basándote en tasas de equilibrio
3. Diversifica monedas de deuda

### Respuesta a Alertas
1. **Incremento de costos > 10%**: Revisa precios de venta
2. **Pérdida no realizada > 5%**: Evalúa cobertura o prepago
3. **Spread bancario alto**: Negocia mejores condiciones

## Glosario

- **Tasa de Cambio**: Precio relativo entre dos monedas
- **Margen Nominal**: Beneficio planificado sin considerar fluctuaciones
- **Margen Real**: Beneficio real después de fluctuaciones cambiarias
- **Spread Bancario**: Diferencia entre tasa oficial y tasa cobrada
- **Pérdida No Realizada**: Pérdida en libros contables (no concretada)
- **Tasa de Equilibrio**: Tasa donde ingresos cubren costos exactamente

## Solución de Problemas

### Datos no se cargan
- Verifica tu conexión a internet
- Recarga la página (tecla R)
- Contacta al administrador si persiste

### Gráficos no aparecen
- Asegúrate de tener JavaScript activado
- Prueba con un navegador actualizado
- Limpia caché del navegador

### Alertas no tienen sentido
- Verifica configuración de umbrales
- Confirma que los datos de entrada son correctos
- Revisa fechas del período de análisis

## Soporte

Si necesitas ayuda adicional:

- **Documentación Técnica**: Consulta EXCHANGE_INTELLIGENCE_README.md
- **Soporte Técnico**: support@empresa.com
- **Equipo de Desarrollo**: dev@empresa.com

---

*Última actualización: Enero 2026*