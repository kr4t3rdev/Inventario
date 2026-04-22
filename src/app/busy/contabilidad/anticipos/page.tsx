"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { getAuthToken } from "@/lib/token"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/animations"
import { useGetAnticiposQuery, useGetAnticipoByIdQuery, useGetCuentasBancariasQuery } from "@/lib/redux/services/contabilidadApi"
import { useGetClientesQuery } from "@/lib/redux/services/ClienteApi"
import { useGetVendorsQuery } from "@/lib/redux/services/vendorsApi"
import { AnticiposTable } from "@/components/contabilidad/anticipos/anticipos-table"
import { AnticipoForm } from "@/components/contabilidad/anticipos/anticipo-form"
import { AnticipoDetail } from "@/components/contabilidad/anticipos/anticipo-detail"
import { AnticipoEjecutarDialog } from "@/components/contabilidad/anticipos/anticipo-ejecutar-dialog"
import { AnticipoRevertirDialog } from "@/components/contabilidad/anticipos/anticipo-revertir-dialog"
import { ReportesAnticipos } from "@/components/contabilidad/anticipos/reportes-anticipos"
import { Anticipo } from "@/app/models/model"

const anticiposFeatureEnabled = process.env.NEXT_PUBLIC_ENABLE_ANTICIPOS !== "false"

interface ContratoAnticipo {
  contratoId: string
  numeroContrato?: string
  clienteId?: string | null
  vendorId?: string | null
}

function AnticiposContent() {
  const searchParams = useSearchParams()
  
  // Estados para modals/dialogs
  const [openForm, setOpenForm] = useState(false)
  const [openDetail, setOpenDetail] = useState(false)
  const [openEjecutar, setOpenEjecutar] = useState(false)
  const [openRevertir, setOpenRevertir] = useState(false)
  const [anticipoSeleccionado, setAnticipoSeleccionado] = useState<Anticipo | null>(null)
  const [anticipoDetailId, setAnticipoDetailId] = useState<string | null>(null)
  const [tabActiva, setTabActiva] = useState("lista")
  const [contratos, setContratos] = useState<ContratoAnticipo[]>([])

  // Filtros desde URL
  const tipoFilter = searchParams.get("tipo") as "PAGO" | "COBRO" | null
  const estadoFilter = searchParams.get("estado") as "RESERVADO" | "EJECUTADO" | "ANULADO" | null

  // Queries
  const { data: dataAnticipos, isLoading: loadingAnticipos, refetch } = useGetAnticiposQuery({
    tipo: tipoFilter || undefined,
    estado: estadoFilter || undefined,
  })

  const { data: dataClientes } = useGetClientesQuery()
  const { data: dataProveedores } = useGetVendorsQuery()
  const { data: dataCuentas } = useGetCuentasBancariasQuery()

  // Query para detalle completo con movimientos enriquecidos
  const { data: anticipoDetailData, isLoading: loadingDetail } = useGetAnticipoByIdQuery(
    anticipoDetailId || '',
    { skip: !anticipoDetailId }
  )

  
  const anticipos = dataAnticipos?.anticipos || []
  const clientes = dataClientes || []
  const proveedores = dataProveedores || []
  const cuentasBancarias = dataCuentas?.cuentas || []

  useEffect(() => {
    const fetchContratos = async () => {
      try {
        const response = await fetch("/api/contratos?page=1&limit=500&tipo=ALL&estado=ALL", {
          headers: {
            Authorization: getAuthToken(),
          },
        })

        if (!response.ok) {
          console.error("Error cargando contratos:", response.status)
          return
        }

        const payload = await response.json()
        setContratos(Array.isArray(payload?.data) ? payload.data : [])
      } catch (error) {
        console.error("Error al obtener contratos para anticipos:", error)
      }
    }

    fetchContratos()
  }, [])

  // Handlers
  const handleVerDetalle = (anticipo: Anticipo) => {
    setAnticipoSeleccionado(anticipo)
    setAnticipoDetailId(anticipo.anticipoId)
    setOpenDetail(true)
  }

  const handleEjecutar = (anticipo: Anticipo) => {
    setAnticipoSeleccionado(anticipo)
    setOpenEjecutar(true)
  }

  const handleRevertir = (anticipo: Anticipo) => {
    setAnticipoSeleccionado(anticipo)
    setOpenRevertir(true)
  }

  const handleSuccess = () => {
    refetch()
  }

  // Si el feature está deshabilitado, mostrar mensaje
  if (!anticiposFeatureEnabled) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            El módulo de anticipos está deshabilitado.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Contacte al administrador para habilitarlo.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Anticipos</h1>
          <p className="text-muted-foreground">
            Administre pagos y cobros adelantados
          </p>
        </div>
        <Button onClick={() => setOpenForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Anticipo
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tabActiva} onValueChange={setTabActiva}>
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        {/* Tab Lista */}
        <TabsContent value="lista">
          <AnticiposTable
            anticipos={anticipos}
            isLoading={loadingAnticipos}
            onVerDetalle={handleVerDetalle}
            onEjecutar={handleEjecutar}
            onRevertir={handleRevertir}
          />
        </TabsContent>

        {/* Tab Reportes */}
        <TabsContent value="reportes">
          <ReportesAnticipos
            clientes={clientes}
            proveedores={proveedores}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AnticipoForm
        open={openForm}
        onOpenChange={setOpenForm}
        contratos={contratos.map((c) => ({
          contratoId: c.contratoId,
          nombre: c.numeroContrato || c.contratoId,
          clienteId: c.clienteId || undefined,
          vendorId: c.vendorId || undefined,
        }))}
        clientes={clientes.map((c: any) => ({
          clienteId: c.clienteId,
          nombre: c.nombre,
        }))}
        proveedores={proveedores?.map((p: any) => ({
          vendorId: p.vendorId,
          nombre: p.nombre,
        }))}
        cuentasBancarias={cuentasBancarias.map((c: any) => ({
          cuentaId: c.cuentaId,
          nombreBanco: c.nombreBanco,
          numeroCuenta: c.numeroCuenta,
        }))}
        onSuccess={handleSuccess}
      />

      <AnticipoDetail
        anticipo={anticipoDetailData?.anticipo || anticipoSeleccionado}
        open={openDetail}
        onOpenChange={(open) => {
          setOpenDetail(open)
          if (!open) {
            setAnticipoDetailId(null)
          }
        }}
        onCerrar={() => {
          setOpenDetail(false)
          setAnticipoDetailId(null)
        }}
        isLoading={loadingDetail}
      />

      <AnticipoEjecutarDialog
        anticipo={anticipoSeleccionado}
        open={openEjecutar}
        onOpenChange={setOpenEjecutar}
        onSuccess={handleSuccess}
      />

      <AnticipoRevertirDialog
        anticipo={anticipoSeleccionado}
        open={openRevertir}
        onOpenChange={setOpenRevertir}
        onSuccess={handleSuccess}
      />
    </>
  )
}

/**
 * @description Página de gestión de anticipos en Contabilidad
 */
export default function AnticiposPage() {
  return (
    <PageTransition>
      <StaggerContainer>
        <StaggerItem>
          <div className="container mx-auto py-6 space-y-6">
            <Suspense fallback={<Card><CardContent className="py-12">Cargando...</CardContent></Card>}>
              <AnticiposContent />
            </Suspense>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  )
}
