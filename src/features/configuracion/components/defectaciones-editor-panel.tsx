"use client";

import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

type DefectTariff = { id: string; defecto: string; costo: number }

// DB-backed defectaciones catalogo (persistencia via API)

const DEFAULTS: DefectTariff[] = []

// Persistencia migrada a DB; se eliminan load/save de localStorage

export function DefectacionesEditorPanel(): React.ReactElement {
  const [tariffs, setTariffs] = useState<DefectTariff[]>([])
  const [defecto, setDefecto] = useState<string>('')
  const [costo, setCosto] = useState<string>('')

  useEffect(() => {
    // Cargar defectaciones desde DB al inicio
    const loadFromDb = async () => {
      try {
        const token = '';
        const res = await fetch('/api/defectaciones', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (res.ok) {
          const data = await res.json()
          const items = (data?.defectaciones ?? []) as { id: string; defecto: string; costo: number }[]
          setTariffs(items.map((d) => ({ id: d.id, defecto: d.defecto, costo: d.costo })))
        }
      } catch (e) {
        console.error('Error loading defectaciones desde DB', e)
      }
    }
    loadFromDb()
  }, [])

  const addTarifa = async () => {
    const name = defecto.trim()
    const priceInput = parseFloat(costo)
    if (!name || Number.isNaN(priceInput) || priceInput < 0) return
    const payload = { defecto: name, costo: priceInput }
    try {
      const token = '';
      const res = await fetch('/api/defectaciones', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const created = await res.json()
        // El servicio devuelve { id, defecto, costo }
        const costoFront = Number(created.costo) || Math.round(priceInput * 100)
        setTariffs((t) => [...t, { id: created.id, defecto: created.defecto, costo: costoFront }])
        setDefecto('')
        setCosto('')
      } else {
        console.error('Error creando defecto en DB')
      }
    } catch (e) {
      console.error('Error creando defecto', e)
    }
  }

  const removeTarifa = async (id: string) => {
    try {
      const token = '';
      const res = await fetch(`/api/defectaciones/${id}`, { 
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        setTariffs((t) => t.filter(x => x.id !== id))
      } else {
        // Fallback UI: remove local si falla
        setTariffs((t) => t.filter(x => x.id !== id))
      }
    } catch {
      setTariffs((t) => t.filter(x => x.id !== id))
    }
  }

  const formatMoney = (n: number) => {
    if (typeof n !== 'number' || Number.isNaN(n)) return ''
    // 3,000.00 format
    const s = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `${s} USD`
  }
  return (
    <div className="border rounded-md p-4 mt-4 bg-muted/10" aria-label="Defectaciones editor panel">
      <h3 className="text-lg font-semibold mb-2">Defectaciones del catálogo</h3>
      <div className="flex gap-2 items-end">
        <Input placeholder="Tipo de defecto" value={defecto} onChange={(e) => setDefecto(e.target.value)} className="flex-1" />
        <CurrencyInput 
          placeholder="Costo (USD)" 
          value={costo} 
          onChange={setCosto} 
          className="w-32" 
        />
        <Button onClick={addTarifa}>Guardar</Button>
      </div>
      <div className="mt-4">
        {tariffs.length === 0 && <div className="text-sm text-muted-foreground">No hay defectaciones configuradas.</div>}
        {tariffs.length > 0 && (
          <table className="w-full text-sm" aria-label="Defectaciones lista">
            <thead>
              <tr>
                <th className="text-left">Defecto</th>
                <th className="text-right">Costo (USD)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tariffs.map(t => (
                <tr key={t.id}>
                  <td>{t.defecto}</td>
                  <td className="text-right">{formatMoney(t.costo)}</td>
                  <td className="text-right">
                    <button onClick={() => removeTarifa(t.id)} aria-label={`Eliminar ${t.defecto}`} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default DefectacionesEditorPanel
