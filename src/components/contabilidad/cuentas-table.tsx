"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  Plus,
  Building2,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff
} from "lucide-react"
import { toast } from "sonner"
import {
  useGetCuentasBancariasQuery,
  useDeleteCuentaBancariaMutation
} from "@/lib/redux/services/contabilidadApi"
import type { CuentaBancaria } from "../../app/models/model"

interface CuentasTableProps {
  onEdit?: (cuenta: CuentaBancaria) => void
  onAdd?: () => void
}

const MONEDA_SIMBOLOS: Record<string, string> = {
  CUP: "CUP",
  USD: "$",
  EUR: "€",
}

// const TIPO_CUENTA_LABELS: Record<string, string> = {
//   corriente: "Corriente",
//   ahorros: "Ahorros",
//   empresarial: "Empresarial",
// }

export function CuentasTable({ onEdit, onAdd }: CuentasTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cuentaToDelete, setCuentaToDelete] = useState<CuentaBancaria | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data: cuentasData = { cuentas: [] }, isLoading, error } = useGetCuentasBancariasQuery()
  const [deleteCuenta, { isLoading: isDeleting }] = useDeleteCuentaBancariaMutation()

  const cuentas = cuentasData.cuentas || []

  // Filter cuentas based on search term and active status
  const filteredCuentas = cuentas.filter((cuenta: CuentaBancaria) => {
    const matchesSearch =
      cuenta.nombreBanco.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.numeroCuenta.toLowerCase().includes(searchTerm.toLowerCase()) ||
      [cuenta.tipoCuenta]?.includes(searchTerm.toLowerCase())

    const matchesStatus = showInactive || cuenta.isActive

    return matchesSearch && matchesStatus
  })

  const handleDeleteClick = (cuenta: CuentaBancaria) => {
    setCuentaToDelete(cuenta)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!cuentaToDelete) return

    try {
      await deleteCuenta(cuentaToDelete.cuentaId).unwrap()
      toast.success("Cuenta bancaria eliminada exitosamente")
      setDeleteDialogOpen(false)
      setCuentaToDelete(null)
    } catch (error: any) {
      const errorMessage = error?.data?.error || "Error al eliminar la cuenta bancaria"
      toast.error(errorMessage)
    }
  }

  const formatCurrency = (amount: number | string, currency: string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    const symbol = MONEDA_SIMBOLOS[currency] || currency
    return `${symbol} ${numAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Error al cargar las cuentas bancarias
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Cuentas Bancarias
            </CardTitle>
            {onAdd && (
              <Button onClick={onAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cuenta
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar cuentas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ocultar Inactivas
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Mostrar Inactivas
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Cargando cuentas...</p>
            </div>
          ) : filteredCuentas.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No hay cuentas bancarias</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "No se encontraron cuentas que coincidan con la búsqueda" : "Comience creando una nueva cuenta bancaria"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead>Número de Cuenta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCuentas.map((cuenta: CuentaBancaria) => (
                    <TableRow key={cuenta.cuentaId}>
                      <TableCell className="font-medium">
                        {cuenta.nombreBanco}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {cuenta.numeroCuenta}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <CreditCard className="h-3 w-3 mr-1" />
                          {cuenta.tipoCuenta}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(cuenta.saldo, cuenta.moneda)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {cuenta.moneda}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={cuenta.isActive ? "default" : "secondary"}>
                          {cuenta.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onEdit && (
                              <DropdownMenuItem
                                onClick={() => {
                                  // Close dropdown before opening dialog
                                  setTimeout(() => onEdit(cuenta), 0)
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                // Close dropdown before opening dialog
                                setTimeout(() => handleDeleteClick(cuenta), 0)
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta bancaria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la cuenta bancaria{" "}
              <strong>{cuentaToDelete?.nombreBanco} - {cuentaToDelete?.numeroCuenta}</strong>.
              {cuentaToDelete && parseFloat(cuentaToDelete.saldo.toString()) !== 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <strong>Advertencia:</strong> Esta cuenta tiene un saldo de{" "}
                  {formatCurrency(cuentaToDelete.saldo, cuentaToDelete.moneda)}.
                </div>
              )}
              <br />
              <br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}