'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  crearGastoRecurrenteAction,
  generarGastosRecurrentesAction,
  listarGastoRecurrentesAction,
  updateGastoRecurrenteAction,
} from '@/features/gastosDE/recurrentes'
import { toast } from 'sonner'
import { getEmpleadosAction } from '@/features/empleados/actions'
import { getGastoConceptosAction, getGastoElementosAction } from '@/features/gastosDE/actions'

interface GastosRecurrentesPanelProps {
  vendors: Array<{ vendorId: string; nombre: string }>
}

type Plantilla = {
  gastoRecurrenteId: string
  nombre: string
  monto: number
  moneda: string
  frecuencia: string
  diaGeneracion: number
  proximaGeneracion: string | Date
  activo: boolean
}

/** @description Gestiona plantillas y generación idempotente de gastos recurrentes. */
export function GastosRecurrentesPanel({ vendors }: GastosRecurrentesPanelProps) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [dia, setDia] = useState('1')
  const [frecuencia, setFrecuencia] = useState('MENSUAL')
  const [empleadoId, setEmpleadoId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [conceptoId, setConceptoId] = useState('')
  const [elementoId, setElementoId] = useState('')
  const [conceptos, setConceptos] = useState<Array<{ conceptoId: string; nombre: string }>>([])
  const [elementos, setElementos] = useState<Array<{ elementoId: string; nombre: string }>>([])
  const [empleados, setEmpleados] = useState<Array<{ empleadoId: string; nombre: string; apellido: string }>>([])
  const [busy, setBusy] = useState(false)

  const cargar = useCallback(async () => {
    const result = await listarGastoRecurrentesAction({})
    if (result.success) setPlantillas((result.data?.items ?? []) as Plantilla[])
  }, [])

  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => {
    getEmpleadosAction(undefined).then((result) => {
      if (result.success) setEmpleados((result.data ?? []) as typeof empleados)
    })
  }, [])
  useEffect(() => {
    getGastoConceptosAction({}).then((result) => {
      if (result.success) setConceptos((result.data ?? []) as typeof conceptos)
    })
  }, [])
  useEffect(() => {
    if (!conceptoId) return setElementos([])
    getGastoElementosAction(conceptoId).then((result) => {
      if (result.success) setElementos((result.data ?? []) as typeof elementos)
    })
  }, [conceptoId])

  async function crear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await crearGastoRecurrenteAction({
      nombre,
      monto: Math.round(Number(monto) * 100),
      empleadoId: empleadoId || null,
      proveedorId: proveedorId || null,
      conceptoId: conceptoId || null,
      elementoId: elementoId || null,
      moneda: 'CUP',
      frecuencia: frecuencia as 'MENSUAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL',
      diaGeneracion: Number(dia),
    })
    setBusy(false)
    if (!result.success) return toast.error(result.error?.message || 'No se pudo crear la plantilla')
    setNombre('')
    setMonto('')
    toast.success('Plantilla recurrente creada')
    await cargar()
  }

  async function generar() {
    setBusy(true)
    const result = await generarGastosRecurrentesAction({})
    setBusy(false)
    if (!result.success) return toast.error(result.error?.message || 'No se pudieron generar los gastos')
    toast.success(`${result.data?.generados ?? 0} gastos generados; ${result.data?.omitidos ?? 0} ya existían`)
    await cargar()
  }

  async function alternar(plantilla: Plantilla) {
    const result = await updateGastoRecurrenteAction({ gastoRecurrenteId: plantilla.gastoRecurrenteId, activo: !plantilla.activo })
    if (!result.success) return toast.error(result.error?.message || 'No se pudo actualizar la plantilla')
    await cargar()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Gastos recurrentes</CardTitle>
        <Button type="button" variant="outline" onClick={generar} disabled={busy}>Generar pendientes</Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" aria-label="Nueva plantilla recurrente">
          <Input aria-label="Nombre de la plantilla" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={120} />
          <Input aria-label="Monto recurrente" type="number" min="0.01" step="0.01" placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} required />
          <select aria-label="Frecuencia" className="h-10 rounded-md border bg-background px-3 text-sm" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
            <option value="MENSUAL">Mensual</option><option value="BIMESTRAL">Bimestral</option><option value="TRIMESTRAL">Trimestral</option><option value="SEMESTRAL">Semestral</option><option value="ANUAL">Anual</option>
          </select>
          <Input aria-label="Día de generación" type="number" min="1" max="28" value={dia} onChange={(e) => setDia(e.target.value)} required />
          <select aria-label="Empleado de la plantilla" className="h-10 rounded-md border bg-background px-3 text-sm" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
            <option value="">Sin empleado</option>{empleados.map((empleado) => <option key={empleado.empleadoId} value={empleado.empleadoId}>{empleado.nombre} {empleado.apellido}</option>)}
          </select>
          <select aria-label="Proveedor de la plantilla" className="h-10 rounded-md border bg-background px-3 text-sm" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor</option>{vendors.map((vendor) => <option key={vendor.vendorId} value={vendor.vendorId}>{vendor.nombre}</option>)}
          </select>
          <select aria-label="Concepto de la plantilla" className="h-10 rounded-md border bg-background px-3 text-sm" value={conceptoId} onChange={(e) => { setConceptoId(e.target.value); setElementoId('') }}>
            <option value="">Sin concepto</option>{conceptos.map((concepto) => <option key={concepto.conceptoId} value={concepto.conceptoId}>{concepto.nombre}</option>)}
          </select>
          <select aria-label="Elemento de la plantilla" className="h-10 rounded-md border bg-background px-3 text-sm" value={elementoId} onChange={(e) => setElementoId(e.target.value)} disabled={!conceptoId}>
            <option value="">Sin elemento</option>{elementos.map((elemento) => <option key={elemento.elementoId} value={elemento.elementoId}>{elemento.nombre}</option>)}
          </select>
          <Button type="submit" disabled={busy}>Crear plantilla</Button>
        </form>
        {plantillas.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay plantillas recurrentes.</p> : (
          <ul className="divide-y">
            {plantillas.map((plantilla) => (
              <li key={plantilla.gastoRecurrenteId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{plantilla.nombre}</p><p className="text-sm text-muted-foreground">{plantilla.frecuencia.toLowerCase()} · Día {plantilla.diaGeneracion} · Próxima generación: {new Intl.DateTimeFormat('es').format(new Date(plantilla.proximaGeneracion))}</p></div>
                <div className="flex items-center gap-3"><span>{(plantilla.monto / 100).toLocaleString('es', { minimumFractionDigits: 2 })} {plantilla.moneda}</span><Button type="button" variant="outline" onClick={() => alternar(plantilla)}>{plantilla.activo ? 'Desactivar' : 'Activar'}</Button></div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
