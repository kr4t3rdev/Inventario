'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { AdminTableLoader } from "@/features/admin/components/animations"
import { getSessionsAction, deleteSessionAction, getCloudinaryAssetsAction, cleanupCloudinaryAssetsAction } from "@/features/admin/actions"
import { format } from "date-fns"
import { toast } from "sonner"
import { CheckSquare, Download, Eraser, LogOut, RefreshCw, Shield, Square, Trash2 } from "lucide-react"
import type { UserSession } from "@/app/models/model"

interface SessionWithUser extends UserSession {
  user?: {
    userId: string
    name: string
    email: string
    role: string
  }
}

interface CloudinaryAssetRow {
  assetId: string
  tenantId: string
  ownerType: string
  ownerId: string
  slot: string
  publicId: string
  resourceType: string
  status: string
  updatedAt: string | Date
  deletedAt?: string | Date | null
}

function escapeCsvValue(value: unknown): string {
  const normalized = String(value ?? '')
  return `"${normalized.replace(/"/g, '""')}"`
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
}

export function SessionsTab() {
  const shouldReduceMotion = useReducedMotion()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [assets, setAssets] = useState<CloudinaryAssetRow[]>([])
  const [assetsSummary, setAssetsSummary] = useState({ active: 0, replaced: 0, deleted: 0 })
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [assetStatus, setAssetStatus] = useState<'all' | 'active' | 'replaced' | 'deleted'>('replaced')
  const [tenantId, setTenantId] = useState('')
  const [ownerType, setOwnerType] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [slot, setSlot] = useState('')
  const [olderThanDays, setOlderThanDays] = useState('7')
  const [cleanupLimit, setCleanupLimit] = useState('20')
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [isCleaning, setIsCleaning] = useState(false)
  const [lastCleanupFailed, setLastCleanupFailed] = useState<Array<{ publicId: string; reason?: string }>>([])
  const [lastDryRunAssets, setLastDryRunAssets] = useState<CloudinaryAssetRow[]>([])

  const fetchSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getSessionsAction()
      setSessions(((data?.success ? data.data : []) ?? []) as unknown as UserSession[])
    } catch {
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCloudinaryAssets = useCallback(async () => {
    setAssetsLoading(true)
    try {
      const response = await getCloudinaryAssetsAction({
        status: assetStatus,
        tenantId: tenantId || undefined,
        ownerType: ownerType || undefined,
        ownerId: ownerId || undefined,
        slot: slot || undefined,
        limit: Number(cleanupLimit) || 20,
      })
      if (response.success) {
        setAssets((response.data?.assets ?? []) as CloudinaryAssetRow[])
        setAssetsSummary(response.data?.summary ?? { active: 0, replaced: 0, deleted: 0 })
      } else {
        setAssets([])
      }
    } catch {
      setAssets([])
    } finally {
      setAssetsLoading(false)
    }
  }, [assetStatus, tenantId, ownerType, ownerId, slot, cleanupLimit])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    fetchCloudinaryAssets()
  }, [fetchCloudinaryAssets])

  const paginatedSessions = sessions?.slice((page - 1) * perPage, page * perPage) || []
  const totalPages = sessions ? Math.ceil(sessions.length / perPage) : 1

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSessionAction(sessionId)
      toast.success("Sesión cerrada correctamente")
      fetchSessions()
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al cerrar sesión")
    }
  }

  const handleRunCleanup = async (mode: 'selected' | 'stale', dryRun: boolean) => {
    try {
      setIsCleaning(true)
      const response = await cleanupCloudinaryAssetsAction({
        mode,
        dryRun,
        assetIds: selectedAssets,
        tenantId: tenantId || undefined,
        ownerType: ownerType || undefined,
        ownerId: ownerId || undefined,
        slot: slot || undefined,
        olderThanDays: Number(olderThanDays) || 0,
        limit: Number(cleanupLimit) || 20,
      })

      if (!response.success) {
        throw new Error(response.error?.message || 'Error al ejecutar cleanup')
      }

      const data = response.data as {
        dryRun: boolean
        matched: number
        deleted?: number
        assets?: CloudinaryAssetRow[]
        failed?: Array<{ publicId: string }>
      }

      if (dryRun) {
        toast.success(`Dry run listo: ${data.matched} asset(s) candidatos`)
        setLastDryRunAssets(data.assets ?? [])
        setLastCleanupFailed([])
      } else {
        toast.success(
          `Cleanup remoto: ${data.deleted ?? 0} eliminado(s), ${data.failed?.length ?? 0} fallo(s)`
        )
        setSelectedAssets([])
        setLastDryRunAssets([])
        setLastCleanupFailed(data.failed ?? [])
      }

      fetchCloudinaryAssets()
    } catch (error) {
      console.error(error)
      toast.error("Error al ejecutar cleanup remoto")
    } finally {
      setIsCleaning(false)
    }
  }

  const visibleAssetIds = assets.map((asset) => asset.assetId)
  const allVisibleSelected =
    visibleAssetIds.length > 0 &&
    visibleAssetIds.every((assetId) => selectedAssets.includes(assetId))

  const handleExportVisibleAssets = () => {
    if (assets.length === 0) {
      toast.error('No hay assets visibles para exportar')
      return
    }

    const rows = [
      [
        'assetId',
        'tenantId',
        'ownerType',
        'ownerId',
        'slot',
        'publicId',
        'resourceType',
        'status',
        'updatedAt',
        'deletedAt',
      ].join(','),
      ...assets.map((asset) =>
        [
          asset.assetId,
          asset.tenantId,
          asset.ownerType,
          asset.ownerId,
          asset.slot,
          asset.publicId,
          asset.resourceType,
          asset.status,
          format(new Date(asset.updatedAt), 'yyyy-MM-dd HH:mm:ss'),
          asset.deletedAt
            ? format(new Date(asset.deletedAt), 'yyyy-MM-dd HH:mm:ss')
            : '',
        ]
          .map(escapeCsvValue)
          .join(',')
      ),
    ].join('\n')

    downloadCsv(
      rows,
      `cloudinary-assets-${new Date().toISOString().split('T')[0]}.csv`
    )
    toast.success('Assets visibles exportados correctamente')
  }

  const handleExportFailedCleanup = () => {
    if (lastCleanupFailed.length === 0) {
      toast.error('No hay fallos para exportar')
      return
    }

    const rows = [
      ['publicId', 'reason'].join(','),
      ...lastCleanupFailed.map((failed) =>
        [failed.publicId, failed.reason ?? ''].map(escapeCsvValue).join(',')
      ),
    ].join('\n')

    downloadCsv(
      rows,
      `cloudinary-cleanup-failures-${new Date().toISOString().split('T')[0]}.csv`
    )
    toast.success('Fallos del cleanup exportados correctamente')
  }

  const handleExportLastDryRun = () => {
    if (lastDryRunAssets.length === 0) {
      toast.error('No hay snapshot de dry run para exportar')
      return
    }

    const rows = [
      [
        'assetId',
        'tenantId',
        'ownerType',
        'ownerId',
        'slot',
        'publicId',
        'resourceType',
        'status',
        'updatedAt',
        'deletedAt',
      ].join(','),
      ...lastDryRunAssets.map((asset) =>
        [
          asset.assetId,
          asset.tenantId,
          asset.ownerType,
          asset.ownerId,
          asset.slot,
          asset.publicId,
          asset.resourceType,
          asset.status,
          format(new Date(asset.updatedAt), 'yyyy-MM-dd HH:mm:ss'),
          asset.deletedAt
            ? format(new Date(asset.deletedAt), 'yyyy-MM-dd HH:mm:ss')
            : '',
        ]
          .map(escapeCsvValue)
          .join(',')
      ),
    ].join('\n')

    downloadCsv(
      rows,
      `cloudinary-dry-run-${new Date().toISOString().split('T')[0]}.csv`
    )
    toast.success('Snapshot del último dry run exportado correctamente')
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eraser className="h-4 w-4" />
            Cleanup remoto de Cloudinary
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Activos: {assetsSummary.active}</Badge>
            <Badge variant="outline">Replaced: {assetsSummary.replaced}</Badge>
            <Badge variant="outline">Deleted: {assetsSummary.deleted}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={assetStatus} onValueChange={(value: 'all' | 'active' | 'replaced' | 'deleted') => setAssetStatus(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replaced">Replaced</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="tenantId"
              className="w-40"
            />
            <Input
              value={ownerType}
              onChange={(e) => setOwnerType(e.target.value)}
              placeholder="ownerType"
              className="w-40"
            />
            <Input
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="ownerId"
              className="w-40"
            />
            <Input
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              placeholder="slot"
              className="w-28"
            />
            <Input
              value={olderThanDays}
              onChange={(e) => setOlderThanDays(e.target.value)}
              placeholder="días"
              className="w-24"
            />
            <Input
              value={cleanupLimit}
              onChange={(e) => setCleanupLimit(e.target.value)}
              placeholder="limit"
              className="w-24"
            />
            <Button variant="outline" onClick={fetchCloudinaryAssets} disabled={assetsLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refrescar
            </Button>
            <Button variant="outline" onClick={handleExportVisibleAssets} disabled={assets.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar visibles
            </Button>
            <Button variant="outline" onClick={() => handleRunCleanup('stale', true)} disabled={isCleaning}>
              Dry run stale
            </Button>
            <Button
              variant="outline"
              onClick={() => handleRunCleanup('selected', true)}
              disabled={isCleaning || selectedAssets.length === 0}
            >
              Dry run selected
            </Button>
            <Button
              variant="outline"
              onClick={handleExportLastDryRun}
              disabled={lastDryRunAssets.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar último dry run
            </Button>
            <Button onClick={() => handleRunCleanup('stale', false)} disabled={isCleaning}>
              Cleanup stale
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRunCleanup('selected', false)}
              disabled={isCleaning || selectedAssets.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Borrar seleccionados
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setSelectedAssets(allVisibleSelected ? [] : visibleAssetIds)
              }
              disabled={assets.length === 0}
            >
              {allVisibleSelected ? (
                <Square className="mr-2 h-4 w-4" />
              ) : (
                <CheckSquare className="mr-2 h-4 w-4" />
              )}
              {allVisibleSelected ? 'Limpiar selección' : 'Seleccionar visibles'}
            </Button>
            <Button
              variant="outline"
              onClick={handleExportFailedCleanup}
              disabled={lastCleanupFailed.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar fallos
            </Button>
          </div>

          {assetsLoading ? (
            <AdminTableLoader columns={7} rows={4} caption="Cargando assets Cloudinary..." />
          ) : assets.length > 0 ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Public ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.assetId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedAssets.includes(asset.assetId)}
                          onCheckedChange={(checked) => {
                            setSelectedAssets((prev) =>
                              checked
                                ? [...prev, asset.assetId]
                                : prev.filter((id) => id !== asset.assetId)
                            )
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{asset.ownerType}</TableCell>
                      <TableCell>{asset.tenantId}</TableCell>
                      <TableCell>{asset.slot}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={asset.publicId}>
                        {asset.publicId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={asset.status === 'deleted' ? 'secondary' : 'outline'}>
                          {asset.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(asset.updatedAt), "dd/MM/yyyy HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No hay assets para ese filtro.
            </div>
          )}

          {lastCleanupFailed.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="mb-2 text-sm font-medium">Fallos del último cleanup</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {lastCleanupFailed.map((failed) => (
                  <div key={failed.publicId}>
                    <span className="font-medium">{failed.publicId}</span>
                    {failed.reason ? ` — ${failed.reason}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">Total: {sessions?.length || 0} sesiones</p>
          <Select value={perPage.toString()} onValueChange={(v) => { setPerPage(parseInt(v)); setPage(1) }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 por página</SelectItem>
              <SelectItem value="10">10 por página</SelectItem>
              <SelectItem value="20">20 por página</SelectItem>
              <SelectItem value="50">50 por página</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {sessions && sessions.length > 0 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
              </PaginationItem>
              <PaginationItem>
                <span className="flex items-center px-4">Página {page} de {totalPages}</span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {isLoading ? (
        <AdminTableLoader columns={7} rows={5} caption="Cargando sesiones activas..." />
      ) : paginatedSessions.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead>Última actividad</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSessions.map((session: SessionWithUser, index: number) => (
                <TableRow key={session.id} className={shouldReduceMotion ? '' : 'animate-fade-in'}
                  style={shouldReduceMotion ? undefined : { animationDelay: `${Math.min(index * 35, 240)}ms`, animationFillMode: 'both' }}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{session.user?.name || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">{session.user?.email || "N/A"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {session.isActive ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700">Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{session.ipAddress || "N/A"}</TableCell>
                  <TableCell>{format(new Date(session.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>{format(new Date(session.lastActive), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>{session.expiresAt ? format(new Date(session.expiresAt), "dd/MM/yyyy HH:mm") : "N/A"}</TableCell>
                  <TableCell className="text-right">
                    {session.isActive && (
                      <Button variant="outline" size="sm" onClick={() => handleDeleteSession(session.id)}
                        className="text-rose-600 hover:text-rose-700">
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center dark:bg-muted/10">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Shield className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No hay sesiones activas</p>
              <p className="text-xs text-muted-foreground">Las sesiones de los usuarios aparecerán aquí cuando inicien sesión.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
