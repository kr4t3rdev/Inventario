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
            console.log('[Interceptor] Token refresh response:', { ok: refreshRes.ok, hasToken: !!newToken })
            
            if (newToken && newToken !== 'undefined' && newToken !== 'null') {
              // Guardar token nuevo en sessionStorage
              sessionStorage.setItem('token', newToken)
              
              console.log('[Interceptor] Reintentando petición original con nuevo token')
              
              // Recuperar argumentos originales
              const [resource, config] = args
              
              // Asegurar que tenemos un objeto de configuración
              const newConfig = { ...(config || {}) }
              
              // Crear o actualizar headers
              // Nota: config.headers puede ser Headers object, array de arrays, u objeto plano
              const headers = new Headers(newConfig.headers)
              headers.set('Authorization', `Bearer ${newToken}`)
              newConfig.headers = headers
              
              console.log('[Interceptor] Headers actualizados:', headers.get('Authorization')?.substring(0, 20) + '...')
              
              // Si el recurso es un objeto Request, necesitamos clonarlo o crear uno nuevo con los nuevos headers
              if (resource instanceof Request) {
                 // Si es un objeto Request, es mejor crear una nueva request con la misma info pero nuevos headers
                 const newRequest = new Request(resource, {
                   ...newConfig,
                   headers: headers // Los headers de init tienen prioridad
                 })
                 return await originalFetch(newRequest)
              }
              
              return await originalFetch(resource, newConfig)
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
        const errorData = await response.clone().json().catch(() => ({}))
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
