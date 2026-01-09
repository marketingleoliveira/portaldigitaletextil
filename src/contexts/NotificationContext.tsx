import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextType {
  unreadCount: {
    groupNotifications: number;
    userNotifications: number;
    ticketMessages: number;
    total: number;
  };
  newAlerts: Array<{
    id: string;
    type: 'notification' | 'user_notification' | 'ticket_message' | 'new_ticket';
    title: string;
    message: string;
    createdAt: string;
    ticketId?: string;
  }>;
  loading: boolean;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
  markAllAsRead: () => Promise<void>;
  dismissAlert: (id: string) => void;
  dismissAllAlerts: () => void;
  refetch: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const {
    unreadCount,
    newAlerts,
    loading,
    markAllAsRead,
    dismissAlert,
    dismissAllAlerts,
    refetch,
  } = useRealtimeNotifications(user);

  const [showBanner, setShowBanner] = useState(true);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        newAlerts,
        loading,
        showBanner,
        setShowBanner,
        markAllAsRead,
        dismissAlert,
        dismissAllAlerts,
        refetch,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};
