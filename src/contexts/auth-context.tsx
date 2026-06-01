"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginAction, logoutAction, meAction } from "@/features/auth/actions";
import type { Usuario } from "@/app/models/model";

interface AuthContextType {
  user: Usuario | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * @description Verifica la sesión actual usando meAction (Server Action).
   * La cookie httpOnly viaja automáticamente — no necesita Bearer header.
   * No guarda token en sessionStorage.
   */
  const checkAuth = useCallback(async () => {
    try {
      const result = await meAction(undefined);

      if (result.success && result.data) {
        // MeAction devuelve { user: {...} } o directamente el user
        const userData = (result.data as any).user ?? result.data;
        setUser(userData);
      } else {
        // Solo invalidar sesión ante error de auth explícito
        if (result.error?.code === "AUTH_REQUIRED" || result.error?.code === "SESSION_EXPIRED") {
          setUser(null);
        }
        // Errores de servidor (5xx) no invalidan la sesión
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      // Error de red o del servidor: no cerrar sesión, puede ser transitorio
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Polling cada 30s para verificar sesión activa
  useEffect(() => {
    if (!loading && user) {
      const interval = setInterval(checkAuth, 30000);
      return () => clearInterval(interval);
    }
  }, [loading, user, checkAuth]);

  // Redirigir si no hay sesión en rutas protegidas
  useEffect(() => {
    if (
      !loading &&
      !user &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/busy")
    ) {
      router.push("/login");
    }
  }, [loading, user, router]);

  // Re-verificar al volver a la pestaña
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        checkAuth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, checkAuth]);

  /**
   * @description Inicia sesión usando loginAction (Server Action).
   * La cookie httpOnly la setea el servidor.
   * NO guarda el token en sessionStorage.
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await loginAction({ email, password });

      if (result.success && result.data) {
        const userData = (result.data as any).user ?? result.data;
        setUser(userData);

        if (userData?.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/busy/dashboard");
        }
        return true;
      }

      // Manejar errores específicos
      if (result.error?.code === "USER_INACTIVE" || result.error?.code === "LICENSE_EXPIRED") {
        toast.error(result.error.message);
      } else if (result.error?.code === "ACCOUNT_LOCKED") {
        toast.error(result.error.message);
      } else if (result.error?.code === "INVALID_CREDENTIALS") {
        toast.error(result.error.message);
      } else {
        toast.error(result.error?.message ?? "Error al iniciar sesión");
      }

      return false;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Error al conectar con el servidor");
      return false;
    }
  };

  /**
   * @description Registra un nuevo usuario.
   * Usa fetch porque registerAction requiere lógica de onboarding.
   */
  const register = async (
    name: string,
    email: string,
    password: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id":
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : "",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true, message: data.message };
      }
      return { success: false, message: data.error || "Error al crear la cuenta" };
    } catch (error) {
      console.error("Register error:", error);
      return { success: false, message: "Error al crear la cuenta" };
    }
  };

  /**
   * @description Cierra sesión usando logoutAction (Server Action).
   * El servidor elimina la cookie httpOnly.
   */
  const logout = async () => {
    try {
      const result = await logoutAction(undefined);
      setUser(null);
      router.push("/login");
      toast("Sesión cerrada correctamente");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      // Forzar logout incluso si falla la llamada
      setUser(null);
      router.push("/login");
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
