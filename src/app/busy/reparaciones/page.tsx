'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getEquiposReparacion, createEquipoReparacion, deleteEquipoReparacion } from '@/lib/api/reparaciones/equipos'
import { createPiezaReparacion, updatePiezaReparacion, deletePiezaReparacion } from '@/lib/api/reparaciones/piezas'
import { getDefectaciones, createDefectacion, updateDefectacion, deleteDefectacion } from '@/lib/api/reparaciones/defectaciones'
import { Plus, Trash2, Settings, Wrench, Edit, ClipboardList, ListChecks, Cpu } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatCurrencyUsd } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

/**
 * @description Página de configuración de reparaciones
 * @returns {JSX.Element} Página de reparaciones
 */
export default function ReparacionesConfigPage() {
  const [equipos, setEquipos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [defectaciones, setDefectaciones] = useState<any[]>([])
  const [isLoadingDefectaciones, setIsLoadingDefectaciones] = useState(true)

  useEffect(() => {
    getEquiposReparacion().then(setEquipos).catch(() => {}).finally(() => setIsLoading(false))
    getDefectaciones().then(setDefectaciones).catch(() => {}).finally(() => setIsLoadingDefectaciones(false))
  }, [])
  
  const [isAddEquipoOpen, setIsAddEquipoOpen] = useState(false)
  const [newEquipo, setNewEquipo] = useState({ nombre: '', descripcion: '' })

  const loadAll = () => {
    getEquiposReparacion().then(setEquipos).catch(() => {})
    getDefectaciones().then(setDefectaciones).catch(() => {})
  }

  const [isAddDefectacionOpen, setIsAddDefectacionOpen] = useState(false)
  const [editingDefectacionId, setEditingDefectacionId] = useState<string | null>(null)
  const [newDefectacion, setNewDefectacion] = useState({ defecto: '', costo: 0 })

  const [isAddPiezaOpen, setIsAddPiezaOpen] = useState(false)
  const [editingPiezaId, setEditingPiezaId] = useState<string | null>(null)
  const [selectedEquipoId, setSelectedEquipoId] = useState<string | null>(null)
  const [newPieza, setNewPieza] = useState({ 
    nombre: '', 
    costoPequeno: 0, 
    costoMediano: 0, 
    costoGrande: 0 
  })

  const handleOpenAddDefectacion = () => {
    setEditingDefectacionId(null)
    setNewDefectacion({ defecto: '', costo: 0 })
    setIsAddDefectacionOpen(true)
  }

  const handleOpenEditDefectacion = (item: any) => {
    setEditingDefectacionId(item.id)
    setNewDefectacion({ defecto: item.defecto, costo: item.costo })
    setIsAddDefectacionOpen(true)
  }

  const handleSaveDefectacion = async () => {
    try {
      if (editingDefectacionId) {
        await updateDefectacion(editingDefectacionId, newDefectacion)
        toast.success('Defectación actualizada')
      } else {
        await createDefectacion(newDefectacion)
        toast.success('Defectación agregada')
      }
      setIsAddDefectacionOpen(false)
      setEditingDefectacionId(null)
      getDefectaciones().then(setDefectaciones).catch(() => {})
    } catch (error) {
      toast.error('Error al guardar defectación')
    }
  }

  const handleDeleteDefectacion = async (id: string) => {
    if (confirm('¿Eliminar esta defectación?')) {
      try {
        await deleteDefectacion(id)
        toast.success('Defectación eliminada')
        getDefectaciones().then(setDefectaciones).catch(() => {})
      } catch (error) {
        toast.error('Error al eliminar')
      }
    }
  }

  const handleCreateEquipo = async () => {
    try {
      await createEquipoReparacion(newEquipo)
      toast.success('Equipo creado correctamente')
      setIsAddEquipoOpen(false)
      setNewEquipo({ nombre: '', descripcion: '' })
      getEquiposReparacion().then(setEquipos).catch(() => {})
    } catch (error) {
      toast.error('Error al crear el equipo')
    }
  }

  const handleDeleteEquipo = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este equipo? Se eliminarán todas sus piezas.')) {
      try {
        await deleteEquipoReparacion(id)
        toast.success('Equipo eliminado')
        getEquiposReparacion().then(setEquipos).catch(() => {})
      } catch (error) {
        toast.error('Error al eliminar el equipo')
      }
    }
  }

  const handleOpenAddPieza = (equipoId: string) => {
    setSelectedEquipoId(equipoId)
    setEditingPiezaId(null)
    setNewPieza({ nombre: '', costoPequeno: 0, costoMediano: 0, costoGrande: 0 })
    setIsAddPiezaOpen(true)
  }

  const handleOpenEditPieza = (pieza: any, equipoId: string) => {
    setSelectedEquipoId(equipoId)
    setEditingPiezaId(pieza.id)
    setNewPieza({ 
        nombre: pieza.nombre, 
        costoPequeno: pieza.costoPequeno, 
        costoMediano: pieza.costoMediano, 
        costoGrande: pieza.costoGrande 
    })
    setIsAddPiezaOpen(true)
  }

  const handleSavePieza = async () => {
    if (!selectedEquipoId) return
    try {
      if (editingPiezaId) {
        await updatePiezaReparacion(editingPiezaId, newPieza)
        toast.success('Pieza actualizada correctamente')
      } else {
        await createPiezaReparacion({
            ...newPieza,
            equipoId: selectedEquipoId
        })
        toast.success('Pieza agregada correctamente')
      }
      setIsAddPiezaOpen(false)
      setEditingPiezaId(null)
      getEquiposReparacion().then(setEquipos).catch(() => {})
    } catch (error) {
      toast.error(editingPiezaId ? 'Error al actualizar la pieza' : 'Error al agregar la pieza')
    }
  }

  const handleDeletePieza = async (id: string) => {
    if (confirm('¿Eliminar esta pieza?')) {
      try {
        await deletePiezaReparacion(id)
        toast.success('Pieza eliminada')
        getEquiposReparacion().then(setEquipos).catch(() => {})
      } catch (error) {
        toast.error('Error al eliminar la pieza')
      }
    }
  }

  if (isLoading) {
    return (
      <div className='container mx-auto py-6 px-4 max-w-6xl'>
        <div className='flex justify-between items-center mb-8'>
          <div className='flex items-center gap-2'>
            <div className='h-8 w-8 bg-muted rounded-lg' />
            <div className='h-8 w-48 bg-muted rounded' />
          </div>
          <div className='h-10 w-32 bg-muted rounded' />
        </div>
        <div className='space-y-6'>
          <div className='h-64 bg-muted rounded-xl' />
          <div className='h-64 bg-muted rounded-xl' />
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      className='container mx-auto py-6 px-4 max-w-6xl'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div 
        className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className='flex items-center gap-3'>
          <motion.div
            className='w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg'
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <Wrench className='h-5 w-5 text-white' />
          </motion.div>
          <div>
            <h1 className='text-3xl font-bold'>Configuración de Reparaciones</h1>
            <p className='text-muted-foreground text-sm'>Gestiona equipos, piezas y defectaciones (valores en USD)</p>
          </div>
        </div>
        <div className='flex gap-2'>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button variant='outline' asChild>
              <Link href='/busy/reparaciones/ordenes'>
                <ClipboardList className='mr-2 h-4 w-4' /> Ver Órdenes
              </Link>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              onClick={() => setIsAddEquipoOpen(true)}
              className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg'
            >
              <Plus className='mr-2 h-4 w-4' /> Nuevo Equipo
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <div className='space-y-6'>
        {/* Catálogo de Defectaciones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg'>
                  <ListChecks className='h-5 w-5 text-orange-600 dark:text-orange-400' />
                </div>
                <div>
                  <CardTitle className='text-xl'>Catálogo de Defectaciones</CardTitle>
                  <CardDescription>Lista de defectos comunes y sus costos asociados</CardDescription>
                </div>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  onClick={handleOpenAddDefectacion}
                  className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg'
                >
                  <Plus className='mr-2 h-4 w-4' /> Nueva Defectación
                </Button>
              </motion.div>
            </CardHeader>
            <CardContent>
              {isLoadingDefectaciones ? (
                <div className='space-y-3'>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className='h-12 bg-muted rounded animate-pulse' />
                  ))}
                </div>
              ) : defectaciones && defectaciones.length > 0 ? (
                <div className='rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Defecto / Servicio</TableHead>
                        <TableHead className='text-right'>Costo (USD)</TableHead>
                        <TableHead className='w-[100px]'></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defectaciones.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className='font-medium'>{item.defecto}</TableCell>
                          <TableCell className='text-right'>
                            <Badge variant='outline' className='font-semibold'>
                              {formatCurrencyUsd(item.costo)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className='flex justify-end gap-2'>
                              <Button variant='ghost' size='icon' onClick={() => handleOpenEditDefectacion(item)}>
                                  <Edit className='h-4 w-4' />
                              </Button>
                              <Button variant='ghost' size='icon' onClick={() => handleDeleteDefectacion(item.id)}>
                                  <Trash2 className='h-4 w-4 text-destructive' />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className='text-center py-8 text-muted-foreground border border-dashed rounded-md'>
                  No hay defectaciones configuradas.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Equipos */}
        {equipos?.map((equipo, index) => (
          <motion.div
            key={equipo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <Card>
              <CardHeader className='flex flex-row items-start justify-between space-y-0 pb-2'>
                <div className='flex items-center gap-3'>
                  <div className='p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg'>
                    <Cpu className='h-5 w-5 text-orange-600 dark:text-orange-400' />
                  </div>
                  <div>
                    <CardTitle className='text-xl'>{equipo.nombre}</CardTitle>
                    <CardDescription>{equipo.descripcion}</CardDescription>
                  </div>
                </div>
                <Button variant='ghost' size='icon' onClick={() => handleDeleteEquipo(equipo.id)}>
                  <Trash2 className='h-4 w-4 text-destructive' />
                </Button>
              </CardHeader>
              <CardContent>
                <div className='mt-4'>
                  <div className='flex justify-between items-center mb-4'>
                    <h3 className='font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2'>
                      <Settings className='h-4 w-4' />
                      Piezas y Costos
                    </h3>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button 
                        size='sm' 
                        onClick={() => handleOpenAddPieza(equipo.id)}
                        className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg'
                      >
                        <Plus className='mr-2 h-3 w-3' /> Agregar Pieza
                      </Button>
                    </motion.div>
                  </div>
                  
                  {equipo.piezas && equipo.piezas.length > 0 ? (
                    <div className='rounded-md border'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pieza</TableHead>
                            <TableHead className='text-right'>Pequeña</TableHead>
                            <TableHead className='text-right'>Mediana</TableHead>
                            <TableHead className='text-right'>Grande</TableHead>
                            <TableHead className='w-[80px]'></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {equipo.piezas.map((pieza) => (
                            <TableRow key={pieza.id}>
                              <TableCell className='font-medium'>{pieza.nombre}</TableCell>
                              <TableCell className='text-right'>{formatCurrencyUsd(pieza.costoPequeno)}</TableCell>
                              <TableCell className='text-right'>{formatCurrencyUsd(pieza.costoMediano)}</TableCell>
                              <TableCell className='text-right'>{formatCurrencyUsd(pieza.costoGrande)}</TableCell>
                              <TableCell>
                                <div className='flex justify-end gap-2'>
                                  <Button variant='ghost' size='icon' onClick={() => handleOpenEditPieza(pieza, equipo.id)}>
                                      <Edit className='h-4 w-4' />
                                  </Button>
                                  <Button variant='ghost' size='icon' onClick={() => handleDeletePieza(pieza.id)}>
                                      <Trash2 className='h-4 w-4 text-destructive' />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className='text-center py-8 text-muted-foreground border border-dashed rounded-md'>
                      No hay piezas configuradas para este equipo.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {equipos?.length === 0 && (
          <motion.div 
            className='text-center py-12 border rounded-lg bg-muted/10'
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Wrench className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
            <h3 className='text-lg font-medium'>No hay equipos configurados</h3>
            <p className='text-muted-foreground mb-4'>Comienza agregando un equipo para gestionar sus reparaciones.</p>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={() => setIsAddEquipoOpen(true)}
                className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg'
              >
                <Plus className='mr-2 h-4 w-4' /> Nuevo Equipo
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Dialog Nueva Defectación */}
      <Dialog open={isAddDefectacionOpen} onOpenChange={setIsAddDefectacionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDefectacionId ? 'Editar Defectación' : 'Nueva Defectación'}</DialogTitle>
            <DialogDescription>Configura el defecto y su costo asociado.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Nombre del Defecto / Servicio</Label>
              <Input 
                value={newDefectacion.defecto} 
                onChange={(e) => setNewDefectacion({...newDefectacion, defecto: e.target.value})}
                placeholder='Ej. Cambio de Compresor'
              />
            </div>
            <div className='space-y-2'>
              <Label>Costo (USD)</Label>
              <Input 
                type='number'
                value={newDefectacion.costo} 
                onChange={(e) => setNewDefectacion({...newDefectacion, costo: Number(e.target.value)})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsAddDefectacionOpen(false)}>Cancelar</Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={handleSaveDefectacion} 
                disabled={!newDefectacion.defecto}
                className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50'
              >
                {editingDefectacionId ? 'Guardar Cambios' : 'Agregar'}
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nuevo Equipo */}
      <Dialog open={isAddEquipoOpen} onOpenChange={setIsAddEquipoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Equipo de Reparación</DialogTitle>
            <DialogDescription>Define un nuevo tipo de equipo (ej. Split, Nevera, TV).</DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Nombre del Equipo</Label>
              <Input 
                value={newEquipo.nombre} 
                onChange={(e) => setNewEquipo({...newEquipo, nombre: e.target.value})}
                placeholder='Ej. Aire Acondicionado 1T'
              />
            </div>
            <div className='space-y-2'>
              <Label>Descripción</Label>
              <Textarea 
                value={newEquipo.descripcion} 
                onChange={(e) => setNewEquipo({...newEquipo, descripcion: e.target.value})}
                placeholder='Descripción opcional...'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsAddEquipoOpen(false)}>Cancelar</Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={handleCreateEquipo} 
                disabled={!newEquipo.nombre}
                className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50'
              >
                Crear Equipo
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Nueva Pieza */}
      <Dialog open={isAddPiezaOpen} onOpenChange={setIsAddPiezaOpen}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>{editingPiezaId ? 'Editar Pieza' : 'Agregar Pieza'}</DialogTitle>
            <DialogDescription>Configura una pieza y sus costos de reparación.</DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label>Nombre de la Pieza</Label>
              <Input 
                value={newPieza.nombre} 
                onChange={(e) => setNewPieza({...newPieza, nombre: e.target.value})}
                placeholder='Ej. Compresor, Tarjeta, Ventilador'
              />
            </div>
            <div className='grid grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label>Costo Pequeño (USD)</Label>
                <Input 
                  type='number'
                  value={newPieza.costoPequeno} 
                  onChange={(e) => setNewPieza({...newPieza, costoPequeno: Number(e.target.value)})}
                />
              </div>
              <div className='space-y-2'>
                <Label>Costo Mediano (USD)</Label>
                <Input 
                  type='number'
                  value={newPieza.costoMediano} 
                  onChange={(e) => setNewPieza({...newPieza, costoMediano: Number(e.target.value)})}
                />
              </div>
              <div className='space-y-2'>
                <Label>Costo Grande (USD)</Label>
                <Input 
                  type='number'
                  value={newPieza.costoGrande} 
                  onChange={(e) => setNewPieza({...newPieza, costoGrande: Number(e.target.value)})}
                />
              </div>
            </div>
            <p className='text-xs text-muted-foreground'>
              Define los costos según la complejidad de la reparación (Pequeña, Mediana, Grande).
            </p>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setIsAddPiezaOpen(false)}>Cancelar</Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={handleSavePieza} 
                disabled={!newPieza.nombre}
                className='bg-linear-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg disabled:opacity-50'
              >
                {editingPiezaId ? "Guardar Cambios" : "Agregar Pieza"}
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
