'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EnhancedAsistenciaForm } from "@/features/empleados"
import { WorkScheduleManager } from "@/features/empleados"
import { AttendanceHistoryView } from "@/features/empleados"
import { Clock, Calendar, Settings, BarChart3 } from "lucide-react"

/**
 * @description Vista cliente del Sistema Mejorado de Asistencia.
 * El gate de plan se aplica en el Server Component padre (page.tsx).
 * @returns {JSX.Element} Sistema de asistencia con tabs.
 */
export function SistemaAsistenciaClient(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState("attendance")

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-primary">
          Sistema Mejorado de Asistencia
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Gestiona la asistencia de empleados con funcionalidades avanzadas:
          registro manual, horarios personalizados, historial completo y reportes detallados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardHeader className="pb-2">
            <Clock className="h-8 w-8 mx-auto text-primary" />
            <CardTitle className="text-lg">Registro Diario</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Registra entradas y salidas con edición manual
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader className="pb-2">
            <Settings className="h-8 w-8 mx-auto text-primary" />
            <CardTitle className="text-lg">Horarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configura horarios de trabajo por empleado y día
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader className="pb-2">
            <Calendar className="h-8 w-8 mx-auto text-primary" />
            <CardTitle className="text-lg">Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Visualiza y edita el historial completo de asistencia
            </p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader className="pb-2">
            <BarChart3 className="h-8 w-8 mx-auto text-primary" />
            <CardTitle className="text-lg">Reportes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Estadísticas y exportación de datos de asistencia
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Asistencia Diaria
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Gestión de Horarios
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Historial y Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registro de Asistencia Mejorado</CardTitle>
              <CardDescription>
                Registra entradas y salidas de empleados con capacidad de edición manual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedAsistenciaForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Horarios de Trabajo</CardTitle>
              <CardDescription>
                Configura horarios de trabajo personalizados para cada empleado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WorkScheduleManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Asistencia y Reportes</CardTitle>
              <CardDescription>
                Visualiza estadísticas, filtra registros y exporta datos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceHistoryView />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Características Implementadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">📝 Registro de Asistencia</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Entrada/salida automática</li>
                <li>• Edición manual de horarios</li>
                <li>• Sistema de notas</li>
                <li>• Cálculo automático de horas extras</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">⚙️ Gestión de Horarios</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Horarios por día de la semana</li>
                <li>• Configuración de descansos</li>
                <li>• Horas programadas automáticas</li>
                <li>• Vista semanal interactiva</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📊 Reportes y Estadísticas</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Estadísticas de asistencia</li>
                <li>• Filtros avanzados</li>
                <li>• Exportación a CSV</li>
                <li>• Historial completo editable</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🔧 Funcionalidades Avanzadas</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Workflow de aprobación</li>
                <li>• Integración con nómina</li>
                <li>• Interfaz responsiva</li>
                <li>• API REST completa</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
