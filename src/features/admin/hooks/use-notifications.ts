import { useState, useEffect } from 'react';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Simular notificaciones en tiempo real (en producción usar WebSocket/SSE)
  useEffect(() => {
    // Cargar notificaciones iniciales desde localStorage
    const stored = localStorage.getItem('admin_notifications');
    if (stored) {
      const parsed = JSON.parse(stored);
      setNotifications(parsed);
      setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
    }

    // Simular nuevas notificaciones cada 30 segundos (solo para demo)
    const interval = setInterval(() => {
      // En producción, esto vendría de WebSocket/SSE
      // Por ahora, solo actualizamos el contador
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 50); // Mantener solo las últimas 50
      localStorage.setItem('admin_notifications', JSON.stringify(updated));
      return updated;
    });

    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem('admin_notifications', JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('admin_notifications', JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem('admin_notifications');
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
