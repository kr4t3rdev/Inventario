"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import type { Usuario } from "@/app/models/model"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Save, Shield, User, Clock, AlertCircle, Camera, Mail, Calendar, KeyRound } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getProfile, updateProfile } from "@/app/actions/profile"
import { ServerActionError } from "@/lib/api/errors"
import { toast } from "sonner"
import {
  toCloudinaryAssetUploadResult,
  uploadAsset,
} from "@/lib/upload/upload-asset"
import Loader2 from "@/components/Loaders/hoja/loader"
import { LazyMotion, m as motion, AnimatePresence, useReducedMotion, Variants } from "framer-motion"
import { cn } from "@/lib/utils"

const shouldReduceMotion = typeof window !== 'undefined' 
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
  : false

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12
    }
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 80,
      damping: 15
    }
  },
}

const avatarVariants: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 15
    }
  },
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Cargar perfil via Server Action
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const users = await getProfile()
        const currentUser = (Array.isArray(users) ? users : []).find(
          (u) => u.userId === user?.userId
        )
        setProfile(currentUser || null)
      } catch (err) {
        if (err instanceof ServerActionError) {
          toast.error(err.message)
        } else {
          console.error('Error al cargar perfil:', err)
          toast.error('Error al cargar perfil')
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadProfile()
  }, [user?.userId])

  const [formData, setFormData] = useState({
    name: profile?.name || "",
    avatar: profile?.avatar || "",
    email: profile?.email || "",
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        avatar: profile.avatar || "",
        email: profile.email || "",
      })
    }
  }, [profile])

  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user?.userId) return

    setIsUploading(true)
    const loadingToast = toast.loading("Subiendo imagen...")
    
    try {
      const uploaded = await uploadAsset(file, {
        uploadKey: 'profile.avatar',
        entityId: user.userId,
      })
      const asset = toCloudinaryAssetUploadResult(uploaded)
      setFormData((prev) => ({ ...prev, avatar: uploaded.url }))
      
      const updated = await updateProfile({
        name: formData.name,
        avatar: uploaded.url,
        avatarAsset: asset,
      })
      setProfile(updated)
      
      toast.success("Foto de perfil actualizada correctamente")
    } catch (error) {
      console.error(error)
      toast.error("Error al actualizar la imagen")
    } finally {
      setIsUploading(false)
      toast.dismiss(loadingToast)
    }
  }

  const get_account_time_remaining = (expiresAt?: string | null) => {
    if (!expiresAt) {
      return {
        days: null,
        hours: null,
        minutes: null,
        status: "no-expiration",
        message: "Sin fecha de expiración"
      }
    }

    const expirationDate = new Date(expiresAt)
    const now = new Date()
    const timeDiff = expirationDate.getTime() - now.getTime()

    if (timeDiff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        status: "expired",
        message: "Cuenta expirada"
      }
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))

    let status: "active" | "warning" | "attention" | "expired" | "no-expiration" = "active"
    let message = ""

    if (days <= 7) {
      status = "warning"
      message = `${days} día${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`
    } else if (days <= 30) {
      status = "attention"
      message = `${days} días restantes`
    } else {
      status = "active"
      message = `${days} días restantes`
    }

    return { days, hours, minutes, status, message }
  }

  const accountTime = get_account_time_remaining(profile?.expiresAt)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const updated = await updateProfile({
        name: formData.name,
        avatar: formData.avatar,
      })
      setProfile(updated)
      toast.success("Perfil actualizado correctamente")
    } catch (error) {
      if (error instanceof ServerActionError) {
        toast.error(error.message)
      } else {
        console.error("Error:", error)
        toast.error("Error al actualizar perfil")
      }
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return(
      <div className="flex flex-col items-center justify-center min-h-100 space-y-4">
        <Loader2 />
      </div>
    )
  }

  const initials = profile?.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  const get_account_status_badge = () => {
    type AccountStatus = "expired" | "warning" | "attention" | "active" | "no-expiration"
    const badges: Record<AccountStatus, { variant: "destructive" | "default" | "secondary" | "outline"; className: string; icon: any; label: string }> = {
      expired: { variant: "destructive", className: "bg-red-100 text-red-800 border-red-200", icon: AlertCircle, label: "Expirada" },
      warning: { variant: "destructive", className: "bg-orange-100 text-orange-800 border-orange-200", icon: Clock, label: accountTime.message },
      attention: { variant: "default", className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock, label: accountTime.message },
      active: { variant: "secondary", className: "bg-green-100 text-green-800 border-green-200", icon: Clock, label: accountTime.message },
      "no-expiration": { variant: "outline", className: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock, label: "Sin expiración" },
    }
    
    const config = badges[accountTime.status as AccountStatus] || badges["no-expiration"]
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={cn("border", config.className)}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getRoleBadge = () => {
    if (profile?.role === "admin") {
      return (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
            <Shield className="mr-1 h-3 w-3" />
            Administrador
          </Badge>
        </motion.div>
      )
    }
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
          <User className="mr-1 h-3 w-3" />
          Usuario
        </Badge>
      </motion.div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-1"
      >
        <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-400">
          Mi Perfil
        </h1>
        <p className="text-muted-foreground">
          Gestiona tu información personal y configuración de cuenta
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-6"
      >
        {/* Card: Información Personal */}
        <motion.div variants={cardVariants}>
          <Card className="overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                Información Personal
              </CardTitle>
              <CardDescription>Actualiza tu nombre y foto de perfil</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avatar Section */}
                <motion.div 
                  className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                  variants={itemVariants}
                >
                  <motion.div
                    variants={avatarVariants}
                    className="relative"
                  >
                    <Avatar className="h-24 w-24 border-4 border-white shadow-lg dark:border-slate-800">
                      <AvatarImage src={formData.avatar} alt={profile?.name} className="object-cover" />
                      <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: isUploading ? 1 : 0, scale: isUploading ? 1 : 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"
                    >
                      <Loader2 />
                    </motion.div>
                  </motion.div>
                  
                  <div className="flex flex-col items-center sm:items-start gap-2">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="cursor-pointer"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Cambiar Foto
                      </Button>
                    </motion.div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <p className="text-xs text-muted-foreground">JPG, PNG o GIF. Máx 2MB</p>
                  </div>
                </motion.div>

                {/* Form Fields */}
                <motion.div className="grid gap-4 sm:grid-cols-2" variants={itemVariants}>
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Nombre completo</Label>
                    <motion.div
                      whileFocus={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="cursor-text"
                        placeholder="Tu nombre"
                      />
                    </motion.div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-slate-50 dark:bg-slate-900 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">{profile?.email || "No disponible"}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Submit Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto cursor-pointer">
                    {loading ? (
                      <>
                        <Loader2 />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card: Información de Cuenta */}
        <motion.div variants={cardVariants}>
          <Card className="overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Información de Cuenta
              </CardTitle>
              <CardDescription>Detalles de tu cuenta en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <motion.div 
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                variants={containerVariants}
              >
                {/* Nombre */}
                <motion.div 
                  variants={itemVariants}
                  className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nombre</Label>
                  </div>
                  <motion.p 
                    className="text-sm font-medium"
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    {profile?.name || "No definido"}
                  </motion.p>
                </motion.div>

                {/* Email */}
                <motion.div 
                  variants={itemVariants}
                  className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                  </div>
                  <motion.p 
                    className="text-sm font-medium"
                    whileHover={{ x: 4 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    {profile?.email || "No disponible"}
                  </motion.p>
                </motion.div>

                {/* Rol */}
                <motion.div 
                  variants={itemVariants}
                  className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rol</Label>
                  </div>
                  <div className="mt-1">
                    {getRoleBadge()}
                  </div>
                </motion.div>

                {/* Miembro desde */}
                <motion.div 
                  variants={itemVariants}
                  className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Miembro desde</Label>
                  </div>
                  <motion.p 
                    className="text-sm font-medium"
                    whileHover={{ scale: 1.02 }}
                  >
                    {profile?.createdAt 
                      ? new Date(profile.createdAt).toLocaleDateString('es-ES', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) 
                      : "N/A"}
                  </motion.p>
                </motion.div>

                {/* Estado de cuenta */}
                <motion.div 
                  variants={itemVariants}
                  className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</Label>
                  </div>
                  <div className="mt-1">
                    {get_account_status_badge()}
                  </div>
                </motion.div>

                {/* Fecha de expiración */}
                {profile?.expiresAt && (
                  <motion.div 
                    variants={itemVariants}
                    className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expira</Label>
                    </div>
                    <motion.p 
                      className="text-sm font-medium"
                      whileHover={{ scale: 1.02 }}
                    >
                      {new Date(profile.expiresAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </motion.p>
                    {accountTime.status !== "no-expiration" && accountTime.status !== "expired" && (
                      <motion.p 
                        className="text-xs text-muted-foreground mt-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        {accountTime.days}d {accountTime.hours}h {accountTime.minutes}m restantes
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
