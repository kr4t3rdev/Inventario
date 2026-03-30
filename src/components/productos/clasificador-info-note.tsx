'use client'

import { useState } from 'react'
import { BookOpen, Download, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CATEGORY_TO_SECTION } from '@/lib/category-mapping'

/** Pares [código, nombre] de las 25 secciones del clasificador CLAS. */
const SECCIONES = Object.entries(CATEGORY_TO_SECTION).map(([nombre, codigo]) => ({
  codigo,
  nombre,
})).sort((a, b) => a.codigo.localeCompare(b.codigo))

/**
 * @description Nota informativa sobre el Clasificador EAN-13 (CLAS).
 * Muestra un aviso con un botón que abre un modal con las secciones disponibles
 * y opción de descargar el archivo de referencia completo.
 * @returns {JSX.Element} Nota con ícono y enlace al modal del clasificador
 */
export function ClasificadorInfoNote() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? SECCIONES.filter((s) =>
        s.nombre.toLowerCase().includes(search.toLowerCase()) ||
        s.codigo.includes(search)
      )
    : SECCIONES

  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/30">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="flex-1 space-y-1">
          <p className="font-medium text-blue-700 dark:text-blue-300">
            Modo EAN-13 activo
          </p>
          <p className="text-blue-600/80 dark:text-blue-400/80">
            Las categorías deben coincidir con el Clasificador oficial (CLAS). El código
            EAN-13 se genera automáticamente a partir de la sección y el específico.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/40"
          onClick={() => setOpen(true)}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Ver CLAS
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Clasificador CLAS — Secciones
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Buscar sección o código…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearch('')}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <ScrollArea className="h-72 rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="py-2 pl-3 pr-2 text-left font-semibold text-muted-foreground">
                      Código
                    </th>
                    <th className="py-2 pl-2 pr-3 text-left font-semibold text-muted-foreground">
                      Sección
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-6 text-center text-muted-foreground">
                        Sin resultados
                      </td>
                    </tr>
                  ) : (
                    filtered.map((seccion) => (
                      <tr
                        key={seccion.codigo}
                        className="border-b last:border-0 hover:bg-muted/40"
                      >
                        <td className="py-1.5 pl-3 pr-2 font-mono text-xs font-semibold text-primary">
                          {seccion.codigo}
                        </td>
                        <td className="py-1.5 pl-2 pr-3 text-foreground">
                          {seccion.nombre}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              {SECCIONES.length} secciones disponibles · El específico (4 dígitos) se
              selecciona al crear el producto según la subcategoría elegida.
            </p>
          </div>

          <div className="flex justify-between border-t pt-3">
            <a
              href="/clasificador.md"
              download="clasificador-clas.md"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              Descargar clasificador completo
            </a>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
