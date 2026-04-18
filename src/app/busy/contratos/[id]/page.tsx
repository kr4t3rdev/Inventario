'use client'

import { useEffect, useState } from "react"
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
import { NewVersionDialog } from "@/components/contratos/new-version-dialog"

// Definir interfaces basadas en la respuesta de la API
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

export default function ContratoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [contrato, setContrato] = useState<ContratoDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [partyImageError, setPartyImageError] = useState(false)

  useEffect(() => {
    if (id) {
      fetchContrato(id)
    }
  }, [id])

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
    setPartyImageError(false)
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
      currency: currency || 'USD'
    }).format(Number(amount))
  }

  const formatCondiciones = (condiciones: unknown) => {
    if (!condiciones) return null
    if (typeof condiciones === 'string') return condiciones
    try {
      return JSON.stringify(condiciones, null, 2)
    } catch {
      return String(condiciones)
    }
  }

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset>
          <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-48 bg-muted animate-pulse rounded-lg" />
              </div>
              <div className="h-96 bg-muted animate-pulse rounded-lg" />
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
          <div className="container mx-auto py-6 flex flex-col items-center justify-center min-h-[50vh]">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Contrato no encontrado</h2>
            <p className="text-muted-foreground mb-6">El contrato que buscas no existe o ha sido eliminado.</p>
            <Button onClick={() => router.push('/busy/contratos')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la lista
            </Button>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/busy/contratos">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  {contrato.numeroContrato}
                  {getEstadoBadge(contrato.estado)}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {contrato.tipo} • Creado el {formatDate(contrato.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/busy/contratos/update/${contrato.contratoId}`}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              {/* General Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Tipo de Contrato</h3>
                      <p className="text-base font-medium">{contrato.tipo}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Monto Total</h3>
                      <p className="text-base font-medium">{formatCurrency(contrato.monto, contrato.moneda)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Fecha de Inicio</h3>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(contrato.fechaInicio)}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Fecha de Finalización</h3>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(contrato.fechaFin)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {contrato.observaciones && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Observaciones</h3>
                        <p className="text-sm leading-relaxed">{contrato.observaciones}</p>
                      </div>
                    </>
                  )}

                  {Boolean(contrato.condiciones) && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">Condiciones</h3>
                        <pre className="text-xs leading-relaxed whitespace-pre-wrap rounded-md bg-muted p-3">
                          {formatCondiciones(contrato.condiciones)}
                        </pre>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Tabs for Versions, Approvals, Signatures, Files */}
              <Tabs defaultValue="versiones" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="versiones">Versiones</TabsTrigger>
                  <TabsTrigger value="archivos">Archivos</TabsTrigger>
                  {/* <TabsTrigger value="aprobaciones">Aprobaciones</TabsTrigger>
                  <TabsTrigger value="firmas">Firmas</TabsTrigger> */}
                </TabsList>
                
                <TabsContent value="versiones" className="mt-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Historial de Versiones</CardTitle>
                        <CardDescription>Registro de cambios del contrato</CardDescription>
                      </div>
                      <NewVersionDialog 
                        contratoId={contrato.contratoId} 
                        onSuccess={() => fetchContrato(contrato.contratoId)} 
                      />
                    </CardHeader>
                    <CardContent>
                      {contrato.versiones.length > 0 ? (
                        <div className="space-y-4">
                          {contrato.versiones.map((version) => (
                            <div key={version.versionId} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                              <div className="bg-primary/10 text-primary rounded-full p-2 h-8 w-8 flex items-center justify-center text-xs font-bold">
                                v{version.numeroVersion}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <p className="font-medium text-sm">Modificado por {version.creadoPor}</p>
                                  <span className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{version.cambios || 'Sin descripción de cambios'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-4">No hay versiones registradas</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="archivos" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Archivos Adjuntos</CardTitle>
                      <CardDescription>Documentos relacionados con el contrato</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <FileUpload 
                        contratoId={contrato.contratoId} 
                        onUploadComplete={() => fetchContrato(contrato.contratoId)} 
                      />
                      
                      {contrato.archivos && contrato.archivos.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <h3 className="text-sm font-medium">Archivos Subidos</h3>
                            <div className="grid grid-cols-1 gap-2">
                              {contrato.archivos.map((archivo) => (
                                <div key={archivo.archivoId} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded">
                                      <Paperclip className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm truncate max-w-[200px] sm:max-w-[300px]">{archivo.nombreArchivo}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Subido por {archivo.generador?.name || 'Sistema'} • {formatDate(archivo.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="icon" asChild>
                                    <a href={archivo.rutaArchivo} target="_blank" rel="noopener noreferrer" download>
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
{/* 
                <TabsContent value="aprobaciones" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Estado de Aprobaciones</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {contrato.aprobaciones.length > 0 ? (
                        <div className="space-y-4">
                          {contrato.aprobaciones.map((aprobacion) => (
                            <div key={aprobacion.aprobacionId} className="flex items-start gap-4">
                              <CheckCircle2 className={`h-5 w-5 ${aprobacion.estado === 'APROBADO' ? 'text-green-500' : 'text-gray-300'}`} />
                              <div>
                                <p className="font-medium text-sm">{aprobacion.aprobador?.name || 'Usuario desconocido'}</p>
                                <p className="text-xs text-muted-foreground">{aprobacion.aprobador?.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline">{aprobacion.estado}</Badge>
                                  <span className="text-xs text-muted-foreground">{formatDate(aprobacion.fechaAprobacion)}</span>
                                </div>
                                {aprobacion.comentarios && (
                                  <p className="text-sm mt-2 p-2 bg-muted rounded italic">"{aprobacion.comentarios}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-4">No hay aprobaciones registradas</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="firmas" className="mt-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Firmas Digitales</CardTitle>
                        <CardDescription>Registro de firmas del contrato</CardDescription>
                      </div>
                      <AddFirmaDialog 
                        contratoId={contrato.contratoId}
                        users={users}
                        onSuccess={() => fetchContrato(contrato.contratoId)}
                      />
                    </CardHeader>
                    <CardContent>
                       {contrato.firmas.length > 0 ? (
                        <div className="space-y-4">
                          {contrato.firmas.map((firma) => (
                            <div key={firma.firmaId} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{firma.firmante?.name || 'Usuario desconocido'}</p>
                                  <p className="text-xs text-muted-foreground">{firma.firmante?.email}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={firma.estado === 'FIRMADO' ? 'default' : 'secondary'}>
                                  {firma.estado}
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-1">{formatDate(firma.fechaFirma)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-4">No hay firmas registradas</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
*/}
              </Tabs>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              {/* Party Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Parte Involucrada
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contrato.cliente ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        {contrato.cliente.logoUrl && !partyImageError ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={contrato.cliente.logoUrl}
                            alt={`Logo de ${contrato.cliente.empresa || contrato.cliente.nombre}`}
                            className="h-20 w-20 rounded border object-cover"
                            onError={() => setPartyImageError(true)}
                          />
                        ) : (
                          <div className="h-20 w-20 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                            {(contrato.cliente.empresa || contrato.cliente.nombre || 'CL').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{contrato.cliente.empresa || contrato.cliente.nombre}</p>
                          <Badge variant="outline">Cliente</Badge>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Contacto:</span>
                          <span className="font-medium">{contrato.cliente.nombre}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{contrato.cliente.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Teléfono:</span>
                          <span className="font-medium">{contrato.cliente.telefono}</span>
                        </div>
                      </div>
                    </div>
                  ) : contrato.vendor ? (
                    <div className="space-y-4">
                       <div className="flex items-center gap-3">
                        {contrato.vendor.logo && !partyImageError ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={contrato.vendor.logo}
                            alt={`Logo de ${contrato.vendor.nombre}`}
                            className="h-14 w-14 rounded-full border object-cover"
                            onError={() => setPartyImageError(true)}
                          />
                        ) : (
                          <div className="h-14 w-14 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold">
                            {(contrato.vendor.nombre || 'PR').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{contrato.vendor.nombre}</p>
                          <Badge variant="outline">Proveedor</Badge>
                        </div>
                      </div>
                      <Separator />
                       <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium">{contrato.vendor.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Teléfono:</span>
                          <span className="font-medium">{contrato.vendor.telefono}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay información de la contraparte</p>
                  )}
                </CardContent>
              </Card>

              {/* Internal Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información Interna</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block mb-1">Creado por:</span>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{contrato.creador?.name || 'Sistema'}</span>
                    </div>
                  </div>
                  {contrato.aprobador && (
                     <div>
                      <span className="text-muted-foreground block mb-1">Aprobador asignado:</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span>{contrato.aprobador?.name || 'Desconocido'}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block mb-1">Modo de Moneda:</span>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{contrato.esMultiMoneda ? 'Multimoneda' : 'Moneda única'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
