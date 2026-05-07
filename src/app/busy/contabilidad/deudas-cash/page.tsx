"use client"

import React, { useState, Suspense } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/animations"
import { useGetDeudasCashQuery } from "@/lib/redux/services/deudasCashApi"
import { useGetVendorsQuery } from "@/features/vendors/api/vendorsApi"
import { useGetCuentasBancariasQuery, useGetTiposPagoQuery } from "@/features/contabilidad/api/contabilidadApi"
import { DeudasCashTable } from "@/components/contabilidad/deudas-cash/deudas-cash-table"
import { DeudaCashForm } from "@/components/contabilidad/deudas-cash/deuda-cash-form"
import { PagoDeudaModal } from "@/components/contabilidad/deudas-cash/pago-deuda-modal"
import type { DeudaCash } from "@/app/models/model"

const featureEnabled = process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== "false"

/**
 * @description Contenido principal de la página de deudas en efectivo.
 * @returns {JSX.Element} Contenido con tabla, form y modal de pago.
 */
function DeudasCashContent() {
  const [openForm, setOpenForm] = useState(false)
  const [openPago, setOpenPago] = useState(false)
  const [deudaSeleccionada, setDeudaSeleccionada] = useState<DeudaCash | null>(null)

  const { data: deudas = [], isLoading, error, refetch } = useGetDeudasCashQuery()
  const { data: dataProveedores } = useGetVendorsQuery()
  const { data: dataCuentas } = useGetCuentasBancariasQuery()
  const { data: dataTiposPago } = useGetTiposPagoQuery({})

  const proveedores = dataProveedores || []
  const cuentasBancarias = dataCuentas?.cuentas || []
  const tiposPago = dataTiposPago?.data || []

  const handlePagar = (deuda: DeudaCash) => {
    setDeudaSeleccionada(deuda)
    setOpenPago(true)
  }

  const handleSuccess = () => {
    refetch()
  }

  if (!featureEnabled) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            El módulo de deudas en efectivo está deshabilitado.
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Deudas en Efectivo</h1>
          <p className="text-muted-foreground">
            Gestione deudas de dinero en efectivo con proveedores
          </p>
        </div>
        <Button onClick={() => setOpenForm(true)}
          className="flex items-center space-x-2 mr-3"
          >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Deuda
        </Button>
      </div>

      <DeudasCashTable
        deudas={deudas}
        isLoading={isLoading}
        error={error}
        onPagar={handlePagar}
      />

      <DeudaCashForm
        open={openForm}
        onOpenChange={setOpenForm}
        proveedores={proveedores.map((p: any) => ({
          vendorId: p.vendorId,
          nombre: p.nombre,
        }))}
        cuentasBancarias={cuentasBancarias.map((c: any) => ({
          cuentaId: c.cuentaId,
          nombreBanco: c.nombreBanco,
          tipoCuenta: c.tipoCuenta,
          moneda: c.moneda,
        }))}
        onSuccess={handleSuccess}
      />

      <PagoDeudaModal
        deuda={deudaSeleccionada}
        open={openPago}
        onOpenChange={setOpenPago}
        cuentasBancarias={cuentasBancarias.map((c: any) => ({
          cuentaId: c.cuentaId,
          nombreBanco: c.nombreBanco,
          numeroCuenta: c.numeroCuenta,
        }))}
        tiposPago={tiposPago.map((t: any) => ({
          tipoId: t.tipoId,
          nombre: t.nombre,
        }))}
        onSuccess={handleSuccess}
      />
    </>
    
  )
}

/**
 * @description Página de gestión de deudas en efectivo.
 * @returns {JSX.Element} Página con Suspense wrapper.
 */
export default function DeudasCashPage() {
  return (
    <PageTransition>
      <StaggerContainer>
        <StaggerItem>
          <div className="container mx-auto py-6 space-y-6">
            <Suspense fallback={<Card><CardContent className="py-12">Cargando...</CardContent></Card>}>
              <DeudasCashContent />
            </Suspense>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  )
}
