export const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('token') || '';
    return token ? `Bearer ${token}` : '';
  }
  return '';
};

export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('token', token);
  }
};

export const clearAuthToken = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('token');
  }
};

  if (typeof window !== 'undefined') {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      // Si la sesión expiró o es inválida, intentar refresh token antes de logout
      if (response.status === 401) {
        try {
          const refreshRes = await originalFetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          })
          if (refreshRes.ok) {
            const data = await refreshRes.json()
            const newToken = data?.token
            if (newToken) {
              // Guardar token nuevo en sessionStorage
              sessionStorage.setItem('token', newToken)
              // Reintentar la petición original
              return await originalFetch(...args)
            }
          }
        } catch {
          // fall back a bloqueo de sesión
        }
        sessionStorage.removeItem('token')
        const { toast } = await import('sonner')
        toast.error('Su sesión ha expirado o no es válida. Por favor inicie sesión nuevamente.')
        window.location.href = '/login'
      }

      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData?.error === 'Usuario inactivo' || errorData?.error === 'Usuario no encontrado') {
          sessionStorage.removeItem('token')
          const { toast } = await import('sonner')
          toast.error('Su cuenta ha sido desactivada. Contacte al administrador.')
          window.location.href = '/login'
        }
      }

      return response
    }
  }
