"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DefectacionesEditorPanel } from '@/features/configuracion/components/defectaciones-editor-panel'

// Configuración de catálogo para reparaciones
export default function CatalogoConfiguracionPage(): React.JSX.Element {
  // Moneda de Catálogo (fija en USD) y tasa de conversión -> CUP
  const [currencyCode, setCurrencyCode] = useState<string>('USD')
  const [exchangeRate, setExchangeRate] = useState<number>(1)

  useEffect(() => {
    // Cargar config del catálogo (moneda base)
    let mounted = true
    const loadConfig = async () => {
      try {
        const token = sessionStorage.getItem('token')
        const res = await fetch('/api/reparaciones/catalogo/config', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (res.ok) {
          const data = await res.json()
          const code = (data?.monedaId || data?.moneda?.codigo || 'USD') as string
          if (mounted) setCurrencyCode(code)
        }
      } catch {
        // ignore
      }
    }
    loadConfig()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    // Cargar tasa moneda catálogo -> CUP desde la API de exchange
    let mounted = true
    const load = async () => {
      try {
        const token = sessionStorage.getItem('token')
        const res = await fetch(`/api/exchange?from=${currencyCode}&to=CUP`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (res.status === 401) {
          throw new Error('Sesión expirada')
        }
        if (res.ok) {
          const data = await res.json()
          const r = Number(data?.rate) || 1
          if (mounted) setExchangeRate(r)
        }
      } catch {
        if (mounted) setExchangeRate(1)
      }
    }
    load()
    return () => { mounted = false }
  }, [currencyCode])

  const handleNuevoEquipo = () => {
    // Placeholder
    console.log('Nuevo equipo (placeholder)')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuración de Catálogo</h1>
        <div className="flex gap-2">
          <Button onClick={handleNuevoEquipo}>Nuevo Equipo</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <DefectacionesEditorPanel />
        <div className="border rounded-md p-4 bg-muted/10 h-full">
          <h3 className="text-lg font-semibold mb-2">Moneda de Catálogo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Moneda</label>
              <div className="text-sm font-medium">{currencyCode} (fija)</div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Tasa {currencyCode} {'->'} CUP</label>
              <div className="text-sm">{exchangeRate} </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={async () => {
              // Recalcular tasa para asegurar consistent rate
              try {
                const token = sessionStorage.getItem('token')
                const res = await fetch(`/api/exchange?from=${currencyCode}&to=CUP`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                })
                if (res.status === 401) {
                  throw new Error('Sesión expirada')
                }
                if (res.ok) {
                  const data = await res.json()
                  setExchangeRate(Number(data?.rate) || 1)
                }
              } catch {
                // ignore
              }
            }}>Recalcular</button>
          </div>
        </div>
      </div>

      <div className="border rounded-md p-4 bg-muted/10 h-full">
        <h3 className="text-lg font-semibold mb-2">Guía rápida</h3>
        <p className="text-sm text-muted-foreground">Aquí podrá gestionar defectaciones y costos asociados al equipo defectado. El catálogo se maneja en USD y se convierte a CUP al cargar órdenes. La conversión monetaria se gestiona vía el sistema contable existente.</p>
        <Link href="/busy/configuracion/catalogo" className="text-sm text-blue-600 mt-4 inline-block">Ver detalle</Link>
      </div>
    </div>
  )
}
