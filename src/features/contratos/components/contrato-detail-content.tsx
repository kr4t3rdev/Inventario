'use client'

import { useEffect, useState , useRef} from "react"
import { useParams, useRouter } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calendar, FileText, Building2, User, Clock, CheckCircle2, AlertTriangle, Pencil, Paperclip, Download } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getAuthToken } from "@/lib/token"
import { FileUpload } from "@/components/file-upload"
import { NewVersionDialog } from "@/features/contratos"
import { LazyMotion, m as motion } from "framer-motion"

interface Usuario {
  userId: string
  name: string
  email: string
}

interface Cliente {
  clienteId: string
  nombre: string
  empresa: string
  email: string
  telefono: string
  logoUrl?: string | null
}

interface Vendor {
  vendorId: string
  nombre: string
  email: string
  telefono: string
  logo?: string | null
}

interface Version {
  versionId: string
  numeroVersion: number
  cambios: string
  createdAt: string
  creadoPor: string
}

interface Firma {
  firmaId: string
  firmante: Usuario
  fechaFirma: string
  estado: string
}

interface Aprobacion {
  aprobacionId: string
  aprobador: Usuario
  fechaAprobacion: string
  estado: string
  comentarios: string | null
}

interface ContratoArchivo {
  archivoId: string
  nombreArchivo: string
  rutaArchivo: string
  tipo: string
  createdAt: string
  generador: Usuario
}

interface ContratoDetail {
  contratoId: string
  numeroContrato: string
  observaciones: string | null
  condiciones: unknown
  tipo: string
  estado: string
  fechaInicio: string
  fechaFin: string | null
  monto: string | null
  moneda: string
  esMultiMoneda: boolean
  cliente?: Cliente | null
  vendor?: Vendor | null
  creador: Usuario
  aprobador?: Usuario | null
  versiones: Version[]
  firmas: Firma[]
  aprobaciones: Aprobacion[]
  archivos: ContratoArchivo[]
  createdAt: string
  updatedAt: string
}

interface ContratoDetailContentProps {
  initialData?: ContratoDetail
  contratoId: string
}

/**
 * @description Componente de contenido para detalle de contrato
 * @param {ContratoDetailContentProps} props - Props del componente
 * @returns {JSX.Element} Componente de detalle de contrato
 */
export function ContratoDetailContent({ initialData, contratoId }: ContratoDetailContentProps) {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string || contratoId
  const [contrato, setContrato] = useState<ContratoDetail | null>(initialData || null)
  const [isLoading, setIsLoading] = useState(!initialData)
  const partyImageError = useRef(false)

  useEffect(() => {
    if (initialData) {
      setIsLoading(false)
      return
    }
    if (id) {
      fetchContrato(id)
    }
  }, [id, initialData])

  const fetchContrato = async (contratoId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/contratos/${contratoId}`, {
        headers: {
          'Authorization': getAuthToken(),
        },
      })

      if (!response.ok) {
        throw new Error('Error al cargar el contrato')
      }

      const data = await response.json()
      setContrato({
        ...data,
        versiones: (data.versiones || []).map((version: Version & { fechaCreacion?: string }) => ({
          ...version,
          createdAt: version.createdAt || version.fechaCreacion || '',
        })),
      })
    } catch (error) {
      console.error('Error:', error)
      toast.error('No se pudo cargar la información del contrato')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    partyImageError.current = false)
  }, [contrato?.contratoId, contrato?.cliente?.logoUrl, contrato?.vendor?.logo])

  const getEstadoBadge = (estado: string) => {
    const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      BORRADOR: 'secondary',
      PENDIENTE_APROBACION: 'outline',
      APROBADO: 'default',
      RECHAZADO: 'destructive',
      ACTIVO: 'default',
      FINALIZADO: 'secondary',
      ANULADO: 'destructive',
    }

    return (
      <Badge variant={variantMap[estado] || 'secondary'}>
        {estado.replace(/_/g, ' ')}
      </Badge>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: string | null, currency: string) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'CUP'
    }).format(Number(amount))
  }

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (!contrato) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-4">
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h2 className="text-xl font-semibold">Contrato no encontrado</h2>
              <p className="text-muted-foreground">El contrato solicitado no existe o ha sido eliminado.</p>
              <Button asChild className="mt-4">
                <Link href="/busy/contratos">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver a contratos
                </Link>
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          {/* Header */}
          <motion.div
            className="flex items-center gap-4 mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button variant="outline" size="icon" asChild>
              <Link href="/busy/contratos">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Contrato {contrato.numeroContrato}</h1>
                {getEstadoBadge(contrato.estado)}
              </div>
              <p className="text-muted-foreground">
                Creado por {contrato.creador.name} • {formatDate(contrato.createdAt)}
              </p>
            </div>
            <Button asChild>
              <Link href={`/busy/contratos/update/${contrato.contratoId}`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          </motion.div>

          {/* Tabs */}
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="versiones">Versiones ({contrato.versiones?.length || 0})</TabsTrigger>
              <TabsTrigger value="firmas">Firmas ({contrato.firmas?.length || 0})</TabsTrigger>
              <TabsTrigger value="aprobaciones">Aprobaciones ({contrato.aprobaciones?.length || 0})</TabsTrigger>
              <TabsTrigger value="archivos">Archivos ({contrato.archivos?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Info Basic */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Información del Contrato
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                        <p className="font-medium">{contrato.tipo}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Estado</label>
                        <p className="font-medium">{getEstadoBadge(contrato.estado)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Fecha Inicio</label>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(contrato.fechaInicio)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Fecha Fin</label>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(contrato.fechaFin)}
                        </p>
                      </div>
                      {contrato.monto && (
                        <div className="col-span-2">
                          <label className="text-sm font-medium text-muted-foreground">Monto</label>
                          <p className="font-medium text-lg">
                            {formatCurrency(contrato.monto, contrato.moneda)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Party Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {contrato.cliente ? 'Cliente' : contrato.vendor ? 'Proveedor' : 'Parte'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contrato.cliente ? (
                      <div className="space-y-2">
                        <p className="font-medium">{contrato.cliente.nombre}</p>
                        <p className="text-sm text-muted-foreground">{contrato.cliente.empresa}</p>
                        <p className="text-sm">{contrato.cliente.email}</p>
                        <p className="text-sm">{contrato.cliente.telefono}</p>
                      </div>
                    ) : contrato.vendor ? (
                      <div className="space-y-2">
                        <p className="font-medium">{contrato.vendor.nombre}</p>
                        <p className="text-sm">{contrato.vendor.email}</p>
                        <p className="text-sm">{contrato.vendor.telefono}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No hay parte asociada</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {contrato.observaciones && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Observaciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{contrato.observaciones}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="versiones" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Historial de Versiones</CardTitle>
                  <NewVersionDialog contratoId={contrato.contratoId} onSuccess={() => { window.location.reload() }} />
                </CardHeader>
                <CardContent>
                  {contrato.versiones?.length ? (
                    <div className="space-y-4">
                      {contrato.versiones.map((version) => (
                        <div key={version.versionId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Versión {version.numeroVersion}</p>
                              <p className="text-sm text-muted-foreground">{version.cambios}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Creado: {formatDate(version.createdAt)}
                              </p>
                            </div>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No hay versiones</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="firmas" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Firmas</CardTitle>
                </CardHeader>
                <CardContent>
                  {contrato.firmas?.length ? (
                    <div className="space-y-4">
                      {contrato.firmas.map((firma) => (
                        <div key={firma.firmaId} className="border rounded-lg p-4 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{firma.firmante.name}</p>
                            <p className="text-sm text-muted-foreground">{firma.firmante.email}</p>
                            <p className="text-xs text-muted-foreground">Firmado: {formatDate(firma.fechaFirma)}</p>
                          </div>
                          <Badge variant={firma.estado === 'FIRMADA' ? 'default' : 'secondary'}>
                            {firma.estado}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No hay firmas</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="aprobaciones" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Aprobaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  {contrato.aprobaciones?.length ? (
                    <div className="space-y-4">
                      {contrato.aprobaciones.map((aprob) => (
                        <div key={aprob.aprobacionId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{aprob.aprobador.name}</p>
                              <p className="text-sm text-muted-foreground">{aprob.aprobador.email}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Fecha: {formatDate(aprob.fechaAprobacion)}
                              </p>
                              {aprob.comentarios && (
                                <p className="mt-2 text-sm">{aprob.comentarios}</p>
                              )}
                            </div>
                            <Badge variant={aprob.estado === 'APROBADA' ? 'default' : aprob.estado === 'RECHAZADA' ? 'destructive' : 'secondary'}>
                              {aprob.estado}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No hay aprobaciones</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="archivos" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Archivos Adjuntos</CardTitle>
                </CardHeader>
                <CardContent>
                  <FileUpload
  // @ts-expect-error - FileUpload espera un endpoint tipado por el sistema de uploads.
                    endpoint="contratoArchivo"
                    entityId={contrato.contratoId}
                    accept={["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]}
                    maxSize={10 * 1024 * 1024}
                  />
                  {contrato.archivos?.length ? (
                    <div className="mt-4 space-y-2">
                      {contrato.archivos.map((archivo) => (
                        <div key={archivo.archivoId} className="flex items-center justify-between border rounded p-3">
                          <div className="flex items-center gap-3">
                            <Paperclip className="h-4 w-4" />
                            <span>{archivo.nombreArchivo}</span>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
