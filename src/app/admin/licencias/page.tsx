'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useDeferredValue, useState, useEffect } from 'react'
import { LazyMotion, m as motion } from 'framer-motion'
import {
  Key,
  Plus,
  Copy,
  Check,
  Search,
  Filter,
  Trash2,
  Shield,
  Calendar,
  Clock,
  AlertTriangle,
  X,
  Rocket,
  Building2,
  UserCircle2,
  RefreshCcw,
  Settings2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Power,
  Zap,
  FlaskConical,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { addDays } from '@/lib/date-utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  getAdminPlanesAction,
  getGlobalUsersAction,
  deleteLicenciaAction,
  updateLicenciaAction,
  generateLicenciasAction,
  createDemoTenantAction,
  cleanupExpiredDemoLicenciasAction,
  convertDemoToPaidPlanAction,
  changePlanAction,
  renewLicenciaAction,
  getLicenciasPaginatedAction,
  getLicenciasStatsAction,
  updateLicenseAccountingOverridesAction,
} from '@/features/admin'
import {
  ACCOUNTING_OVERRIDE_FEATURES,
  buildAccountingFeatureToggleStates,
} from '@/features/admin/license-feature-overrides'

function SortIndicator({
  column,
  sortBy,
  sortOrder,
}: {
  column: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}) {
  if (sortBy !== column) {
    return (
      <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground opacity-50 inline" />
    )
  }

  return sortOrder === 'asc' ? (
    <ArrowUp className="ml-1 h-3 w-3 inline" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3 inline" />
  )
}

export default function AdminLicenciasPage() {
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [searchInput, setSearchInput] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [generarDialogOpen, setGenerarDialogOpen] = useState(false)
  const [demoDialogOpen, setDemoDialogOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [accountingOverridesDialogOpen, setAccountingOverridesDialogOpen] = useState(false)
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false)
  const [licenseToChangePlan, setLicenseToChangePlan] = useState<any>(null)
  const [renewDialogOpen, setRenewDialogOpen] = useState(false)
  const [renewConfirmOpen, setRenewConfirmOpen] = useState(false)
  const [licenseToRenew, setLicenseToRenew] = useState<any>(null)
  const [renewDraft, setRenewDraft] = useState<{
    planId: string
    registerPayment: boolean
    amountPaidUsd?: number
    idempotencyKey?: string
  }>({ planId: '', registerPayment: false })
  const [isRenewing, setIsRenewing] = useState(false)
  const [licenseToConvert, setLicenseToConvert] = useState<any>(null)
  const [licenseToEditOverrides, setLicenseToEditOverrides] = useState<any>(null)
  const [accountingOverridesDraft, setAccountingOverridesDraft] = useState<Record<string, boolean>>({})
  const [isSavingOverrides, setIsSavingOverrides] = useState(false)
  const [selectedLicencias, setSelectedLicencias] = useState<Set<string>>(new Set())

  const [data, setData] = useState<any>(null)
  const [statsData, setStatsData] = useState<any>(null)
  const [planesData, setPlanesData] = useState<any[]>([])
  const [usersData, setUsersData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const search = useDeferredValue(searchInput)

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
    setPage(1)
  }

  const loadLicenciasData = useCallback(async (nextPage = page) => {
    return Promise.all([
      getLicenciasPaginatedAction({
        page: nextPage,
        limit,
        sortBy,
        sortOrder,
        search,
        planFilter,
        statusFilter,
        typeFilter,
      }),
      getLicenciasStatsAction({ search, planFilter, statusFilter, typeFilter }),
    ])
  }, [page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter])

  async function refreshLicenciasData(nextPage = page) {
    const [licenciasResult, statsResult] = await loadLicenciasData(nextPage)

    if (licenciasResult.success) setData(licenciasResult.data)
    if (statsResult.success) setStatsData(statsResult.data)
  }

  useEffect(() => {
    let isCancelled = false

    async function fetchPageData() {
      try {
        setIsLoading(true)
        const [[licenciasResult, statsResult], planesResult, usersResult] = await Promise.all([
          loadLicenciasData(page),
          getAdminPlanesAction(),
          getGlobalUsersAction({ limit: 100 }),
        ])

        if (isCancelled) return

        if (licenciasResult.success) setData(licenciasResult.data)
        else toast.error(licenciasResult.error?.message || 'No se pudieron cargar las licencias')

        if (statsResult.success) setStatsData(statsResult.data)
        else toast.error(statsResult.error?.message || 'No se pudieron cargar las métricas')

        if (planesResult.success) setPlanesData(planesResult.data ?? [])
        if (usersResult.success) setUsersData(usersResult.data)
      } catch (_error) {
        if (!isCancelled) toast.error('No se pudieron cargar los datos de licencias')
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void fetchPageData()

    return () => {
      isCancelled = true
    }
  }, [page, limit, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter, loadLicenciasData])

  useEffect(() => {
    setPage(1)
  }, [search, planFilter, statusFilter, typeFilter, sortBy, sortOrder])

  useEffect(() => {
    setSelectedLicencias(new Set())
  }, [page, sortBy, sortOrder, search, planFilter, statusFilter, typeFilter])

  const licencias = data?.licencias || []
  const total = data?.total || 0
  const pages = Math.max(1, Math.ceil(total / limit))
  const isRefreshing = isLoading && licencias.length > 0

  const planes = planesData || []
  const users = (usersData as any)?.users || []

  // Métricas
  const activas = statsData?.activas || 0
  const expiradas = statsData?.expiradas || 0
  const demos = statsData?.demos || 0
  const adminTest = statsData?.adminTest || 0
  const porVencer = statsData?.porVencer || 0

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(text)
    setTimeout(() => setCopiedKey(null), 2000)
    toast.success('Clave copiada')
  }

  function handleToggleLicenciaClick(licencia: any) {
    requestConfirm({
      title: licencia.activa ? 'Revocar licencia' : 'Activar licencia',
      description: licencia.activa
        ? `¿Revocar la licencia ${licencia.tenantLicenseId}? Los usuarios del tenant dejarán de tener acceso.`
        : `¿Activar la licencia ${licencia.tenantLicenseId}?`,
      destructive: licencia.activa,
      onConfirm: () => handleToggleLicencia(licencia),
    })
  }

  async function handleToggleLicencia(licencia: any) {
    try {
      const r = await updateLicenciaAction({ id: licencia.tenantLicenseId, activa: !licencia.activa })
      if (r.success) {
        toast.success(licencia.activa ? 'Licencia revocada' : 'Licencia activada')
        await refreshLicenciasData()
      } else {
        toast.error('Error actualizando licencia')
      }
    } catch (error) {
      toast.error('Error actualizando licencia')
    }
  }

  async function handleToggleAdminTest(licencia: any) {
    try {
      const nextValue = !licencia.isAdminTest
      const r = await updateLicenciaAction({
        id: licencia.tenantLicenseId,
        isAdminTest: nextValue,
      })

      if (r.success) {
        toast.success(
          nextValue
            ? 'Licencia marcada como prueba admin'
            : 'Licencia removida de prueba admin',
        )
        await refreshLicenciasData()
      } else {
        toast.error(r.error?.message || 'Error actualizando marca de prueba admin')
      }
    } catch (_error) {
      toast.error('Error actualizando marca de prueba admin')
    }
  }

  async function handleDeleteLicencia(id: string) {
    try {
      const r = await deleteLicenciaAction(id)
      if (r.success) {
        toast.success('Licencia eliminada')
        const nextPage = licencias.length === 1 && page > 1 ? page - 1 : page
        if (nextPage !== page) setPage(nextPage)
        else await refreshLicenciasData(nextPage)
      } else {
        toast.error('Error eliminando licencia')
      }
    } catch (error) {
      toast.error('Error eliminando licencia')
    }
  }

  function handleDeleteLicenciaClick(licencia: any) {
    requestConfirm({
      title: 'Eliminar licencia',
      description: `¿Eliminar la licencia ${licencia.tenantLicenseId}? Esta acción no se puede deshacer.`,
      destructive: true,
      onConfirm: () => handleDeleteLicencia(licencia.tenantLicenseId),
    })
  }

  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  const [confirmState, setConfirmState] = useState<{
    title: string
    description: string
    destructive?: boolean
    onConfirm: () => void
  } | null>(null)

  function requestConfirm({
    title,
    description,
    destructive = false,
    onConfirm,
  }: {
    title: string
    description: string
    destructive?: boolean
    onConfirm: () => void
  }) {
    setConfirmState({ title, description, destructive, onConfirm })
  }

  function handleBulkToggleClick() {
    if (selectedLicencias.size === 0) return
    requestConfirm({
      title: 'Cambiar estado',
      description: `¿Cambiar estado de ${selectedLicencias.size} licencias?`,
      onConfirm: () => handleBulkToggleEstado(),
    })
  }

  async function handleBulkToggleEstado() {
    setIsBulkProcessing(true)
    let success = 0
    let errors = 0
    try {
      for (const id of selectedLicencias) {
        const lic = licencias.find((l: any) => l.tenantLicenseId === id)
        if (!lic) { errors++; continue }
        const r = await updateLicenciaAction({ id: lic.tenantLicenseId, activa: !lic.activa })
        if (r.success) success++
        else errors++
      }
      if (errors === 0) toast.success(`${success} licencias actualizadas`)
      else toast.warning(`${success} actualizadas, ${errors} con error`)
      setSelectedLicencias(new Set())
      await refreshLicenciasData()
    } catch (_error) {
      toast.error('Error en acción masiva')
    } finally {
      setIsBulkProcessing(false)
    }
  }

  function handleBulkDeleteClick() {
    if (selectedLicencias.size === 0) return
    requestConfirm({
      title: 'Eliminar licencias',
      description: `¿Eliminar ${selectedLicencias.size} licencias? Esta acción no se puede deshacer.`,
      destructive: true,
      onConfirm: () => handleBulkDelete(),
    })
  }

  async function handleBulkDelete() {
    setIsBulkProcessing(true)
    let success = 0
    let errors = 0
    try {
      for (const id of selectedLicencias) {
        const r = await deleteLicenciaAction(id)
        if (r.success) success++
        else errors++
      }
      if (errors === 0) toast.success(`${success} licencias eliminadas`)
      else toast.warning(`${success} eliminadas, ${errors} con error`)
      setSelectedLicencias(new Set())
      const nextPage = success === licencias.length && page > 1 ? page - 1 : page
      if (nextPage !== page) setPage(nextPage)
      else await refreshLicenciasData(nextPage)
    } catch (_error) {
      toast.error('Error en acción masiva')
    } finally {
      setIsBulkProcessing(false)
    }
  }

  async function handleCleanupExpiredDemos() {
    try {
      const result = await cleanupExpiredDemoLicenciasAction({ dryRun: false })
      if (!result.success) {
        toast.error(result.error?.message || 'No se pudo limpiar demos expiradas')
        return
      }

      const cleaned = result.data?.count ?? 0
      toast.success(
        cleaned > 0
          ? `Se desactivaron ${cleaned} demos expiradas`
          : 'No había demos expiradas para limpiar',
      )

      await refreshLicenciasData()
    } catch (error) {
      toast.error('No se pudo limpiar demos expiradas')
    }
  }

  async function handleChangePlan(tenantLicenseId: string, planId: string) {
    try {
      const r = await changePlanAction({ tenantLicenseId, planId })
      if (r.success) {
        toast.success(`Plan cambiado a ${r.data?.planName}`)
        setChangePlanDialogOpen(false)
        setLicenseToChangePlan(null)
        await refreshLicenciasData()
      } else {
        toast.error(r.error?.message || 'Error al cambiar plan')
      }
    } catch (_error) {
      toast.error('Error al cambiar plan')
    }
  }

  async function handleConvertDemo(data: { tenantLicenseId: string; planId: string; durationDays?: number }) {
    try {
      const result = await convertDemoToPaidPlanAction(data)
      if (!result.success) {
        toast.error(result.error?.message || 'No se pudo convertir la demo')
        return
      }

      toast.success('Demo convertida a plan pago')
      setConvertDialogOpen(false)
      setLicenseToConvert(null)
      await refreshLicenciasData()
    } catch (_error) {
      toast.error('No se pudo convertir la demo')
    }
  }

  function buildRenewalKey(tenantId: string, planId: string) {
    const ts = new Date().toISOString().slice(0, 10)
    return `renewal:${tenantId}:${planId}:${ts}`
  }

  function handleRenew(licencia: any) {
    setLicenseToRenew(licencia)
    setRenewDraft({
      planId: licencia.planId ?? '',
      registerPayment: false,
      amountPaidUsd: undefined,
      idempotencyKey: undefined,
    })
    setRenewDialogOpen(true)
  }

  function handleRenewContinue(draft: {
    planId: string
    registerPayment: boolean
    amountPaidUsd?: number
    idempotencyKey?: string
  }) {
    setRenewDraft(draft)
    setRenewDialogOpen(false)
    setRenewConfirmOpen(true)
  }

  async function handleConfirmRenew() {
    if (!licenseToRenew) return
    setIsRenewing(true)
    try {
      const result = await renewLicenciaAction({
        tenantLicenseId: licenseToRenew.tenantLicenseId,
        planId: renewDraft.planId,
        registerPayment: renewDraft.registerPayment,
        ...(renewDraft.amountPaidUsd !== undefined ? { amountPaidUsd: renewDraft.amountPaidUsd } : {}),
        ...(renewDraft.idempotencyKey ? { idempotencyKey: renewDraft.idempotencyKey } : {}),
      })
      if (!result.success) {
        const code = result.error?.code
        toast.error(result.error?.message || 'No se pudo renovar la licencia')
        if (
          renewDraft.registerPayment &&
          (code === 'PAYMENT_ALREADY_CONFIRMED' || code === 'IDEMPOTENCY_CONFLICT')
        ) {
          toast.warning(
            `Reintenta solo el pago con la clave: ${renewDraft.idempotencyKey ?? ''}`,
          )
        }
        return
      }
      const newExp = (result.data as { newExpiracion?: string | Date } | undefined)
        ?.newExpiracion
      const fechaTxt =
        newExp instanceof Date
          ? format(newExp, 'dd/MM/yyyy')
          : newExp
            ? format(new Date(newExp), 'dd/MM/yyyy')
            : null
      toast.success(
        fechaTxt ? `Licencia renovada hasta el ${fechaTxt}` : 'Licencia renovada',
      )
      setRenewConfirmOpen(false)
      setLicenseToRenew(null)
      await refreshLicenciasData()
    } catch (_error) {
      toast.error('No se pudo renovar la licencia')
    } finally {
      setIsRenewing(false)
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedLicencias)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedLicencias(next)
  }

  const toggleSelectAll = () => {
    if (selectedLicencias.size === licencias.length) {
      setSelectedLicencias(new Set())
    } else {
      setSelectedLicencias(new Set(licencias.map((l: any) => l.tenantLicenseId)))
    }
  }

  const openAccountingOverridesDialog = (licencia: any) => {
    const toggleStates = buildAccountingFeatureToggleStates(
      licencia?.plan?.features && typeof licencia.plan.features === 'object'
        ? licencia.plan.features
        : {},
      licencia?.featureOverrides && typeof licencia.featureOverrides === 'object'
        ? licencia.featureOverrides
        : {},
    )

    setLicenseToEditOverrides(licencia)
    setAccountingOverridesDraft(
      Object.fromEntries(toggleStates.map((item) => [item.key, item.enabled])),
    )
    setAccountingOverridesDialogOpen(true)
  }

  const closeAccountingOverridesDialog = () => {
    if (isSavingOverrides) return
    setAccountingOverridesDialogOpen(false)
    setLicenseToEditOverrides(null)
    setAccountingOverridesDraft({})
  }

  const handleSaveAccountingOverrides = async () => {
    if (!licenseToEditOverrides) return

    try {
      setIsSavingOverrides(true)
      const result = await updateLicenseAccountingOverridesAction({
        id: licenseToEditOverrides.tenantLicenseId,
        featureOverrides: accountingOverridesDraft,
      })

      if (!result.success) {
        toast.error(result.error?.message || 'No se pudieron guardar los overrides')
        return
      }

      setIsSavingOverrides(false)
      toast.success('Overrides contables actualizados')
      closeAccountingOverridesDialog()
      await refreshLicenciasData()
    } catch (_error) {
      toast.error('No se pudieron guardar los overrides')
    } finally {
      setIsSavingOverrides(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Licencias</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <p>Gestión de licencias y activaciones</p>
            {isRefreshing ? <span className="text-xs">Actualizando...</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCleanupExpiredDemos}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Limpiar Demos Expiradas
          </Button>
          <Button variant="outline" onClick={() => setDemoDialogOpen(true)}>
            <Rocket className="mr-2 h-4 w-4" />
            Crear Demo
          </Button>
          <Button onClick={() => setGenerarDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generar Licencias
          </Button>
        </div>
      </motion.div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-success" />
              Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{activas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Rocket className="h-4 w-4 text-info" />
              Demos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{demos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-purple" />
              Prueba Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple">{adminTest}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Por Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{porVencer}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-danger" />
              Expiradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{expiradas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar por clave o usuario..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
            aria-label="Buscar licencias"
          />
        </div>
        <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1) }}>
          <SelectTrigger className="w-44">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            {planes.map((plan: any) => (
              <SelectItem key={plan.planId} value={plan.planId}>{plan.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activas</SelectItem>
            <SelectItem value="false">Revocadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="standard">Normales</SelectItem>
            <SelectItem value="demo">Demos</SelectItem>
            <SelectItem value="admin_test">Prueba admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedLicencias.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5"
          role="region"
          aria-label="Acciones masivas"
        >
          <span className="text-sm font-medium">{selectedLicencias.size} seleccionadas</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkToggleClick}
            disabled={isBulkProcessing}
            aria-label={`Cambiar estado de ${selectedLicencias.size} licencias`}
          >
            <Shield className="h-3 w-3 mr-1" aria-hidden="true" />
            {isBulkProcessing ? 'Procesando...' : 'Toggle Estado'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDeleteClick}
            disabled={isBulkProcessing}
            className="text-danger"
            aria-label={`Eliminar ${selectedLicencias.size} licencias`}
          >
            <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
            Eliminar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedLicencias(new Set())}
            disabled={isBulkProcessing}
            aria-label="Cancelar selección masiva"
          >
            <X className="h-3 w-3 mr-1" aria-hidden="true" />
            Cancelar
          </Button>
        </motion.div>
      )}

      {/* Tabla */}
      <div className={`rounded-xl border overflow-hidden transition-opacity ${isRefreshing ? 'opacity-75' : 'opacity-100'}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center"
                  aria-label={selectedLicencias.size === licencias.length && licencias.length > 0 ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  aria-pressed={selectedLicencias.size === licencias.length && licencias.length > 0}
                >
                  {selectedLicencias.size === licencias.length && licencias.length > 0 ? (
                    <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  ) : (
                    <div className="h-4 w-4 border rounded" aria-hidden="true" />
                  )}
                </button>
              </TableHead>
              <TableHead onClick={() => handleSort('createdAt')} className="cursor-pointer select-none" aria-sort={sortBy === 'createdAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <div className="flex items-center">
                  <span>Licencia</span>
                  <SortIndicator column="createdAt" sortBy={sortBy} sortOrder={sortOrder} />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort('tenantId')} className="cursor-pointer select-none" aria-sort={sortBy === 'tenantId' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <div className="flex items-center">
                  <span>Tenant / Admin</span>
                  <SortIndicator column="tenantId" sortBy={sortBy} sortOrder={sortOrder} />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort('planId')} className="cursor-pointer select-none" aria-sort={sortBy === 'planId' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <div className="flex items-center">
                  <span>Plan</span>
                  <SortIndicator column="planId" sortBy={sortBy} sortOrder={sortOrder} />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort('expiracion')} className="cursor-pointer select-none" aria-sort={sortBy === 'expiracion' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <div className="flex items-center">
                  <span>Expiración</span>
                  <SortIndicator column="expiracion" sortBy={sortBy} sortOrder={sortOrder} />
                </div>
              </TableHead>
              <TableHead onClick={() => handleSort('activa')} className="cursor-pointer select-none" aria-sort={sortBy === 'activa' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <div className="flex items-center">
                  <span>Estado</span>
                  <SortIndicator column="activa" sortBy={sortBy} sortOrder={sortOrder} />
                </div>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Cargando...</TableCell>
              </TableRow>
            ) : licencias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No hay licencias
                </TableCell>
              </TableRow>
            ) : (
              licencias.map((licencia: any) => {
                const expirada = new Date(licencia.expiracion) < new Date()
                const diasRestantes = differenceInDays(new Date(licencia.expiracion), new Date())
                const isSelected = selectedLicencias.has(licencia.tenantLicenseId)

                return (
                  <TableRow key={licencia.tenantLicenseId} className={isSelected ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <button
                        onClick={() => toggleSelect(licencia.tenantLicenseId)}
                        aria-label={isSelected ? `Deseleccionar ${licencia.tenantLicenseId}` : `Seleccionar ${licencia.tenantLicenseId}`}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                        ) : (
                          <div className="h-4 w-4 border rounded" aria-hidden="true" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono text-sm">
                        <Key className="h-3 w-3 text-muted-foreground" />
                        {licencia.tenantLicenseId}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(licencia.tenantLicenseId)}
                          aria-label={`Copiar clave ${licencia.tenantLicenseId}`}
                        >
                          {copiedKey === licencia.tenantLicenseId ? (
                            <Check className="h-3 w-3 text-success" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {licencia.tenant ? (
                        <div>
                          <div className="font-medium">{licencia.tenant.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {licencia.tenant.memberships?.[0]?.user?.email ?? licencia.tenant.tenantId}
                          </div>
                          {licencia.isDemo ? (
                            <div className="text-xs text-muted-foreground">
                              Creada por {licencia.createdByUser?.name ?? licencia.createdBy ?? 'sistema'} ·{' '}
                              {format(new Date(licencia.createdAt), 'dd/MM/yyyy HH:mm')}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Badge variant="outline">{licencia.plan?.nombre}</Badge>
                        {licencia.isDemo ? (
                          <Badge className="bg-info">Demo</Badge>
                        ) : null}
                        {licencia.isAdminTest ? (
                          <Badge className="bg-purple">Prueba admin</Badge>
                        ) : null}
                        {licencia.featureOverrides &&
                        typeof licencia.featureOverrides === 'object' &&
                        Object.keys(licencia.featureOverrides).length > 0 ? (
                          <Badge variant="secondary">Overrides</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                        <span className={expirada ? 'text-danger' : diasRestantes <= 7 ? 'text-warning' : ''}>
                          {format(new Date(licencia.expiracion), 'dd/MM/yyyy')}
                        </span>
                        {!expirada && (
                          <span className="text-xs text-muted-foreground">({diasRestantes}d)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {expirada ? (
                        <Badge variant="destructive">Expirada</Badge>
                      ) : licencia.activa ? (
                        <Badge className="bg-success">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Revocada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1 md:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLicenseToChangePlan(licencia)
                            setChangePlanDialogOpen(true)
                          }}
                          aria-label={`Cambiar plan de ${licencia.tenantLicenseId}`}
                        >
                          <ArrowUpDown className="h-4 w-4 md:mr-1" aria-hidden="true" />
                          <span className="hidden md:inline">Cambiar Plan</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRenew(licencia)}
                          aria-label={`Renovar licencia ${licencia.tenantLicenseId}`}
                        >
                          <RefreshCcw className="h-4 w-4 md:mr-1" aria-hidden="true" />
                          <span className="hidden md:inline">Renovar</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAccountingOverridesDialog(licencia)}
                          aria-label={`Editar overrides contables de ${licencia.tenantLicenseId}`}
                        >
                          <Settings2 className="h-4 w-4 md:mr-1" aria-hidden="true" />
                          <span className="hidden md:inline">Overrides</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleLicenciaClick(licencia)}
                          aria-label={licencia.activa ? `Revocar ${licencia.tenantLicenseId}` : `Activar ${licencia.tenantLicenseId}`}
                        >
                          <Power className="h-4 w-4 md:mr-1" aria-hidden="true" />
                          <span className="hidden md:inline">{licencia.activa ? 'Revocar' : 'Activar'}</span>
                        </Button>
                        {licencia.isDemo ? (                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setLicenseToConvert(licencia)
                              setConvertDialogOpen(true)
                            }}
                            aria-label={`Convertir demo ${licencia.tenantLicenseId} a plan pago`}
                          >
                            <Zap className="h-4 w-4 md:mr-1" aria-hidden="true" />
                            <span className="hidden md:inline">Convertir</span>
                          </Button>
                        ) : null}
                        <Button
                          variant={licencia.isAdminTest ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleAdminTest(licencia)}
                          aria-label={
                            licencia.isAdminTest
                              ? `Quitar marca de prueba admin a ${licencia.tenantLicenseId}`
                              : `Marcar ${licencia.tenantLicenseId} como prueba admin`
                          }
                        >
                          <FlaskConical className="h-4 w-4 md:mr-1" aria-hidden="true" />
                          <span className="hidden md:inline">
                            {licencia.isAdminTest ? 'Quitar prueba' : 'Marcar prueba'}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLicenciaClick(licencia)}
                          className="text-danger"
                          aria-label={`Eliminar ${licencia.tenantLicenseId}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm text-muted-foreground px-4">
                  Página {page} de {pages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className={page === pages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Dialog Generar */}
      <GenerarLicenciasDialog
        open={generarDialogOpen}
        onClose={() => setGenerarDialogOpen(false)}
        planes={planes}
        users={users}
        onGenerate={async (data) => {
          try {
            const r = await generateLicenciasAction(data)
            if (r.success) {
              toast.success(`${data.cantidad} licencias generadas`)
              setGenerarDialogOpen(false)
              await refreshLicenciasData()
            } else {
              toast.error('Error generando licencias')
            }
          } catch (error) {
            toast.error('Error generando licencias')
          }
        }}
      />

      <CrearDemoDialog
        open={demoDialogOpen}
        onClose={() => setDemoDialogOpen(false)}
        onCreated={refreshLicenciasData}
        planes={planes}
      />

      <ConvertDemoDialog
        open={convertDialogOpen}
        onClose={() => {
          setConvertDialogOpen(false)
          setLicenseToConvert(null)
        }}
        planes={planes}
        licencia={licenseToConvert}
        onConvert={handleConvertDemo}
      />

      <CambiarPlanDialog
        open={changePlanDialogOpen}
        onClose={() => {
          setChangePlanDialogOpen(false)
          setLicenseToChangePlan(null)
        }}
        planes={planes}
        licencia={licenseToChangePlan}
        onChangePlan={handleChangePlan}
      />

      <AccountingOverridesDialog
        open={accountingOverridesDialogOpen}
        onClose={closeAccountingOverridesDialog}
        licencia={licenseToEditOverrides}
        draft={accountingOverridesDraft}
        isSaving={isSavingOverrides}
        onToggle={(key, checked) =>
          setAccountingOverridesDraft((current) => ({
            ...current,
            [key]: checked,
          }))
        }
        onSave={handleSaveAccountingOverrides}
      />

      <RenewLicenciaDialog
        open={renewDialogOpen}
        onClose={() => {
          if (isRenewing) return
          setRenewDialogOpen(false)
        }}
        onContinue={handleRenewContinue}
        planes={planes}
        licencia={licenseToRenew}
        buildRenewalKey={buildRenewalKey}
      />

      <RenewConfirmAlertDialog
        open={renewConfirmOpen}
        onClose={() => {
          if (isRenewing) return
          setRenewConfirmOpen(false)
        }}
        licencia={licenseToRenew}
        planes={planes}
        draft={renewDraft}
        isSubmitting={isRenewing}
        onConfirm={handleConfirmRenew}
      />

      <ConfirmAlertDialog
        state={confirmState}
        onClose={() => setConfirmState(null)}
      />
    </div>
  )
}

function GenerarLicenciasDialog({
  open,
  onClose,
  planes,
  users,
  onGenerate,
}: {
  open: boolean
  onClose: () => void
  planes: any[]
  users: any[]
  onGenerate: (data: any) => void
}) {
  const [planId, setPlanId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [duracionDias, setDuracionDias] = useState('')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar Licencias</DialogTitle>
          <DialogDescription>Genera claves de licencia automáticamente</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <span className="text-sm font-medium">Usuario</span>
            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar usuario" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user: any) => (
                  <SelectItem key={user.userId} value={user.userId}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Plan</span>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((plan: any) => (
                  <SelectItem key={plan.planId} value={plan.planId}>
                    {plan.nombre} - ${plan.precio}/{plan.duracionDias} días
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Cantidad</span>
            <Input
              type="number"
              min={1}
              max={200}
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Duración (días, opcional)</span>
            <Input
              type="number"
              value={duracionDias}
              onChange={(e) => setDuracionDias(e.target.value)}
              placeholder="Usar duración del plan"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() =>
              onGenerate({
                planId,
                usuarioId,
                cantidad,
                ...(duracionDias ? { duracionDias: parseInt(duracionDias) } : {}),
              })
            }
            disabled={!planId || !usuarioId}
          >
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccountingOverridesDialog({
  open,
  onClose,
  licencia,
  draft,
  isSaving,
  onToggle,
  onSave,
}: {
  open: boolean
  onClose: () => void
  licencia: any
  draft: Record<string, boolean>
  isSaving: boolean
  onToggle: (key: string, checked: boolean) => void
  onSave: () => void
}) {
  const toggleStates = buildAccountingFeatureToggleStates(
    licencia?.plan?.features && typeof licencia.plan.features === 'object'
      ? licencia.plan.features
      : {},
    licencia?.featureOverrides && typeof licencia.featureOverrides === 'object'
      ? licencia.featureOverrides
      : {},
  )

  const effectiveStates = toggleStates.map((state) => ({
    ...state,
    enabled: draft[state.key] ?? state.enabled,
  }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Overrides contables por tenant</DialogTitle>
          <DialogDescription>
            Edita excepciones solo para esta licencia sin tocar el plan base.
          </DialogDescription>
        </DialogHeader>

        {licencia ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{licencia.tenant?.nombre ?? 'Tenant sin nombre'}</div>
              <div className="text-muted-foreground">
                Plan base: {licencia.plan?.nombre ?? 'Sin plan'}
              </div>
            </div>

            <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1">
              {ACCOUNTING_OVERRIDE_FEATURES.map((feature) => {
                const state = effectiveStates.find((item) => item.key === feature.key)
                const checked = state?.enabled === true

                return (
                  <label
                    key={feature.key}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => onToggle(feature.key, value === true)}
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{feature.label}</span>
                        <Badge variant={state?.inherited ? 'outline' : 'secondary'}>
                          {state?.inherited ? 'Plan base' : 'Override'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={!licencia || isSaving}>
            Guardar overrides
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CambiarPlanDialog({
  open,
  onClose,
  planes,
  licencia,
  onChangePlan,
}: {
  open: boolean
  onClose: () => void
  planes: any[]
  licencia: any | null
  onChangePlan: (tenantLicenseId: string, planId: string) => Promise<void>
}) {
  const [planId, setPlanId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !licencia) return
    setPlanId(licencia.planId ?? '')
  }, [open, licencia])

  const handleClose = () => {
    if (isSubmitting) return
    setPlanId('')
    onClose()
  }

  const handleSubmit = async () => {
    if (!licencia?.tenantLicenseId || !planId) return
    if (planId === licencia.planId) {
      toast.info('La licencia ya tiene ese plan')
      return
    }

    try {
      setIsSubmitting(true)
      await onChangePlan(licencia.tenantLicenseId, planId)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Cambiar Plan</DialogTitle>
          <DialogDescription>
            Cambiá el plan de la licencia. Los límites y features se sincronizarán con el nuevo plan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs text-muted-foreground">Tenant</div>
            <div className="font-medium">{licencia?.tenant?.nombre ?? licencia?.tenantId ?? '—'}</div>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs text-muted-foreground">Plan actual</div>
            <div className="font-medium">{licencia?.plan?.nombre ?? 'Sin plan'}</div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Nuevo plan</span>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((plan: any) => (
                  <SelectItem key={plan.planId} value={plan.planId}>
                    {plan.nombre} - ${plan.precio}/{plan.duracionDias} días
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!planId || planId === licencia?.planId || isSubmitting}>
            {isSubmitting ? 'Cambiando...' : 'Cambiar Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CrearDemoDialog({
  open,
  onClose,
  onCreated,
  planes,
}: {
  open: boolean
  onClose: () => void
  onCreated?: () => Promise<void> | void
  planes: any[]
}) {
  const [planId, setPlanId] = useState('')
  const [demoName, setDemoName] = useState('')
  const [durationDays, setDurationDays] = useState('6')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdDemo, setCreatedDemo] = useState<any>(null)

  const handleClose = () => {
    if (isSubmitting) return
    setPlanId('')
    setDemoName('')
    setDurationDays('6')
    setCreatedDemo(null)
    onClose()
  }

  const copyValue = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copiado`)
  }

  const handleCreate = async () => {
    try {
      setIsSubmitting(true)
      const result = await createDemoTenantAction({
        planId,
        demoName: demoName.trim() || undefined,
        durationDays: Number(durationDays || 6),
      })

      if (!result.success) {
        toast.error(result.error?.message || 'Error creando demo')
        return
      }

      setCreatedDemo(result.data)
      await onCreated?.()
      toast.success('Demo creada correctamente')
    } catch (_error) {
      toast.error('Error creando demo')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Crear Demo de Plan</DialogTitle>
          <DialogDescription>
            Provisiona un tenant demo con licencia corta y credenciales temporales.
          </DialogDescription>
        </DialogHeader>

        {!createdDemo ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Plan</span>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {planes.map((plan: any) => (
                    <SelectItem key={plan.planId} value={plan.planId}>
                      {plan.nombre} - ${plan.precio}/{plan.duracionDias} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Nombre demo (opcional)</span>
              <Input
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                placeholder="Ej: Demo Profesional Caribe"
              />
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Duración (días)</span>
              <Input
                type="number"
                min={1}
                max={30}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Demo creada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Tenant</div>
                    <div className="font-medium">{createdDemo.tenantId}</div>
                  </div>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Usuario</div>
                    <div className="font-medium">{createdDemo.email}</div>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => copyValue(createdDemo.email, 'Usuario')} aria-label="Copiar usuario de demo">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Contraseña temporal</div>
                    <div className="font-medium">{createdDemo.password}</div>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => copyValue(createdDemo.password, 'Contraseña')} aria-label="Copiar contraseña de demo">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Plan</div>
                    <div className="font-medium">{createdDemo.planName}</div>
                  </div>
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">
                  Expira el {format(new Date(createdDemo.expiresAt), 'dd/MM/yyyy HH:mm')}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {createdDemo ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!createdDemo && (
            <Button onClick={handleCreate} disabled={!planId || isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Demo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConvertDemoDialog({
  open,
  onClose,
  planes,
  licencia,
  onConvert,
}: {
  open: boolean
  onClose: () => void
  planes: any[]
  licencia: any | null
  onConvert: (data: { tenantLicenseId: string; planId: string; durationDays?: number }) => Promise<void>
}) {
  const [planId, setPlanId] = useState('')
  const [durationDays, setDurationDays] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !licencia) return
    setPlanId(licencia.planId ?? '')
    setDurationDays('')
  }, [open, licencia])

  const handleClose = () => {
    if (isSubmitting) return
    setPlanId('')
    setDurationDays('')
    onClose()
  }

  const handleConvert = async () => {
    if (!licencia?.tenantLicenseId || !planId) return

    try {
      setIsSubmitting(true)
      await onConvert({
        tenantLicenseId: licencia.tenantLicenseId,
        planId,
        ...(durationDays ? { durationDays: Number(durationDays) } : {}),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Convertir Demo a Plan Pago</DialogTitle>
          <DialogDescription>
            Mantiene el mismo tenant y sus datos, pero reemplaza la licencia demo por una comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs text-muted-foreground">Tenant</div>
            <div className="font-medium">{licencia?.tenant?.nombre ?? licencia?.tenantId ?? '—'}</div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Nuevo plan</span>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((plan: any) => (
                  <SelectItem key={plan.planId} value={plan.planId}>
                    {plan.nombre} - ${plan.precio}/{plan.duracionDias} días
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Duración manual (opcional)</span>
            <Input
              type="number"
              min={1}
              max={3650}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              placeholder="Usar duración del plan"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConvert} disabled={!planId || isSubmitting}>
            {isSubmitting ? 'Convirtiendo...' : 'Convertir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenewLicenciaDialog({
  open,
  onClose,
  onContinue,
  planes,
  licencia,
  buildRenewalKey,
}: {
  open: boolean
  onClose: () => void
  onContinue: (draft: {
    planId: string
    registerPayment: boolean
    amountPaidUsd?: number
    idempotencyKey?: string
  }) => void
  planes: any[]
  licencia: any | null
  buildRenewalKey: (tenantId: string, planId: string) => string
}) {
  const [planId, setPlanId] = useState('')
  const [registerPayment, setRegisterPayment] = useState(false)
  const [amountPaidUsd, setAmountPaidUsd] = useState<string>('')
  const [idempotencyKey, setIdempotencyKey] = useState('')

  useEffect(() => {
    if (!open || !licencia) return
    setPlanId(licencia.planId ?? '')
    setRegisterPayment(false)
    setAmountPaidUsd('')
    setIdempotencyKey('')
  }, [open, licencia])

  const selectedPlan = planes.find((p: any) => p.planId === planId)
  const newPlanDuration = selectedPlan?.duracionDias ?? licencia?.plan?.duracionDias ?? 0

  const baseExpiracion = (() => {
    if (!licencia?.expiracion) return new Date()
    const exp = new Date(licencia.expiracion)
    return exp.getTime() > Date.now() ? exp : new Date()
  })()
  const newExpiracion = addDays(baseExpiracion, newPlanDuration)

  const exigible = (() => {
    const list = Number(licencia?.listPriceUsd ?? selectedPlan?.precio ?? 0)
    const final = Number(licencia?.finalPriceUsd ?? list)
    return final || list
  })()

  const handleClose = () => {
    onClose()
  }

  const handleContinue = () => {
    if (!licencia || !planId) return
    const finalKey =
      idempotencyKey ||
      buildRenewalKey(licencia.tenantId ?? 'tenant', planId)
    const amount = amountPaidUsd ? Number(amountPaidUsd) : undefined
    onContinue({
      planId,
      registerPayment,
      ...(amount !== undefined ? { amountPaidUsd: amount } : {}),
      idempotencyKey: registerPayment ? finalKey : undefined,
    })
  }

  const canContinue = Boolean(
    planId &&
      (!registerPayment ||
        !amountPaidUsd ||
        Number(amountPaidUsd) > 0),
  )

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : undefined)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Renovar licencia</DialogTitle>
          <DialogDescription>
            Suma la duración del plan a la fecha de vencimiento actual, sin
            penalizar la renovación anticipada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs text-muted-foreground">Tenant</div>
            <div className="font-medium">{licencia?.tenant?.nombre ?? '—'}</div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs text-muted-foreground">Plan actual</div>
            <div className="font-medium">
              {licencia?.plan?.nombre ?? 'Sin plan'}
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Vencimiento actual
            </div>
            <div className="font-medium">
              {licencia?.expiracion
                ? format(new Date(licencia.expiracion), 'dd/MM/yyyy')
                : '—'}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Nuevo plan</span>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((plan: any) => (
                  <SelectItem key={plan.planId} value={plan.planId}>
                    {plan.nombre} · {plan.duracionDias} días · $
                    {Number(plan.precio)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox
                checked={registerPayment}
                onCheckedChange={(v) => setRegisterPayment(v === true)}
              />
              Registrar pago de renovación
            </label>
          </div>

          {registerPayment && (
            <div className="grid gap-3 rounded-md border p-3 bg-muted/30">
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">
                  Monto exigible
                </span>
                <div className="font-medium">${exigible.toFixed(2)}</div>
              </div>
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">
                  Monto pagado (opcional)
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountPaidUsd}
                  onChange={(e) => setAmountPaidUsd(e.target.value)}
                  placeholder={`${exigible.toFixed(2)}`}
                />
              </div>
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">
                  Clave de idempotencia
                </span>
                <Input
                  value={
                    idempotencyKey ||
                    (licencia
                      ? buildRenewalKey(
                          licencia.tenantId ?? 'tenant',
                          planId,
                        )
                      : '')
                  }
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  placeholder="renewal:tenantId:planId:fecha"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleContinue} disabled={!canContinue}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenewConfirmAlertDialog({
  open,
  onClose,
  onConfirm,
  licencia,
  planes,
  draft,
  isSubmitting,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  licencia: any | null
  planes: any[]
  draft: {
    planId: string
    registerPayment: boolean
    amountPaidUsd?: number
    idempotencyKey?: string
  }
  isSubmitting: boolean
}) {
  const newPlan = planes.find((p: any) => p.planId === draft.planId)
  const currentPlan = licencia?.plan
  const newDuration = newPlan?.duracionDias ?? currentPlan?.duracionDias ?? 0

  const baseExpiracion = (() => {
    if (!licencia?.expiracion) return new Date()
    const exp = new Date(licencia.expiracion)
    return exp.getTime() > Date.now() ? exp : new Date()
  })()
  const newExpiracion = addDays(baseExpiracion, newDuration)

  const precio = Number(newPlan?.precio ?? currentPlan?.precio ?? 0)
  const precioFinal = Number(licencia?.finalPriceUsd ?? precio)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => (!v ? onClose() : undefined)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar renovación</AlertDialogTitle>
          <AlertDialogDescription>
            Revisa el resumen antes de aplicar la renovación.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-muted-foreground">Tenant</span>
            <span className="font-medium">
              {licencia?.tenant?.nombre ?? '—'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">
              {currentPlan?.nombre ?? 'Sin plan'}
              <span className="mx-2 text-muted-foreground">→</span>
              {newPlan?.nombre ?? currentPlan?.nombre ?? '—'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-muted-foreground">Duración</span>
            <span className="font-medium">{newDuration} días</span>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-muted-foreground">Expiración</span>
            <span className="font-medium">
              {licencia?.expiracion
                ? format(new Date(licencia.expiracion), 'dd/MM/yyyy')
                : '—'}
              <span className="mx-2 text-muted-foreground">→</span>
              {format(newExpiracion, 'dd/MM/yyyy')}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <span className="text-muted-foreground">Precio</span>
            <span className="font-medium">${precioFinal.toFixed(2)}</span>
          </div>
          {draft.registerPayment && (
            <>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-muted-foreground">Pago a registrar</span>
                <span className="font-medium">
                  ${(draft.amountPaidUsd ?? precioFinal).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-muted-foreground">
                  Idempotency key
                </span>
                <span className="font-mono text-xs">
                  {draft.idempotencyKey}
                </span>
              </div>
            </>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Renovando...' : 'Confirmar renovación'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * @description Diálogo genérico de confirmación para acciones destructivas o
 * masivas (reemplaza `window.confirm`).
 * @param {{ title: string; description: string; destructive?: boolean; onConfirm: () => void } | null} state - Estado de la confirmación o `null` para cerrar.
 * @param {() => void} onClose - Callback al cerrar el diálogo.
 * @returns {JSX.Element} AlertDialog de confirmación.
 */
function ConfirmAlertDialog({
  state,
  onClose,
}: {
  state: {
    title: string
    description: string
    destructive?: boolean
    onConfirm: () => void
  } | null
  onClose: () => void
}) {
  return (
    <AlertDialog
      open={state !== null}
      onOpenChange={(v) => (!v ? onClose() : undefined)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          <AlertDialogDescription>{state?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={state?.onConfirm}
            className={
              state?.destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
