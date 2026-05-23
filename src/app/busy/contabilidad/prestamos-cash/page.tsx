"use client"

import React, { useState, Suspense, useEffect } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/animations"
import { getClientesAction } from "@/features/clientes"
import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { getTasasActualesAction } from "@/features/contabilidad/actions-exchange"
import { getTiposPagoAction } from "@/features/contabilidad/actions-tipos-pago"
import { getPrestamosCashAction } from "@/features/contabilidad/actions-prestamos-cash"
import { PrestamosCashTable } from "@/features/contabilidad/components/prestamos-cash/prestamos-cash-table"
import { PrestamoCashForm } from "@/features/contabilidad/components/prestamos-cash/prestamo-cash-form"
import { PagoPrestamoModal } from "@/features/contabilidad/components/prestamos-cash/pago-prestamo-modal"
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

  const [prestamos, setPrestamos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  const loadPrestamos = async () => {
    setIsLoading(true)
    const r = await getPrestamosCashAction({})
    if (r.success) setPrestamos(r.data?.prestamos ?? [])
    else setError(r.error)
    setIsLoading(false)
  }

  useEffect(() => { loadPrestamos() }, [])

  const [clientes, setClientes] = useState<any[]>([])
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([])
  const [tiposPago, setTiposPago] = useState<any[]>([])
  const [tasasData, setTasasData] = useState<{ monedaPrincipal?: { codigo?: string }; tasas?: Array<{ monedaOrigenId: string; tasa: number }> }>({})

  useEffect(() => {
    getClientesAction().then(r => { if (r.success) setClientes(r.data ?? []) })
    getCuentasBancariasAction().then(r => { if (r.success) setCuentasBancarias(r.data?.cuentas ?? []) })
    getTiposPagoAction({}).then(r => { if (r.success) setTiposPago(r.data?.data ?? []) })
    getTasasActualesAction().then(r => {
      if (r.success) {
        const payload = r.data as unknown as { monedaPrincipal?: { codigo?: string }; tasas?: Array<{ monedaOrigenId: string; tasa: number }> } | undefined
        setTasasData(payload ?? {})
      }
    })
  }, [])

  const handlePagar = (prestamo: PrestamoCash) => {
    setPrestamoSeleccionado(prestamo)
    setOpenPago(true)
  }

  const handleSuccess = () => {
    loadPrestamos()
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
        cuentasBancarias={cuentasBancarias.map((c: any) => ({
          cuentaId: c.cuentaId,
          nombreBanco: c.nombreBanco,
          tipoCuenta: c.tipoCuenta,
          moneda: c.moneda,
        }))}
        tasasData={tasasData}
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
