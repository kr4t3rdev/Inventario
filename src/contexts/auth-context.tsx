"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchClientAuthJson } from '@/lib/client-auth-fetch';
import type { Usuario } from "@/app/models/model";

interface AuthContextType {
  user: Usuario | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: Usuario | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<Usuario | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser == null);
  const router = useRouter();

  /**
   * @description Verifica la sesión actual usando la route estable /api/auth/me.
   * Mantiene paridad con el payload actual del backend (`Usuario`) y limpia estado
   * stale cuando el servidor responde 401/403 o códigos equivalentes de auth.
   */
  const checkAuth = useCallback(async () => {
    const result = await fetchClientAuthJson<Usuario>('/api/auth/me', {
      method: 'GET',
      clearState: () => setUser(null),
      defaultErrorMessage: 'Error al verificar autenticación',
    });

    if (result.success) {
      setUser(result.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Polling cada 30s para verificar sesión activa
  useEffect(() => {
    if (!loading && user) {
      const interval = setInterval(checkAuth, 300000);
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
   * @description Inicia sesión usando la route estable /api/auth/login.
   * La cookie httpOnly la setea el servidor.
   * NO guarda el token en sessionStorage.
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok && result.user) {
        setUser(result.user);

        if (result.user?.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/busy/dashboard');
        }
        return true;
      }

      toast.error(result.error ?? 'Error al iniciar sesión');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Error al conectar con el servidor');
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
    referralCode?: string,
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
        body: JSON.stringify({ name, email, password, referralCode }),
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
   * @description Cierra sesión usando la route estable /api/auth/logout.
   * El servidor elimina la cookie httpOnly.
   */
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      router.push('/login');
      toast('Sesión cerrada correctamente');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Forzar logout incluso si falla la llamada
      setUser(null);
      router.push('/login');
      toast.error('Error al cerrar sesión');
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
