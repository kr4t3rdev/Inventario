# Sistema de Vacaciones Automático - Documentación de Implementación

## Resumen de Mejoras Implementadas

El sistema de vacaciones ha sido completamente automatizado para resolver todas las limitaciones identificadas:

### ✅ Problemas Resueltos

1. **Acumulación Automática**: Ahora el sistema calcula automáticamente los días de vacaciones basados en:
   - Antigüedad del empleado
   - Tiempo trabajado
   - Configuración empresarial

2. **Configuración por Empleado**: Sistema configurable que asigna automáticamente:
   - Días base anuales (15 días por defecto)
   - Incrementos por antigüedad (1 día adicional por año)
   - Máximo de días adicionales (10 días)

3. **Cronograma Automático**: El sistema ahora incluye:
   - Acumulación mensual automática
   - Validación de antigüedad mínima (6 meses)
   - Integración con sistema de nómina

## Archivos Modificados/Creados

### 🗄️ Base de Datos
- **`prisma/schema.prisma`**: Modelo `Empleado` actualizado con nuevos campos
- **`prisma/schema.prisma`**: Nuevo modelo `VacationAccrual` para registro de acumulaciones
- **`prisma/migrations/001_vacation_system_automation.sql`**: Script de migración

### 🔧 Servicios
- **`src/lib/vacation-accrual-service.ts`**: Servicio principal de acumulación automática

### 🌐 APIs
- **`src/app/api/empleados/vacaciones/route.ts`**: API principal actualizada
- **`src/app/api/empleados/vacaciones/[id]/route.ts`**: API individual actualizada
- **`src/app/api/empleados/vacaciones/acumulacion/route.ts`**: Nueva API para cálculos individuales
- **`src/app/api/empleados/vacaciones/acumulacion/masiva/route.ts`**: Nueva API para cálculos masivos
- **`src/app/api/empleados/nomina/route.ts`**: Integración con sistema de nómina

### 🖥️ Interfaz
- **`src/components/empleados/vacaciones-form.tsx`**: Componente actualizado con información automática

## Nuevas Funcionalidades

### 1. Cálculo Automático por Antigüedad
```typescript
// Ejemplo de cálculo automático
Días Base: 15 días/año
+ Incremento por Antigüedad: 1 día/año (máximo 10 días)
= Total Anual: 25 días máximo
```

### 2. Validaciones Inteligentes
- **Antigüedad mínima**: 6 meses para primera solicitud
- **Días suficientes**: Validación automática contra acumulación
- **Períodos sin conflictos**: Previene solicitudes simultáneas

### 3. Integración con Nómina
- **Automática**: Acumula días automáticamente al procesar nómina
- **Configurable**: Puede activarse/desactivarse por período
- **Masiva**: Procesa todos los empleados del período

### 4. Reportes y Estadísticas
- **Histórico completo**: Registro de todas las acumulaciones
- **Proyecciones**: Cálculo automático de días futuros
- **Resumen por empleado**: Dashboard personalizado

## Cómo Usar el Sistema

### 1. Configuración Inicial
```sql
-- Ejecutar migración en base de datos
psql -d tu_base_datos -f prisma/migrations/001_vacation_system_automation.sql

-- Regenerar cliente Prisma
npx prisma generate
```

### 2. Configurar Empleados
- **Fecha de contratación**: Campo obligatorio para cálculo automático
- **Días anuales**: Configurables por empleado (por defecto 15)
- **Tipo de contrato**: Tiempo completo/parcial para cálculo proporcional

### 3. Procesar Acumulación

#### Automática (Recomendada)
```bash
# Integrada en el procesamiento de nómina
POST /api/empleados/nomina
{
  "periodo": "2024-12",
  "includeVacationAccrual": true
}
```

#### Manual Individual
```bash
POST /api/empleados/vacaciones/acumulacion
{
  "employeeId": "emp123",
  "periodo": "2024-12"
}
```

#### Manual Masiva
```bash
POST /api/empleados/vacaciones/acumulacion/masiva
{
  "periodo": "2024-12",
  "employeeIds": ["emp1", "emp2", "emp3"]
}
```

### 4. Monitoreo y Reportes

#### Resumen de Empleado
```bash
GET /api/empleados/vacaciones/acumulacion?employeeId=emp123
```

#### Estadísticas Generales
```bash
GET /api/empleados/vacaciones/acumulacion/masiva?periodo=2024-12
```

## Configuración del Sistema

### Parámetros por Defecto
```typescript
const DEFAULT_CONFIG = {
  diasAnualesBase: 15,        // Días base por año
  diasMaximosPorAntiguedad: 10, // Máximo días adicionales
  mesesParaPrimerPeriodo: 12,   // Meses para primer cálculo completo
  incrementoAnual: 1           // Incremento por año de antigüedad
};
```

### Personalización
Los parámetros pueden modificarse en el constructor del servicio:
```typescript
const customService = new VacationAccrualService({
  diasAnualesBase: 20,
  incrementoAnual: 2
});
```

## Validaciones Implementadas

### 1. Al Crear Solicitud
- ✅ Empleado con fecha de contratación
- ✅ Días disponibles suficientes
- ✅ Períodos sin conflictos
- ✅ Antigüedad mínima (6 meses)

### 2. Al Procesar Acumulación
- ✅ Empleado con fecha de contratación válida
- ✅ Período no procesado anteriormente
- ✅ Cálculo proporcional para primer período

### 3. Al Aprobar Solicitudes
- ✅ Actualización automática de días usados
- ✅ Validación de límites empresariales

## Interfaz de Usuario

### Mejoras en el Formulario
- **Resumen automático**: Muestra días acumulados, usados y disponibles
- **Información de antigüedad**: Fecha de contratación y meses trabajados
- **Proyecciones**: Días asignados por año
- **Validación visual**: Errores claros y específicos

### Información en Tiempo Real
- Actualización automática al seleccionar empleado
- Cálculo dinámico de días solicitados
- Resumen histórico de acumulaciones

## Flujo de Trabajo Completo

1. **Registro de Empleado**: Fecha de contratación configurada
2. **Procesamiento Mensual**: Automático vía nómina o manual
3. **Acumulación Calculada**: Basada en antigüedad y tiempo trabajado
4. **Solicitud de Vacaciones**: Empleado solicita con validación automática
5. **Aprobación/ Rechazo**: Sistema actualiza días usados automáticamente
6. **Reportes**: Dashboard con estadísticas y proyecciones

## Beneficios del Sistema Automatizado

### Para RRHH
- ⚡ **Ahorro de tiempo**: No más cálculos manuales
- 📊 **Reportes precisos**: Datos actualizados automáticamente
- 🎯 **Cumplimiento**: Validaciones automáticas evitan errores

### Para Empleados
- 📈 **Transparencia**: Ven acumulación y proyección automática
- ✅ **Equidad**: Cálculos consistentes para todos
- 📋 **Histórico**: Acceso a historial completo de vacaciones

### Para la Empresa
- 💰 **Costos controlados**: Límites automáticos y proyecciones
- ⚖️ **Cumplimiento legal**: Validaciones de antigüedad y límites
- 📊 **Toma de decisiones**: Datos precisos para planificación

## Próximos Pasos

1. **Ejecutar migración de base de datos**
2. **Generar cliente Prisma actualizado**
3. **Configurar fechas de contratación de empleados**
4. **Procesar acumulación inicial**
5. **Entrenar usuarios en nuevo sistema**

## Soporte

Para consultas técnicas o personalizaciones adicionales, el sistema está diseñado para ser extensible y modular, permitiendo ajustes de configuración sin modificar el código base.