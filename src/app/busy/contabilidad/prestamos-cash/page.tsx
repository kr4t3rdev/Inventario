"use client"

import React, { useState, Suspense } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/animations"
import { useGetPrestamosCashQuery } from "@/lib/redux/services/prestamosCashApi"
import { useGetClientesQuery } from "@/lib/redux/services/ClienteApi"
import { useGetCuentasBancariasQuery, useGetTiposPagoQuery } from "@/lib/redux/services/contabilidadApi"
import { PrestamosCashTable } from "@/components/contabilidad/prestamos-cash/prestamos-cash-table"
import { PrestamoCashForm } from "@/components/contabilidad/prestamos-cash/prestamo-cash-form"
import { PagoPrestamoModal } from "@/components/contabilidad/prestamos-cash/pago-prestamo-modal"
import type { PrestamoCash } from "@/app/models/model"

const featureEnabled = process.env.NEXT_PUBLIC_ENABLE_PRESTAMOS_CASH !== "false"

/**
 * @description Contenido principal de la página de préstamos en efectivo.
 * @returns {JSX.Element} Contenido con tabla, form y modal de pago.
 */
function PrestamosCashContent() {
  const [openForm, setOpenForm] = useState(false)
  const [openPago, setOpenPago] = useState(false)
  const [prestamoSeleccionado, setPrestamoSeleccionado] = useState<PrestamoCash | null>(null)

  const { data: prestamos = [], isLoading, error, refetch } = useGetPrestamosCashQuery()
  const { data: dataClientes } = useGetClientesQuery()
  const { data: dataCuentas } = useGetCuentasBancariasQuery()
  const { data: dataTiposPago } = useGetTiposPagoQuery({})

  const clientes = dataClientes || []
  const cuentasBancarias = dataCuentas?.cuentas || []
  //console.log('cuentasBancarias:', dataCuentas);
  const tiposPago = dataTiposPago?.data || []

  const handlePagar = (prestamo: PrestamoCash) => {
    setPrestamoSeleccionado(prestamo)
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
            El módulo de préstamos en efectivo está deshabilitado.
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
          <h1 className="text-3xl font-bold">Préstamos en Efectivo</h1>
          <p className="text-muted-foreground">
            Gestione préstamos de dinero en efectivo a clientes
          </p>
        </div>
        <Button onClick={() => setOpenForm(true)}
          className="flex items-center space-x-2 mr-3">
          <Plus className="h-4 w-4" />
          Nuevo Préstamo
        </Button>
      </div>

      <PrestamosCashTable
        prestamos={prestamos}
        isLoading={isLoading}
        error={error}
        onPagar={handlePagar}
      />

      <PrestamoCashForm
        open={openForm}
        onOpenChange={setOpenForm}
        clientes={clientes.map((c: any) => ({
          clienteId: c.clienteId,
          nombre: c.nombre,
        }))}
        onSuccess={handleSuccess}
      />

      <PagoPrestamoModal
        prestamo={prestamoSeleccionado}
        open={openPago}
        onOpenChange={setOpenPago}
        cuentasBancarias={cuentasBancarias.map((c: any) => ({
          cuentaId: c.cuentaId,
          nombreBanco: c.nombreBanco,
          numeroCuenta: c.numeroCuenta,
          moneda: c.moneda
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
 * @description Página de gestión de préstamos en efectivo.
 * @returns {JSX.Element} Página con Suspense wrapper.
 */
export default function PrestamosCashPage() {
  return (
    <PageTransition>
      <StaggerContainer>
        <StaggerItem>
          <div className="container mx-auto py-6 space-y-6">
            <Suspense fallback={<Card><CardContent className="py-12">Cargando...</CardContent></Card>}>
              <PrestamosCashContent />
            </Suspense>
          </div>
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  )
}
