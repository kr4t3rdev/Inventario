'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { getAuthToken } from "@/lib/token"
import { Settings, Bell } from "lucide-react"

interface ConfiguracionSistema {
  configId: string
  diasAvisoVencimientoContrato: number
}

export function ConfiguracionContratos() {
  const [config, setConfig] = useState<ConfiguracionSistema | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [diasAviso, setDiasAviso] = useState(30)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/configuracion/sistema/contratos', {
        headers: {
          'Authorization': getAuthToken(),
        },
      })
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
        setDiasAviso(data.diasAvisoVencimientoContrato)
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error)
      toast('Error al cargar configuración')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/configuracion/sistema/contratos', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthToken(),
        },
        body: JSON.stringify({
          diasAvisoVencimientoContrato: diasAviso,
        }),
      })

      if (response.ok) {
        toast('Configuración guardada exitosamente')
        fetchConfig()
      } else {
        throw new Error('Error al guardar')
      }
    } catch (error) {
      console.error('Error al guardar configuración:', error)
      toast('Error al guardar configuración')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configuración de Avisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Avisos de Vencimiento de Contratos
        </CardTitle>
        <CardDescription>
          Configure con cuántos días de anticipación desea recibir alertas antes del vencimiento de los contratos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="diasAviso">Días de anticipación para el aviso</Label>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Input
                id="diasAviso"
                type="number"
                min="1"
                max="365"
                value={diasAviso}
                onChange={(e) => setDiasAviso(parseInt(e.target.value) || 1)}
                className="w-full"
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Los contratos mostrarán una alerta cuando falten {diasAviso} días o menos para su vencimiento.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
