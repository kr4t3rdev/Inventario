"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Usuario } from "../app/models/model"
// interface User {
//   userId: string
//   name: string
//   email: string
//   role: string
// }

interface AuthContextType {
   user: Usuario | null
   login: (email: string, password: string) => Promise<boolean>
   register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>
   logout: () => void
   loading: boolean
 }

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const checkAuth = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("token")
      if (token) {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        } else if (response.status === 401 || response.status === 403) {
          // Solo invalidar sesión ante respuesta explícita de no-autorizado
          toast.error('Su sesión ha expirado. Por favor inicie sesión nuevamente.')
          sessionStorage.removeItem("token")
          setUser(null)
        }
        // En 500 u otros errores de servidor: mantener la sesión actual
      }
    } catch (error) {
      // Error de red o del servidor: no cerrar sesión, puede ser transitorio
      console.error("Error checking auth:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!loading && user) {
      const interval = setInterval(checkAuth, 30000)
      return () => clearInterval(interval)
    }
  }, [loading, user, checkAuth])

  useEffect(() => {
    if (!loading && !user && typeof window !== 'undefined' && window.location.pathname.startsWith('/busy')) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        checkAuth()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, checkAuth])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })
      
      if (response.status === 403) {
        toast.error('Su usuario ha expirado o esta inactivo, por favor contacte con el administrador y renueve su inicio de sesion')
      }

      if (response.ok) {
        const data = await response.json()
        sessionStorage.setItem("token", data.token)
        setUser(data.user)
        if (data.user?.role === "admin") {
          router.push("/admin")
        } else {
          router.push("/busy/dashboard")
        }
        return true
      }
      return false
    } catch (error) {
      console.error("Login error:", error)
      return false
    }
  }

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : '',
        },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        return { success: true, message: data.message }
      }
      return { success: false, message: data.error || "Error al crear la cuenta" }
    } catch (error) {
      console.error("Register error:", error)
      return { success: false, message: "Error al crear la cuenta" }
    }
  }

const logout = async () => {
    try {
      const token = sessionStorage.getItem("token")
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if(response.ok){
        sessionStorage.removeItem("token")
        setUser(null)
        router.push("/login")
        toast('Sesión cerrada correctamente')
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
      toast.error('Error al cerrar sesión')
    }
  }

  return <AuthContext.Provider value={{ user, login, register, logout, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
