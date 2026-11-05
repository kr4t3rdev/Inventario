"use client"

import React, { useState, Suspense, useEffect } from "react"
import { BadgeDollarSign, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { getCuentasBancariasAction } from "@/features/contabilidad/actions-cuentas-bancarias"
import { getTiposPagoAction } from "@/features/contabilidad/actions-tipos-pago"
import { getDeudasCashAction } from "@/features/contabilidad/actions-deudas-cash"
import { useVendors } from '@/features/vendors/hooks/use-vendors'
import { DeudasCashTable } from "@/features/contabilidad/components/deudas-cash/deudas-cash-table"
import { DeudaCashForm } from "@/features/contabilidad/components/deudas-cash/deuda-cash-form"
import { PagoDeudaModal } from "@/features/contabilidad/components/deudas-cash/pago-deuda-modal"
import type { DeudaCash } from "@/app/models/model"
import { AccountingPageShell } from "@/features/contabilidad/components/accounting-page-shell"
import { useAuth } from "@/contexts/auth-context"

const featureEnabled = process.env.NEXT_PUBLIC_ENABLE_DEUDAS_CASH !== "false"

/**
 * @description Contenido principal de la página de deudas en efectivo.
 * @returns {JSX.Element} Contenido con tabla, form y modal de pago.
 */
function DeudasCashContent() {
  const { user } = useAuth()
  const [openForm, setOpenForm] = useState(false)
  const [openPago, setOpenPago] = useState(false)
  const [deudaSeleccionada, setDeudaSeleccionada] = useState<DeudaCash | null>(null)

  const [deudas, setDeudas] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const canCreate = user?.role === 'admin' || user?.planFeatures?.['deudas-cash'] === true

  const loadDeudas = async () => {
    setIsLoading(true)
    const r = await getDeudasCashAction({})
    if (r.success) setDeudas(r.data?.deudas ?? [])
    else setError(r.error)
    setIsLoading(false)
  }

  useEffect(() => { loadDeudas() }, [])

  const { vendors: dataProveedores } = useVendors()
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([])
  const [tiposPago, setTiposPago] = useState<any[]>([])

  useEffect(() => {
    getCuentasBancariasAction().then(r => { if (r.success) setCuentasBancarias(r.data?.cuentas ?? []) })
    getTiposPagoAction({}).then(r => { if (r.success) setTiposPago(r.data?.data ?? []) })
  }, [])

  const proveedores = dataProveedores || []

  const handlePagar = (deuda: DeudaCash) => {
    setDeudaSeleccionada(deuda)
    setOpenPago(true)
  }

  const handleSuccess = () => {
    loadDeudas()
  }

  if (!featureEnabled) {
    return (
      <AccountingPageShell
        icon={BadgeDollarSign}
        title="Deudas en Efectivo"
        description="Gestione deudas de dinero en efectivo con proveedores"
      >
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
      </AccountingPageShell>
    )
  }

  return (
    <AccountingPageShell
      icon={BadgeDollarSign}
      title="Deudas en Efectivo"
      description="Gestione deudas de dinero en efectivo con proveedores"
      actions={canCreate ? (
        <Button onClick={() => setOpenForm(true)} className="flex items-center space-x-2 mr-3">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Deuda
        </Button>
      ) : undefined}
    >
      <DeudasCashTable
        deudas={deudas}
        isLoading={isLoading}
        error={error}
        onPagar={handlePagar}
      />

      {canCreate && <DeudaCashForm
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
      />}

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
    </AccountingPageShell>
  )
}

/**
 * @description Página de gestión de deudas en efectivo.
 * @returns {JSX.Element} Página con Suspense wrapper.
 */
export default function DeudasCashPage() {
  return (
    <Suspense fallback={<Card><CardContent className="py-12">Cargando...</CardContent></Card>}>
      <DeudasCashContent />
    </Suspense>
  )
}
