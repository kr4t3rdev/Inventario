'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Download, Info, Loader2, Search, X } from 'lucide-react'
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
import { parseClasClassifierMarkdown, type CLASClassifierData } from '@/lib/clas-classifier'

/** Pares [código, nombre] de las 25 secciones del clasificador CLAS. */
const SECCIONES = Object.entries(CATEGORY_TO_SECTION).map(([nombre, codigo]) => ({
  codigo,
  nombre,
})).sort((a, b) => a.codigo.localeCompare(b.codigo))

type ClasView = 'sections' | 'specifics'

interface ClasificadorInfoNoteProps {
  /**
   * Modo de visualización del clasificador.
   * - 'sections': muestra secciones con navegación drill-down a específicos (default).
   * - 'all-specifics': muestra todos los específicos en una lista plana con búsqueda.
   */
  mode?: 'sections' | 'all-specifics';
}

/**
 * @description Nota informativa sobre el Clasificador EAN-13 (CLAS).
 * Muestra un aviso con un botón que abre un modal con las secciones disponibles,
 * permite navegar a los específicos de cada sección, y ofrece búsqueda por nombre o ID.
 * @param {ClasificadorInfoNoteProps} props - Props del componente.
 * @returns {JSX.Element} Nota con ícono y enlace al modal del clasificador
 */
export function ClasificadorInfoNote({ mode = 'sections' }: ClasificadorInfoNoteProps) {
  const isAllSpecificsMode = mode === 'all-specifics'

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ClasView>(isAllSpecificsMode ? 'specifics' : 'sections')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [specificSearch, setSpecificSearch] = useState('')
  const [clasData, setClasData] = useState<CLASClassifierData | null>(null)
  const [clasLoading, setClasLoading] = useState(false)

  useEffect(() => {
    if (!open || clasData) {
      return
    }

    let cancelled = false
    setClasLoading(true)

    fetch('/clasificador.md', { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('No se pudo cargar el clasificador')
        }
        return response.text()
      })
      .then((markdown) => {
        if (!cancelled) {
          setClasData(parseClasClassifierMarkdown(markdown))
        }
      })
      .catch((error) => {
        console.error('Error loading CLAS classifier:', error)
      })
      .finally(() => {
        if (!cancelled) {
          setClasLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, clasData])

  useEffect(() => {
    if (!open) {
      setView(isAllSpecificsMode ? 'specifics' : 'sections')
      setSelectedSectionId(null)
      setSpecificSearch('')
      setSearch('')
    }
  }, [open, isAllSpecificsMode])

  const filteredSections = useMemo(() => {
    const term = search.trim()
    if (!term) {
      return SECCIONES
    }
    return SECCIONES.filter(
      (s) =>
        s.nombre.toLowerCase().includes(term.toLowerCase()) ||
        s.codigo.includes(term)
    )
  }, [search])

  const selectedSectionName = useMemo(() => {
    return SECCIONES.find((s) => s.codigo === selectedSectionId)?.nombre ?? ''
  }, [selectedSectionId])

  const sectionSpecifics = useMemo(() => {
    if (!clasData || !selectedSectionId) {
      return []
    }
    return clasData.specificsBySection[selectedSectionId] ?? []
  }, [clasData, selectedSectionId])

  const allSpecifics = useMemo(() => {
    if (!clasData) {
      return []
    }
    return clasData.specifics.map((sp) => ({
      ...sp,
      sectionName: clasData.sectionNameById[sp.sectionId] ?? sp.sectionId,
    }))
  }, [clasData])

  const filteredSpecifics = useMemo(() => {
    const term = specificSearch.trim().toLowerCase()
    if (!term) {
      return isAllSpecificsMode ? allSpecifics : sectionSpecifics
    }

    const source = isAllSpecificsMode ? allSpecifics : sectionSpecifics
    return source.filter(
      (sp) =>
        sp.name.toLowerCase().includes(term) ||
        sp.id.includes(term) ||
        ('sectionName' in sp && (sp as typeof allSpecifics[0]).sectionName.toLowerCase().includes(term))
    )
  }, [isAllSpecificsMode, allSpecifics, sectionSpecifics, specificSearch])

  const dialogTitle = useMemo(() => {
    if (isAllSpecificsMode) {
      return 'Clasificador CLAS — Específicos'
    }
    return view === 'sections'
      ? 'Clasificador CLAS — Secciones'
      : `Clasificador CLAS — Específicos de ${selectedSectionName}`
  }, [isAllSpecificsMode, view, selectedSectionName])

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
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {!isAllSpecificsMode && view === 'sections' ? (
              <>
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
                      {filteredSections.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-6 text-center text-muted-foreground">
                            Sin resultados
                          </td>
                        </tr>
                      ) : (
                        filteredSections.map((seccion) => (
                          <tr
                            key={seccion.codigo}
                            className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                            onClick={() => {
                              setSelectedSectionId(seccion.codigo)
                              setView('specifics')
                              setSpecificSearch('')
                            }}
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
                  {SECCIONES.length} secciones disponibles · Hacé click en una sección para ver sus específicos.
                </p>
              </>
            ) : (
              <>
                {!isAllSpecificsMode && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setView('sections')
                        setSelectedSectionId(null)
                        setSpecificSearch('')
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Volver a secciones
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar específico por nombre o ID…"
                    value={specificSearch}
                    onChange={(e) => setSpecificSearch(e.target.value)}
                    className="flex-1"
                  />
                  {specificSearch && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSpecificSearch('')}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {clasLoading ? (
                  <div className="flex min-h-72 items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Cargando específicos…
                  </div>
                ) : (
                  <ScrollArea className="h-72 rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                        <tr>
                          <th className="py-2 pl-3 pr-2 text-left font-semibold text-muted-foreground">
                            ID
                          </th>
                          <th className="py-2 pl-2 pr-3 text-left font-semibold text-muted-foreground">
                            Nombre
                          </th>
                          {isAllSpecificsMode && (
                            <th className="py-2 pl-2 pr-3 text-left font-semibold text-muted-foreground">
                              Sección
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSpecifics.length === 0 ? (
                          <tr>
                            <td colSpan={isAllSpecificsMode ? 3 : 2} className="py-6 text-center text-muted-foreground">
                              Sin resultados
                            </td>
                          </tr>
                        ) : (
                          filteredSpecifics.map((sp) => (
                            <tr
                              key={sp.id}
                              className="border-b last:border-0 hover:bg-muted/40"
                            >
                              <td className="py-1.5 pl-3 pr-2 font-mono text-xs font-semibold text-primary">
                                {sp.id}
                              </td>
                              <td className="py-1.5 pl-2 pr-3 text-foreground">
                                {sp.name}
                              </td>
                              {isAllSpecificsMode && (
                                <td className="py-1.5 pl-2 pr-3 text-muted-foreground text-xs">
                                  {(sp as typeof allSpecifics[0]).sectionName}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}

                <p className="text-xs text-muted-foreground">
                  {isAllSpecificsMode
                    ? `${allSpecifics.length} específicos disponibles · Buscá por nombre, ID o sección.`
                    : `${sectionSpecifics.length} específicos en esta sección · Buscá por nombre o ID de 4 dígitos.`}
                </p>
              </>
            )}
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
