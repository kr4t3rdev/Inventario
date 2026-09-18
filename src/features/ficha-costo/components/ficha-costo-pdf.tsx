'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FichaCostoData } from '../actions'

interface FichaCostoPdfProps {
  data: FichaCostoData
  /** Ref al contenedor del que se captura el snapshot. */
  targetRef: React.RefObject<HTMLElement | null>
  className?: string
}

/**
 * @description Genera un PDF a partir de un snapshot del DOM usando
 *   html2canvas + jspdf. Carga ambas dependencias de forma dinámica
 *   para no inflar el bundle de la ficha.
 */
export function FichaCostoPdf({ data, targetRef, className }: FichaCostoPdfProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!targetRef.current) {
      setError('No se encontró el contenido a exportar')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const JsPDF = jspdfMod.jsPDF ?? jspdfMod.default
      const canvas = await html2canvas(targetRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new JsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth - 40
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      if (imgHeight < pageHeight - 40) {
        pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight)
      } else {
        // Paginación simple: trocear por altura
        let position = 0
        let remaining = imgHeight
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 20, 20 - position, imgWidth, imgHeight)
          remaining -= pageHeight - 40
          position += pageHeight - 40
          if (remaining > 0) pdf.addPage()
        }
      }

      const filename = `ficha-costo-${data.producto.codigoInterno ?? data.producto.id}-${new Date().toISOString().slice(0, 10)}.pdf`
      pdf.save(filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando PDF')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={className}>
      <Button onClick={handleClick} disabled={isLoading} className="gap-2">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {isLoading ? 'Generando PDF…' : 'Exportar PDF'}
      </Button>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
