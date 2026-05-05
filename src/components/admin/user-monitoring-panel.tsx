'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { useGetUserQuery, useGetExpiringSoonQuery, useLockUserMutation, useUnlockUserMutation } from "@/lib/redux/services/adminApi"
import { toast } from "sonner"
import { Activity, Clock, Shield, Unlock, Lock, Calendar, Sparkles } from "lucide-react"
import { ActivityLogsTab } from "./activity-logs-tab"
import { SessionsTab } from "./sessions-tab"
import { BlockedUsersTab } from "./blocked-users-tab"
import { ExpiringUsersTab } from "./expiring-users-tab"
import { LoginHistoryDialog } from "./login-history-dialog"
import type { Usuario } from "@/app/models/model"

export function UserMonitoringPanel() {
  const shouldReduceMotion = useReducedMotion()
  const [activeTab, setActiveTab] = useState<"logs" | "sessions" | "blocked" | "expiring">("logs")
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string } | null>(null)
  const [lockDialogOpen, setLockDialogOpen] = useState(false)
  const [lockReason, setLockReason] = useState("")

  const { data: users } = useGetUserQuery()
  const { data: expiringUsers } = useGetExpiringSoonQuery({ days: 7 })
  const [lockUser] = useLockUserMutation()
  const [unlockUser] = useUnlockUserMutation()

  const blockedUsers = users?.filter((u: Usuario) => u.lockedUntil && new Date(u.lockedUntil) > new Date()) || []

  const handleLockUser = async () => {
    if (!selectedUser) return
    try {
      await lockUser({ userId: selectedUser.userId, reason: lockReason }).unwrap()
      toast.success("Usuario bloqueado correctamente")
      setLockDialogOpen(false)
      setLockReason("")
      setSelectedUser(null)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al bloquear usuario")
    }
  }

  const openHistoryDialog = (userId: string, userName: string) => {
    setSelectedUser({ userId, name: userName })
    setHistoryDialogOpen(true)
  }

  const openLockDialog = (userId: string, userName: string) => {
    setSelectedUser({ userId, name: userName })
    setLockDialogOpen(true)
  }

  const tabs = [
    { key: "logs" as const, label: "Logs", icon: Clock },
    { key: "sessions" as const, label: "Sesiones", icon: Shield },
    { key: "blocked" as const, label: "Bloqueados", icon: Unlock, count: blockedUsers.length },
    { key: "expiring" as const, label: "Expiran Pronto", icon: Calendar, count: expiringUsers?.users.length },
  ]

  return (
    <div className="space-y-6">
      <Card className="border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 shadow-md">
                <Activity className="h-5 w-5 text-white" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <CardTitle className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Monitoreo de Usuarios
                </CardTitle>
                <CardDescription>Historial de actividad y sesiones activas</CardDescription>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <Button
                    key={tab.key}
                    variant={isActive ? "default" : "outline"}
                    onClick={() => setActiveTab(tab.key)}
                    className="transition-all duration-200 hover:shadow-sm"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.label}
                    {(tab.count ?? 0) > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 px-2 text-xs">
                        {tab.count}
                      </Badge>
                    )}
                  </Button>
                )
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            >
              {activeTab === "logs" && <ActivityLogsTab />}
              {activeTab === "sessions" && <SessionsTab />}
              {activeTab === "blocked" && <BlockedUsersTab onOpenHistory={openHistoryDialog} />}
              {activeTab === "expiring" && <ExpiringUsersTab onOpenHistory={openHistoryDialog} />}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {selectedUser && (
        <LoginHistoryDialog
          open={historyDialogOpen}
          onClose={() => { setHistoryDialogOpen(false); setSelectedUser(null) }}
          userId={selectedUser.userId}
          userName={selectedUser.name}
          onUnlock={async (userId) => {
            try {
              await unlockUser({ userId }).unwrap()
              toast.success("Usuario desbloqueado correctamente")
            } catch (error) {
              toast.error("Error al desbloquear usuario")
            }
          }}
          onLock={(userId, reason) => {
            setLockReason(reason || "")
            openLockDialog(userId, selectedUser.name)
          }}
        />
      )}

      <AlertDialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <AlertDialogContent className="border-border/70 bg-card/95 backdrop-blur-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear Usuario Manualmente</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres bloquear al usuario {selectedUser?.name}? Esta acción bloqueará todas las sesiones activas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Razón del bloqueo (opcional)</Label>
            <Input id="reason" value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="Describe la razón del bloqueo..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setLockDialogOpen(false); setLockReason(""); setSelectedUser(null) }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLockUser} className="bg-rose-600 hover:bg-rose-700">
              <Lock className="mr-2 h-4 w-4" />
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
