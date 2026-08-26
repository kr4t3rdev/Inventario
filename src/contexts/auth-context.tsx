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

const LOGIN_REDIRECTS = new Set([
  '/admin',
  '/onboarding',
  '/sales-agent/referidos',
  '/busy/dashboard',
]);

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<Usuario | null>(initialUser ?? null);
  // La sesión queda resuelta si RootLayout (u otro padre RSC) pasó un valor
  // explícito — sea `Usuario` o `null`. Sólo refetchamos en mount cuando la
  // prop se omitió por completo (modo "sin snapshot de servidor").
  const sessionResolvedFromServer = initialUser !== undefined;
  const [loading, setLoading] = useState(!sessionResolvedFromServer);
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
    // Saltar la revalidación inicial cuando el RSC ya entregó snapshot
    // (usuario presente o `null` confirmado). Polling + visibilitychange
    // cubren cualquier divergencia posterior con el servidor.
    if (sessionResolvedFromServer) {
      return;
    }
    void checkAuth();
  }, [checkAuth, sessionResolvedFromServer]);

  // Polling cada 30s para verificar sesión activa
  useEffect(() => {
    if (!loading && user) {
      const interval = setInterval(checkAuth, 300000);
      return () => clearInterval(interval);
    }
  }, [loading, user, checkAuth]);

  // Redirigir si no hay sesión en rutas protegidas.
  // Sólo aplica cuando NO hubo snapshot de servidor: si el RSC confirmó la
  // sesión (user o null) y decidió renderizar esta URL, no debemos pujar
  // un redirect en cliente. El servidor (layouts/middleware) es responsable
  // de autorizar el render inicial.
  useEffect(() => {
    if (sessionResolvedFromServer) {
      return;
    }
    if (
      !loading &&
      !user &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/busy")
    ) {
      router.push("/login");
    }
  }, [sessionResolvedFromServer, loading, user, router]);

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

        // Los usuarios mid-onboarding necesitan el onboardingToken en
        // sessionStorage: la página /onboarding lo lee para autenticar
        // sus llamadas (mismo contrato que /verify-email).
        if (typeof result.onboardingToken === 'string') {
          sessionStorage.setItem('onboardingToken', result.onboardingToken);
        }

        const fallbackRedirect = result.user?.role === 'admin'
          ? '/admin'
          : result.user?.role === 'salesAgent'
            ? '/sales-agent/referidos'
            : '/busy/dashboard';
        const redirectTo = typeof result.redirectTo === 'string'
          && LOGIN_REDIRECTS.has(result.redirectTo)
          ? result.redirectTo
          : fallbackRedirect;
        router.push(redirectTo);
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
      router.replace('/login');
      router.refresh();
      toast('Sesión cerrada correctamente');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Forzar logout incluso si falla la llamada
      setUser(null);
      router.replace('/login');
      router.refresh();
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
