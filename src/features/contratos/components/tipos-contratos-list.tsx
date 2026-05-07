/**
 * @description Componente para listar tipos de contratos personalizados
 * @returns {JSX.Element} Lista de tipos
 */

'use client'

import { useState, useEffect } from 'react'
import { getAuthToken } from '@/lib/token'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { TiposContratosForm } from './tipos-contratos-form'

interface TipoContrato {
  tipoCustomId: string
  nombre: string
  descripcion?: string
  activo: boolean
  creador: {
    userId: string
    name: string
    email: string
  }
  createdAt: string
}

interface TiposContratosListProps {
  refreshTrigger?: boolean
  onRefresh?: () => void
}

export function TiposContratosList({
  refreshTrigger = false,
  onRefresh,
}: TiposContratosListProps) {
  const [tipos, setTipos] = useState<TipoContrato[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchTipos()
  }, [refreshTrigger])

  const fetchTipos = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(
        '/api/tipos-contratos?activos=true',
        {
          headers: {
            Authorization: getAuthToken(),
          },
        }
      )

      if (!response.ok) {
        throw new Error('Error al obtener tipos')
      }

      const data = await response.json()
      setTipos(data.data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar los tipos de contratos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (tipoCustomId: string) => {
    if (!confirm('¿Está seguro de que desea eliminar este tipo de contrato?')) {
      return
    }

    setIsDeletingId(tipoCustomId)

    try {
      const response = await fetch(`/api/tipos-contratos/${tipoCustomId}`, {
        method: 'DELETE',
        headers: {
          Authorization: getAuthToken(),
        },
      })

      if (!response.ok) {
        throw new Error('Error al eliminar')
      }

      toast.success('Tipo de contrato eliminado')
      setTipos(tipos.filter((t) => t.tipoCustomId !== tipoCustomId))
      onRefresh?.()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al eliminar el tipo de contrato')
    } finally {
      setIsDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Tipos de Contratos Personalizados</CardTitle>
          <CardDescription>
            Gestione los tipos de contratos personalizados de su empresa
          </CardDescription>
        </div>
        <TiposContratosForm
          onSuccess={fetchTipos}
          onCreated={() => fetchTipos()}
        />
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              className="flex flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </motion.div>
          </div>
        ) : tipos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center py-12 text-center"
          >
            <div>
              <p className="text-muted-foreground mb-2">
                No hay tipos de contratos personalizados
              </p>
              <p className="text-sm text-muted-foreground">
                Cree uno usando el botón "Nuevo Tipo de Contrato"
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Nombre</TableHead>
                    <TableHead className="font-semibold">
                      Descripción
                    </TableHead>
                    <TableHead className="font-semibold">Creador</TableHead>
                    <TableHead className="font-semibold">Estado</TableHead>
                    <TableHead className="w-20 text-right font-semibold">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipos.map((tipo) => (
                    <motion.tr
                      key={tipo.tipoCustomId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        {tipo.nombre}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {tipo.descripcion || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>
                          <p className="font-medium">{tipo.creador.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {tipo.creador.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {tipo.activo && (
                          <Badge
                            variant="outline"
                            className="bg-green-50 border-green-200 text-green-800 flex w-fit gap-1"
                          >
                            <Check className="h-3 w-3" />
                            Activo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDelete(tipo.tipoCustomId)}
                          disabled={isDeletingId === tipo.tipoCustomId}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {isDeletingId === tipo.tipoCustomId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </motion.button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
