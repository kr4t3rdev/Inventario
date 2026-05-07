'use client'

import { useState, useCallback } from 'react'
import { ShieldCheck, Sparkles, Users, UserPlus, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import Link from 'next/link'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import {
  useGetGlobalUsersQuery,
  useGetPendingMembershipsQuery,
  useApproveMembershipMutation,
  useRejectMembershipMutation,
} from '@/features/admin/services/adminApi'
import { TenantUsersStats } from './tenant-users-stats'
import { TenantUsersTable } from './tenant-users-table'
import { PendingMembershipsTable } from './pending-memberships-table'
import { MembershipActionDialog } from './membership-action-dialog'
import { TenantUsersSkeleton } from './tenant-users-skeleton'

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

/**
 * @description Página principal del panel de control de usuarios para manager del tenant.
 * Muestra tabs con usuarios activos y solicitudes pendientes.
 * @returns {JSX.Element} Panel completo de gestión de usuarios del tenant
 */
export function TenantUsersPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('usuarios')
  const [selectedMembership, setSelectedMembership] = useState<PendingMembership | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useGetGlobalUsersQuery({
    tenantId: (user as any)?.tenantId ?? undefined,
    limit: 100,
  })

  const {
    data: pendingMemberships = [],
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetPendingMembershipsQuery()

  const [approveMembership] = useApproveMembershipMutation()
  const [rejectMembership] = useRejectMembershipMutation()

  const safeUsers = usersData?.users ?? []
  const activeUsers = safeUsers.filter((u) => u.isActive).length
  const adminUsers = safeUsers.filter((u) => {
    const role = u.tenantRole ?? u.role
    return role === 'manager' || role === 'admin'
  }).length
  const pendingCount = pendingMemberships.length

  const handleRefresh = useCallback(() => {
    refetchUsers()
    refetchPending()
  }, [refetchUsers, refetchPending])

  const handleApproveClick = useCallback((membership: PendingMembership) => {
    setSelectedMembership(membership)
    setDialogOpen(true)
  }, [])

  const handleReject = useCallback(async (membership: PendingMembership) => {
    try {
      await rejectMembership(membership.membershipId).unwrap()
      toast.success(`Solicitud de ${membership.user.name} rechazada.`)
      refetchPending()
      refetchUsers()
    } catch (error) {
      console.error('Error rechazando membresía:', error)
      toast.error('Error al rechazar la solicitud.')
    }
  }, [rejectMembership, refetchPending, refetchUsers])

  const handleConfirmApprove = useCallback(async (membershipId: string, tenantRole: string) => {
    try {
      await approveMembership({ id: membershipId, tenantRole }).unwrap()
      toast.success('Acceso aprobado correctamente.')
      refetchPending()
      refetchUsers()
    } catch (error) {
      console.error('Error aprobando membresía:', error)
      toast.error('Error al aprobar el acceso.')
      throw error
    }
  }, [approveMembership, refetchPending, refetchUsers])

  const pendingBadge = pendingCount > 0 ? pendingCount.toString() : undefined

  // Mostrar skeleton mientras se carga la data inicial (sin cache)
  const isLoading = usersLoading && !usersData

  if (isLoading) {
    return (
      <div className="relative min-h-screen w-full">
        <div className="flex flex-col gap-6 py-4 md:py-6">
          <TenantUsersSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl dark:bg-violet-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5"
          animate={{ scale: [1, 1.15, 1], x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </div>

      <div className="flex flex-col gap-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-purple-600 shadow-lg">
              <Users className="h-6 w-6 text-white" />
              <motion.div
                className="absolute -right-1 -top-1"
                animate={{ rotate: 360 }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              </motion.div>
            </div>
            <div>
              {/* Breadcrumb */}
              <nav className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href="/busy/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
                <ChevronRight className="h-3 w-3" />
                <Link href="/busy/configuracion" className="hover:text-foreground transition-colors">
                  Configuración
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">Usuarios</span>
              </nav>
              <h1 className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Gestión de Usuarios
              </h1>
              <p className="text-muted-foreground text-sm">
                Administrá los usuarios y solicitudes de acceso de tu empresa
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 lg:px-6">
          <TenantUsersStats
            total={safeUsers.length}
            active={activeUsers}
            admins={adminUsers}
            pending={pendingCount}
          />
        </div>

        {/* Tabs */}
        <div className="px-4 lg:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="usuarios" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuarios Activos
              </TabsTrigger>
              <TabsTrigger value="solicitudes" className="flex items-center gap-2 relative">
                <UserPlus className="h-4 w-4" />
                Solicitudes Pendientes
                {pendingBadge && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {pendingBadge}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="usuarios" className="mt-4">
              <TenantUsersTable
                users={safeUsers.map((u) => ({
                  userId: u.userId,
                  name: u.name,
                  email: u.email,
                  tenantRole: u.tenantRole,
                  isActive: u.isActive,
                  createdAt: u.createdAt,
                }))}
                isLoading={usersLoading}
                onRefresh={handleRefresh}
              />
            </TabsContent>

            <TabsContent value="solicitudes" className="mt-4">
              <PendingMembershipsTable
                memberships={pendingMemberships}
                isLoading={pendingLoading}
                onRefresh={refetchPending}
                onApprove={handleApproveClick}
                onReject={handleReject}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Approve Dialog */}
      <MembershipActionDialog
        membership={selectedMembership}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setSelectedMembership(null)
        }}
        onConfirm={handleConfirmApprove}
      />
    </div>
  )
}
