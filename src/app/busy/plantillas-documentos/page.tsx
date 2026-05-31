"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, FileText, Copy, Edit, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [plantillaToDelete, setPlantillaToDelete] = useState<any>(null)

  const loadPlantillas = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem("token")
      const response = await fetch("/api/plantillas-documentos", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error("Error al cargar plantillas")
      const data = await response.json()
      setPlantillas(data || [])
    } catch (err) {
      setError(err)
      console.error("Error loading plantillas:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPlantillas()
  }, [])

  const handleDelete = async () => {
    if (!plantillaToDelete) return
    
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/plantillas-documentos/${plantillaToDelete.plantillaId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        const data = await response.json()
        if (data.error) throw new Error(data.error)
        throw new Error("Error al eliminar plantilla")
      }
      
      toast("Plantilla eliminada exitosamente")
      setPlantillaToDelete(null)
      loadPlantillas()
    } catch (err: any) {
      console.error("Error deleting plantilla:", err)
      toast(err.message || "Error al eliminar plantilla")
    }
  }

  const toggleActivo = async (plantilla: any) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/plantillas-documentos/${plantilla.plantillaId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ activo: !plantilla.activo })
      })
      
      if (!response.ok) throw new Error("Error al actualizar plantilla")
      
      toast(`Plantilla ${!plantilla.activo ? "activada" : "desactivada"}`)
      loadPlantillas()
    } catch (err) {
      console.error("Error updating plantilla:", err)
      toast("Error al actualizar plantilla")
    }
  }

  const tipoColors: Record<string, string> = {
    CONTRATO_VENTA: "bg-purple-100 text-purple-800",
    CONTRATO_PROVEEDOR: "bg-indigo-100 text-indigo-800",
    CONTRATO_EMPLEADO: "bg-orange-100 text-orange-800",
    FACTURA: "bg-emerald-100 text-emerald-800",
    NOTA_CREDITO: "bg-teal-100 text-teal-800",
    NOTA_DEBITO: "bg-rose-100 text-rose-800",
    REMISION: "bg-cyan-100 text-cyan-800",
    ORDEN_COMPRA: "bg-amber-100 text-amber-800",
    REPORTE: "bg-slate-100 text-slate-800",
    OTRO: "bg-gray-100 text-gray-800"
  }

  if (isLoading) {
    return (
          <div className="container mx-auto py-6">
            <div className="text-center py-12">Cargando plantillas...</div>
          </div>
    )
  }

  if (error) {
    return (
          <div className="container mx-auto py-6">
            <div className="text-center py-12 text-destructive">
              Error al cargar plantillas: {error?.message || "Error desconocido"}
            </div>
          </div>
    )
  }

  return (
        <div className="container mx-auto py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Plantillas de Documentos</h1>
              <p className="text-muted-foreground">
                Crea y gestiona plantillas para generar documentos rápidamente
              </p>
            </div>
            <Button onClick={() => window.location.href = "/busy/plantillas-documentos/new"}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva Plantilla
            </Button>
          </div>

          {plantillas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No hay plantillas creadas aún.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => window.location.href = "/busy/plantillas-documentos/new"}
                >
                  Crear primera plantilla
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plantillas.map((plantilla) => (
                <Card key={plantilla.plantillaId} className={plantilla.activo ? "" : "opacity-60"}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          {plantilla.nombre}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {plantilla.descripcion || "Sin descripción"}
                        </CardDescription>
                      </div>
                      <Badge 
                        className={tipoColors[plantilla.tipo]}
                        variant="secondary"
                      >
                        {plantilla.tipo.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado:</span>
                        <Badge variant={plantilla.activo ? "default" : "secondary"}>
                          {plantilla.activo ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                      {plantilla.categoria && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Categoría:</span>
                          <span>{plantilla.categoria}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Documentos creados:</span>
                        <span>{plantilla._count?.documentos || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Creado el:</span>
                        <span>{format(new Date(plantilla.createdAt), "dd/MM/yyyy", { locale: es })}</span>
                      </div>
                      {plantilla.creadoPor && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Creado por:</span>
                          <span>{plantilla.creadoPor.name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.location.href = `/busy/plantillas-documentos/${plantilla.plantillaId}/generar`}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Generar Documento
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/busy/plantillas-documentos/${plantilla.plantillaId}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActivo(plantilla)}
                    >
                      {plantilla.activo ? (
                        <span className="text-red-500">●</span>
                      ) : (
                        <span className="text-green-500">●</span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPlantillaToDelete(plantilla)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          <AlertDialog open={!!plantillaToDelete} onOpenChange={(open) => !open && setPlantillaToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. La plantilla "{plantillaToDelete?.nombre}" será eliminada permanentemente.
                  {plantillaToDelete?._count?.documentos > 0 && (
                    <span className="block mt-2 text-destructive font-medium">
                      ⚠️ Esta plantilla tiene {plantillaToDelete._count.documentos} documento(s) asociado(s) y no se puede eliminar.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete} 
                  className="bg-destructive text-destructive-foreground"
                  disabled={plantillaToDelete?._count?.documentos > 0}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
  )
}