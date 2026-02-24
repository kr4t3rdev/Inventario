'use client';

import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  Sparkles,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';

import { Usuario } from '@/app/models/model';
import { AdminUsersTable } from '@/components/admin/admin-users-table';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { EditUserDialog } from '@/components/admin/edit-user-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard,
} from '@/components/ui/animations';
import { useAuth } from '@/contexts/auth-context';
import { useGetUserMetricsQuery, useGetUserQuery } from '@/lib/redux/services/adminApi';
import { motion, type Variants } from 'framer-motion';

const UserActivityCharts = dynamic(
  () => import('@/components/admin/user-activity-charts').then((mod) => mod.UserActivityCharts),
  { ssr: false },
);

const TemporalDashboard = dynamic(
  () => import('@/components/admin/temporal-dashboard').then((mod) => mod.TemporalDashboard),
  { ssr: false },
);

const UserMonitoringPanel = dynamic(
  () => import('@/components/admin/user-monitoring-panel').then((mod) => mod.UserMonitoringPanel),
  { ssr: false },
);

interface AdminStatCard {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  valueClassName: string;
}

const headerIconVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.05,
    rotate: 5,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 10,
    },
  },
};

const sparklesVariants: Variants = {
  animate: {
    rotate: 360,
    scale: [1, 1.2, 1],
    transition: {
      rotate: { duration: 18, repeat: Infinity, ease: 'linear' },
      scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
  },
};

const titleVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

/**
 * @description Página principal de administración de usuarios con métricas, tabla y paneles.
 * @returns {JSX.Element} Interfaz completa para gestión de usuarios del sistema.
 */
export default function AdminUsersPage(): React.JSX.Element {
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: users, isLoading, refetch: refetchUsers } = useGetUserQuery();
  const { refetch: refetchMetrics } = useGetUserMetricsQuery({ months: 6 });

  const safeUsers = users ?? [];
  const activeUsers = safeUsers.filter((candidate) => candidate.isActive).length;
  const inactiveUsers = safeUsers.filter((candidate) => !candidate.isActive).length;
  const adminUsers = safeUsers.filter((candidate) => candidate.role === 'admin').length;
  const lockedUsers = safeUsers.filter((candidate) => {
    return Boolean(candidate.lockedUntil && new Date(candidate.lockedUntil) > new Date());
  }).length;
  const expiringSoon = safeUsers.filter((candidate) => {
    if (!candidate.expiresAt) {
      return false;
    }
    const daysUntilExpiry = Math.ceil(
      (new Date(candidate.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }).length;

  const statCards = useMemo<AdminStatCard[]>(
    () => [
      {
        title: 'Usuarios Activos',
        value: activeUsers,
        description: safeUsers.length
          ? `${Math.round((activeUsers / safeUsers.length) * 100)}% del total`
          : '0%',
        icon: User,
        valueClassName: 'text-emerald-600 dark:text-emerald-400',
      },
      {
        title: 'Usuarios Inactivos',
        value: inactiveUsers,
        description: safeUsers.length
          ? `${Math.round((inactiveUsers / safeUsers.length) * 100)}% del total`
          : '0%',
        icon: User,
        valueClassName: 'text-rose-600 dark:text-rose-400',
      },
      {
        title: 'Administradores',
        value: adminUsers,
        description: 'Con permisos completos',
        icon: Shield,
        valueClassName: 'text-sky-600 dark:text-sky-400',
      },
      {
        title: 'Bloqueados',
        value: lockedUsers,
        description: 'Por intentos fallidos',
        icon: AlertTriangle,
        valueClassName: 'text-violet-600 dark:text-violet-400',
      },
      {
        title: 'Expiran Pronto',
        value: expiringSoon,
        description: 'En los próximos 7 días',
        icon: Clock,
        valueClassName: 'text-amber-600 dark:text-amber-400',
      },
    ],
    [activeUsers, adminUsers, expiringSoon, inactiveUsers, lockedUsers, safeUsers.length],
  );

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchUsers(), refetchMetrics()]);
    } catch (error) {
      console.error('Error al refrescar datos:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEditUser = (candidate: Usuario): void => {
    setSelectedUser(candidate);
    setEditDialogOpen(true);
  };

  const handleDialogClose = (): void => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setSelectedUser(null);
    refetchUsers();
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md border-border/70 bg-card/90 shadow-lg backdrop-blur-sm">
          <CardContent className="flex flex-col items-center p-7">
            <AlertTriangle className="mb-4 h-12 w-12 text-rose-500 dark:text-rose-400" />
            <h2 className="mb-2 text-xl font-semibold">Acceso Denegado</h2>
            <p className="text-center text-muted-foreground">
              No tienes permisos para acceder a esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageTransition className="relative min-h-screen w-full">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl dark:bg-blue-500/5 mix-blend-multiply dark:mix-blend-screen"
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 20, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5 mix-blend-multiply dark:mix-blend-screen"
          animate={{
            scale: [1, 1.15, 1],
            x: [0, -30, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />
        <motion.div
          className="absolute -bottom-8 left-1/3 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl dark:bg-violet-500/5 mix-blend-multiply dark:mix-blend-screen"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 25, 0],
            y: [0, 15, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
      </div>

      <StaggerContainer className="flex flex-1 flex-col">
        <StaggerItem className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header */}
          <motion.div
            className="flex items-center gap-3 px-4 lg:px-6"
            variants={titleVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg"
              variants={headerIconVariants}
              initial="initial"
              whileHover="hover"
            >
              <ShieldCheck className="h-6 w-6 text-white" />
              <motion.div variants={sparklesVariants} animate="animate" className="absolute -right-1 -top-1">
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              </motion.div>
              <motion.div
                className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                animate={{
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{ mixBlendMode: 'overlay' }}
              />
            </motion.div>
            <div>
              <motion.h1
                className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                Gestión de Usuarios
              </motion.h1>
              <motion.p
                className="text-muted-foreground text-sm"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Administra usuarios, roles y permisos del sistema
              </motion.p>
            </div>

            <motion.div
              className="ml-auto flex flex-col gap-2 sm:flex-row"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            >
              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={isRefreshing}
                className="border-slate-200/70 bg-white/70 backdrop-blur-sm transition-all duration-200 hover:shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </Button>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-gradient-to-r from-violet-600 to-purple-600 text-white transition-all duration-200 hover:from-violet-600/90 hover:to-purple-600/90 hover:shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear Usuario
              </Button>
            </motion.div>
          </motion.div>

          {/* Stat Cards */}
          <motion.div
            className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-5 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <AnimatedCard
                  key={card.title}
                  className="rounded-xl border bg-card shadow-sm"
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    <div className="rounded-md bg-gradient-to-br from-violet-600/15 to-purple-600/15 p-2">
                      <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${card.valueClassName}`}>{card.value}</div>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </CardContent>
                </AnimatedCard>
              );
            })}
          </motion.div>

          {/* Users Table */}
          <motion.div
            className="px-4 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Card className="rounded-xl border border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Lista de Usuarios</CardTitle>
                <CardDescription>Gestiona todos los usuarios del sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminUsersTable
                  users={safeUsers}
                  isLoading={isLoading}
                  onEditUser={handleEditUser}
                  onRefresh={refetchUsers}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Activity Charts */}
          <motion.div
            className="px-4 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <UserActivityCharts />
          </motion.div>

          {/* Temporal Dashboard */}
          <motion.div
            className="px-4 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <TemporalDashboard />
          </motion.div>

          {/* User Monitoring Panel */}
          <motion.div
            className="px-4 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <UserMonitoringPanel />
          </motion.div>
        </StaggerItem>
      </StaggerContainer>

      <CreateUserDialog open={createDialogOpen} onClose={handleDialogClose} />
      {selectedUser && (
        <EditUserDialog open={editDialogOpen} onClose={handleDialogClose} user={selectedUser} />
      )}
    </PageTransition>
  );
}
