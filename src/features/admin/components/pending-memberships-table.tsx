'use client'

import { LazyMotion, m as motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Loader2, RefreshCw, UserPlus, Check, X, Clock, PartyPopper } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface PendingMembership {
  membershipId: string
  tenantId: string
  userId: string
  tenantRole: string | null
  isActive: boolean
  createdAt: string
  user: {
    userId: string
    name: string
    email: string
    onboardingType: string | null
    onboardingStatus: string | null
    createdAt: string
  }
}

interface PendingMembershipsTableProps {
  memberships: PendingMembership[]
  isLoading: boolean
  onRefresh: () => void
  onApprove: (membership: PendingMembership) => void
  onReject: (membership: PendingMembership) => void
}

const onboardingTypeLabel: Record<string, string> = {
  worker: 'Trabajador',
  company: 'Empresa',
}

/** Genera iniciales a partir del nombre */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * @description Tabla de solicitudes de acceso pendientes, con timeline visual y acciones hover.
 * @param {PendingMembershipsTableProps} props - Membresías, handlers de aprobar/rechazar
 * @returns {JSX.Element} Tabla con acciones y estados visuales
 */
export function PendingMembershipsTable({
  memberships,
  isLoading,
  onRefresh,
  onApprove,
  onReject,
}: PendingMembershipsTableProps) {
  const shouldReduceMotion = useReducedMotion()

  if (isLoading) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CardTitle>Solicitudes Pendientes</CardTitle>
          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8" aria-label="Refrescar solicitudes">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {memberships.length === 0 ? (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-16 text-center"
          >
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <PartyPopper className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>

            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">¡Todo al día!</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                No hay solicitudes de acceso pendientes. Los nuevos empleados que soliciten unirse aparecerán acá.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="py-3 pl-6">Solicitante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead className="pr-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {memberships.map((membership, index) => (
                    <motion.tr
                      key={membership.membershipId}
                      layout={shouldReduceMotion ? false : true}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 8 }}
                      transition={{ delay: shouldReduceMotion ? 0 : index * 0.03, duration: 0.25 }}
                      className="group border-b border-border/50 transition-colors hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                    >
                      <TableCell className="py-3 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10 border-2 border-amber-200 dark:border-amber-800">
                              <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                                {getInitials(membership.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium">{membership.user.name}</div>
                            <div className="text-xs text-muted-foreground">{membership.user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {onboardingTypeLabel[membership.user.onboardingType ?? ''] || 'Usuario'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {formatDistanceToNow(new Date(membership.createdAt), { locale: es, addSuffix: true })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                            onClick={() => onReject(membership)}
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Rechazar</span>
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-1.5 bg-purple text-white hover:bg-purple/90"
                            onClick={() => onApprove(membership)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Aprobar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
